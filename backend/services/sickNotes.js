// Sick notes: validation and the printable certificate. Used by the staff routes
// (routes/sickNotes.js) and the patient portal, so both print exactly the same document.

const crypto = require('crypto');

const ADJUSTMENTS = {
  phased_return: 'A phased return to work',
  altered_hours: 'Altered hours',
  amended_duties: 'Amended duties',
  workplace_adaptations: 'Workplace adaptations',
};
const PURPOSES = { work: 'work', school: 'school or college', other: 'normal activities' };
const MAX_DAYS = 92;   // one note covers at most ~3 months; longer absences need a review and a new note

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isoDate = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v || '').slice(0, 10));
const longDate = (v) => {
  const d = new Date(`${isoDate(v)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};
const daysBetween = (a, b) => Math.round((new Date(`${isoDate(b)}T12:00:00Z`) - new Date(`${isoDate(a)}T12:00:00Z`)) / 86400000) + 1;

function newReference() {
  // SN-2026-7KQ4XD: year + 6 characters with no look-alikes (0/O, 1/I).
  const abc = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(6);
  return `SN-${new Date().getUTCFullYear()}-${[...bytes].map((b) => abc[b % abc.length]).join('')}`;
}

/** Normalise and check a request body. Returns { value } or { error }. */
function validate(body) {
  const b = body || {};
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const fitness = b.fitness === 'may_be_fit' ? 'may_be_fit' : b.fitness === 'not_fit' ? 'not_fit' : null;
  if (!b.patientId) return { error: 'Choose the patient.' };
  if (!fitness) return { error: 'Say whether the patient is not fit, or may be fit with adjustments.' };
  const today = new Date().toISOString().slice(0, 10);
  const assessedOn = re.test(b.assessedOn || '') ? b.assessedOn : today;
  if (!re.test(b.startDate || '') || !re.test(b.endDate || '')) return { error: 'Give the first and last day the note covers.' };
  if (b.endDate < b.startDate) return { error: 'The last day cannot be before the first day.' };
  if (assessedOn > today) return { error: 'The assessment date cannot be in the future.' };
  const days = daysBetween(b.startDate, b.endDate);
  if (days > MAX_DAYS) return { error: `One note can cover at most ${MAX_DAYS} days. Review the patient and issue a new note for a longer absence.` };
  const adjustments = (Array.isArray(b.adjustments) ? b.adjustments : []).filter((a) => ADJUSTMENTS[a]);
  if (fitness === 'may_be_fit' && !adjustments.length && !String(b.comments || '').trim()) {
    return { error: 'For "may be fit", tick at least one adjustment or write advice in the comments.' };
  }
  return { value: {
    patientId: String(b.patientId),
    purpose: PURPOSES[b.purpose] ? b.purpose : 'work',
    fitness, assessedOn, startDate: b.startDate, endDate: b.endDate,
    conditionText: String(b.conditionText || '').trim().slice(0, 500) || null,
    adjustments: fitness === 'may_be_fit' ? adjustments : [],
    comments: String(b.comments || '').trim().slice(0, 2000) || null,
    followUp: Boolean(b.followUp),
  } };
}

/** practices.address is jsonb: a string, or an object with street/city/postcode-style keys. */
function formatAddress(a) {
  if (!a) return '';
  if (typeof a === 'string') return a;
  if (typeof a !== 'object') return String(a);
  const order = ['line1', 'address1', 'street', 'street1', 'line2', 'address2', 'street2', 'city', 'town', 'state', 'region', 'county', 'postcode', 'postal_code', 'postalCode', 'zip', 'zipCode', 'country'];
  const seen = order.filter((k) => a[k]).map((k) => String(a[k]).trim());
  const parts = seen.length ? seen : Object.values(a).filter((v) => typeof v === 'string' && v.trim());
  return parts.join(', ');
}

/** Public shape of a row for the API. */
function toApi(r) {
  return {
    id: r.id, reference: r.reference, patientId: r.patient_id, purpose: r.purpose, fitness: r.fitness,
    assessedOn: isoDate(r.assessed_on), startDate: isoDate(r.start_date), endDate: isoDate(r.end_date),
    days: daysBetween(r.start_date, r.end_date), conditionText: r.condition_text, adjustments: r.adjustments || [],
    comments: r.comments, followUp: r.follow_up, issuedBy: r.issued_by, issuerName: r.issuer_name,
    issuerTitle: r.issuer_title, issuerRegistration: r.issuer_registration, status: r.status,
    voidReason: r.void_reason, voidedAt: r.voided_at, emailedAt: r.emailed_at, createdAt: r.created_at,
  };
}

/** The advice sentence, shared by the document and the email. */
function adviceText(n) {
  const what = PURPOSES[n.purpose] || 'work';
  return n.fitness === 'not_fit'
    ? `is not fit for ${what}`
    : `may be fit for ${what} taking into account the advice below`;
}

/**
 * The certificate as a complete, printable HTML page (A4, works in light or dark viewers
 * because it sets its own colours). `practice` = { name, address, phone, email }.
 */
function renderDocument(note, patient, practice) {
  const n = note;
  const p = patient || {};
  const pr = practice || {};
  const voided = n.status === 'voided';
  const days = daysBetween(n.start_date || n.startDate, n.end_date || n.endDate);
  const adj = (n.adjustments || []).map((a) => `<li>${esc(ADJUSTMENTS[a] || a)}</li>`).join('');
  const fitness = n.fitness;
  const purpose = n.purpose;
  const comments = n.comments;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Sick note ${esc(n.reference)}</title>
<style>
@page{size:A4;margin:18mm}
*{box-sizing:border-box}body{margin:0;font-family:Georgia,'Times New Roman',serif;color:#111;background:#fff;font-size:12pt;line-height:1.5}
.page{max-width:180mm;margin:0 auto;padding:12mm 0;position:relative}
header{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #068573;padding-bottom:10px;margin-bottom:18px}
header .name{font-size:16pt;font-weight:bold}header .meta{font-size:10pt;color:#333;text-align:right;white-space:pre-line}
h1{font-size:15pt;margin:0 0 4px;letter-spacing:.02em}.ref{font-family:ui-monospace,Menlo,monospace;font-size:10pt;color:#333}
table{border-collapse:collapse;width:100%;margin:12px 0}td{padding:4px 0;vertical-align:top}td.k{width:38%;color:#444}
.box{border:1px solid #999;border-radius:4px;padding:10px 12px;margin:12px 0}
.advice{font-size:13pt;font-weight:bold}
.sig{margin-top:28px;display:flex;justify-content:space-between;gap:24px}.sig .line{border-top:1px solid #333;padding-top:4px;min-width:60mm;font-size:10pt}
footer{margin-top:24px;font-size:9pt;color:#444;border-top:1px solid #ccc;padding-top:6px}
.void{position:absolute;top:40%;left:0;right:0;text-align:center;font-size:64pt;color:rgba(200,0,0,.18);transform:rotate(-20deg);font-weight:bold;pointer-events:none}
@media print{.page{padding:0}}
</style></head><body><div class="page">
${voided ? '<div class="void">VOID</div>' : ''}
<header><div><div class="name">${esc(pr.name || 'Medical practice')}</div></div>
<div class="meta">${esc([formatAddress(pr.address), pr.phone, pr.email].filter(Boolean).join('\n'))}</div></header>
<h1>Statement of fitness for ${esc(PURPOSES[purpose] || 'work')}</h1>
<div class="ref">Reference ${esc(n.reference)}${voided ? ` · VOIDED${n.void_reason ? ` — ${esc(n.void_reason)}` : ''}` : ''}</div>
<table>
<tr><td class="k">Patient</td><td><strong>${esc(`${p.first_name || ''} ${p.last_name || ''}`.trim())}</strong></td></tr>
${p.date_of_birth ? `<tr><td class="k">Date of birth</td><td>${esc(longDate(p.date_of_birth))}</td></tr>` : ''}
${p.mrn ? `<tr><td class="k">Patient number</td><td>${esc(p.mrn)}</td></tr>` : ''}
<tr><td class="k">Assessed on</td><td>${esc(longDate(n.assessed_on || n.assessedOn))}</td></tr>
<tr><td class="k">Condition</td><td>${n.condition_text || n.conditionText ? esc(n.condition_text || n.conditionText) : 'A medical condition'}</td></tr>
</table>
<div class="box"><div>I advise that this patient</div>
<div class="advice">${esc(adviceText({ fitness, purpose }))}</div>
${fitness === 'may_be_fit' && adj ? `<div style="margin-top:6px">If available, and with the agreement of the employer or school:</div><ul style="margin:4px 0 0 18px;padding:0">${adj}</ul>` : ''}
${comments ? `<div style="margin-top:8px"><em>Comments:</em> ${esc(comments).replace(/\n/g, '<br>')}</div>` : ''}
</div>
<table>
<tr><td class="k">This applies</td><td>from <strong>${esc(longDate(n.start_date || n.startDate))}</strong> to <strong>${esc(longDate(n.end_date || n.endDate))}</strong> (${days} day${days === 1 ? '' : 's'})</td></tr>
<tr><td class="k">Review needed at the end</td><td>${(n.follow_up ?? n.followUp) ? 'Yes — I will need to assess fitness again' : 'No'}</td></tr>
</table>
<div class="sig"><div><div style="height:28px"></div><div class="line">Signature</div></div>
<div><div><strong>${esc(n.issuer_name || n.issuerName)}</strong>${n.issuer_title || n.issuerTitle ? `, ${esc(n.issuer_title || n.issuerTitle)}` : ''}</div>
${n.issuer_registration || n.issuerRegistration ? `<div style="font-size:10pt">Registration no. ${esc(n.issuer_registration || n.issuerRegistration)}</div>` : ''}
<div style="font-size:10pt">Issued ${esc(longDate(n.created_at || n.createdAt || new Date()))}</div></div></div>
<footer>To check this note is genuine, contact ${esc(pr.name || 'the practice')}${pr.phone ? ` on ${esc(pr.phone)}` : ''} and quote reference ${esc(n.reference)}.
This note is for the patient to give to an employer, school or benefits office; it does not state a diagnosis unless the patient agreed to one being included.</footer>
</div></body></html>`;
}

// ── requests from patients ───────────────────────────────────────────────────────────
const REQUEST_BACKDATE_DAYS = 14;   // a request can cover days already missed, up to two weeks back
const REQUEST_AHEAD_DAYS = 30;      // and can start up to a month ahead (e.g. after planned surgery)

/** Check a patient's request. Returns { value } or { error }. */
function validateRequest(body, today = new Date().toISOString().slice(0, 10)) {
  const b = body || {};
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(b.startDate || '') || !re.test(b.endDate || '')) return { error: 'Give the first and last day you need the note to cover.' };
  if (b.endDate < b.startDate) return { error: 'The last day cannot be before the first day.' };
  const days = daysBetween(b.startDate, b.endDate);
  if (days > MAX_DAYS) return { error: `A request can cover at most ${MAX_DAYS} days.` };
  if (daysBetween(b.startDate, today) - 1 > REQUEST_BACKDATE_DAYS) return { error: `A request can go back at most ${REQUEST_BACKDATE_DAYS} days. Contact your practice about earlier dates.` };
  if (daysBetween(today, b.startDate) - 1 > REQUEST_AHEAD_DAYS) return { error: `A request can start at most ${REQUEST_AHEAD_DAYS} days ahead.` };
  const reason = String(b.reason || '').trim();
  if (reason.length < 10) return { error: 'Tell your clinician briefly why you need the note (at least 10 characters).' };
  return { value: { purpose: PURPOSES[b.purpose] ? b.purpose : 'work', startDate: b.startDate, endDate: b.endDate, reason: reason.slice(0, 1000) } };
}

function requestToApi(r) {
  return {
    id: r.id, patientId: r.patient_id, purpose: r.purpose, startDate: isoDate(r.start_date), endDate: isoDate(r.end_date),
    days: daysBetween(r.start_date, r.end_date), reason: r.reason, status: r.status, sickNoteId: r.sick_note_id || null,
    decisionReason: r.decision_reason || null, decidedAt: r.decided_at || null, createdAt: r.created_at,
    ...(r.first_name !== undefined ? { patientName: `${r.first_name || ''} ${r.last_name || ''}`.trim(), mrn: r.mrn || null } : {}),
  };
}

module.exports = { validateRequest, requestToApi, REQUEST_BACKDATE_DAYS, REQUEST_AHEAD_DAYS, formatAddress, ADJUSTMENTS, PURPOSES, MAX_DAYS, validate, toApi, renderDocument, newReference, adviceText, longDate, daysBetween };
