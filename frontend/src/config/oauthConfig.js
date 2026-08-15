// OAuth Configuration for Social Login
// These values should be set in .env file for production

export const googleOAuthConfig = {
  clientId: process.env.REACT_APP_GG_CID || 'YOUR_GOOGLE_CLIENT_ID'
};

export const microsoftOAuthConfig = {
  auth: {
    clientId: process.env.REACT_APP_MS_CID || 'YOUR_MICROSOFT_CLIENT_ID',
    authority: 'https://login.microsoftonline.com/common',
    // Accept either env-var name — .env.example historically documented
    // REACT_APP_AUTH_URI while the code read REACT_APP_REDIRECT_URI. Support both so
    // a build configured under either name works; falls back to the current origin.
    redirectUri: process.env.REACT_APP_REDIRECT_URI || process.env.REACT_APP_AUTH_URI || window.location.origin,
    // After a redirect-based login, navigate to the redirectUri root rather
    // than back to the page that triggered the login request. Keeps the SPA
    // from landing back on the Register page after OAuth completes.
    navigateToLoginRequestUrl: false
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false
  },
  system: {
    // Use async popup monitoring so MSAL does not synchronously poll
    // window.closed on a cross-origin popup, which browsers with COOP
    // same-origin-allow-popups report as a console warning.
    asyncPopups: true
  }
};

export const facebookOAuthConfig = {
  appId: process.env.REACT_APP_FB_AID || 'YOUR_FACEBOOK_APP_ID',
  version: '18.0'
};
