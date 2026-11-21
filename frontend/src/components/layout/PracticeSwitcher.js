import React, { useEffect, useRef, useState } from 'react';
import { Building2, ChevronDown, Check, Loader2 } from 'lucide-react';
import api from '../../api/apiService';
import { broadcast } from '../../utils/sessionTab';
import { getTranslations } from '../../config/translations';
import { useOptionalApp } from '../../context/AppContext';

const useT = () => getTranslations(useOptionalApp()?.language || 'en');

/**
 * Phase 1: for people who work at more than one practice — shows the practice this session
 * is in and switches to another. A switch starts a new session for that practice (its role,
 * data and two-factor rule), so the page reloads, and other open tabs follow.
 * Renders nothing for anyone with a single practice.
 */
const PracticeSwitcher = ({ theme }) => {
  const t = useT();
  const dark = theme === 'dark';
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const ref = useRef(null);

  useEffect(() => { api.getMyPractices().then(setData).catch(() => setData(null)); }, []);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (!data || !data.practices || data.practices.length < 2) return null;
  const current = data.practices.find((p) => p.active) || data.practices[0];
  // Role labels; other roles show as they come from the API.
  const ROLE_LABELS = {
    admin: t.admin || 'Admin',
    doctor: t.doctor || 'Doctor',
    nurse: t.aiRole_nurse || 'Nurse',
    receptionist: t.aiRole_receptionist || 'Receptionist',
    staff: t.staff || 'Staff',
  };

  const choose = async (p) => {
    if (p.active) { setOpen(false); return; }
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
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}
              title={t.practiceSwitchTitle || 'Switch practice'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm border transition-colors max-w-[220px] ${
                dark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-gray-200 text-gray-700 hover:bg-gray-100'}`}>
        <Building2 className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{current.name}</span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      </button>
      {open && (
        <div className={`absolute right-0 mt-2 w-72 rounded-xl border shadow-xl z-50 p-1 ${dark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
          <div className={`px-3 py-2 text-xs ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{t.practiceSwitchYourPractices || 'Your practices'}</div>
          <ul role="listbox" aria-label={t.practiceSwitchYourPractices || 'Your practices'}>
            {data.practices.map((p) => (
              <li key={p.practiceId} role="option" aria-selected={p.active}>
                <button type="button" onClick={() => choose(p)} disabled={Boolean(busy)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-sm ${
                          dark ? 'hover:bg-slate-800 text-slate-100' : 'hover:bg-gray-100 text-gray-900'} disabled:opacity-60`}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className={`block text-xs capitalize ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{ROLE_LABELS[p.role] || p.role}</span>
                  </span>
                  {busy === p.practiceId ? <Loader2 className="w-4 h-4 animate-spin" /> : p.active ? <Check className="w-4 h-4 text-teal-500" /> : null}
                </button>
              </li>
            ))}
          </ul>
          {error && <p role="alert" className="px-3 py-2 text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  );
};

export default PracticeSwitcher;
