# OAuth Social Login Setup Guide

Quick reference for setting up social login with Google, Microsoft, and Facebook.

## Quick Start

1. Copy the example environment file:
   ```bash
   cp frontend/.env.example frontend/.env
   ```

2. Follow the provider-specific guides below to get your credentials

3. Update `frontend/.env` with your credentials

4. Restart the frontend application

---

## Google OAuth Setup

### Step-by-Step Guide

1. **Go to Google Cloud Console**
   - Navigate to: https://console.cloud.google.com/

2. **Create or Select Project**
   - Click on project dropdown (top left)
   - Click "New Project" or select existing project

3. **Enable Google+ API**
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API"
   - Click "Enable"

4. **Create OAuth Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - If prompted, configure OAuth consent screen:
     - User Type: External
     - App name: MedFlow
     - User support email: your email
     - Developer contact: your email
     - Save and continue through all steps

5. **Configure OAuth Client**
   - Application type: **Web application**
   - Name: MedFlow Web Client
   - Authorized JavaScript origins:
     ```
     http://localhost:3001
     https://yourdomain.com (for production)
     ```
   - Authorized redirect URIs:
     ```
     http://localhost:3001
     https://yourdomain.com (for production)
     ```

6. **Copy Credentials**
   - Copy the **Client ID** (looks like: `123456789-abc...googleusercontent.com`)
   - Add to `frontend/.env`:
     ```env
     REACT_APP_GOOGLE_CLIENT_ID=your_client_id_here
     ```

### Testing Google Login

1. Start your application
2. Navigate to login page
3. Click the Google button
4. Select your Google account
5. Grant permissions
6. You should be logged in automatically

---

## Microsoft OAuth Setup

### Step-by-Step Guide

1. **Go to Azure Portal**
   - Navigate to: https://portal.azure.com/

2. **Register Application**
   - Search for "Azure Active Directory"
   - Click "App registrations"
   - Click "New registration"

3. **Configure App Registration**
   - Name: MedFlow
   - Supported account types:
     ```
     Accounts in any organizational directory (Any Azure AD directory - Multitenant)
     and personal Microsoft accounts (e.g. Skype, Xbox)
     ```
   - Redirect URI:
     - Platform: Web
     - URI: `http://localhost:3001`
   - Click "Register"

4. **Configure Authentication**
   - Go to "Authentication" in left menu
   - Under "Implicit grant and hybrid flows":
     - Check "ID tokens"
     - Check "Access tokens"
   - Click "Save"

5. **Add Platform (if needed)**
   - Click "Add a platform"
   - Choose "Single-page application"
   - Add redirect URI: `http://localhost:3001`
   - Click "Configure"

6. **Copy Credentials**
   - Go to "Overview"
   - Copy the **Application (client) ID** (UUID format)
   - Add to `frontend/.env`:
     ```env
     REACT_APP_MICROSOFT_CLIENT_ID=your_client_id_here
     ```

### Testing Microsoft Login

1. Start your application
2. Navigate to login page
3. Click the Microsoft button
4. Sign in with Microsoft account
5. Grant permissions
6. You should be logged in automatically

---

## Facebook OAuth Setup

### Step-by-Step Guide

1. **Go to Facebook Developers**
   - Navigate to: https://developers.facebook.com/

2. **Create App**
   - Click "My Apps" > "Create App"
   - Choose "Consumer"
   - Click "Next"

3. **Configure App**
   - Display Name: MedFlow
   - App Contact Email: your email
   - Click "Create App"

4. **Add Facebook Login**
   - In dashboard, find "Facebook Login"
   - Click "Set Up"
   - Choose "Web"

5. **Configure Site URL**
   - Enter Site URL: `http://localhost:3001`
   - Click "Save"
   - Click "Continue"

6. **Configure OAuth Settings**
   - Go to "Facebook Login" > "Settings" (left sidebar)
   - Valid OAuth Redirect URIs:
     ```
     http://localhost:3001/
     https://yourdomain.com/ (for production)
     ```
   - Click "Save Changes"

7. **Make App Public (for production)**
   - Go to "Settings" > "Basic"
   - Scroll to bottom
   - Toggle "App Mode" to "Live"
   - Complete app review requirements

8. **Copy Credentials**
   - Go to "Settings" > "Basic"
   - Copy the **App ID**
   - Add to `frontend/.env`:
     ```env
     REACT_APP_FACEBOOK_APP_ID=your_app_id_here
     ```

### Testing Facebook Login

1. Start your application
2. Navigate to login page
3. Click the Facebook button
4. Sign in with Facebook account
5. Grant permissions
6. You should be logged in automatically

---

## Environment Configuration Summary

Your `frontend/.env` should look like this:

```env
# API Configuration
REACT_APP_API_URL=http://localhost:3000/api

# OAuth Configuration
REACT_APP_GOOGLE_CLIENT_ID=123456789-abcdefgh.apps.googleusercontent.com
REACT_APP_MICROSOFT_CLIENT_ID=12345678-1234-1234-1234-123456789abc
REACT_APP_FACEBOOK_APP_ID=1234567890123456

# Redirect URI
REACT_APP_REDIRECT_URI=http://localhost:3001
```

---

## Common Issues and Solutions

### Google OAuth Issues

**Issue:** "redirect_uri_mismatch" error
- **Solution:** Ensure the redirect URI in Google Console exactly matches your app URL (including http/https)

**Issue:** "Access blocked: This app's request is invalid"
- **Solution:** Configure OAuth consent screen in Google Console

### Microsoft OAuth Issues

**Issue:** "AADSTS50011: The reply URL specified in the request does not match"
- **Solution:** Check redirect URIs in Azure Portal > Authentication settings

**Issue:** Login popup closes immediately
- **Solution:** Enable "ID tokens" and "Access tokens" in Authentication settings

### Facebook OAuth Issues

**Issue:** "URL Blocked: This redirect failed"
- **Solution:** Add the URL to Valid OAuth Redirect URIs in Facebook Login settings

**Issue:** "App Not Set Up: This app is still in development mode"
- **Solution:** In development, only test users can log in. Add test users in "Roles" section

---

## Production Deployment

### Update Redirect URIs

For each provider, add your production URLs:

**Google:**
- Add `https://yourdomain.com` to Authorized JavaScript origins
- Add `https://yourdomain.com` to Authorized redirect URIs

**Microsoft:**
- Add `https://yourdomain.com` to Redirect URIs in Authentication

**Facebook:**
- Add `https://yourdomain.com/` to Valid OAuth Redirect URIs
- Switch app to "Live" mode

### Update Environment Variables

Production `frontend/.env`:
```env
REACT_APP_API_URL=https://api.yourdomain.com/api
REACT_APP_GOOGLE_CLIENT_ID=your_production_google_id
REACT_APP_MICROSOFT_CLIENT_ID=your_production_microsoft_id
REACT_APP_FACEBOOK_APP_ID=your_production_facebook_id
REACT_APP_REDIRECT_URI=https://yourdomain.com
```

---

## Security Best Practices

1. **Never commit `.env` files** to version control
   - Keep `.env` in `.gitignore`
   - Use `.env.example` as template

2. **Use different credentials** for development and production

3. **Rotate credentials** if compromised

4. **Enable HTTPS** in production

5. **Restrict domains** in OAuth provider settings

6. **Review permissions** requested from users

7. **Monitor OAuth logs** in provider consoles

---

## Testing Checklist

- [ ] Google login button appears on login page
- [ ] Microsoft login button appears on login page
- [ ] Facebook login button appears on login page
- [ ] Clicking Google opens OAuth popup
- [ ] Clicking Microsoft opens OAuth popup
- [ ] Clicking Facebook opens OAuth popup
- [ ] Successful login redirects to dashboard
- [ ] User information is correctly saved
- [ ] Social account is linked in database
- [ ] Logout works correctly
- [ ] Re-login with same social account works

---

## API Integration

The frontend OAuth flow automatically calls the backend API:

```javascript
POST /api/auth/social-login
{
  "provider": "google" | "microsoft" | "facebook",
  "providerId": "unique_user_id_from_provider",
  "accessToken": "oauth_access_token",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "profileData": { /* full profile from provider */ }
}
```

The backend will:
1. Check if user exists by email or social provider ID
2. Create new user if doesn't exist
3. Link social account to user
4. Generate JWT token
5. Return user object and token

---

## Support Resources

- **Google OAuth:** https://developers.google.com/identity/protocols/oauth2
- **Microsoft OAuth:** https://docs.microsoft.com/en-us/azure/active-directory/develop/
- **Facebook OAuth:** https://developers.facebook.com/docs/facebook-login/

---

## Quick Verification

To verify OAuth is working without a full login flow:

```bash
# Check Google config
curl https://accounts.google.com/.well-known/openid-configuration

# Check Microsoft config
curl https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration

# Check Facebook config
curl "https://graph.facebook.com/v18.0/me?access_token=YOUR_TOKEN"
```
