/**
 * Claim scrubbing — check a claim BEFORE it is submitted, so it is fixed here rather than denied
 * by the payer weeks later.
 *
 *   scrub(req, claim, { ai })  → { status: 'passed'|'warnings'|'failed', errors, warnings, issues[], ai }
 *
 * Two layers:
 *   1. Rules (always): the deterministic checks payers and clearinghouses reject on — identifiers,
 *      code validity and specificity, dates and timely filing, duplicates, prior authorisation,
 *      eligibility. An `error` blocks submission; a `warning` is shown and can be submitted.
 *   2. AI review (when the practice has switched on the "Claim Scrubbing" AI feature): reads the
 *      claim the way a billing specialist would (code pairing, missing modifiers, medical
 *      necessity) and lists likely denial reasons. Advisory only — never blocks; PHI is
 *      anonymised by the AI gateway before anything leaves; the draft is audited.
 *
 * Submission is gated in routes/claims.js and routes/edi.js by `requireCleanScrub`.
 */

const { isValidNpi } = require('./eligibility/medicalNetwork');
const { latestFor } = require('./eligibility');

const ICD10 = /^[A-TV-Z][0-9][0-9A-Z](\.[0-9A-Z]{1,4})?$/;
const CPT_HCPCS = /^(\d{4}[0-9A-Z]|[A-V]\d{4})(-[0-9A-Z]{2})*$/;
const CLOSED = ['denied', 'rejected', 'cancelled', 'canceled', 'void', 'voided'];

const codeOf = (c) => String(typeof c === 'object' && c ? (c.code || '') : (c || '')).trim().toUpperCase();
const list = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim().startsWith('[')) { try { return JSON.parse(v); } catch { return []; } }
  if (typeof v === 'string' && v.trim()) return v.split(',');
  return [];
};
const isoDay = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d || '').slice(0, 10));

async function codeTable(db, type, codes) {
  // Reference code sets (public.medical_codes). Empty table → skip the existence check.
  try {
    const { rows: [{ n }] } = await db.query('SELECT count(*)::int AS n FROM public.medical_codes WHERE code_type = $1', [type]);
    if (!n) return null;
    const { rows } = await db.query(
      `SELECT upper(code) AS code FROM public.medical_codes WHERE code_type = $1 AND upper(code) = ANY($2::text[]) AND COALESCE(is_active, true)`,
      [type, codes]);
    return new Set(rows.map((r) => r.code));
  } catch { return null; }
}

async function hasChildren(db, code) {
  const { rows } = await db.query(
    `SELECT 1 FROM public.medical_codes WHERE code_type = 'ICD-10' AND replace(upper(code), '.', '') LIKE $1 LIMIT 1`,
    [`${code.replace('.', '')}_%`]);
  return rows.length > 0;
}

async function resolvePayer(db, claim, patient) {
  const byId = claim.payer_id || (patient && patient.insurance_payer_id);
  if (byId) {
    const { rows } = await db.query('SELECT * FROM insurance_payers WHERE id::text = $1::text', [byId]);
    if (rows[0]) return rows[0];
  }
  if (claim.payer) {
    const { rows } = await db.query('SELECT * FROM insurance_payers WHERE lower(name) = lower($1) LIMIT 1', [claim.payer]);
    if (rows[0]) return rows[0];
  }
  return null;
}

/** The deterministic checks. */
async function ruleIssues(db, claim, { practiceId }) {
  const issues = [];
  const add = (severity, code, field, message, fix) => issues.push({ severity, code, field, message, fix, source: 'rules' });

  // ── patient ──
  const patient = claim.patient_id
    ? (await db.query(`SELECT id, first_name, last_name, date_of_birth, gender, insurance_id, insurance_payer_id, insurance_info
                         FROM patients WHERE id::text = $1::text`, [claim.patient_id])).rows[0]
    : null;
  if (!patient) add('error', 'PATIENT_MISSING', 'patient', 'The claim has no patient.', 'Choose the patient.');
  else {
    if (!patient.date_of_birth) add('error', 'PATIENT_DOB', 'patient', "The patient's date of birth is missing.", "Add it to the patient's record.");
    if (!patient.gender) add('warning', 'PATIENT_SEX', 'patient', "The patient's sex is not recorded; most payers require it.", "Add it to the patient's record.");
    const info = patient.insurance_info || {};
    if (!(patient.insurance_id || info.member_id || info.memberId)) {
      add('error', 'MEMBER_ID', 'patient', "The patient's insurance member ID is missing.", "Add it under the patient's Insurance Information.");
    }
  }

  // ── payer ──
  const payer = await resolvePayer(db, claim, patient);
  if (!payer) add('error', 'PAYER_MISSING', 'payer', 'No insurance payer is linked to this claim.', "Set the patient's insurance payer.");
  else {
    if (payer.is_active === false) add('error', 'PAYER_INACTIVE', 'payer', `${payer.name} is marked inactive.`, 'Check the payer in Insurance Payers.');
    if (!payer.electronic_payer_id) add('warning', 'PAYER_EDI_ID', 'payer', `${payer.name} has no electronic payer ID, so the claim cannot be sent electronically.`, 'Add the electronic payer ID in Insurance Payers, or submit on paper.');
  }

  // ── billing provider ──
  const practice = practiceId
    ? (await db.query('SELECT name, npi, tax_id FROM public.practices WHERE id::text = $1::text', [practiceId])).rows[0]
    : null;
  if (!practice || !isValidNpi(practice.npi)) add('error', 'NPI', 'provider', "The practice's NPI is missing or not a valid NPI.", 'Set it in Clinic Settings.');
  if (practice && !practice.tax_id) add('warning', 'TAX_ID', 'provider', "The practice's tax ID is missing; it is required on most claims.", 'Set it in Clinic Settings.');

  // ── codes ──
  const dx = [...new Set(list(claim.diagnosis_codes).map(codeOf).filter(Boolean))];
  const px = [...new Set(list(claim.procedure_codes).map(codeOf).filter(Boolean))];
  if (!dx.length) add('error', 'DX_NONE', 'diagnosis_codes', 'The claim has no diagnosis code.', 'Add at least one ICD-10 code.');
  if (dx.length > 12) add('error', 'DX_TOO_MANY', 'diagnosis_codes', `${dx.length} diagnosis codes; a professional claim allows 12.`, 'Keep the 12 that support the services billed.');
  const badDx = dx.filter((c) => !ICD10.test(c));
  badDx.forEach((c) => add('error', 'DX_FORMAT', 'diagnosis_codes', `${c} is not an ICD-10-CM code.`, 'Correct the code.'));
  const known = await codeTable(db, 'ICD-10', dx.filter((c) => ICD10.test(c)));
  if (known) {
    for (const c of dx.filter((x) => ICD10.test(x) && !known.has(x))) {
      if (await hasChildren(db, c)) add('error', 'DX_NOT_BILLABLE', 'diagnosis_codes', `${c} is a category, not a billable code.`, 'Choose the more specific code under it.');
      else add('warning', 'DX_UNKNOWN', 'diagnosis_codes', `${c} is not in the ICD-10 code set.`, 'Check the code.');
    }
  }
  if (!px.length) add('error', 'PX_NONE', 'procedure_codes', 'The claim has no procedure code.', 'Add the CPT/HCPCS codes for the services.');
  px.filter((c) => !CPT_HCPCS.test(c)).forEach((c) => add('error', 'PX_FORMAT', 'procedure_codes', `${c} is not a CPT or HCPCS code.`, 'Correct the code.'));
  const knownPx = await codeTable(db, 'CPT', px.filter((c) => /^\d{4}[0-9A-Z]/.test(c)).map((c) => c.slice(0, 5)));
  if (knownPx) px.filter((c) => /^\d{4}[0-9A-Z]/.test(c) && !knownPx.has(c.slice(0, 5)))
    .forEach((c) => add('warning', 'PX_UNKNOWN', 'procedure_codes', `${c} is not in the CPT code set.`, 'Check the code.'));

  // ── dates, amount ──
  const sd = isoDay(claim.service_date);
  const today = new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sd)) add('error', 'DOS_MISSING', 'service_date', 'The date of service is missing.', 'Add it.');
  else {
    if (sd > today) add('error', 'DOS_FUTURE', 'service_date', 'The date of service is in the future.', 'Correct the date.');
    const limit = payer && Number(payer.timely_filing_limit);
    if (limit > 0) {
      const age = Math.floor((Date.parse(today) - Date.parse(sd)) / 86400000);
      if (age > limit) add('error', 'TIMELY_FILING', 'service_date', `${payer.name} accepts claims within ${limit} days; this one is ${age} days old.`, 'It will be denied for timely filing unless you have proof of earlier submission.');
      else if (age > limit - 14) add('warning', 'TIMELY_FILING_SOON', 'service_date', `${limit - age} day(s) left to file with ${payer.name}.`, 'Submit now.');
    }
  }
  if (!(Number(claim.amount) > 0)) add('error', 'AMOUNT', 'amount', 'The billed amount must be more than zero.', 'Enter the charges.');

  // ── duplicates ──
  if (claim.patient_id && /^\d{4}-\d{2}-\d{2}$/.test(sd) && px.length) {
    const { rows } = await db.query(
      `SELECT id, claim_number, procedure_codes FROM claims
        WHERE patient_id::text = $1::text AND service_date = $2::date AND ($3::text IS NULL OR id::text <> $3::text)
          AND lower(COALESCE(status, '')) <> ALL($4::text[])`,
      [claim.patient_id, sd, claim.id || null, CLOSED]);
    for (const r of rows) {
      const theirs = list(r.procedure_codes).map(codeOf);
      const same = px.filter((c) => theirs.includes(c));
      if (same.length) add('error', 'DUPLICATE', 'procedure_codes', `Possible duplicate of claim ${r.claim_number || r.id}: same patient, date and ${same.join(', ')}.`, 'Do not bill the same service twice; correct or void one of them.');
    }
  }

  // ── prior authorisation ──
  if (payer && payer.prior_authorization_required) {
    let ok = false;
    if (claim.preapproval_id) {
      const { rows } = await db.query('SELECT status FROM preapprovals WHERE id::text = $1::text', [claim.preapproval_id]).catch(() => ({ rows: [] }));
      ok = rows[0] && /approv/i.test(rows[0].status || '');
    }
    if (!ok) add('warning', 'PRIOR_AUTH', 'preapproval_id', `${payer.name} requires prior authorisation and no approved authorisation is linked.`, 'Link the approved pre-authorisation, if this service needs one.');
  }

  // ── eligibility ──
  if (patient && payer && /^\d{4}-\d{2}-\d{2}$/.test(sd)) {
    const elig = await latestFor(db, patient.id, { payerId: payer.id, serviceDate: sd, maxAgeDays: 30 }).catch(() => null);
    if (!elig) add('warning', 'ELIGIBILITY_UNCHECKED', 'eligibility', 'Eligibility has not been checked for this date of service.', 'Run "Check eligibility".');
    else if (elig.status === 'inactive') add('error', 'ELIGIBILITY_INACTIVE', 'eligibility', `${payer.name} reported coverage NOT active on ${elig.serviceDate}.`, 'Confirm coverage with the patient; bill another payer or the patient.');
    else if (elig.status !== 'active') add('warning', 'ELIGIBILITY_UNCLEAR', 'eligibility', `The last eligibility check did not confirm coverage: ${elig.message || elig.status}.`, 'Check again or confirm with the payer.');
  }

  return { issues, patient, payer, dx, px, sd };
}

/** The AI review — advisory. Returns { status, text?, suggestionId?, message? }. */
async function aiReview(req, claim, ctx, ruleIssues) {
  try {
    const { runFeature } = require('./ai/aiGateway');
    const summary = [
      'Review this professional claim before submission for likely denial reasons.',
      `Date of service: ${ctx.sd || 'missing'}. Billed amount: ${claim.amount ?? 'missing'}.`,
      `Payer: ${ctx.payer ? ctx.payer.name : 'unknown'}${ctx.payer && ctx.payer.prior_authorization_required ? ' (requires prior authorisation)' : ''}.`,
      `Diagnosis codes (ICD-10): ${ctx.dx.join(', ') || 'none'}.`,
      `Procedure codes (CPT/HCPCS, with modifiers): ${ctx.px.join(', ') || 'none'}.`,
      ctx.patient && ctx.patient.date_of_birth ? `Patient age: ${Math.floor((Date.now() - new Date(ctx.patient.date_of_birth)) / 31557600000)}; sex: ${ctx.patient.gender || 'unknown'}.` : '',
      ruleIssues.length ? `Automated checks already found: ${ruleIssues.map((i) => i.message).join(' ')}` : 'Automated checks found no problems.',
      'Focus on: diagnosis–procedure pairing and medical necessity, missing or wrong modifiers (e.g. 25, 59, 95), unbundling, frequency limits, and age/sex conflicts. Reply as a short list; say "No further issues" if none.',
    ].filter(Boolean).join('\n');
    const out = await runFeature(req, { featureKey: 'claim_scrubbing', input: summary, patientId: ctx.patient ? ctx.patient.id : null, entityType: 'claim', entityId: claim.id || null });
    return { status: 'ok', text: out.draft, suggestionId: out.id, provider: out.provider, model: out.model };
  } catch (err) {
    if (err && err.code === 'AiFeatureDisabled') return { status: 'disabled', message: 'AI review is switched off (Settings → Integrations → AI → Claim Scrubbing).' };
    return { status: 'error', message: (err && err.message) || 'The AI review could not run.' };
  }
}

async function scrub(req, claim, { ai = true } = {}) {
  const db = req.db || req.app.locals.pool;
  const practiceId = (req.tenant && req.tenant.practiceId) || (req.user && req.user.practiceId) || null;
  const ctx = await ruleIssues(db, claim, { practiceId });
  const errors = ctx.issues.filter((i) => i.severity === 'error').length;
  const warnings = ctx.issues.filter((i) => i.severity === 'warning').length;
  const aiResult = ai ? await aiReview(req, claim, ctx, ctx.issues) : { status: 'skipped' };
  return {
    status: errors ? 'failed' : warnings ? 'warnings' : 'passed',
    errors, warnings, issues: ctx.issues, ai: aiResult, checkedAt: new Date().toISOString(),
  };
}

/** Store a scrub on a saved claim (and clear any earlier override). */
async function record(db, claimId, result) {
  await db.query(
    `UPDATE claims SET scrub_status = $1, scrub_result = $2, scrubbed_at = now(),
            scrub_override_by = NULL, scrub_override_reason = NULL
      WHERE id::text = $3::text`,
    [result.status, JSON.stringify(result), claimId]);
}

/**
 * Submission gate. A claim may be submitted only when its latest scrub ran AFTER its last change
 * and found no errors — or an admin/billing manager overrode a failed scrub with a reason.
 * Returns null when it may go, or { status, body } to send back.
 */
async function requireCleanScrub(db, claimId) {
  const { rows: [c] } = await db.query(
    'SELECT id, scrub_status, scrubbed_at, updated_at, scrub_override_by FROM claims WHERE id::text = $1::text', [claimId]);
  if (!c) return { status: 404, body: { error: 'Claim not found' } };
  const stale = !c.scrubbed_at || (c.updated_at && new Date(c.updated_at) > new Date(c.scrubbed_at));
  if (stale) return { status: 409, body: { error: 'Check the claim before submitting it (it has not been checked since it last changed).', scrubRequired: true } };
  if (c.scrub_status === 'failed' && !c.scrub_override_by) {
    return { status: 409, body: { error: 'The claim check found errors. Fix them, or an admin or billing manager can override with a reason.', scrubRequired: true, scrubStatus: 'failed' } };
  }
  return null;
}

module.exports = { scrub, record, requireCleanScrub, ruleIssues };
