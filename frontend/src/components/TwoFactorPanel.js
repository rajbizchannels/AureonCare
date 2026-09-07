import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ShieldOff, Loader2, Copy, Check, AlertTriangle } from 'lucide-react';

/**
 * Two-factor authentication for your own account.
 *
 * Lives in the profile modal because that is the one surface every staff role can reach —
 * the Settings group in pane 1 is admin-only, and a security control only administrators
 * can find protects only administrators.
 *
 * Enrolment is deliberately two-step: scanning a QR proves nothing until a code from it
 * verifies, so the factor is switched on only after the authenticator has demonstrably
 * worked. Anything else risks locking someone out with a secret they never finished saving.
 */
const TwoFactorPanel = ({ theme, api, addNotification }) => {
  const dark = theme === 'dark';
  const [status, setStatus] = useState(null);
  const [enrolment, setEnrolment] = useState(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [backupCodes, setBackupCodes] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [disabling, setDisabling] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus(await api.getMfaStatus());
    } catch (e) {
      setError(e.message || 'Could not read two-factor status.');
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const begin = async () => {
    setError(''); setBusy('enrol');
    try {
      setEnrolment(await api.startMfaEnrolment());
    } catch (e) {
      setError(e.message);
    } finally { setBusy(''); }
  };

  const confirm = async (e) => {
    e.preventDefault();
    setError(''); setBusy('verify');
    try {
      const res = await api.confirmMfaEnrolment(code.trim());
      setBackupCodes(res.backupCodes);
      setEnrolment(null); setCode('');
      addNotification?.('success', 'Two-factor authentication is on.');
      load();
    } catch (e) {
      setError(e.message);
    } finally { setBusy(''); }
  };

  const turnOff = async (e) => {
    e.preventDefault();
    setError(''); setBusy('disable');
    try {
      await api.disableMfa(password, code.trim());
      setDisabling(false); setPassword(''); setCode('');
      addNotification?.('success', 'Two-factor authentication is off.');
      load();
    } catch (e) {
      setError(e.message);
    } finally { setBusy(''); }
  };

  const regenerate = async () => {
    setError(''); setBusy('regen');
    try {
      const res = await api.regenerateBackupCodes(code.trim());
      setBackupCodes(res.backupCodes);
      setCode('');
      load();
    } catch (e) {
      setError(e.message);
    } finally { setBusy(''); }
  };

  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* on screen to copy by hand */ }
  };

  const text = dark ? 'text-white' : 'text-gray-900';
  const muted = dark ? 'text-slate-400' : 'text-gray-600';
  const field = `w-full px-3 py-2 rounded-lg border ${dark ? 'bg-slate-900 border-slate-600 text-slate-100' : 'bg-white border-gray-300 text-gray-900'}`;

  if (!status) {
    return (
      <div className={`rounded-lg p-4 ${dark ? 'bg-slate-800/50' : 'bg-gray-100/50'} flex items-center gap-2 ${muted}`}>
        <Loader2 className="w-4 h-4 animate-spin" /> Loading security settings…
      </div>
    );
  }

  // Shown once, immediately after enrolment or regeneration. Only hashes are stored, so
  // there is no way to display these again — the warning is literal, not boilerplate.
  if (backupCodes) {
    return (
      <div className={`rounded-lg p-4 ${dark ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
        <h4 className={`font-semibold ${text} flex items-center gap-2`}>
          <AlertTriangle className="w-4 h-4 text-amber-500" /> Save your recovery codes
        </h4>
        <p className={`mt-1 text-sm ${muted}`}>
          Each one signs you in once if you lose your phone. They are shown now and never
          again — store them somewhere safe, away from the device with your authenticator.
        </p>
        <div className={`mt-3 p-3 rounded font-mono text-sm grid grid-cols-2 gap-1 ${dark ? 'bg-slate-900 text-slate-200' : 'bg-white text-gray-800'}`}>
          {backupCodes.map((c) => <div key={c}>{c}</div>)}
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={copyCodes} className={`px-3 py-1.5 rounded border text-sm inline-flex items-center gap-1.5 ${dark ? 'border-slate-600 text-slate-200' : 'border-gray-300 text-gray-700'}`}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Copy
          </button>
          <button onClick={() => setBackupCodes(null)} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm">
            I have saved them
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg p-4 ${dark ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
      <div className="flex items-center justify-between">
        <h4 className={`font-semibold ${text} flex items-center gap-2`}>
          {status.enabled
            ? <ShieldCheck className="w-4 h-4 text-green-600" />
            : <ShieldOff className="w-4 h-4 text-gray-400" />}
          Two-factor authentication
        </h4>
        <span className={`text-xs px-2 py-1 rounded ${status.enabled ? 'bg-green-500/20 text-green-500' : dark ? 'bg-slate-700 text-slate-300' : 'bg-gray-200 text-gray-700'}`}>
          {status.enabled ? 'On' : 'Off'}
        </span>
      </div>

      {status.requiredByPractice && (
        <p className={`mt-2 text-xs ${muted}`}>Your practice requires this, so it cannot be turned off.</p>
      )}

      {!status.enabled && !enrolment && (
        <>
          <p className={`mt-2 text-sm ${muted}`}>
            Adds a code from your phone to your password, so a stolen password alone is not
            enough to reach patient records.
          </p>
          <button
            onClick={begin} disabled={busy === 'enrol'}
            className="mt-3 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-60"
          >
            {busy === 'enrol' ? 'Preparing…' : 'Set it up'}
          </button>
        </>
      )}

      {enrolment && (
        <form onSubmit={confirm} className="mt-3 space-y-3">
          <p className={`text-sm ${muted}`}>
            Scan this with Google Authenticator, 1Password, or any TOTP app.
          </p>
          {enrolment.qrDataUrl && (
            <img src={enrolment.qrDataUrl} alt="Two-factor QR code" className="rounded bg-white p-2" width={200} height={200} />
          )}
          <div>
            <div className={`text-xs mb-1 ${muted}`}>Or type this key by hand:</div>
            <code className={`text-sm break-all ${text}`}>{enrolment.base32}</code>
          </div>
          <div>
            <label className={`block text-sm mb-1 ${muted}`}>Enter the 6-digit code to switch it on</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} required
              inputMode="numeric" autoComplete="one-time-code" placeholder="123456"
              className={`${field} tracking-widest`} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy === 'verify'}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-60">
              {busy === 'verify' ? 'Checking…' : 'Turn on'}
            </button>
            <button type="button" onClick={() => { setEnrolment(null); setCode(''); setError(''); }}
              className={`px-4 py-2 rounded-lg border text-sm ${dark ? 'border-slate-600 text-slate-200' : 'border-gray-300 text-gray-700'}`}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {status.enabled && !disabling && (
        <div className="mt-3 space-y-3">
          <p className={`text-sm ${muted}`}>
            {status.backupCodesRemaining} recovery {status.backupCodesRemaining === 1 ? 'code' : 'codes'} left.
          </p>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[160px]">
              <label className={`block text-xs mb-1 ${muted}`}>Current code</label>
              <input value={code} onChange={(e) => setCode(e.target.value)}
                inputMode="numeric" placeholder="123456" className={field} />
            </div>
            <button onClick={regenerate} disabled={busy === 'regen' || !code.trim()}
              className={`px-3 py-2 rounded-lg border text-sm disabled:opacity-60 ${dark ? 'border-slate-600 text-slate-200' : 'border-gray-300 text-gray-700'}`}>
              New recovery codes
            </button>
            {!status.requiredByPractice && (
              <button onClick={() => { setDisabling(true); setError(''); }}
                className="px-3 py-2 rounded-lg border border-red-400 text-red-500 text-sm">
                Turn off
              </button>
            )}
          </div>
        </div>
      )}

      {disabling && (
        <form onSubmit={turnOff} className="mt-3 space-y-3">
          <p className={`text-sm ${muted}`}>
            Confirm with your password and a current code — a signed-in session alone is not
            enough to remove this.
          </p>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            required placeholder="Your password" className={field} autoComplete="current-password" />
          <input value={code} onChange={(e) => setCode(e.target.value)}
            required placeholder="123456 or a recovery code" className={field} />
          <div className="flex gap-2">
            <button type="submit" disabled={busy === 'disable'}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium disabled:opacity-60">
              {busy === 'disable' ? 'Turning off…' : 'Turn off'}
            </button>
            <button type="button" onClick={() => { setDisabling(false); setPassword(''); setCode(''); setError(''); }}
              className={`px-4 py-2 rounded-lg border text-sm ${dark ? 'border-slate-600 text-slate-200' : 'border-gray-300 text-gray-700'}`}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {status.sessionIdleMinutes && (
        <p className={`mt-3 text-xs ${muted}`}>
          Your practice signs you out after {status.sessionIdleMinutes} minutes of inactivity.
        </p>
      )}

      {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
    </div>
  );
};

export default TwoFactorPanel;
