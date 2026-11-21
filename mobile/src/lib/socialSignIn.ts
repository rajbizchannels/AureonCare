/**
 * Google / Microsoft sign-in — the parts that are plain logic, kept free of Expo so they
 * can be tested with node (tests/socialSignIn.test.mjs).
 *
 * The flow is brokered by the server (backend/services/mobileOAuth.js): the app opens the
 * system browser at `<server>/api/auth/mobile/oauth/<provider>/start`, the server signs the
 * person in with the provider and sends the browser back to the app's own link with a
 * one-time code, and the app redeems that code together with the PKCE verifier only it
 * knows. The app never holds a client id or a provider token.
 */

export type Provider = 'google' | 'microsoft';

export const PROVIDER_LABEL: Record<Provider, string> = {
  google: 'Google',
  microsoft: 'Microsoft',
};

/** RFC 4648 §5 base64url without padding, from standard base64. */
export function base64ToBase64Url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const VERIFIER_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

/** A PKCE code verifier (RFC 7636: 43–128 unreserved characters) from random bytes. */
export function verifierFromBytes(bytes: Uint8Array): string {
  if (bytes.length < 43) throw new Error('need at least 43 random bytes');
  let out = '';
  for (const b of bytes) out += VERIFIER_ALPHABET[b % VERIFIER_ALPHABET.length];
  return out.slice(0, 128);
}

/** The browser URL that starts the sign-in on the server. */
export function startUrl(serverUrl: string, provider: Provider, redirectUri: string, codeChallenge: string): string {
  const base = serverUrl.replace(/\/+$/, '');
  const q = new URLSearchParams({ redirect_uri: redirectUri, code_challenge: codeChallenge, code_challenge_method: 'S256' });
  return `${base}/api/auth/mobile/oauth/${provider}/start?${q.toString()}`;
}

export type ReturnResult =
  | { kind: 'code'; code: string }
  | { kind: 'error'; error: string; reason?: string };

/** Read what the server put on the app link: ?code=… or ?error=…[&reason=…]. */
export function parseReturnUrl(url: string): ReturnResult {
  const q = url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0] : '';
  const params = new URLSearchParams(q);
  const code = params.get('code');
  if (code) return { kind: 'code', code };
  return { kind: 'error', error: params.get('error') || 'unknown', reason: params.get('reason') || undefined };
}

/** What to tell the person when the browser leg did not end with a code. */
export function returnErrorMessage(provider: Provider, r: { error: string; reason?: string }): string {
  const name = PROVIDER_LABEL[provider];
  switch (r.error) {
    case 'cancelled':
      return '';   // they closed or declined: no error, just back to the sign-in screen
    case 'expired':
      return 'That sign-in took too long. Please try again.';
    case 'provider_error':
      return r.reason
        ? `${name} did not complete the sign-in (${r.reason}). Your practice may need to check its ${name} set-up.`
        : `${name} did not complete the sign-in. Please try again.`;
    default:
      return `Could not sign in with ${name}. Please try again.`;
  }
}

/** The server's answer to a redeem — the same shape the web sign-in receives. */
export type RedeemResponse = {
  token?: string;
  user?: unknown;
  portal?: boolean;
  sessionToken?: string;
  patient?: { id: string } & Record<string, unknown>;
};

export type Landing =
  | { kind: 'staff'; token: string; user: unknown }
  | { kind: 'portal'; sessionToken: string; patient: { id: string } & Record<string, unknown> };

/** Which shell the answer opens. Throws if the answer is neither (a server bug). */
export function landingFor(res: RedeemResponse): Landing {
  if (res.portal && res.sessionToken && res.patient && res.patient.id) {
    return { kind: 'portal', sessionToken: res.sessionToken, patient: res.patient };
  }
  if (res.token && res.user) return { kind: 'staff', token: res.token, user: res.user };
  throw new Error('The server answered the sign-in in a way this app does not understand.');
}
