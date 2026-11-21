import { useState } from 'react';
import SocialSignInButton from '../common/SocialSignInButton';
import { requestPracticeChoice } from '../layout/PracticeChooser';
import { Sun, Moon, Loader2 } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import { getMicrosoftAuthCode } from '../../utils/msAuthCode';
import { microsoftOAuthConfig } from '../../config/oauthConfig';

const LoginPage = ({ theme, setTheme, api, setUser, setIsAuthenticated, addNotification, setShowForgotPassword, setCurrentModule, onCreatePractice }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [needsMfa, setNeedsMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  // Signing in had NO busy state at all: you clicked Sign In and the page sat there until
  // the response arrived. On a slow connection that is indistinguishable from a click that
  // missed, so people click again — and this is the first button anyone ever presses.
  const [signingIn, setSigningIn] = useState(false);

  // SEC-20: MSAL is no longer used for sign-in (see handleMicrosoftLogin).

  // Helper function to route user based on their role
  const routeUserByRole = (user) => {
    if (user.role === 'patient') {
      setCurrentModule('patientPortal');
    } else {
      // admin, doctor, staff, or any other role goes to dashboard
      setCurrentModule('dashboard');
    }
  };

  // A patient signed in here (password fall-through or Google/Microsoft): open their portal.
  const enterPortal = async (portal) => {
    api.storePortalSession(portal.sessionToken);
    setUser({ ...portal.patient, role: 'patient' });
    setIsAuthenticated(true);
    setCurrentModule('patientPortal');
    await addNotification('success', 'Welcome to your patient portal');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (signingIn) return;   // a second submit while the first is in flight
    setLoginError('');
    setSigningIn(true);

    try {
      const response = await api.login(email, password, mfaCode || undefined);
      api.storeToken(response.token);
      requestPracticeChoice();   // people at several practices pick one next
      setUser(response.user);
      setIsAuthenticated(true);

      // Route user based on their role
      routeUserByRole(response.user);

      await addNotification('success', 'Login successful');
    } catch (error) {
      // The password was right and a second factor is wanted. Reveal the code field and
      // keep the password the user already typed, rather than making them start over.
      if (error.mfaRequired) {
        setNeedsMfa(true);
        setLoginError(error.message || 'Login failed');
        return;
      }
      // One sign-in box for everyone: not a staff account (or a patient account) -> try the
      // patient portal with the same details, exactly as the mobile app does. A patient no
      // longer has to know there is a separate "Patient Login".
      if (error.status === 401 && !mfaCode) {
        try {
          await enterPortal(await api.patientPortalLogin(email, password));
          return;
        } catch (portalError) {
          // Say what the staff sign-in said (e.g. "1 attempt left") unless the portal has
          // something more specific: a lock, or this being a patient account.
          setLoginError((error.patientAccount || /locked/i.test(portalError.message || '')) ? portalError.message : error.message);
          return;
        }
      }
      setLoginError(error.message || 'Login failed');
    } finally {
      // Both paths: a rejected sign-in has to leave the button usable, or a mistyped
      // password would need a page reload to try again.
      setSigningIn(false);
    }
  };

  // Google OAuth Login
  // SEC-20: authorization-code flow. The browser receives a single-use code instead of a
  // provider access token, so an XSS on this page has nothing to steal — the code is
  // redeemed server-side with the client secret. Requires REACT_APP_GG_CID to be the SAME
  // Google client id as the server's AC_GG_CID.
  const handleGoogleLogin = useGoogleLogin({
    flow: 'auth-code',
    onSuccess: async (codeResponse) => {
      try {
        const response = await api.exchangeGoogleCode(codeResponse.code, 'postmessage');
        if (response.portal) { await enterPortal(response); return; }   // a patient account

        api.storeToken(response.token);
      requestPracticeChoice();   // people at several practices pick one next
        setUser(response.user);
        setIsAuthenticated(true);

        // Route user based on their role
        routeUserByRole(response.user);

        await addNotification('success', 'Logged in with Google');
      } catch (error) {
        setLoginError(error.message || 'Google login failed');
      }
    },
    onError: (error) => {
      setLoginError('Google login failed');
      console.error('Google login error:', error);
    }
  });

  // Microsoft OAuth Login
  // SEC-20: authorization code + PKCE, redeemed on the server. MSAL is not used here
  // because it redeems the code inside the browser, leaving a provider access token in
  // JavaScript — the exposure this change removes. The popup returns only a single-use
  // code, which is useless without the client secret held by the backend.
  const handleMicrosoftLogin = async () => {
    try {
      const { code, redirectUri, codeVerifier } = await getMicrosoftAuthCode(
        microsoftOAuthConfig.auth.clientId
      );
      const response = await api.exchangeMicrosoftCode(code, redirectUri, codeVerifier);
      if (response.portal) { await enterPortal(response); return; }   // a patient account

      api.storeToken(response.token);
      requestPracticeChoice();   // people at several practices pick one next
      setUser(response.user);
      setIsAuthenticated(true);

      // Route user based on their role
      routeUserByRole(response.user);

      await addNotification('success', 'Logged in with Microsoft');
    } catch (error) {
      setLoginError(error.message || 'Microsoft login failed');
      console.error('Microsoft login error:', error);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950' : 'bg-gradient-to-br from-gray-100 via-white to-gray-100'}`}>
      <div className={`max-w-md w-full mx-4 rounded-xl border p-8 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img
              src="/assets/aureoncare-logo.png"
              alt="AureonCare Logo"
              className="h-16 w-auto object-contain"
              style={{ aspectRatio: '1/1' }}
            />
          </div>
          {/* App name renders as visible text and matches the name configured on
              the Google OAuth consent screen exactly. The lines beneath it are the
              statement of purpose: this sign-in screen is the app's home page, so
              it has to say what the product actually is. */}
          <h1 className={`text-3xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            AureonCare
          </h1>
          <p className={`mt-2 text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
            Practice management &amp; telehealth for medical clinics
          </p>
          <p className={`mt-1.5 text-xs leading-relaxed ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
            Appointment scheduling, patient records, e-prescribing, billing,
            and secure video visits — in one platform.
          </p>

          <div className={`my-6 h-px ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'}`} />

          <p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
            Sign in to your account
          </p>
        </div>

        {loginError && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg">
            <p className="text-red-400 text-sm">{loginError}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:border-cyan-500 ${
                theme === 'dark'
                  ? 'bg-slate-800 border-slate-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              required
              placeholder="your.email@example.com"
            />
          </div>

          <div>
            <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:border-cyan-500 ${
                theme === 'dark'
                  ? 'bg-slate-800 border-slate-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              required
              placeholder="Enter your password"
            />
          </div>

          {/* Shown only once the server has asked for it — the password is verified first,
              so the prompt itself never reveals that an address has an account. */}
          {needsMfa && (
            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Authentication code
              </label>
              <input
                type="text"
                inputMode="text"
                autoComplete="one-time-code"
                autoFocus
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg tracking-widest focus:outline-none focus:border-cyan-500 ${
                  theme === 'dark'
                    ? 'bg-slate-800 border-slate-700 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                required
                placeholder="6-digit code, or a recovery code"
              />
              <p className={`mt-1 text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                From your authenticator app. If you have lost your device, use one of the
                recovery codes you saved.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input type="checkbox" className="form-checkbox h-4 w-4 text-cyan-500 rounded" />
              <span className={`ml-2 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Remember me</span>
            </label>
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-cyan-500 hover:text-cyan-400 transition-colors"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={signingIn}
            aria-busy={signingIn || undefined}
            className={`w-full px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-lg font-medium transition-colors text-white flex items-center justify-center gap-2 ${
              signingIn ? 'opacity-70 cursor-wait' : ''
            }`}
          >
            {signingIn && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {signingIn ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className={`w-full border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className={`px-2 ${theme === 'dark' ? 'bg-slate-900 text-slate-400' : 'bg-white text-gray-600'}`}>
                Or continue with
              </span>
            </div>
          </div>

          {/* Each provider's own button style (components/common/SocialSignInButton.js). */}
          <div className="mt-6 space-y-3">
            <SocialSignInButton provider="google" theme={theme} onClick={() => handleGoogleLogin()} />
            <SocialSignInButton provider="microsoft" theme={theme} onClick={handleMicrosoftLogin} />
          </div>
        </div>

        <div className="mt-6 text-center space-y-3">
          {/* Accounts come from invitations: staff are invited by their practice's
              administrator, patients by their practice (SEC-39 — the old self-registration
              page could not create a working account). */}
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            Joining a practice? Ask your administrator to send you an invitation.
          </p>
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            Looking for a doctor?{' '}
            <a href="/find" className="text-cyan-500 hover:text-cyan-400 font-medium transition-colors">Find a practice</a>
          </p>
          {onCreatePractice && (
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              Running a practice?{' '}
              <button
                onClick={onCreatePractice}
                className="text-cyan-500 hover:text-cyan-400 font-medium transition-colors"
              >
                Start a subscription
              </button>
            </p>
          )}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`text-sm ${theme === 'dark' ? 'text-slate-400 hover:text-slate-300' : 'text-gray-600 hover:text-gray-700'}`}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 inline mr-1" /> : <Moon className="w-4 h-4 inline mr-1" />}
            {theme === 'dark' ? 'Light' : 'Dark'} Mode
          </button>
          {/* Real anchor links, not JS-only modals, so reviewers and crawlers can
              reach these pages without signing in. */}
          <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>
            <a href="/about.html" className="hover:text-cyan-500 transition-colors underline">
              About
            </a>
            <span className="mx-1.5">&bull;</span>
            <a href="/privacy.html" className="hover:text-purple-500 transition-colors underline">
              Privacy Policy
            </a>
            <span className="mx-1.5">&bull;</span>
            <a href="/terms.html" className="hover:text-cyan-500 transition-colors underline">
              Terms of Service
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
