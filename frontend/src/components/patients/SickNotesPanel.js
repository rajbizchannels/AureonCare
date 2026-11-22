import React, { useCallback, useEffect, useState } from 'react';
import { FileText, Plus, Printer, Mail, Ban, X } from 'lucide-react';
import BusyButton from '../common/BusyButton';
import { printHtml } from '../../utils/printHtml';

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const nice = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const PURPOSE = { work: 'Work', school: 'School or college', other: 'Normal activities' };

const blank = () => ({
  purpose: 'work', fitness: 'not_fit', assessedOn: today(), startDate: today(), endDate: plusDays(today(), 6),
  conditionText: '', adjustments: [], comments: '', followUp: false,
});

/**
 * Sick notes on a patient's chart (staff). Clinicians issue them; anyone with access can
 * print or email one. Notes are never edited: a wrong one is voided with a reason and a
 * new one issued, so a note someone was handed always matches the record.
 */
const SickNotesPanel = ({ patientId, theme = 'light', api, addNotification, initialRequestId = null, onChanged }) => {
  const dark = theme === 'dark';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [voiding, setVoiding] = useState(null);   // { id, reason }
  const [saving, setSaving] = useState(false);     // stops a double click issuing two notes
  const [declining, setDeclining] = useState(null); // { id, reason }
  const [openedRequest, setOpenedRequest] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api.getSickNotes(patientId)); setError(''); }
    catch (e) { setError(e.message); }
  }, [api, patientId]);
  useEffect(() => { if (patientId) load(); }, [patientId, load]);

  // Answer a patient's request: the form opens with their dates and purpose; the reason
  // they gave is shown for the clinician, not copied onto the note.
  const fromRequest = useCallback((r) => setForm({ ...blank(), purpose: r.purpose, startDate: r.startDate, endDate: r.endDate, requestId: r.id, requestReason: r.reason }), []);
  useEffect(() => {
    if (!data || openedRequest || !initialRequestId || !data.canIssue) return;
    const r = (data.requests || []).find((x) => x.id === initialRequestId && x.status === 'pending');
    if (r) fromRequest(r);
    setOpenedRequest(true);
  }, [data, initialRequestId, openedRequest, fromRequest]);

  const decline = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await api.declineSickNoteRequest(declining.id, declining.reason);
      addNotification?.('success', 'Request declined; the patient has been told');
      setDeclining(null); await load(); onChanged?.();
    } catch (err) { addNotification?.('alert', err.message); }
    finally { setSaving(false); }
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleAdj = (k) => setForm((f) => ({ ...f, adjustments: f.adjustments.includes(k) ? f.adjustments.filter((a) => a !== k) : [...f.adjustments, k] }));

  const print = async (id) => {
    try { const d = await api.getSickNoteDocument(id); printHtml(d.html, `Sick note ${d.reference}`); }
    catch (e) { addNotification?.('alert', e.message); }
  };

  const issue = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const { requestReason, ...body } = form;   // eslint-disable-line no-unused-vars
      const { note } = await api.issueSickNote({ ...body, patientId });
      addNotification?.('success', form.requestId ? `Sick note ${note.reference} issued; the patient has been told` : `Sick note ${note.reference} issued`);
      setForm(null);
      await load();
      await print(note.id);   // before onChanged: a queue may close this panel once the request is answered
      onChanged?.();
    } catch (err) {
      addNotification?.('alert', err.message);
    } finally {
      setSaving(false);
    }
  };

  const email = async (id) => {
    try { const r = await api.emailSickNote(id); addNotification?.('success', `Sick note emailed to ${r.to}`); await load(); }
    catch (e) { addNotification?.('alert', e.message); }
  };

  const doVoid = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try { await api.voidSickNote(voiding.id, voiding.reason); addNotification?.('success', 'Sick note voided'); setVoiding(null); await load(); }
    catch (err) { addNotification?.('alert', err.message); }
    finally { setSaving(false); }
  };

  const card = dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200';
  const muted = dark ? 'text-slate-400' : 'text-gray-600';
  const strong = dark ? 'text-white' : 'text-gray-900';
  const input = `w-full px-3 py-2 rounded-lg border text-sm ${dark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`;
  const label = `block text-sm font-medium mb-1 ${dark ? 'text-slate-300' : 'text-gray-700'}`;
  const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium';
  const ghost = `${btn} border ${dark ? 'border-slate-600 text-slate-200 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`;

  if (error) return <div className={`p-4 rounded-lg border ${card} text-sm ${muted}`}>Sick notes unavailable: {error}</div>;
  if (!data) return <div className={`p-4 rounded-lg border ${card} text-sm ${muted}`}>Loading sick notes…</div>;

  const days = form && form.startDate && form.endDate && form.endDate >= form.startDate
    ? Math.round((new Date(form.endDate) - new Date(form.startDate)) / 86400000) + 1 : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={`text-lg font-semibold flex items-center gap-2 ${strong}`}><FileText className="w-5 h-5 text-teal-600" /> Sick notes</h3>
        {data.canIssue && !form && (
          <button type="button" onClick={() => setForm(blank())} className={`${btn} bg-teal-700 hover:bg-teal-800 text-white`}>
            <Plus className="w-4 h-4" /> Issue sick note
          </button>
        )}
      </div>
      {!data.canIssue && <p className={`text-sm ${muted}`}>Only a clinician (doctor or nurse) can issue a sick note. You can print or email existing ones.</p>}

      {(data.requests || []).filter((r) => r.status === 'pending').map((r) => (
        <div key={r.id} className={`p-4 rounded-xl border ${dark ? 'border-amber-500/40 bg-amber-500/10' : 'border-amber-200 bg-amber-50'}`}>
          <div className={`font-medium ${strong}`}>Requested by the patient: {PURPOSE[r.purpose]} · {nice(r.startDate)} – {nice(r.endDate)} ({r.days} day{r.days === 1 ? '' : 's'})</div>
          <p className={`text-sm mt-1 ${dark ? 'text-slate-300' : 'text-gray-700'}`}>“{r.reason}”</p>
          {data.canIssue ? (
            declining && declining.id === r.id ? (
              <form onSubmit={decline} className="mt-3 flex flex-wrap gap-2 items-center">
                <input autoFocus className={`${input} flex-1 min-w-[200px]`} required maxLength={500} aria-label="Reason for declining"
                       placeholder="Reason the patient will see (e.g. please book an appointment)"
                       value={declining.reason} onChange={(e) => setDeclining({ ...declining, reason: e.target.value })} />
                <BusyButton type="submit" busy={saving} busyLabel="Declining…" className={`${btn} bg-red-600 hover:bg-red-700 text-white`}>Decline</BusyButton>
                <button type="button" className={ghost} onClick={() => setDeclining(null)}>Cancel</button>
              </form>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={`${btn} bg-teal-700 hover:bg-teal-800 text-white`} onClick={() => fromRequest(r)} disabled={Boolean(form)}>
                  <Plus className="w-4 h-4" /> Issue from request
                </button>
                <button type="button" className={ghost} onClick={() => setDeclining({ id: r.id, reason: '' })}><Ban className="w-4 h-4" /> Decline</button>
              </div>
            )
          ) : <p className={`text-xs mt-2 ${muted}`}>A clinician will review this request.</p>}
        </div>
      ))}

      {form && (
        <form onSubmit={issue} className={`p-4 rounded-xl border space-y-4 ${card}`} aria-label="Issue sick note">
          {form.requestId && (
            <p className={`text-sm ${muted}`}>Answering the patient’s request — their reason: “{form.requestReason}”. Check the dates and advice before issuing.</p>
          )}
          <div className="flex justify-between items-center">
            <h4 className={`font-semibold ${strong}`}>New sick note</h4>
            <button type="button" onClick={() => setForm(null)} aria-label="Cancel" className={muted}><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label} htmlFor="sn-purpose">For</label>
              <select id="sn-purpose" className={input} value={form.purpose} onChange={(e) => set('purpose', e.target.value)}>
                {Object.entries(PURPOSE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="sn-assessed">Assessed on</label>
              <input id="sn-assessed" type="date" max={today()} className={input} value={form.assessedOn} onChange={(e) => set('assessedOn', e.target.value)} required />
            </div>
          </div>
          <fieldset>
            <legend className={label}>Advice</legend>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-6">
              <label className={`flex items-center gap-2 text-sm ${strong}`}>
                <input type="radio" name="sn-fit" checked={form.fitness === 'not_fit'} onChange={() => set('fitness', 'not_fit')} /> Not fit
              </label>
              <label className={`flex items-center gap-2 text-sm ${strong}`}>
                <input type="radio" name="sn-fit" checked={form.fitness === 'may_be_fit'} onChange={() => set('fitness', 'may_be_fit')} /> May be fit, with adjustments
              </label>
            </div>
          </fieldset>
          {form.fitness === 'may_be_fit' && (
            <fieldset>
              <legend className={label}>Adjustments that may help</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(data.adjustments || {}).map(([k, v]) => (
                  <label key={k} className={`flex items-center gap-2 text-sm ${strong}`}>
                    <input type="checkbox" checked={form.adjustments.includes(k)} onChange={() => toggleAdj(k)} /> {v}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label} htmlFor="sn-from">From</label>
              <input id="sn-from" type="date" className={input} value={form.startDate} onChange={(e) => set('startDate', e.target.value)} required />
            </div>
            <div>
              <label className={label} htmlFor="sn-to">To</label>
              <input id="sn-to" type="date" min={form.startDate} className={input} value={form.endDate} onChange={(e) => set('endDate', e.target.value)} required />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className={muted}>{days ? `${days} day${days === 1 ? '' : 's'}` : 'Check the dates'} · quick:</span>
            {[3, 7, 14, 28].map((n) => (
              <button key={n} type="button" className={ghost} onClick={() => set('endDate', plusDays(form.startDate, n - 1))}>{n} days</button>
            ))}
          </div>
          <div>
            <label className={label} htmlFor="sn-cond">Condition, as written on the note</label>
            <input id="sn-cond" className={input} maxLength={500} value={form.conditionText} onChange={(e) => set('conditionText', e.target.value)}
                   placeholder="Leave blank to print “A medical condition”" />
            <p className={`text-xs mt-1 ${muted}`}>The patient hands this to their employer or school. Only write a diagnosis they have agreed to share.</p>
          </div>
          <div>
            <label className={label} htmlFor="sn-comments">Comments {form.fitness === 'may_be_fit' ? '(advice on what they can do)' : '(optional)'}</label>
            <textarea id="sn-comments" rows={3} className={input} maxLength={2000} value={form.comments} onChange={(e) => set('comments', e.target.value)} />
          </div>
          <label className={`flex items-center gap-2 text-sm ${strong}`}>
            <input type="checkbox" checked={form.followUp} onChange={(e) => set('followUp', e.target.checked)} /> I will need to assess fitness again at the end of this period
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className={ghost} onClick={() => setForm(null)}>Cancel</button>
            <BusyButton type="submit" busy={saving} className={`${btn} bg-teal-700 hover:bg-teal-800 text-white`} busyLabel="Issuing…">
              <Printer className="w-4 h-4" /> Issue and print
            </BusyButton>
          </div>
        </form>
      )}

      {data.notes.length === 0 && !form && <p className={`text-sm ${muted}`}>No sick notes yet.</p>}
      <ul className="space-y-2">
        {data.notes.map((n) => (
          <li key={n.id} className={`p-3 rounded-lg border ${card} ${n.status === 'voided' ? 'opacity-70' : ''}`}>
            <div className="flex flex-wrap justify-between gap-2">
              <div className="min-w-0">
                <div className={`font-medium ${strong}`}>
                  {n.fitness === 'not_fit' ? 'Not fit' : 'May be fit'} for {PURPOSE[n.purpose]?.toLowerCase() || 'work'} · {nice(n.startDate)} – {nice(n.endDate)} ({n.days} day{n.days === 1 ? '' : 's'})
                  {n.status === 'voided' && <span className="ml-2 text-xs font-semibold text-red-600">VOID</span>}
                </div>
                <div className={`text-sm ${muted}`}>
                  {n.reference} · {n.issuerName}{n.conditionText ? ` · ${n.conditionText}` : ''}{n.emailedAt ? ' · emailed' : ''}
                  {n.status === 'voided' && n.voidReason ? ` · voided: ${n.voidReason}` : ''}
                </div>
              </div>
              <div className="flex flex-wrap items-start gap-2">
                <button type="button" className={ghost} onClick={() => print(n.id)}><Printer className="w-4 h-4" /> Print</button>
                {n.status === 'issued' && (
                  <>
                    <BusyButton onClick={() => email(n.id)} className={ghost} busyLabel="Sending…"><Mail className="w-4 h-4" /> Email</BusyButton>
                    <button type="button" className={ghost} onClick={() => setVoiding({ id: n.id, reason: '' })}><Ban className="w-4 h-4" /> Void</button>
                  </>
                )}
              </div>
            </div>
            {voiding && voiding.id === n.id && (
              <form onSubmit={doVoid} className="mt-3 flex flex-wrap gap-2 items-center">
                <input autoFocus className={`${input} flex-1 min-w-[200px]`} placeholder="Reason (e.g. wrong dates)" value={voiding.reason}
                       onChange={(e) => setVoiding({ ...voiding, reason: e.target.value })} required maxLength={500} aria-label="Reason for voiding" />
                <BusyButton type="submit" busy={saving} className={`${btn} bg-red-600 hover:bg-red-700 text-white`} busyLabel="Voiding…">Void note</BusyButton>
                <button type="button" className={ghost} onClick={() => setVoiding(null)}>Cancel</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SickNotesPanel;
