import React, { useEffect, useState, useCallback } from 'react';
import { Sparkles, X, Bot, AlertTriangle, Copy, Check, Eye, Pencil, ShieldCheck, ListPlus } from 'lucide-react';
import api from '../../api/apiService';
import { useOptionalApp } from '../../context/AppContext';
import { getTranslations } from '../../config/translations';
import { MarkdownView, toPlainText, extractCodes } from './markdown';

// "AI assist" button placed next to a field or screen.
//
//  * Hidden unless an admin switched the feature on (Integrations > AI Integrations).
//  * Never starts on its own: opening the dialog shows the text that WOULD be sent;
//    nothing goes to the AI until the user presses Generate.
//  * The draft is shown as formatted Markdown, with an Edit view.
//  * Human in the loop: the user accepts, edits or rejects the draft (clinical features
//    also need the sign-off box). Only an accepted draft reaches `onApply` (as plain text)
//    or `onApplyCodes` (only the codes the user ticks). The form is still saved as usual.

// Shared across every button on the page; refreshed at most once a minute. A failed load
// is not cached, so a slow first request cannot hide the buttons for a minute.
let featureCache = { at: 0, promise: null };
const FEATURE_TTL_MS = 60000;

function loadFeatures() {
  const now = Date.now();
  if (!featureCache.promise || now - featureCache.at > FEATURE_TTL_MS) {
    const promise = api.getAIFeatures().catch(() => {
      if (featureCache.promise === promise) featureCache = { at: 0, promise: null };
      return [];
    });
    featureCache = { at: now, promise };
  }
  return featureCache.promise;
}

/** Call after an admin changes a feature switch so open screens pick it up. */
export function invalidateAIFeatureCache() {
  featureCache = { at: 0, promise: null };
}

const fill = (s, vars) => String(s || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`));

/** Look a suggested code up in the practice's code list; returns the official row or null. */
async function verifyCode(code, type) {
  try {
    const rows = await api.searchMedicalCodes(code, type === 'cpt' ? 'cpt' : 'icd');
    return (rows || []).find((r) => String(r.code).toUpperCase() === code.toUpperCase()) || null;
  } catch {
    return null;
  }
}

const AIAssistButton = ({
  featureKey,
  theme,
  t = {},
  patientId = null,
  entityType = null,
  entityId = null,
  getInput,           // () => string: the context offered to the AI (user can edit it)
  onApply,            // (text) => void: receives the ACCEPTED text only
  applyTransform,     // (markdown) => string: what onApply receives; default = plain text
  onApplyCodes,       // ({icd, cpt}) => void: receives only the codes the user ticked
  label,              // English fallback for the button text
  labelKey,           // translation key for the button text
  className = '',
}) => {
  const dark = theme === 'dark';
  // Screens that do not pass `t` still get the user's language from the app context.
  const appCtx = useOptionalApp();
  const language = (appCtx && appCtx.language) || 'en';
  const tr = useCallback(
    (key, fallback) => (t && t[key]) || getTranslations(language)[key] || fallback,
    [t, language]
  );
  const [feature, setFeature] = useState(null);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState(null);       // response from /run
  const [text, setText] = useState('');           // editable draft text (Markdown)
  const [view, setView] = useState('formatted');  // 'formatted' | 'edit'
  const [attested, setAttested] = useState(false);
  const [reason, setReason] = useState('');
  const [done, setDone] = useState(null);         // { status, finalText }
  const [copied, setCopied] = useState(false);
  const [codes, setCodes] = useState([]);         // [{type, code, description, verified, official, checked}]
  const [codesAdded, setCodesAdded] = useState(0);

  useEffect(() => {
    let alive = true;
    loadFeatures().then((list) => {
      if (!alive) return;
      setFeature((list || []).find((f) => f.key === featureKey && f.is_enabled) || null);
    });
    return () => { alive = false; };
  }, [featureKey]);

  if (!feature) return null;

  const featureName = tr(`aiFeat_${featureKey}`, featureKey.replace(/_/g, ' '));
  const input_ = `w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${dark ? 'bg-slate-900 text-white border-slate-700' : 'bg-white text-gray-900 border-gray-300'}`;
  const panel = `w-full px-3 py-2 rounded-lg border max-h-[45vh] overflow-y-auto ${dark ? 'bg-slate-900 border-slate-700' : 'bg-gray-50 border-gray-300'}`;
  const muted = `text-xs ${dark ? 'text-slate-400' : 'text-gray-500'}`;
  const btn = 'px-3 py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const btnPrimary = `${btn} bg-indigo-500 hover:bg-indigo-600 text-white`;
  const btnSecondary = `${btn} ${dark ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`;

  const openDialog = () => {
    // Prefill only — nothing is sent yet.
    setInput(typeof getInput === 'function' ? String(getInput() || '') : '');
    setDraft(null); setText(''); setView('formatted'); setAttested(false); setReason('');
    setDone(null); setError(null); setCopied(false); setCodes([]); setCodesAdded(0);
    setOpen(true);
  };

  const generate = async () => {
    setBusy(true); setError(null);
    try {
      const res = await api.runAIFeature(featureKey, {
        input, patientId: patientId || undefined, entityType: entityType || undefined, entityId: entityId || undefined,
      });
      setDraft(res);
      setText(res.draft || '');
      setView('formatted');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  /** After acceptance: list the codes in the approved text, checked against the code list. */
  const prepareCodes = async (finalText) => {
    const found = extractCodes(finalText);
    const list = [
      ...found.icd.map((c) => ({ ...c, type: 'icd' })),
      ...found.cpt.map((c) => ({ ...c, type: 'cpt' })),
    ];
    if (!list.length) return;
    const checked = await Promise.all(list.map(async (c) => {
      const official = await verifyCode(c.code, c.type);
      // Only codes found in the practice's code list are ticked by default.
      return { ...c, official, verified: !!official, checked: !!official };
    }));
    setCodes(checked);
  };

  const review = async (action) => {
    setBusy(true); setError(null);
    try {
      const res = await api.reviewAISuggestion(draft.id, {
        action: action === 'accept' && text !== draft.draft ? 'edit' : action,
        finalText: text,
        reason,
        attested,
      });
      if (res.status !== 'rejected') {
        if (typeof onApply === 'function') {
          const value = typeof applyTransform === 'function' ? applyTransform(res.finalText) : toPlainText(res.finalText);
          if (value) onApply(value);
        }
        // Check codes before showing the outcome, so "no codes" never flashes.
        if (typeof onApplyCodes === 'function') await prepareCodes(res.finalText || '');
      }
      setDone(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const addCodes = () => {
    const pickRow = (c) => ({
      code: c.official ? c.official.code : c.code,
      description: (c.official && c.official.description) || c.description || '',
      type: c.type === 'cpt' ? 'CPT' : 'ICD-10',
    });
    const chosen = codes.filter((c) => c.checked);
    onApplyCodes({
      icd: chosen.filter((c) => c.type === 'icd').map(pickRow),
      cpt: chosen.filter((c) => c.type === 'cpt').map(pickRow),
    });
    setCodesAdded(chosen.length);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(done?.finalText || text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };

  const hasUnknownTokens = /\[\[[A-Z_]+_\d+\]\]/.test(text);
  const canEdit = draft && draft.canReview && !done;

  const ViewToggle = () => (
    <div className="inline-flex rounded-lg overflow-hidden border border-current/20 text-xs" role="tablist">
      {[['formatted', Eye, tr('aiViewFormatted', 'Formatted')], ['edit', Pencil, tr('aiViewEdit', 'Edit')]].map(([v, Icon, lbl]) => (
        <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
          disabled={v === 'edit' && !canEdit}
          className={`px-2.5 py-1 flex items-center gap-1 disabled:opacity-40 ${view === v ? 'bg-indigo-500 text-white' : ''}`}>
          <Icon className="w-3.5 h-3.5" />{lbl}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <button type="button" onClick={openDialog}
        title={fill(tr('aiAssistTitle', 'AI assist: {feature}'), { feature: featureName })}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-colors ${dark
          ? 'border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10'
          : 'border-indigo-300 text-indigo-600 hover:bg-indigo-50'} ${className}`}>
        <Sparkles className="w-3.5 h-3.5" />{labelKey ? tr(labelKey, label || 'AI assist') : (label || tr('aiAssist', 'AI assist'))}
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" role="dialog" aria-modal="true"
          aria-label={featureName} onClick={(e) => { if (e.target === e.currentTarget && !busy) setOpen(false); }}>
          <div className={`w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 space-y-4 ${dark ? 'bg-slate-900 text-white' : 'bg-white text-gray-900'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold">{featureName}</h3>
              </div>
              <button type="button" aria-label={tr('aiClose', 'Close')} disabled={busy} onClick={() => setOpen(false)}
                className={`p-1 rounded ${dark ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div role="alert" className="p-3 rounded-lg bg-red-500/10 text-red-400 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
              </div>
            )}

            {/* Step 1: what will be sent. Nothing has been sent yet. */}
            {!draft && (
              <>
                <p className={muted}>{tr('aiAssistNoAutostart', 'Nothing is sent until you press Generate. Patient identifiers are replaced with placeholders first.')}</p>
                <div>
                  <label className={`block text-xs font-medium mb-1 ${dark ? 'text-slate-400' : 'text-gray-600'}`} htmlFor={`ai-assist-in-${featureKey}`}>
                    {tr('aiInputText', 'Text for the AI to work on')}
                  </label>
                  <textarea id={`ai-assist-in-${featureKey}`} rows={8} className={`${input_} font-mono`} value={input}
                    onChange={(e) => setInput(e.target.value)} placeholder={tr('aiAssistInputHint', 'Paste or type the text the AI should use')} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={btnPrimary} disabled={busy || !input.trim()} onClick={generate}>
                    <Sparkles className="w-4 h-4" />{busy ? tr('aiGenerating', 'Generating...') : tr('aiGenerate', 'Generate draft')}
                  </button>
                  <button type="button" className={btnSecondary} disabled={busy} onClick={() => setOpen(false)}>{tr('aiCancel', 'Cancel')}</button>
                </div>
              </>
            )}

            {/* Step 2: review the draft. */}
            {draft && !done && (
              <>
                <div className="flex items-start gap-2 p-2 rounded bg-indigo-500/10 text-indigo-400 text-xs">
                  <Bot className="w-4 h-4 shrink-0" />{tr('aiDraftBanner', 'AI-generated draft. Check every fact before you accept it.')}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={muted}>
                    {Number(draft.phiTokensCount || 0) > 0
                      ? fill(tr('aiPhiAnonymizedCount', '{n} patient identifier(s) were anonymized before sending'), { n: draft.phiTokensCount })
                      : tr('aiNoPhiDetected', 'No patient identifiers detected')}
                  </p>
                  <ViewToggle />
                </div>
                {hasUnknownTokens && (
                  <div className="flex items-start gap-2 p-2 rounded bg-amber-500/10 text-amber-500 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />{tr('aiUnknownTokens', 'The draft contains placeholders that could not be matched. Replace them before accepting.')}
                  </div>
                )}
                {view === 'formatted' || !draft.canReview ? (
                  <div className={panel} data-testid="ai-draft-formatted"><MarkdownView text={text} /></div>
                ) : (
                  <textarea aria-label={tr('aiDraftText', 'Draft text')} rows={12} className={`${input_} font-mono`} value={text}
                    onChange={(e) => setText(e.target.value)} />
                )}

                {draft.canReview ? (
                  <>
                    {draft.attestationRequired && (
                      <label className="flex items-start gap-2">
                        <input type="checkbox" className="mt-0.5 rounded" checked={attested} onChange={(e) => setAttested(e.target.checked)} />
                        <span className="text-sm">{tr('aiAttestText', 'I reviewed this draft and take responsibility for its content.')}</span>
                      </label>
                    )}
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${dark ? 'text-slate-400' : 'text-gray-600'}`} htmlFor={`ai-assist-reason-${featureKey}`}>
                        {tr('aiRejectReason', 'Reason (required to reject)')}
                      </label>
                      <input id={`ai-assist-reason-${featureKey}`} className={input_} value={reason} onChange={(e) => setReason(e.target.value)} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={btnPrimary} disabled={busy || (draft.attestationRequired && !attested)} onClick={() => review('accept')}>
                        {onApply
                          ? (text !== draft.draft ? tr('aiAcceptEditedInsert', 'Save edits & insert') : tr('aiAcceptInsert', 'Accept & insert'))
                          : (text !== draft.draft ? tr('aiAcceptEdited', 'Save edits & accept') : tr('aiAccept', 'Accept'))}
                      </button>
                      <button type="button" className={btnSecondary} disabled={busy || !reason.trim()} onClick={() => review('reject')}>
                        {tr('aiReject', 'Reject')}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className={muted}>{tr('aiSentToQueue', 'You cannot approve this type of draft. It is waiting in the Review queue for a reviewer with the right role.')}</p>
                )}
              </>
            )}

            {/* Step 3: outcome, and optional transfer of codes. */}
            {done && (
              <div className="space-y-3">
                {done.status === 'rejected' ? (
                  <p className="text-sm">{tr('aiDraftRejected', 'Draft rejected. Nothing was changed.')}</p>
                ) : (
                  <>
                    {onApply ? (
                      <p className="text-sm text-green-500">{tr('aiInsertedSaveReminder', 'Inserted into the form. Review it and save the form as usual.')}</p>
                    ) : (
                      <p className="text-sm text-green-500">{tr('aiAcceptedCopyHint', 'Accepted. Copy the text to use it.')}</p>
                    )}
                    {!onApply && (
                      <>
                        <div className={panel}><MarkdownView text={done.finalText || ''} /></div>
                        <button type="button" className={btnSecondary} onClick={copy}>
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? tr('aiCopied', 'Copied') : tr('aiCopy', 'Copy')}
                        </button>
                      </>
                    )}

                    {onApplyCodes && codes.length > 0 && (
                      <div className={`rounded-lg border p-3 space-y-2 ${dark ? 'border-slate-700' : 'border-gray-300'}`}>
                        <div className="flex items-center gap-2 font-medium text-sm"><ListPlus className="w-4 h-4 text-indigo-400" />{tr('aiTransferCodesTitle', 'Add suggested codes to the form')}</div>
                        <p className={muted}>{tr('aiTransferCodesHint', 'Codes found in your code list are ticked. Codes not found are left unticked — check them before adding.')}</p>
                        <ul className="space-y-1">
                          {codes.map((c, idx) => (
                            <li key={`${c.type}-${c.code}`}>
                              <label className="flex items-start gap-2 text-sm">
                                <input type="checkbox" className="mt-0.5 rounded" checked={c.checked} disabled={codesAdded > 0}
                                  onChange={(e) => setCodes((list) => list.map((x, i) => (i === idx ? { ...x, checked: e.target.checked } : x)))} />
                                <span className="min-w-0">
                                  <span className="font-mono font-semibold">{c.code}</span>
                                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${c.type === 'cpt' ? 'bg-sky-500/20 text-sky-500' : 'bg-violet-500/20 text-violet-500'}`}>{c.type === 'cpt' ? 'CPT' : 'ICD-10'}</span>
                                  <span className="ml-2">{(c.official && c.official.description) || c.description}</span>
                                  <span className={`block text-xs ${c.verified ? 'text-green-500' : 'text-amber-500'}`}>
                                    {c.verified
                                      ? <><ShieldCheck className="inline w-3 h-3 mr-1" />{tr('aiCodeVerified', 'Found in your code list')}</>
                                      : <><AlertTriangle className="inline w-3 h-3 mr-1" />{tr('aiCodeNotFound', 'Not found in your code list')}</>}
                                  </span>
                                </span>
                              </label>
                            </li>
                          ))}
                        </ul>
                        {codesAdded > 0 ? (
                          <p className="text-sm text-green-500">{fill(tr('aiCodesAdded', '{n} code(s) added to the form. Save the form as usual.'), { n: codesAdded })}</p>
                        ) : (
                          <button type="button" className={btnPrimary} disabled={!codes.some((c) => c.checked)} onClick={addCodes}>
                            <ListPlus className="w-4 h-4" />{tr('aiAddSelectedCodes', 'Add selected codes to ICD-10 / CPT fields')}
                          </button>
                        )}
                      </div>
                    )}
                    {onApplyCodes && codes.length === 0 && (
                      <p className={muted}>{tr('aiNoCodesFound', 'No ICD-10 or CPT codes were found in the draft.')}</p>
                    )}
                  </>
                )}
                <button type="button" className={btnPrimary} onClick={() => setOpen(false)}>{tr('aiClose', 'Close')}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default AIAssistButton;
