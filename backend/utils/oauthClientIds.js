// One place that decides which OAuth client id we are.
//
// The client id was resolved three different ways, and they disagreed:
//
//   utils/oauthExchange.js      read AC_MS_CID / AC_GG_CID only
//   services/cloudBackupStorage read ['AC_MS_CID', 'REACT_APP_MS_CID']
//   routes/integrationOAuth.js  read REACT_APP_MS_CID only
//
// So a deployment with both names set to DIFFERENT values had sign-in using one app
// registration and the cloud-storage integration using another — each failing in a way
// that pointed at the wrong thing. (This is the same shape as the Google sign-in 503
// earlier: the server's client id must equal the one the browser authorised with, or the
// provider rejects the code exchange.)
//
// The REACT_APP_-prefixed name wins. That is not arbitrary: Create React App exposes only
// REACT_APP_-prefixed variables to the browser bundle, so that is necessarily the id the
// user's browser authorised with, and the server has to match it. The unprefixed name
// stays as a fallback so deployments that set only it keep working.
//
// Client ids are public identifiers, not secrets — they are already in the shipped bundle.
// Client SECRETS are resolved elsewhere and must never be named REACT_APP_*.

/** First of these environment variables that holds a non-empty value. */
const firstSet = (...names) => {
  for (const name of names) {
    const value = process.env[name];
    if (value && String(value).trim()) return String(value).trim();
  }
  return null;
};

/** Azure AD / Entra application (client) id — Microsoft sign-in, Teams, OneDrive. */
const microsoftClientId = () => firstSet('REACT_APP_MS_CID', 'AC_MS_CID');

/** Google OAuth client id — Google sign-in, Google Drive, Meet. */
const googleClientId = () => firstSet('REACT_APP_GG_CID', 'AC_GG_CID');

module.exports = { firstSet, microsoftClientId, googleClientId };
