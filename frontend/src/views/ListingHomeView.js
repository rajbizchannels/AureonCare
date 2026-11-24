import React, { useEffect, useState } from 'react';
import { Globe, ExternalLink, CalendarClock, Sparkles, Loader2 } from 'lucide-react';
import BookingRequestsPanel from '../components/scheduling/BookingRequestsPanel';

/**
 * Home for a practice on the free Listing plan: its public page, booking requests to confirm,
 * the bookings already confirmed, and the way to the rest of AureonCare (a free trial once, or
 * a plan). The server allows nothing else on this plan (middleware/listingGate.js).
 */
const ListingHomeView = ({ theme, api, appointments = [], addNotification, onNavigate }) => {
  const dark = theme === 'dark';
  const card = `rounded-xl border p-5 ${dark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-gray-200'}`;
  const text = dark ? 'text-white' : 'text-gray-900';
  const muted = dark ? 'text-slate-400' : 'text-gray-600';
  const [profile, setProfile] = useState(null);
  const [plans, setPlans] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getPracticeProfile().then(setProfile).catch(() => setProfile(null));
    api.getSubscriptionPlans().then((p) => setPlans(p.filter((x) => Number(x.price) > 0))).catch(() => setPlans([]));
  }, [api]);

  const upcoming = appointments
    .filter((a) => a.start_time && new Date(String(a.start_time).replace(' ', 'T')) >= new Date() && !['cancelled', 'canceled'].includes(a.status))
    .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
    .slice(0, 8);
  const p = profile && (profile.profile || profile);
  const publicUrl = profile && (profile.publicUrl || profile.url);
  const live = p && p.visibility && p.visibility !== 'off';
  const trialPlan = plans.find((x) => x.trial_days > 0);

  const startTrial = async () => {
    if (!trialPlan) return;
    setBusy(true);
    try {
      await api.startPlanTrial(trialPlan.id);
      addNotification?.('success', `Your ${trialPlan.trial_days}-day free trial of ${trialPlan.display_name || trialPlan.name} has started.`);
      window.location.reload();
    } catch (e) {
      addNotification?.('alert', e.message);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl" data-testid="listing-home">
      <div>
        <h1 className={`text-2xl font-semibold ${text}`}>Your free listing</h1>
        <p className={`mt-1 ${muted}`}>Patients find you, see your services and request appointments. You confirm each request by email.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className={card}>
          <h2 className={`font-semibold flex items-center gap-2 ${text}`}><Globe className="w-4 h-4" /> Public page</h2>
          {p ? (
            <>
              <p className={`mt-2 text-sm ${muted}`}>{live ? (p.visibility === 'searchable' ? 'Live and listed in “Find a practice”.' : 'Live — reachable by its link only.') : 'Not published yet.'}</p>
              {live && publicUrl ? <a href={publicUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-blue-500 hover:underline">{publicUrl} <ExternalLink className="w-3 h-3" /></a> : null}
            </>
          ) : <p className={`mt-2 text-sm ${muted}`}>Set up your page: photos, services, opening hours and who works there.</p>}
          <button type="button" onClick={() => onNavigate?.('admin', 'practiceProfile')} className="mt-4 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium">Edit public page</button>
        </div>

        <div className={card}>
          <h2 className={`font-semibold flex items-center gap-2 ${text}`}><Sparkles className="w-4 h-4" /> Run your whole clinic here</h2>
          <p className={`mt-2 text-sm ${muted}`}>Records, calendar, reminders, invoices, stock, accounts and AI help — in one place.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {trialPlan ? (
              <button type="button" onClick={startTrial} disabled={busy} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-60">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Start {trialPlan.trial_days}-day free trial of {trialPlan.display_name || trialPlan.name}
              </button>
            ) : null}
            <button type="button" onClick={() => onNavigate?.('admin', 'plans')} className={`px-3 py-2 rounded-lg border text-sm ${dark ? 'border-slate-600 text-white' : 'border-gray-300 text-gray-800'}`}>See plans</button>
          </div>
        </div>
      </div>

      <BookingRequestsPanel theme={theme} api={api} addNotification={addNotification} />

      <div className={card}>
        <h2 className={`font-semibold flex items-center gap-2 ${text}`}><CalendarClock className="w-4 h-4" /> Confirmed bookings</h2>
        {upcoming.length ? (
          <ul className="mt-3 divide-y divide-gray-200/20">
            {upcoming.map((a) => (
              <li key={a.id} className="py-2 flex justify-between gap-4 text-sm">
                <span className={text}>{a.patient || a.patient_name || 'Patient'}{a.appointment_type ? ` · ${a.appointment_type}` : ''}</span>
                <span className={muted}>{new Date(String(a.start_time).replace(' ', 'T')).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </li>
            ))}
          </ul>
        ) : <p className={`mt-2 text-sm ${muted}`}>No upcoming bookings yet. Requests appear above as patients send them.</p>}
      </div>
    </div>
  );
};

export default ListingHomeView;
