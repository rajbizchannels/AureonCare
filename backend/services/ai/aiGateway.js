// AI gateway: the only path from AureonCare to an AI provider.
//
//   runFeature  check switch + key + BAA + quota -> anonymize -> store token map ->
//               call provider -> re-identify -> store a PENDING draft -> notify reviewers
//   review      a reviewer accepts, edits or rejects a draft (the human in the loop)
//
// What it never does: write AI output into a clinical, billing or messaging record. A
// draft becomes usable only after a person with a reviewer role acts on it, and the
// calling screen then applies the approved text through its normal save path.

const crypto = require('crypto');
const { encrypt, decrypt } = require('../../utils/messageCrypto');
const catalog = require('./featureCatalog');
const { anonymize, deanonymize, entitiesFromPatient } = require('./phiAnonymizer');
const { getAdapter, ProviderError } = require('./providers');
const { logAiAudit, notifyRoles, notifyUser } = require('./aiAudit');

const MAX_INPUT_CHARS = 60000;

class GatewayError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    Object.assign(this, extra);
  }
}

const dbOf = (req) => req.db || req.app.locals.pool;
const roleOf = (req) => (req.user && (req.user.activeRole || req.user.role)) || null;
const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

// ── settings ────────────────────────────────────────────────────────────────────────

async function getFeatureSetting(db, featureKey) {
  const { rows } = await db.query('SELECT * FROM ai_feature_settings WHERE feature_key = $1', [featureKey]);
  return rows[0] || null;
}

async function getCredential(db, provider) {
  const { rows } = await db.query('SELECT * FROM ai_provider_credentials WHERE provider = $1', [provider]);
  return rows[0] || null;
}

/** Decrypt the stored key. Never leaves the server. */
function apiKeyOf(cred) {
  if (!cred || !cred.api_key_ciphertext) return null;
  return decrypt({ ciphertext: cred.api_key_ciphertext, iv: cred.api_key_iv, tag: cred.api_key_tag });
}

/** Resolve provider + model for a feature, refusing anything not ready for PHI. */
async function resolveRoute(db, feature, setting) {
  const provider = setting.provider;
  if (!provider) throw new GatewayError(409, 'AiProviderNotSelected', 'Choose an AI provider for this feature first.');
  const meta = catalog.PROVIDERS[provider];
  const cred = await getCredential(db, provider);
  if (!cred || !cred.is_enabled) {
    throw new GatewayError(409, 'AiProviderDisabled', 'The selected AI provider is not connected or is switched off.');
  }
  const apiKey = apiKeyOf(cred);
  if (provider !== 'offline' && !apiKey) {
    throw new GatewayError(409, 'AiProviderKeyMissing', 'Add your API key for the selected AI provider.');
  }
  if (meta.requiresBaa && !cred.baa_confirmed) {
    throw new GatewayError(412, 'AiBaaRequired',
      'Confirm that a BAA/DPA is signed with this provider before patient data can be sent.');
  }
  const model = setting.model || cred.default_model || meta.defaultModel;
  return { provider, model, cred, apiKey };
}

async function monthUsage(db, featureKey) {
  const { rows } = await db.query(
    `SELECT count(*)::int AS requests, COALESCE(sum(estimated_cost_usd), 0)::float AS cost
       FROM ai_requests
      WHERE feature_key = $1 AND status = 'succeeded'
        AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)`,
    [featureKey]
  );
  return rows[0];
}

async function enforceQuota(req, feature, setting) {
  const limit = setting.monthly_request_limit;
  const budget = setting.monthly_budget_usd != null ? Number(setting.monthly_budget_usd) : null;
  if (!limit && !budget) return;
  const usage = await monthUsage(dbOf(req), feature.key);
  if ((limit && usage.requests >= limit) || (budget && usage.cost >= budget)) {
    await notifyRoles(req, ['admin'], 'ai_quota',
      `AI feature "${feature.key}" reached its monthly limit and is paused until next month.`);
    throw new GatewayError(429, 'AiQuotaReached', 'This AI feature has reached its monthly limit.');
  }
  // Warn once when crossing 80% of the request cap.
  if (limit && usage.requests + 1 === Math.ceil(limit * 0.8)) {
    await notifyRoles(req, ['admin'], 'ai_quota',
      `AI feature "${feature.key}" has used 80% of its monthly limit (${usage.requests + 1}/${limit}).`);
  }
}

// ── generate ────────────────────────────────────────────────────────────────────────

/**
 * Run one AI feature and return a pending draft.
 *
 * @param {object} args
 * @param {string} args.featureKey
 * @param {string} args.input            free text the feature works on
 * @param {string} [args.patientId]      when set, that patient's identifiers are removed first
 * @param {string} [args.entityType]     e.g. 'medical_record', 'claim', 'message'
 * @param {string} [args.entityId]
 * @param {Array}  [args.entities]       extra known PHI values: [{category, value}]
 */
async function runFeature(req, { featureKey, input, patientId = null, entityType = null, entityId = null, entities = [] }) {
  const db = dbOf(req);
  const feature = catalog.getFeature(featureKey);
  if (!feature) throw new GatewayError(404, 'AiFeatureUnknown', 'Unknown AI feature.');
  if (!req.user || req.user.role === 'patient') throw new GatewayError(403, 'Forbidden', 'Staff only.');

  const text = String(input || '').trim();
  if (!text) throw new GatewayError(400, 'AiInputRequired', 'Provide the text the AI should work on.');
  if (text.length > MAX_INPUT_CHARS) throw new GatewayError(413, 'AiInputTooLarge', 'The text is too long for one request.');

  const setting = await getFeatureSetting(db, featureKey);
  if (!setting || !setting.is_enabled) {
    throw new GatewayError(409, 'AiFeatureDisabled', 'This AI feature is switched off by your administrator.');
  }
  const route = await resolveRoute(db, feature, setting);
  await enforceQuota(req, feature, setting);

  // 1. Anonymize.
  let known = [...entities];
  if (patientId) {
    const { rows } = await db.query(
      `SELECT first_name, last_name, mrn, date_of_birth, phone, email, address, city, zip, insurance_id
         FROM patients WHERE id = $1`,
      [patientId]
    );
    if (!rows.length) throw new GatewayError(404, 'PatientNotFound', 'Patient not found.');
    known = known.concat(entitiesFromPatient(rows[0]));
  }
  const anon = anonymize(text, { entities: known });
  const system = `${feature.system}\n\n${catalog.TOKEN_INSTRUCTION}`;

  // 2. Record the request and the token map BEFORE anything is sent.
  const { rows: [request] } = await db.query(
    `INSERT INTO ai_requests (feature_key, user_id, provider, model, prompt_template_version, input_hash,
                              entity_type, entity_id, patient_id, phi_tokens_count, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'started') RETURNING id, created_at`,
    [feature.key, req.user.id || null, route.provider, route.model, feature.promptVersion,
      sha256(system + '\n' + anon.text), entityType, entityId ? String(entityId) : null, patientId, anon.entries.length]
  );
  for (const e of anon.entries) {
    const enc = encrypt(e.value);
    await db.query(
      `INSERT INTO ai_phi_token_map (request_id, token, phi_category, detection_method,
                                     original_ciphertext, original_iv, original_tag, key_version, occurrences)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [request.id, e.token, e.category, e.method, enc.ciphertext, enc.iv, enc.tag, enc.keyVersion, e.occurrences]
    );
  }

  // 3. Call the provider with the anonymized text only.
  const started = Date.now();
  let result;
  try {
    result = await getAdapter(route.provider).complete({
      apiKey: route.apiKey,
      baseUrl: route.cred.base_url,
      apiVersion: route.cred.api_version,
      model: route.model,
      system,
      prompt: anon.text,
    });
  } catch (err) {
    const refused = err instanceof ProviderError && err.refused;
    await db.query(
      `UPDATE ai_requests SET status = $2, error_message = $3, latency_ms = $4, completed_at = NOW() WHERE id = $1`,
      [request.id, refused ? 'refused' : 'failed', String(err.message || err).slice(0, 500), Date.now() - started]
    );
    await logAiAudit(req, {
      action: 'ai_generate', resourceType: 'ai_request', resourceId: request.id, resourceName: feature.key,
      patientId, status: 'failure', errorMessage: String(err.message || err).slice(0, 500),
      metadata: { provider: route.provider, model: route.model, phiTokens: anon.entries.length },
    });
    throw err;
  }

  // 4. Re-identify ("onymize") and note which tokens came back.
  const restored = deanonymize(result.text, anon.entries);
  if (restored.restoredTokens.length) {
    await db.query(
      `UPDATE ai_phi_token_map SET restored_in_response = true WHERE request_id = $1 AND token = ANY($2)`,
      [request.id, restored.restoredTokens]
    );
  }
  const cost = catalog.estimateCost(result.servedModel, result.inputTokens || 0, result.outputTokens || 0)
    ?? catalog.estimateCost(route.model, result.inputTokens || 0, result.outputTokens || 0);
  await db.query(
    `UPDATE ai_requests SET status = 'succeeded', stop_reason = $2, input_tokens = $3, output_tokens = $4,
            estimated_cost_usd = $5, latency_ms = $6, completed_at = NOW() WHERE id = $1`,
    [request.id, result.stopReason, result.inputTokens, result.outputTokens,
      route.provider === 'offline' ? 0 : cost, Date.now() - started]
  );

  // 5. Store the draft as PENDING. Nothing is applied anywhere.
  const enc = encrypt(restored.text);
  const { rows: [suggestion] } = await db.query(
    `INSERT INTO ai_suggestions (request_id, feature_key, entity_type, entity_id, patient_id,
                                 draft_ciphertext, draft_iv, draft_tag, draft_key_version,
                                 requested_by, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, NOW() + make_interval(hours => $11))
     RETURNING id, status, expires_at, created_at`,
    [request.id, feature.key, entityType, entityId ? String(entityId) : null, patientId,
      enc.ciphertext, enc.iv, enc.tag, enc.keyVersion, req.user.id || null, setting.draft_ttl_hours || 72]
  );

  await logAiAudit(req, {
    action: 'ai_generate', resourceType: 'ai_suggestion', resourceId: suggestion.id, resourceName: feature.key,
    patientId,
    description: `AI draft created by ${feature.key} (${anon.entries.length} PHI value(s) anonymized before sending)`,
    metadata: {
      requestId: request.id, provider: route.provider, model: result.servedModel || route.model,
      promptVersion: feature.promptVersion, phiTokens: anon.entries.length,
      inputTokens: result.inputTokens, outputTokens: result.outputTokens, unknownTokens: restored.unknownTokens.length,
    },
  });

  // 6. Tell the reviewers.
  const requesterCanReview = feature.reviewerRoles.includes(roleOf(req));
  if (requesterCanReview) {
    await notifyUser(req, req.user.id, 'ai_draft', `Your AI draft (${feature.key}) is ready for review.`);
  } else {
    await notifyRoles(req, feature.reviewerRoles, 'ai_draft',
      `An AI draft (${feature.key}) is waiting for your review.`, { excludeUserId: req.user.id });
  }

  return {
    id: suggestion.id,
    requestId: request.id,
    featureKey: feature.key,
    status: suggestion.status,
    draft: restored.text,
    unknownTokens: restored.unknownTokens,
    phiTokensCount: anon.entries.length,
    attestationRequired: feature.attestationRequired,
    reviewerRoles: feature.reviewerRoles,
    canReview: requesterCanReview,
    expiresAt: suggestion.expires_at,
    createdAt: suggestion.created_at,
    provider: route.provider,
    model: result.servedModel || route.model,
    estimatedCostUsd: route.provider === 'offline' ? 0 : cost,
  };
}

// ── review (human in the loop) ──────────────────────────────────────────────────────

/** Share of words changed between draft and final (0 = untouched, 100 = rewritten). */
function editDistancePct(a, b) {
  const wa = String(a || '').split(/\s+/).filter(Boolean);
  const wb = String(b || '').split(/\s+/).filter(Boolean);
  if (!wa.length && !wb.length) return 0;
  const counts = new Map();
  wa.forEach((w) => counts.set(w, (counts.get(w) || 0) + 1));
  let common = 0;
  wb.forEach((w) => {
    const c = counts.get(w) || 0;
    if (c > 0) { common += 1; counts.set(w, c - 1); }
  });
  return Math.round((1 - common / Math.max(wa.length, wb.length)) * 10000) / 100;
}

async function expireStale(db) {
  await db.query(
    `UPDATE ai_suggestions SET status = 'expired', updated_at = NOW()
      WHERE status = 'pending' AND expires_at < NOW()`
  );
}

function decryptDraft(row) {
  return decrypt({ ciphertext: row.draft_ciphertext, iv: row.draft_iv, tag: row.draft_tag });
}

function decryptFinal(row) {
  if (!row.final_ciphertext) return null;
  return decrypt({ ciphertext: row.final_ciphertext, iv: row.final_iv, tag: row.final_tag });
}

/**
 * @param {'accept'|'edit'|'reject'} action
 */
async function reviewSuggestion(req, id, { action, finalText, reason, attested }) {
  const db = dbOf(req);
  if (!['accept', 'edit', 'reject'].includes(action)) {
    throw new GatewayError(400, 'AiReviewActionInvalid', 'Action must be accept, edit or reject.');
  }
  await expireStale(db);
  const { rows } = await db.query('SELECT * FROM ai_suggestions WHERE id = $1', [id]);
  const row = rows[0];
  if (!row) throw new GatewayError(404, 'AiSuggestionNotFound', 'Draft not found.');
  const feature = catalog.getFeature(row.feature_key);

  if (!feature.reviewerRoles.includes(roleOf(req))) {
    await logAiAudit(req, {
      action: 'ai_review_denied', resourceType: 'ai_suggestion', resourceId: id, resourceName: row.feature_key,
      patientId: row.patient_id, status: 'failure', errorMessage: 'role not permitted to review',
    });
    throw new GatewayError(403, 'AiReviewForbidden', 'Your role cannot review this type of AI draft.');
  }
  if (row.status === 'expired') throw new GatewayError(409, 'AiSuggestionExpired', 'This draft has expired. Generate a new one.');
  if (row.status !== 'pending') throw new GatewayError(409, 'AiSuggestionReviewed', 'This draft has already been reviewed.');

  const draft = decryptDraft(row);
  let final = null;
  let status;
  if (action === 'reject') {
    if (!reason || !String(reason).trim()) throw new GatewayError(400, 'AiRejectReasonRequired', 'Give a reason for rejecting the draft.');
    status = 'rejected';
  } else {
    if (feature.attestationRequired && attested !== true) {
      throw new GatewayError(400, 'AiAttestationRequired', 'Confirm you reviewed the draft and take responsibility for it.');
    }
    if (action === 'edit') {
      if (!finalText || !String(finalText).trim()) throw new GatewayError(400, 'AiFinalTextRequired', 'The edited text is empty.');
      final = String(finalText);
      status = final.trim() === String(draft || '').trim() ? 'accepted' : 'edited';
    } else {
      final = draft;
      status = 'accepted';
    }
  }

  const enc = final != null ? encrypt(final) : null;
  const pct = final != null ? editDistancePct(draft, final) : null;
  const { rows: [updated] } = await db.query(
    `UPDATE ai_suggestions
        SET status = $2, reviewed_by = $3, reviewed_at = NOW(), review_reason = $4, attested = $5,
            final_ciphertext = $6, final_iv = $7, final_tag = $8, final_key_version = $9,
            edit_distance_pct = $10, updated_at = NOW()
      WHERE id = $1 AND status = 'pending'
      RETURNING id, status, reviewed_at`,
    [id, status, req.user.id, reason ? String(reason).slice(0, 2000) : null, attested === true,
      enc && enc.ciphertext, enc && enc.iv, enc && enc.tag, enc && enc.keyVersion, pct]
  );
  if (!updated) throw new GatewayError(409, 'AiSuggestionReviewed', 'This draft has already been reviewed.');

  await logAiAudit(req, {
    action: `ai_review_${status}`, resourceType: 'ai_suggestion', resourceId: id, resourceName: row.feature_key,
    patientId: row.patient_id,
    description: `AI draft ${status} by reviewer${pct != null ? ` (${pct}% changed)` : ''}`,
    metadata: { requestId: row.request_id, attested: attested === true, editDistancePct: pct },
  });
  if (row.requested_by && row.requested_by !== req.user.id) {
    await notifyUser(req, row.requested_by, 'ai_review', `Your AI draft (${row.feature_key}) was ${status}.`);
  }

  return { id, status: updated.status, reviewedAt: updated.reviewed_at, finalText: final, editDistancePct: pct };
}

// ── read ────────────────────────────────────────────────────────────────────────────

function featuresReviewableBy(role) {
  return catalog.FEATURES.filter((f) => f.reviewerRoles.includes(role)).map((f) => f.key);
}

/** Drafts this user may see: ones they can review, plus ones they asked for. */
async function listSuggestions(req, { status = 'pending', featureKey = null, limit = 50 } = {}) {
  const db = dbOf(req);
  await expireStale(db);
  const reviewable = featuresReviewableBy(roleOf(req));
  const params = [reviewable, req.user.id];
  let where = '(s.feature_key = ANY($1) OR s.requested_by = $2)';
  if (status && status !== 'all') { params.push(status); where += ` AND s.status = $${params.length}`; }
  if (featureKey) { params.push(featureKey); where += ` AND s.feature_key = $${params.length}`; }
  params.push(Math.min(parseInt(limit, 10) || 50, 200));
  const { rows } = await db.query(
    `SELECT s.*, r.provider, r.model, r.phi_tokens_count, r.estimated_cost_usd,
            p.first_name AS patient_first_name, p.last_name AS patient_last_name
       FROM ai_suggestions s
       JOIN ai_requests r ON r.id = s.request_id
       LEFT JOIN patients p ON p.id = s.patient_id
      WHERE ${where}
      ORDER BY s.created_at DESC
      LIMIT $${params.length}`,
    params
  );
  return rows.map((row) => {
    const feature = catalog.getFeature(row.feature_key);
    return {
      id: row.id,
      featureKey: row.feature_key,
      status: row.status,
      entityType: row.entity_type,
      entityId: row.entity_id,
      patientId: row.patient_id,
      patientName: row.patient_first_name ? `${row.patient_first_name} ${row.patient_last_name}` : null,
      draft: decryptDraft(row),
      finalText: decryptFinal(row),
      provider: row.provider,
      model: row.model,
      phiTokensCount: row.phi_tokens_count,
      estimatedCostUsd: row.estimated_cost_usd != null ? Number(row.estimated_cost_usd) : null,
      attestationRequired: feature ? feature.attestationRequired : false,
      canReview: reviewable.includes(row.feature_key),
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      reviewReason: row.review_reason,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    };
  });
}

/** Month-to-date usage per feature, for the cost column on the Integrations page. */
async function usageSummary(db) {
  const { rows } = await db.query(
    `SELECT feature_key,
            count(*) FILTER (WHERE status = 'succeeded')::int AS requests,
            count(*) FILTER (WHERE status IN ('failed','refused','blocked'))::int AS failures,
            COALESCE(sum(estimated_cost_usd), 0)::float AS cost_usd,
            COALESCE(sum(phi_tokens_count), 0)::int AS phi_values_anonymized
       FROM ai_requests
      WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP)
      GROUP BY feature_key`
  );
  const { rows: review } = await db.query(
    `SELECT feature_key, status, count(*)::int AS n
       FROM ai_suggestions
      WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP)
      GROUP BY feature_key, status`
  );
  const out = {};
  rows.forEach((r) => { out[r.feature_key] = { ...r, reviews: {} }; });
  review.forEach((r) => {
    out[r.feature_key] = out[r.feature_key] || { feature_key: r.feature_key, requests: 0, failures: 0, cost_usd: 0, reviews: {} };
    out[r.feature_key].reviews[r.status] = r.n;
  });
  return out;
}

module.exports = {
  runFeature,
  reviewSuggestion,
  listSuggestions,
  usageSummary,
  editDistancePct,
  apiKeyOf,
  GatewayError,
};
