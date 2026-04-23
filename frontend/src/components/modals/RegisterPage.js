import React, { useState, useEffect } from 'react';
import { ArrowLeft, UserPlus, CheckCircle } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import { useMsal } from '@azure/msal-react';
import { useAudit } from '../../hooks/useAudit';
import PrivacyPolicyPage from './PrivacyPolicyPage';
import TermsOfServicePage from './TermsOfServicePage';

const RegisterPage = ({ theme, api, addNotification, onClose, onRegistered }) => {
  const { logViewAccess, logError } = useAudit();
  const { instance } = useMsal();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'patient',
    practice: ''
  });
  const [registerError, setRegisterError] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(''); // 'google' | 'microsoft' | ''
  const [registered, setRegistered] = useState(false); // show success screen
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [showToS, setShowToS] = useState(false);

  useEffect(() => {
    logViewAccess('RegisterPage', { module: 'Auth' });
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegisterError('');

    if (formData.password !== formData.confirmPassword) {
      setRegisterError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setRegisterError('Password must be at least 6 characters long');
      return;
    }

    if (!tosAccepted) {
      setRegisterError('You must accept the Terms of Service to register.');
      return;
    }

    if (!privacyAccepted) {
      setRegisterError('You must accept the Privacy Policy and HIPAA Notice of Privacy Practices to register.');
      return;
    }

    setLoading(true);

    try {
      const userData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        role: formData.role,
        practice: formData.practice || 'New Practice',
        status: 'pending'
      };

      const newUser = await api.createUser(userData);

      // Trigger default intake forms for patient self-registrations
      if (formData.role === 'patient' && newUser?.id) {
        const DEFAULT_INTAKE_FORMS = [
          { name: 'New Patient Registration', slug: 'new-patient-registration' },
          { name: 'Patient Intake Questionnaire', slug: 'patient-intake-questionnaire' },
          { name: 'HIPAA Authorization', slug: 'hipaa-authorization' },
          { name: 'Consent for Treatment', slug: 'consent-for-treatment' }
        ];
        for (const form of DEFAULT_INTAKE_FORMS) {
          await api.createFormSubmission({
            template_name: form.name,
            template_version: '1.0',
            patient_id: newUser.id,
            form_data: {},
            status: 'draft',
            language: 'en',
            metadata: { trigger: 'self_registration', template_slug: form.slug }
          }).catch(err => console.error('Non-critical: Could not create intake form:', err));
        }
      }

      setRegistered(true);

      if (onRegistered) {
        onRegistered(newUser);
      }
    } catch (error) {
      logError('RegisterPage', 'view', error.message, {
        module: 'Auth',
        metadata: { registrationAttempt: true }
      });
      setRegisterError(error.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth registration
  const handleGoogleRegister = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setSocialLoading('google');
      setRegisterError('');
      try {
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
        });
        const userInfo = await userInfoRes.json();

        await api.socialRegister(
          'google',
          userInfo.sub,
          tokenResponse.access_token,
          userInfo.email,
          userInfo.given_name,
          userInfo.family_name,
          userInfo
        );

        setRegistered(true);
      } catch (error) {
        setRegisterError(error.message || 'Google registration failed');
      } finally {
        setSocialLoading('');
      }
    },
    onError: () => {
      setRegisterError('Google sign-in was cancelled or failed');
      setSocialLoading('');
    }
  });

  // Microsoft OAuth registration
  const handleMicrosoftRegister = async () => {
    setSocialLoading('microsoft');
    setRegisterError('');
    try {
      const loginResponse = await instance.loginPopup({ scopes: ['user.read'] });
      const userInfo = loginResponse.account;

      await api.socialRegister(
        'microsoft',
        userInfo.homeAccountId,
        loginResponse.accessToken,
        userInfo.username,
        userInfo.name?.split(' ')[0] || '',
        userInfo.name?.split(' ').slice(1).join(' ') || '',
        userInfo
      );

      setRegistered(true);
    } catch (error) {
      setRegisterError(error.message || 'Microsoft registration failed');
    } finally {
      setSocialLoading('');
    }
  };

  const inputClass = `w-full px-4 py-3 border rounded-lg focus:outline-none focus:border-purple-500 ${
    theme === 'dark'
      ? 'bg-slate-800 border-slate-700 text-white'
      : 'bg-white border-gray-300 text-gray-900'
  }`;

  // ── Success screen ────────────────────────────────────────────────────────
  if (registered) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950' : 'bg-gradient-to-br from-gray-100 via-white to-gray-100'}`}>
        <div className={`max-w-md w-full mx-4 rounded-xl border p-10 text-center ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Registration Successful!
          </h2>
          <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            Your account is pending approval by an administrator. You will receive an email once your account is activated.
          </p>
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg font-medium text-white transition-colors"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  // ── Registration form ─────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950' : 'bg-gradient-to-br from-gray-100 via-white to-gray-100'}`}>
      <div className={`max-w-2xl w-full mx-4 rounded-xl border p-8 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
        <div className="mb-6">
          <button
            onClick={onClose}
            className={`flex items-center gap-2 text-sm mb-4 ${theme === 'dark' ? 'text-slate-400 hover:text-slate-300' : 'text-gray-600 hover:text-gray-700'}`}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </button>

          <div className="flex items-center gap-4">
            <img
              src="/assets/aureoncare-logo.png"
              alt="AureonCare Logo"
              className="h-14 w-auto object-contain"
            />
            <div>
              <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Create Account</h1>
              <p className={`mt-1 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Register for AureonCare</p>
            </div>
          </div>
        </div>

        {registerError && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg">
            <p className="text-red-400 text-sm">{registerError}</p>
          </div>
        )}

        {/* ── Social registration buttons ── */}
        <div className="mb-6">
          <p className={`text-sm font-medium mb-3 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
            Quick register with
          </p>
          <div className="grid grid-cols-2 gap-3">
            {/* Google */}
            <button
              type="button"
              onClick={handleGoogleRegister}
              disabled={!!socialLoading}
              className={`flex items-center justify-center gap-2 px-4 py-3 border rounded-lg transition-colors ${
                theme === 'dark'
                  ? 'border-slate-700 hover:bg-slate-800 text-slate-300'
                  : 'border-gray-300 hover:bg-gray-50 text-gray-700'
              } disabled:opacity-60 disabled:cursor-wait`}
            >
              {socialLoading === 'google' ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current" />
              ) : (
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              <span className="text-sm font-medium">Google</span>
            </button>

            {/* Microsoft */}
            <button
              type="button"
              onClick={handleMicrosoftRegister}
              disabled={!!socialLoading}
              className={`flex items-center justify-center gap-2 px-4 py-3 border rounded-lg transition-colors ${
                theme === 'dark'
                  ? 'border-slate-700 hover:bg-slate-800 text-slate-300'
                  : 'border-gray-300 hover:bg-gray-50 text-gray-700'
              } disabled:opacity-60 disabled:cursor-wait`}
            >
              {socialLoading === 'microsoft' ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current" />
              ) : (
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 23 23">
                  <path fill="#f25022" d="M0 0h11v11H0z"/>
                  <path fill="#00a4ef" d="M12 0h11v11H12z"/>
                  <path fill="#7fba00" d="M0 12h11v11H0z"/>
                  <path fill="#ffb900" d="M12 12h11v11H12z"/>
                </svg>
              )}
              <span className="text-sm font-medium">Microsoft</span>
            </button>
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className={`w-full border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`} />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className={`px-2 ${theme === 'dark' ? 'bg-slate-900 text-slate-400' : 'bg-white text-gray-600'}`}>
              Or register with email
            </span>
          </div>
        </div>

        {/* ── Email/password form ── */}
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                First Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className={inputClass}
                required
                placeholder="John"
              />
            </div>

            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Last Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className={inputClass}
                required
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              Email Address <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={inputClass}
              required
              placeholder="your.email@example.com"
            />
          </div>

          <div>
            <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              Phone Number <span className="text-red-400">*</span>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className={inputClass}
              required
              placeholder="(555) 123-4567"
            />
          </div>

          <div>
            <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              Practice Name
            </label>
            <input
              type="text"
              value={formData.practice}
              onChange={(e) => setFormData({ ...formData, practice: e.target.value })}
              className={inputClass}
              placeholder="Your Medical Practice"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Password <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={inputClass}
                required
                minLength={6}
                placeholder="Minimum 6 characters"
              />
            </div>

            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Confirm Password <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className={inputClass}
                required
                minLength={6}
                placeholder="Re-enter password"
              />
            </div>
          </div>

          <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'}`}>
            <p className={`text-sm ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
              <strong>Note:</strong> Your account will be pending approval by an administrator. You will receive an email once your account is activated.
            </p>
          </div>

          {/* Terms of Service Consent */}
          <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-cyan-50 border-cyan-200'}`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={tosAccepted}
                onChange={(e) => setTosAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-400 text-cyan-500 flex-shrink-0 cursor-pointer"
              />
              <span className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-cyan-300' : 'text-cyan-800'}`}>
                I have read and agree to the{' '}
                <button
                  type="button"
                  onClick={() => setShowToS(true)}
                  className="font-semibold underline hover:text-cyan-600 transition-colors"
                >
                  Terms of Service
                </button>
                , including the HIPAA Business Associate and GDPR Data Processing provisions. <span className="text-red-400">*</span>
              </span>
            </label>
          </div>

          {/* Privacy Policy Consent */}
          <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-purple-500/10 border-purple-500/30' : 'bg-purple-50 border-purple-200'}`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(e) => setPrivacyAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-400 text-purple-500 flex-shrink-0 cursor-pointer"
              />
              <span className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-purple-300' : 'text-purple-800'}`}>
                I have read and agree to the{' '}
                <button
                  type="button"
                  onClick={() => setShowPrivacyPolicy(true)}
                  className="font-semibold underline hover:text-purple-600 transition-colors"
                >
                  Privacy Policy &amp; HIPAA Notice of Privacy Practices
                </button>
                . I understand how AureonCare collects, uses, and protects my personal and health information. <span className="text-red-400">*</span>
              </span>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                theme === 'dark'
                  ? 'bg-slate-700 hover:bg-slate-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !tosAccepted || !privacyAccepted}
              className={`flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg font-medium transition-colors text-white flex items-center justify-center gap-2 ${
                loading || !tosAccepted || !privacyAccepted ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  Creating Account...
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Create Account
                </>
              )}
            </button>
          </div>
        </form>
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

export default RegisterPage;
