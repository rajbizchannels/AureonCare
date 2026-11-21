import React, { useEffect, useState } from 'react';
import SocialSignInButton from '../common/SocialSignInButton';
import { Loader2, AlertCircle, HeartPulse, CheckCircle2 } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import { getMicrosoftAuthCode } from '../../utils/msAuthCode';
import { microsoftOAuthConfig } from '../../config/oauthConfig';
import { getTranslations } from '../../config/translations';
import { useOptionalApp } from '../../context/AppContext';

const useT = () => getTranslations(useOptionalApp()?.language || 'en');

/**
 * The page behind a patient portal invitation (/portal/activate?token=…).
 *
 * The practice already has this patient on file and sent the link; all the patient does is
 * choose how to sign in — a password, or their Google / Microsoft account — and they land
 * in the portal signed in. Only the patient ever chooses the password.
 *
 * Google and Microsoft use the authorization-code flow (SEC-20): the browser only ever
 * holds a single-use code, redeemed on the server.
 */
const PortalActivatePage = ({ theme = 'light', token, api, onActivated, onSignIn }) => {
  const t = useT();
  const dark = theme === 'dark';
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [done, setDone] = useState(null);
  const [form, setForm] = useState({ password: '', confirmPassword: '' });

  useEffect(() => {
    let alive = true;
    api.lookupPortalInvite(token)
      .then((i) => { if (alive) setInvite(i); })
      .catch((e) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show the confirmation briefly, then enter the portal (Continue does it immediately).
  useEffect(() => {
    if (!done) return undefined;
    const timer = setTimeout(() => onActivated?.(done.patient), 1200);
    return () => clearTimeout(timer);
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (res) => {
    if (res && res.patient) setDone(res);
    else onSignIn?.();
  };

  const withPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) return setError(t.portalActivatePasswordsMismatch || 'The passwords do not match.');
    if (form.password.length < 12) return setError(t.portalActivatePasswordTooShort || 'Use at least 12 characters.');
    setBusy('password');
    try {
      finish(await api.acceptPortalInvite(token, form.password));
    } catch (err) {
      setError(err.message || t.portalActivateSetupFailed || 'Could not set up your portal.');
    } finally {
      setBusy('');
    }
  };

  const googleLogin = useGoogleLogin({
    flow: 'auth-code',
    onSuccess: async (resp) => {
      setBusy('google'); setError('');
      try {
        finish(await api.acceptPortalInviteWithOAuth('google', token, resp.code, 'postmessage'));
      } catch (err) {
        setError(err.message || t.portalActivateGoogleFailed || 'Google sign-in failed.');
      } finally {
        setBusy('');
      }
    },
    onError: () => setError(t.portalActivateGoogleCancelled || 'Google sign-in was cancelled.'),
  });

  const withMicrosoft = async () => {
    setBusy('microsoft'); setError('');
    try {
      const { code, redirectUri, codeVerifier } = await getMicrosoftAuthCode(microsoftOAuthConfig.auth.clientId);
      finish(await api.acceptPortalInviteWithOAuth('microsoft', token, code, redirectUri, codeVerifier));
    } catch (err) {
      setError(err.message || t.portalActivateMicrosoftFailed || 'Microsoft sign-in failed.');
    } finally {
      setBusy('');
    }
  };

  const bg = dark ? 'bg-gray-900' : 'bg-gray-50';
  const card = dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const text = dark ? 'text-gray-100' : 'text-gray-900';
  const muted = dark ? 'text-gray-400' : 'text-gray-500';
  const input = `w-full px-3 py-2.5 rounded-lg border ${dark ? 'bg-gray-900 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-blue-500`;

  if (loading) {
    return (
      <div className={`min-h-screen ${bg} flex items-center justify-center`} role="status" aria-label={t.loading || 'Loading'}>
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (done) {
    return (
      <div className={`min-h-screen ${bg} flex items-center justify-center px-4`}>
        <div className={`w-full max-w-md p-6 rounded-xl border text-center ${card}`}>
          <CheckCircle2 className="mx-auto text-green-600" size={40} />
          <h1 className={`mt-4 text-2xl font-semibold ${text}`}>{t.portalActivateAllSet || "You're all set"}</h1>
          <p className={`mt-2 ${muted}`}>{(t.portalActivateReady || 'Your {practice} patient portal is ready. Opening it now…').replace('{practice}', invite?.practiceName ?? '')}</p>
          <button onClick={() => onActivated?.(done.patient)}
                  className="mt-6 px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium">
            {t.portalActivateContinue || 'Continue'}
          </button>
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className={`min-h-screen ${bg} flex items-center justify-center px-4`}>
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto text-amber-600" size={40} />
          <h1 className={`mt-4 text-2xl font-semibold ${text}`}>{t.portalActivateLinkUnusable || "This link can't be used"}</h1>
          <p className={`mt-2 ${muted}`}>
            {error || t.portalActivateLinkExpired || 'It may have expired or already been used.'} {t.portalActivateAskNewInvite || 'Ask your practice to send you a new invitation.'}
          </p>
          {onSignIn && (
            <button onClick={onSignIn} className="mt-6 px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium">
              {t.portalActivateHaveAccount || 'I already have an account'}
            </button>
          )}
        </div>
      </div>
    );
  }

  const intro = (t.portalActivateIntro || 'Set up your {practice} patient portal to see appointments, messages and records.').split('{practice}');

  return (
    <div className={`min-h-screen ${bg} flex items-center justify-center px-4 py-10`}>
      <div className={`w-full max-w-md p-6 rounded-xl border ${card}`}>
        <HeartPulse className="text-blue-600" size={28} />
        <h1 className={`mt-3 text-2xl font-semibold ${text}`}>
          {invite.firstName
            ? (t.portalActivateWelcomeName || 'Welcome, {name}').replace('{name}', invite.firstName)
            : (t.welcomeBack || 'Welcome')}
        </h1>
        <p className={`mt-1 ${muted}`}>
          {intro[0]}<strong>{invite.practiceName}</strong>{intro[1]}
        </p>

        {error && (
          <div role="alert" className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800">
            <AlertCircle size={18} className="mt-0.5 shrink-0" /><span>{error}</span>
          </div>
        )}

        <div className="mt-5 space-y-2">
          <SocialSignInButton provider="google" theme={theme} onClick={() => googleLogin()} disabled={!!busy} busy={busy === 'google'}
                              label={t.portalActivateContinueGoogle} busyLabel={t.portalActivateConnecting || 'Connecting…'} />
          <SocialSignInButton provider="microsoft" theme={theme} onClick={withMicrosoft} disabled={!!busy} busy={busy === 'microsoft'}
                              label={t.portalActivateContinueMicrosoft} busyLabel={t.portalActivateConnecting || 'Connecting…'} />
        </div>

        <div className={`my-4 text-center text-sm ${muted}`}>{t.portalActivateOrPassword || 'or choose a password'}</div>

        <form onSubmit={withPassword} className="space-y-3">
          <label className="block">
            <span className={`text-sm ${muted}`}>{t.password || 'Password'}</span>
            <input className={input} type="password" required autoComplete="new-password"
                   placeholder={t.portalActivatePasswordPlaceholder || 'At least 12 characters'} value={form.password}
                   onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          </label>
          <label className="block">
            <span className={`text-sm ${muted}`}>{t.portalActivateConfirmPassword || 'Confirm password'}</span>
            <input className={input} type="password" required autoComplete="new-password"
                   placeholder={t.portalActivateConfirmPlaceholder || 'Type it again'} value={form.confirmPassword}
                   onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))} />
          </label>
          <p className={`text-xs ${muted}`}>
            {t.portalActivatePasswordHint || 'Use upper and lower case, a number and a symbol. Commonly breached passwords are refused.'}
          </p>
          <button type="submit" disabled={!!busy} aria-busy={busy === 'password'}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-60">
            {busy === 'password' ? <Loader2 className="animate-spin" size={16} /> : null}
            {t.portalActivateSubmit || 'Set up my portal'}
          </button>
        </form>

        <p className={`mt-4 text-xs text-center ${muted}`}>
          {(t.portalActivateInvitationFor || 'Invitation for {email}. The link works once.').replace('{email}', invite.email)}
        </p>
      </div>
    </div>
  );
};

export default PortalActivatePage;
