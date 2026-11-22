import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import ClaimScrubPanel from './ClaimScrubPanel';

/**
 * Shows a claim check and the next step:
 *   - claim form: "Save claim" (always allowed — errors only block SUBMITTING)
 *   - submit:     "Submit" when there are no errors; with errors, an admin or billing manager may
 *                 override with a reason (kept on the claim), everyone else fixes the claim first.
 */
const ClaimCheckDialog = ({
  theme, isOpen, loading, scrub, title = 'Claim check', confirmLabel = 'Continue', onConfirm, onClose,
  blockOnErrors = false, canOverride = false, onOverride, note,
}) => {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  if (!isOpen) return null;
  const dark = theme === 'dark';
  const failed = scrub && scrub.status === 'failed';
  const blocked = blockOnErrors && failed;
  const go = async (fn) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };

  return (
    <div className={`fixed inset-0 z-[60] flex items-center justify-center p-4 ${dark ? 'bg-black/60' : 'bg-black/30'}`} role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className={`w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl border ${dark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`} onClick={(e) => e.stopPropagation()}>
        <div className={`flex items-center justify-between p-5 border-b ${dark ? 'border-slate-700' : 'border-gray-200'}`}>
          <h2 className={`text-xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className={`p-2 rounded-lg ${dark ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[calc(90vh-150px)] space-y-4">
          {loading ? (
            <div className={`flex items-center gap-2 ${dark ? 'text-slate-300' : 'text-gray-700'}`}><Loader2 className="w-5 h-5 animate-spin text-cyan-500" />Checking the claim…</div>
          ) : <ClaimScrubPanel theme={theme} scrub={scrub} />}
          {note && !loading ? <p className={`text-sm ${dark ? 'text-slate-400' : 'text-gray-600'}`}>{note}</p> : null}
          {blocked && canOverride && !loading ? (
            <div className={`rounded-md border p-3 ${dark ? 'border-slate-600' : 'border-gray-200'}`}>
              <label htmlFor="scrub-override" className={`block text-sm font-medium ${dark ? 'text-slate-200' : 'text-gray-800'}`}>Override and submit anyway</label>
              <p className={`text-xs mt-0.5 ${dark ? 'text-slate-400' : 'text-gray-600'}`}>Only when you know the payer will accept it (e.g. confirmed by phone). Your name and reason are kept with the claim.</p>
              <textarea id="scrub-override" value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
                placeholder="Reason (at least 10 characters)"
                className={`mt-2 w-full rounded-md border p-2 text-sm ${dark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300'}`} />
            </div>
          ) : null}
        </div>
        <div className={`flex flex-wrap gap-3 justify-end p-5 border-t ${dark ? 'border-slate-700' : 'border-gray-200'}`}>
          <button type="button" onClick={onClose} className={`px-5 py-2.5 rounded-lg font-medium ${dark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}>
            {blocked ? 'Back to the claim' : 'Cancel'}
          </button>
          {blocked && canOverride ? (
            <button type="button" disabled={loading || busy || reason.trim().length < 10} onClick={() => go(() => onOverride(reason.trim()))}
              className="px-5 py-2.5 rounded-lg font-medium bg-red-600 hover:bg-red-700 text-white disabled:opacity-50">
              {busy ? 'Working…' : 'Override and submit'}
            </button>
          ) : null}
          {!blocked ? (
            <button type="button" disabled={loading || busy || !scrub} onClick={() => go(onConfirm)}
              className="px-5 py-2.5 rounded-lg font-medium bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white disabled:opacity-50">
              {busy ? 'Working…' : confirmLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ClaimCheckDialog;
