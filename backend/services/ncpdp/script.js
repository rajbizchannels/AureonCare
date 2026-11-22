/**
 * NCPDP SCRIPT 2017071 — the message standard of the Surescripts e-prescribing network.
 *
 * Pure functions, no database or network: build NewRx and CancelRx messages, and read the
 * Status / Verify / Error messages that come back. surescriptsService.js posts what this builds.
 *
 * Before building, the data is checked for what the standard (and Surescripts) needs to route
 * and dispense a prescription. If anything is missing, nothing is built and the caller gets a
 * plain list ("Pharmacy NCPDP ID", "Prescriber SPI", ...) to show the prescriber — a broken
 * message would only come back as an Error from the network, or worse, be dispensed wrongly.
 *
 * Scope and limits (be explicit — this has NOT been through Surescripts certification):
 * - NewRx and CancelRx only. RxRenewalRequest/Response, RxChangeRequest, RxFill and
 *   CancelRxResponse arrive from pharmacies; AureonCare has no inbound endpoint for them yet,
 *   and its data model has no renewal-request record to answer, so they are not built.
 * - Controlled substances: the DEA number and schedule are included, but EPCS (two-factor
 *   signing and the digital signature Surescripts requires for controlled substances) is not
 *   implemented, so validate() refuses Schedule II–V prescriptions unless the caller passes
 *   { allowControlled: true } (only for testing).
 * - Element order follows the 2017071 schema as documented publicly; Surescripts certification
 *   testing is what proves it, and may ask for changes.
 */

const crypto = require('crypto');
const xml2js = require('xml2js');

const VERSION = '2017071';
const NS = 'http://www.ncpdp.org/schema/SCRIPT';

// ── Code lists ────────────────────────────────────────────────────────────────

/** QuantityUnitOfMeasure — NCI Thesaurus codes (NCPDP Billing Unit / Potency Unit list). */
const UNIT_CODES = {
  tablet: 'C48542', tablets: 'C48542', tab: 'C48542', tabs: 'C48542',
  capsule: 'C48480', capsules: 'C48480', cap: 'C48480', caps: 'C48480',
  ml: 'C28254', milliliter: 'C28254', milliliters: 'C28254', millilitre: 'C28254',
  gram: 'C48155', grams: 'C48155', g: 'C48155',
  patch: 'C48524', patches: 'C48524',
  each: 'C64933', unit: 'C64933', units: 'C64933', ea: 'C64933',
};
/** "Unspecified" — used when the form is unknown; pharmacies then read the drug description. */
const UNIT_UNSPECIFIED = 'C38046';

/** DEASchedule — NCI codes for Schedule I–V. */
const DEA_SCHEDULE_CODES = { 1: 'C48672', 2: 'C48675', 3: 'C48676', 4: 'C48677', 5: 'C48679' };

const unitCode = (unit) => UNIT_CODES[String(unit || '').trim().toLowerCase()] || UNIT_UNSPECIFIED;

/** "CII", "2", "II", "Schedule 3" … → 1–5, or null when not controlled. */
function deaSchedule(value) {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).toUpperCase().replace(/SCHEDULE|C(?=[IV\d])/g, '').trim();
  const roman = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
  if (roman[s]) return roman[s];
  const n = parseInt(s, 10);
  return n >= 1 && n <= 5 ? n : null;
}

const GENDER = { m: 'M', male: 'M', f: 'F', female: 'F', u: 'U', unknown: 'U', other: 'U' };
const gender = (g) => GENDER[String(g || '').trim().toLowerCase()] || null;

// ── XML helpers ───────────────────────────────────────────────────────────────

const escapeXml = (v) => String(v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
  // Characters XML 1.0 cannot carry at all (control characters other than tab/CR/LF).
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

const present = (v) => v !== undefined && v !== null && String(v).trim() !== '';

/** <Tag>value</Tag>, or '' when there is no value (optional elements are left out). */
const el = (tag, value, attrs = '') => (present(value) ? `<${tag}${attrs}>${escapeXml(String(value).trim())}</${tag}>` : '');
/** <Tag>children</Tag>, or '' when every child was empty. */
const wrap = (tag, ...children) => { const inner = children.join(''); return inner ? `<${tag}>${inner}</${tag}>` : ''; };

const isoDate = (d) => {
  if (!present(d)) return null;
  if (d instanceof Date) return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(d));
  return m ? m[1] : null;
};

/** NCPDP UTC time, e.g. 2026-11-22T20:15:03.120Z. */
const sentTime = (d = new Date()) => d.toISOString();

/** A message ID: up to 35 characters, unique per message. */
const newMessageId = () => crypto.randomBytes(16).toString('hex');

const digits = (v) => String(v || '').replace(/\D/g, '');

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * What a NewRx / CancelRx needs and this data lacks, as labels a prescriber can act on.
 * @returns {string[]} empty when the message can be built
 */
function validate(rx, { allowControlled = false } = {}) {
  const missing = [];
  const need = (ok, label) => { if (!ok) missing.push(label); };
  const p = rx.patient || {}; const ph = rx.pharmacy || {}; const pr = rx.prescriber || {}; const m = rx.medication || {};
  const addr = (a) => a || {};

  need(present(ph.ncpdpId) && /^\d{7}$/.test(digits(ph.ncpdpId)), 'Pharmacy NCPDP ID (7 digits)');
  need(present(ph.name), 'Pharmacy name');

  need(present(pr.spi), 'Prescriber Surescripts SPI');
  need(/^\d{10}$/.test(digits(pr.npi)), 'Prescriber NPI (10 digits)');
  need(present(pr.lastName) && present(pr.firstName), 'Prescriber name');
  need(present(addr(pr.address).line1) && present(addr(pr.address).city) && present(addr(pr.address).state) && present(addr(pr.address).postalCode), 'Prescriber address (line 1, city, state, ZIP)');
  need(digits(pr.phone).length >= 10, 'Prescriber phone number');

  need(present(p.lastName) && present(p.firstName), 'Patient name');
  need(Boolean(gender(p.gender)), 'Patient gender');
  need(Boolean(isoDate(p.dateOfBirth)), 'Patient date of birth');
  need(present(addr(p.address).line1) && present(addr(p.address).city) && present(addr(p.address).state) && present(addr(p.address).postalCode), 'Patient address (line 1, city, state, ZIP)');

  need(present(m.description), 'Drug description');
  need(/^\d{11}$/.test(digits(m.ndc)), 'Drug NDC (11 digits)');
  need(Number(m.quantity) > 0, 'Quantity');
  need(present(m.sig), 'Directions (sig)');

  const schedule = deaSchedule(m.deaSchedule);
  if (schedule) {
    need(/^[A-Z]{2}\d{7}$/i.test(String(pr.dea || '').trim()), 'Prescriber DEA number (controlled substance)');
    if (!allowControlled) missing.push('Controlled substances need EPCS (electronic prescribing of controlled substances), which is not set up yet');
  }
  return missing;
}

// ── Segments ──────────────────────────────────────────────────────────────────

const address = (a = {}) => wrap('Address',
  el('AddressLine1', a.line1), el('AddressLine2', a.line2), el('City', a.city),
  el('StateProvince', a.state ? String(a.state).toUpperCase() : null), el('PostalCode', digits(a.postalCode).slice(0, 9) || null),
  el('CountryCode', a.country || 'US'));

const phoneNumbers = (phone) => (present(phone)
  ? wrap('CommunicationNumbers', wrap('PrimaryTelephone', el('Number', digits(phone).slice(-10)))) : '');

function header(rx, { messageId, relatesTo, prescriberOrderNumber, sender, at }) {
  const sw = sender || {};
  return wrap('Header',
    el('To', digits(rx.pharmacy.ncpdpId), ' Qualifier="P"'),
    el('From', rx.prescriber.spi, ' Qualifier="C"'),
    el('MessageID', messageId),
    el('RelatesToMessageID', relatesTo),
    el('SentTime', sentTime(at)),
    wrap('SenderSoftware',
      el('SenderSoftwareDeveloper', sw.developer || 'AureonCare'),
      el('SenderSoftwareProduct', sw.product || 'AureonCare EHR'),
      el('SenderSoftwareVersionRelease', sw.version || '1.0')),
    el('PrescriberOrderNumber', prescriberOrderNumber));
}

const patientSegment = (p) => wrap('Patient', wrap('HumanPatient',
  wrap('Name', el('LastName', p.lastName), el('FirstName', p.firstName), el('MiddleName', p.middleName)),
  el('Gender', gender(p.gender)),
  wrap('DateOfBirth', el('Date', isoDate(p.dateOfBirth))),
  address(p.address),
  phoneNumbers(p.phone)));

const pharmacySegment = (ph) => wrap('Pharmacy',
  wrap('Identification', el('NCPDPID', digits(ph.ncpdpId)), el('NPI', digits(ph.npi) || null)),
  el('BusinessName', ph.name),
  address(ph.address),
  phoneNumbers(ph.phone));

const prescriberSegment = (pr, controlled) => wrap('Prescriber', wrap('NonVeterinarian',
  wrap('Identification', el('NPI', digits(pr.npi)), controlled ? el('DEANumber', String(pr.dea || '').trim().toUpperCase()) : ''),
  wrap('Name', el('LastName', pr.lastName), el('FirstName', pr.firstName)),
  address(pr.address),
  phoneNumbers(pr.phone)));

function medicationSegment(m) {
  const schedule = deaSchedule(m.deaSchedule);
  return wrap('MedicationPrescribed',
    el('DrugDescription', m.description),
    wrap('DrugCoded',
      wrap('ProductCode', el('Code', digits(m.ndc)), el('Qualifier', 'ND')),
      el('Strength', null),
      schedule ? wrap('DEASchedule', el('Code', DEA_SCHEDULE_CODES[schedule])) : ''),
    wrap('Quantity',
      el('Value', Number(m.quantity)),
      el('CodeListQualifier', '38'), // 38 = original quantity
      wrap('QuantityUnitOfMeasure', el('Code', unitCode(m.unit)))),
    el('DaysSupply', Number(m.daysSupply) > 0 ? Math.round(Number(m.daysSupply)) : null),
    wrap('WrittenDate', el('Date', isoDate(m.writtenDate) || isoDate(new Date()))),
    // 0 = substitution allowed ("no product selection indicated"); 1 = dispense as written.
    el('Substitutions', m.substitutionAllowed === false ? '1' : '0'),
    el('NumberOfRefills', Math.max(0, parseInt(m.refills, 10) || 0)),
    present(m.diagnosisCode) ? wrap('Diagnosis',
      el('ClinicalInformationQualifier', '1'),
      wrap('Primary', el('Code', String(m.diagnosisCode).replace('.', '').toUpperCase()), el('Qualifier', 'ABF'), el('Description', m.diagnosisDescription))) : '',
    el('Note', m.noteToPharmacist ? String(m.noteToPharmacist).slice(0, 210) : null),
    wrap('Sig', el('SigText', String(m.sig || '').slice(0, 1000))));
}

const envelope = (body) => `<?xml version="1.0" encoding="UTF-8"?>`
  + `<Message xmlns="${NS}" DatatypesVersion="${VERSION}" TransportVersion="${VERSION}" TransactionDomain="SCRIPT"`
  + ` TransactionVersion="${VERSION}" StructuresVersion="${VERSION}" ECLVersion="${VERSION}">${body}</Message>`;

// ── Messages ──────────────────────────────────────────────────────────────────

/**
 * @param {object} rx { patient, pharmacy, prescriber, medication, prescriberOrderNumber }
 * @returns {{ ok: true, xml: string, messageId: string } | { ok: false, missing: string[] }}
 */
function buildNewRx(rx, opts = {}) {
  const missing = validate(rx, opts);
  if (missing.length) return { ok: false, missing };
  const messageId = opts.messageId || newMessageId();
  const controlled = Boolean(deaSchedule(rx.medication.deaSchedule));
  const xml = envelope(
    header(rx, { messageId, prescriberOrderNumber: rx.prescriberOrderNumber, sender: opts.sender, at: opts.at })
    + wrap('Body', wrap('NewRx',
      patientSegment(rx.patient), pharmacySegment(rx.pharmacy),
      prescriberSegment(rx.prescriber, controlled), medicationSegment(rx.medication))));
  return { ok: true, xml, messageId };
}

/**
 * CancelRx repeats the original prescription and points at the NewRx it cancels.
 * @param {object} rx same shape as buildNewRx, plus originalMessageId
 */
function buildCancelRx(rx, opts = {}) {
  const missing = validate(rx, opts);
  if (!present(rx.originalMessageId)) missing.push('The message ID of the prescription being cancelled');
  if (missing.length) return { ok: false, missing };
  const messageId = opts.messageId || newMessageId();
  const controlled = Boolean(deaSchedule(rx.medication.deaSchedule));
  const xml = envelope(
    header(rx, { messageId, relatesTo: rx.originalMessageId, prescriberOrderNumber: rx.prescriberOrderNumber, sender: opts.sender, at: opts.at })
    + wrap('Body', wrap('CancelRx',
      patientSegment(rx.patient), pharmacySegment(rx.pharmacy),
      prescriberSegment(rx.prescriber, controlled), medicationSegment(rx.medication))));
  return { ok: true, xml, messageId };
}

// ── Responses ─────────────────────────────────────────────────────────────────

/** Status codes the network returns for an accepted message. */
const STATUS_TEXT = {
  '000': 'Accepted by Surescripts',
  '010': 'Delivered to the pharmacy',
};

const text = (v) => {
  if (v === undefined || v === null) return null;
  if (typeof v === 'object') return v._ !== undefined ? String(v._) : null;
  return String(v);
};

/**
 * Read a Status, Verify or Error message.
 * @returns {Promise<{ ok: boolean, type: string|null, code: string|null, descriptionCode: string|null,
 *                     description: string|null, relatesToMessageId: string|null, messageId: string|null }>}
 */
async function parseResponse(xml) {
  const out = { ok: false, type: null, code: null, descriptionCode: null, description: null, relatesToMessageId: null, messageId: null };
  if (!present(xml)) { out.description = 'Empty response from the network'; return out; }
  let doc;
  try {
    doc = await xml2js.parseStringPromise(String(xml), {
      explicitArray: false, tagNameProcessors: [xml2js.processors.stripPrefix], attrNameProcessors: [xml2js.processors.stripPrefix],
    });
  } catch (e) {
    out.description = 'The network answered with something that is not a SCRIPT message';
    return out;
  }
  const msg = doc && doc.Message;
  if (!msg) { out.description = 'The network answered with something that is not a SCRIPT message'; return out; }
  const h = msg.Header || {};
  out.messageId = text(h.MessageID);
  out.relatesToMessageId = text(h.RelatesToMessageID);
  const body = msg.Body || {};
  if (body.Status) {
    out.type = 'Status';
    out.code = text(body.Status.Code);
    out.descriptionCode = text(body.Status.DescriptionCode);
    out.description = text(body.Status.Description) || STATUS_TEXT[out.code] || null;
    out.ok = out.code === '000' || out.code === '010';
  } else if (body.Verify) {
    const vs = body.Verify.VerifyStatus || body.Verify;
    out.type = 'Verify';
    out.code = text(vs.Code);
    out.descriptionCode = text(vs.DescriptionCode);
    out.description = text(vs.Description) || STATUS_TEXT[out.code] || null;
    out.ok = out.code === '010';
  } else if (body.Error) {
    out.type = 'Error';
    out.code = text(body.Error.Code);
    out.descriptionCode = text(body.Error.DescriptionCode);
    out.description = text(body.Error.Description) || `The network refused the message (error ${out.code || 'unknown'})`;
    out.ok = false;
  } else {
    out.type = Object.keys(body)[0] || null;
    out.description = out.type ? `Unexpected ${out.type} message` : 'The response had no message body';
  }
  return out;
}

module.exports = {
  VERSION, NS, UNIT_CODES, UNIT_UNSPECIFIED, DEA_SCHEDULE_CODES,
  validate, buildNewRx, buildCancelRx, parseResponse,
  escapeXml, unitCode, deaSchedule, newMessageId,
};
