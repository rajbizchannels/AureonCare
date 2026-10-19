// Specialty packs and the configuration wizard.
//
// The checks that matter are not "does it seed rows". They are:
//
//   * the validator actually enforces "packs are data" — SQL, code references, role
//     definitions and a modules.show list are all rejected, while ordinary clinical prose
//     containing the word "select" is not
//   * a pack NEVER overwrites a row the practice has edited, and the edit survives an
//     upgrade. This is asserted by editing through the real API, not by setting the column
//   * a pack never ADOPTS a row it did not create
//   * per-practice state lands in practices.setup and NOT in organization_settings, which
//     is a single row shared by every tenant — the trap migration 085 exists to avoid
//   * clinical review is a real gate, not a comment
//   * one tenant's apply does not touch another's rows

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
const results = [];
const check = (name, cond) => results.push([name, !!cond]);

process.env.PORT = process.env.TEST_PORT || '4898';
process.env.NODE_ENV = 'development';
process.env.AC_COOKIE_INSECURE = 'true';
process.env.AC_RL_TEST_BYPASS = '1';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
const BASE = `http://127.0.0.1:${process.env.PORT}`;

const pool = require(path.join(BACKEND, 'db.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));
const { validatePack, FIELD_TYPES } = require(path.join(BACKEND, 'utils/specialtyPackSchema.js'));
const packSvc = require(path.join(BACKEND, 'services/specialtyPack.js'));

require(path.join(BACKEND, 'server.js'));

/** Summary accessor that degrades to zeroes, so an error response fails the assertion it
 *  belongs to instead of throwing and taking every later check with it. */
const sum = (res) => (res && res.body && res.body.summary) || {
  created: -1, updated: -1, skipped: -1, conflicts: -1,
};
const rowsOf = (res, key) => (res && res.body && Array.isArray(res.body[key])) ? res.body[key] : [];

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

// Synthetic specialties this run created. Removed in a finally block, so a crash halfway
// through cannot leave a newer pack version behind for the next run to seed instead of the
// shipped one — the exact way an earlier draft of this suite poisoned itself.
const CREATED_SPECIALTIES = [];
async function cleanupSpecialties() {
  for (const code of CREATED_SPECIALTIES) {
    await pool.query('DELETE FROM public.specialty_packs WHERE code = $1', [code]).catch(() => {});
    await pool.query('DELETE FROM public.specialties WHERE code = $1', [code]).catch(() => {});
  }
}

/** Tenant-pinned SQL. The pin must be inside a transaction: db.js opens pooled
 *  connections with `-c search_path=public`, so a bare SET LOCAL outside one is a no-op. */
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

(async () => {
  for (let i = 0; i < 40; i++) {
    try { await fetch(BASE + '/health'); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  console.log('\nSpecialty packs and the configuration wizard\n');

  const RUN = crypto.randomBytes(4).toString('hex');

  // ── the validator ──────────────────────────────────────────────────────────
  const base = { code: 'dentistry', version: 1, label: 'X' };
  const v = (over) => validatePack({ ...base, ...over }, { knownSpecialties: ['dentistry', 'paediatrics'] });

  check('a minimal pack validates', v({}).valid);
  check('an unknown specialty code is rejected',
    !validatePack({ ...base, code: 'astrology' }, { knownSpecialties: ['dentistry'] }).valid);
  check('version 0 is rejected', !v({ version: 0 }).valid);
  check('an unknown top-level key is rejected (the schema is closed)',
    !v({ somethingNew: 1 }).valid);
  {
    const r = v({ roles: [{ name: 'Dental Assistant', basedOn: 'staff' }] });
    check('a pack cannot define roles', !r.valid);
    check('and the reason says authority is not configuration',
      r.errors.some((e) => /authority is not configuration/.test(e)));
  }
  {
    const r = v({ modules: { show: ['rcm'] } });
    check('a pack cannot REVEAL a module', !r.valid);
    check('and is told it may only hide', r.errors.some((e) => /only "hide"/.test(e)));
  }
  check('a pack cannot hide the dashboard', !v({ modules: { hide: ['dashboard'] } }).valid);
  check('a pack cannot hide the admin panel', !v({ modules: { hide: ['adminPanel'] } }).valid);
  check('an unknown module id is rejected', !v({ modules: { hide: ['teleportation'] } }).valid);
  check('hiding a real module is fine', v({ modules: { hide: ['rcm', 'telehealth'] } }).valid);

  {
    const r = v({ serviceCategories: [{ name: 'DROP TABLE patients' }] });
    check('SQL in an identifier field is rejected', !r.valid);
    check('and is named as such', r.errors.some((e) => /looks like SQL/.test(e)));
  }
  check('a module reference is rejected',
    !v({ formTemplates: [{ slug: 'x', name: "require('fs')" }] }).valid);
  check('a path traversal is rejected',
    !v({ terminology: { patient: '../../etc/passwd' } }).valid);

  // The false-positive case the first draft of the validator got wrong.
  check('ordinary clinical prose containing "select" and "create" is ACCEPTED',
    v({
      serviceCategories: [{ name: 'Preventive' }],
      offerings: [{
        name: 'Treatment Planning', categoryName: 'Preventive',
        description: 'Select the affected tooth and create a treatment plan; update the chart afterwards.',
        preparationInstructions: 'Select a convenient time and delete nothing from your routine.',
      }],
    }).valid);
  check('a form field of type "select" is accepted',
    v({ formTemplates: [{ slug: 'f', name: 'F', fields: [{ id: 'a', type: 'select', options: ['Yes'] }] }] }).valid);
  check('an unknown field type is rejected',
    !v({ formTemplates: [{ slug: 'f', name: 'F', fields: [{ id: 'a', type: 'sqlwidget' }] }] }).valid);

  // A field without an `id` renders with an undefined key and collides with every other
  // such field — which is how the first three packs shipped 57 unusable fields.
  {
    const noId = v({ formTemplates: [{ slug: 'f', name: 'F', fields: [{ type: 'text', label: 'X' }] }] });
    check('a form field without an id is rejected', !noId.valid);
    const onlyName = v({ formTemplates: [{ slug: 'f', name: 'F', fields: [{ name: 'a', type: 'text' }] }] });
    check('a field keyed on "name" instead of "id" is rejected', !onlyName.valid);
    check('and the error says to rename it',
      onlyName.errors.some((e) => /rename it to "id"/.test(e)));
    check('a field with an id is accepted',
      v({ formTemplates: [{ slug: 'f', name: 'F', fields: [{ id: 'a', type: 'text' }] }] }).valid);
  }

  // ── one vocabulary across three files ──────────────────────────────────────
  //
  // The form renderer dispatches on field.type as a chain with no else, so a type it does
  // not know renders as a LABEL WITH NO INPUT. That is how 18 fields across 10 seed
  // templates — the HIPAA authorisation and release-of-information forms among them —
  // became unanswerable: the seed data said `checkbox_group` where the renderer says
  // `checkboxes`, and this validator allowed seven further types nothing can draw.
  //
  // Asserted here, from the backend, because the invariant spans the boundary: a pack that
  // validates must be a pack the browser can actually render.
  {
    const fs = require('fs');
    const FE = path.join(BACKEND, '..', 'frontend', 'src', 'components', 'forms');
    const rendererSrc = fs.readFileSync(path.join(FE, 'DynamicFormRenderer.js'), 'utf8');
    // Comments mention `field.type === 'x'` as an example; only code counts.
    const rendererCode = rendererSrc.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    const draws = [...new Set([...rendererCode.matchAll(/field\.type === '([a-z_]+)'/g)].map((m) => m[1]))].sort();
    const declared = (rendererSrc.match(/const SUPPORTED_FIELD_TYPES = \[([\s\S]*?)\]/) || [])[1];
    const declaredList = declared
      ? declared.match(/'([a-z_]+)'/g).map((x) => x.replace(/'/g, '')).sort() : [];
    const builderSrc = fs.readFileSync(path.join(FE, 'DynamicFormBuilder.js'), 'utf8');
    const offers = [...new Set([...builderSrc.matchAll(/^ {2}\{ type: '([a-z_]+)'/gm)].map((m) => m[1]))].sort();
    const allowed = FIELD_TYPES.slice().sort();
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    check('the renderer declares exactly the field types it can draw', same(declaredList, draws));
    check('the form builder offers exactly those types', same(offers, draws));
    check('the pack validator allows exactly those types — no type a pack can declare is unrenderable',
      same(allowed, draws) || (() => {
        console.log('     validator:', allowed.join(' '));
        console.log('     renderer :', draws.join(' '));
        return false;
      })());

    // And the seed library itself only uses types that render.
    const seedSrc = fs.readFileSync(
      path.join(BACKEND, '..', 'frontend', 'src', 'data', 'formTemplates.js'), 'utf8');
    const templateTypes = new Set([...seedSrc.matchAll(/template_type: '([a-z_]+)'/g)].map((m) => m[1]));
    const seedFieldTypes = [...new Set([...seedSrc.matchAll(/type: '([a-z_]+)'/g)].map((m) => m[1]))]
      .filter((t) => !templateTypes.has(t));
    const unrenderable = seedFieldTypes.filter((t) => !draws.includes(t));
    check('every field in the seed form library uses a renderable type',
      unrenderable.length === 0 || (() => { console.log('     unrenderable:', unrenderable); return false; })());
  }

  check('an offering naming an undefined category is rejected',
    !v({ offerings: [{ name: 'X', categoryName: 'Nowhere' }] }).valid);
  check('minAge greater than maxAge is rejected',
    !v({ offerings: [{ name: 'X', minAge: 40, maxAge: 10 }] }).valid);
  check('an implausible CPT code is rejected',
    !v({ offerings: [{ name: 'X', cptCodes: ['not a code at all!!'] }] }).valid);
  check('an inventory category without a code is rejected',
    !v({ inventoryCategories: [{ name: 'Stuff' }] }).valid);
  check('a nested settings value is rejected (scalars only)',
    !v({ settings: { nested: { a: 1 } } }).valid);

  // ── the three shipped packs ────────────────────────────────────────────────
  {
    const { rows } = await pool.query('SELECT code FROM public.specialties WHERE is_active');
    const known = rows.map((r) => r.code);
    check('the taxonomy is seeded', known.length >= 30);

    // Scoped to the files actually shipped in backend/data/specialty-packs. The suite
    // creates packs of its own further down, and must not assert over those.
    const { rows: loaded } = await pool.query(
      `SELECT code, version, definition, clinical_review_status
         FROM public.specialty_packs
        WHERE code IN ('dentistry', 'ophthalmology', 'paediatrics')
        ORDER BY code, version`
    );
    check('three packs are loaded', loaded.length >= 3);
    check('every shipped pack validates against the schema',
      loaded.every((p) => validatePack(p.definition, { knownSpecialties: known }).valid));
    check('shipped packs await clinical review rather than claiming approval',
      loaded.every((p) => p.clinical_review_status === 'pending'));
  }

  // ── practices ──────────────────────────────────────────────────────────────
  const mkPractice = async (label) => {
    const { practiceId, tenant } = await provisionTenant(pool, {
      name: `Spec ${label} ${RUN}`, planId: 2, country: 'GB', timezone: 'Europe/London',
    });
    const mkUser = async (role, tag) => {
      const email = `${tag}_${label}_${RUN}@spec-${RUN}.example`;
      const { rows } = await pool.query(
        `INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
         VALUES (gen_random_uuid(),$1,$2,'P',$3,'active',$4,$5,NOW()) RETURNING id`,
        [email, tag, role, await bcrypt.hash(PW, 12), practiceId]
      );
      const login = await api('POST', '/api/auth/login', { email, password: PW });
      return { id: rows[0].id, email, token: login.body && login.body.token };
    };
    return {
      practiceId, schema: tenant.schema_name, sql: tenantSql(tenant.schema_name),
      admin: await mkUser('admin', 'admin'), doctor: await mkUser('doctor', 'doc'),
    };
  };

  const A = await mkPractice('A');
  const B = await mkPractice('B');
  check('practice admins can sign in', Boolean(A.admin.token && B.admin.token));

  // ── state ──────────────────────────────────────────────────────────────────
  const state0 = await api('GET', '/api/practice-setup/state', undefined, auth(A.admin.token));
  check('a new practice reports onboarding not yet done',
    state0.status === 200 && state0.body.onboarding.completedAt === null);
  check('and starts with nothing hidden and no terminology overrides',
    state0.body.hiddenModules.length === 0 && Object.keys(state0.body.terminology).length === 0);
  check('state is readable by a non-admin (the shell needs it on load)',
    (await api('GET', '/api/practice-setup/state', undefined, auth(A.doctor.token))).status === 200);

  const specs = await api('GET', '/api/practice-setup/specialties', undefined, auth(A.admin.token));
  check('the specialty list loads', specs.status === 200 && specs.body.length >= 30);
  check('it marks which specialties have a pack',
    specs.body.filter((s) => s.hasPack).length >= 3);
  check('and surfaces the review status', specs.body.some((s) => s.clinicalReviewStatus === 'pending'));

  // ── authorisation ──────────────────────────────────────────────────────────
  const asDoctor = await api('POST', '/api/practice-setup/preview',
    { specialtyCodes: ['dentistry'] }, auth(A.doctor.token));
  check('a non-admin cannot preview a pack', asDoctor.status === 403);
  const applyAsDoctor = await api('POST', '/api/practice-setup/apply',
    { specialtyCodes: ['dentistry'] }, auth(A.doctor.token));
  check('a non-admin cannot apply a pack', applyAsDoctor.status === 403);

  // ── preview writes nothing ─────────────────────────────────────────────────
  const before = await A.sql('SELECT count(*)::int AS n FROM healthcare_offerings');
  const preview = await api('POST', '/api/practice-setup/preview',
    { specialtyCodes: ['dentistry'] }, auth(A.admin.token));
  check('preview succeeds', preview.status === 200);
  check('preview reports what would be created', sum(preview).created > 30);
  check('preview reports no conflicts on a clean practice', sum(preview).conflicts === 0);
  {
    const after = await A.sql('SELECT count(*)::int AS n FROM healthcare_offerings');
    const stamped = await A.sql(
      "SELECT count(*)::int AS n FROM healthcare_offerings WHERE source_pack IS NOT NULL");
    const touched = await pool.query(
      "SELECT setup FROM public.practices WHERE id = $1", [A.practiceId]);
    // Three ways of asking, because an unchanged row count is also what an ERRORED preview
    // leaves behind — so on its own it is not evidence that preview is read-only.
    check('PREVIEW WROTE NO ROWS',
      preview.status === 200 && after.rows[0].n === before.rows[0].n);
    check('PREVIEW STAMPED NOTHING', stamped.rows[0].n === 0);
    check('PREVIEW DID NOT TOUCH practices.setup',
      !(touched.rows[0].setup || {}).appliedPacks);
  }

  // ── the clinical review gate ───────────────────────────────────────────────
  const gated = await api('POST', '/api/practice-setup/apply',
    { specialtyCodes: ['dentistry'], mode: 'seed' }, auth(A.admin.token));
  check('an unreviewed pack cannot be applied by accident', gated.status === 409);
  check('the refusal is ClinicalReviewPending',
    gated.body && gated.body.error === 'ClinicalReviewPending');
  check('and explains the content is an engineering draft',
    /engineering draft/.test((gated.body && gated.body.message) || ''));

  // ── seed ───────────────────────────────────────────────────────────────────
  const seeded = await api('POST', '/api/practice-setup/apply',
    { specialtyCodes: ['dentistry'], mode: 'seed', acknowledgeUnreviewed: true }, auth(A.admin.token));
  check('an acknowledged pack applies', seeded.status === 200);
  check('it creates the catalogue', sum(seeded).created > 30);
  check('and reports the review status it was applied under',
    seeded.body.reviewStatus === 'pending');

  {
    const off = await A.sql(
      "SELECT count(*)::int AS n FROM healthcare_offerings WHERE source_pack = 'dentistry'");
    const cats = await A.sql(
      "SELECT count(*)::int AS n FROM service_categories WHERE source_pack = 'dentistry'");
    const types = await A.sql(
      "SELECT count(*)::int AS n FROM appointment_types WHERE source_pack = 'dentistry'");
    const forms = await A.sql(
      "SELECT count(*)::int AS n FROM form_templates WHERE source_pack = 'dentistry'");
    const inv = await A.sql(
      "SELECT count(*)::int AS n FROM inventory_categories WHERE source_pack = 'dentistry'");
    check('offerings are stamped with the pack', off.rows[0].n === 13);
    check('categories are stamped', cats.rows[0].n === 5);
    check('appointment types are stamped', types.rows[0].n === 7);
    // dentistry is at v2 since the dental history form moved out of the base library and
    // into the pack (tenant/009).
    check('form templates are stamped', forms.rows[0].n === 4);
    check('inventory categories are stamped', inv.rows[0].n === 5);
    const ver = await A.sql(
      "SELECT DISTINCT source_pack_version AS v FROM healthcare_offerings WHERE source_pack='dentistry'");
    const { rows: latest } = await pool.query(
      "SELECT max(version) AS v FROM public.specialty_packs WHERE code = 'dentistry' AND is_active");
    check('the pack VERSION is recorded, not just the code',
      ver.rows.length === 1 && ver.rows[0].v === latest[0].v);
  }
  {
    // Offerings reference the categories the same pack created, by name.
    const linked = await A.sql(
      `SELECT count(*)::int AS n FROM healthcare_offerings o
         JOIN service_categories c ON c.id = o.category_id
        WHERE o.source_pack = 'dentistry'`);
    check('seeded offerings are linked to their seeded categories', linked.rows[0].n === 13);
  }

  // ── re-seed is a no-op ─────────────────────────────────────────────────────
  const reseed = await api('POST', '/api/practice-setup/apply',
    { specialtyCodes: ['dentistry'], mode: 'seed', acknowledgeUnreviewed: true }, auth(A.admin.token));
  check('re-seeding creates nothing', reseed.status === 200 && sum(reseed).created === 0);
  check('and reports everything as already present', sum(reseed).skipped > 30);
  {
    const off = await A.sql("SELECT count(*)::int AS n FROM healthcare_offerings");
    check('no duplicate rows appeared', off.rows[0].n === 13);
  }

  // ── per-practice state, NOT the shared row ─────────────────────────────────
  {
    const { rows } = await pool.query('SELECT setup FROM public.practices WHERE id = $1', [A.practiceId]);
    const setup = rows[0].setup || {};
    check('hidden modules landed in practices.setup',
      Array.isArray(setup.hiddenModules) && setup.hiddenModules.includes('rcm'));
    check('terminology landed there too', setup.terminology && setup.terminology.provider === 'Dentist');
    check('the applied pack is recorded for audit',
      Array.isArray(setup.appliedPacks) && setup.appliedPacks.some((p) => p.code === 'dentistry'));
    check('favourite codes are kept per practice',
      setup.favouriteCodes && Array.isArray(setup.favouriteCodes.cpt));
    // The pack declares reports.show; an earlier draft computed it, reported it and then
    // never wrote it anywhere, so the value was silently lost.
    check('the report list the pack declares is actually persisted',
      Array.isArray(setup.visibleReports) && setup.visibleReports.includes('clinical'));

    // The trap migration 085 exists to avoid: organization_settings holds ONE row for all
    // tenants, so anything per-practice written there leaks across every practice.
    const { rows: org } = await pool.query(
      "SELECT count(*)::int AS n FROM public.organization_settings WHERE settings ? 'hiddenModules' OR settings ? 'terminology' OR settings ? 'specialtyCodes'");
    check('NOTHING per-practice was written to the shared organization_settings row',
      org[0].n === 0);

    const { rows: b } = await pool.query('SELECT setup FROM public.practices WHERE id = $1', [B.practiceId]);
    check("practice B's setup is untouched",
      !(b[0].setup || {}).hiddenModules || (b[0].setup.hiddenModules || []).length === 0);
  }

  // ── tenant isolation of the seeded rows ────────────────────────────────────
  {
    const bOff = await B.sql("SELECT count(*)::int AS n FROM healthcare_offerings");
    check("practice B got none of A's catalogue", bOff.rows[0].n === 0);
  }

  // ── a synthetic pack of our own, for the upgrade mechanics ────────────────
  //
  // Deliberately NOT a new version of a shipped pack. An earlier draft of this suite
  // inserted dentistry v2 and v3 to test upgrades, which left them in the global
  // catalogue — so the next run seeded v3 instead of v1 and every count assertion
  // shifted. The suite has to be re-runnable, so it brings its own specialty and
  // removes it at the end.
  const TESTSPEC = `ptest_${RUN}`;
  CREATED_SPECIALTIES.push(TESTSPEC);
  await pool.query(
    `INSERT INTO public.specialties (code, name, sort_order, is_active)
     VALUES ($1, $2, 9000, true) ON CONFLICT (code) DO NOTHING`,
    [TESTSPEC, `Pack Test ${RUN}`]
  );
  const testPack = (version, over = {}) => ({
    code: TESTSPEC, version, label: 'Pack Test',
    modules: { hide: ['rcm'] },
    terminology: { provider: 'Tester' },
    serviceCategories: [{ name: `PT Cat One ${RUN}` }, { name: `PT Cat Two ${RUN}` }],
    appointmentTypes: [
      { name: `PT Short ${RUN}`, durationMinutes: 15 },
      { name: `PT Long ${RUN}`, durationMinutes: 60 },
    ],
    offerings: [
      { name: `PT Keep ${RUN}`, categoryName: `PT Cat One ${RUN}`, durationMinutes: 30 },
      { name: `PT Edit ${RUN}`, categoryName: `PT Cat One ${RUN}`, durationMinutes: 40 },
      { name: `PT Plain ${RUN}`, categoryName: `PT Cat Two ${RUN}`, durationMinutes: 20 },
    ],
    formTemplates: [{ slug: `pt-form-${RUN}`, name: `PT Form ${RUN}`, templateType: 'clinical' }],
    inventoryCategories: [{ code: `ptcat${RUN}`, name: `PT Supplies ${RUN}` }],
    codeSets: { cpt: ['99213'] },
    ...over,
  });
  const publishTestPack = async (version, def, review) => {
    await pool.query(
      `INSERT INTO public.specialty_packs (code, version, label, definition, is_active, clinical_review_status, reviewed_by, reviewed_at)
       VALUES ($1, $2, 'Pack Test', $3::jsonb, true, $4::varchar,
               CASE WHEN $4::varchar = 'approved' THEN 'Test Clinician' END,
               CASE WHEN $4::varchar = 'approved' THEN now() END)
       ON CONFLICT (code, version) DO UPDATE
         SET definition = EXCLUDED.definition, clinical_review_status = EXCLUDED.clinical_review_status`,
      [TESTSPEC, version, JSON.stringify(def), review]
    );
  };

  {
    const v1 = testPack(1);
    const { valid, errors } = validatePack(v1, { knownSpecialties: [TESTSPEC] });
    check('the synthetic test pack is itself schema-valid',
      valid || (() => { console.log('     ', errors); return false; })());
    await publishTestPack(1, v1, 'pending');
  }

  const C = await mkPractice('C');

  const cGate = await api('POST', '/api/practice-setup/apply',
    { specialtyCodes: [TESTSPEC], mode: 'seed' }, auth(C.admin.token));
  check('the synthetic pack is also gated while pending', cGate.status === 409);

  const cSeed = await api('POST', '/api/practice-setup/apply',
    { specialtyCodes: [TESTSPEC], mode: 'seed', acknowledgeUnreviewed: true }, auth(C.admin.token));
  check('the synthetic pack seeds', cSeed.status === 200);
  check('with exactly the rows it declares', sum(cSeed).created === 9);
  {
    const o = await C.sql('SELECT count(*)::int AS n FROM healthcare_offerings WHERE source_pack = $1', [TESTSPEC]);
    const a = await C.sql('SELECT count(*)::int AS n FROM appointment_types WHERE source_pack = $1', [TESTSPEC]);
    check('three offerings', o.rows[0].n === 3);
    check('two appointment types', a.rows[0].n === 2);
  }

  // ── customisation survives an upgrade ──────────────────────────────────────
  // Edited through the REAL API, so what is under test is the route stamping the column,
  // not the test setting it.
  const toEdit = await C.sql(
    'SELECT id FROM healthcare_offerings WHERE source_pack = $1 AND name = $2',
    [TESTSPEC, `PT Edit ${RUN}`]);
  check('the row to edit exists', toEdit.rows.length === 1);
  const edited = await api('PUT', `/api/offerings/${toEdit.rows[0].id}`,
    { duration_minutes: 75, description: 'Our own protocol' }, auth(C.admin.token));
  check('an admin can edit a seeded offering', edited.status === 200);
  {
    const { rows } = await C.sql(
      'SELECT is_customised, duration_minutes FROM healthcare_offerings WHERE id = $1', [toEdit.rows[0].id]);
    check('EDITING THROUGH THE API MARKS THE ROW CUSTOMISED', rows[0].is_customised === true);
    check('and the edit took effect', Number(rows[0].duration_minutes) === 75);
  }

  // Also prove it for the other four seeded tables, since each has its own route.
  {
    const cat = await C.sql('SELECT id FROM service_categories WHERE source_pack = $1 LIMIT 1', [TESTSPEC]);
    await api('PUT', `/api/offerings/categories/${cat.rows[0].id}`, { description: 'ours' }, auth(C.admin.token));
    const r1 = await C.sql('SELECT is_customised FROM service_categories WHERE id = $1', [cat.rows[0].id]);
    check('editing a service category marks it customised', r1.rows[0].is_customised === true);

    const at = await C.sql('SELECT id FROM appointment_types WHERE source_pack = $1 AND name = $2',
      [TESTSPEC, `PT Short ${RUN}`]);
    await api('PUT', `/api/appointment-types/${at.rows[0].id}`, { description: 'ours' }, auth(C.admin.token));
    const r2 = await C.sql('SELECT is_customised FROM appointment_types WHERE id = $1', [at.rows[0].id]);
    check('editing an appointment type marks it customised', r2.rows[0].is_customised === true);

    const ft = await C.sql('SELECT id FROM form_templates WHERE source_pack = $1 LIMIT 1', [TESTSPEC]);
    await api('PUT', `/api/form-management/templates/${ft.rows[0].id}`,
      { description: 'ours' }, auth(C.admin.token));
    const r3 = await C.sql('SELECT is_customised FROM form_templates WHERE id = $1', [ft.rows[0].id]);
    check('editing a form template marks it customised', r3.rows[0].is_customised === true);

    const ic = await C.sql('SELECT id FROM inventory_categories WHERE source_pack = $1 LIMIT 1', [TESTSPEC]);
    await api('PUT', `/api/inventory/categories/${ic.rows[0].id}`,
      { name: `PT Supplies ${RUN}`, description: 'ours' }, auth(C.admin.token));
    const r4 = await C.sql('SELECT is_customised FROM inventory_categories WHERE id = $1', [ic.rows[0].id]);
    check('editing an inventory category marks it customised', r4.rows[0].is_customised === true);
  }

  // v2: changes the edited offering, changes an untouched appointment type, adds one row.
  {
    const v2 = testPack(2);
    v2.offerings = v2.offerings.map((o) =>
      o.name === `PT Edit ${RUN}` ? { ...o, durationMinutes: 100 } : o);
    v2.offerings.push({ name: `PT New ${RUN}`, categoryName: `PT Cat Two ${RUN}`, durationMinutes: 25 });
    v2.appointmentTypes = v2.appointmentTypes.map((t) =>
      t.name === `PT Long ${RUN}` ? { ...t, durationMinutes: 90 } : t);
    await publishTestPack(2, v2, 'approved');
  }

  const upgraded = await api('POST', '/api/practice-setup/apply',
    { specialtyCodes: [TESTSPEC], mode: 'upgrade' }, auth(C.admin.token));
  check('an APPROVED pack applies without an acknowledgement', upgraded.status === 200);
  check('the upgrade adds the new offering', sum(upgraded).created === 1);
  check('it updates the rows the practice has not touched',
    rowsOf(upgraded, 'updates').some((u) => u.label.includes(`PT Long ${RUN}`)));
  check('it reports every customised row as a CONFLICT',
    rowsOf(upgraded, 'conflicts').filter((c) => c.reason === 'customised').length === 5);
  {
    const { rows } = await C.sql(
      'SELECT duration_minutes, source_pack_version FROM healthcare_offerings WHERE name = $1',
      [`PT Edit ${RUN}`]);
    check("THE PRACTICE'S EDIT SURVIVED THE UPGRADE", Number(rows[0].duration_minutes) === 75);
    check('and the row was not re-versioned', rows[0].source_pack_version === 1);

    const { rows: moved } = await C.sql(
      'SELECT duration_minutes, source_pack_version FROM appointment_types WHERE name = $1',
      [`PT Long ${RUN}`]);
    check('an untouched row DID take the upgrade', Number(moved[0].duration_minutes) === 90);
    check('and was re-versioned', moved[0].source_pack_version === 2);
  }

  // ── a pack never adopts a row it did not create ────────────────────────────
  {
    await C.sql(
      `INSERT INTO healthcare_offerings (name, description, duration_minutes)
       VALUES ($1, 'Our own thing', 30)`, [`PT Ours ${RUN}`]);
    const v3 = testPack(3);
    v3.offerings.push({ name: `PT Ours ${RUN}`, categoryName: `PT Cat One ${RUN}`, durationMinutes: 99 });
    await publishTestPack(3, v3, 'approved');

    const up3 = await api('POST', '/api/practice-setup/apply',
      { specialtyCodes: [TESTSPEC], mode: 'upgrade' }, auth(C.admin.token));
    check('a row the practice made itself is reported, not claimed',
      rowsOf(up3, 'conflicts').some((c) => c.reason === 'pre_existing' && c.label.includes(`PT Ours ${RUN}`)));
    const own = await C.sql(
      'SELECT source_pack, duration_minutes FROM healthcare_offerings WHERE name = $1', [`PT Ours ${RUN}`]);
    check('and it is left unstamped and unchanged',
      own.rows[0].source_pack === null && Number(own.rows[0].duration_minutes) === 30);
  }

  // ── another pack's row is left alone ───────────────────────────────────────
  {
    await C.sql(
      `INSERT INTO service_categories (name, source_pack, source_pack_version)
       VALUES ($1, 'ophthalmology', 1)`, [`PT Cat Three ${RUN}`]);
    const v4 = testPack(4);
    v4.serviceCategories.push({ name: `PT Cat Three ${RUN}` });
    await publishTestPack(4, v4, 'approved');

    const pv = await api('POST', '/api/practice-setup/preview',
      { specialtyCodes: [TESTSPEC] }, auth(C.admin.token));
    check("a row owned by ANOTHER pack is reported as such",
      rowsOf(pv, 'conflicts').some((c) => c.reason === 'other_pack' && c.label.includes(`PT Cat Three ${RUN}`)));
    check('and the report names which pack owns it',
      rowsOf(pv, 'conflicts').some((c) => c.otherPack === 'ophthalmology'));
  }

  // ── multi-specialty merge ──────────────────────────────────────────────────
  {
    const merged = await api('POST', '/api/practice-setup/preview',
      { specialtyCodes: ['ophthalmology', 'paediatrics'] }, auth(B.admin.token));
    check('two specialties can be previewed together', merged.status === 200);
    const labels = [...rowsOf(merged, 'creates'), ...rowsOf(merged, 'skips')].map((r) => r.label);
    check('the catalogue is the union of both',
      labels.some((l) => l.includes('Cataract Surgery')) && labels.some((l) => l.includes('Well-child')));

    // Intersection, not union: ophthalmology hides telehealth and paediatrics hides rcm,
    // so a clinic doing both should lose neither.
    check('module hiding is an INTERSECTION so neither specialty takes a module away',
      ((merged.body && merged.body.settings && merged.body.settings.hiddenModules) || ['notempty']).length === 0);

    const clash = await api('POST', '/api/practice-setup/preview',
      { specialtyCodes: ['paediatrics', 'ophthalmology'] }, auth(B.admin.token));
    check('a terminology clash between packs is reported, not resolved silently',
      ((clash.body && clash.body.mergeClashes) || []).some((c) => c.section === 'terminology' && c.key === 'provider'));
    check('and the primary specialty wins it',
      clash.body && clash.body.settings && clash.body.settings.terminology
      && clash.body.settings.terminology.provider === 'Paediatrician');

    check('no specialty at all is refused',
      (await api('POST', '/api/practice-setup/preview', { specialtyCodes: [] }, auth(B.admin.token))).status === 400);
    check('an unknown specialty is a 404',
      (await api('POST', '/api/practice-setup/preview', { specialtyCodes: ['astrology'] }, auth(B.admin.token))).status === 404);
  }

  // ── footprint ──────────────────────────────────────────────────────────────
  {
    const fp = await api('GET', `/api/practice-setup/footprint?code=${TESTSPEC}`, undefined, auth(C.admin.token));
    check('the footprint lists what the pack put here',
      fp.status === 200 && rowsOf(fp, 'rows').length >= 9);
    check('and flags which rows have since been customised',
      rowsOf(fp, 'rows').some((r) => r.customised === true));
  }

  // ── module and terminology overrides ───────────────────────────────────────
  {
    const pin = await api('PUT', '/api/practice-setup/modules',
      { pinnedModules: ['rcm'] }, auth(A.admin.token));
    check('an admin can re-show a module the pack hid',
      pin.status === 200 && pin.body.pinnedModules.includes('rcm'));

    const term = await api('PUT', '/api/practice-setup/terminology',
      { terminology: { provider: 'Our Dentist' } }, auth(A.admin.token));
    check('an admin can override terminology', term.status === 200);
    check('and it is reflected in state',
      (await api('GET', '/api/practice-setup/state', undefined, auth(A.admin.token)))
        .body.terminology.provider === 'Our Dentist');

    const badTerm = await api('PUT', '/api/practice-setup/terminology',
      { terminology: { 'not a key': 'x' } }, auth(A.admin.token));
    check('a malformed terminology key is rejected', badTerm.status === 400);

    const notAdmin = await api('PUT', '/api/practice-setup/modules',
      { pinnedModules: [] }, auth(A.doctor.token));
    check('a non-admin cannot change module visibility', notAdmin.status === 403);
  }

  // ── wizard state transitions ───────────────────────────────────────────────
  {
    const step = await api('PUT', '/api/practice-setup/state',
      { currentStep: 'services', specialtyCodes: ['dentistry'] }, auth(A.admin.token));
    check('a wizard step can be saved so it is resumable', step.status === 200);
    const badStep = await api('PUT', '/api/practice-setup/state',
      { currentStep: 'nowhere' }, auth(A.admin.token));
    check('an unknown step is rejected', badStep.status === 400);

    const done = await api('PUT', '/api/practice-setup/state', { completed: true }, auth(A.admin.token));
    check('completion is recorded', done.status === 200);
    const st = await api('GET', '/api/practice-setup/state', undefined, auth(A.admin.token));
    check('and reported back', Boolean(st.body.onboarding.completedAt));
    check('the start time was kept', Boolean(st.body.onboarding.startedAt));
  }

  // ── merge helper, directly ─────────────────────────────────────────────────
  {
    const p1 = { code: 'a', version: 1, label: 'A', definition: { modules: { hide: ['rcm', 'crm'] }, terminology: { patient: 'Client' }, offerings: [{ name: 'X' }] } };
    const p2 = { code: 'b', version: 1, label: 'B', definition: { modules: { hide: ['rcm'] }, terminology: { patient: 'Guest' }, offerings: [{ name: 'X' }, { name: 'Y' }] } };
    const { definition, clashes } = packSvc.mergePacks([p1, p2]);
    check('merge keeps only modules BOTH packs hide',
      JSON.stringify(definition.modules.hide) === JSON.stringify(['rcm']));
    check('merge unions the offerings', definition.offerings.length === 2);
    check('merge keeps the primary pack\'s terminology', definition.terminology.patient === 'Client');
    check('merge reports the duplicate offering', clashes.some((c) => c.section === 'offerings' && c.key === 'X'));
    check('merge reports the terminology clash', clashes.some((c) => c.section === 'terminology'));
    let threw = false;
    try { packSvc.mergePacks([]); } catch { threw = true; }
    check('merging nothing throws rather than returning an empty pack', threw);
  }

  // ── leave the catalogue as we found it ─────────────────────────────────────
  // Without this the next run would seed the synthetic pack's latest version instead of
  // the shipped one, and every count assertion above would drift.
  await cleanupSpecialties();
  {
    // The point of this check is that the synthetic pack this suite created is gone, so a
    // later run seeds the shipped version rather than a leftover newer one. The shipped set
    // itself is read from disk rather than hard-coded, so adding a pack does not break it.
    const fs = require('fs');
    const shipped = new Set(
      fs.readdirSync(path.join(BACKEND, 'data', 'specialty-packs'))
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace(/\.v\d+\.json$/, ''))
    );
    const { rows } = await pool.query('SELECT DISTINCT code FROM public.specialty_packs ORDER BY code');
    const inDb = rows.map((r) => r.code);
    check('the catalogue holds exactly the packs shipped on disk',
      inDb.length === shipped.size && inDb.every((c) => shipped.has(c))
      || (() => { console.log('     db:', inDb.join(','), '| disk:', [...shipped].join(',')); return false; })());
    check('the synthetic test pack left no trace', !inDb.some((c) => c.startsWith('ptest_')));
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
  // Leave the catalogue as we found it even on the way out.
  await cleanupSpecialties().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(1);
});
