// SEC-20: redeem an OAuth authorization code for a provider access token, server-side.
//
// Shared by the staff login (routes/auth.js) and the patient portal
// (routes/patient-portal.js) so the two flows cannot drift — the client secret is used in
// exactly one place, and the redeemed token never leaves the server process.

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

/**
 * @param {'google'|'microsoft'} provider
 * @param {{code: string, redirectUri?: string, codeVerifier?: string}} params
 * @returns {Promise<{accessToken: string, refreshToken: string|null}>}
 * @throws {Error} with .statusCode set (503 unconfigured, 401 rejected, 502 unreachable)
 */
async function exchangeAuthCode(provider, { code, redirectUri, codeVerifier }) {
  const fail = (statusCode, message) => {
    const e = new Error(message); e.statusCode = statusCode; throw e;
  };
  if (!code) fail(400, 'Authorization code is required');

  let url, body;
  if (provider === 'google') {
    const id = process.env.AC_GG_CID, secret = process.env.AC_GG_CSK;
    if (!id || !secret) fail(503, 'Google sign-in is not configured on the server (AC_GG_CID / AC_GG_CSK).');
    url = GOOGLE_TOKEN_URL;
    body = {
      code, client_id: id, client_secret: secret,
      // 'postmessage' is Google's redirect_uri for popup/auth-code flows started in JS.
      redirect_uri: redirectUri || 'postmessage',
      grant_type: 'authorization_code',
    };
  } else if (provider === 'microsoft') {
    const id = process.env.AC_MS_CID, secret = process.env.AC_MS_CSK;
    if (!id || !secret) fail(503, 'Microsoft sign-in is not configured on the server (AC_MS_CID / AC_MS_CSK).');
    if (!redirectUri) fail(400, 'redirectUri is required');
    url = MS_TOKEN_URL;
    body = {
      client_id: id, client_secret: secret, code, redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      scope: 'https://graph.microsoft.com/User.Read offline_access openid profile email',
    };
    if (codeVerifier) body.code_verifier = codeVerifier; // PKCE, when the client used it
  } else {
    fail(400, `Unsupported provider: ${provider}`);
  }

  let data;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString(),
    });
    data = await resp.json();
    if (!resp.ok || !data.access_token) {
      console.warn(`[SEC-20] ${provider} code exchange failed:`, data.error_description || data.error || resp.status);
      fail(401, 'Sign-in failed. Please try again.');
    }
  } catch (err) {
    if (err.statusCode) throw err;
    console.error(`[SEC-20] ${provider} token endpoint unreachable:`, err.message);
    fail(502, 'Could not reach the sign-in provider.');
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token || null };
}

module.exports = { exchangeAuthCode };
