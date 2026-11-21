import React, { useCallback, useEffect, useState } from 'react';
import { Send, CheckCircle2, Clock, AlertCircle, Copy, XCircle, Lock, Unlock } from 'lucide-react';
import BusyButton from '../common/BusyButton';
import QrCodeButton from '../common/QrCodeButton';
import { formatDate } from '../../utils/formatters';

/**
 * Patient portal access, on the patient's chart (staff only).
 *
 * Shows whether the patient has portal access, and lets staff send — or re-send, or
 * withdraw — a one-time invitation. The patient chooses their own password from the link;
 * staff never see or set it. If the email could not be sent, the link is shown once so it
 * can be passed on another way.
 */
const PortalInvitePanel = ({ patientId, theme = 'light', api, addNotification }) => {
  const dark = theme === 'dark';
  const [status, setStatus] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [manualLink, setManualLink] = useState('');

  const load = useCallback(async () => {
    try {
      setStatus(await api.getPortalInviteStatus(patientId));
      setLoadError('');
    } catch (e) {
      setLoadError(e.message);
    }
  }, [api, patientId]);

  useEffect(() => { if (patientId) load(); }, [patientId, load]);

  const send = async () => {
    setManualLink('');
    try {
      const r = await api.sendPortalInvite(patientId);
      if (r.emailed) {
        addNotification?.('success', `Portal invitation sent to ${r.email}`);
      } else {
        setManualLink(r.inviteUrl || '');
        addNotification?.('alert', 'The email could not be sent — copy the link below and pass it on another way.');
      }
      await load();
    } catch (e) {
      addNotification?.('alert', e.message);
    }
  };

  const withdraw = async () => {
    try {
      await api.revokePortalInvite(patientId);
      setManualLink('');
      addNotification?.('success', 'Invitation withdrawn');
      await load();
    } catch (e) {
      addNotification?.('alert', e.message);
    }
  };

  const unlock = async () => {
    try {
      await api.unlockPortalSignIn(patientId);
      addNotification?.('success', 'Portal sign-in unlocked. The patient can try again now.');
      await load();
    } catch (e) {
      addNotification?.('alert', e.message);
    }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(manualLink); addNotification?.('success', 'Link copied'); }
    catch { /* clipboard unavailable: the link is selectable on screen */ }
  };

  const muted = dark ? 'text-slate-400' : 'text-gray-600';
  const strong = dark ? 'text-white' : 'text-gray-900';
  const btn = 'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium';

  if (loadError) {
    return <p className={`text-sm ${muted}`}>Portal status unavailable: {loadError}</p>;
  }
  if (!status) return <p className={`text-sm ${muted}`}>Loading portal status…</p>;

  const inv = status.invite;
  let line;
  if (status.portalEnabled) {
    line = (<span className="flex items-center gap-1.5 text-green-600"><CheckCircle2 size={16} /> Portal active</span>);
  } else if (inv && inv.status === 'pending') {
    line = (<span className={`flex items-center gap-1.5 ${dark ? 'text-amber-400' : 'text-amber-700'}`}>
      <Clock size={16} /> Invited {formatDate(inv.sentAt)} · link expires {formatDate(inv.expiresAt)}
    </span>);
  } else if (inv && inv.status === 'expired') {
    line = (<span className={`flex items-center gap-1.5 ${muted}`}><AlertCircle size={16} /> Invitation expired {formatDate(inv.expiresAt)}</span>);
  } else {
    line = <span className={muted}>Not invited yet</span>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={`text-sm font-medium ${strong}`}>{line}</div>
        <div className="flex items-center gap-2">
          {!status.hasEmail ? (
            <span className={`text-sm ${muted}`}>Add an email address to invite this patient.</span>
          ) : (
            <BusyButton onClick={send} className={`${btn} bg-blue-600 hover:bg-blue-700 text-white`} busyLabel="Sending…">
              <Send size={14} />
              {status.portalEnabled ? 'Send new set-up link' : inv && inv.status === 'pending' ? 'Re-send invitation' : 'Invite to portal'}
            </BusyButton>
          )}
          {inv && inv.status === 'pending' && (
            <BusyButton onClick={withdraw} busyLabel="Withdrawing…"
                        className={`${btn} ${dark ? 'bg-slate-700 text-slate-200' : 'bg-gray-200 text-gray-800'}`}>
              <XCircle size={14} /> Withdraw
            </BusyButton>
          )}
        </div>
      </div>
      {status.locked && (
        <div role="status" className={`mt-3 p-3 rounded-lg text-sm flex flex-wrap items-center justify-between gap-2 ${dark ? 'bg-red-900/30 text-red-200' : 'bg-red-50 text-red-800'}`}>
          <span className="flex items-center gap-1.5"><Lock size={16} /> Portal sign-in is locked after 4 wrong passwords. It unlocks itself after 15 minutes.</span>
          <BusyButton onClick={unlock} busyLabel="Unlocking…" className={`${btn} bg-red-600 hover:bg-red-700 text-white`}>
            <Unlock size={14} /> Unlock now
          </BusyButton>
        </div>
      )}
      {manualLink && (
        <div className={`mt-3 p-3 rounded-lg text-sm ${dark ? 'bg-slate-800 text-slate-200' : 'bg-amber-50 text-gray-800'}`}>
          <p className="mb-2">The email could not be sent. Give the patient this link (it works once, for 14 days):</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all select-all">{manualLink}</code>
            <QrCodeButton getUrl={manualLink} theme={theme} title="Patient portal invitation"
                          description="Let the patient scan this to set up their portal. It works once." />
            <button type="button" onClick={copy} className={`${btn} ${dark ? 'bg-slate-700' : 'bg-white border border-gray-300'}`}>
              <Copy size={14} /> Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortalInvitePanel;
