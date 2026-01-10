import React, { useState, useEffect } from 'react';
import { Heart, Sun, Moon } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import { useMsal } from '@azure/msal-react';
import { useAudit } from '../../hooks/useAudit';

const PatientLoginPage = ({ theme, setTheme, api, setUser, setIsAuthenticated, addNotification, setShowForgotPassword, setCurrentModule, setShowRegister }) => {
  const { logViewAccess, logError } = useAudit();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const { instance } = useMsal();

  // Log page access on mount
  useEffect(() => {
    logViewAccess('PatientLoginPage', {
      module: 'Patient Portal',
    });
  }, []);

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
  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        // Get user info from Google
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: {
            Authorization: `Bearer ${tokenResponse.access_token}`
          }
        });
        const userInfo = await userInfoResponse.json();

        // Login with our backend using patient portal login
        const response = await api.patientPortalLogin(
          null, // email
          null, // password
          'google', // provider
          userInfo.sub, // providerId
          tokenResponse.access_token // accessToken
        );

        // Patient portal login returns { patient, sessionToken, expiresAt }
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
      const loginResponse = await instance.loginPopup({
        scopes: ['user.read']
      });

      // Get user info
      const userInfo = loginResponse.account;

      // Login with our backend using patient portal login
      const response = await api.patientPortalLogin(
        null, // email
        null, // password
        'microsoft', // provider
        userInfo.homeAccountId, // providerId
        loginResponse.accessToken // accessToken
      );

      // Patient portal login returns { patient, sessionToken, expiresAt }
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
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Heart className="w-8 h-8 text-white" />
          </div>
          <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>MedFlow Patient Portal</h1>
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
            New patient?{' '}
            <button
              onClick={() => setShowRegister(true)}
              className="text-blue-500 hover:text-blue-400 font-medium transition-colors"
            >
              Register here
            </button>
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
        </div>
      </div>
    </div>
  );
};

export default PatientLoginPage;
