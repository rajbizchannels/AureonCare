// AI anonymizer + cost guidance, no database needed.
//
// The point of this suite: no identifier we know about survives anonymize(), the same
// value always maps to the same token inside one request, and deanonymize() restores the
// exact original text — while a token we never issued is reported, not silently filled.

const path = require('path');
const BACKEND = path.join(__dirname, '..', '..');
const { anonymize, deanonymize, deanonymizeDeep, entitiesFromPatient } = require(path.join(BACKEND, 'services/ai/phiAnonymizer'));
const catalog = require(path.join(BACKEND, 'services/ai/featureCatalog'));

const results = [];
const check = (name, cond) => results.push([name, !!cond]);

const patient = {
  first_name: 'Maria', last_name: 'García', mrn: 'MRN-0042', date_of_birth: '1980-03-14',
  phone: '(555) 123-4567', email: 'maria.garcia@example.com', address: '12 Rue de la Paix',
  city: 'Lyon', zip: '69002', insurance_id: 'XZ99887766',
};
const phi = ['Maria', 'García', 'MRN-0042', '03/14/1980', '1980-03-14', '(555) 123-4567',
  'maria.garcia@example.com', '12 Rue de la Paix', 'Lyon', 'XZ99887766', '123-45-6789',
  '+44 20 7946 0958', 'https://portal.example.org/p/42', '10.1.2.3', '445566778899', 'March 2, 2026', '2026-02-28'];

const text = [
  'Maria García (DOB 03/14/1980, MRN-0042) attended on March 2, 2026.',
  'GARCÍA, Maria reports chest pain 7/10 since 2026-02-28. Lives at 12 Rue de la Paix, Lyon 69002.',
  'Phone (555) 123-4567, alt +44 20 7946 0958, email maria.garcia@example.com.',
  'SSN 123-45-6789. Insurance XZ99887766. Policy 445566778899. Portal https://portal.example.org/p/42.',
  'Device IP 10.1.2.3. BP 120/80, HR 72. Plan: ECG, troponin.',
].join('\n');

const out = anonymize(text, { entities: entitiesFromPatient(patient) });

for (const value of phi) {
  check(`"${value}" is not in the anonymized text`, !out.text.toLowerCase().includes(value.toLowerCase()));
}
check('clinical content is kept (chest pain, ECG, BP 120/80)', /chest pain/.test(out.text) && /ECG/.test(out.text) && /120\/80/.test(out.text));
check('pain score 7/10 is not mistaken for a date', /7\/10/.test(out.text));
check('placeholders use the [[CATEGORY_N]] shape', out.entries.every((e) => /^\[\[[A-Z_]+_\d+\]\]$/.test(e.token)));
check('the full name gets a PATIENT_NAME token', out.entries.some((e) => e.category === 'PATIENT_NAME' && e.value === 'Maria García'));
check('record values are tagged as record matches', out.entries.filter((e) => e.method === 'record').length >= 5);
check('pattern matches are found too (SSN, URL, IP)',
  ['SSN', 'URL', 'IP_ADDRESS'].every((c) => out.entries.some((e) => e.category === c && e.method === 'pattern')));

const tokens = out.entries.map((e) => e.token);
check('every token is unique within a request', new Set(tokens).size === tokens.length);
const nameEntry = out.entries.find((e) => e.value === 'Maria García');
check('the same value reuses its token', nameEntry && nameEntry.occurrences >= 1);

const back = deanonymize(out.text, out.entries);
check('deanonymize restores the exact original text', back.text === text);
check('every token is reported as restored', back.restoredTokens.length === out.entries.length);

const tolerant = deanonymize('Hello [[ PATIENT_NAME_1 ]]', out.entries);
check('spaces the model adds inside a token are tolerated', tolerant.text === `Hello ${out.entries.find((e) => e.token === '[[PATIENT_NAME_1]]').value}`);

const ghost = deanonymize('See [[PATIENT_NAME_99]] and [[MADE_UP_1]]', out.entries);
check('unknown tokens are left in place', ghost.text.includes('[[PATIENT_NAME_99]]') && ghost.text.includes('[[MADE_UP_1]]'));
check('unknown tokens are reported', ghost.unknownTokens.length === 2);

const deep = deanonymizeDeep({ a: '[[PATIENT_NAME_1]]', b: ['[[MRN_1]]', 3], c: { d: null } }, out.entries);
check('deanonymizeDeep restores nested strings', deep.a.length > 0 && !deep.a.includes('[[') && !String(deep.b[0]).includes('[[') && deep.b[1] === 3);

const arabic = anonymize('المريض محمد الأحمد حضر اليوم. محمد بخير.', {
  entities: [{ category: 'PATIENT_NAME', value: 'محمد الأحمد' }, { category: 'PATIENT_NAME', value: 'محمد' }],
});
check('Arabic names are anonymized', !arabic.text.includes('محمد'));
check('Arabic round trip is exact', deanonymize(arabic.text, arabic.entries).text === 'المريض محمد الأحمد حضر اليوم. محمد بخير.');

const partial = anonymize('Ann went to Annecy with Annabel.', { entities: [{ category: 'PATIENT_NAME', value: 'Ann' }] });
check('a short name is not replaced inside longer words', partial.text === '[[PATIENT_NAME_1]] went to Annecy with Annabel.');

check('empty input is safe', anonymize('').text === '' && anonymize(null).entries.length === 0);

// ── cost guidance ──────────────────────────────────────────────────────────────
const scribe = catalog.getFeature('ambient_scribe');
const g = catalog.costGuidance(scribe, 'claude-sonnet-5-5', 'anthropic');
check('scribe on Sonnet 5.5 ≈ $0.024 per use', Math.abs(g.perUseUsd - 0.024) < 1e-9);
check('scribe monthly = per use × 4,400', Math.abs(g.monthlyUsd - 0.024 * 4400) < 1e-6);
check('scribe flags speech-to-text as an extra cost', g.extra && g.extra.key === 'speechToText');
check('offline costs nothing per use', catalog.costGuidance(scribe, 'qwen3:14b', 'offline').perUseUsd === 0);
check('an unknown cloud model has no estimate rather than a wrong one',
  catalog.costGuidance(scribe, 'some-new-model', 'openai').perUseUsd === null);
check('there are 12 features', catalog.FEATURES.length === 12);
check('every feature names at least one reviewer role', catalog.FEATURES.every((f) => f.reviewerRoles.length > 0));
check('the public catalog does not expose prompts', !JSON.stringify(catalog.publicCatalog()).includes('You draft a SOAP note'));

// ── report ────────────────────────────────────────────────────────────────────
let failed = 0;
for (const [name, ok] of results) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed += 1;
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
