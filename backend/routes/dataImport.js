// /api/import — bring patients and appointments in from another system.
//
// Published, no sign-in (the format holds no data):
//   GET  /formats                    every field, type, rule and example (JSON)
//   GET  /templates/:kind.csv        CSV template: header row + one example row
//
// Import (admin signed in, or an API key with the 'import' scope):
//   POST /:kind                      JSON { rows: [ {...}, ... ], dryRun?, mode? }  or  { csv: "<text>", dryRun?, mode? }
//   POST /:kind/csv?dryRun=&mode=    the CSV file as the body (Content-Type: text/csv)
//     → 200 { created, updated, unchanged, written, ... }   | 422 { errors: [{ row, field, message }] } (nothing written)
//   kinds: patients, appointments
//
// API keys (admin signed in only — a key cannot manage keys):
//   GET /keys · POST /keys { name } → { key } shown once · DELETE /keys/:id
//
// A key is sent as  Authorization: Bearer ack_…  (or X-API-Key: ack_…). It works only on the
// import routes, for its own practice, and cannot read anything.

const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { makeTenantDb } = require('../db/requestTenantDb');
const { resolveTenantForPractice } = require('../services/tenantCatalog');
const { enforceActiveBilling } = require('../middleware/planEnforcement');
const { logPhiRead } = require('../services/phiAudit');
const I = require('../services/dataImport');
const keys = require('../services/apiKeys');

const router = express.Router();
const pool = (req) => req.app.locals.pool;

router.get('/formats', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json(I.publishedFormats());
});

router.get('/templates/:file', (req, res) => {
  const m = /^([a-z_]+)\.csv$/.exec(req.params.file || '');
  const csv = m && I.templateCsv(m[1]);
  if (!csv) return res.status(404).json({ error: `Templates: ${I.KINDS.map((k) => `${k}.csv`).join(', ')}` });
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="aureoncare-${m[1]}-template.csv"`);
  res.send(`﻿${csv}`); // BOM so Excel opens accented names correctly
});

const presentedKey = (req) => {
  const h = String(req.headers.authorization || '');
  if (h.startsWith('Bearer ack_')) return h.slice(7).trim();
  return req.headers['x-api-key'] ? String(req.headers['x-api-key']).trim() : null;
};

/** An API key, or a signed-in admin. Either way req.tenant / req.db are the practice's. */
async function importAuth(req, res, next) {
  const presented = presentedKey(req);
  if (!presented) {
    return authenticate(req, res, (err) => {
      if (err) return next(err);
      return authorize('admin')(req, res, next);
    });
  }
  try {
    const k = await keys.verify(pool(req), presented);
    if (!k || !k.scopes.includes('import')) return res.status(401).json({ error: 'The API key is not valid, or it has been revoked.' });
    const t = await resolveTenantForPractice(pool(req), k.practiceId);
    if (!t || !t.schemaName || t.schemaName === 'public') return res.status(409).json({ error: 'The practice for this key is not active.' });
    req.apiKey = { id: k.id };
    req.user = { id: null, role: 'api_key', email: `api-key:${k.id}`, practiceId: t.practiceId };
    req.tenant = { practiceId: t.practiceId, tenantId: t.tenantId, schemaName: t.schemaName };
    req.db = makeTenantDb(pool(req), t.schemaName, res);
    return next();
  } catch (e) {
    console.error('[import] key check failed:', e.message);
    return res.status(500).json({ error: 'Could not check the API key.' });
  }
}

const asBool = (v) => v === true || v === 'true' || v === '1';

async function handle(req, res, kind, rows, opts) {
  try {
    const out = await I.runImport(req, kind, rows, opts);
    if (out.error) return res.status(out.status).json({ error: out.error });
    if (out.body.written) {
      await logPhiRead(req, {
        resourceType: kind === 'patients' ? 'patient' : 'appointment', action: 'import',
        description: `Imported ${kind}: ${out.body.created} created, ${out.body.updated} updated, ${out.body.unchanged} unchanged` +
          (req.apiKey ? ` (API key ${req.apiKey.id})` : ''),
      });
    }
    return res.status(out.status).json(out.body);
  } catch (e) {
    console.error('[import] failed:', e);
    return res.status(500).json({ error: 'The import could not be completed. Nothing was written.' });
  }
}

const kindOk = (req, res) => {
  if (I.KINDS.includes(req.params.kind)) return true;
  res.status(404).json({ error: `Unknown import kind. Use one of: ${I.KINDS.join(', ')}.` });
  return false;
};

// ── key management (signed-in admins only) ────────────────────────────────────────
const adminOnly = [authenticate, authorize('admin')];

router.get('/keys', adminOnly, async (req, res) => {
  try { res.json(await keys.list(pool(req), req.tenant.practiceId)); }
  catch (e) {
    if (e.code === '42P01') return res.status(503).json({ error: 'API keys need migration 103.' });
    console.error('[import] list keys:', e.message); res.status(500).json({ error: 'Could not list API keys.' });
  }
});

router.post('/keys', adminOnly, enforceActiveBilling, async (req, res) => {
  try {
    const name = String((req.body && req.body.name) || '').trim();
    if (!name) return res.status(400).json({ error: 'Give the key a name, e.g. the system that will use it.' });
    const out = await keys.create(pool(req), { practiceId: req.tenant.practiceId, name, createdBy: req.user.id });
    res.status(201).json({ ...out.record, key: out.key });
  } catch (e) {
    if (e.code === '42P01') return res.status(503).json({ error: 'API keys need migration 103.' });
    console.error('[import] create key:', e.message); res.status(500).json({ error: 'Could not create the API key.' });
  }
});

router.delete('/keys/:id', adminOnly, async (req, res) => {
  try {
    const ok = await keys.revoke(pool(req), req.tenant.practiceId, req.params.id);
    if (!ok) return res.status(404).json({ error: 'No live key with that id.' });
    res.json({ revoked: true });
  } catch (e) {
    console.error('[import] revoke key:', e.message); res.status(500).json({ error: 'Could not revoke the API key.' });
  }
});

// ── sample data (free trials start with it) ──────────────────────────────────────
router.get('/sample-data', adminOnly, async (req, res) => {
  try { res.json(await require('../services/sampleData').sampleDataStatus(req.db)); }
  catch (e) { console.error('[import] sample status:', e.message); res.json({ present: false, counts: {} }); }
});

router.delete('/sample-data', adminOnly, async (req, res) => {
  try {
    const out = await require('../services/sampleData').removeSampleData(pool(req), { schemaName: req.tenant.schemaName });
    await logPhiRead(req, { resourceType: 'patient', action: 'delete', description: `Removed sample data: ${JSON.stringify(out.removed)}` });
    res.json(out);
  } catch (e) {
    console.error('[import] remove sample data:', e.message);
    res.status(500).json({ error: 'Could not remove the sample data.' });
  }
});

// ── import ──────────────────────────────────────────────────────────────────────────
router.post('/:kind/csv', importAuth, enforceActiveBilling, express.text({ type: ['text/csv', 'text/plain', 'application/csv'], limit: '10mb' }), (req, res) => {
  if (!kindOk(req, res)) return undefined;
  const text = typeof req.body === 'string' ? req.body : '';
  if (!text.trim()) return res.status(400).json({ error: 'Send the CSV file as the request body with Content-Type: text/csv.' });
  const { rows } = I.rowsFromCsv(text);
  return handle(req, res, req.params.kind, rows, { dryRun: asBool(req.query.dryRun), mode: req.query.mode || 'upsert' });
});

router.post('/:kind', importAuth, enforceActiveBilling, (req, res) => {
  if (!kindOk(req, res)) return undefined;
  const b = req.body || {};
  const rows = typeof b.csv === 'string' ? I.rowsFromCsv(b.csv).rows : b.rows;
  return handle(req, res, req.params.kind, rows, { dryRun: asBool(b.dryRun), mode: b.mode || 'upsert' });
});

module.exports = router;
