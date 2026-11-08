import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Sparkles, X, Bot, AlertTriangle, Copy, Check, Eye, Pencil, ShieldCheck, ListPlus, FileInput, Pill, Microscope } from 'lucide-react';
import api from '../../api/apiService';
import { useOptionalApp } from '../../context/AppContext';
import { getTranslations } from '../../config/translations';
import { MarkdownView, toPlainText, extractCodes, extractMedications, extractLabTests } from './markdown';

// "AI assist" button placed next to a field or screen.
//
//  * Hidden unless an admin switched the feature on (Integrations > AI Integrations).
//  * Never starts on its own: opening the dialog shows the text that WOULD be sent;
//    nothing goes to the AI until the user presses Generate.
//  * The draft is shown as formatted Markdown, with an Edit view.
//  * The actions sit on the draft itself:
//      - "Update SOAP text" / "Accept & insert"  -> onApply (plain text)
//      - "Add selected codes"                    -> onApplyCodes (only the ticked codes)
//    The first action a reviewer takes records their acceptance (with the sign-off box for
//    clinical features); after that the text is locked and the other action can still be
//    used. The form is saved as usual — nothing here saves a record.

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

/** Find a suggested medication in the drug list (ePrescribe needs a real entry). */
async function matchMedication(med) {
  try {
    const rows = await api.searchMedications(med.name, null, null, 20);
    if (!Array.isArray(rows) || !rows.length) return null;
    const name = med.name.toLowerCase();
    const named = rows.filter((r) => [r.drug_name, r.brand_name, r.generic_name]
      .some((n) => n && String(n).toLowerCase().startsWith(name)));
    const pool = named.length ? named : [];
    const num = (med.strength || '').match(/\d+(?:\.\d+)?/);
    return (num && pool.find((r) => String(r.strength || '').includes(num[0]))) || pool[0] || null;
  } catch {
    return null;
  }
}

/** Find a lab test's CPT code: by the code the AI gave, else by the test name (80000-89999). */
async function matchLabTest(test) {
  const isLab = (r) => { const n = parseInt(r.code, 10); return n >= 80000 && n <= 89999; };
  try {
    if (test.cpt) {
      const rows = await api.searchMedicalCodes(test.cpt, 'cpt');
      const hit = (rows || []).find((r) => String(r.code) === test.cpt);
      if (hit) return { match: hit, matchedBy: 'code' };
    }
    const rows = await api.searchMedicalCodes(test.name, 'cpt');
    const hit = (rows || []).filter(isLab)[0];
    return hit ? { match: hit, matchedBy: 'name' } : { match: null, matchedBy: null };
  } catch {
    return { match: null, matchedBy: null };
  }
}

/** A checkable list of AI suggestions with one "add" button. */
const TransferPanel = ({ dark, icon: Icon, title, testId, hint, items, checking, checkingText, emptyText, onToggle,
  addedCount, addedText, buttonLabel, disabled, onAdd, muted, btnPrimary }) => (
  <div className={`rounded-lg border p-3 space-y-2 ${dark ? 'border-slate-700' : 'border-gray-300'}`} data-testid={testId}>
    <div className="flex items-center gap-2 font-medium text-sm"><Icon className="w-4 h-4 text-indigo-400" />{title}</div>
    {checking && items.length === 0 ? (
      <p className={muted}>{checkingText}</p>
    ) : items.length === 0 ? (
      <p className={muted}>{emptyText}</p>
    ) : (
      <>
        {hint && <p className={muted}>{hint}</p>}
        <ul className="space-y-1">
          {items.map((it, idx) => (
            <li key={it.key}>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 rounded" checked={it.checked} disabled={addedCount > 0}
                  aria-label={it.ariaLabel} onChange={(e) => onToggle(idx, e.target.checked)} />
                <span className="min-w-0">
                  {it.content}
                  <span className={`block text-xs ${it.verified ? 'text-green-500' : 'text-amber-500'}`}>
                    {it.verified ? <ShieldCheck className="inline w-3 h-3 mr-1" /> : <AlertTriangle className="inline w-3 h-3 mr-1" />}
                    {it.status}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {addedCount > 0 ? (
          <p className="text-sm text-green-500">{addedText}</p>
        ) : (
          <button type="button" className={btnPrimary} disabled={disabled || !items.some((it) => it.checked)} onClick={onAdd}>
            <Icon className="w-4 h-4" />{buttonLabel}
          </button>
        )}
      </>
    )}
  </div>
);

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
  applyLabelKey,      // translation key for the insert button (e.g. "Update SOAP text")
  applyLabel,         // English fallback for the insert button
  onApplyCodes,       // ({icd, cpt}) => void: receives only the codes the user ticked
  onApplyMedications, // ([{name, strength, instructions, match}]) => void: ticked medications
  onApplyLabTests,    // ([{name, cpt, match}]) => void: ticked lab tests
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
  const [accepted, setAccepted] = useState(null); // review result once accepted
  const [rejected, setRejected] = useState(false);
  const [applied, setApplied] = useState(false);  // text inserted into the form
  const [copied, setCopied] = useState(false);
  const [codes, setCodes] = useState([]);         // [{type, code, description, verified, official, checked}]
  const [checkingCodes, setCheckingCodes] = useState(false);
  const [codesAdded, setCodesAdded] = useState(0);
  const [meds, setMeds] = useState([]);           // [{name, strength, instructions, match, verified, checked}]
  const [medsAdded, setMedsAdded] = useState(0);
  const [labs, setLabs] = useState([]);           // [{name, cpt, match, matchedBy, verified, checked}]
  const [labsAdded, setLabsAdded] = useState(0);
  const verifyRun = useRef(0);

  useEffect(() => {
    let alive = true;
    loadFeatures().then((list) => {
      if (!alive) return;
      setFeature((list || []).find((f) => f.key === featureKey && f.is_enabled) || null);
    });
    return () => { alive = false; };
  }, [featureKey]);

  // List the codes in the draft as soon as it arrives (and again after edits), each
  // checked against the practice's code list. Only found codes are pre-ticked; a choice
  // the user already made for a code is kept.
  useEffect(() => {
    if ((!onApplyCodes && !onApplyMedications && !onApplyLabTests) || !draft || accepted || rejected) return undefined;
    const run = ++verifyRun.current;
    const keep = (prev, key, fallback) => { const b = prev.find((p) => p.key === key); return b ? b.checked : fallback; };
    const timer = setTimeout(async () => {
      setCheckingCodes(true);
      if (onApplyMedications) {
        const found = await Promise.all(extractMedications(text).map(async (m) => ({ ...m, match: await matchMedication(m) })));
        if (run !== verifyRun.current) return;
        setMeds((prev) => found.map((m) => {
          const key = m.name.toLowerCase();
          return { ...m, key, verified: !!m.match, checked: keep(prev, key, !!m.match) };
        }));
      }
      if (onApplyLabTests) {
        const found = await Promise.all(extractLabTests(text).map(async (l) => ({ ...l, ...(await matchLabTest(l)) })));
        if (run !== verifyRun.current) return;
        setLabs((prev) => found.map((l) => {
          const key = (l.cpt || l.name).toLowerCase();
          return { ...l, key, verified: !!l.match, checked: keep(prev, key, l.matchedBy === 'code') };
        }));
      }
      if (!onApplyCodes) { setCheckingCodes(false); return; }
      const found = extractCodes(text);
      const list = [
        ...found.icd.map((c) => ({ ...c, type: 'icd' })),
        ...found.cpt.map((c) => ({ ...c, type: 'cpt' })),
      ];
      const rows = await Promise.all(list.map(async (c) => ({ ...c, official: await verifyCode(c.code, c.type) })));
      if (run !== verifyRun.current) return;
      setCodes((prev) => rows.map((c) => {
        const before = prev.find((p) => p.type === c.type && p.code === c.code);
        return { ...c, verified: !!c.official, checked: before ? before.checked : !!c.official };
      }));
      setCheckingCodes(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [text, draft, accepted, rejected, onApplyCodes, onApplyMedications, onApplyLabTests]);

  if (!feature) return null;

  const featureName = tr(`aiFeat_${featureKey}`, featureKey.replace(/_/g, ' '));
  const input_ = `w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${dark ? 'bg-slate-900 text-white border-slate-700' : 'bg-white text-gray-900 border-gray-300'}`;
  const panel = `w-full px-3 py-2 rounded-lg border max-h-[40vh] overflow-y-auto ${dark ? 'bg-slate-900 border-slate-700' : 'bg-gray-50 border-gray-300'}`;
  const muted = `text-xs ${dark ? 'text-slate-400' : 'text-gray-500'}`;
  const btn = 'px-3 py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const btnPrimary = `${btn} bg-indigo-500 hover:bg-indigo-600 text-white`;
  const btnSecondary = `${btn} ${dark ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`;

  const openDialog = () => {
    // Prefill only — nothing is sent yet.
    setInput(typeof getInput === 'function' ? String(getInput() || '') : '');
    setDraft(null); setText(''); setView('formatted'); setAttested(false); setReason('');
    setAccepted(null); setRejected(false); setApplied(false); setError(null); setCopied(false);
    setCodes([]); setCodesAdded(0); setCheckingCodes(false);
    setMeds([]); setMedsAdded(0); setLabs([]); setLabsAdded(0);
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

  /** Record the reviewer's acceptance once; later actions reuse it. */
  const ensureAccepted = async () => {
    if (accepted) return accepted;
    const res = await api.reviewAISuggestion(draft.id, {
      action: text !== draft.draft ? 'edit' : 'accept',
      finalText: text,
      attested,
    });
    setAccepted(res);
    setView('formatted');
    return res;
  };

  const act = async (fn) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const applyText = () => act(async () => {
    const res = await ensureAccepted();
    const value = typeof applyTransform === 'function' ? applyTransform(res.finalText) : toPlainText(res.finalText);
    if (value) onApply(value);
    setApplied(true);
  });

  const addCodes = () => act(async () => {
    await ensureAccepted();
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
  });

  const addMeds = () => act(async () => {
    await ensureAccepted();
    const chosen = meds.filter((m) => m.checked);
    onApplyMedications(chosen.map(({ name, strength, instructions, match }) => ({ name, strength, instructions, match })));
    setMedsAdded(chosen.length);
  });

  const addLabs = () => act(async () => {
    await ensureAccepted();
    const chosen = labs.filter((l) => l.checked);
    onApplyLabTests(chosen.map(({ name, cpt, match }) => ({ name, cpt, match })));
    setLabsAdded(chosen.length);
  });

  const acceptOnly = () => act(async () => { await ensureAccepted(); });

  const reject = () => act(async () => {
    await api.reviewAISuggestion(draft.id, { action: 'reject', reason });
    setRejected(true);
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText((accepted && accepted.finalText) || text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };

  const hasUnknownTokens = /\[\[[A-Z_]+_\d+\]\]/.test(text);
  const canEdit = draft && draft.canReview && !accepted && !rejected;
  const signOffMissing = draft && draft.attestationRequired && !attested && !accepted;
  const hasActions = !!onApply || !!onApplyCodes || !!onApplyMedications || !!onApplyLabTests;

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

  const applyButtonLabel = applyLabelKey
    ? tr(applyLabelKey, applyLabel || 'Accept & insert')
    : (applyLabel || tr('aiAcceptInsert', 'Accept & insert'));

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

            {/* Rejected: nothing changes. */}
            {draft && rejected && (
              <div className="space-y-3">
                <p className="text-sm">{tr('aiDraftRejected', 'Draft rejected. Nothing was changed.')}</p>
                <button type="button" className={btnPrimary} onClick={() => setOpen(false)}>{tr('aiClose', 'Close')}</button>
              </div>
            )}

            {/* Step 2: the draft, with its actions. */}
            {draft && !rejected && (
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
                {view === 'edit' && canEdit ? (
                  <textarea aria-label={tr('aiDraftText', 'Draft text')} rows={12} className={`${input_} font-mono`} value={text}
                    onChange={(e) => setText(e.target.value)} />
                ) : (
                  <div className={panel} data-testid="ai-draft-formatted"><MarkdownView text={text} /></div>
                )}

                {!draft.canReview && (
                  <p className={muted}>{tr('aiSentToQueue', 'You cannot approve this type of draft. It is waiting in the Review queue for a reviewer with the right role.')}</p>
                )}

                {draft.canReview && (
                  <>
                    {draft.attestationRequired && !accepted && (
                      <label className="flex items-start gap-2">
                        <input type="checkbox" className="mt-0.5 rounded" checked={attested} onChange={(e) => setAttested(e.target.checked)} />
                        <span className="text-sm">{tr('aiAttestText', 'I reviewed this draft and take responsibility for its content.')}</span>
                      </label>
                    )}
                    {accepted && (
                      <p className="text-xs text-green-500 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" />{tr('aiAcceptedLocked', 'Accepted. The text is locked; you can still use the actions below.')}</p>
                    )}

                    {/* Codes in the draft, ready to add to the form. */}
                    {onApplyCodes && (
                      <div className={`rounded-lg border p-3 space-y-2 ${dark ? 'border-slate-700' : 'border-gray-300'}`} data-testid="ai-code-transfer">
                        <div className="flex items-center gap-2 font-medium text-sm"><ListPlus className="w-4 h-4 text-indigo-400" />{tr('aiTransferCodesTitle', 'Add suggested codes to the form')}</div>
                        {checkingCodes && codes.length === 0 ? (
                          <p className={muted}>{tr('aiCheckingCodes', 'Checking codes against your code list...')}</p>
                        ) : codes.length === 0 ? (
                          <p className={muted}>{tr('aiNoCodesFound', 'No ICD-10 or CPT codes were found in the draft.')}</p>
                        ) : (
                          <>
                            <p className={muted}>{tr('aiTransferCodesHint', 'Codes found in your code list are ticked. Codes not found are left unticked — check them before adding.')}</p>
                            <ul className="space-y-1">
                              {codes.map((c, idx) => (
                                <li key={`${c.type}-${c.code}`}>
                                  <label className="flex items-start gap-2 text-sm">
                                    <input type="checkbox" className="mt-0.5 rounded" checked={c.checked} disabled={codesAdded > 0}
                                      aria-label={`${c.code} ${c.type === 'cpt' ? 'CPT' : 'ICD-10'}`}
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
                              <button type="button" className={btnPrimary} disabled={busy || signOffMissing || !codes.some((c) => c.checked)} onClick={addCodes}>
                                <ListPlus className="w-4 h-4" />{tr('aiAddSelectedCodes', 'Add selected codes to ICD-10 / CPT fields')}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Medications -> Prescriptions. ePrescribe opens prefilled from the form. */}
                    {onApplyMedications && (
                      <TransferPanel dark={dark} icon={Pill} testId="ai-med-transfer" muted={muted} btnPrimary={btnPrimary}
                        title={tr('aiTransferMedsTitle', 'Send medications to Prescriptions')}
                        hint={tr('aiTransferMedsHint', 'Medications found in your drug list are ticked. Each one opens in ePrescribe for you to complete and check.')}
                        checking={checkingCodes} checkingText={tr('aiCheckingCodes', 'Checking codes against your code list...')}
                        emptyText={tr('aiNoMedsFound', 'No medications were found in the draft.')}
                        items={meds.map((m) => ({
                          key: m.key, checked: m.checked, verified: m.verified, ariaLabel: m.name,
                          content: <><span className="font-semibold">{m.name}</span>{m.strength ? ` ${m.strength}` : ''}{m.instructions ? <span className={muted}> — {m.instructions}</span> : null}</>,
                          status: m.verified
                            ? fill(tr('aiMedFound', 'Found in drug list: {drug}'), { drug: [m.match.drug_name || m.match.brand_name, m.match.strength].filter(Boolean).join(' ') })
                            : tr('aiMedNotFound', 'Not found in your drug list — search for it in ePrescribe'),
                        }))}
                        onToggle={(idx, v) => setMeds((list) => list.map((x, i) => (i === idx ? { ...x, checked: v } : x)))}
                        addedCount={medsAdded}
                        addedText={fill(tr('aiMedsAdded', '{n} medication(s) sent to Prescriptions. Open each one to prescribe.'), { n: medsAdded })}
                        buttonLabel={tr('aiAddSelectedMeds', 'Send selected to Prescriptions')}
                        disabled={busy || signOffMissing} onAdd={addMeds} />
                    )}

                    {/* Lab tests -> Lab Orders. */}
                    {onApplyLabTests && (
                      <TransferPanel dark={dark} icon={Microscope} testId="ai-lab-transfer" muted={muted} btnPrimary={btnPrimary}
                        title={tr('aiTransferLabsTitle', 'Add tests to Lab Orders')}
                        hint={tr('aiTransferLabsHint', 'Tests matched by CPT code are ticked. Tests matched only by name are left unticked — check them first. Choose the laboratory on each order.')}
                        checking={checkingCodes} checkingText={tr('aiCheckingCodes', 'Checking codes against your code list...')}
                        emptyText={tr('aiNoLabsFound', 'No lab tests were found in the draft.')}
                        items={labs.map((l) => ({
                          key: l.key, checked: l.checked, verified: l.matchedBy === 'code', ariaLabel: l.name,
                          content: <><span className="font-semibold">{l.name}</span>{l.match ? <span className="ml-2 font-mono text-xs">CPT {l.match.code}</span> : null}</>,
                          status: l.matchedBy === 'code'
                            ? fill(tr('aiLabMatchedCode', 'Matched by CPT code: {desc}'), { desc: l.match.description || l.match.code })
                            : l.matchedBy === 'name'
                              ? fill(tr('aiLabMatchedName', 'Matched by name only: {desc}'), { desc: l.match.description || l.match.code })
                              : tr('aiLabNoMatch', 'No lab CPT code found — the order is added without a code'),
                        }))}
                        onToggle={(idx, v) => setLabs((list) => list.map((x, i) => (i === idx ? { ...x, checked: v } : x)))}
                        addedCount={labsAdded}
                        addedText={fill(tr('aiLabsAdded', '{n} lab order(s) added. Choose a laboratory for each, then save.'), { n: labsAdded })}
                        buttonLabel={tr('aiAddSelectedLabs', 'Add selected tests to Lab Orders')}
                        disabled={busy || signOffMissing} onAdd={addLabs} />
                    )}

                    {/* Text actions. */}
                    <div className="flex flex-wrap gap-2">
                      {onApply && (applied ? (
                        <p className="text-sm text-green-500 self-center">{tr('aiInsertedSaveReminder', 'Inserted into the form. Review it and save the form as usual.')}</p>
                      ) : (
                        <button type="button" className={btnPrimary} disabled={busy || signOffMissing} onClick={applyText}>
                          <FileInput className="w-4 h-4" />{applyButtonLabel}
                        </button>
                      ))}
                      {!hasActions && !accepted && (
                        <button type="button" className={btnPrimary} disabled={busy || signOffMissing} onClick={acceptOnly}>
                          {text !== draft.draft ? tr('aiAcceptEdited', 'Save edits & accept') : tr('aiAccept', 'Accept')}
                        </button>
                      )}
                      {!hasActions && accepted && (
                        <button type="button" className={btnSecondary} onClick={copy}>
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? tr('aiCopied', 'Copied') : tr('aiCopy', 'Copy')}
                        </button>
                      )}
                    </div>

                    {/* Reject, until something has been accepted. */}
                    {!accepted && (
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="flex-1 min-w-[12rem]">
                          <label className={`block text-xs font-medium mb-1 ${dark ? 'text-slate-400' : 'text-gray-600'}`} htmlFor={`ai-assist-reason-${featureKey}`}>
                            {tr('aiRejectReason', 'Reason (required to reject)')}
                          </label>
                          <input id={`ai-assist-reason-${featureKey}`} className={input_} value={reason} onChange={(e) => setReason(e.target.value)} />
                        </div>
                        <button type="button" className={btnSecondary} disabled={busy || !reason.trim()} onClick={reject}>
                          {tr('aiReject', 'Reject')}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {(accepted || !draft.canReview) && (
                  <button type="button" className={btnSecondary} onClick={() => setOpen(false)}>{tr('aiDone', 'Done')}</button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default AIAssistButton;
