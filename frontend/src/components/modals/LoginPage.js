import { useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import { getMicrosoftAuthCode } from '../../utils/msAuthCode';
import { microsoftOAuthConfig } from '../../config/oauthConfig';

const LoginPage = ({ theme, setTheme, api, setUser, setIsAuthenticated, addNotification, setShowForgotPassword, setCurrentModule, setShowRegister, onCreatePractice }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

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

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    try {
      const response = await api.login(email, password);
      api.storeToken(response.token);
      setUser(response.user);
      setIsAuthenticated(true);

      // Route user based on their role
      routeUserByRole(response.user);

      await addNotification('success', 'Login successful');
    } catch (error) {
      setLoginError(error.message || 'Login failed');
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

        api.storeToken(response.token);
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

      api.storeToken(response.token);
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
            className="w-full px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-lg font-medium transition-colors text-white"
          >
            Sign In
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

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              onClick={handleGoogleLogin}
              className={`flex items-center justify-center px-4 py-3 border rounded-lg transition-colors ${theme === 'dark' ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-gray-300 hover:bg-gray-50 text-gray-700'}`}
              title="Sign in with Google"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </button>
            <button
              onClick={handleMicrosoftLogin}
              className={`flex items-center justify-center px-4 py-3 border rounded-lg transition-colors ${theme === 'dark' ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-gray-300 hover:bg-gray-50 text-gray-700'}`}
              title="Sign in with Microsoft"
            >
              <svg className="w-5 h-5" viewBox="0 0 23 23">
                <path fill="#f25022" d="M0 0h11v11H0z"/>
                <path fill="#00a4ef" d="M12 0h11v11H12z"/>
                <path fill="#7fba00" d="M0 12h11v11H0z"/>
                <path fill="#ffb900" d="M12 12h11v11H12z"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="mt-6 text-center space-y-3">
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            Don't have an account?{' '}
            <button
              onClick={() => setShowRegister(true)}
              className="text-cyan-500 hover:text-cyan-400 font-medium transition-colors"
            >
              Register here
            </button>
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
