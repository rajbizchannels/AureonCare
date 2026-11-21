import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ApiClient, ApiError,
  type Account, type Credential, type UnauthorizedReason,
} from '@/lib/api';
import {
  can as canDo, canAdmin as canDoAdmin, shellFor,
  type Action, type AdminGrants, type Module, type Role, type Shell,
} from '@/lib/permissions';
import { credentials, prefs } from '@/lib/storage';
import { DEFAULT_SERVER_URL, loadServerUrl, saveServerUrl } from '@/lib/server';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
  base64ToBase64Url, landingFor, parseReturnUrl, returnErrorMessage, startUrl, verifierFromBytes,
  type Provider,
} from '@/lib/socialSignIn';

/**
 * Who is signed in, against which server, and with which credential.
 *
 * The shell a person sees is derived from `account.role` and nothing else —
 * the app never asks. Everything role-shaped is exposed from here (`shell`,
 * `can`, `canAdmin`) so no screen has to reach for the matrix itself and no
 * two screens can disagree about what a receptionist may open.
 */

type Status = 'loading' | 'signed-out' | 'signed-in';

/**
 * Sign-in is not always one step. When the practice requires a second factor
 * the password call comes back with the challenge and no token, and the screen
 * asks for the code. Modelled as a returned value rather than a thrown error
 * because it is a normal outcome, not a failure.
 */
export type SignInOutcome =
  | { kind: 'signed-in' }
  | { kind: 'mfa-required'; message: string }
  | { kind: 'mfa-enrolment-required'; message: string };

interface SessionValue {
  status: Status;
  account: Account | null;
  role: Role | undefined;
  shell: Shell;
  serverUrl: string;
  api: ApiClient;
  isPatient: boolean;
  /**
   * True when the credential is a portal session rather than a staff JWT.
   * The portal's self-service routes authorise on that session, so a patient
   * holding a staff-issued JWT cannot reach them — screens check this and say
   * so rather than letting the call 401.
   */
  actorIsPortal: boolean;
  /** Set when the last session ended by itself, so sign-in can say why. */
  endedReason: UnauthorizedReason | null;
  can(module: Module, action?: Action): boolean;
  canAdmin(key: keyof AdminGrants): boolean;
  signInWithPassword(email: string, password: string, mfaCode?: string): Promise<SignInOutcome>;
  /**
   * Google / Microsoft in the system browser, brokered by the server. Resolves 'cancelled'
   * when the person closed the browser or declined; throws with a message to show otherwise.
   */
  signInWithProvider(provider: Provider): Promise<'signed-in' | 'cancelled'>;
  signOut(): Promise<void>;
  changeServer(origin: string): Promise<void>;
  /** Re-read the account, so a role change lands without a sign-out. */
  refreshAccount(): Promise<void>;
  /** Continue in another practice this account belongs to. */
  switchPractice(practiceId: string): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export const useSession = (): SessionValue => {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
};

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<Status>('loading');
  const [account, setAccount] = useState<Account | null>(null);
  const [serverUrl, setServerUrl] = useState<string>(DEFAULT_SERVER_URL);
  const [credential, setCredential] = useState<Credential | null>(null);
  const [endedReason, setEndedReason] = useState<UnauthorizedReason | null>(null);

  // One client instance per (server, credential) pair rather than one per call,
  // so a token refresh or server change propagates everywhere at once.
  const api = useMemo(() => new ApiClient(serverUrl, credential), [serverUrl, credential]);

  // ── Boot: restore server, then any stored credential ─────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const url = await loadServerUrl();
      const staff = await credentials.getStaffToken();
      const portal = await credentials.getPortalToken();
      const storedAccount = await prefs.get('account');

      if (cancelled) return;
      setServerUrl(url);

      const parsed = storedAccount ? (JSON.parse(storedAccount) as Account) : null;
      if (parsed && (staff || portal)) {
        setCredential(
          staff
            ? { kind: 'staff', token: staff }
            : { kind: 'portal', token: portal as string, patientId: parsed.id }
        );
        setAccount(parsed);
        setStatus('signed-in');
      } else {
        setStatus('signed-out');
      }
    })().catch(() => {
      if (!cancelled) setStatus('signed-out');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const establish = useCallback(async (next: Credential, nextAccount: Account) => {
    if (next.kind === 'staff') {
      await credentials.setStaffToken(next.token);
      await credentials.setPortalToken(null);
    } else {
      await credentials.setPortalToken(next.token);
      await credentials.setStaffToken(null);
    }
    await prefs.set('account', JSON.stringify(nextAccount));
    setCredential(next);
    setAccount(nextAccount);
    setEndedReason(null);
    setStatus('signed-in');
  }, []);

  /**
   * One email box, two backends. Staff live in `users` and get a JWT; portal
   * patients live in `patients` and get a session token. The person should not
   * have to know which they are, so this tries staff first and falls back to
   * the portal — and only reports failure when both refuse.
   *
   * The second factor interrupts that fallback. A 401 carrying `mfaRequired`
   * means the staff password was *correct*, so trying the portal with it would
   * be both pointless and a wasted rate-limit slot — and the person would be
   * told "invalid email or password" about a password that was right.
   */
  const signInWithPassword = useCallback(
    async (email: string, password: string, mfaCode?: string): Promise<SignInOutcome> => {
      const client = new ApiClient(serverUrl, null);

      try {
        const { token, user } = await client.signInStaff(email, password, mfaCode);
        await establish({ kind: 'staff', token }, user);
        return { kind: 'signed-in' };
      } catch (error) {
        if (error instanceof ApiError && error.mfaRequired) {
          return { kind: 'mfa-required', message: error.message };
        }
        if (error instanceof ApiError && error.mfaEnrolmentRequired) {
          return { kind: 'mfa-enrolment-required', message: error.message };
        }
        // 403 `patientAccount` is not a refusal to act on — it is the staff
        // endpoint saying "right password, wrong door". Without it in this
        // list the error escaped and every patient was told their correct
        // password was invalid.
        const isAuthFailure =
          error instanceof ApiError &&
          (error.status === 401 || error.status === 404 || error.patientAccount);
        if (!isAuthFailure) throw error;
      }

      // A code was entered, so this is the second leg of a staff sign-in. The
      // portal has no second factor, so falling through to it here would turn
      // "that code is not valid" into "invalid email or password".
      if (mfaCode) throw new ApiError(401, 'That code is not valid.');

      const portal = await client.signInPortal(email, password);
      await establish(
        { kind: 'portal', token: portal.sessionToken, patientId: portal.patient.id },
        { ...portal.patient, role: 'patient' }
      );
      return { kind: 'signed-in' };
    },
    [serverUrl, establish]
  );

  const signInWithProvider = useCallback(
    async (provider: Provider): Promise<'signed-in' | 'cancelled'> => {
      // PKCE between this app and the server: whoever else receives the app link cannot
      // redeem the code without this verifier.
      const verifier = verifierFromBytes(Crypto.getRandomBytes(64));
      const challenge = base64ToBase64Url(await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 }
      ));
      // aureoncare://auth in a build; exp://…/--/auth in Expo Go (the server must allow it).
      const redirect = Linking.createURL('auth');
      const result = await WebBrowser.openAuthSessionAsync(
        startUrl(serverUrl, provider, redirect, challenge), redirect
      );
      if (result.type !== 'success') return 'cancelled';

      const back = parseReturnUrl(result.url);
      if (back.kind === 'error') {
        const message = returnErrorMessage(provider, back);
        if (!message) return 'cancelled';
        throw new ApiError(400, message);
      }

      const client = new ApiClient(serverUrl, null);
      const landing = landingFor(await client.redeemMobileOAuth(back.code, verifier));
      if (landing.kind === 'portal') {
        await establish(
          { kind: 'portal', token: landing.sessionToken, patientId: landing.patient.id },
          { ...(landing.patient as unknown as Account), role: 'patient' } as Account
        );
      } else {
        await establish({ kind: 'staff', token: landing.token }, landing.user as Account);
      }
      return 'signed-in';
    },
    [serverUrl, establish]
  );

  const endSession = useCallback(async (reason: UnauthorizedReason | null) => {
    await credentials.clear();
    await prefs.set('account', null);
    setCredential(null);
    setAccount(null);
    setEndedReason(reason);
    setStatus('signed-out');
  }, []);

  /**
   * Signing out tells the server first.
   *
   * `/auth/logout` bumps `token_version`, which revokes the JWT on every
   * device; the portal route deletes the session row. Clearing only the
   * Keychain left a live token on a phone someone had just handed back. The
   * call cannot block the local clear — if the network is down, getting the
   * person off this device still has to work.
   *
   * Not called for a session the server has already rejected: the credential
   * is dead, and a revocation request with it would only 401.
   */
  const signOut = useCallback(async () => {
    if (credential) await api.signOut();
    await endSession(null);
  }, [api, credential, endSession]);

  /**
   * A rejected credential ends the session rather than leaving the app in a
   * signed-in state where every screen fails. Routine rather than exceptional:
   * the backend can revoke a JWT (SEC-09), portal sessions lapse after 24h,
   * and a practice can set an idle timeout that signs people out mid-shift.
   *
   * The reason is carried through so the sign-in screen can say "signed out
   * after 15 minutes of inactivity" instead of silently reappearing.
   */
  useEffect(() => {
    api.setUnauthorizedHandler((reason) => {
      void endSession(reason);
    });
    return () => api.setUnauthorizedHandler(null);
  }, [api, endSession]);

  /**
   * Roles change while someone is signed in — a nurse is promoted, a locum's
   * access is narrowed. The stored account is a cache of the last sign-in, so
   * this re-reads it from the server and re-renders the shell if it moved.
   */
  const refreshAccount = useCallback(async () => {
    if (!credential) return;
    const fresh = await api.me();
    await prefs.set('account', JSON.stringify(fresh));
    setAccount((prev) => ({ ...prev, ...fresh }));
  }, [api, credential]);

  /**
   * Continue in another practice.
   *
   * One person can work at several, and hold a *different role* in each — a
   * nurse at one, an admin at another. So this is not a filter over the same
   * session: the server issues a new token for the new membership, and the
   * app adopts the account that comes back with it. The shell re-derives,
   * because `shellFor(role)` reads the account that just changed.
   *
   * `establish` replaces the stored credential, so the old practice's token
   * is gone from the Keychain rather than lingering beside the new one.
   */
  const switchPractice = useCallback(
    async (practiceId: string) => {
      const { token, user } = await api.switchPractice(practiceId);
      await establish({ kind: 'staff', token }, user);
    },
    [api, establish]
  );

  /**
   * Changing the server invalidates the session by definition — the token was
   * issued by a different deployment — so this signs out rather than leaving a
   * credential that will start 401ing on the next request.
   */
  const changeServer = useCallback(
    async (origin: string) => {
      await saveServerUrl(origin);
      setServerUrl(origin);
      await signOut();
    },
    [signOut]
  );

  const role = account?.role;

  const value = useMemo<SessionValue>(
    () => ({
      status,
      account,
      role,
      shell: shellFor(role),
      serverUrl,
      api,
      isPatient: role === 'patient',
      actorIsPortal: credential?.kind === 'portal',
      endedReason,
      can: (module, action = 'view') => canDo(role, module, action),
      canAdmin: (key) => canDoAdmin(role, key),
      signInWithPassword,
      signInWithProvider,
      signOut,
      changeServer,
      refreshAccount,
      switchPractice,
    }),
    [
      status, account, role, serverUrl, api, endedReason, credential,
      signInWithPassword, signInWithProvider, signOut, changeServer, refreshAccount,
      switchPractice,
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};
