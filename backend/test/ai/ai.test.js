// AI integrations, end to end against a real server and database.
//
// A local mock model server stands in for the AI provider (OpenAI-compatible, the same
// shape as an offline Ollama/vLLM). It records every request it receives, so this suite
// can assert on what actually LEFT AureonCare:
//
//   * no patient identifier ever reaches the provider; placeholders do
//   * the draft the reviewer sees has the real values back, exactly
//   * the token map is stored encrypted, per request
//   * nothing is applied without a person: role check, sign-off, reject reason, expiry
//   * BYOK keys are never returned and are stored encrypted
//   * a cloud provider without a BAA/DPA cannot receive patient data
//   * audit rows exist and contain no PHI or keys; reviewers are notified; drafts are searchable
//   * one practice cannot see or review another's drafts

const path = require('path');
const http = require('http');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
const results = [];
const check = (name, cond) => results.push([name, !!cond]);

/**
 * Print the results and leave.
 *
 * Called from the happy path AND from the catch, because a suite that dies partway still
 * knows a great deal: 47 checks may have passed before the thing that killed it. Printing
 * only the exception threw all of that away and left a raw pg error object on screen —
 * twenty lines of `internalPosition: undefined` and no indication of what had been
 * verified, what had not, or how far it got.
 */
const report = (err) => {
  let failed = 0;
  for (const [name, ok] of results) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (!ok) failed += 1;
  }
  if (err) {
    console.log(`\n${results.length - failed}/${results.length} passed before the suite stopped early.`);
    console.error(`\nSTOPPED: ${err.message || err}`);
    // The hint matters more than the stack: every way this suite dies in practice is an
    // environment problem with a specific remedy, and the stack points at the query rather
    // than at the cause.
    const hint = diagnose(err);
    if (hint) console.error(`\n${hint}`);
    console.error('\nFull error:');
    console.error(err);
  } else {
    console.log(`\n${results.length - failed}/${results.length} passed`);
  }
  try { mock.close(); } catch { /* may not be listening yet */ }
  process.exit(err || failed ? 1 : 0);
};

/** Turn the handful of ways this suite dies into the command that fixes each one. */
function diagnose(err) {
  const code = err && err.code;
  const msg = String((err && err.message) || '');
  // Reached when the database goes away DURING the run. A database that is already down
  // when the suite starts never gets here: server.js, required at the top of this file,
  // prints its own (clear) diagnostic and exits the process before this code runs.
  if (code === 'ECONNREFUSED' || /ECONNREFUSED/.test(msg)) {
    return 'The database stopped answering mid-run. Check PostgreSQL is still up, then re-run.';
  }
  if (code === '42P01') {
    const table = (msg.match(/relation "([^"]+)" does not exist/) || [])[1] || 'a tenant table';
    if (/^ai_/.test(table)) {
      return `The AI tables are missing from the tenant schemas (${table}).\n`
        + 'They are created by migrations/tenant/010_ai_integrations.sql and registered for new\n'
        + 'tenants by 087, so BOTH runners have to have run, in this order:\n'
        + '  npm run migrate          # global: registers the tables in control.tenant_tables\n'
        + '  npm run migrate:tenants  # tenant: creates them in every schema AND in `template`\n'
        + 'A tenant provisioned before the tenant run is cloned from `template`, so it has none\n'
        + 'of them — which is what this suite hits, because it provisions its own practices.';
    }
    return `A table this suite needs does not exist (${table}). Run: npm run migrate && npm run migrate:tenants`;
  }
  if (code === '28P01' || /password authentication failed/.test(msg)) {
    return 'The database rejected the credentials. Check AC_DB_U / AC_DB_W in backend/.env.';
  }
  if (/fetch failed/.test(msg)) {
    return 'The backend did not answer. Look further up this output for the reason it failed to start.';
  }
  return null;
}

process.env.PORT = process.env.TEST_PORT || '4898';
process.env.NODE_ENV = 'development';
process.env.AC_COOKIE_INSECURE = 'true';
process.env.AC_RL_TEST_BYPASS = '1';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_TK_S = process.env.AC_TK_S || crypto.randomBytes(48).toString('base64');
process.env.AC_MSG_KEY = process.env.AC_MSG_KEY || crypto.randomBytes(32).toString('hex');
const BASE = `http://127.0.0.1:${process.env.PORT}`;

const pool = require(path.join(BACKEND, 'db.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));

const PLAN_CLINICAL_PRO = 2;

// ── mock model server ────────────────────────────────────────────────────────────
const received = [];
const mock = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    received.push({ url: req.url, body });
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'GET' && req.url.endsWith('/models')) {
      return res.end(JSON.stringify({ data: [{ id: 'mock-model' }] }));
    }
    const json = JSON.parse(body || '{}');
    const user = (json.messages || []).find((m) => m.role === 'user');
    const prompt = user ? user.content : '';
    // Echo the prompt back so the round trip can be compared exactly; "GHOST" triggers a
    // placeholder the gateway never issued.
    const content = prompt.includes('GHOST') ? `DRAFT: ${prompt} [[GHOST_9]]` : `DRAFT: ${prompt}`;
    res.end(JSON.stringify({
      model: json.model,
      choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 120, completion_tokens: 80 },
    }));
  });
});

require(path.join(BACKEND, 'server.js'));

const api = async (method, url, body, token) => {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, body: json };
};

const tenantSql = (schema) => async (text, params) => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(`SET LOCAL search_path TO ${schema}, public, control`);
    const out = await c.query(text, params);
    await c.query('COMMIT');
    return out;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { c.release(); }
};

const PW = 'A-Strong-Passphrase!23';

(async () => {
  await new Promise((r) => mock.listen(0, '127.0.0.1', r));
  const MOCK_URL = `http://127.0.0.1:${mock.address().port}/v1`;
  for (let i = 0; i < 40; i++) {
    try { await fetch(BASE + '/health'); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  // Checked up front, against `template`, because that is what a new tenant is cloned
  // from: every practice this suite provisions gets its tables from there. Reported here
  // the problem costs one line; discovered on the fiftieth check it used to surface as a
  // bare 42P01 with no sign of what had already passed.
  const AI_TABLES = ['ai_provider_credentials', 'ai_feature_settings', 'ai_requests',
    'ai_phi_token_map', 'ai_suggestions'];
  const { rows: present } = await pool.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'template' AND table_name = ANY($1::text[])`, [AI_TABLES]);
  const missing = AI_TABLES.filter((t) => !present.some((r) => r.table_name === t));
  if (missing.length) {
    const e = new Error(`relation "${missing[0]}" does not exist`);
    e.code = '42P01';
    throw e;
  }

  console.log('\nAI integrations\n');

  const RUN = crypto.randomBytes(4).toString('hex');
  const DOMAIN = `ai-${RUN}.example`;

  const mkPractice = async (label) => {
    const { practiceId, tenant } = await provisionTenant(pool, {
      name: `AI ${label} ${RUN}`, planId: PLAN_CLINICAL_PRO, country: 'GB', timezone: 'Europe/London',
    });
    const mkUser = async (role, tag) => {
      const email = `${tag}_${label}_${RUN}@${DOMAIN}`;
      const hash = await bcrypt.hash(PW, 12);
      const { rows } = await pool.query(
        `INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
         VALUES (gen_random_uuid(),$1,$2,'Person',$3,'active',$4,$5,NOW()) RETURNING id`,
        [email, tag, role, hash, practiceId]
      );
      const login = await api('POST', '/api/auth/login', { email, password: PW });
      return { id: rows[0].id, token: login.body && login.body.token };
    };
    return {
      schema: tenant.schema_name, sql: tenantSql(tenant.schema_name),
      admin: await mkUser('admin', 'admin'),
      doctor: await mkUser('doctor', 'doc'),
      reception: await mkUser('receptionist', 'rec'),
    };
  };

  const A = await mkPractice('A');
  const B = await mkPractice('B');
  check('users can sign in', Boolean(A.admin.token && A.doctor.token && A.reception.token && B.admin.token));

  const { rows: [pat] } = await A.sql(
    `INSERT INTO patients (id, mrn, first_name, last_name, date_of_birth, phone, email, address, city, zip, insurance_id)
     VALUES (gen_random_uuid(), 'MRN-77${RUN}', 'Leila', 'Haddad', '1975-06-09', '(555) 987-6543',
             'leila.haddad@example.com', '8 Elm Street', 'Springfield', '62704', 'INS-445566')
     RETURNING id, mrn`
  );
  const PHI = ['Leila', 'Haddad', pat.mrn, '06/09/1975', '(555) 987-6543', 'leila.haddad@example.com',
    '8 Elm Street', 'Springfield', 'INS-445566', '123-45-6789'];
  const visitText = `Leila Haddad (MRN ${pat.mrn}, DOB 06/09/1975) seen today. Phone (555) 987-6543, `
    + `email leila.haddad@example.com, lives at 8 Elm Street, Springfield. SSN 123-45-6789. `
    + `Insurance INS-445566. Complains of headache for 3 days, no fever. BP 130/85. Plan: hydration, review in 1 week.`;

  // ── providers (BYOK) ────────────────────────────────────────────────────────
  const notAdmin = await api('GET', '/api/ai/providers', undefined, A.doctor.token);
  check('only admins can see provider settings', notAdmin.status === 403);

  const provs = await api('GET', '/api/ai/providers', undefined, A.admin.token);
  check('six providers are listed', provs.status === 200 && provs.body.length === 6);

  const KEY = `sk-test-${RUN}-ABCDEFGH1234`;
  const savedKey = await api('PUT', '/api/ai/providers/openai', { api_key: KEY }, A.admin.token);
  check('an admin can save their own OpenAI key', savedKey.status === 200 && savedKey.body.has_api_key === true);
  check('only the last 4 characters come back', savedKey.body.api_key_last4 === '1234');
  check('the key is never returned', !JSON.stringify(savedKey.body).includes(KEY) && !('api_key_ciphertext' in savedKey.body));
  const { rows: [credRow] } = await A.sql(`SELECT * FROM ai_provider_credentials WHERE provider = 'openai'`);
  check('the key is stored encrypted', credRow.api_key_ciphertext && !credRow.api_key_ciphertext.includes(KEY) && !JSON.stringify(credRow).includes(KEY));

  const keepKey = await api('PUT', '/api/ai/providers/openai', { api_key: '' }, A.admin.token);
  const { rows: [credRow2] } = await A.sql(`SELECT api_key_ciphertext FROM ai_provider_credentials WHERE provider = 'openai'`);
  check('saving with a blank key keeps the stored key', keepKey.status === 200 && credRow2.api_key_ciphertext === credRow.api_key_ciphertext);

  await api('PATCH', '/api/ai/providers/openai/toggle', { is_enabled: true }, A.admin.token);
  const noBaa = await api('PATCH', '/api/ai/features/ambient_scribe', { provider: 'openai', is_enabled: true }, A.admin.token);
  check('a PHI feature cannot be switched on for a provider without a BAA/DPA', noBaa.status === 412 && noBaa.body.error === 'AiBaaRequired');

  const ssrf = await api('PUT', '/api/ai/providers/offline', { base_url: 'http://169.254.169.254/latest' }, A.admin.token);
  check('the cloud metadata address is refused as an offline server', ssrf.status === 400);

  const off = await api('PUT', '/api/ai/providers/offline', { base_url: MOCK_URL, default_model: 'mock-model' }, A.admin.token);
  check('an offline model server can be configured', off.status === 200 && off.body.configured === true);
  const test = await api('POST', '/api/ai/providers/offline/test', undefined, A.admin.token);
  check('test connection lists models without sending a prompt', test.status === 200 && test.body.test_status === 'success'
    && received.every((r) => !r.url.includes('chat')));
  const tog = await api('PATCH', '/api/ai/providers/offline/toggle', { is_enabled: true }, A.admin.token);
  check('the offline provider can be switched on', tog.status === 200 && tog.body.is_enabled === true);

  // ── features ───────────────────────────────────────────────────────────────
  const feats = await api('GET', '/api/ai/features', undefined, A.admin.token);
  check('12 features are listed for the admin', feats.status === 200 && feats.body.length === 12);
  check('every feature starts switched off', feats.body.every((f) => f.is_enabled === false));

  const coding = await api('PATCH', '/api/ai/features/coding_suggestions', { provider: 'openai', model: 'gpt-5' }, A.admin.token);
  check('cost guidance is shown for the chosen model (gpt-5 ≈ $0.008/use)',
    coding.status === 200 && Math.abs(coding.body.costGuidance.perUseUsd - 0.008) < 1e-9);

  const on = await api('PATCH', '/api/ai/features/ambient_scribe',
    { provider: 'offline', model: 'mock-model', is_enabled: true }, A.admin.token);
  check('the admin can switch the scribe on', on.status === 200 && on.body.is_enabled === true);
  check('offline cost guidance is $0', on.body.costGuidance.offline === true && on.body.costGuidance.perUseUsd === 0);

  const docFeats = await api('GET', '/api/ai/features', undefined, A.doctor.token);
  check('staff see which features are on, without admin details',
    docFeats.status === 200 && docFeats.body.find((f) => f.key === 'ambient_scribe').is_enabled === true
    && !('costGuidance' in docFeats.body[0]));
  const docToggle = await api('PATCH', '/api/ai/features/ambient_scribe', { is_enabled: false }, A.doctor.token);
  check('a doctor cannot switch features on or off', docToggle.status === 403);

  const disabled = await api('POST', '/api/ai/features/lab_explanations/run', { input: 'x' }, A.doctor.token);
  check('a switched-off feature refuses to run', disabled.status === 409 && disabled.body.error === 'AiFeatureDisabled');

  // ── generate: anonymize -> send -> onymize ─────────────────────────────────
  const { rows: [{ n: recordsBefore }] } = await A.sql('SELECT count(*)::int AS n FROM medical_records').catch(() => ({ rows: [{ n: null }] }));
  const sentBefore = received.length;
  const gen = await api('POST', '/api/ai/features/ambient_scribe/run',
    { input: visitText, patientId: pat.id, entityType: 'encounter', entityId: 'enc-1' }, A.doctor.token);
  check('a doctor can generate a scribe draft', gen.status === 201 && gen.body.status === 'pending');

  const sent = received.slice(sentBefore).map((r) => r.body).join('\n');
  for (const value of PHI) {
    check(`"${value}" never reached the AI provider`, sent.length > 0 && !sent.toLowerCase().includes(value.toLowerCase()));
  }
  check('placeholders reached the provider instead', /\[\[PATIENT_NAME_\d+\]\]/.test(sent) && /\[\[MRN_\d+\]\]/.test(sent));
  check('clinical content still reached the provider', sent.includes('headache') && sent.includes('130/85'));
  check('the draft has the real values back, exactly', gen.body.draft === `DRAFT: ${visitText}`);
  check('the draft reports how many identifiers were anonymized', gen.body.phiTokensCount >= 8);

  const { rows: [reqRow] } = await A.sql('SELECT * FROM ai_requests WHERE id = $1', [gen.body.requestId]);
  check('the request is metered', reqRow.status === 'succeeded' && reqRow.input_tokens === 120 && reqRow.output_tokens === 80
    && Number(reqRow.estimated_cost_usd) === 0 && reqRow.input_hash && reqRow.input_hash.length === 64);
  const { rows: mapRows } = await A.sql('SELECT * FROM ai_phi_token_map WHERE request_id = $1', [gen.body.requestId]);
  check('the token map has one row per anonymized value', mapRows.length === gen.body.phiTokensCount);
  check('token map originals are encrypted', mapRows.every((m) => PHI.every((v) => !m.original_ciphertext.includes(v))));
  check('restored tokens are flagged', mapRows.every((m) => m.restored_in_response === true));
  check('record matches are labelled', mapRows.some((m) => m.detection_method === 'record') && mapRows.some((m) => m.detection_method === 'pattern'));
  const { rows: [sugRow] } = await A.sql('SELECT * FROM ai_suggestions WHERE id = $1', [gen.body.id]);
  check('the stored draft is encrypted', !sugRow.draft_ciphertext.includes('Leila'));
  if (recordsBefore !== null) {
    const { rows: [{ n: recordsAfter }] } = await A.sql('SELECT count(*)::int AS n FROM medical_records');
    check('nothing was written to medical records', recordsAfter === recordsBefore);
  }

  // ── human in the loop ──────────────────────────────────────────────────────
  const recReview = await api('POST', `/api/ai/suggestions/${gen.body.id}/review`, { action: 'accept', attested: true }, A.reception.token);
  check('a receptionist cannot approve a clinical draft', recReview.status === 403);
  const noAttest = await api('POST', `/api/ai/suggestions/${gen.body.id}/review`, { action: 'accept' }, A.doctor.token);
  check('a clinical draft needs the sign-off box', noAttest.status === 400 && noAttest.body.error === 'AiAttestationRequired');
  const edited = `${gen.body.draft}\nAssessment: tension headache.`;
  const accept = await api('POST', `/api/ai/suggestions/${gen.body.id}/review`,
    { action: 'edit', finalText: edited, attested: true }, A.doctor.token);
  check('the doctor can edit and accept', accept.status === 200 && accept.body.status === 'edited' && accept.body.finalText === edited);
  check('the share of text changed is recorded', accept.body.editDistancePct > 0);
  const again = await api('POST', `/api/ai/suggestions/${gen.body.id}/review`, { action: 'accept', attested: true }, A.doctor.token);
  check('a reviewed draft cannot be reviewed twice', again.status === 409);

  const gen2 = await api('POST', '/api/ai/features/ambient_scribe/run', { input: 'Short visit, patient well.' }, A.doctor.token);
  const noReason = await api('POST', `/api/ai/suggestions/${gen2.body.id}/review`, { action: 'reject' }, A.doctor.token);
  check('rejecting needs a reason', noReason.status === 400);
  const rej = await api('POST', `/api/ai/suggestions/${gen2.body.id}/review`, { action: 'reject', reason: 'Too vague' }, A.doctor.token);
  check('the doctor can reject with a reason', rej.status === 200 && rej.body.status === 'rejected');

  const gen3 = await api('POST', '/api/ai/features/ambient_scribe/run', { input: 'Follow-up visit.' }, A.doctor.token);
  await A.sql(`UPDATE ai_suggestions SET expires_at = NOW() - interval '1 minute' WHERE id = $1`, [gen3.body.id]);
  const late = await api('POST', `/api/ai/suggestions/${gen3.body.id}/review`, { action: 'accept', attested: true }, A.doctor.token);
  check('an expired draft cannot be accepted', late.status === 409 && late.body.error === 'AiSuggestionExpired');

  const ghost = await api('POST', '/api/ai/features/ambient_scribe/run', { input: 'GHOST check' }, A.doctor.token);
  check('a placeholder the model invented is flagged, not filled', ghost.status === 201 && ghost.body.unknownTokens.includes('[[GHOST_9]]')
    && ghost.body.draft.includes('[[GHOST_9]]'));

  const queue = await api('GET', '/api/ai/suggestions?status=all', undefined, A.doctor.token);
  check('the review queue lists the drafts', queue.status === 200 && queue.body.length >= 4);
  const recQueue = await api('GET', '/api/ai/suggestions?status=all', undefined, A.reception.token);
  check('a receptionist does not see scribe drafts', recQueue.status === 200 && recQueue.body.every((s) => s.featureKey !== 'ambient_scribe'));

  // ── quota ──────────────────────────────────────────────────────────────────
  const { rows: [{ n: used }] } = await A.sql(`SELECT count(*)::int AS n FROM ai_requests WHERE feature_key = 'ambient_scribe' AND status = 'succeeded'`);
  await api('PATCH', '/api/ai/features/ambient_scribe', { monthly_request_limit: used }, A.admin.token);
  const over = await api('POST', '/api/ai/features/ambient_scribe/run', { input: 'one more' }, A.doctor.token);
  check('the monthly limit pauses the feature', over.status === 429 && over.body.error === 'AiQuotaReached');
  await api('PATCH', '/api/ai/features/ambient_scribe', { monthly_request_limit: null }, A.admin.token);

  // ── audit, notifications, search ───────────────────────────────────────────
  const { rows: audits } = await A.sql(`SELECT * FROM audit_logs WHERE module = 'AI'`);
  const actions = new Set(audits.map((r) => r.action_type));
  for (const a of ['ai_provider_created', 'ai_provider_tested', 'ai_provider_enabled', 'ai_feature_enabled',
    'ai_generate', 'ai_review_denied', 'ai_review_edited', 'ai_review_rejected']) {
    check(`audit log has ${a}`, actions.has(a));
  }
  const auditDump = JSON.stringify(audits);
  check('audit rows contain no patient identifiers', PHI.every((v) => !auditDump.includes(v)));
  check('audit rows contain no API key', !auditDump.includes(KEY));
  check('generation audit is linked to the patient', audits.some((r) => r.action_type === 'ai_generate' && r.patient_id === pat.id));

  const { rows: docNotes } = await A.sql('SELECT type FROM notifications WHERE user_id = $1', [A.doctor.id]);
  check('the doctor was told the draft is ready', docNotes.some((n) => n.type === 'ai_draft'));
  check('reviewers were told the feature was switched on', docNotes.some((n) => n.type === 'ai_feature'));
  const { rows: adminNotes } = await A.sql('SELECT type FROM notifications WHERE user_id = $1', [A.admin.id]);
  check('admins were told the limit was reached', adminNotes.some((n) => n.type === 'ai_quota'));

  const search = await api('GET', '/api/search?q=ambient', undefined, A.doctor.token);
  check('AI drafts are searchable', search.status === 200 && search.body.some((r) => r.result_type === 'ai_suggestion'));
  const searchName = await api('GET', '/api/search?q=Haddad', undefined, A.doctor.token);
  check('AI drafts are found by patient name', searchName.status === 200 && searchName.body.some((r) => r.result_type === 'ai_suggestion'));

  const usage = await api('GET', '/api/ai/usage', undefined, A.admin.token);
  check('usage shows month-to-date drafts and review outcomes', usage.status === 200
    && usage.body.ambient_scribe && usage.body.ambient_scribe.requests >= 4 && usage.body.ambient_scribe.reviews.edited === 1);

  // ── tenant isolation ───────────────────────────────────────────────────────
  const bProv = await api('GET', '/api/ai/providers', undefined, B.admin.token);
  check("practice B does not see practice A's keys or servers",
    bProv.status === 200 && bProv.body.every((p) => !p.configured));
  const bQueue = await api('GET', '/api/ai/suggestions?status=all', undefined, B.admin.token);
  check("practice B sees none of practice A's drafts", bQueue.status === 200 && bQueue.body.length === 0);
  const bDoc = await api('POST', `/api/ai/suggestions/${gen3.body.id}/review`, { action: 'reject', reason: 'x' }, B.admin.token);
  check("practice B cannot review practice A's draft", bDoc.status === 403 || bDoc.status === 404);

  // ── remove key ─────────────────────────────────────────────────────────────
  const rm = await api('DELETE', '/api/ai/providers/openai/key', undefined, A.admin.token);
  check('removing the key also switches the provider off', rm.status === 200 && rm.body.has_api_key === false && rm.body.is_enabled === false);

  // ── report ─────────────────────────────────────────────────────────────────
  report();
})().catch(report);
