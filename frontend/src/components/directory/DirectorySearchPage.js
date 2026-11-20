import React, { useCallback, useRef, useState } from 'react';
import { Search, MapPin, LocateFixed, X, Loader2, Stethoscope } from 'lucide-react';
import BrandLogo from '../common/BrandLogo';

/**
 * /find — the AureonCare directory: one search box over practices that chose to be
 * searchable (Phase 3).
 *
 * Privacy by construction:
 *   - the search is held in this page only — never put in the address bar, so it does not
 *     end up in browser history, shared links or hosting logs;
 *   - it is sent in a POST body, which the server does not log;
 *   - "Use my location" rounds the position to ~1 km here, before it leaves the browser,
 *     and it is used for one search at a time and never stored.
 */
const PAGE = 20;

const DirectorySearchPage = ({ theme = 'light' }) => {
  const dark = theme === 'dark';
  const [q, setQ] = useState('');
  const [where, setWhere] = useState(null);       // { lat, lng } rounded, or null
  const [locating, setLocating] = useState(false);
  const [state, setState] = useState({ status: 'idle', results: [], total: 0, understood: null, error: '' });
  const lastQuery = useRef(null);

  const run = useCallback(async ({ append = false, coords = where } = {}) => {
    const offset = append ? state.results.length : 0;
    setState((s) => ({ ...s, status: append ? 'more' : 'loading', error: '' }));
    try {
      const r = await fetch('/api/directory/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({ q, ...(coords || {}), limit: PAGE, offset }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Search is not available right now.');
      lastQuery.current = q;
      setState((s) => ({
        status: 'done', total: data.total, understood: data.understood, error: '',
        results: append ? [...s.results, ...data.results] : data.results,
      }));
    } catch (e) {
      setState((s) => ({ ...s, status: 'error', error: e.message }));
    }
  }, [q, where, state.results.length]);

  const useMyLocation = () => {
    if (!navigator.geolocation) { setState((s) => ({ ...s, error: 'Your browser cannot share a location. Type a city or postcode instead.' })); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: Math.round(pos.coords.latitude * 100) / 100, lng: Math.round(pos.coords.longitude * 100) / 100 };
        setWhere(coords); setLocating(false);
        run({ coords });
      },
      () => { setLocating(false); setState((s) => ({ ...s, error: 'Location was not shared. You can type a city or postcode instead.' })); },
      { enableHighAccuracy: false, maximumAge: 600000, timeout: 10000 }
    );
  };

  const bg = dark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900';
  const card = dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const muted = dark ? 'text-slate-400' : 'text-slate-500';
  const u = state.understood;
  const understoodText = u && [u.specialties.length ? u.specialties.join(', ') : null, u.place ? `in ${u.place}` : null,
    u.name ? `named “${u.name}”` : null, u.nearby ? 'near you' : null].filter(Boolean).join(' · ');

  return (
    <div className={`min-h-screen ${bg}`}>
      <header className="bg-slate-900 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <a href="/" aria-label="AureonCare home"><BrandLogo size={32} theme="dark" /></a>
          <a href="/" className="text-sm text-slate-300 hover:text-white">Sign in</a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Find a practice</h1>
        <p className={`mt-1 ${muted}`}>Search by specialty, place or doctor — for example “dermatologist near Springfield” or “Dr Patel”.</p>

        <form role="search" className="mt-6" onSubmit={(e) => { e.preventDefault(); run(); }}>
          <label htmlFor="directory-q" className="sr-only">Search practices</label>
          <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${card} focus-within:ring-2 focus-within:ring-teal-500`}>
            <Search className={`w-5 h-5 shrink-0 ${muted}`} aria-hidden="true" />
            <input id="directory-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} maxLength={200} autoComplete="off"
                   placeholder="Specialty, place or doctor" className="flex-1 min-w-0 bg-transparent outline-none py-1.5 text-base" />
            <button type="submit" className="shrink-0 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-medium">Search</button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            {where ? (
              <span className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400">
                <MapPin className="w-4 h-4" aria-hidden="true" /> Using your approximate location
                <button type="button" onClick={() => { setWhere(null); if (lastQuery.current !== null) run({ coords: null }); }}
                        className={`ml-1 inline-flex items-center gap-0.5 underline ${muted}`}><X className="w-3.5 h-3.5" aria-hidden="true" />Clear</button>
              </span>
            ) : (
              <button type="button" onClick={useMyLocation} disabled={locating}
                      className={`inline-flex items-center gap-1 underline underline-offset-2 ${muted} hover:text-teal-600 disabled:opacity-60`}>
                {locating ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <LocateFixed className="w-4 h-4" aria-hidden="true" />}
                Use my location
              </button>
            )}
            <span className={muted}>We don’t keep your searches or your location.</span>
          </div>
        </form>

        <section aria-live="polite" aria-busy={state.status === 'loading'} className="mt-8">
          {state.error && <p role="alert" className="text-red-500 mb-4">{state.error}</p>}
          {state.status === 'loading' && <p className={`flex items-center gap-2 ${muted}`}><Loader2 className="w-4 h-4 animate-spin" /> Searching…</p>}
          {state.status !== 'loading' && u && (
            <p className={`mb-4 text-sm ${muted}`}>
              {state.total} {state.total === 1 ? 'practice' : 'practices'}{understoodText ? <> · showing results for <strong className={dark ? 'text-slate-200' : 'text-slate-700'}>{understoodText}</strong></> : null}
            </p>
          )}
          {state.status === 'done' && state.total === 0 && (
            <div className={`rounded-xl border p-6 ${card}`}>
              <p className="font-medium">No practices found.</p>
              <p className={`text-sm mt-1 ${muted}`}>Try a broader search — a specialty on its own, a nearby city, or check the spelling of a name.</p>
            </div>
          )}
          <ul className="space-y-3">
            {state.results.map((r) => (
              <li key={r.url}>
                <a href={r.url} className={`block rounded-xl border p-4 transition-colors hover:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500 ${card}`}>
                  <div className="flex gap-3">
                    {r.logo
                      ? <img src={r.logo} alt="" className="w-14 h-14 rounded-lg object-cover bg-white shrink-0" />
                      : <div className={`w-14 h-14 rounded-lg shrink-0 flex items-center justify-center ${dark ? 'bg-slate-800' : 'bg-slate-100'}`} aria-hidden="true"><Stethoscope className={`w-6 h-6 ${muted}`} /></div>}
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold">{r.name}</h2>
                      {r.specialties.length > 0 && <p className="text-sm text-teal-700 dark:text-teal-400">{r.specialties.join(' · ')}</p>}
                      {(r.place || r.distanceKm != null) && (
                        <p className={`text-sm ${muted} flex items-center gap-1`}>
                          <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                          {[r.place, r.distanceKm != null ? `${r.distanceKm} km away` : null, r.locations > 1 ? `${r.locations} locations` : null].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {r.providers.length > 0 && (
                        <p className={`text-sm mt-1 ${dark ? 'text-slate-300' : 'text-slate-700'}`}>
                          {r.providers.map((p) => (p.specialization ? `${p.name} (${p.specialization})` : p.name)).join(', ')}
                          {r.moreProviders > 0 ? ` and ${r.moreProviders} more` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
          {state.results.length > 0 && state.results.length < state.total && (
            <div className="mt-6 text-center">
              <button type="button" onClick={() => run({ append: true })} disabled={state.status === 'more'}
                      className={`px-4 py-2 rounded-lg border ${card} disabled:opacity-60`}>
                {state.status === 'more' ? 'Loading…' : 'Show more'}
              </button>
            </div>
          )}
        </section>
      </main>
      <footer className={`max-w-4xl mx-auto px-4 pb-10 text-xs ${muted}`}>
        Practices appear here only if they choose to, and doctors only with their consent. Results are not paid placements.
      </footer>
    </div>
  );
};

export default DirectorySearchPage;
