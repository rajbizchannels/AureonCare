import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bot, KeyRound, ListChecks, ClipboardCheck, ChevronDown, ChevronUp, Save,
  ShieldCheck, AlertTriangle, Trash2, PlugZap, Sparkles,
} from 'lucide-react';
import api from '../../api/apiService';
import Toggle from '../Toggle';
import { invalidateAIFeatureCache } from './AIAssistButton';

// AI section of the Integrations page.
//
//  * Providers  — bring your own key (BYOK) for each AI provider, with a BAA/DPA check.
//  * Features   — admin switches each AI feature on/off, picks provider + model, sees cost.
//  * Review     — every AI output is a draft; a person accepts, edits or rejects it.
//
// Every string comes from translations (t.ai*), with English fallbacks. Auditing and
// notifications happen server-side for every change and every AI draft.

const ROLE_KEYS = ['admin', 'doctor', 'provider', 'nurse', 'receptionist', 'billing_manager', 'staff'];

const fmtUsd = (n) => {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  if (n === 0) return '$0';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 10) return `$${n.toFixed(2)}`;
  return `$${Math.round(n).toLocaleString()}`;
};

const fill = (s, vars) => String(s || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`));

const AIIntegrationsSection = ({ theme, t = {}, isAdmin }) => {
  const dark = theme === 'dark';
  const [tab, setTab] = useState(isAdmin ? 'providers' : 'review');
  const [catalog, setCatalog] = useState(null);
  const [providers, setProviders] = useState([]);
  const [features, setFeatures] = useState([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState({});
  const [expanded, setExpanded] = useState({});
  const [forms, setForms] = useState({});

  const tr = useCallback((key, fallback) => (t && t[key]) || fallback, [t]);
  const featureName = (key) => tr(`aiFeat_${key}`, key.replace(/_/g, ' '));
  const featureDesc = (key) => tr(`aiFeatDesc_${key}`, '');
  const roleName = (r) => tr(`aiRole_${r}`, r.replace(/_/g, ' '));
  const riskName = (r) => tr(`aiRisk_${r}`, r);
  const moduleName = (m) => tr(`aiModule_${m}`, m);

  const card = `rounded-lg ${dark ? 'bg-slate-800/50' : 'bg-gray-100/50'}`;
  const panel = `bg-gradient-to-br rounded-xl p-4 sm:p-6 border ${dark ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`;
  const input = `w-full px-3 py-2 rounded text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${dark ? 'bg-slate-900 text-white border-slate-700' : 'bg-white text-gray-900 border-gray-300'}`;
  const label = `block text-xs font-medium mb-1 ${dark ? 'text-slate-400' : 'text-gray-600'}`;
  const muted = `text-xs ${dark ? 'text-slate-500' : 'text-gray-500'}`;
  const strong = dark ? 'text-white' : 'text-gray-900';
  const btn = 'px-3 py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const btnPrimary = `${btn} bg-indigo-500 hover:bg-indigo-600 text-white`;
  const btnSecondary = `${btn} ${dark ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`;

  const flash = (msg) => { setNotice(msg); setTimeout(() => setNotice(null), 4000); };
  const showError = (err) => setError(err && err.message ? err.message : String(err));

  const load = useCallback(async () => {
    try {
      const [cat, feats, provs] = await Promise.all([
        api.getAICatalog(),
        api.getAIFeatures(),
        isAdmin ? api.getAIProviders() : Promise.resolve([]),
      ]);
      setCatalog(cat);
      setFeatures(feats);
      setProviders(provs);
      const f = {};
      provs.forEach((p) => {
        f[p.provider] = {
          api_key: '', base_url: p.base_url || '', api_version: p.api_version || '',
          default_model: p.default_model || '', baa_confirmed: !!p.baa_confirmed,
          zero_data_retention: !!p.zero_data_retention,
        };
      });
      setForms(f);
      setError(null);
    } catch (err) {
      showError(err);
    }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const providerMeta = useMemo(() => {
    const m = {};
    (catalog?.providers || []).forEach((p) => { m[p.key] = p; });
    return m;
  }, [catalog]);

  // ── providers ──────────────────────────────────────────────────────────────────

  const setField = (provider, field, value) =>
    setForms((prev) => ({ ...prev, [provider]: { ...prev[provider], [field]: value } }));

  const run = async (key, fn) => {
    setBusy((b) => ({ ...b, [key]: true }));
    setError(null);
    try { await fn(); } catch (err) { showError(err); } finally { setBusy((b) => ({ ...b, [key]: false })); }
  };

  const saveProvider = (p) => run(`save_${p}`, async () => {
    const f = forms[p] || {};
    const payload = {
      base_url: f.base_url, api_version: f.api_version, default_model: f.default_model,
      baa_confirmed: f.baa_confirmed, zero_data_retention: f.zero_data_retention,
    };
    if (f.api_key && f.api_key.trim()) payload.api_key = f.api_key.trim();
    await api.saveAIProvider(p, payload);
    await load();
    flash(tr('aiSaved', 'Saved'));
  });

  const toggleProvider = (p, enabled) => run(`toggle_${p}`, async () => {
    await api.toggleAIProvider(p, !enabled);
    await load();
  });

  const testProvider = (p) => run(`test_${p}`, async () => {
    try {
      const res = await api.testAIProvider(p);
      flash(`${tr('aiTestOk', 'Connection OK')}: ${res.message || ''}`);
    } finally {
      await load();
    }
  });

  const removeKey = (p) => run(`remove_${p}`, async () => {
    if (!window.confirm(tr('aiConfirmRemoveKey', 'Remove the stored API key? Features using this provider will stop.'))) return;
    await api.removeAIProviderKey(p);
    await load();
    flash(tr('aiKeyRemoved', 'API key removed'));
  });

  const renderProvider = (p) => {
    const meta = providerMeta[p.provider] || {};
    const f = forms[p.provider] || {};
    const open = !!expanded[p.provider];
    const status = p.is_enabled ? 'active' : p.configured ? 'configured' : 'none';
    const statusText = status === 'active' ? tr('aiStatusActive', 'Active')
      : status === 'configured' ? tr('aiStatusConfigured', 'Configured') : tr('aiStatusNotConfigured', 'Not configured');
    const statusCls = status === 'active' ? 'bg-green-500/20 text-green-400'
      : status === 'configured' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-red-500/20 text-red-400';
    const fields = meta.fields || [];
    const isOffline = p.provider === 'offline';

    return (
      <div key={p.provider} className={card}>
        <div className="p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button type="button" onClick={() => setExpanded((e) => ({ ...e, [p.provider]: !open }))}
              className={`flex items-center gap-2 font-medium text-left ${dark ? 'text-slate-300' : 'text-gray-700'}`}>
              {tr(`aiProvider_${p.provider}`, p.label)}
              {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-2">
              {p.requires_baa && p.baa_confirmed && (
                <span className="px-2 py-1 rounded text-xs bg-emerald-500/20 text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />{tr('aiBaaBadge', 'BAA/DPA')}
                </span>
              )}
              <span className={`px-2 py-1 rounded text-xs ${statusCls}`}>{statusText}</span>
              <Toggle theme={theme} checked={!!p.is_enabled}
                onChange={() => toggleProvider(p.provider, p.is_enabled)}
                disabled={busy[`toggle_${p.provider}`] || (!p.is_enabled && !p.configured)}
                ariaLabel={`${tr(`aiProvider_${p.provider}`, p.label)}: ${p.is_enabled ? tr('aiDisable', 'Disable') : tr('aiEnable', 'Enable')}`} />
            </div>
          </div>
          {!open && (
            <p className={`${muted} mt-1`}>
              {p.has_api_key ? fill(tr('aiKeySavedEnding', 'Key saved, ending {last4}'), { last4: p.api_key_last4 || '••••' })
                : isOffline && p.base_url ? p.base_url : tr('aiNoKeyYet', 'No key yet — expand to add your own key')}
              {p.test_status ? ` · ${p.test_status === 'success' ? tr('aiLastTestOk', 'Last test OK') : tr('aiLastTestFailed', 'Last test failed')}` : ''}
            </p>
          )}
        </div>

        {open && (
          <div className={`px-4 pb-4 border-t ${dark ? 'border-slate-700' : 'border-gray-300'}`}>
            <div className="mt-4 space-y-3">
              {fields.includes('api_key') && (
                <div>
                  <label className={label} htmlFor={`ai-key-${p.provider}`}>
                    {tr('aiApiKey', 'API key')}{isOffline ? ` (${tr('aiOptional', 'optional')})` : ''}
                    {p.has_api_key && <span className="text-green-500"> ({tr('aiSavedLower', 'saved')})</span>}
                  </label>
                  <input id={`ai-key-${p.provider}`} type="password" autoComplete="off" className={`${input} font-mono`}
                    value={f.api_key || ''} onChange={(e) => setField(p.provider, 'api_key', e.target.value)}
                    placeholder={p.has_api_key ? tr('aiKeyKeepPlaceholder', '•••••••• (leave blank to keep the saved key)') : tr('aiKeyPlaceholder', 'Paste your API key')} />
                  <p className={`${muted} mt-1`}>{tr('aiKeyHint', 'Stored encrypted. It is never shown again or sent to the browser.')}</p>
                </div>
              )}
              {fields.includes('base_url') && (
                <div>
                  <label className={label} htmlFor={`ai-url-${p.provider}`}>
                    {isOffline ? tr('aiServerUrl', 'Model server URL') : tr('aiBaseUrl', 'Endpoint URL')}
                    {!isOffline && p.provider !== 'azure_openai' ? ` (${tr('aiOptional', 'optional')})` : ''}
                  </label>
                  <input id={`ai-url-${p.provider}`} type="text" className={input} value={f.base_url || ''}
                    onChange={(e) => setField(p.provider, 'base_url', e.target.value)}
                    placeholder={isOffline ? 'http://ollama:11434/v1' : p.provider === 'azure_openai' ? 'https://<resource>.openai.azure.com' : tr('aiDefaultEndpoint', 'Leave blank for the provider default')} />
                </div>
              )}
              {fields.includes('api_version') && (
                <div>
                  <label className={label} htmlFor={`ai-ver-${p.provider}`}>{tr('aiApiVersion', 'API version')}</label>
                  <input id={`ai-ver-${p.provider}`} type="text" className={input} value={f.api_version || ''}
                    onChange={(e) => setField(p.provider, 'api_version', e.target.value)} />
                </div>
              )}
              <div>
                <label className={label} htmlFor={`ai-model-${p.provider}`}>
                  {p.provider === 'azure_openai' ? tr('aiDeploymentName', 'Default deployment name') : tr('aiDefaultModel', 'Default model')}
                </label>
                <input id={`ai-model-${p.provider}`} list={`ai-models-${p.provider}`} className={input} value={f.default_model || ''}
                  onChange={(e) => setField(p.provider, 'default_model', e.target.value)} />
                <datalist id={`ai-models-${p.provider}`}>
                  {(meta.models || []).map((m) => <option key={m} value={m} />)}
                </datalist>
              </div>
              {p.requires_baa && (
                <div className={`p-3 rounded-lg space-y-1 ${dark ? 'bg-slate-700/50' : 'bg-blue-50'}`}>
                  <Toggle theme={theme} checked={!!f.baa_confirmed}
                    onChange={(v) => setField(p.provider, 'baa_confirmed', v)}
                    label={tr('aiBaaConfirm', 'A BAA (US) / DPA (EU) is signed with this provider')} />
                  <p className={muted}>{tr('aiBaaHint', 'Required before any feature that uses patient data can be switched on. Patient identifiers are still removed before sending.')}</p>
                </div>
              )}
              {!isOffline && (
                <Toggle theme={theme} size="sm" checked={!!f.zero_data_retention}
                  onChange={(v) => setField(p.provider, 'zero_data_retention', v)}
                  label={tr('aiZdr', 'Zero data retention is enabled on this account')} />
              )}
              {p.last_tested_at && (
                <p className={`text-xs ${p.test_status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                  {p.test_status === 'success' ? tr('aiLastTestOk', 'Last test OK') : tr('aiLastTestFailed', 'Last test failed')}
                  {p.test_message ? ` — ${p.test_message}` : ''}
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <button type="button" className={`${btnPrimary} flex-1`} disabled={busy[`save_${p.provider}`]} onClick={() => saveProvider(p.provider)}>
                  <Save className="w-4 h-4" />{busy[`save_${p.provider}`] ? tr('aiSaving', 'Saving...') : tr('aiSave', 'Save')}
                </button>
                <button type="button" className={btnSecondary} disabled={busy[`test_${p.provider}`] || !p.configured} onClick={() => testProvider(p.provider)}>
                  <PlugZap className="w-4 h-4" />{busy[`test_${p.provider}`] ? tr('aiTesting', 'Testing...') : tr('aiTestConnection', 'Test connection')}
                </button>
                {p.has_api_key && (
                  <button type="button" className={btnSecondary} disabled={busy[`remove_${p.provider}`]} onClick={() => removeKey(p.provider)}>
                    <Trash2 className="w-4 h-4" />{tr('aiRemoveKey', 'Remove key')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── features ───────────────────────────────────────────────────────────────────

  const connectedProviders = providers.filter((p) => p.is_enabled);

  const updateFeature = (key, patch) => run(`feat_${key}`, async () => {
    const updated = await api.updateAIFeature(key, patch);
    setFeatures((list) => list.map((f) => (f.key === key ? updated : f)));
    invalidateAIFeatureCache();
    if (patch.is_enabled !== undefined) {
      flash(patch.is_enabled ? tr('aiFeatureOn', 'Feature switched on') : tr('aiFeatureOff', 'Feature switched off'));
    }
  });

  const modelsFor = (provider) => {
    const meta = providerMeta[provider];
    const cred = providers.find((p) => p.provider === provider);
    const list = new Set([...(meta?.models || [])]);
    if (cred?.default_model) list.add(cred.default_model);
    return [...list];
  };

  const renderCost = (f) => {
    const g = f.costGuidance || {};
    if (!f.provider) return <span className={muted}>{tr('aiPickProviderForCost', 'Pick a provider to see cost')}</span>;
    if (g.offline) return <span className="text-xs text-emerald-400">{tr('aiCostOffline', 'No per-use fee (your own hardware)')}</span>;
    return (
      <div className="text-xs space-y-0.5">
        <div className={strong}>{fill(tr('aiCostPerUse', '≈ {cost} per use'), { cost: fmtUsd(g.perUseUsd) })}</div>
        <div className={muted}>
          {fill(tr('aiCostPerMonth', '≈ {cost}/month at {uses} uses'), { cost: fmtUsd(g.monthlyUsd), uses: (g.monthlyUses || 0).toLocaleString() })}
        </div>
        <div className={muted}>{fill(tr('aiCostTokens', '{in} in / {out} out tokens'), { in: (g.tokensIn || 0).toLocaleString(), out: (g.tokensOut || 0).toLocaleString() })}</div>
        {g.extra && g.extra.key === 'speechToText' && (
          <div className="text-amber-500">
            {fill(tr('aiCostSpeech', '+ speech-to-text {low}–{high} per visit (billed by your audio vendor)'), { low: fmtUsd(g.extra.perUseLowUsd), high: fmtUsd(g.extra.perUseHighUsd) })}
          </div>
        )}
        {g.perUseUsd == null && <div className="text-amber-500">{tr('aiCostUnknownModel', 'Model not in price book — check your provider')}</div>}
      </div>
    );
  };

  const renderFeatures = () => (
    <div className="space-y-3">
      <p className={muted}>
        {fill(tr('aiCostDisclaimer', 'Cost guidance uses list prices as of {date} and a typical 10-provider clinic. Your provider invoice is the source of truth.'), { date: catalog?.priceBook?.asOf || '' })}
      </p>
      {connectedProviders.length === 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-500 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {tr('aiConnectProviderFirst', 'Connect and switch on at least one AI provider (Providers tab) before turning features on.')}
        </div>
      )}
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <table className="min-w-[960px] w-full text-sm">
          <thead>
            <tr className={`text-left text-xs uppercase ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
              <th className="px-3 py-2">{tr('aiColFeature', 'Feature')}</th>
              <th className="px-3 py-2">{tr('aiColRisk', 'Risk')}</th>
              <th className="px-3 py-2">{tr('aiColHumanReview', 'Human review')}</th>
              <th className="px-3 py-2">{tr('aiColProviderModel', 'Provider & model')}</th>
              <th className="px-3 py-2">{tr('aiColCost', 'Cost guidance')}</th>
              <th className="px-3 py-2">{tr('aiColThisMonth', 'This month')}</th>
              <th className="px-3 py-2">{tr('aiColLimit', 'Monthly limit')}</th>
              <th className="px-3 py-2">{tr('aiColEnabled', 'On / Off')}</th>
            </tr>
          </thead>
          <tbody>
            {features.map((f) => {
              const riskCls = f.risk === 'high' ? 'bg-red-500/20 text-red-400' : f.risk === 'medium' ? 'bg-amber-500/20 text-amber-500' : 'bg-green-500/20 text-green-400';
              const usage = f.usage || {};
              return (
                <tr key={f.key} className={`align-top border-t ${dark ? 'border-slate-700' : 'border-gray-200'}`}>
                  <td className="px-3 py-3 max-w-xs">
                    <div className={`font-medium ${strong}`}>{featureName(f.key)}</div>
                    <div className={muted}>{featureDesc(f.key)}</div>
                    <div className={`${muted} mt-1`}>
                      {moduleName(f.module)}{f.sendsPhi ? ` · ${tr('aiUsesPatientData', 'uses patient data (anonymized)')}` : ` · ${tr('aiNoPatientData', 'no patient data')}`}
                    </div>
                  </td>
                  <td className="px-3 py-3"><span className={`px-2 py-1 rounded text-xs ${riskCls}`}>{riskName(f.risk)}</span></td>
                  <td className="px-3 py-3 text-xs">
                    <div className={dark ? 'text-slate-300' : 'text-gray-700'}>{f.reviewerRoles.map(roleName).join(', ')}</div>
                    {f.attestationRequired && <div className="text-indigo-400 mt-1">{tr('aiAttestationRequired', 'Sign-off required')}</div>}
                  </td>
                  <td className="px-3 py-3 space-y-2 min-w-[180px]">
                    <select aria-label={tr('aiColProviderModel', 'Provider & model')} className={input} value={f.provider || ''}
                      disabled={busy[`feat_${f.key}`]}
                      onChange={(e) => updateFeature(f.key, { provider: e.target.value || null, model: null })}>
                      <option value="">{tr('aiSelectProvider', 'Select provider')}</option>
                      {providers.map((p) => (
                        <option key={p.provider} value={p.provider} disabled={!p.is_enabled}>
                          {tr(`aiProvider_${p.provider}`, p.label)}{p.is_enabled ? '' : ` (${tr('aiOff', 'off')})`}
                        </option>
                      ))}
                    </select>
                    {f.provider && (
                      <>
                        <input aria-label={tr('aiDefaultModel', 'Model')} list={`ai-feat-models-${f.key}`} className={input}
                          defaultValue={f.model || ''} key={`${f.key}-${f.provider}-${f.model}`}
                          onBlur={(e) => e.target.value !== (f.model || '') && updateFeature(f.key, { model: e.target.value })} />
                        <datalist id={`ai-feat-models-${f.key}`}>
                          {modelsFor(f.provider).map((m) => <option key={m} value={m} />)}
                        </datalist>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-3 min-w-[170px]">{renderCost(f)}</td>
                  <td className="px-3 py-3 text-xs">
                    <div className={strong}>{fill(tr('aiUsageRequests', '{n} drafts'), { n: usage.requests || 0 })}</div>
                    <div className={muted}>{fmtUsd(usage.cost_usd || 0)}</div>
                    {usage.reviews && Object.keys(usage.reviews).length > 0 && (
                      <div className={muted}>
                        {Object.entries(usage.reviews).map(([s, n]) => `${tr(`aiReviewStatus_${s}`, s)}: ${n}`).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <input type="number" min="0" aria-label={tr('aiColLimit', 'Monthly limit')} className={`${input} w-24`}
                      defaultValue={f.monthly_request_limit ?? ''} key={`${f.key}-limit-${f.monthly_request_limit}`}
                      placeholder={tr('aiNoLimit', 'None')}
                      onBlur={(e) => {
                        const v = e.target.value === '' ? null : Number(e.target.value);
                        if (v !== (f.monthly_request_limit ?? null)) updateFeature(f.key, { monthly_request_limit: v });
                      }} />
                  </td>
                  <td className="px-3 py-3">
                    <Toggle theme={theme} checked={!!f.is_enabled}
                      onChange={() => updateFeature(f.key, { is_enabled: !f.is_enabled })}
                      disabled={busy[`feat_${f.key}`] || (!f.is_enabled && !f.provider)}
                      ariaLabel={`${featureName(f.key)}: ${f.is_enabled ? tr('aiDisable', 'Disable') : tr('aiEnable', 'Enable')}`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className={panel}>
      <div className="flex items-start gap-3 mb-4">
        <Bot className="w-6 h-6 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <h3 className={`text-lg font-semibold ${strong}`}>{tr('aiSectionTitle', 'AI Integrations')}</h3>
          <p className={muted}>{tr('aiSectionIntro', 'Use your own AI provider key. Patient identifiers are replaced with placeholders before anything is sent, and put back when the answer returns. Every AI result is a draft that a person must review.')}</p>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-3 p-3 rounded-lg bg-red-500/10 text-red-400 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      )}
      {notice && <div role="status" className="mb-3 p-3 rounded-lg bg-green-500/10 text-green-400 text-sm">{notice}</div>}

      <div className="flex flex-wrap gap-2 mb-4" role="tablist">
        {isAdmin && (
          <>
            <TabButton active={tab === 'providers'} onClick={() => setTab('providers')} dark={dark} icon={KeyRound}>{tr('aiTabProviders', 'Providers (your own key)')}</TabButton>
            <TabButton active={tab === 'features'} onClick={() => setTab('features')} dark={dark} icon={ListChecks}>{tr('aiTabFeatures', 'Features & cost')}</TabButton>
          </>
        )}
        <TabButton active={tab === 'review'} onClick={() => setTab('review')} dark={dark} icon={ClipboardCheck}>{tr('aiTabReview', 'Review queue')}</TabButton>
      </div>

      {tab === 'providers' && isAdmin && (
        <div className="space-y-3">
          <p className={muted}>{tr('aiByokIntro', 'Bring your own key: usage is billed by the provider to your own account. AureonCare stores the key encrypted and never shows it again.')}</p>
          {providers.map(renderProvider)}
        </div>
      )}
      {tab === 'features' && isAdmin && renderFeatures()}
      {tab === 'review' && (
        <AIReviewQueue theme={theme} tr={tr} featureName={featureName} features={features}
          styles={{ card, input, label, muted, strong, btnPrimary, btnSecondary }} />
      )}
    </div>
  );
};

const TabButton = ({ active, onClick, dark, icon: Icon, children }) => (
  <button type="button" role="tab" aria-selected={active} onClick={onClick}
    className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${active
      ? 'bg-indigo-500 text-white'
      : dark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white text-gray-700 hover:bg-gray-100'}`}>
    <Icon className="w-4 h-4" />{children}
  </button>
);

// ── review queue (human in the loop) ─────────────────────────────────────────────────

const AIReviewQueue = ({ theme, tr, featureName, features, styles }) => {
  const dark = theme === 'dark';
  const { card, input, label, muted, strong, btnPrimary, btnSecondary } = styles;
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [edits, setEdits] = useState({});
  const [attest, setAttest] = useState({});
  const [reasons, setReasons] = useState({});
  const [busy, setBusy] = useState({});
  const [newDraft, setNewDraft] = useState({ feature: '', input: '', patientId: '' });
  const [generating, setGenerating] = useState(false);

  const enabled = features.filter((f) => f.is_enabled);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.getAISuggestions(status));
      setErr(null);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const review = async (item, action) => {
    setBusy((b) => ({ ...b, [item.id]: true }));
    setErr(null);
    try {
      const text = edits[item.id] !== undefined ? edits[item.id] : item.draft;
      await api.reviewAISuggestion(item.id, {
        action: action === 'accept' && text !== item.draft ? 'edit' : action,
        finalText: text,
        reason: reasons[item.id],
        attested: !!attest[item.id],
      });
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy((b) => ({ ...b, [item.id]: false }));
    }
  };

  const generate = async () => {
    setGenerating(true);
    setErr(null);
    try {
      await api.runAIFeature(newDraft.feature, {
        input: newDraft.input,
        patientId: newDraft.patientId.trim() || undefined,
      });
      setNewDraft({ feature: newDraft.feature, input: '', patientId: '' });
      setStatus('pending');
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      {enabled.length > 0 && (
        <div className={`${card} p-4 space-y-3`}>
          <div className={`flex items-center gap-2 font-medium ${strong}`}><Sparkles className="w-4 h-4 text-indigo-400" />{tr('aiNewDraft', 'Create an AI draft')}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="ai-new-feature">{tr('aiColFeature', 'Feature')}</label>
              <select id="ai-new-feature" className={input} value={newDraft.feature}
                onChange={(e) => setNewDraft((d) => ({ ...d, feature: e.target.value }))}>
                <option value="">{tr('aiSelectFeature', 'Select a feature')}</option>
                {enabled.map((f) => <option key={f.key} value={f.key}>{featureName(f.key)}</option>)}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="ai-new-patient">{tr('aiPatientIdOptional', 'Patient ID (optional — removes their identifiers first)')}</label>
              <input id="ai-new-patient" className={input} value={newDraft.patientId}
                onChange={(e) => setNewDraft((d) => ({ ...d, patientId: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className={label} htmlFor="ai-new-input">{tr('aiInputText', 'Text for the AI to work on')}</label>
            <textarea id="ai-new-input" rows={4} className={input} value={newDraft.input}
              onChange={(e) => setNewDraft((d) => ({ ...d, input: e.target.value }))} />
          </div>
          <button type="button" className={btnPrimary} disabled={generating || !newDraft.feature || !newDraft.input.trim()} onClick={generate}>
            <Sparkles className="w-4 h-4" />{generating ? tr('aiGenerating', 'Generating...') : tr('aiGenerate', 'Generate draft')}
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <label className={label} htmlFor="ai-status-filter">{tr('aiFilterStatus', 'Show')}</label>
        <select id="ai-status-filter" className={`${input} w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}>
          {['pending', 'accepted', 'edited', 'rejected', 'expired', 'all'].map((s) => (
            <option key={s} value={s}>{tr(`aiReviewStatus_${s}`, s)}</option>
          ))}
        </select>
      </div>

      {err && <div role="alert" className="p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">{err}</div>}
      {loading && <p className={muted}>{tr('aiLoading', 'Loading...')}</p>}
      {!loading && items.length === 0 && <p className={muted}>{tr('aiNoDrafts', 'No AI drafts here.')}</p>}

      {items.map((item) => {
        const text = edits[item.id] !== undefined ? edits[item.id] : (item.finalText || item.draft || '');
        const pending = item.status === 'pending';
        const needAttest = item.attestationRequired && !attest[item.id];
        return (
          <div key={item.id} className={`${card} p-4 space-y-3`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className={`font-medium ${strong}`}>{featureName(item.featureKey)}</div>
                <div className={muted}>
                  {item.patientName ? `${item.patientName} · ` : ''}
                  {new Date(item.createdAt).toLocaleString()} · {item.provider}/{item.model}
                </div>
                <div className={muted}>
                  {Number(item.phiTokensCount || 0) > 0
                    ? fill(tr('aiPhiAnonymizedCount', '{n} patient identifier(s) were anonymized before sending'), { n: item.phiTokensCount })
                    : tr('aiNoPhiDetected', 'No patient identifiers detected')}
                </div>
              </div>
              <span className={`px-2 py-1 rounded text-xs ${pending ? 'bg-amber-500/20 text-amber-500' : item.status === 'rejected' || item.status === 'expired' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                {tr(`aiReviewStatus_${item.status}`, item.status)}
              </span>
            </div>
            <div className="flex items-start gap-2 p-2 rounded bg-indigo-500/10 text-indigo-300 text-xs">
              <Bot className="w-4 h-4 shrink-0" />{tr('aiDraftBanner', 'AI-generated draft. Check every fact before you accept it.')}
            </div>
            {/\[\[[A-Z_]+_\d+\]\]/.test(text) && (
              <div className="flex items-start gap-2 p-2 rounded bg-amber-500/10 text-amber-500 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />{tr('aiUnknownTokens', 'The draft contains placeholders that could not be matched. Replace them before accepting.')}
              </div>
            )}
            <textarea aria-label={tr('aiDraftText', 'Draft text')} rows={8} className={`${input} font-mono`} readOnly={!pending || !item.canReview}
              value={text} onChange={(e) => setEdits((m) => ({ ...m, [item.id]: e.target.value }))} />

            {pending && item.canReview && (
              <>
                {item.attestationRequired && (
                  <label className="flex items-start gap-2">
                    <input type="checkbox" className="mt-0.5 rounded" checked={!!attest[item.id]}
                      onChange={(e) => setAttest((m) => ({ ...m, [item.id]: e.target.checked }))} />
                    <span className={`text-sm ${dark ? 'text-slate-300' : 'text-gray-700'}`}>{tr('aiAttestText', 'I reviewed this draft and take responsibility for its content.')}</span>
                  </label>
                )}
                <div>
                  <label className={label} htmlFor={`ai-reason-${item.id}`}>{tr('aiRejectReason', 'Reason (required to reject)')}</label>
                  <input id={`ai-reason-${item.id}`} className={input} value={reasons[item.id] || ''}
                    onChange={(e) => setReasons((m) => ({ ...m, [item.id]: e.target.value }))} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={btnPrimary} disabled={busy[item.id] || needAttest} onClick={() => review(item, 'accept')}>
                    {text !== item.draft ? tr('aiAcceptEdited', 'Save edits & accept') : tr('aiAccept', 'Accept')}
                  </button>
                  <button type="button" className={btnSecondary} disabled={busy[item.id] || !(reasons[item.id] || '').trim()} onClick={() => review(item, 'reject')}>
                    {tr('aiReject', 'Reject')}
                  </button>
                </div>
                <p className={muted}>{fill(tr('aiExpires', 'Expires {date}'), { date: new Date(item.expiresAt).toLocaleString() })}</p>
              </>
            )}
            {pending && !item.canReview && (
              <p className={muted}>{tr('aiWaitingForReviewer', 'Waiting for a reviewer with the right role.')}</p>
            )}
            {!pending && item.reviewReason && <p className={muted}>{tr('aiReasonLabel', 'Reason')}: {item.reviewReason}</p>}
          </div>
        );
      })}
    </div>
  );
};

export { ROLE_KEYS };
export default AIIntegrationsSection;
