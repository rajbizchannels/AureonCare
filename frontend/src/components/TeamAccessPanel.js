import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, ShieldCheck, ShieldAlert, Copy, Check, Trash2, UserCheck, UserX, Globe } from 'lucide-react';

/**
 * Team access — claimed email domains and the people waiting on them.
 *
 * The two halves belong on one screen because they are one decision: claiming a domain is
 * what creates the queue, and the join policy is what determines whether the queue fills
 * up at all. Splitting them made it possible to turn on auto_request and never discover
 * there was somewhere to go and approve people.
 */
const TeamAccessPanel = ({ theme, api, addNotification }) => {
  const dark = theme === 'dark';
  const [domains, setDomains] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [domain, setDomain] = useState('');
  const [policy, setPolicy] = useState('auto_request');
  const [role, setRole] = useState('staff');
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState('');
  const [securityPolicy, setSecurityPolicy] = useState(null);
  const [idleDraft, setIdleDraft] = useState('');

  const savePolicy = async (patch) => {
    setBusy('policy');
    try {
      const next = await api.updateSecurityPolicy(patch);
      setSecurityPolicy((p) => ({ ...p, ...next }));
      setIdleDraft(next.sessionIdleMinutes == null ? '' : String(next.sessionIdleMinutes));
      addNotification?.('Security policy updated.', 'success');
    } catch (err) {
      // The lockout refusal names the administrators without a second factor; showing it
      // verbatim is the difference between a fixable message and a dead end.
      addNotification?.(err.message || 'Could not update the security policy.', 'error');
      load();
    } finally {
      setBusy('');
    }
  };

  const load = useCallback(async () => {
    try {
      const [d, r, p] = await Promise.all([
        api.listDomains(), api.listJoinRequests(), api.getSecurityPolicy(),
      ]);
      setDomains(d);
      setRequests(r);
      setSecurityPolicy(p);
      setIdleDraft(p.sessionIdleMinutes == null ? '' : String(p.sessionIdleMinutes));
      setError('');
    } catch (e) {
      setError(e.message || 'Could not load team access settings.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const claim = async (e) => {
    e.preventDefault();
    setBusy('claim');
    try {
      await api.claimDomain({ domain: domain.trim(), joinPolicy: policy, defaultRole: role });
      setDomain('');
      addNotification?.('Domain claimed. Publish the TXT record, then verify.', 'success');
      load();
    } catch (err) {
      addNotification?.(err.message || 'Could not claim that domain.', 'error');
    } finally {
      setBusy('');
    }
  };

  const verify = async (id) => {
    setBusy(`verify:${id}`);
    try {
      await api.verifyDomain(id);
      addNotification?.('Domain verified.', 'success');
      load();
    } catch (err) {
      addNotification?.(err.message || 'Verification failed.', 'error');
    } finally {
      setBusy('');
    }
  };

  const setPolicyFor = async (id, joinPolicy) => {
    try {
      await api.updateDomain(id, { joinPolicy });
      load();
    } catch (err) {
      addNotification?.(err.message || 'Could not update the policy.', 'error');
    }
  };

  const remove = async (id) => {
    try {
      await api.removeDomain(id);
      load();
    } catch (err) {
      addNotification?.(err.message || 'Could not remove the domain.', 'error');
    }
  };

  const decide = async (id, decision) => {
    setBusy(`decide:${id}`);
    try {
      await api.decideJoinRequest(id, decision);
      addNotification?.(decision === 'approve' ? 'Access approved.' : 'Request rejected.', 'success');
      load();
    } catch (err) {
      addNotification?.(err.message || 'Could not record the decision.', 'error');
    } finally {
      setBusy('');
    }
  };

  const copy = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      // Clipboard can be blocked; the value is on screen to copy by hand.
    }
  };

  const card = dark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-200';
  const text = dark ? 'text-white' : 'text-gray-900';
  const muted = dark ? 'text-slate-400' : 'text-gray-500';
  const field = `px-3 py-2 rounded-lg border text-sm ${dark ? 'bg-slate-900 border-slate-600 text-slate-100' : 'bg-white border-gray-300 text-gray-900'}`;

  const pending = requests.filter((r) => r.status === 'pending');
  const decided = requests.filter((r) => r.status !== 'pending');

  if (loading) {
    return (
      <div className={`p-6 rounded-xl border ${card} flex items-center gap-2 ${muted}`}>
        <Loader2 className="w-4 h-4 animate-spin" /> Loading team access…
      </div>
    );
  }

  return (
    <div className={`p-6 rounded-xl border ${card}`}>
      <div className="flex items-center gap-2">
        <Globe className="w-5 h-5 text-blue-600" />
        <h3 className={`text-lg font-semibold ${text}`}>Team access</h3>
      </div>
      <p className={`mt-1 text-sm ${muted}`}>
        Claim an email domain your practice controls and colleagues can sign themselves up
        with their work address — no invitation needed. A domain grants nothing until you
        prove you own it.
      </p>

      {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

      {/* ── Pending requests first: this is the part that needs acting on ── */}
      {pending.length > 0 && (
        <div className={`mt-5 p-4 rounded-lg border ${dark ? 'border-amber-700/60 bg-amber-900/20' : 'border-amber-300 bg-amber-50'}`}>
          <h4 className={`font-medium ${text}`}>
            {pending.length} {pending.length === 1 ? 'person is' : 'people are'} waiting for approval
          </h4>
          <div className="mt-3 space-y-2">
            {pending.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className={`text-sm font-medium ${text}`}>
                    {`${r.first_name || ''} ${r.last_name || ''}`.trim() || r.email}
                  </div>
                  <div className={`text-xs ${muted}`}>
                    {r.email} · wants {r.requested_role} · verified via {r.email_verified_via || 'unknown'}
                  </div>
                </div>
                <button
                  onClick={() => decide(r.id, 'approve')}
                  disabled={busy === `decide:${r.id}`}
                  className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  <UserCheck className="w-4 h-4" /> Approve
                </button>
                <button
                  onClick={() => decide(r.id, 'reject')}
                  disabled={busy === `decide:${r.id}`}
                  className={`px-3 py-1.5 rounded-lg border text-sm inline-flex items-center gap-1.5 disabled:opacity-60 ${dark ? 'border-slate-600 text-slate-200' : 'border-gray-300 text-gray-700'}`}
                >
                  <UserX className="w-4 h-4" /> Reject
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Security policy ── */}
      {securityPolicy && (
        <div className={`mt-5 p-4 rounded-lg border ${dark ? 'border-slate-700' : 'border-gray-200'}`}>
          <h4 className={`font-medium ${text}`}>Security policy</h4>
          <p className={`mt-1 text-xs ${muted}`}>Applies to every account at this practice.</p>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label className={`block text-xs mb-1 ${muted}`}>Sign out after inactivity</label>
              <div className="flex gap-2 items-center">
                <input
                  type="number" min="5" max="1440" value={idleDraft}
                  onChange={(e) => setIdleDraft(e.target.value)}
                  placeholder="No limit"
                  className={`${field} w-32`}
                />
                <span className={`text-sm ${muted}`}>minutes</span>
                <button
                  onClick={() => savePolicy({ sessionIdleMinutes: idleDraft === '' ? null : Number(idleDraft) })}
                  disabled={busy === 'policy'}
                  className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-60"
                >
                  Save
                </button>
              </div>
              <p className={`mt-1 text-xs ${muted}`}>
                Between 5 and 1440. Leave empty for no limit. Measured from the last action,
                not from sign-in, so continuous work is never interrupted.
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <div className={`text-sm font-medium ${text}`}>Require two-factor authentication</div>
              <div className={`text-xs ${muted}`}>
                {securityPolicy.staffWithoutMfa > 0
                  ? `${securityPolicy.staffWithoutMfa} of ${securityPolicy.totalStaff} staff have not set it up yet.`
                  : `All ${securityPolicy.totalStaff} staff have it set up.`}
                {' '}Everyone sets theirs up from their own profile.
              </div>
            </div>
            <button
              type="button"
              onClick={() => savePolicy({ requireMfa: !securityPolicy.requireMfa })}
              disabled={busy === 'policy'}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                securityPolicy.requireMfa ? 'bg-blue-500' : dark ? 'bg-slate-600' : 'bg-gray-300'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                securityPolicy.requireMfa ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>
      )}

      {/* ── Claim a domain ── */}
      <form onSubmit={claim} className="mt-5 flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className={`block text-xs mb-1 ${muted}`}>Email domain</label>
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="yourclinic.com"
            required
            className={`w-full ${field}`}
          />
        </div>
        <div>
          <label className={`block text-xs mb-1 ${muted}`}>New signups</label>
          <select value={policy} onChange={(e) => setPolicy(e.target.value)} className={field}>
            <option value="auto_request">Need approval</option>
            <option value="auto_join">Join immediately</option>
            <option value="disabled">Not allowed</option>
          </select>
        </div>
        <div>
          <label className={`block text-xs mb-1 ${muted}`}>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className={field}>
            <option value="staff">Staff</option>
            <option value="nurse">Nurse</option>
            <option value="doctor">Doctor</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={busy === 'claim' || !domain.trim()}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-60"
        >
          Claim domain
        </button>
      </form>

      {/* ── Claimed domains ── */}
      <div className="mt-5 space-y-3">
        {domains.length === 0 ? (
          <p className={`text-sm ${muted}`}>No domains claimed yet.</p>
        ) : domains.map((d) => (
          <div key={d.id} className={`p-3 rounded-lg border ${dark ? 'border-slate-700' : 'border-gray-200'}`}>
            <div className="flex flex-wrap items-center gap-2">
              {d.verified_at
                ? <ShieldCheck className="w-4 h-4 text-green-600" />
                : <ShieldAlert className="w-4 h-4 text-amber-600" />}
              <span className={`font-medium ${text}`}>{d.domain}</span>
              <span className={`text-xs ${muted}`}>
                {d.verified_at ? 'verified' : 'awaiting DNS verification'}
              </span>
              <div className="flex-1" />
              <select
                value={d.join_policy}
                onChange={(e) => setPolicyFor(d.id, e.target.value)}
                className={field}
              >
                <option value="auto_request">Need approval</option>
                <option value="auto_join">Join immediately</option>
                <option value="disabled">Not allowed</option>
              </select>
              {!d.verified_at && (
                <button
                  onClick={() => verify(d.id)}
                  disabled={busy === `verify:${d.id}`}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-60"
                >
                  {busy === `verify:${d.id}` ? 'Checking…' : 'Verify'}
                </button>
              )}
              <button
                onClick={() => remove(d.id)}
                title="Remove this domain"
                className={`p-1.5 rounded border ${dark ? 'border-slate-600 text-slate-300' : 'border-gray-300 text-gray-600'}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {!d.verified_at && (
              <div className={`mt-3 p-3 rounded ${dark ? 'bg-slate-900' : 'bg-gray-50'}`}>
                <div className={`text-xs mb-2 ${muted}`}>
                  Add this as a TXT record at <strong>{d.domain}</strong> (or at{' '}
                  <strong>_aureoncare.{d.domain}</strong>), then click Verify. DNS changes can
                  take a while to appear.
                </div>
                <div className="flex gap-2 items-center">
                  <code className={`flex-1 text-xs break-all ${text}`}>{d.verification_token}</code>
                  <button
                    onClick={() => copy(d.verification_token, d.id)}
                    className={`shrink-0 px-2 py-1 rounded border text-xs ${dark ? 'border-slate-600 text-slate-200' : 'border-gray-300 text-gray-700'}`}
                  >
                    {copied === d.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {decided.length > 0 && (
        <details className="mt-5">
          <summary className={`text-sm cursor-pointer ${muted}`}>
            Past decisions ({decided.length})
          </summary>
          <table className="w-full text-sm mt-2">
            <tbody>
              {decided.map((r) => (
                <tr key={r.id} className={dark ? 'border-t border-slate-700' : 'border-t border-gray-200'}>
                  <td className={`py-1.5 ${text}`}>{r.email}</td>
                  <td className={`py-1.5 ${muted}`}>{r.status}</td>
                  <td className={`py-1.5 ${muted}`}>
                    {r.decided_at ? new Date(r.decided_at).toLocaleDateString() : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
};

export default TeamAccessPanel;
