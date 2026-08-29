// SEC-20: Microsoft sign-in via authorization code + PKCE, redeemed server-side.
//
// MSAL is deliberately NOT used for login. MSAL redeems the code inside the browser, so
// the SPA ends up holding a provider access token — exactly the exposure this change
// removes. Here the browser only ever handles a single-use code, which is worthless
// without the client secret held by the server.
//
// MSAL remains in the app for other Microsoft features; only the login path changes.
//
// Azure requirements:
//   * the redirect URI below must be registered on the app registration
//   * it must sit under the **Web** platform, because the code is redeemed with a client
//     secret (Azure refuses a secret for redirect URIs registered as single-page app)

const AUTHORITY = 'https://login.microsoftonline.com/common';
const SCOPES = 'openid profile email offline_access https://graph.microsoft.com/User.Read';

const base64Url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const randomString = (len = 64) => {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return base64Url(a).slice(0, len);
};

async function pkcePair() {
  const verifier = randomString(64);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(digest) };
}

/** The callback page served from the SPA's own origin (public/ms-oauth-callback.html). */
export function msRedirectUri() {
  return `${window.location.origin}/ms-oauth-callback.html`;
}

/**
 * Open the Microsoft sign-in popup and resolve with { code, redirectUri, codeVerifier }.
 * The caller posts these to the backend, which performs the exchange.
 */
export async function getMicrosoftAuthCode(clientId) {
  if (!clientId || clientId === 'YOUR_MICROSOFT_CLIENT_ID') {
    throw new Error('Microsoft sign-in is not configured (REACT_APP_MS_CID).');
  }

  const { verifier, challenge } = await pkcePair();
  const state = randomString(32);
  const redirectUri = msRedirectUri();

  const url = `${AUTHORITY}/oauth2/v2.0/authorize?` + new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();

  const popup = window.open(url, 'ms-oauth', 'width=520,height=680,menubar=no,toolbar=no');
  if (!popup) throw new Error('Popup blocked. Allow popups for this site and try again.');

  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      clearInterval(closedTimer);
      clearTimeout(timeout);
    };

    const onMessage = (event) => {
      // Only accept messages from our own origin and our own callback page.
      if (event.origin !== window.location.origin) return;
      const d = event.data;
      if (!d || d.source !== 'ms-oauth') return;
      // state must round-trip — guards against a stray/forged message.
      if (d.state && d.state !== state) return;

      settled = true;
      cleanup();
      try { popup.close(); } catch (_) { /* already closed */ }

      if (d.ok && d.code) resolve({ code: d.code, redirectUri, codeVerifier: verifier });
      else reject(new Error(d.error || 'Microsoft sign-in failed.'));
    };

    window.addEventListener('message', onMessage);

    // The user may simply close the popup.
    const closedTimer = setInterval(() => {
      if (!settled && popup.closed) {
        cleanup();
        reject(new Error('Sign-in was cancelled.'));
      }
    }, 500);

    const timeout = setTimeout(() => {
      if (!settled) {
        cleanup();
        try { popup.close(); } catch (_) { /* ignore */ }
        reject(new Error('Microsoft sign-in timed out.'));
      }
    }, 5 * 60 * 1000);
  });
}
