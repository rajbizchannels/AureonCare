import React, { useEffect, useState, useCallback } from 'react';
import { Mail, Copy, Check, X, Loader2, UserPlus } from 'lucide-react';

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
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [freshLink, setFreshLink] = useState(null);
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
    setError(''); setFreshLink(null); setBusy(true);
    try {
      const inv = await api.createInvite({ email: email.trim(), role });
      setFreshLink(inv.inviteUrl);
      setEmail('');
      addNotification?.(`Invite created for ${inv.email}`, 'success');
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
      addNotification?.(err.message || 'Could not revoke the invite.', 'error');
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
        They can join with a password or with Google — either way the invite links them to
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
        </select>
        <button type="submit" disabled={busy}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-60 flex items-center gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          Create invite
        </button>
      </form>

      {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

      {freshLink && (
        <div className={`mt-4 p-3 rounded-lg border ${dark ? 'border-slate-600 bg-slate-900' : 'border-blue-200 bg-blue-50'}`}>
          <div className={`text-xs mb-2 ${muted}`}>
            Send this link to your colleague. It is shown only once — if you lose it, create
            a new invite.
          </div>
          <div className="flex gap-2">
            <code className={`flex-1 text-xs break-all ${text}`}>{freshLink}</code>
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
