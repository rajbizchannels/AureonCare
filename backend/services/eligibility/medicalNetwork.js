/**
 * Insurance eligibility over the clearinghouse's JSON eligibility API — the X12 270/271
 * exchange as Optum (formerly Change Healthcare) exposes it: "Medical Network Eligibility v3".
 *
 *   buildRequest(input)  → { body, missing }   the 270 as JSON, or what is missing to send one
 *   parseResponse(json)  → { status, coverage, message }   the 271 summarised for the front desk
 *
 * Pure: no network, no database. The connector (vendorIntegrations/optumService.js) posts the
 * body; services/eligibility/index.js stores the result.
 *
 * Field names follow the published v3 schema. The integration has not been run against a live
 * Optum account from here, so the paths are configurable in the Optum integration settings.
 */

const ymd = (v) => {
  if (!v) return null;
  const s = String(v instanceof Date ? v.toISOString() : v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.replace(/-/g, '') : null;
};
const fromYmd = (v) => (v && /^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : null);
const gender = (g) => ({ m: 'M', male: 'M', f: 'F', female: 'F' })[String(g || '').toLowerCase()] || undefined;
const clean = (s, max = 60) => String(s || '').replace(/[^\p{L}\p{N} .'-]/gu, '').trim().slice(0, max);

/** Valid US NPI: 10 digits, Luhn check over "80840" + first nine digits. */
function isValidNpi(npi) {
  const s = String(npi || '');
  if (!/^\d{10}$/.test(s)) return false;
  const digits = ('80840' + s.slice(0, 9)).split('').map(Number);
  let sum = 0;
  for (let i = digits.length - 1, dbl = true; i >= 0; i -= 1, dbl = !dbl) {
    let d = digits[i];
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return (10 - (sum % 10)) % 10 === Number(s[9]);
}

/**
 * input: { controlNumber?, payerId (trading partner id), provider: { name, npi },
 *          subscriber: { memberId, firstName, lastName, dateOfBirth, gender },
 *          serviceDate, serviceType = '30' }
 */
function buildRequest(input) {
  const missing = [];
  const sub = input.subscriber || {};
  if (!input.payerId) missing.push("the payer's electronic payer ID (Insurance Payers → Electronic payer ID)");
  if (!sub.memberId) missing.push("the patient's insurance member ID");
  if (!sub.firstName || !sub.lastName) missing.push("the patient's name");
  if (!ymd(sub.dateOfBirth)) missing.push("the patient's date of birth");
  if (!input.provider || !isValidNpi(input.provider.npi)) missing.push("the practice's NPI (Clinic Settings → NPI, 10 digits)");
  if (!input.provider || !clean(input.provider.name)) missing.push("the practice's name");
  const serviceDate = ymd(input.serviceDate || new Date());
  if (missing.length) return { body: null, missing };

  const controlNumber = String(input.controlNumber || Math.floor(100000000 + Math.random() * 899999999)).slice(0, 9).padStart(9, '0');
  return {
    missing: [],
    body: {
      controlNumber,
      tradingPartnerServiceId: String(input.payerId).trim(),
      provider: { organizationName: clean(input.provider.name, 60), npi: String(input.provider.npi) },
      subscriber: {
        memberId: String(sub.memberId).trim(),
        firstName: clean(sub.firstName, 35),
        lastName: clean(sub.lastName, 60),
        dateOfBirth: ymd(sub.dateOfBirth),
        ...(gender(sub.gender) ? { gender: gender(sub.gender) } : {}),
      },
      encounter: { dateOfService: serviceDate, serviceTypeCodes: [String(input.serviceType || '30')] },
    },
  };
}

const ACTIVE = new Set(['1', '2', '3', '4', '5']);   // active coverage (and its variants)
const INACTIVE = new Set(['6', '7', '8']);           // inactive / pending update / pending investigation
const money = (v) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

/** The benefit row that best answers "what does the patient pay for this service, in network?" */
function pick(benefits, code, serviceType, { level = null, time = null } = {}) {
  const rows = benefits.filter((b) => b.code === code
    && (!level || !b.coverageLevelCode || b.coverageLevelCode === level)
    && (!time || b.timeQualifierCode === time));
  const score = (b) => (b.inPlanNetworkIndicatorCode === 'Y' ? 2 : b.inPlanNetworkIndicatorCode === 'W' ? 1 : 0)
    + ((b.serviceTypeCodes || []).includes(serviceType) ? 4 : 0) + ((b.serviceTypeCodes || []).includes('30') ? 1 : 0);
  return rows.sort((a, b) => score(b) - score(a))[0] || null;
}

function parseResponse(json, { serviceType = '30' } = {}) {
  const r = json || {};
  const errors = Array.isArray(r.errors) ? r.errors : [];
  const planStatus = Array.isArray(r.planStatus) ? r.planStatus : [];
  const benefits = Array.isArray(r.benefitsInformation) ? r.benefitsInformation : [];

  let status = 'unknown';
  if (planStatus.some((p) => ACTIVE.has(String(p.statusCode))) || benefits.some((b) => b.code === '1')) status = 'active';
  else if (planStatus.some((p) => INACTIVE.has(String(p.statusCode))) || benefits.some((b) => b.code === '6')) status = 'inactive';
  else if (errors.length) status = 'error';

  const copay = pick(benefits, 'B', serviceType);
  const coins = pick(benefits, 'A', serviceType);
  const dedTotal = pick(benefits, 'C', serviceType, { level: 'IND', time: '23' }) || pick(benefits, 'C', serviceType, { level: 'IND' });
  const dedLeft = pick(benefits, 'C', serviceType, { level: 'IND', time: '29' });
  const oopTotal = pick(benefits, 'G', serviceType, { level: 'IND', time: '23' });
  const oopLeft = pick(benefits, 'G', serviceType, { level: 'IND', time: '29' });
  const activeRow = benefits.find((b) => b.code === '1') || {};
  const dates = r.planDateInformation || {};
  const [planBegin, planEnd] = String(dates.plan || '').split('-');

  const coverage = {
    payerName: (r.payer && r.payer.name) || null,
    planName: activeRow.planCoverage || (planStatus[0] && planStatus[0].planDetails) || null,
    groupNumber: (r.planInformation && r.planInformation.groupNumber) || null,
    coverageStart: fromYmd(dates.planBegin || dates.eligibilityBegin || planBegin) || null,
    coverageEnd: fromYmd(dates.planEnd || dates.eligibilityEnd || planEnd) || null,
    copay: copay ? money(copay.benefitAmount) : null,
    coinsurancePercent: coins && coins.benefitPercent !== undefined ? Math.round(Number(coins.benefitPercent) * 100) : null,
    deductible: dedTotal || dedLeft ? { total: dedTotal ? money(dedTotal.benefitAmount) : null, remaining: dedLeft ? money(dedLeft.benefitAmount) : null } : null,
    outOfPocket: oopTotal || oopLeft ? { total: oopTotal ? money(oopTotal.benefitAmount) : null, remaining: oopLeft ? money(oopLeft.benefitAmount) : null } : null,
  };

  const errorText = errors.map((e) => [e.description, e.followupAction].filter(Boolean).join(' — ')).filter(Boolean).join('; ');
  const message = status === 'active' ? 'Coverage is active.'
    : status === 'inactive' ? 'Coverage is not active for this date of service.'
      : errorText || 'The payer did not say whether coverage is active.';
  return { status, coverage, message: status === 'error' || (status !== 'active' && errorText) ? (errorText || message) : message, controlNumber: r.controlNumber || null };
}

module.exports = { buildRequest, parseResponse, isValidNpi };
