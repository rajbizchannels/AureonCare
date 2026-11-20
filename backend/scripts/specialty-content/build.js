// Author the specialty packs in backend/data/specialty-packs/.
//
// Usage:  node backend/scripts/specialty-content/build.js            # write the files
//         node backend/scripts/specialty-content/build.js --check    # validate only
//
// The JSON files are the artefact that gets loaded; this is how they were produced. It
// exists so 32 packs share one shape and one set of defaults rather than drifting, and so
// a change to the shape is one edit rather than 32.
//
// ── The rule on procedure codes ──────────────────────────────────────────────────────
//
// A code is included ONLY where it is standard and unambiguous. Where it is not, the
// offering ships WITHOUT one. A missing code is a blank a practice fills in from its own
// billing setup; a wrong code is a denied claim or a compliance problem, and it looks
// exactly as authoritative as a right one. Inventing plausible codes for a medical product
// is the single worst thing this file could do.
//
// Every pack it writes carries clinical_review_status = 'pending' when loaded, and the
// wizard makes an administrator acknowledge that the content is an engineering draft.
//
// ── A naming collision to know about ────────────────────────────────────────────────
//
// The pack validator scans identifier-like fields for SQL keywords, and a name is an
// identifier here: it is the natural key the apply engine matches rows on. So an
// appointment type called "Specimen Drop-off" is rejected for the `drop` in it. That is an
// unlucky collision rather than a fault in the check, and the fix is to pick another name
// ("Specimen Delivery") rather than to loosen a check that exists to catch DROP TABLE.

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', '..', 'data', 'specialty-packs');
const { validatePack } = require('../../utils/specialtyPackSchema');

const CHECK_ONLY = process.argv.includes('--check');

const GROUPS = ['primary-care', 'medical', 'surgical', 'other'];

/** Defaults every pack gets unless it says otherwise. */
function withDefaults(code, spec) {
  const pack = {
    code,
    version: 1,
    label: spec.label,
    description: spec.description,
  };
  if (spec.hide && spec.hide.length) pack.modules = { hide: spec.hide };
  if (spec.terminology) pack.terminology = spec.terminology;
  pack.appointmentTypes = (spec.appointmentTypes || []).map((t, i) => ({
    name: t.name,
    durationMinutes: t.minutes,
    color: t.color || ['#2563EB', '#0EA5E9', '#14B8A6', '#8B5CF6', '#F59E0B', '#64748B', '#DC2626'][i % 7],
    displayOrder: (i + 1) * 10,
  }));
  pack.serviceCategories = (spec.categories || []).map((c, i) => ({
    name: c.name,
    icon: c.icon,
    displayOrder: (i + 1) * 10,
  }));
  pack.offerings = (spec.offerings || []).map((o) => {
    const row = { name: o.name, categoryName: o.cat };
    if (o.minutes) row.durationMinutes = o.minutes;
    if (o.cpt) row.cptCodes = o.cpt;           // present only where we are sure
    if (o.minAge != null) row.minAge = o.minAge;
    if (o.maxAge != null) row.maxAge = o.maxAge;
    if (o.consent) row.consentFormRequired = true;
    if (o.prep) { row.requiresPreparation = true; row.preparationInstructions = o.prep; }
    if (o.description) row.description = o.description;
    return row;
  });
  if (spec.forms && spec.forms.length) pack.formTemplates = spec.forms;
  if (spec.inventory && spec.inventory.length) {
    pack.inventoryCategories = spec.inventory.map((c) => ({ code: c.code, name: c.name }));
  }
  if (spec.icd10 || spec.cpt) {
    pack.codeSets = {};
    if (spec.icd10) pack.codeSets.icd10 = spec.icd10;
    if (spec.cpt) pack.codeSets.cpt = spec.cpt;
  }
  pack.settings = {
    defaultAppointmentDuration: spec.defaultDuration || 20,
    slotIntervalMinutes: spec.slotInterval || 10,
  };
  pack.reports = { show: spec.reports || ['clinical', 'operational'] };
  return pack;
}

const all = {};
for (const g of GROUPS) {
  // eslint-disable-next-line global-require, import/no-dynamic-require
  Object.assign(all, require(`./${g}`));
}

const known = Object.keys(all);
let bad = 0;
const written = [];

for (const [code, spec] of Object.entries(all)) {
  const pack = withDefaults(code, spec);
  const { valid, errors } = validatePack(pack, { knownSpecialties: known.concat([code]) });
  if (!valid) {
    console.error(`  FAIL  ${code}`);
    errors.forEach((e) => console.error(`          ${e}`));
    bad++;
    continue;
  }
  const counts = `${pack.appointmentTypes.length} types, ${pack.serviceCategories.length} categories, `
    + `${pack.offerings.length} offerings, ${(pack.formTemplates || []).length} forms`;
  const coded = pack.offerings.filter((o) => o.cptCodes).length;
  console.log(`  ok    ${code.padEnd(22)} ${counts} (${coded}/${pack.offerings.length} with a code)`);
  if (!CHECK_ONLY) {
    fs.writeFileSync(path.join(OUT_DIR, `${code}.v1.json`), JSON.stringify(pack, null, 2) + '\n');
  }
  written.push(code);
}

if (bad) {
  console.error(`\n${bad} pack(s) failed validation; nothing written for those.`);
  process.exit(1);
}
console.log(`\n${written.length} pack(s) ${CHECK_ONLY ? 'validated' : 'written'}.`);
