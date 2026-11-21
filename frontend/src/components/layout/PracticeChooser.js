import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Check, Loader2, X } from 'lucide-react';
import api from '../../api/apiService';
import { broadcast } from '../../utils/sessionTab';
import { useOptionalApp } from '../../context/AppContext';
import { getTranslations } from '../../config/translations';

/**
 * "Choose a practice" — for people who work at more than one practice.
 *
 * Shown once, straight after signing in (the sign-in page sets the flag below), and again
 * whenever someone asks to switch (openPracticeChooser(), from the profile dialog). It
 * replaces the switcher that sat in the top bar of every screen. People with a single
 * practice never see it.
 *
 * Choosing another practice starts a session there (its role, data and two-factor rule),
 * so the page reloads and other open tabs follow.
 */
export const CHOOSE_FLAG = 'ac:choose-practice';
const OPEN_EVENT = 'ac:open-practice-chooser';

/** Ask for the chooser after a successful staff sign-in. */
export function requestPracticeChoice() {
  try { sessionStorage.setItem(CHOOSE_FLAG, '1'); } catch (_) { /* private mode: no chooser, last practice used */ }
}
/** Open the chooser now (the "Switch practice" button). */
export function openPracticeChooser() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

const PracticeChooser = () => {
  const app = useOptionalApp();
  const signedInStaff = Boolean(app && app.isAuthenticated && app.user && app.user.role !== 'patient');
  const dark = app?.theme === 'dark';
  const t = getTranslations(app?.language || 'en');
  const [practices, setPractices] = useState(null);
  const [fromSignIn, setFromSignIn] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const open = useCallback(async (afterSignIn) => {
    try {
      const data = await api.getMyPractices();
      if (data && Array.isArray(data.practices) && data.practices.length > 1) {
        setFromSignIn(afterSignIn); setError(''); setPractices(data.practices);
      }
    } catch (_) { /* no list, no chooser: the session carries on in its current practice */ }
  }, []);

  // Straight after signing in.
  useEffect(() => {
    if (!signedInStaff) return;
    let flagged = false;
    try { flagged = sessionStorage.getItem(CHOOSE_FLAG) === '1'; sessionStorage.removeItem(CHOOSE_FLAG); } catch (_) { /* ignore */ }
    if (flagged) open(true);
  }, [signedInStaff, open]);

  // On request.
  useEffect(() => {
    const onOpen = () => { if (signedInStaff) open(false); };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [signedInStaff, open]);

  useEffect(() => {
    if (!practices) return undefined;
    const esc = (e) => { if (e.key === 'Escape' && !busy) setPractices(null); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [practices, busy]);

  if (!practices || !signedInStaff) return null;

  // Role labels (same translation keys as the old top-bar switcher); others show as sent.
  const ROLE_LABELS = {
    admin: t.admin || 'Admin',
    doctor: t.doctor || 'Doctor',
    nurse: t.aiRole_nurse || 'Nurse',
    receptionist: t.aiRole_receptionist || 'Receptionist',
    staff: t.staff || 'Staff',
  };

  const choose = async (p) => {
    if (p.active) { setPractices(null); return; }   // already in it: just carry on
    setBusy(p.practiceId); setError('');
    try {
      await api.switchPractice(p.practiceId);
      broadcast({ type: 'practice-switched' });
      window.location.reload();
    } catch (e) {
      setError(e.message); setBusy('');
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="practice-chooser-h"
           className={`w-full max-w-md rounded-2xl border shadow-2xl p-6 ${dark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="practice-chooser-h" className={`text-xl font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>
              {fromSignIn ? (t.practiceChooseTitle || 'Which practice are you working in?') : (t.practiceSwitchTitle || 'Switch practice')}
            </h2>
            <p className={`mt-1 text-sm ${dark ? 'text-slate-400' : 'text-gray-600'}`}>
              You work at {practices.length} practices. You can switch later from your profile.
            </p>
          </div>
          <button type="button" onClick={() => !busy && setPractices(null)} aria-label="Close"
                  className={dark ? 'text-slate-400 hover:text-white' : 'text-gray-400 hover:text-gray-700'}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <ul className="mt-5 space-y-2" aria-label={t.practiceSwitchYourPractices || 'Your practices'}>
          {practices.map((p) => (
            <li key={p.practiceId}>
              <button type="button" onClick={() => choose(p)} disabled={Boolean(busy)} autoFocus={p.active}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors disabled:opacity-60 ${
                        p.active
                          ? (dark ? 'border-teal-500 bg-teal-500/10' : 'border-teal-600 bg-teal-50')
                          : (dark ? 'border-slate-700 hover:bg-slate-800' : 'border-gray-200 hover:bg-gray-50')}`}>
                <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${dark ? 'bg-slate-800' : 'bg-gray-100'}`}>
                  <Building2 className="w-5 h-5 text-teal-600" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block font-medium truncate ${dark ? 'text-white' : 'text-gray-900'}`}>{p.name}</span>
                  <span className={`block text-sm capitalize ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
                    {ROLE_LABELS[p.role] || p.role}{p.active ? ` · ${t.current || 'current'}` : ''}
                  </span>
                </span>
                {busy === p.practiceId ? <Loader2 className="w-5 h-5 animate-spin" /> : p.active ? <Check className="w-5 h-5 text-teal-500" /> : null}
              </button>
            </li>
          ))}
        </ul>
        {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}
      </div>
    </div>
  );
};

export default PracticeChooser;
