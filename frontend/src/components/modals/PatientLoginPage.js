import React, { useState, useEffect } from 'react';
import SocialSignInButton from '../common/SocialSignInButton';
import { Sun, Moon } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import { getMicrosoftAuthCode } from '../../utils/msAuthCode';
import { microsoftOAuthConfig } from '../../config/oauthConfig';
import { useAudit } from '../../hooks/useAudit';
import PrivacyPolicyPage from './PrivacyPolicyPage';
import TermsOfServicePage from './TermsOfServicePage';

const PatientLoginPage = ({ theme, setTheme, api, setUser, setIsAuthenticated, addNotification, setShowForgotPassword, setCurrentModule }) => {
  const { logViewAccess, logError } = useAudit();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showToS, setShowToS] = useState(false);

  // SEC-20: MSAL is no longer used for sign-in (see handleMicrosoftLogin).

  // Log page access on mount
  useEffect(() => {
    logViewAccess('PatientLoginPage', {
      module: 'Patient Portal',
    });
  }, [logViewAccess]);

  // Helper function to route patient to patient portal
  const routePatient = () => {
    setCurrentModule('patientPortal');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    try {
      // Use patient portal login endpoint
      const response = await api.patientPortalLogin(email, password);

      // Patient portal login returns { patient, sessionToken, expiresAt }
      api.storePortalSession(response.sessionToken);
      setUser(response.patient);
      setIsAuthenticated(true);

      // Route to patient portal
      routePatient();

      await addNotification('success', 'Welcome to your patient portal');
    } catch (error) {
      logError('PatientLoginPage', 'view', error.message, {
        module: 'Patient Portal',
        metadata: {
          // DO NOT log password or sensitive data
          loginMethod: 'email',
        },
      });
      setLoginError(error.message || 'Login failed. Please check your credentials.');
    }
  };

  // Google OAuth Login
  // SEC-20: authorization-code flow. The patient's browser receives a single-use code
  // instead of a provider access token, so an XSS here has nothing to steal — the code
  // is redeemed server-side with the client secret.
  const handleGoogleLogin = useGoogleLogin({
    flow: 'auth-code',
    onSuccess: async (codeResponse) => {
      try {
        const response = await api.exchangePortalOAuthCode('google', codeResponse.code, 'postmessage');

        // Patient portal login returns { patient, sessionToken, expiresAt }
        api.storePortalSession(response.sessionToken);
        setUser(response.patient);
        setIsAuthenticated(true);

        // Route to patient portal
        routePatient();

        await addNotification('success', 'Welcome to your patient portal');
      } catch (error) {
        logError('PatientLoginPage', 'view', error.message, {
          module: 'Patient Portal',
          metadata: {
            loginMethod: 'google',
          },
        });
        setLoginError(error.message || 'Google login failed. Please ensure your account is linked to a patient record.');
      }
    },
    onError: (error) => {
      logError('PatientLoginPage', 'view', 'Google OAuth error', {
        module: 'Patient Portal',
        metadata: {
          loginMethod: 'google',
        },
      });
      setLoginError('Google login failed');
      console.error('Google login error:', error);
    }
  });

  // Microsoft OAuth Login
  const handleMicrosoftLogin = async () => {
    try {
      const { code, redirectUri, codeVerifier } = await getMicrosoftAuthCode(
        microsoftOAuthConfig.auth.clientId
      );
      const response = await api.exchangePortalOAuthCode('microsoft', code, redirectUri, codeVerifier);

      // Patient portal login returns { patient, sessionToken, expiresAt }
      api.storePortalSession(response.sessionToken);
      setUser(response.patient);
      setIsAuthenticated(true);

      // Route to patient portal
      routePatient();

      await addNotification('success', 'Welcome to your patient portal');
    } catch (error) {
      logError('PatientLoginPage', 'view', error.message, {
        module: 'Patient Portal',
        metadata: {
          loginMethod: 'microsoft',
        },
      });
      setLoginError(error.message || 'Microsoft login failed. Please ensure your account is linked to a patient record.');
      console.error('Microsoft login error:', error);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gradient-to-br from-blue-950 via-indigo-900 to-blue-950' : 'bg-gradient-to-br from-blue-100 via-white to-blue-100'}`}>
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
          <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Patient Portal</h1>
          <p className={`mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Access your health records</p>
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
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:border-blue-500 ${
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
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:border-blue-500 ${
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
              <input type="checkbox" className="form-checkbox h-4 w-4 text-blue-500 rounded" />
              <span className={`ml-2 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Remember me</span>
            </label>
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-blue-500 hover:text-blue-400 transition-colors"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 rounded-lg font-medium transition-colors text-white"
          >
            Sign In to Patient Portal
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
          {/* Patients join through their practice's invitation (portal invites) — there
              is no self-registration (SEC-39). */}
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            New to the portal? Your practice will email you an invitation to set it up —
            ask them if you haven't received one.
          </p>
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            Looking for a doctor or clinic?{' '}
            <a href="/find" className="text-blue-500 hover:text-blue-400 font-medium transition-colors">Find a practice</a>
          </p>
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            Healthcare provider?{' '}
            <a
              href="/"
              className="text-blue-500 hover:text-blue-400 font-medium transition-colors"
            >
              Clinic Login
            </a>
          </p>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`text-sm ${theme === 'dark' ? 'text-slate-400 hover:text-slate-300' : 'text-gray-600 hover:text-gray-700'}`}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 inline mr-1" /> : <Moon className="w-4 h-4 inline mr-1" />}
            {theme === 'dark' ? 'Light' : 'Dark'} Mode
          </button>
          <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>
            <button
              type="button"
              onClick={() => setShowToS(true)}
              className="hover:text-cyan-500 transition-colors underline"
            >
              Terms of Service
            </button>
            <span className="mx-1">&bull;</span>
            <button
              type="button"
              onClick={() => setShowPrivacyPolicy(true)}
              className="hover:text-blue-500 transition-colors underline"
            >
              Privacy Policy &amp; HIPAA Notice
            </button>
          </p>
        </div>
      </div>

      {showToS && (
        <TermsOfServicePage
          theme={theme}
          onClose={() => setShowToS(false)}
        />
      )}

      {showPrivacyPolicy && (
        <PrivacyPolicyPage
          theme={theme}
          onClose={() => setShowPrivacyPolicy(false)}
        />
      )}
    </div>
  );
};

export default PatientLoginPage;
