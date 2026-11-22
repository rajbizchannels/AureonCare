import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  answersToSend, isVisible, scaleRange, sections, signatureDataUrl, validate, labelOf, optionLabel,
} from '../src/lib/forms.ts';

// The server's own validator: the app must agree with it on every case below.
const require = createRequire(import.meta.url);
const { validateFormData } = require('../../backend/utils/formValidation.js');

const SIG = signatureDataUrl(['M0 0 L10 10'], 300, 120, (s) => Buffer.from(s).toString('base64'));
const FIELDS = [
  { id: 'h1', type: 'heading', label: 'About you', section: 'You' },
  { id: 'full_name', type: 'text', label: 'Full name', required: true, section: 'You' },
  { id: 'email', type: 'email', label: 'Email', section: 'You' },
  { id: 'phone', type: 'phone', label: 'Phone', section: 'You' },
  { id: 'age', type: 'number', label: 'Age', min: 0, max: 120, required: true, section: 'You' },
  { id: 'dob', type: 'date', label: 'Date of birth', section: 'You' },
  { id: 'smoker', type: 'radio', label: 'Do you smoke?', options: ['Yes', 'No'], required: true, section: 'Health' },
  { id: 'per_day', type: 'number', label: 'How many a day?', required: true, conditional: { field: 'smoker', operator: 'equals', value: 'Yes' }, section: 'Health' },
  { id: 'blood', type: 'select', label: 'Blood type', options: [{ value: 'A', label: 'Type A' }, { value: 'O', label: 'Type O' }], section: 'Health' },
  { id: 'symptoms', type: 'checkboxes', label: 'Symptoms', options: ['Cough', 'Fever'], section: 'Health' },
  { id: 'pain', type: 'scale', label: 'Pain', min: 0, max: 10, required: true, section: 'Health' },
  { id: 'consent', type: 'checkbox', label: 'I consent', required: true, section: 'Sign' },
  { id: 'clinician_note', type: 'textarea', label: 'Clinician note', required: true, visibility_roles: ['doctor', 'nurse'], section: 'Sign' },
  { id: 'sig', type: 'signature', label: 'Signature', required: true, section: 'Sign' },
  { id: 'future', type: 'colour_picker', label: 'Favourite colour', required: true, section: 'Sign' },
];
const GOOD = { full_name: 'Rosa', email: 'r@example.com', phone: '+44 7700 900123', age: '56', dob: '1970-02-04', smoker: 'No', blood: 'O', symptoms: ['Cough'], pain: 3, consent: true, sig: SIG };

const sameAsServer = (data, role) => {
  const app = validate(FIELDS, data, role);
  const srv = validateFormData(FIELDS, data, role).errors;
  assert.deepEqual(Object.keys(app).sort(), Object.keys(srv).sort(), `app ${JSON.stringify(app)} vs server ${JSON.stringify(srv)}`);
  return app;
};

test('a complete form passes, on the phone and on the server', () => {
  assert.deepEqual(sameAsServer(GOOD, 'patient'), {});
});

test('an empty form names the same missing answers as the server', () => {
  const e = sameAsServer({}, 'patient');
  for (const k of ['full_name', 'age', 'smoker', 'pain', 'consent', 'sig']) assert.ok(e[k], k);
  assert.ok(!e.clinician_note, 'staff-only question not required of a patient');
  assert.ok(!e.per_day, 'hidden follow-up not required');
  assert.ok(!e.future, 'an unsupported field type never blocks');
});

test('conditions and role-visible fields follow the same rules', () => {
  assert.ok(sameAsServer({ ...GOOD, smoker: 'Yes' }, 'patient').per_day);
  assert.ok(sameAsServer(GOOD, 'doctor').clinician_note);
  assert.deepEqual(sameAsServer({ ...GOOD, clinician_note: 'ok' }, 'doctor'), {});
  assert.equal(isVisible(FIELDS.find((f) => f.id === 'clinician_note'), GOOD, 'patient'), false);
});

test('wrong types and choices are caught the same way', () => {
  const e = sameAsServer({ ...GOOD, email: 'nope', age: '200', blood: 'Z', symptoms: ['Rash'], pain: 11, sig: 'javascript:x', phone: 'call me', dob: '04/02/1970' }, 'patient');
  for (const k of ['email', 'age', 'blood', 'symptoms', 'pain', 'sig', 'phone', 'dob']) assert.ok(e[k], k);
});

test('only visible answers are sent', () => {
  const out = answersToSend(FIELDS, { ...GOOD, per_day: 5, clinician_note: 'x', made_up: 1 }, 'patient');
  assert.ok(!('per_day' in out) && !('clinician_note' in out) && !('made_up' in out));
  assert.equal(out.full_name, 'Rosa');
});

test('sections, scales, labels and the signature data URL', () => {
  assert.deepEqual(sections(FIELDS).map((s) => s.name), ['You', 'Health', 'Sign']);
  assert.deepEqual(scaleRange({ id: 's', type: 'scale', min: 1, max: 5 }), [1, 2, 3, 4, 5]);
  assert.equal(scaleRange({ id: 's', type: 'scale' }).length, 11);
  assert.equal(labelOf({ id: 'x', type: 'text', label: 'Name', translations: { es: 'Nombre' } }, 'es'), 'Nombre');
  assert.equal(optionLabel({ value: 'A', label: 'Type A' }), 'Type A');
  assert.match(SIG, /^data:image\/svg\+xml;base64,/);
  assert.match(Buffer.from(SIG.split(',')[1], 'base64').toString(), /<path d="M0 0 L10 10"/);
});
