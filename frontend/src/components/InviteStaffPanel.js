import React, { useEffect, useState, useCallback } from 'react';
import { Mail, Copy, Check, X, Loader2, UserPlus } from 'lucide-react';
import QrCodeButton from './common/QrCodeButton';

/**
 * Invite colleagues into this practice — the self-service half of onboarding.
 *
 * The invite is what binds a new account to a practice, including one created with
 * Google/Microsoft: an OAuth signup with no invite has no practice and lands in an empty
 * workspace. The raw token is shown exactly once, on creation, and is never stored in a
 * recoverable form.
 */
const InviteStaffPanel = ({ theme, api, addNotification }) => {
  const dark = theme === 'dark';
  const [invites, setInvites] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  // Role "Patient" sends a patient-portal invitation instead of a staff account: patients
  // join through their chart, so the dialog collects what is needed to find or start it.
  const [patient, setPatient] = useState({ firstName: '', lastName: '', dateOfBirth: '' });
  const isPatient = role === 'patient';
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [freshLink, setFreshLink] = useState(null);
  const [delivery, setDelivery] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setInvites(await api.listInvites());
    } catch (e) {
      setError(e.message || 'Could not load invites.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setError(''); setFreshLink(null); setDelivery(null); setBusy(true);
    try {
      if (isPatient) {
        const inv = await api.sendPortalInviteByEmail({ email: email.trim(), ...patient });
        setFreshLink(inv.inviteUrl || null);
        setDelivery({ emailed: inv.emailed, reason: inv.emailError, to: inv.email, patient: true });
        setEmail(''); setPatient({ firstName: '', lastName: '', dateOfBirth: '' });
        // addNotification is (type, message) — the arguments were the wrong way round.
        addNotification?.(
          inv.emailed ? 'success' : 'warning',
          inv.emailed ? `Portal invitation emailed to ${inv.email}` : `Portal invitation created for ${inv.email} — send the link yourself`
        );
        return;
      }
      const inv = await api.createInvite({ email: email.trim(), role });
      setFreshLink(inv.inviteUrl);
      setDelivery({ emailed: inv.emailed, reason: inv.emailError, detail: inv.emailErrorDetail, to: inv.email });
      setEmail('');
      addNotification?.(
        inv.emailed ? 'success' : 'warning',
        inv.emailed ? `Invite emailed to ${inv.email}` : `Invite created for ${inv.email} — send the link yourself`
      );
      load();
    } catch (err) {
      setError(err.message || 'Could not create the invite.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id) => {
    try {
      await api.revokeInvite(id);
      load();
    } catch (err) {
      addNotification?.('error', err.message || 'Could not revoke the invite.');
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(freshLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the link is on screen to copy by hand.
    }
  };

  const card = dark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-200';
  const text = dark ? 'text-white' : 'text-gray-900';
  const muted = dark ? 'text-slate-400' : 'text-gray-500';
  const input = `px-3 py-2 rounded-lg border text-sm ${dark ? 'bg-slate-900 border-slate-600 text-slate-100' : 'bg-white border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-blue-500`;

  const badge = (status) => {
    const map = {
      pending: 'bg-amber-100 text-amber-800',
      accepted: 'bg-green-100 text-green-800',
      revoked: dark ? 'bg-slate-700 text-slate-300' : 'bg-gray-200 text-gray-600',
    };
    return map[status] || map.revoked;
  };

  return (
    <div className={`rounded-xl border p-5 ${card}`}>
      <h3 className={`text-base font-semibold mb-1 flex items-center gap-2 ${text}`}>
        <UserPlus className="w-4 h-4 text-blue-500" />
        Invite team members
      </h3>
      <p className={`text-sm mb-4 ${muted}`}>
        They can join with a password or with Google or Microsoft — either way the invite links them to
        this practice.
      </p>

      <form onSubmit={create} className="flex flex-wrap gap-2 items-center">
        <input
          className={`${input} flex-1 min-w-[220px]`}
          type="email" required placeholder="colleague@example.com"
          value={email} onChange={(e) => setEmail(e.target.value)}
        />
        <select className={input} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="staff">Staff</option>
          <option value="nurse">Nurse</option>
          <option value="doctor">Doctor</option>
          <option value="admin">Admin</option>
          <option value="patient">Patient</option>
        </select>
        <button type="submit" disabled={busy}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-60 flex items-center gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          Create invite
        </button>
        {isPatient && (
          <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input className={input} placeholder="First name" aria-label="Patient first name"
                   value={patient.firstName} onChange={(e) => setPatient((p) => ({ ...p, firstName: e.target.value }))} />
            <input className={input} placeholder="Last name" aria-label="Patient last name"
                   value={patient.lastName} onChange={(e) => setPatient((p) => ({ ...p, lastName: e.target.value }))} />
            <input className={input} type="date" aria-label="Patient date of birth"
                   value={patient.dateOfBirth} onChange={(e) => setPatient((p) => ({ ...p, dateOfBirth: e.target.value }))} />
            <p className={`sm:col-span-3 text-xs ${muted}`}>
              Patients get a patient-portal invitation, not a staff account. If a patient with this
              email already exists, the invitation goes to their record; otherwise the name and date
              of birth create one.
            </p>
          </div>
        )}
      </form>

      {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

      {/* A patient invitation that was emailed returns no link — it exists only in the
          patient's inbox — so confirm the send on its own. */}
      {!freshLink && delivery?.patient && delivery.emailed && (
        <div role="status" className={`mt-4 p-3 rounded-lg border flex items-start gap-2 text-sm ${dark ? 'border-emerald-700 bg-emerald-900/30 text-emerald-200' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          <Check className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Patient-portal invitation emailed to <strong>{delivery.to}</strong>. The link works once and
            expires in 14 days; you can re-send it from the patient&apos;s chart.
          </span>
        </div>
      )}

      {freshLink && (
        <div className={`mt-4 p-3 rounded-lg border ${dark ? 'border-slate-600 bg-slate-900' : 'border-blue-200 bg-blue-50'}`}>
          <div className={`text-xs mb-2 ${muted}`}>
            {delivery?.emailed ? (
              <>Emailed to <strong>{delivery.to}</strong>. The same link is below in case it
              does not arrive — it is shown only once, so if you lose it, create a new invite.</>
            ) : (
              <>
                <span className="text-amber-600 font-medium">
                  {delivery?.reason === 'smtp_not_configured'
                    ? 'Email is not configured on this server, so nothing was sent.'
                    : delivery?.reason === 'rate_limited'
                    ? 'Too many emails have gone to this address recently, so nothing was sent.'
                    : 'The invitation email could not be delivered.'}
                </span>{' '}
                {delivery?.detail && (
                  <>
                    <br />
                    <code className="text-[11px] break-all opacity-80">{delivery.detail}</code>
                    <br />
                  </>
                )}
                Send this link to {isPatient ? 'the patient' : 'your colleague'} yourself. It is shown only once — if you lose
                it, create a new invite.
              </>
            )}
          </div>
          <div className="flex gap-2">
            <code className={`flex-1 text-xs break-all ${text}`}>{freshLink}</code>
            <QrCodeButton getUrl={freshLink} theme={theme}
                          title={isPatient ? 'Patient portal invitation' : 'Team invitation'}
                          description="Scan to open the invitation. It works once." />
            <button onClick={copy} className={`shrink-0 px-2 py-1 rounded border text-xs ${dark ? 'border-slate-600 text-slate-200' : 'border-gray-300 text-gray-700'}`}>
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}

      <div className="mt-5">
        {loading ? (
          <div className={`flex items-center gap-2 text-sm ${muted}`}>
            <Loader2 className="w-4 h-4 animate-spin" /> Loading invites…
          </div>
        ) : invites.length === 0 ? (
          <p className={`text-sm ${muted}`}>No invites yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className={muted}>
                <th className="text-left font-medium pb-2">Email</th>
                <th className="text-left font-medium pb-2">Role</th>
                <th className="text-left font-medium pb-2">Status</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {invites.map((i) => (
                <tr key={i.id} className={dark ? 'border-t border-slate-700' : 'border-t border-gray-100'}>
                  <td className={`py-2 ${text}`}>{i.email}</td>
                  <td className={`py-2 ${muted}`}>{i.role}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge(i.status)}`}>{i.status}</span>
                  </td>
                  <td className="py-2 text-right">
                    {i.status === 'pending' && (
                      <button onClick={() => revoke(i.id)} title="Revoke"
                              className={`p-1 rounded ${muted} hover:text-red-600`}>
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default InviteStaffPanel;
