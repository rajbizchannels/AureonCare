// Server-side check of a filled-in form against its template — the same rules the web
// renderer (frontend/src/components/forms/DynamicFormRenderer.js) and the app renderer
// (mobile/src/lib/forms.ts) apply, so a submission is complete whichever client sent it.
//
// Only VISIBLE fields count: a field hidden by its role list or its condition is neither
// required nor kept. Answers to fields the template does not have are dropped.

const SUPPORTED = ['text', 'textarea', 'select', 'radio', 'checkbox', 'checkboxes', 'date', 'number',
  'email', 'phone', 'scale', 'signature', 'heading', 'paragraph'];
const DISPLAY_ONLY = new Set(['heading', 'paragraph']);
const MAX_TEXT = 5000;
const MAX_SIGNATURE = 400 * 1024;

const optValue = (o) => (o && typeof o === 'object' ? String(o.value) : String(o));
const empty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

function isVisible(field, data, role) {
  if (Array.isArray(field.visibility_roles) && field.visibility_roles.length
      && !field.visibility_roles.includes(role) && !field.visibility_roles.includes('all')) return false;
  const c = field.conditional;
  if (c && c.field) {
    const cur = data[c.field];
    switch (c.operator) {
      case 'equals': return String(cur) === String(c.value);
      case 'not_equals': return String(cur) !== String(c.value);
      case 'contains': return String(cur || '').toLowerCase().includes(String(c.value).toLowerCase());
      case 'not_empty': return cur !== undefined && cur !== '' && cur !== null;
      case 'is_empty': return !cur;
      case 'gt': return parseFloat(cur) > parseFloat(c.value);
      case 'lt': return parseFloat(cur) < parseFloat(c.value);
      default: return true;
    }
  }
  return true;
}

/**
 * @param {Array} fields  the template's field list
 * @param {object} data   the answers, keyed by field id
 * @param {string} role   who is filling it ('patient', 'doctor', …) — for role-visible fields
 * @returns {{ ok: boolean, errors: Record<string,string>, cleaned: object }}
 */
function validateFormData(fields, data, role = 'patient') {
  const errors = {};
  const cleaned = {};
  const d = data && typeof data === 'object' ? data : {};
  for (const f of Array.isArray(fields) ? fields : []) {
    if (!f || !f.id || DISPLAY_ONLY.has(f.type)) continue;
    if (!SUPPORTED.includes(f.type)) continue;   // shown as "cannot be answered"; never blocks
    if (!isVisible(f, d, role)) continue;
    let v = d[f.id];
    const label = f.label || f.id;

    if (f.type === 'checkbox') {
      v = v === true || v === 'true';
      if (f.required && !v) errors[f.id] = `${label} must be ticked.`;
      cleaned[f.id] = v;
      continue;
    }
    if (empty(v)) {
      if (f.required) errors[f.id] = `${label} is required.`;
      continue;
    }
    const opts = (f.options || []).map(optValue);
    switch (f.type) {
      case 'text': case 'textarea': case 'phone':
        v = String(v);
        if (v.length > MAX_TEXT) errors[f.id] = `${label} is too long.`;
        else if (f.type === 'phone' && !/^[+()\d\s.-]{5,30}$/.test(v.trim())) errors[f.id] = `${label} is not a valid phone number.`;
        break;
      case 'email':
        v = String(v).trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) errors[f.id] = `${label} is not a valid email address.`;
        break;
      case 'number': {
        const n = Number(v);
        if (!Number.isFinite(n)) { errors[f.id] = `${label} must be a number.`; break; }
        if (f.min !== undefined && f.min !== null && f.min !== '' && n < Number(f.min)) errors[f.id] = `${label} must be at least ${f.min}.`;
        else if (f.max !== undefined && f.max !== null && f.max !== '' && n > Number(f.max)) errors[f.id] = `${label} must be at most ${f.max}.`;
        v = n;
        break;
      }
      case 'date':
        v = String(v).slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(new Date(`${v}T12:00:00Z`).getTime())) errors[f.id] = `${label} must be a date.`;
        break;
      case 'select': case 'radio':
        v = String(v);
        if (opts.length && !opts.includes(v)) errors[f.id] = `${label} has an answer that is not one of its choices.`;
        break;
      case 'checkboxes':
        if (!Array.isArray(v)) { errors[f.id] = `${label} must be a list of choices.`; break; }
        v = v.map(String);
        if (opts.length && v.some((x) => !opts.includes(x))) errors[f.id] = `${label} has an answer that is not one of its choices.`;
        if (f.required && !v.length) errors[f.id] = `${label} is required.`;
        break;
      case 'scale': {
        const n = Number(v); const lo = f.min !== undefined ? Number(f.min) : 0; const hi = f.max !== undefined ? Number(f.max) : 10;
        if (!Number.isInteger(n) || n < lo || n > hi) errors[f.id] = `${label} must be a whole number from ${lo} to ${hi}.`;
        v = n;
        break;
      }
      case 'signature':
        v = String(v);
        if (!/^data:image\/(png|jpeg|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(v)) errors[f.id] = `${label} is not a valid signature.`;
        else if (v.length > MAX_SIGNATURE) errors[f.id] = `${label} is too large.`;
        break;
      default: break;
    }
    if (!errors[f.id]) cleaned[f.id] = v;
  }
  return { ok: Object.keys(errors).length === 0, errors, cleaned };
}

module.exports = { validateFormData, isVisible, SUPPORTED_FIELD_TYPES: SUPPORTED };
