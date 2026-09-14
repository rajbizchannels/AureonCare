import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle, UserPlus, CheckCircle2 } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';

/**
 * Accept a staff invite — with a password, or with Google/Microsoft.
 *
 * The invite is what binds the new account to a practice. Signing up with OAuth and no
 * invite leaves a user with no practice at all, which resolves to an empty workspace, so
 * the token is passed through to the social login and validated server-side against the
 * provider-verified email.
 */
const AcceptInvitePage = ({ theme = 'light', token, api, addNotification, onAccepted, onAuthenticated, onSignIn }) => {
  const dark = theme === 'dark';
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  // Set once the provider has vouched for the account AND the server has issued a session.
  const [connected, setConnected] = useState(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', password: '', confirmPassword: '' });

  useEffect(() => {
    let alive = true;
    api.lookupInvite(token)
      .then((i) => { if (alive) setInvite(i); })
      .catch((e) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show the confirmation long enough to be read, then enter the app. The Continue button
  // does the same thing for anyone who would rather not wait.
  useEffect(() => {
    if (!connected) return undefined;
    const t = setTimeout(() => onAuthenticated?.(connected.user, connected.token), 1400);
    return () => clearTimeout(t);
  }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const acceptWithPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.');
    if (form.password.length < 12) return setError('Password must be at least 12 characters.');
    setBusy('password');
    try {
      await api.acceptInvite({ token, password: form.password, firstName: form.firstName, lastName: form.lastName });
      addNotification?.('Account created. Please sign in.', 'success');
      onAccepted?.();
    } catch (err) {
      setError(err.message || 'Could not accept the invite.');
    } finally {
      setBusy('');
    }
  };

  const googleLogin = useGoogleLogin({
    flow: 'auth-code',
    // 'postmessage' is the redirect_uri the popup/auth-code flow uses; the server
    // exchanges the code with the client secret it holds.
    onSuccess: async (resp) => {
      setBusy('google'); setError('');
      try {
        const res = await api.exchangeGoogleCode(resp.code, 'postmessage', token);
        // The server has already signed a JWT and set the session cookies by this point —
        // sending the user back to a sign-in page threw that away and made them
        // authenticate a second time immediately after proving who they are. Carry the
        // session straight into the app instead.
        if (res && res.token && res.user) {
          api.storeToken(res.token);
          setConnected(res);
          addNotification?.(`Connected as ${res.user.email}`, 'success');
        } else {
          // Older server, or a response without a session: fall back to the sign-in page
          // rather than leaving the user on a page with nowhere to go.
          addNotification?.('Account created. Please sign in.', 'success');
          onAccepted?.();
        }
      } catch (err) {
        setError(err.message || 'Google sign-up failed.');
      } finally {
        setBusy('');
      }
    },
    onError: () => setError('Google sign-up was cancelled.'),
  });

  const bg = dark ? 'bg-gray-900' : 'bg-gray-50';
  const card = dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const text = dark ? 'text-gray-100' : 'text-gray-900';
  const muted = dark ? 'text-gray-400' : 'text-gray-500';
  const input = `w-full px-3 py-2 rounded-lg border ${dark ? 'bg-gray-900 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-blue-500`;

  if (loading) {
    return (
      <div className={`min-h-screen ${bg} flex items-center justify-center`}>
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (connected) {
    return (
      <div className={`min-h-screen ${bg} flex items-center justify-center px-4`}>
        <div className={`w-full max-w-md p-6 rounded-xl border text-center ${card}`}>
          <CheckCircle2 className="mx-auto text-green-600" size={40} />
          <h1 className={`mt-4 text-2xl font-semibold ${text}`}>Connected</h1>
          <p className={`mt-2 ${muted}`}>
            Your Google account <strong>{connected.user.email}</strong> is now linked to{' '}
            <strong>{invite?.practiceName}</strong>. Signing you in…
          </p>
          <button
            onClick={() => onAuthenticated?.(connected.user, connected.token)}
            className="mt-6 px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium"
          >
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
          <h1 className={`mt-4 text-2xl font-semibold ${text}`}>This invite is no longer valid</h1>
          <p className={`mt-2 ${muted}`}>{error || 'It may have expired or already been used. Ask your administrator to send a new one.'}</p>
          {onSignIn && (
            <button onClick={onSignIn} className="mt-6 px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium">
              Go to sign in
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bg} flex items-center justify-center px-4 py-10`}>
      <div className={`w-full max-w-md p-6 rounded-xl border ${card}`}>
        <UserPlus className="text-blue-600" size={28} />
        <h1 className={`mt-3 text-2xl font-semibold ${text}`}>Join {invite.practiceName}</h1>
        <p className={`mt-1 ${muted}`}>
          Invited as <strong>{invite.role}</strong> · {invite.email}
        </p>

        {error && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800">
            <AlertCircle size={18} className="mt-0.5 shrink-0" /><span>{error}</span>
          </div>
        )}

        <form onSubmit={acceptWithPassword} className="mt-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input className={input} placeholder="First name" value={form.firstName} onChange={set('firstName')} />
            <input className={input} placeholder="Last name" value={form.lastName} onChange={set('lastName')} />
          </div>
          <input className={input} type="password" placeholder="Password (12+ characters)" required
                 autoComplete="new-password" value={form.password} onChange={set('password')} />
          <input className={input} type="password" placeholder="Confirm password" required
                 autoComplete="new-password" value={form.confirmPassword} onChange={set('confirmPassword')} />
          <button type="submit" disabled={!!busy}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-60">
            {busy === 'password' ? <Loader2 className="animate-spin" size={16} /> : null}
            Create account
          </button>
        </form>

        <div className={`my-4 text-center text-sm ${muted}`}>or</div>

        <button type="button" onClick={() => googleLogin()} disabled={!!busy}
                className={`w-full py-2.5 rounded-lg border ${card} ${text} font-medium disabled:opacity-60`}>
          {busy === 'google' ? 'Connecting…' : 'Continue with Google'}
        </button>
        <p className={`mt-3 text-xs text-center ${muted}`}>
          You must sign in with <strong>{invite.email}</strong> — the invite is tied to that address.
        </p>
      </div>
    </div>
  );
};

export default AcceptInvitePage;
