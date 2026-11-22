import React, { useCallback, useEffect, useState } from 'react';
import { Send, X, Clock, CheckCircle2, XCircle } from 'lucide-react';
import BusyButton from '../common/BusyButton';

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const nice = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const PURPOSE = { work: 'Work', school: 'School or college', other: 'Normal activities' };

/**
 * The patient asks their practice for a sick note (patient portal). A clinician issues it
 * or declines it; the patient sees the status here and is emailed either way. One request
 * can be open at a time; it can be cancelled while it waits.
 */
const SickNoteRequestPanel = ({ patientId, theme = 'light', api, addNotification, onChanged }) => {
  const dark = theme === 'dark';
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setRequests(await api.portalGetSickNoteRequests(patientId)); } catch { setRequests([]); }
  }, [api, patientId]);
  useEffect(() => { if (patientId) load(); }, [patientId, load]);

  const pending = requests.find((r) => r.status === 'pending');
  const set = (k, v) => { setError(''); setForm((f) => ({ ...f, [k]: v })); };

  const send = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!form.reason || form.reason.trim().length < 10) { setError('Tell your clinician briefly why you need the note (at least 10 characters).'); return; }
    if (form.endDate < form.startDate) { setError('The last day cannot be before the first day.'); return; }
    setSaving(true);
    try {
      await api.portalRequestSickNote(patientId, form);
      addNotification?.('success', 'Request sent. Your clinician will review it and you will get an email.');
      setForm(null);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (id) => {
    try { await api.portalCancelSickNoteRequest(patientId, id); addNotification?.('success', 'Request cancelled'); await load(); }
    catch (err) { addNotification?.('alert', err.message); }
  };

  const card = dark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-200';
  const muted = dark ? 'text-slate-400' : 'text-gray-600';
  const strong = dark ? 'text-white' : 'text-gray-900';
  const input = `w-full px-3 py-2 rounded-lg border text-sm ${dark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`;
  const label = `block text-sm font-medium mb-1 ${dark ? 'text-slate-300' : 'text-gray-700'}`;
  const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium';
  const STATUS = {
    pending: { Icon: Clock, text: 'Waiting for your clinician', cls: dark ? 'text-amber-300' : 'text-amber-700' },
    issued: { Icon: CheckCircle2, text: 'Issued — see your sick notes below', cls: 'text-teal-600' },
    declined: { Icon: XCircle, text: 'Not issued', cls: 'text-red-600' },
    cancelled: { Icon: X, text: 'Cancelled', cls: muted },
  };

  return (
    <div className={`p-4 rounded-xl border space-y-3 ${card}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className={`font-semibold ${strong}`}>Need a sick note?</h3>
          <p className={`text-sm ${muted}`}>Ask your practice. A clinician reviews every request and may ask you to book an appointment.</p>
        </div>
        {!form && !pending && (
          <button type="button" onClick={() => setForm({ purpose: 'work', startDate: today(), endDate: plusDays(today(), 6), reason: '' })}
                  className={`${btn} bg-teal-700 hover:bg-teal-800 text-white`}>
            <Send className="w-4 h-4" /> Request a sick note
          </button>
        )}
      </div>

      {form && (
        <form onSubmit={send} aria-label="Request a sick note" className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={label} htmlFor="snr-purpose">For</label>
              <select id="snr-purpose" className={input} value={form.purpose} onChange={(e) => set('purpose', e.target.value)}>
                {Object.entries(PURPOSE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="snr-from">First day</label>
              <input id="snr-from" type="date" className={input} value={form.startDate} min={plusDays(today(), -14)} max={plusDays(today(), 30)}
                     onChange={(e) => set('startDate', e.target.value)} required />
            </div>
            <div>
              <label className={label} htmlFor="snr-to">Last day</label>
              <input id="snr-to" type="date" className={input} value={form.endDate} min={form.startDate} onChange={(e) => set('endDate', e.target.value)} required />
            </div>
          </div>
          <div>
            <label className={label} htmlFor="snr-reason">Why do you need it?</label>
            <textarea id="snr-reason" rows={3} maxLength={1000} className={input} value={form.reason} onChange={(e) => set('reason', e.target.value)}
                      placeholder="For example: flu with a high temperature since Saturday, can't work." />
            <p className={`text-xs mt-1 ${muted}`}>Only your practice sees this. It can go back up to 14 days and start up to 30 days ahead.</p>
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={`${btn} border ${dark ? 'border-slate-600 text-slate-200' : 'border-gray-300 text-gray-700'}`} onClick={() => setForm(null)}>Cancel</button>
            <BusyButton type="submit" busy={saving} busyLabel="Sending…" className={`${btn} bg-teal-700 hover:bg-teal-800 text-white`}>
              <Send className="w-4 h-4" /> Send request
            </BusyButton>
          </div>
        </form>
      )}

      {requests.length > 0 && (
        <ul className="space-y-2" aria-label="Your sick note requests">
          {requests.slice(0, 5).map((r) => {
            const st = STATUS[r.status] || STATUS.pending;
            return (
              <li key={r.id} className={`flex flex-wrap items-start justify-between gap-2 text-sm border-t pt-2 ${dark ? 'border-slate-700' : 'border-gray-200'}`}>
                <div className="min-w-0">
                  <div className={strong}>{PURPOSE[r.purpose]} · {nice(r.startDate)} – {nice(r.endDate)} ({r.days} day{r.days === 1 ? '' : 's'})</div>
                  <div className={`flex items-center gap-1 ${st.cls}`}><st.Icon className="w-4 h-4" aria-hidden="true" /> {st.text}</div>
                  {r.status === 'declined' && r.decisionReason && <div className={muted}>Clinician’s note: {r.decisionReason}</div>}
                </div>
                {r.status === 'pending' && (
                  <BusyButton onClick={() => cancel(r.id)} busyLabel="Cancelling…"
                              className={`${btn} border ${dark ? 'border-slate-600 text-slate-200' : 'border-gray-300 text-gray-700'}`}>
                    <X className="w-4 h-4" /> Cancel request
                  </BusyButton>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default SickNoteRequestPanel;
