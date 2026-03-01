// OAuth Configuration for Social Login
// These values should be set in .env file for production

export const googleOAuthConfig = {
  clientId: process.env.REACT_APP_GG_CID || 'YOUR_GOOGLE_CLIENT_ID'
};

export const microsoftOAuthConfig = {
  auth: {
    clientId: process.env.REACT_APP_MS_CID || 'YOUR_MICROSOFT_CLIENT_ID',
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: process.env.REACT_APP_AUTH_URI || 'http://localhost:3001'
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false
  }
};

export const facebookOAuthConfig = {
  appId: process.env.REACT_APP_FB_AID || 'YOUR_FACEBOOK_APP_ID',
  version: '18.0'
};
