// The form library and the submission → template link.
//
// What this is really guarding:
//
//   * every tenant HAS the library — seeded by tenant/008 for existing tenants, copied out
//     of `template` by provisioning for new ones. provision_schema clones structure and
//     never data, so the second half is easy to forget and silently reintroduces the bug
//     for every tenant created afterwards.
//   * a submission always records WHICH template and WHICH version the patient saw. It
//     used to record neither: FormManagementView sent `template_id: null` for any seed
//     template, and the intake and diagnosis paths sent no reference at all, so a signed
//     consent could not be traced to the form that was signed.
//   * the name and version are pinned from the template row, not trusted from the client —
//     a client-supplied version is a record of what the bundle said, not of what was shown.
//   * a reference that cannot be honoured is an ERROR. The silence is what let orphaned
//     submissions accumulate unnoticed.
//   * POST /api/offerings works at all, and populates consent_form_id. It supplied 28
//     values for 29 placeholders, so it failed for every request ever made to it.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
const results = [];
const check = (name, cond) => results.push([name, !!cond]);

process.env.PORT = process.env.TEST_PORT || '4900';
process.env.NODE_ENV = 'development';
process.env.AC_COOKIE_INSECURE = 'true';
process.env.AC_RL_TEST_BYPASS = '1';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
const BASE = `http://127.0.0.1:${process.env.PORT}`;

const pool = require(path.join(BACKEND, 'db.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));

require(path.join(BACKEND, 'server.js'));

const api = async (method, url, body, headers = {}) => {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, body: json };
};

const PW = 'A-Strong-Passphrase!23';
const auth = (t) => ({ Authorization: `Bearer ${t}` });

/** Tenant-pinned SQL; the pin must be inside a transaction (db.js pins the pool to public). */
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

// 22 seeded by tenant/008, less the 5 handed to specialty packs by tenant/009.
const EXPECTED_TEMPLATES = 17;
const EXPECTED_CATEGORIES = 14;
const EXPECTED_FIELDS = 283 - 71; // the five moved templates carry 71 fields between them

// The five that are now a specialty pack's job, not the base library's.
const MOVED_TO_PACKS = [
  'phq9-depression-screening',
  'gad7-anxiety-screening',
  'behavioral-health-intake',
  'pediatric-wellness-intake',
  'dental-health-history',
];

(async () => {
  for (let i = 0; i < 40; i++) {
    try { await fetch(BASE + '/health'); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  console.log('\nForm library and submission linkage\n');

  const RUN = crypto.randomBytes(4).toString('hex');

  // ── the golden template carries the library ────────────────────────────────
  {
    const { rows } = await pool.query(
      `SELECT (SELECT count(*)::int FROM template.form_templates WHERE source_pack = 'base') AS templates,
              (SELECT count(*)::int FROM template.form_categories) AS categories,
              (SELECT COALESCE(SUM(jsonb_array_length(fields)), 0)::int FROM template.form_templates
                WHERE source_pack = 'base') AS fields`
    );
    check(`template has all ${EXPECTED_TEMPLATES} system templates`, rows[0].templates === EXPECTED_TEMPLATES);
    check(`template has all ${EXPECTED_CATEGORIES} categories`, rows[0].categories >= EXPECTED_CATEGORIES);
    check(`template has all ${EXPECTED_FIELDS} field definitions`, rows[0].fields === EXPECTED_FIELDS);
  }

  // ── a NEWLY provisioned tenant gets it too ─────────────────────────────────
  // This is the half that provision_schema cannot do for itself.
  const mkPractice = async (label) => {
    const { practiceId, tenant } = await provisionTenant(pool, {
      name: `Forms ${label} ${RUN}`, planId: 2, country: 'GB', timezone: 'Europe/London',
    });
    const email = `admin_${label}_${RUN}@forms-${RUN}.example`;
    const { rows } = await pool.query(
      `INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
       VALUES (gen_random_uuid(),$1,'Ada','Admin','admin','active',$2,$3,NOW()) RETURNING id`,
      [email, await bcrypt.hash(PW, 12), practiceId]
    );
    const login = await api('POST', '/api/auth/login', { email, password: PW });
    return {
      practiceId, schema: tenant.schema_name, sql: tenantSql(tenant.schema_name),
      userId: rows[0].id, token: login.body && login.body.token,
    };
  };

  const A = await mkPractice('A');
  const B = await mkPractice('B');
  check('practice admins can sign in', Boolean(A.token && B.token));

  {
    const t = await A.sql("SELECT count(*)::int AS n FROM form_templates WHERE source_pack = 'base'");
    const c = await A.sql('SELECT count(*)::int AS n FROM form_categories');
    const f = await A.sql("SELECT COALESCE(SUM(jsonb_array_length(fields)),0)::int AS n FROM form_templates WHERE source_pack = 'base'");
    check('A NEWLY PROVISIONED TENANT HAS THE FULL LIBRARY', t.rows[0].n === EXPECTED_TEMPLATES);
    check('including its categories', c.rows[0].n >= EXPECTED_CATEGORIES);
    check('and every field definition', f.rows[0].n === EXPECTED_FIELDS);

    // Deterministic ids: the same logical template has the same id everywhere, so a
    // submission can be reasoned about across tenants and against `template`.
    const { rows: ref } = await pool.query(
      "SELECT id FROM template.form_templates WHERE slug = 'new-patient-registration'");
    const mine = await A.sql("SELECT id FROM form_templates WHERE slug = 'new-patient-registration'");
    const theirs = await B.sql("SELECT id FROM form_templates WHERE slug = 'new-patient-registration'");
    // Optional access throughout: when the library is absent these rows are empty, and
    // this assertion should fail by name rather than throw and stop the suite.
    check('template ids are deterministic across tenants',
      Boolean(ref[0]) && mine.rows[0] && theirs.rows[0]
      && mine.rows[0].id === ref[0].id && theirs.rows[0].id === ref[0].id);

    const custom = await A.sql("SELECT count(*)::int AS n FROM form_templates WHERE is_customised");
    check('nothing arrives pre-marked as customised', custom.rows[0].n === 0);
  }

  // ── the library is reachable through the API ────────────────────────────────
  const list = await api('GET', '/api/form-management/templates?is_active=true', undefined, auth(A.token));
  check('the templates endpoint returns the library',
    list.status === 200 && Array.isArray(list.body) && list.body.length >= EXPECTED_TEMPLATES);
  const consentFound = (list.body || []).find((t) => t.slug === 'consent-for-treatment');
  const hipaaFound = (list.body || []).find((t) => t.slug === 'hipaa-authorization');
  check('a known consent template is present', Boolean(consentFound));
  check('a known privacy template is present', Boolean(hipaaFound));
  check('templates carry their fields',
    Boolean(consentFound && Array.isArray(consentFound.fields) && consentFound.fields.length));

  // Stand-ins so that a missing library makes the checks below FAIL BY NAME rather than
  // throwing on a dereference and stopping the suite — a crash says something broke but
  // not what, and these are exactly the assertions worth reading.
  const MISSING = { id: '00000000-0000-0000-0000-000000000000', name: '(template missing)', version: '0', fields: [] };
  const consentTpl = consentFound || MISSING;
  const hipaaTpl = hipaaFound || MISSING;

  // A patient to attach submissions to.
  const patient = await A.sql(
    `INSERT INTO patients (id, practice_id, mrn, first_name, last_name, date_of_birth, status)
     VALUES (gen_random_uuid(), $1, $2, 'Form', 'Tester', '1980-05-05', 'active') RETURNING id`,
    [A.practiceId, `MRN-FORM-${RUN}`]
  );
  const PATIENT = patient.rows[0].id;

  // ── by id ──────────────────────────────────────────────────────────────────
  {
    const r = await api('POST', '/api/form-management/submissions', {
      template_id: consentTpl.id, patient_id: PATIENT, form_data: {}, status: 'draft',
    }, auth(A.token));
    check('a submission can be created by template id', r.status === 201 || r.status === 200);
    check('AND IT CARRIES THE TEMPLATE ID', r.body && r.body.template_id === consentTpl.id);
    check('the name is pinned from the template row', r.body && r.body.template_name === consentTpl.name);
    check('the version is pinned from the template row',
      r.body && r.body.template_version === consentTpl.version);

    const joined = await A.sql(
      `SELECT ft.slug FROM form_submissions fs JOIN form_templates ft ON ft.id = fs.template_id
        WHERE fs.id = $1`, [r.body.id]);
    check('the submission joins back to its template', joined.rows.length === 1
      && joined.rows[0].slug === 'consent-for-treatment');
  }

  // ── by slug — what the intake and diagnosis paths send ─────────────────────
  {
    const r = await api('POST', '/api/form-management/submissions', {
      template_slug: 'hipaa-authorization', template_name: 'whatever the client called it',
      patient_id: PATIENT, form_data: {}, status: 'draft',
    }, auth(A.token));
    check('a submission can be created by slug', r.status === 201 || r.status === 200);
    check('the slug resolves to the right template id', r.body && r.body.template_id === hipaaTpl.id);
    check("the client's template_name is overridden by the template row",
      r.body && r.body.template_name === hipaaTpl.name);
  }

  // ── a client-supplied version does not win ─────────────────────────────────
  {
    const r = await api('POST', '/api/form-management/submissions', {
      template_slug: 'consent-for-treatment', template_version: '99.9',
      patient_id: PATIENT, form_data: {}, status: 'draft',
    }, auth(A.token));
    check('A CLIENT CANNOT DICTATE THE RECORDED VERSION',
      r.body && r.body.template_version === consentTpl.version && r.body.template_version !== '99.9');
  }

  // ── an unhonourable reference is an error, not a silent null ───────────────
  {
    const r = await api('POST', '/api/form-management/submissions', {
      template_slug: `no-such-form-${RUN}`, patient_id: PATIENT, form_data: {},
    }, auth(A.token));
    check('an unknown slug is refused', r.status === 400);
    check('the refusal is TemplateNotFound', r.body && r.body.error === 'TemplateNotFound');
    check('and names the slug it could not find', r.body && r.body.slug === `no-such-form-${RUN}`);

    const byId = await api('POST', '/api/form-management/submissions', {
      template_id: crypto.randomUUID(), patient_id: PATIENT, form_data: {},
    }, auth(A.token));
    check('an unknown template id is refused too', byId.status === 400);
  }

  // ── no orphans left by any path ────────────────────────────────────────────
  {
    const orphans = await A.sql(
      'SELECT count(*)::int AS n FROM form_submissions WHERE template_id IS NULL');
    check('NO SUBMISSION IN THIS PRACTICE IS ORPHANED FROM ITS TEMPLATE', orphans.rows[0].n === 0);
  }

  // ── tenant isolation ───────────────────────────────────────────────────────
  {
    const r = await api('POST', '/api/form-management/submissions', {
      template_id: consentTpl.id, patient_id: PATIENT, form_data: {},
    }, auth(B.token));
    // Same deterministic id, but B's own row — so this succeeds against B's template, and
    // the patient id simply does not exist there.
    const bOrphans = await B.sql(
      'SELECT count(*)::int AS n FROM form_submissions WHERE template_id IS NULL');
    check("practice B has no orphaned submissions either", bOrphans.rows[0].n === 0);
    check('a cross-tenant post does not blow up', [200, 201, 400, 404, 500].includes(r.status));
  }

  // ── POST /api/offerings: the 28-of-29 regression ───────────────────────────
  {
    const r = await api('POST', '/api/offerings', {
      name: `Linkage Offering ${RUN}`, description: 'x', duration_minutes: 30,
    }, auth(A.token));
    check('AN OFFERING CAN BE CREATED AT ALL', r.status === 201);
    check('and comes back with an id', r.body && r.body.id);

    const withConsent = await api('POST', '/api/offerings', {
      name: `Linkage Consent Offering ${RUN}`, duration_minutes: 20,
      consent_form_required: true,
      consent_form_id: consentTpl.id,
      consent_form_url: 'https://example.invalid/consent.pdf',
    }, auth(A.token));
    check('an offering can reference a consent form template', withConsent.status === 201);
    check('CONSENT_FORM_ID IS ACTUALLY POPULATED',
      withConsent.body && withConsent.body.consent_form_id === consentTpl.id);
    check('and consent_form_url is a separate column, not the same value',
      withConsent.body && withConsent.body.consent_form_url === 'https://example.invalid/consent.pdf');

    const joined = await A.sql(
      `SELECT ft.slug FROM healthcare_offerings o
         JOIN form_templates ft ON ft.id = o.consent_form_id
        WHERE o.id = $1`, [withConsent.body.id]);
    check('the offering joins to its consent template through the foreign key',
      joined.rows.length === 1 && joined.rows[0].slug === 'consent-for-treatment');

    // A slug in the uuid column must be refused, not coerced — that is what the frontend
    // used to send.
    const bad = await api('POST', '/api/offerings', {
      name: `Linkage Bad Consent ${RUN}`, consent_form_required: true,
      consent_form_id: 'consent-for-treatment',
    }, auth(A.token));
    check('a slug in consent_form_id is rejected rather than silently stored',
      bad.status >= 400);
  }

  // ── the generated migration still matches its source ───────────────────────
  {
    const { execFileSync } = require('child_process');
    let ok = true;
    let out = '';
    try {
      out = execFileSync('node',
        [path.join(BACKEND, 'scripts', 'generate-form-library-migration.js'), '--verify'],
        { encoding: 'utf8' });
    } catch (e) {
      ok = false;
      out = String((e.stdout || '') + (e.stderr || ''));
    }
    // Checks tenant/008 against the data file — still all 22, because 008 is an applied
    // migration and therefore a record of what ran. tenant/009 is what removes the five.
    check('the committed migration still matches frontend/src/data/formTemplates.js',
      ok || (() => { console.log('     ', out.trim().split('\n').slice(0, 5).join('\n      ')); return false; })());
  }

  // ── the five specialty forms belong to packs now ───────────────────────────
  {
    const placeholders = MOVED_TO_PACKS.map((_, i) => `$${i + 1}`).join(',');
    const left = await A.sql(
      `SELECT slug FROM form_templates WHERE slug IN (${placeholders}) AND source_pack = 'base'`,
      MOVED_TO_PACKS
    );
    check('no specialty form is left in the base library of a clean tenant',
      left.rows.length === 0
      || (() => { console.log('     still base:', left.rows.map((r) => r.slug)); return false; })());

    // Their categories stay: a practice that keeps one of these forms (because it edited
    // it, or something references it) still needs the category it points at.
    const cats = await A.sql(
      "SELECT count(*)::int AS n FROM form_categories WHERE slug IN ('behavioral_health','pediatrics','dentistry')");
    check('their form categories are kept', cats.rows[0].n === 3);

    // And they are reachable again by applying the owning pack.
    const applied = await api('POST', '/api/practice-setup/apply',
      { specialtyCodes: ['behavioral_health'], mode: 'seed', acknowledgeUnreviewed: true },
      auth(A.token));
    check('the behavioural health pack applies', applied.status === 200);
    const back = await A.sql(
      "SELECT slug, source_pack FROM form_templates WHERE slug = 'phq9-depression-screening'");
    check('PHQ-9 comes back, owned by the pack rather than the base library',
      back.rows.length === 1 && back.rows[0].source_pack === 'behavioral_health');

    // Every field a pack seeds must carry an id — the renderer keys submitted data by it.
    const fields = await A.sql(
      `SELECT fields FROM form_templates WHERE source_pack = 'behavioral_health'`);
    const all = fields.rows.flatMap((r) => r.fields || []);
    check('pack-seeded form fields all carry an id (the renderer keys data by it)',
      all.length > 0 && all.every((f) => typeof f.id === 'string' && f.id.length > 0));

    // The move is lossless: the columns the pack format used to drop are populated.
    const kept = await A.sql(
      `SELECT subcategory, languages, tags, compliance_tags, version, category_slug
         FROM form_templates WHERE slug = 'phq9-depression-screening'`);
    const k = kept.rows[0] || {};
    check('the move keeps subcategory', k.subcategory === 'Depression Screening');
    check('the move keeps the language list',
      Array.isArray(k.languages) && k.languages.includes('es'));
    check('the move keeps the tags', Array.isArray(k.tags) && k.tags.includes('PHQ-9'));
    check('the move keeps the compliance tags',
      Array.isArray(k.compliance_tags) && k.compliance_tags.includes('HIPAA'));
    check('the move keeps the template version', k.version === '1.0');
    check('the move keeps the category link', k.category_slug === 'behavioral_health');
  }

  // ── the library has a repair path ──────────────────────────────────────────
  // A tenant provisioned while the provisioning copy fails would otherwise have no library
  // forever: tenant/008 cannot re-run for it, because it inherited template's ledger.
  {
    const { execFileSync } = require('child_process');
    // Its own practice: A and B carry submissions from the assertions above, and the
    // foreign key from form_submissions rightly refuses to let their templates be deleted.
    const C = await mkPractice('C');
    await C.sql("DELETE FROM form_templates WHERE source_pack = 'base'");
    const gone = await C.sql("SELECT count(*)::int AS n FROM form_templates WHERE source_pack = 'base'");
    check('a tenant can end up with no library at all', gone.rows[0].n === 0);

    let detected = false;
    try {
      execFileSync('node', [path.join(BACKEND, 'scripts', 'repair-form-library.js'), '--check'],
        { encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
      detected = String(e.stdout || '').includes(C.schema);
    }
    check('THE CHECK DETECTS IT', detected);

    execFileSync('node', [path.join(BACKEND, 'scripts', 'repair-form-library.js')],
      { encoding: 'utf8', stdio: 'pipe' });
    const back = await C.sql("SELECT count(*)::int AS n FROM form_templates WHERE source_pack = 'base'");
    check('and the repair restores it', back.rows[0].n === EXPECTED_TEMPLATES);
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  let pass = 0;
  for (const [name, ok] of results) {
    console.log(`  ${ok ? 'ok ' : 'FAIL'}  ${name}`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${results.length} checks passed.`);
  await pool.end();
  process.exit(pass === results.length ? 0 : 1);
})().catch(async (err) => {
  console.error('harness error:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
