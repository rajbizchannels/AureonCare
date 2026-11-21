import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { TOAST_EVENT } from '../../utils/toast';
import { useOptionalApp } from '../../context/AppContext';

const ERROR = new Set(['alert', 'error', 'danger', 'failure']);
const WARN = new Set(['warning', 'warn']);
const OK = new Set(['success', 'appointment', 'payment', 'claim']);

const kindOf = (type) => (ERROR.has(type) ? 'error' : WARN.has(type) ? 'warning' : OK.has(type) ? 'success' : 'info');
const STYLE = {
  success: { icon: CheckCircle2, bar: 'border-l-teal-500', iconCls: 'text-teal-500' },
  error: { icon: XCircle, bar: 'border-l-red-500', iconCls: 'text-red-500' },
  warning: { icon: AlertTriangle, bar: 'border-l-amber-500', iconCls: 'text-amber-500' },
  info: { icon: Info, bar: 'border-l-sky-500', iconCls: 'text-sky-500' },
};

/**
 * Renders toasts raised by showToast() / addNotification(). Mounted once at the app root,
 * outside <App />, so it exists on the sign-in screens too.
 * Errors stay 8 s, everything else 5 s; the close button dismisses one at once.
 * Errors are announced assertively to screen readers, the rest politely.
 */
const Toaster = () => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  useEffect(() => {
    const onToast = (e) => {
      const { type, message, duration } = e.detail || {};
      if (!message) return;
      const kind = kindOf(type);
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => {
        // The same message twice in a row (a double click, a retry) shows once.
        const rest = prev.filter((t) => t.message !== message);
        return [...rest, { id, kind, message }].slice(-4);
      });
      timers.current.set(id, setTimeout(() => dismiss(id), duration || (kind === 'error' ? 8000 : 5000)));
    };
    window.addEventListener(TOAST_EVENT, onToast);
    const all = timers.current;
    return () => { window.removeEventListener(TOAST_EVENT, onToast); all.forEach(clearTimeout); all.clear(); };
  }, [dismiss]);

  const dark = useOptionalApp()?.theme === 'dark';
  const errors = toasts.filter((t) => t.kind === 'error');
  const others = toasts.filter((t) => t.kind !== 'error');

  const render = (t) => {
    const s = STYLE[t.kind]; const Icon = s.icon;
    return (
      <div key={t.id} data-testid="toast" data-kind={t.kind}
           className={`pointer-events-auto flex items-start gap-3 w-full rounded-lg border border-l-4 ${s.bar} shadow-lg px-4 py-3 text-sm
             ${dark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-gray-200 text-gray-900'}`}>
        <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${s.iconCls}`} aria-hidden="true" />
        <div className="flex-1 min-w-0 break-words">{t.message}</div>
        <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss"
                className={`shrink-0 rounded p-0.5 ${dark ? 'text-slate-400 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}>
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="fixed z-[100] top-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-96 flex flex-col gap-2 pointer-events-none">
      <div role="alert" aria-live="assertive" className="flex flex-col gap-2">{errors.map(render)}</div>
      <div role="status" aria-live="polite" className="flex flex-col gap-2">{others.map(render)}</div>
    </div>
  );
};

export default Toaster;
