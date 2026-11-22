/**
 * Form templates on the phone — the rules, kept free of React Native so they are tested with
 * node (tests/forms.test.mjs). They match the web renderer
 * (frontend/src/components/forms/DynamicFormRenderer.js) and the server's check
 * (backend/utils/formValidation.js), so a form the app lets through the server accepts.
 */

export type FieldType =
  | 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'checkboxes' | 'date' | 'number'
  | 'email' | 'phone' | 'scale' | 'signature' | 'heading' | 'paragraph';

export const SUPPORTED_FIELD_TYPES: FieldType[] = [
  'text', 'textarea', 'select', 'radio', 'checkbox', 'checkboxes', 'date', 'number',
  'email', 'phone', 'scale', 'signature', 'heading', 'paragraph',
];

export interface FormField {
  id: string;
  type: string;
  label?: string;
  section?: string;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: (string | { value: string; label?: string })[];
  min?: number | string;
  max?: number | string;
  rows?: number;
  visibility_roles?: string[];
  conditional?: { field: string; operator: string; value?: unknown };
  translations?: Record<string, string>;
}

export type FormData = Record<string, unknown>;

export const optionValue = (o: string | { value: string }): string => (typeof o === 'object' ? String(o.value) : String(o));
export const optionLabel = (o: string | { value: string; label?: string }): string =>
  typeof o === 'object' ? String(o.label ?? o.value) : String(o);
export const labelOf = (f: FormField, language = 'en'): string =>
  (language !== 'en' && f.translations?.[language]) || f.label || f.id;
export const isSupported = (f: FormField): boolean => (SUPPORTED_FIELD_TYPES as string[]).includes(f.type);
export const isDisplayOnly = (f: FormField): boolean => f.type === 'heading' || f.type === 'paragraph';

export function isVisible(f: FormField, data: FormData, role: string): boolean {
  if (f.visibility_roles?.length && !f.visibility_roles.includes(role) && !f.visibility_roles.includes('all')) return false;
  const c = f.conditional;
  if (c && c.field) {
    const cur = data[c.field];
    switch (c.operator) {
      case 'equals': return String(cur) === String(c.value);
      case 'not_equals': return String(cur) !== String(c.value);
      case 'contains': return String(cur ?? '').toLowerCase().includes(String(c.value).toLowerCase());
      case 'not_empty': return cur !== undefined && cur !== '' && cur !== null;
      case 'is_empty': return !cur;
      case 'gt': return parseFloat(String(cur)) > parseFloat(String(c.value));
      case 'lt': return parseFloat(String(cur)) < parseFloat(String(c.value));
      default: return true;
    }
  }
  return true;
}

/** The scale's whole numbers, min to max (default 0–10). */
export function scaleRange(f: FormField): number[] {
  const lo = f.min !== undefined && f.min !== '' ? Number(f.min) : 0;
  const hi = f.max !== undefined && f.max !== '' ? Number(f.max) : 10;
  const out: number[] = [];
  for (let n = lo; n <= hi && out.length < 101; n += 1) out.push(n);
  return out;
}

/** Fields grouped by section, in template order. A form with one section returns one group. */
export function sections(fields: FormField[]): { name: string | null; fields: FormField[] }[] {
  const order: string[] = [];
  const by: Record<string, FormField[]> = {};
  for (const f of fields) {
    const s = f.section || '_default';
    if (!by[s]) { by[s] = []; order.push(s); }
    by[s].push(f);
  }
  return order.map((s) => ({ name: s === '_default' ? null : s, fields: by[s] ?? [] }));
}

const isEmpty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/** Per-field problems ({} when the form can be sent) — the server's rules. */
export function validate(fields: FormField[], data: FormData, role: string): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    if (!f?.id || isDisplayOnly(f) || !isSupported(f) || !isVisible(f, data, role)) continue;
    const v = data[f.id];
    const label = f.label || f.id;
    if (f.type === 'checkbox') {
      if (f.required && v !== true) errors[f.id] = `${label} must be ticked.`;
      continue;
    }
    if (isEmpty(v)) { if (f.required) errors[f.id] = `${label} is required.`; continue; }
    const opts = (f.options ?? []).map(optionValue);
    switch (f.type) {
      case 'email':
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v).trim())) errors[f.id] = `${label} is not a valid email address.`;
        break;
      case 'phone':
        if (!/^[+()\d\s.-]{5,30}$/.test(String(v).trim())) errors[f.id] = `${label} is not a valid phone number.`;
        break;
      case 'number': {
        const n = Number(v);
        if (!Number.isFinite(n)) errors[f.id] = `${label} must be a number.`;
        else if (f.min !== undefined && f.min !== '' && n < Number(f.min)) errors[f.id] = `${label} must be at least ${f.min}.`;
        else if (f.max !== undefined && f.max !== '' && n > Number(f.max)) errors[f.id] = `${label} must be at most ${f.max}.`;
        break;
      }
      case 'date': {
        const s = String(v).slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(new Date(`${s}T12:00:00Z`).getTime())) errors[f.id] = `${label} must be a date (YYYY-MM-DD).`;
        break;
      }
      case 'select': case 'radio':
        if (opts.length && !opts.includes(String(v))) errors[f.id] = `${label} has an answer that is not one of its choices.`;
        break;
      case 'checkboxes':
        if (!Array.isArray(v) || (opts.length && v.some((x) => !opts.includes(String(x))))) errors[f.id] = `${label} has an answer that is not one of its choices.`;
        break;
      case 'scale': {
        const range = scaleRange(f);
        if (!range.includes(Number(v))) errors[f.id] = `${label} must be a whole number from ${range[0]} to ${range[range.length - 1]}.`;
        break;
      }
      case 'signature':
        if (!/^data:image\/(png|jpeg|svg\+xml);base64,/.test(String(v))) errors[f.id] = `${label} is not a valid signature.`;
        break;
      case 'text': case 'textarea':
        if (String(v).length > 5000) errors[f.id] = `${label} is too long.`;
        break;
      default: break;
    }
  }
  return errors;
}

/** Answers to send: only visible, answerable fields (what the server keeps anyway). */
export function answersToSend(fields: FormField[], data: FormData, role: string): FormData {
  const out: FormData = {};
  for (const f of fields) {
    if (!f?.id || isDisplayOnly(f) || !isSupported(f) || !isVisible(f, data, role)) continue;
    if (data[f.id] !== undefined) out[f.id] = data[f.id];
  }
  return out;
}

/** A signature drawn as SVG strokes, as the data URL the server stores. */
export function signatureDataUrl(paths: string[], width: number, height: number, encode: (s: string) => string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width)}" height="${Math.round(height)}" viewBox="0 0 ${Math.round(width)} ${Math.round(height)}">`
    + paths.map((d) => `<path d="${d}" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`).join('')
    + '</svg>';
  return `data:image/svg+xml;base64,${encode(svg)}`;
}
