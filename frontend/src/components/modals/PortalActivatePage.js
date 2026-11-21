import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle, HeartPulse, CheckCircle2 } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import { getMicrosoftAuthCode } from '../../utils/msAuthCode';
import { microsoftOAuthConfig } from '../../config/oauthConfig';

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
    const t = setTimeout(() => onActivated?.(done.patient), 1200);
    return () => clearTimeout(t);
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (res) => {
    if (res && res.patient) setDone(res);
    else onSignIn?.();
  };

  const withPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) return setError('The passwords do not match.');
    if (form.password.length < 12) return setError('Use at least 12 characters.');
    setBusy('password');
    try {
      finish(await api.acceptPortalInvite(token, form.password));
    } catch (err) {
      setError(err.message || 'Could not set up your portal.');
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
        setError(err.message || 'Google sign-in failed.');
      } finally {
        setBusy('');
      }
    },
    onError: () => setError('Google sign-in was cancelled.'),
  });

  const withMicrosoft = async () => {
    setBusy('microsoft'); setError('');
    try {
      const { code, redirectUri, codeVerifier } = await getMicrosoftAuthCode(microsoftOAuthConfig.auth.clientId);
      finish(await api.acceptPortalInviteWithOAuth('microsoft', token, code, redirectUri, codeVerifier));
    } catch (err) {
      setError(err.message || 'Microsoft sign-in failed.');
    } finally {
      setBusy('');
    }
  };

  const bg = dark ? 'bg-gray-900' : 'bg-gray-50';
  const card = dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const text = dark ? 'text-gray-100' : 'text-gray-900';
  const muted = dark ? 'text-gray-400' : 'text-gray-500';
  const input = `w-full px-3 py-2.5 rounded-lg border ${dark ? 'bg-gray-900 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-blue-500`;
  const secondary = `w-full py-2.5 rounded-lg border font-medium disabled:opacity-60 ${dark ? 'border-gray-600 text-gray-100 hover:bg-gray-700' : 'border-gray-300 text-gray-900 hover:bg-gray-50'}`;

  if (loading) {
    return (
      <div className={`min-h-screen ${bg} flex items-center justify-center`} role="status" aria-label="Loading">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (done) {
    return (
      <div className={`min-h-screen ${bg} flex items-center justify-center px-4`}>
        <div className={`w-full max-w-md p-6 rounded-xl border text-center ${card}`}>
          <CheckCircle2 className="mx-auto text-green-600" size={40} />
          <h1 className={`mt-4 text-2xl font-semibold ${text}`}>You're all set</h1>
          <p className={`mt-2 ${muted}`}>Your {invite?.practiceName} patient portal is ready. Opening it now…</p>
          <button onClick={() => onActivated?.(done.patient)}
                  className="mt-6 px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium">
            Continue
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
          <h1 className={`mt-4 text-2xl font-semibold ${text}`}>This link can't be used</h1>
          <p className={`mt-2 ${muted}`}>
            {error || 'It may have expired or already been used.'} Ask your practice to send you a new invitation.
          </p>
          {onSignIn && (
            <button onClick={onSignIn} className="mt-6 px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium">
              I already have an account
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bg} flex items-center justify-center px-4 py-10`}>
      <div className={`w-full max-w-md p-6 rounded-xl border ${card}`}>
        <HeartPulse className="text-blue-600" size={28} />
        <h1 className={`mt-3 text-2xl font-semibold ${text}`}>
          Welcome{invite.firstName ? `, ${invite.firstName}` : ''}
        </h1>
        <p className={`mt-1 ${muted}`}>
          Set up your <strong>{invite.practiceName}</strong> patient portal to see appointments, messages and records.
        </p>

        {error && (
          <div role="alert" className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800">
            <AlertCircle size={18} className="mt-0.5 shrink-0" /><span>{error}</span>
          </div>
        )}

        <div className="mt-5 space-y-2">
          <button type="button" onClick={() => googleLogin()} disabled={!!busy} className={secondary}>
            {busy === 'google' ? 'Connecting…' : 'Continue with Google'}
          </button>
          <button type="button" onClick={withMicrosoft} disabled={!!busy} className={secondary}>
            {busy === 'microsoft' ? 'Connecting…' : 'Continue with Microsoft'}
          </button>
        </div>

        <div className={`my-4 text-center text-sm ${muted}`}>or choose a password</div>

        <form onSubmit={withPassword} className="space-y-3">
          <label className="block">
            <span className={`text-sm ${muted}`}>Password</span>
            <input className={input} type="password" required autoComplete="new-password"
                   placeholder="At least 12 characters" value={form.password}
                   onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          </label>
          <label className="block">
            <span className={`text-sm ${muted}`}>Confirm password</span>
            <input className={input} type="password" required autoComplete="new-password"
                   placeholder="Type it again" value={form.confirmPassword}
                   onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))} />
          </label>
          <p className={`text-xs ${muted}`}>
            Use upper and lower case, a number and a symbol. Commonly breached passwords are refused.
          </p>
          <button type="submit" disabled={!!busy} aria-busy={busy === 'password'}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-60">
            {busy === 'password' ? <Loader2 className="animate-spin" size={16} /> : null}
            Set up my portal
          </button>
        </form>

        <p className={`mt-4 text-xs text-center ${muted}`}>
          Invitation for {invite.email}. The link works once.
        </p>
      </div>
    </div>
  );
};

export default PortalActivatePage;
