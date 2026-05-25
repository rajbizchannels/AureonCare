/**
 * Server-side validation of social provider access tokens.
 *
 * Each function calls the provider's identity API with the supplied access token
 * and returns verified identity data.  If the token is invalid or expired the
 * provider API returns a non-2xx response and we throw — callers should catch
 * this and respond with 401.
 *
 * Returns: { providerId, email, firstName, lastName }
 *   providerId  – canonical identifier stored in social_auth.provider_user_id
 *   email       – verified email from the provider (may be null for MS work accounts
 *                 without a proxy address)
 */

const TIMEOUT_MS = 8000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function validateGoogle(accessToken) {
  const response = await fetchWithTimeout('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Google token validation failed (${response.status}): ${body}`);
  }
  const data = await response.json();
  if (!data.sub) throw new Error('Google userinfo missing sub claim');
  return {
    providerId: data.sub,
    email: data.email || null,
    firstName: data.given_name || '',
    lastName: data.family_name || ''
  };
}

async function validateMicrosoft(accessToken) {
  const response = await fetchWithTimeout('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Microsoft token validation failed (${response.status}): ${body}`);
  }
  const data = await response.json();
  if (!data.id) throw new Error('Microsoft Graph response missing id field');
  return {
    // Canonical id is the OID returned by Graph.
    // MSAL homeAccountId has format "<oid>.<tenantId>" — callers that stored the
    // old format can match via the isMicrosoftMatch helper below.
    providerId: data.id,
    email: data.mail || data.userPrincipalName || null,
    firstName: data.givenName || '',
    lastName: data.surname || ''
  };
}

async function validateFacebook(accessToken) {
  const url = new URL('https://graph.facebook.com/me');
  url.searchParams.set('fields', 'id,email,first_name,last_name');
  url.searchParams.set('access_token', accessToken);
  const response = await fetchWithTimeout(url.toString());
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Facebook token validation failed (${response.status}): ${body}`);
  }
  const data = await response.json();
  if (data.error) throw new Error(`Facebook token error: ${data.error.message}`);
  if (!data.id) throw new Error('Facebook Graph response missing id field');
  return {
    providerId: data.id,
    email: data.email || null,
    firstName: data.first_name || '',
    lastName: data.last_name || ''
  };
}

/**
 * Validates the access token with the named provider.
 * @param {string} provider - 'google' | 'microsoft' | 'facebook'
 * @param {string} accessToken
 * @returns {Promise<{providerId, email, firstName, lastName}>}
 */
async function validateSocialToken(provider, accessToken) {
  if (!accessToken) throw new Error('Access token is required for provider validation');
  switch (provider) {
    case 'google':    return validateGoogle(accessToken);
    case 'microsoft': return validateMicrosoft(accessToken);
    case 'facebook':  return validateFacebook(accessToken);
    default:          throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Returns true when claimedId matches verifiedId — handles the Microsoft
 * MSAL homeAccountId format ("<oid>.<tenantId>") where verifiedId is the OID.
 */
function isProviderIdMatch(provider, verifiedId, claimedId) {
  if (!verifiedId || !claimedId) return false;
  if (String(verifiedId) === String(claimedId)) return true;
  // Microsoft: MSAL homeAccountId starts with the OID followed by a dot
  if (provider === 'microsoft' && String(claimedId).startsWith(verifiedId + '.')) return true;
  return false;
}

module.exports = { validateSocialToken, isProviderIdMatch };
