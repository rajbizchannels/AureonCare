// AI integrations API — mounted at /api/ai.
//
// Admin (Integrations page):
//   GET    /catalog                      features, providers, price book, cost guidance
//   GET    /providers                    BYOK connections (keys never returned)
//   PUT    /providers/:provider          save key / URL / model / BAA confirmation
//   PATCH  /providers/:provider/toggle   switch a provider on/off
//   POST   /providers/:provider/test     check the key (lists models, sends no PHI)
//   DELETE /providers/:provider/key      remove the stored key
//   GET    /features                     per-feature switch, provider, model, limits
//   PATCH  /features/:key                change any of the above
//   GET    /usage                        month-to-date requests, cost, review outcomes
//
// Staff:
//   POST   /features/:key/run            generate a draft (human-in-the-loop)
//   GET    /suggestions                  drafts I can review or asked for
//   POST   /suggestions/:id/review       accept | edit | reject

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { enforceActiveBilling } = require('../middleware/planEnforcement');
const { encrypt } = require('../utils/messageCrypto');
const { assertSafeExternalUrl } = require('../utils/safeUrl');
const catalog = require('../services/ai/featureCatalog');
const gateway = require('../services/ai/aiGateway');
const { getAdapter, offlineUrl } = require('../services/ai/providers');
const { logAiAudit, notifyRoles } = require('../services/ai/aiAudit');
const { logPhiRead } = require('../services/phiAudit');

router.use(authenticate);
router.use(enforceActiveBilling);

const adminOnly = authorize('admin');
const staffOnly = (req, res, next) => (req.user && req.user.role !== 'patient'
  ? next()
  : res.status(403).json({ error: 'Forbidden', message: 'Staff only' }));

const dbOf = (req) => req.db || req.app.locals.pool;

function fail(res, err, what) {
  if (err && err.status && err.code) {
    return res.status(err.status).json({ error: err.code, message: err.message });
  }
  if (err && err.statusCode) {
    return res.status(err.statusCode).json({ error: 'InvalidUrl', message: err.message });
  }
  console.error(`[ai] Error ${what}:`, err);
  return res.status(500).json({ error: `Failed ${what}` });
}

/** Public view of a credential row: everything except the key itself. */
function publicCredential(row, provider) {
  const meta = catalog.PROVIDERS[provider];
  if (!row) {
    return {
      provider, label: meta.label, is_enabled: false, has_api_key: false, api_key_last4: null,
      base_url: null, api_version: meta.defaultApiVersion || null, default_model: meta.defaultModel,
      baa_confirmed: false, zero_data_retention: false, requires_baa: meta.requiresBaa,
      test_status: null, test_message: null, last_tested_at: null, configured: false,
    };
  }
  const hasKey = !!row.api_key_ciphertext;
  return {
    provider,
    label: meta.label,
    display_name: row.display_name,
    is_enabled: row.is_enabled,
    has_api_key: hasKey,
    api_key_last4: row.api_key_last4,
    base_url: row.base_url,
    region: row.region,
    api_version: row.api_version || meta.defaultApiVersion || null,
    default_model: row.default_model || meta.defaultModel,
    baa_confirmed: row.baa_confirmed,
    baa_confirmed_at: row.baa_confirmed_at,
    zero_data_retention: row.zero_data_retention,
    requires_baa: meta.requiresBaa,
    test_status: row.test_status,
    test_message: row.test_message,
    last_tested_at: row.last_tested_at,
    updated_at: row.updated_at,
    configured: provider === 'offline' ? !!row.base_url : hasKey,
  };
}

async function credentialRow(db, provider) {
  const { rows } = await db.query('SELECT * FROM ai_provider_credentials WHERE provider = $1', [provider]);
  return rows[0] || null;
}

function assertProvider(provider) {
  if (!catalog.PROVIDERS[provider]) {
    const e = new Error('Unknown AI provider');
    e.status = 404; e.code = 'AiProviderUnknown';
    throw e;
  }
}

// ── catalog ─────────────────────────────────────────────────────────────────────────

router.get('/catalog', staffOnly, (req, res) => {
  res.json(catalog.publicCatalog());
});

// ── providers (bring your own key) ──────────────────────────────────────────────────

router.get('/providers', adminOnly, async (req, res) => {
  try {
    const db = dbOf(req);
    const { rows } = await db.query('SELECT * FROM ai_provider_credentials');
    const byProvider = new Map(rows.map((r) => [r.provider, r]));
    res.json(Object.keys(catalog.PROVIDERS).map((p) => publicCredential(byProvider.get(p), p)));
  } catch (err) { fail(res, err, 'to load AI providers'); }
});

router.put('/providers/:provider', adminOnly, async (req, res) => {
  try {
    const { provider } = req.params;
    assertProvider(provider);
    const db = dbOf(req);
    const before = await credentialRow(db, provider);
    const b = req.body || {};

    let baseUrl = b.base_url !== undefined ? (String(b.base_url || '').trim() || null) : (before ? before.base_url : null);
    if (baseUrl) {
      if (provider === 'offline') baseUrl = offlineUrl(baseUrl);
      else await assertSafeExternalUrl(baseUrl);
    }
    if (provider === 'offline' && !baseUrl) {
      return res.status(400).json({ error: 'BaseUrlRequired', message: 'Enter the URL of your model server.' });
    }
    if (provider === 'azure_openai' && !baseUrl) {
      return res.status(400).json({ error: 'BaseUrlRequired', message: 'Enter your Azure OpenAI endpoint.' });
    }

    // A blank key keeps the stored one; a new key replaces it.
    let keyCols = before
      ? { ciphertext: before.api_key_ciphertext, iv: before.api_key_iv, tag: before.api_key_tag,
        version: before.api_key_version, last4: before.api_key_last4 }
      : { ciphertext: null, iv: null, tag: null, version: null, last4: null };
    const keyChanged = typeof b.api_key === 'string' && b.api_key.trim() !== '';
    if (keyChanged) {
      const key = b.api_key.trim();
      if (key.length < 8 || key.length > 512) {
        return res.status(400).json({ error: 'ApiKeyInvalid', message: 'That API key does not look valid.' });
      }
      const enc = encrypt(key);
      keyCols = { ciphertext: enc.ciphertext, iv: enc.iv, tag: enc.tag, version: enc.keyVersion, last4: key.slice(-4) };
    }

    const baaConfirmed = b.baa_confirmed !== undefined ? b.baa_confirmed === true : (before ? before.baa_confirmed : false);
    const baaNewlyConfirmed = baaConfirmed && !(before && before.baa_confirmed);
    const values = {
      display_name: b.display_name !== undefined ? b.display_name : before?.display_name || null,
      base_url: baseUrl,
      region: b.region !== undefined ? b.region : before?.region || null,
      api_version: b.api_version !== undefined ? b.api_version : before?.api_version || catalog.PROVIDERS[provider].defaultApiVersion || null,
      default_model: b.default_model !== undefined ? (String(b.default_model || '').trim() || null) : before?.default_model || null,
      zero_data_retention: b.zero_data_retention !== undefined ? b.zero_data_retention === true : !!before?.zero_data_retention,
    };

    const { rows: [row] } = await db.query(
      `INSERT INTO ai_provider_credentials (provider, display_name, api_key_ciphertext, api_key_iv, api_key_tag,
            api_key_version, api_key_last4, base_url, region, api_version, default_model, baa_confirmed,
            baa_confirmed_by, baa_confirmed_at, zero_data_retention, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16)
       ON CONFLICT (provider) DO UPDATE SET
            display_name = EXCLUDED.display_name, api_key_ciphertext = EXCLUDED.api_key_ciphertext,
            api_key_iv = EXCLUDED.api_key_iv, api_key_tag = EXCLUDED.api_key_tag,
            api_key_version = EXCLUDED.api_key_version, api_key_last4 = EXCLUDED.api_key_last4,
            base_url = EXCLUDED.base_url, region = EXCLUDED.region, api_version = EXCLUDED.api_version,
            default_model = EXCLUDED.default_model, baa_confirmed = EXCLUDED.baa_confirmed,
            baa_confirmed_by = COALESCE(EXCLUDED.baa_confirmed_by, ai_provider_credentials.baa_confirmed_by),
            baa_confirmed_at = COALESCE(EXCLUDED.baa_confirmed_at, ai_provider_credentials.baa_confirmed_at),
            zero_data_retention = EXCLUDED.zero_data_retention, updated_by = EXCLUDED.updated_by,
            -- a new key has not been tested yet
            test_status = CASE WHEN $17 THEN NULL ELSE ai_provider_credentials.test_status END,
            test_message = CASE WHEN $17 THEN NULL ELSE ai_provider_credentials.test_message END,
            updated_at = NOW()
       RETURNING *`,
      [provider, values.display_name, keyCols.ciphertext, keyCols.iv, keyCols.tag, keyCols.version, keyCols.last4,
        values.base_url, values.region, values.api_version, values.default_model, baaConfirmed,
        baaNewlyConfirmed ? req.user.id : null, baaNewlyConfirmed ? new Date() : null,
        values.zero_data_retention, req.user.id, keyChanged]
    );

    const safeBefore = before ? publicCredential(before, provider) : null;
    const safeAfter = publicCredential(row, provider);
    await logAiAudit(req, {
      action: before ? 'ai_provider_updated' : 'ai_provider_created',
      resourceType: 'ai_provider', resourceId: row.id, resourceName: provider,
      description: `AI provider ${provider} settings saved${keyChanged ? ' (API key replaced)' : ''}`,
      oldValues: safeBefore, newValues: safeAfter,
      metadata: { keyChanged, baaConfirmed },
    });
    if (keyChanged) {
      await notifyRoles(req, ['admin'], 'ai_provider',
        `The API key for ${catalog.PROVIDERS[provider].label} was changed.`, { excludeUserId: req.user.id });
    }
    res.json(safeAfter);
  } catch (err) { fail(res, err, 'to save AI provider'); }
});

router.patch('/providers/:provider/toggle', adminOnly, async (req, res) => {
  try {
    const { provider } = req.params;
    assertProvider(provider);
    const db = dbOf(req);
    const row = await credentialRow(db, provider);
    const enable = req.body && req.body.is_enabled === true;
    const configured = row && (provider === 'offline' ? !!row.base_url : !!row.api_key_ciphertext);
    if (enable && !configured) {
      return res.status(409).json({ error: 'AiProviderNotConfigured', message: 'Add the API key (or server URL) first.' });
    }
    if (!row) return res.json(publicCredential(null, provider));
    const { rows: [updated] } = await db.query(
      `UPDATE ai_provider_credentials SET is_enabled = $2, updated_by = $3, updated_at = NOW()
        WHERE provider = $1 RETURNING *`,
      [provider, enable, req.user.id]
    );
    await logAiAudit(req, {
      action: enable ? 'ai_provider_enabled' : 'ai_provider_disabled',
      resourceType: 'ai_provider', resourceId: updated.id, resourceName: provider,
      oldValues: { is_enabled: row.is_enabled }, newValues: { is_enabled: enable },
    });
    res.json(publicCredential(updated, provider));
  } catch (err) { fail(res, err, 'to toggle AI provider'); }
});

router.post('/providers/:provider/test', adminOnly, async (req, res) => {
  try {
    const { provider } = req.params;
    assertProvider(provider);
    const db = dbOf(req);
    const row = await credentialRow(db, provider);
    if (!row) return res.status(409).json({ error: 'AiProviderNotConfigured', message: 'Save the settings first.' });

    let status = 'success';
    let message;
    try {
      const out = await getAdapter(provider).test({
        apiKey: gateway.apiKeyOf(row), baseUrl: row.base_url, apiVersion: row.api_version,
      });
      message = out.message;
    } catch (err) {
      status = 'failed';
      message = String(err.message || err).slice(0, 300);
    }
    const { rows: [updated] } = await db.query(
      `UPDATE ai_provider_credentials SET test_status = $2, test_message = $3, last_tested_at = NOW()
        WHERE provider = $1 RETURNING *`,
      [provider, status, message]
    );
    await logAiAudit(req, {
      action: 'ai_provider_tested', resourceType: 'ai_provider', resourceId: row.id, resourceName: provider,
      status: status === 'success' ? 'success' : 'failure', errorMessage: status === 'failed' ? message : null,
    });
    res.status(status === 'success' ? 200 : 400).json({ ...publicCredential(updated, provider), message });
  } catch (err) { fail(res, err, 'to test AI provider'); }
});

router.delete('/providers/:provider/key', adminOnly, async (req, res) => {
  try {
    const { provider } = req.params;
    assertProvider(provider);
    const db = dbOf(req);
    const row = await credentialRow(db, provider);
    if (!row) return res.json(publicCredential(null, provider));
    const { rows: [updated] } = await db.query(
      `UPDATE ai_provider_credentials
          SET api_key_ciphertext = NULL, api_key_iv = NULL, api_key_tag = NULL, api_key_version = NULL,
              api_key_last4 = NULL, is_enabled = CASE WHEN provider = 'offline' THEN is_enabled ELSE false END,
              test_status = NULL, test_message = NULL, updated_by = $2, updated_at = NOW()
        WHERE provider = $1 RETURNING *`,
      [provider, req.user.id]
    );
    await logAiAudit(req, {
      action: 'ai_provider_key_removed', resourceType: 'ai_provider', resourceId: row.id, resourceName: provider,
    });
    await notifyRoles(req, ['admin'], 'ai_provider',
      `The API key for ${catalog.PROVIDERS[provider].label} was removed.`, { excludeUserId: req.user.id });
    res.json(publicCredential(updated, provider));
  } catch (err) { fail(res, err, 'to remove AI provider key'); }
});

// ── features ────────────────────────────────────────────────────────────────────────

function featureView(feature, row, usage) {
  const provider = row?.provider || null;
  const model = row?.model || (provider ? catalog.PROVIDERS[provider].defaultModel : null);
  return {
    key: feature.key,
    module: feature.module,
    risk: feature.risk,
    sendsPhi: feature.sendsPhi,
    reviewerRoles: feature.reviewerRoles,
    attestationRequired: feature.attestationRequired,
    is_enabled: !!row?.is_enabled,
    provider,
    model,
    monthly_request_limit: row?.monthly_request_limit ?? null,
    monthly_budget_usd: row?.monthly_budget_usd != null ? Number(row.monthly_budget_usd) : null,
    draft_ttl_hours: row?.draft_ttl_hours ?? 72,
    enabled_at: row?.enabled_at || null,
    costGuidance: catalog.costGuidance(feature, model, provider),
    usage: usage || { requests: 0, failures: 0, cost_usd: 0, reviews: {} },
  };
}

router.get('/features', staffOnly, async (req, res) => {
  try {
    const db = dbOf(req);
    const { rows } = await db.query('SELECT * FROM ai_feature_settings');
    const byKey = new Map(rows.map((r) => [r.feature_key, r]));
    const usage = req.user.role === 'admin' ? await gateway.usageSummary(db) : {};
    const list = catalog.FEATURES.map((f) => featureView(f, byKey.get(f.key), usage[f.key]));
    // Non-admins only need to know which features are on.
    if (req.user.role !== 'admin') {
      return res.json(list.map(({ key, module, is_enabled, attestationRequired, reviewerRoles }) =>
        ({ key, module, is_enabled, attestationRequired, reviewerRoles })));
    }
    res.json(list);
  } catch (err) { fail(res, err, 'to load AI features'); }
});

router.patch('/features/:key', adminOnly, async (req, res) => {
  try {
    const feature = catalog.getFeature(req.params.key);
    if (!feature) return res.status(404).json({ error: 'AiFeatureUnknown', message: 'Unknown AI feature' });
    const db = dbOf(req);
    const { rows: [before] } = await db.query('SELECT * FROM ai_feature_settings WHERE feature_key = $1', [feature.key]);
    const b = req.body || {};

    const provider = b.provider !== undefined ? (b.provider || null) : before?.provider || null;
    if (provider && !catalog.PROVIDERS[provider]) {
      return res.status(400).json({ error: 'AiProviderUnknown', message: 'Unknown AI provider' });
    }
    const isEnabled = b.is_enabled !== undefined ? b.is_enabled === true : !!before?.is_enabled;
    const model = b.model !== undefined ? (String(b.model || '').trim() || null) : before?.model || null;
    const intOrNull = (v) => (v === null || v === '' ? null : Math.max(0, parseInt(v, 10) || 0));
    const limit = b.monthly_request_limit !== undefined ? intOrNull(b.monthly_request_limit) : before?.monthly_request_limit ?? null;
    const budget = b.monthly_budget_usd !== undefined
      ? (b.monthly_budget_usd === null || b.monthly_budget_usd === '' ? null : Math.max(0, Number(b.monthly_budget_usd) || 0))
      : before?.monthly_budget_usd ?? null;
    const ttl = b.draft_ttl_hours !== undefined ? Math.min(720, Math.max(1, parseInt(b.draft_ttl_hours, 10) || 72)) : before?.draft_ttl_hours ?? 72;

    if (isEnabled) {
      // Switching on needs a connected provider that is allowed to receive this data.
      if (!provider) return res.status(409).json({ error: 'AiProviderNotSelected', message: 'Choose an AI provider first.' });
      const { rows: [cred] } = await db.query('SELECT * FROM ai_provider_credentials WHERE provider = $1', [provider]);
      if (!cred || !cred.is_enabled) {
        return res.status(409).json({ error: 'AiProviderDisabled', message: 'Connect and switch on that provider first.' });
      }
      if (feature.sendsPhi && catalog.PROVIDERS[provider].requiresBaa && !cred.baa_confirmed) {
        return res.status(412).json({ error: 'AiBaaRequired', message: 'Confirm a BAA/DPA with this provider before enabling features that use patient data.' });
      }
    }

    const newlyEnabled = isEnabled && !before?.is_enabled;
    const { rows: [row] } = await db.query(
      `INSERT INTO ai_feature_settings (feature_key, is_enabled, provider, model, monthly_request_limit,
            monthly_budget_usd, draft_ttl_hours, enabled_by, enabled_at, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (feature_key) DO UPDATE SET
            is_enabled = EXCLUDED.is_enabled, provider = EXCLUDED.provider, model = EXCLUDED.model,
            monthly_request_limit = EXCLUDED.monthly_request_limit, monthly_budget_usd = EXCLUDED.monthly_budget_usd,
            draft_ttl_hours = EXCLUDED.draft_ttl_hours,
            enabled_by = COALESCE(EXCLUDED.enabled_by, ai_feature_settings.enabled_by),
            enabled_at = COALESCE(EXCLUDED.enabled_at, ai_feature_settings.enabled_at),
            updated_by = EXCLUDED.updated_by, updated_at = NOW()
       RETURNING *`,
      [feature.key, isEnabled, provider, model, limit, budget, ttl,
        newlyEnabled ? req.user.id : null, newlyEnabled ? new Date() : null, req.user.id]
    );

    const pick = (r) => r && ({
      is_enabled: r.is_enabled, provider: r.provider, model: r.model,
      monthly_request_limit: r.monthly_request_limit,
      monthly_budget_usd: r.monthly_budget_usd != null ? Number(r.monthly_budget_usd) : null,
      draft_ttl_hours: r.draft_ttl_hours,
    });
    const toggled = !!before?.is_enabled !== isEnabled;
    await logAiAudit(req, {
      action: toggled ? (isEnabled ? 'ai_feature_enabled' : 'ai_feature_disabled') : 'ai_feature_updated',
      resourceType: 'ai_feature', resourceId: row.id, resourceName: feature.key,
      oldValues: pick(before) || null, newValues: pick(row),
    });
    if (toggled) {
      await notifyRoles(req, Array.from(new Set(['admin', ...feature.reviewerRoles])), 'ai_feature',
        `AI feature "${feature.key}" was turned ${isEnabled ? 'on' : 'off'}.`, { excludeUserId: req.user.id });
    }
    const usage = await gateway.usageSummary(db);
    res.json(featureView(feature, row, usage[feature.key]));
  } catch (err) { fail(res, err, 'to update AI feature'); }
});

router.get('/usage', adminOnly, async (req, res) => {
  try {
    res.json(await gateway.usageSummary(dbOf(req)));
  } catch (err) { fail(res, err, 'to load AI usage'); }
});

// ── run + review (human in the loop) ────────────────────────────────────────────────

router.post('/features/:key/run', staffOnly, async (req, res) => {
  try {
    const { input, patientId, entityType, entityId } = req.body || {};
    const out = await gateway.runFeature(req, {
      featureKey: req.params.key, input, patientId: patientId || null,
      entityType: entityType || null, entityId: entityId || null,
    });
    res.status(201).json(out);
  } catch (err) { fail(res, err, 'to run AI feature'); }
});

router.get('/suggestions', staffOnly, async (req, res) => {
  try {
    const list = await gateway.listSuggestions(req, {
      status: req.query.status || 'pending', featureKey: req.query.feature || null, limit: req.query.limit,
    });
    // Drafts contain PHI once re-identified, so reading them is a PHI read.
    const patients = [...new Set(list.map((s) => s.patientId).filter(Boolean))];
    for (const pid of patients) {
      await logPhiRead(req, { resourceType: 'ai_suggestion', patientId: pid, action: 'list', description: 'Viewed AI drafts' });
    }
    res.json(list);
  } catch (err) { fail(res, err, 'to load AI drafts'); }
});

router.post('/suggestions/:id/review', staffOnly, async (req, res) => {
  try {
    const { action, finalText, reason, attested } = req.body || {};
    res.json(await gateway.reviewSuggestion(req, req.params.id, { action, finalText, reason, attested }));
  } catch (err) { fail(res, err, 'to review AI draft'); }
});

module.exports = router;
