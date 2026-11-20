import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Check, X, UserPlus, AlertTriangle, Loader2 } from 'lucide-react';

/**
 * Appointment requests from guests on the public booking page.
 *
 * A guest's booking is held (the slot is kept) but attached to no chart: who it is for is
 * the practice's decision, never the email the guest typed. The email match is shown as a
 * HINT only. Renders nothing when there are no open requests.
 */
const BookingRequestsPanel = ({ theme = 'light', api, addNotification, onChanged }) => {
  const dark = theme === 'dark';
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try { setItems(await api.getBookingRequests()); } catch { setItems([]); }
  }, [api]);
  useEffect(() => { load(); }, [load]);

  if (!items.length) return null;

  const act = async (id, fn, okText) => {
    setBusy(id);
    try {
      await fn();
      addNotification?.('success', okText);
      await load();
      onChanged?.();
    } catch (e) {
      addNotification?.('alert', e.message);
    } finally {
      setBusy('');
    }
  };

  const fmt = (d) => new Date(d).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const card = dark ? 'bg-slate-800/60 border-amber-500/40' : 'bg-amber-50 border-amber-200';
  const muted = dark ? 'text-slate-400' : 'text-gray-600';
  const btn = `inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-60`;

  return (
    <section className={`mb-6 rounded-xl border p-4 ${card}`} aria-labelledby="booking-requests-h">
      <h2 id="booking-requests-h" className={`flex items-center gap-2 font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>
        <CalendarClock className="w-5 h-5 text-amber-500" /> Booking requests ({items.length})
      </h2>
      <p className={`text-sm mt-1 mb-3 ${muted}`}>
        Booked online by people who were not signed in. The time is held; confirm who each one is for, or decline.
      </p>
      <ul className="space-y-3">
        {items.map((r) => (
          <li key={r.id} className={`rounded-lg p-3 ${dark ? 'bg-slate-900' : 'bg-white'} border ${dark ? 'border-slate-700' : 'border-gray-200'}`}>
            <div className="flex flex-wrap justify-between gap-2">
              <div className="min-w-0">
                <div className={`font-medium ${dark ? 'text-white' : 'text-gray-900'}`}>
                  {r.guest.firstName} {r.guest.lastName}
                  <span className={`ml-2 text-sm font-normal ${muted}`}>{[r.guest.email, r.guest.phone, r.guest.dob && `born ${String(r.guest.dob).slice(0, 10)}`].filter(Boolean).join(' · ')}</span>
                </div>
                <div className={`text-sm ${muted}`}>{fmt(r.startTime)} · {r.appointmentType}{r.provider ? ` · ${r.provider}` : ''}{r.reason ? ` · “${r.reason}”` : ''}</div>
                {r.possibleMatch && (
                  <div className="mt-1 text-sm flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                    Same email as patient {r.possibleMatch.name}{r.possibleMatch.dob ? ` (born ${String(r.possibleMatch.dob).slice(0, 10)})` : ''} — check it is really them before confirming for that chart.
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-start gap-2">
                {r.possibleMatch && (
                  <button type="button" disabled={busy === r.id} className={`${btn} bg-teal-700 hover:bg-teal-800 text-white`}
                          onClick={() => act(r.id, () => api.confirmBookingRequest(r.id, { patientId: r.possibleMatch.id }), `Confirmed for ${r.possibleMatch.name}`)}>
                    {busy === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Confirm for {r.possibleMatch.name}
                  </button>
                )}
                {!r.possibleMatch && (
                  <button type="button" disabled={busy === r.id} className={`${btn} bg-teal-700 hover:bg-teal-800 text-white`}
                          onClick={() => act(r.id, () => api.confirmBookingRequest(r.id, { asNewPatient: true }), 'Confirmed as a new patient')}>
                    {busy === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Confirm as new patient
                  </button>
                )}
                <button type="button" disabled={busy === r.id}
                        className={`${btn} border ${dark ? 'border-slate-600 text-slate-200 hover:bg-slate-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                        onClick={() => act(r.id, () => api.declineBookingRequest(r.id), 'Request declined; the guest was told')}>
                  <X className="w-4 h-4" /> Decline
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default BookingRequestsPanel;
