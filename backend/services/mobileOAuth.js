// Google / Microsoft sign-in for the mobile app, brokered by the server (migration 098).
//
//   app ── opens browser ──▶ GET /api/auth/mobile/oauth/:provider/start
//                               ?redirect_uri=aureoncare://auth&code_challenge=…&code_challenge_method=S256
//   server ── 302 ──▶ provider sign-in (server's web client, server-side PKCE, random state)
//   provider ── 302 ──▶ GET /api/auth/mobile/oauth/:provider/callback?code&state
//   server: redeems the provider code, keeps the tokens ENCRYPTED for 2 minutes,
//           ── 302 ──▶ aureoncare://auth?code=<one-time code>
//   app ── POST /api/auth/mobile/oauth/redeem { code, code_verifier } ──▶ the SAME answer the
//           web sign-in gives (staff session, patient portal session, or the reason not)
//
// Why brokered: the app can point at any AureonCare server, so it cannot carry client ids,
// and a secret must never ship in an app. Why a second PKCE (app ↔ server): another app can
// register the same link scheme and receive the one-time code, but without the verifier the
// code is useless.

const crypto = require('crypto');
const { encrypt, decrypt } = require('../utils/messageCrypto');
const { microsoftClientId, googleClientId } = require('../utils/oauthClientIds');

const START_TTL_MIN = 10;     // to finish signing in at the provider
const HANDOFF_TTL_SEC = 120;  // between the browser closing and the app redeeming
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const random = (n = 32) => b64url(crypto.randomBytes(n));
const challengeOf = (verifier) => b64url(crypto.createHash('sha256').update(String(verifier)).digest());

/**
 * Where the app may be sent back to. Only the app's own link scheme by default; extra
 * prefixes (e.g. exp:// for Expo Go during development) come from AC_MOBILE_REDIRECTS.
 * Never http(s): an attacker's web page must not receive a code.
 */
function allowedRedirect(uri) {
  const u = String(uri || '');
  if (!u || u.length > 300 || /[\s<>"']/.test(u)) return false;
  if (/^(https?|javascript|data|file):/i.test(u)) return false;
  const prefixes = ['aureoncare://', ...String(process.env.AC_MOBILE_REDIRECTS || '').split(',').map((s) => s.trim()).filter(Boolean)];
  return prefixes.some((p) => u.startsWith(p));
}

function publicBase(req) {
  // AC_PUBLIC_URL pins it when set. Otherwise the address the phone actually reached — the
  // provider sends the browser back to the same server, and this is what has to be
  // registered with Google/Microsoft. (FRONTEND_URL was used before: it can hold a list or a
  // different origin, and then the address sent to Google matched nothing registered.)
  const pinned = (process.env.AC_PUBLIC_URL || '').trim().replace(/\/+$/, '');
  if (pinned) return pinned;
  const proto = String(req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
  const host = String(req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
  return `${proto}://${host}`;
}
const callbackUrl = (req, provider) => `${publicBase(req)}/api/auth/mobile/oauth/${provider}/callback`;

function configured(provider) {
  if (provider === 'google') return Boolean(googleClientId() && process.env.AC_GG_CSK);
  if (provider === 'microsoft') return Boolean(microsoftClientId() && process.env.AC_MS_CSK);
  return false;
}

function providerAuthUrl(provider, { redirectUri, state, challenge }) {
  if (provider === 'google') {
    const q = new URLSearchParams({
      client_id: googleClientId(), redirect_uri: redirectUri, response_type: 'code',
      scope: 'openid email profile', state, code_challenge: challenge, code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }
  const q = new URLSearchParams({
    client_id: microsoftClientId(), redirect_uri: redirectUri, response_type: 'code', response_mode: 'query',
    scope: 'openid profile email offline_access https://graph.microsoft.com/User.Read',
    state, code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account',
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${q}`;
}

/** Step 1. Returns { url } to redirect the browser to, or { error, status }. */
async function start(pool, req, provider, { redirectUri, codeChallenge, method }) {
  if (provider !== 'google' && provider !== 'microsoft') return { status: 400, error: 'Unsupported provider' };
  if (!configured(provider)) return { status: 503, error: `${provider === 'google' ? 'Google' : 'Microsoft'} sign-in is not configured on this server.` };
  if (!allowedRedirect(redirectUri)) return { status: 400, error: 'This app link is not allowed.' };
  if (method !== 'S256' || !/^[A-Za-z0-9_-]{43,128}$/.test(String(codeChallenge || ''))) {
    return { status: 400, error: 'A PKCE code_challenge (S256) is required.' };
  }
  const state = random();
  const providerVerifier = random(48);
  await pool.query(
    `INSERT INTO public.mobile_oauth_flows (provider, state_hash, app_challenge, app_redirect, provider_verifier, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + make_interval(mins => $6))`,
    [provider, sha(state), codeChallenge, redirectUri, providerVerifier, START_TTL_MIN]);
  // Old rows are useless after a few minutes; prune opportunistically.
  pool.query(`DELETE FROM public.mobile_oauth_flows WHERE expires_at < now() - interval '1 hour'`).catch(() => {});
  return { url: providerAuthUrl(provider, { redirectUri: callbackUrl(req, provider), state, challenge: challengeOf(providerVerifier) }) };
}

const withParam = (uri, params) => `${uri}${uri.includes('?') ? '&' : '?'}${new URLSearchParams(params)}`;

/**
 * Step 2 (provider → server). Returns { redirect } to send the browser back to the app,
 * or { error, status } when there is no app to send it to.
 */
async function callback(pool, req, provider, { code, state, error }, exchangeAuthCode) {
  if (!state) return { status: 400, error: 'Missing state.' };
  const { rows: [flow] } = await pool.query(
    `SELECT * FROM public.mobile_oauth_flows
      WHERE state_hash = $1 AND provider = $2 AND code_hash IS NULL AND used_at IS NULL AND expires_at > now()`,
    [sha(state), provider]);
  if (!flow) return { status: 400, error: 'This sign-in has expired. Go back to the app and try again.' };
  const back = (params) => ({ redirect: withParam(flow.app_redirect, params) });
  // The person cancelled, or the provider refused: tell the app, burn the attempt.
  if (error || !code) {
    await pool.query('UPDATE public.mobile_oauth_flows SET used_at = now() WHERE id = $1', [flow.id]);
    return back({ error: error === 'access_denied' ? 'cancelled' : 'provider_error' });
  }
  let tokens;
  try {
    tokens = await exchangeAuthCode(provider, { code, redirectUri: callbackUrl(req, provider), codeVerifier: flow.provider_verifier });
  } catch (e) {
    await pool.query('UPDATE public.mobile_oauth_flows SET used_at = now() WHERE id = $1', [flow.id]);
    console.warn(`[mobile-oauth] ${provider} exchange failed:`, e.providerError || e.message);
    return back({ error: 'provider_error', ...(e.providerError ? { reason: e.providerError } : {}) });
  }
  const handoff = random();
  const sealed = encrypt(JSON.stringify({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken || null }));
  const { rowCount } = await pool.query(
    `UPDATE public.mobile_oauth_flows
        SET code_hash = $2, token_ciphertext = $3, token_iv = $4, token_tag = $5,
            expires_at = now() + make_interval(secs => $6)
      WHERE id = $1 AND code_hash IS NULL AND used_at IS NULL`,
    [flow.id, sha(handoff), sealed.ciphertext, sealed.iv, sealed.tag, HANDOFF_TTL_SEC]);
  if (!rowCount) return back({ error: 'expired' });   // the same callback twice
  return back({ code: handoff });
}

/**
 * Step 3 (app → server). Returns { provider, accessToken, refreshToken } once, or
 * { error, status }. Single use: a replay, a wrong verifier or an expired code all fail,
 * and a wrong verifier burns the code.
 */
async function redeem(pool, { code, codeVerifier }) {
  if (!code || !codeVerifier) return { status: 400, error: 'code and code_verifier are required.' };
  const { rows: [flow] } = await pool.query(
    `UPDATE public.mobile_oauth_flows SET used_at = now()
      WHERE code_hash = $1 AND used_at IS NULL AND expires_at > now()
      RETURNING id, provider, app_challenge, token_ciphertext, token_iv, token_tag`, [sha(code)]);
  // Wipe the tokens whatever happens next: they are needed for exactly one request.
  if (flow) pool.query('UPDATE public.mobile_oauth_flows SET token_ciphertext = NULL, token_iv = NULL, token_tag = NULL WHERE id = $1', [flow.id]).catch(() => {});
  if (!flow) return { status: 400, error: 'This sign-in has expired or was already used. Try again.' };
  const a = Buffer.from(challengeOf(codeVerifier)); const b = Buffer.from(flow.app_challenge);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { status: 400, error: 'This sign-in could not be verified. Try again.' };
  }
  const plain = decrypt({ ciphertext: flow.token_ciphertext, iv: flow.token_iv, tag: flow.token_tag });
  if (!plain) return { status: 500, error: 'Sign-in failed. Try again.' };
  const t = JSON.parse(plain);
  return { provider: flow.provider, accessToken: t.accessToken, refreshToken: t.refreshToken };
}

module.exports = { start, callback, redeem, allowedRedirect, challengeOf, configured, callbackUrl, publicBase };
