// Load the specialty packs in backend/data/specialty-packs into public.specialty_packs.
//
// Usage:  node backend/scripts/load-specialty-packs.js [--dry-run]
//         npm run packs:load
//
// Validates every file first and loads NOTHING if any of them fails — a half-loaded
// catalogue is harder to reason about than an unloaded one.
//
// Clinical review is not something this script can grant. Every pack lands with
// clinical_review_status = 'pending', and re-loading never downgrades a version a
// clinician has already approved: the approval is attached to (code, version), so an
// edited pack must get a new version number to be reviewed again. That is the point —
// otherwise "approved" would mean "approved at some earlier, unknown content".

const fs = require('fs');
const path = require('path');

const pool = require('../db');
const { validatePack } = require('../utils/specialtyPackSchema');

const PACK_DIR = path.join(__dirname, '..', 'data', 'specialty-packs');
const DRY_RUN = process.argv.includes('--dry-run');

function loadFiles() {
  if (!fs.existsSync(PACK_DIR)) return [];
  return fs.readdirSync(PACK_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const full = path.join(PACK_DIR, f);
      let parsed;
      try {
        parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
      } catch (e) {
        return { file: f, error: `not valid JSON: ${e.message}` };
      }
      return { file: f, pack: parsed };
    });
}

(async () => {
  const files = loadFiles();
  if (!files.length) {
    console.log('No pack files found in backend/data/specialty-packs — nothing to do.');
    await pool.end();
    process.exit(0);
  }

  // The taxonomy has to exist first: a pack whose code is not a known specialty would be
  // unreachable from the wizard, which is a silent failure rather than a loud one.
  let known = [];
  try {
    const { rows } = await pool.query('SELECT code FROM public.specialties WHERE is_active = true');
    known = rows.map((r) => r.code);
  } catch (e) {
    console.error(`Cannot read public.specialties (${e.code || 'error'}): run \`npm run migrate\` first.`);
    await pool.end();
    process.exit(2);
  }

  console.log(`Validating ${files.length} pack file(s) against ${known.length} known specialties\n`);

  let bad = 0;
  const ok = [];
  for (const entry of files) {
    if (entry.error) {
      console.error(`  FAIL  ${entry.file}: ${entry.error}`);
      bad++;
      continue;
    }
    const { valid, errors } = validatePack(entry.pack, { knownSpecialties: known });
    if (!valid) {
      console.error(`  FAIL  ${entry.file}`);
      errors.forEach((e) => console.error(`          ${e}`));
      bad++;
      continue;
    }
    const counts = ['serviceCategories', 'offerings', 'appointmentTypes', 'formTemplates', 'inventoryCategories']
      .map((s) => `${(entry.pack[s] || []).length} ${s}`)
      .join(', ');
    console.log(`  ok    ${entry.file}  (${entry.pack.code} v${entry.pack.version}: ${counts})`);
    ok.push(entry);
  }

  if (bad > 0) {
    console.error(`\n${bad} pack(s) failed validation. Nothing was loaded.`);
    await pool.end();
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log('\n--dry-run: validation only, nothing written.');
    await pool.end();
    process.exit(0);
  }

  const client = await pool.connect();
  let inserted = 0;
  let refreshed = 0;
  let locked = 0;
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL search_path TO public');
    for (const { file, pack } of ok) {
      const { rows: existing } = await client.query(
        'SELECT clinical_review_status FROM public.specialty_packs WHERE code = $1 AND version = $2',
        [pack.code, pack.version]
      );

      if (existing.length && existing[0].clinical_review_status === 'approved') {
        // Approval is attached to this exact content. Overwriting the definition under an
        // approved version would make the sign-off a lie, so the file is skipped and the
        // author is told to bump the version.
        console.log(`  kept  ${file}: ${pack.code} v${pack.version} is clinically approved — bump the version to change it`);
        locked++;
        continue;
      }

      const { rowCount } = await client.query(
        `INSERT INTO public.specialty_packs (code, version, label, definition, is_active)
         VALUES ($1, $2, $3, $4::jsonb, true)
         ON CONFLICT (code, version) DO UPDATE
           SET label = EXCLUDED.label,
               definition = EXCLUDED.definition,
               is_active = true,
               updated_at = CURRENT_TIMESTAMP
         RETURNING (xmax = 0) AS was_insert`,
        [pack.code, pack.version, pack.label || null, JSON.stringify(pack)]
      );
      if (rowCount) {
        if (existing.length) refreshed++; else inserted++;
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`\nLoad failed, nothing committed: ${e.message}`);
    client.release();
    await pool.end();
    process.exit(2);
  }
  client.release();

  const { rows: pending } = await pool.query(
    `SELECT code, version FROM public.specialty_packs
      WHERE is_active = true AND clinical_review_status = 'pending'
      ORDER BY code, version`
  );

  console.log(`\n${inserted} new, ${refreshed} updated, ${locked} left alone (approved).`);
  if (pending.length) {
    console.log(`\n${pending.length} pack(s) await clinical review: ${pending.map((p) => `${p.code} v${p.version}`).join(', ')}`);
    console.log('They can be applied, but the API and the wizard will say the content is an engineering draft.');
    console.log('A clinician signs one off with:');
    console.log("  UPDATE public.specialty_packs SET clinical_review_status = 'approved',");
    console.log("         reviewed_by = 'name', reviewed_at = now()");
    console.log("   WHERE code = 'dentistry' AND version = 1;");
  }

  await pool.end();
  process.exit(0);
})().catch(async (e) => {
  console.error('Fatal:', e.message);
  await pool.end().catch(() => {});
  process.exit(2);
});
