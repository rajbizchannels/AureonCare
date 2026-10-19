// Find — and optionally repair — tenants whose system form library is missing or short.
//
// Usage:  node backend/scripts/repair-form-library.js --check    # report only, non-zero exit if short
//         node backend/scripts/repair-form-library.js            # copy the missing rows in
//         npm run check:form-library / npm run repair:form-library
//
// WHY THIS IS NEEDED. The library reaches a tenant by one of two routes: tenant/008 for
// tenants that existed when it ran, and a copy out of `template` in
// services/tenantProvisioning.js for tenants created afterwards. The second route has no
// self-healing path — a tenant provisioned while that copy fails (a transient error, a bad
// deploy) is left with no library FOREVER, because it inherited template's
// schema_migrations and so tenant/008 will never run for it. The symptom is quiet: the
// form library screen is simply empty.
//
// Found the hard way: six tenants in a development database had zero templates, created by
// test runs during which the provisioning copy had been deliberately disabled. Nothing
// reported it.
//
// Repairing is a straight copy from `template`, so it is idempotent and cannot invent
// content. Rows the practice has customised are never touched.

const pool = require('./../db');

const CHECK_ONLY = process.argv.includes('--check');
const SAFE_SCHEMA = /^[a-z_][a-z0-9_]*$/;

async function expected() {
  const { rows } = await pool.query(
    `SELECT (SELECT count(*)::int FROM template.form_templates WHERE source_pack = 'base') AS templates,
            (SELECT count(*)::int FROM template.form_categories) AS categories`
  );
  return rows[0];
}

async function schemas() {
  const { rows } = await pool.query(
    `SELECT schema_name FROM control.tenants
      WHERE schema_name IS NOT NULL AND status <> 'suspended'
      ORDER BY created_at`
  );
  return rows.map((r) => r.schema_name).filter((s) => SAFE_SCHEMA.test(s));
}

(async () => {
  let want;
  try {
    want = await expected();
  } catch (e) {
    console.error(`Cannot read template.form_templates (${e.code || 'error'}): run the migrations first.`);
    await pool.end();
    process.exit(2);
  }

  if (want.templates === 0) {
    console.error('template has no base form templates — run `npm run migrate:tenants` (tenant/008) first.');
    await pool.end();
    process.exit(2);
  }

  const list = await schemas();
  console.log(`Expecting ${want.templates} base templates and ${want.categories} categories per tenant`);
  console.log(`Checking ${list.length} tenant schema(s)\n`);

  const short = [];
  for (const schema of list) {
    let got;
    try {
      const { rows } = await pool.query(
        `SELECT (SELECT count(*)::int FROM ${schema}.form_templates WHERE source_pack = 'base') AS templates,
                (SELECT count(*)::int FROM ${schema}.form_categories) AS categories`
      );
      got = rows[0];
    } catch (e) {
      console.error(`  ERROR  ${schema}: ${e.message}`);
      short.push({ schema, templates: -1, categories: -1 });
      continue;
    }
    // More than expected is fine: migration 009 leaves a specialty form in place when the
    // practice has edited it or something references it.
    if (got.templates < want.templates || got.categories < want.categories) {
      short.push({ schema, ...got });
    }
  }

  if (!short.length) {
    console.log('OK — every tenant has the full system form library.');
    await pool.end();
    process.exit(0);
  }

  for (const s of short) {
    console.log(`  short  ${s.schema}: ${s.templates} template(s), ${s.categories} categorie(s)`);
  }

  if (CHECK_ONLY) {
    console.error(`\n${short.length} tenant(s) are missing part of the form library.`);
    console.error('Forms sent to patients from those tenants would have no template to link to.');
    console.error('Run `npm run repair:form-library` to copy the missing rows from `template`.');
    await pool.end();
    process.exit(1);
  }

  console.log(`\nRepairing ${short.length} tenant(s) by copying from \`template\`…\n`);
  let repaired = 0;
  for (const { schema } of short) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO ${schema}.form_categories
           (id, name, slug, description, color, icon, parent_id, sort_order, is_active)
         SELECT id, name, slug, description, color, icon, parent_id, sort_order, is_active
           FROM template.form_categories
         ON CONFLICT (slug) DO NOTHING`
      );
      const { rowCount } = await client.query(
        `INSERT INTO ${schema}.form_templates
           (id, name, slug, description, category_id, category_slug, subcategory, template_type,
            is_system_template, is_active, version, version_number, fields, settings,
            require_signature, require_witness, allow_pdf_export, languages, tags,
            intake_flow_eligible, specialty, compliance_tags, source_pack, source_pack_version,
            is_customised)
         SELECT id, name, slug, description, category_id, category_slug, subcategory, template_type,
                is_system_template, is_active, version, version_number, fields, settings,
                require_signature, require_witness, allow_pdf_export, languages, tags,
                intake_flow_eligible, specialty, compliance_tags, source_pack, source_pack_version,
                false
           FROM template.form_templates
          WHERE source_pack = 'base'
         ON CONFLICT (slug) DO NOTHING`
      );
      await client.query('COMMIT');
      console.log(`  ok     ${schema}: ${rowCount} template(s) added`);
      repaired++;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`  FAILED ${schema}: ${e.message}`);
    } finally {
      client.release();
    }
  }

  console.log(`\n${repaired}/${short.length} tenant(s) repaired.`);
  await pool.end();
  process.exit(repaired === short.length ? 0 : 1);
})().catch(async (e) => {
  console.error('Fatal:', e.message);
  await pool.end().catch(() => {});
  process.exit(2);
});
