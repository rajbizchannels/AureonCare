import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiClient, ApiError, type Account, type Credential } from '@/lib/api';
import { credentials, prefs } from '@/lib/storage';
import { DEFAULT_SERVER_URL, loadServerUrl, saveServerUrl } from '@/lib/server';

/**
 * Who is signed in, against which server, and with which credential.
 *
 * The shell a person sees is derived from `account.role` and nothing else —
 * the app never asks. `isPatient` is the only branch the navigators read.
 */

type Status = 'loading' | 'signed-out' | 'signed-in';

interface SessionValue {
  status: Status;
  account: Account | null;
  serverUrl: string;
  api: ApiClient;
  isPatient: boolean;
  signInWithPassword(email: string, password: string): Promise<void>;
  signInWithProvider(input: {
    provider: 'google' | 'microsoft';
    providerId: string;
    accessToken: string;
  }): Promise<void>;
  signOut(): Promise<void>;
  changeServer(origin: string): Promise<void>;
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
    setStatus('signed-in');
  }, []);

  /**
   * One email box, two backends. Staff live in `users` and get a JWT; portal
   * patients live in `patients` and get a session token. The person should not
   * have to know which they are, so this tries staff first and falls back to
   * the portal on a 401 — and only reports failure when both refuse.
   */
  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const client = new ApiClient(serverUrl, null);

      try {
        const { token, user } = await client.signInStaff(email, password);
        await establish({ kind: 'staff', token }, user);
        return;
      } catch (error) {
        const isAuthFailure = error instanceof ApiError && (error.status === 401 || error.status === 404);
        if (!isAuthFailure) throw error;
      }

      const portal = await client.signInPortal(email, password);
      await establish(
        { kind: 'portal', token: portal.sessionToken, patientId: portal.patient.id },
        { ...portal.patient, role: 'patient' }
      );
    },
    [serverUrl, establish]
  );

  const signInWithProvider = useCallback(
    async (input: { provider: 'google' | 'microsoft'; providerId: string; accessToken: string }) => {
      const client = new ApiClient(serverUrl, null);
      const { token, user } = await client.signInSocial(input);
      await establish({ kind: 'staff', token }, user);
    },
    [serverUrl, establish]
  );

  const signOut = useCallback(async () => {
    await credentials.clear();
    await prefs.set('account', null);
    setCredential(null);
    setAccount(null);
    setStatus('signed-out');
  }, []);

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

  const value = useMemo<SessionValue>(
    () => ({
      status,
      account,
      serverUrl,
      api,
      isPatient: account?.role === 'patient',
      signInWithPassword,
      signInWithProvider,
      signOut,
      changeServer,
    }),
    [status, account, serverUrl, api, signInWithPassword, signInWithProvider, signOut, changeServer]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};
