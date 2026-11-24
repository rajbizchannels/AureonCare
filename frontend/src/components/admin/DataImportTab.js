import React, { useCallback, useEffect, useState } from 'react';
import { Upload, Download, FileText, KeyRound, Copy, Trash2, Loader2, CheckCircle, AlertTriangle, Plus, FileSpreadsheet } from 'lucide-react';
import { apiFetch } from '../../api/apiService';
import { readImportFile, downloadXlsxTemplate, csvTemplateText, templateTable, isSpreadsheetName } from '../../utils/importSpreadsheet';

/**
 * Settings → Import Data. A clinic's data from its previous system, in a defined format:
 *   1. pick what to import and download its template — CSV or Excel (or the workbook with every
 *      kind and a "Read me" sheet),
 *   2. choose the filled-in file (CSV, XLSX or XLS) — it is CHECKED first, nothing written, and
 *      every problem is listed by row and column,
 *   3. import. All or nothing; running the same file again adds nothing twice.
 * The same format is accepted by the API, with a practice API key, for automated imports.
 */
const HINTS = {
  suppliers: 'Import suppliers before products — a product names its supplier.',
  products: 'Medicines, consumables and retail items. quantity_on_hand is the opening stock.',
  services: 'What you offer and its standard price. Categories are created as needed.',
  insurers: 'Insurers and other payers your patients use.',
  patients: 'Import patients before appointments — appointments refer to them by MRN.',
  appointments: 'Each row names the patient by MRN and, optionally, the provider by email.',
};
const FALLBACK_ORDER = ['suppliers', 'products', 'services', 'insurers', 'patients', 'appointments'];

const readJson = async (res) => { try { return await res.json(); } catch { return {}; } };

const saveText = (text, name, type) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([`﻿${text}`], { type }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

const DataImportTab = ({ theme, addNotification }) => {
  const dark = theme === 'dark';
  const card = `rounded-lg border p-4 ${dark ? 'border-slate-700 bg-slate-800/60' : 'border-gray-200 bg-white'}`;
  const muted = dark ? 'text-slate-400' : 'text-gray-600';
  const strong = dark ? 'text-white' : 'text-gray-900';
  const btn = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-60';
  const softBtn = `${btn} ${dark ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`;
  const cellBorder = dark ? 'border-slate-600' : 'border-gray-200';

  const [kind, setKind] = useState('patients');
  const [formats, setFormats] = useState(null);
  const [file, setFile] = useState(null); // { name, payload: { csv } | { rows }, sheet }
  const [updateExisting, setUpdateExisting] = useState(true);
  const [result, setResult] = useState(null); // the server's answer (dry run or import)
  const [busy, setBusy] = useState(false);
  const [keys, setKeys] = useState([]);
  const [keysNote, setKeysNote] = useState(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState(null);

  useEffect(() => {
    apiFetch('/import/formats').then(readJson).then(setFormats).catch(() => setFormats(null));
  }, []);

  const loadKeys = useCallback(async () => {
    const r = await apiFetch('/import/keys');
    const b = await readJson(r);
    if (r.ok) { setKeys(b); setKeysNote(null); } else setKeysNote(b.error || 'API keys are not available.');
  }, []);
  useEffect(() => { loadKeys().catch(() => {}); }, [loadKeys]);

  const order = (formats && formats.order) || FALLBACK_ORDER;
  const fmt = formats && formats.kinds && formats.kinds[kind];
  const label = (k) => (formats && formats.kinds && formats.kinds[k] ? formats.kinds[k].label : k);

  const send = async (dryRun) => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await apiFetch(`/import/${kind}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...file.payload, dryRun, mode: updateExisting ? 'upsert' : 'create_only' }),
      });
      const b = await readJson(r);
      if (!r.ok && !b.errors) throw new Error(b.error || `Import failed (${r.status})`);
      setResult(b);
      if (b.written) {
        addNotification?.('success', `Imported ${label(kind).toLowerCase()}: ${b.created} added, ${b.updated} updated, ${b.unchanged} unchanged.`);
        setFile(null);
      }
    } catch (e) {
      addNotification?.('alert', e.message);
    } finally { setBusy(false); }
  };

  const chooseFile = async (f) => {
    setResult(null);
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { addNotification?.('alert', 'The file is larger than 10 MB — split it, or use the API in batches.'); return; }
    try {
      const read = await readImportFile(f, kind);
      if (read.kind === 'csv') setFile({ name: f.name, payload: { csv: read.text } });
      else if (!read.rows.length) addNotification?.('alert', `${f.name} has no rows under the header${read.sheet ? ` (sheet "${read.sheet}")` : ''}.`);
      else setFile({ name: f.name, sheet: read.sheet, payload: { rows: read.rows } });
    } catch (e) {
      addNotification?.('alert', `Could not read ${f.name}: ${e.message}`);
    }
  };
  // Check (dry run) whenever a file is chosen or the update setting changes.
  useEffect(() => { if (file) send(true); }, [file, updateExisting]); // eslint-disable-line react-hooks/exhaustive-deps

  const templateCsv = () => fmt && saveText(csvTemplateText(fmt), `aureoncare-${kind}-template.csv`, 'text/csv;charset=utf-8');
  const templateXlsx = async (all) => {
    try {
      await downloadXlsxTemplate(formats, all ? order : [kind], all ? 'aureoncare-import-templates.xlsx' : `aureoncare-${kind}-template.xlsx`);
    } catch (e) { addNotification?.('alert', `Could not build the Excel template: ${e.message}`); }
  };

  const createKey = async () => {
    const r = await apiFetch('/import/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newKeyName }) });
    const b = await readJson(r);
    if (!r.ok) { addNotification?.('alert', b.error || 'Could not create the key.'); return; }
    setNewKey(b.key); setNewKeyName(''); loadKeys();
  };
  const revokeKey = async (id) => {
    if (!window.confirm('Revoke this key? Anything using it stops working at once.')) return;
    const r = await apiFetch(`/import/keys/${id}`, { method: 'DELETE' });
    if (r.ok) { addNotification?.('success', 'Key revoked.'); loadKeys(); } else addNotification?.('alert', 'Could not revoke the key.');
  };
  const copy = (text) => navigator.clipboard?.writeText(text).then(() => addNotification?.('success', 'Copied.'));

  const apiBase = `${window.location.origin}/api/import`;
  const curl = `curl -X POST "${apiBase}/${kind}/csv?dryRun=true" \\\n  -H "Authorization: Bearer <your key>" \\\n  -H "Content-Type: text/csv" \\\n  --data-binary @${kind}.csv`;
  const preview = fmt ? templateTable(fmt) : null;

  return (
    <div className="space-y-6" data-testid="data-import">
      <div>
        <h2 className={`text-xl font-semibold ${strong}`}>Import data</h2>
        <p className={`text-sm mt-1 ${muted}`}>Bring your data from your previous system using the templates below (CSV or Excel). Each file is checked first; nothing is saved until you confirm, and an import is all or nothing. Running the same file twice adds nothing twice.</p>
      </div>

      {/* 1. What to import, in order */}
      <div className={card}>
        <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${muted}`}>1 · Choose what to import (in this order)</p>
        <div className="flex flex-wrap gap-2" role="tablist">
          {order.map((k, i) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k}
              onClick={() => { setKind(k); setFile(null); setResult(null); }}
              className={`${btn} ${kind === k ? 'bg-cyan-600 text-white' : dark ? 'bg-slate-700 text-slate-200' : 'bg-gray-100 text-gray-700'}`}>
              <span className="opacity-70">{i + 1}.</span> {label(k)}
            </button>
          ))}
        </div>
        <p className={`text-sm mt-3 ${muted}`}>{HINTS[kind]}</p>
      </div>

      {/* 2. Template */}
      <div className={card} data-testid="import-template">
        <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${muted}`}>2 · Fill in the template</p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => templateXlsx(false)} disabled={!fmt} className={softBtn}><FileSpreadsheet className="w-4 h-4" /> {label(kind)} template (Excel)</button>
          <button type="button" onClick={templateCsv} disabled={!fmt} className={softBtn}><Download className="w-4 h-4" /> {label(kind)} template (CSV)</button>
          <button type="button" onClick={() => templateXlsx(true)} disabled={!formats} className={`text-sm underline ${muted}`}>All templates in one Excel workbook</button>
        </div>
        {preview ? (
          <>
            <p className={`text-xs mt-3 mb-1 ${muted}`}>The template — keep these column names (any order); replace the example row with your data. Columns marked * are required.</p>
            <div className="overflow-x-auto">
              <table className={`text-xs border ${cellBorder}`}>
                <thead><tr>{preview[0].map((h, i) => (
                  <th key={h} className={`px-2 py-1 border ${cellBorder} font-mono text-left whitespace-nowrap ${strong}`}>{h}{fmt.fields[i].required ? <span className="text-amber-500"> *</span> : null}</th>
                ))}</tr></thead>
                <tbody><tr>{preview[1].map((c, i) => (
                  <td key={i} className={`px-2 py-1 border ${cellBorder} whitespace-nowrap ${muted}`}>{c}</td>
                ))}</tr></tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>

      {/* 3. Upload, check, import */}
      <div className={card}>
        <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${muted}`}>3 · Upload and import</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className={`${btn} bg-cyan-600 hover:bg-cyan-700 text-white cursor-pointer`}>
            <Upload className="w-4 h-4" /> Choose file (CSV or Excel)
            <input type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden" onChange={(e) => { chooseFile(e.target.files[0]); e.target.value = ''; }} />
          </label>
          <label className={`inline-flex items-center gap-2 text-sm ${muted}`}>
            <input type="checkbox" checked={updateExisting} onChange={(e) => { setUpdateExisting(e.target.checked); setResult(null); }} />
            Update records that already exist
          </label>
        </div>
        <p className={`text-xs mt-2 ${muted}`}>CSV (comma or semicolon, UTF-8) or Excel (.xlsx, .xls — the sheet named "{kind}", else the first sheet). Up to 10 MB and 5,000 rows. Dates as YYYY-MM-DD; times as YYYY-MM-DDTHH:MM.</p>

        {busy ? <p className={`mt-4 text-sm ${muted} inline-flex items-center gap-2`}><Loader2 className="w-4 h-4 animate-spin" /> Checking…</p> : null}

        {result && !busy ? (
          <div className="mt-4">
            {result.errors && result.errors.length ? (
              <div className={`rounded-md p-3 ${dark ? 'bg-red-500/10 text-red-200' : 'bg-red-50 text-red-800'}`} role="alert">
                <p className="font-medium flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {result.errors.length} problem{result.errors.length === 1 ? '' : 's'} in {file ? file.name : 'the file'} — nothing was imported.</p>
                <div className="max-h-64 overflow-auto mt-2">
                  <table className="text-sm w-full">
                    <thead><tr className="text-left"><th className="pr-3">Row</th><th className="pr-3">Column</th><th>Problem</th></tr></thead>
                    <tbody>{result.errors.slice(0, 200).map((e, i) => (
                      <tr key={i}><td className="pr-3 align-top">{e.row ?? '—'}</td><td className="pr-3 align-top">{e.field || '—'}</td><td>{e.message}</td></tr>
                    ))}</tbody>
                  </table>
                  {result.errors.length > 200 ? <p className="text-xs mt-1">…and {result.errors.length - 200} more.</p> : null}
                </div>
                <p className="text-xs mt-2">Row 1 is the first row under the header. Fix the file and choose it again.</p>
              </div>
            ) : result.written ? (
              <p className={`text-sm flex items-center gap-2 ${dark ? 'text-green-300' : 'text-green-700'}`}><CheckCircle className="w-4 h-4" /> Imported: {result.created} added, {result.updated} updated, {result.unchanged} unchanged.</p>
            ) : (
              <div className={`rounded-md p-3 ${dark ? 'bg-cyan-500/10 text-cyan-100' : 'bg-cyan-50 text-cyan-900'}`}>
                <p className="text-sm"><strong>{file && file.name}</strong>{file && file.sheet && isSpreadsheetName(file.name) ? ` (sheet "${file.sheet}")` : ''} is ready: {result.created} to add, {result.updated} to update, {result.unchanged} unchanged.</p>
                {result.ignoredColumns && result.ignoredColumns.length ? <p className="text-xs mt-1">Columns not recognised, ignored: {result.ignoredColumns.join(', ')}.</p> : null}
                <button type="button" onClick={() => send(false)} disabled={busy || !file || result.created + result.updated === 0} className={`${btn} mt-3 bg-cyan-600 hover:bg-cyan-700 text-white`}>
                  <Upload className="w-4 h-4" /> Import {result.created + result.updated} {label(kind).toLowerCase()}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {fmt ? (
        <div className={card}>
          <h3 className={`font-semibold flex items-center gap-2 ${strong}`}><FileText className="w-4 h-4" /> {label(kind)}: columns</h3>
          <p className={`text-xs mt-1 ${muted}`}>{fmt.description} Column names are not case-sensitive. Empty cells never erase stored values.</p>
          <div className="overflow-x-auto mt-3">
            <table className="text-sm w-full">
              <thead><tr className={`text-left ${muted}`}><th className="pr-4 py-1">Column</th><th className="pr-4">Required</th><th className="pr-4">Format</th><th className="pr-4">Example</th></tr></thead>
              <tbody>{fmt.fields.map((f) => (
                <tr key={f.name} className={dark ? 'border-t border-slate-700' : 'border-t border-gray-100'}>
                  <td className={`pr-4 py-1 font-mono ${strong}`}>{f.name}</td>
                  <td className={`pr-4 font-medium ${dark ? 'text-amber-300' : 'text-amber-700'}`}>{f.required ? 'Yes' : ''}</td>
                  <td className={`pr-4 ${muted}`}>{f.values ? f.values.join(', ') : f.description || (f.type === 'text' ? 'Free text' : f.type)}</td>
                  <td className={`pr-4 font-mono ${muted}`}>{f.example}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className={card}>
        <h3 className={`font-semibold flex items-center gap-2 ${strong}`}><KeyRound className="w-4 h-4" /> Import by API (automation)</h3>
        <p className={`text-sm mt-1 ${muted}`}>Send the same columns as CSV, or JSON rows, from another system on a schedule. A key works only for importing into this practice; it cannot read records. The full format is published at <span className="font-mono">{apiBase}/formats</span>.</p>
        <pre className={`mt-3 p-3 rounded text-xs overflow-x-auto ${dark ? 'bg-slate-900 text-slate-200' : 'bg-gray-50 text-gray-800'}`}>{curl}</pre>
        <p className={`text-xs mt-1 ${muted}`}>Remove <span className="font-mono">dryRun=true</span> to import. JSON: POST {apiBase}/{kind} with {'{ "rows": [ {…} ], "mode": "upsert" }'}. Excel files: convert to CSV for the API, or use this screen.</p>

        {keysNote ? <p className={`text-sm mt-3 ${muted}`}>{keysNote}</p> : (
          <>
            <div className="flex flex-wrap gap-2 mt-4">
              <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Key name, e.g. Nightly sync from old system" maxLength={100}
                className={`flex-1 min-w-[220px] px-3 py-2 rounded-lg border text-sm ${dark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-gray-300'}`} />
              <button type="button" onClick={createKey} disabled={!newKeyName.trim()} className={`${btn} bg-cyan-600 hover:bg-cyan-700 text-white`}><Plus className="w-4 h-4" /> Create key</button>
            </div>
            {newKey ? (
              <div className={`mt-3 rounded-md p-3 ${dark ? 'bg-amber-500/10 text-amber-100' : 'bg-amber-50 text-amber-900'}`} role="status">
                <p className="text-sm font-medium">Copy this key now — it will not be shown again.</p>
                <div className="flex items-center gap-2 mt-2">
                  <code className="text-xs break-all">{newKey}</code>
                  <button type="button" onClick={() => copy(newKey)} className={`${btn} px-2 py-1`} aria-label="Copy key"><Copy className="w-4 h-4" /></button>
                </div>
                <button type="button" className="text-xs underline mt-2" onClick={() => setNewKey(null)}>I have saved it</button>
              </div>
            ) : null}
            {keys.length ? (
              <table className="text-sm w-full mt-4">
                <thead><tr className={`text-left ${muted}`}><th className="py-1 pr-3">Name</th><th className="pr-3">Key</th><th className="pr-3">Last used</th><th className="pr-3">Status</th><th /></tr></thead>
                <tbody>{keys.map((x) => (
                  <tr key={x.id} className={dark ? 'border-t border-slate-700' : 'border-t border-gray-100'}>
                    <td className={`py-1 pr-3 ${strong}`}>{x.name}</td>
                    <td className={`pr-3 font-mono ${muted}`}>{x.prefix}…</td>
                    <td className={`pr-3 ${muted}`}>{x.lastUsedAt ? new Date(x.lastUsedAt).toLocaleString() : 'Never'}</td>
                    <td className="pr-3">{x.revokedAt ? <span className={muted}>Revoked</span> : <span className={dark ? 'text-green-300' : 'text-green-700'}>Active</span>}</td>
                    <td className="text-right">{x.revokedAt ? null : (
                      <button type="button" onClick={() => revokeKey(x.id)} className="text-red-500 hover:text-red-600" aria-label={`Revoke ${x.name}`}><Trash2 className="w-4 h-4" /></button>
                    )}</td>
                  </tr>
                ))}</tbody>
              </table>
            ) : <p className={`text-sm mt-3 ${muted}`}>No API keys yet.</p>}
          </>
        )}
      </div>
    </div>
  );
};

export default DataImportTab;
