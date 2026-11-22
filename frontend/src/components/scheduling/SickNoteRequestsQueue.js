import React, { useCallback, useEffect, useState } from 'react';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';
import SickNotesPanel from '../patients/SickNotesPanel';

const nice = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const PURPOSE = { work: 'Work', school: 'School', other: 'Other' };

/**
 * Patients' open sick-note requests across the practice, oldest first. "Review" opens the
 * patient's sick notes with the request pre-filled, where a clinician issues or declines it.
 * Renders nothing when there are none, or for staff without access to sick notes.
 */
const SickNoteRequestsQueue = ({ theme = 'light', api, addNotification }) => {
  const dark = theme === 'dark';
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    try { const d = await api.getSickNoteRequests(); setItems(d.requests || []); } catch { setItems([]); }
  }, [api]);
  useEffect(() => { load(); }, [load]);

  if (!items.length) return null;
  const muted = dark ? 'text-slate-400' : 'text-gray-600';

  return (
    <section className={`mb-6 rounded-xl border p-4 ${dark ? 'bg-slate-800/60 border-teal-500/40' : 'bg-teal-50 border-teal-200'}`} aria-labelledby="snr-queue-h">
      <h2 id="snr-queue-h" className={`flex items-center gap-2 font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>
        <FileText className="w-5 h-5 text-teal-600" /> Sick note requests ({items.length})
      </h2>
      <p className={`text-sm mt-1 mb-3 ${muted}`}>Patients asked for these in the portal or the app. Review each one: issue a note or decline with a reason.</p>
      <ul className="space-y-3">
        {items.map((r) => (
          <li key={r.id} className={`rounded-lg p-3 border ${dark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
            <div className="flex flex-wrap justify-between gap-2">
              <div className="min-w-0">
                <div className={`font-medium ${dark ? 'text-white' : 'text-gray-900'}`}>
                  {r.patientName}{r.mrn ? <span className={`ml-2 text-sm font-normal ${muted}`}>{r.mrn}</span> : null}
                </div>
                <div className={`text-sm ${muted}`}>{PURPOSE[r.purpose]} · {nice(r.startDate)} – {nice(r.endDate)} ({r.days} day{r.days === 1 ? '' : 's'}) · asked {new Date(r.createdAt).toLocaleDateString()}</div>
                <div className={`text-sm ${dark ? 'text-slate-300' : 'text-gray-700'}`}>“{r.reason}”</div>
              </div>
              <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}
                      className="self-start inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-teal-700 hover:bg-teal-800 text-white">
                {open === r.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />} Review
              </button>
            </div>
            {open === r.id && (
              <div className="mt-4">
                <SickNotesPanel patientId={r.patientId} theme={theme} api={api} addNotification={addNotification}
                                initialRequestId={r.id} onChanged={() => { setOpen(null); load(); }} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};

export default SickNoteRequestsQueue;
