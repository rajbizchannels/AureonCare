import React, { useState } from 'react';
import { Loader2, Building2, Clock, CheckCircle2 } from 'lucide-react';

/**
 * Join the practice that owns your email domain.
 *
 * Two steps on purpose. The address is checked first, so somebody whose domain leads
 * nowhere is told that before choosing a password — and somebody whose domain does lead
 * somewhere sees which practice they are about to join, and whether they will be waiting
 * for approval, before committing to anything.
 */
const JoinPracticePage = ({ theme = 'light', api, onSignIn }) => {
  const dark = theme === 'dark';
  const [email, setEmail] = useState('');
  const [match, setMatch] = useState(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', password: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const bg = dark ? 'bg-gray-900' : 'bg-gray-50';
  const card = dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const text = dark ? 'text-gray-100' : 'text-gray-900';
  const muted = dark ? 'text-gray-400' : 'text-gray-500';
  const input = `w-full px-3 py-2 rounded-lg border ${dark ? 'bg-gray-900 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-blue-500`;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const check = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const res = await api.lookupJoinDomain(email.trim());
      if (!res.found) {
        setError('No practice accepts self-service signup for that email address. '
          + 'Ask an administrator to send you an invitation.');
        setMatch(null);
      } else {
        setMatch(res);
      }
    } catch (err) {
      setError(err.message || 'Could not check that address.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.');
    if (form.password.length < 12) return setError('Password must be at least 12 characters.');
    setBusy(true);
    try {
      setDone(await api.joinPractice({
        email: email.trim(),
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
      }));
    } catch (err) {
      setError(err.message || 'Could not complete signup.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    const waiting = done.status === 'pending';
    return (
      <div className={`min-h-screen ${bg} flex items-center justify-center px-4`}>
        <div className={`w-full max-w-md p-6 rounded-xl border text-center ${card}`}>
          {waiting
            ? <Clock className="mx-auto text-amber-600" size={40} />
            : <CheckCircle2 className="mx-auto text-green-600" size={40} />}
          <h1 className={`mt-4 text-2xl font-semibold ${text}`}>
            {waiting ? 'Waiting for approval' : `Welcome to ${done.practiceName}`}
          </h1>
          <p className={`mt-2 ${muted}`}>{done.message}</p>
          {onSignIn && (
            <button onClick={onSignIn} className="mt-6 px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium">
              {waiting ? 'Back to sign in' : 'Sign in'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bg} flex items-center justify-center px-4 py-10`}>
      <div className={`w-full max-w-md p-6 rounded-xl border ${card}`}>
        <Building2 className="text-blue-600" size={28} />
        <h1 className={`mt-3 text-2xl font-semibold ${text}`}>Join your practice</h1>
        <p className={`mt-1 ${muted}`}>
          Use your work email address. If your practice has verified its domain, you can set
          up your own account.
        </p>

        {!match ? (
          <form onSubmit={check} className="mt-5 space-y-3">
            <div>
              <label className={`block text-sm mb-1 ${muted}`}>Work email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                required placeholder="you@yourclinic.com" className={input}
              />
            </div>
            <button
              type="submit" disabled={busy || !email.trim()}
              className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Continue
            </button>
          </form>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-3">
            <div className={`p-3 rounded-lg ${dark ? 'bg-slate-900' : 'bg-blue-50'}`}>
              <div className={`text-sm ${text}`}>
                Joining <strong>{match.practiceName}</strong>
              </div>
              <div className={`text-xs mt-0.5 ${muted}`}>
                {match.requiresApproval
                  ? 'An administrator will need to approve your account before you can sign in.'
                  : 'You will be able to sign in straight away.'}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-sm mb-1 ${muted}`}>First name</label>
                <input value={form.firstName} onChange={set('firstName')} className={input} />
              </div>
              <div>
                <label className={`block text-sm mb-1 ${muted}`}>Last name</label>
                <input value={form.lastName} onChange={set('lastName')} className={input} />
              </div>
            </div>
            <div>
              <label className={`block text-sm mb-1 ${muted}`}>Password</label>
              <input type="password" value={form.password} onChange={set('password')} required className={input} />
            </div>
            <div>
              <label className={`block text-sm mb-1 ${muted}`}>Confirm password</label>
              <input type="password" value={form.confirmPassword} onChange={set('confirmPassword')} required className={input} />
            </div>
            <button
              type="submit" disabled={busy}
              className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Create my account
            </button>
          </form>
        )}

        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

        {onSignIn && (
          <button onClick={onSignIn} className={`mt-4 text-sm ${muted} underline`}>
            Already have an account? Sign in
          </button>
        )}
      </div>
    </div>
  );
};

export default JoinPracticePage;
