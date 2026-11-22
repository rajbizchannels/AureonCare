import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blankDraft, dayCount, draftProblem, plusDays, toRequest, summary, MAX_DAYS,
} from '../src/lib/sickNotes.ts';
import { changes, formFrom, formProblem, readEmergency } from '../src/lib/profile.ts';
import { profileUrl, resultMeta, providerLine, understoodLine } from '../src/lib/directory.ts';

const TODAY = '2026-11-22';

// ── sick notes ─────────────────────────────────────────────────────────────────────
test('a blank sick note covers a week from today and is valid', () => {
  const d = blankDraft(TODAY);
  assert.equal(d.startDate, TODAY);
  assert.equal(dayCount(d.startDate, d.endDate), 7);
  assert.equal(draftProblem(d, TODAY), null);
});

test('sick note rules match the server', () => {
  const d = blankDraft(TODAY);
  assert.match(draftProblem({ ...d, endDate: plusDays(TODAY, -1) }, TODAY), /before the first day/);
  assert.match(draftProblem({ ...d, endDate: plusDays(TODAY, MAX_DAYS) }, TODAY), /at most 92/);
  assert.equal(draftProblem({ ...d, endDate: plusDays(TODAY, MAX_DAYS - 1) }, TODAY), null);
  assert.match(draftProblem({ ...d, assessedOn: plusDays(TODAY, 1) }, TODAY), /future/);
  assert.match(draftProblem({ ...d, fitness: 'may_be_fit' }, TODAY), /adjustment/);
  assert.equal(draftProblem({ ...d, fitness: 'may_be_fit', comments: 'Light duties' }, TODAY), null);
  assert.equal(draftProblem({ ...d, fitness: 'may_be_fit', adjustments: ['altered_hours'] }, TODAY), null);
  assert.match(draftProblem({ ...d, startDate: '22/11/2026' }, TODAY), /YYYY-MM-DD/);
});

test('the request drops adjustments for "not fit", blanks and unknown values', () => {
  const r = toRequest('p1', { ...blankDraft(TODAY), adjustments: ['altered_hours'], conditionText: '  ', comments: ' rest ' });
  assert.deepEqual(r.adjustments, []);
  assert.equal(r.conditionText, undefined);
  assert.equal(r.comments, 'rest');
  const m = toRequest('p1', { ...blankDraft(TODAY), fitness: 'may_be_fit', adjustments: ['altered_hours', 'bogus'] });
  assert.deepEqual(m.adjustments, ['altered_hours']);
});

test('a list row summarises the note', () => {
  assert.equal(summary({ fitness: 'not_fit', purpose: 'work', startDate: '2026-11-22', endDate: '2026-11-28', days: 7 }),
    'Not fit for work · 22 Nov – 28 Nov 2026 (7 days)');
  assert.match(summary({ fitness: 'may_be_fit', purpose: 'school', startDate: '2026-11-22', endDate: '2026-11-22', days: 1 }), /May be fit for school or college .*\(1 day\)/);
});

// ── profile ────────────────────────────────────────────────────────────────────────
const before = { id: 'p1', first_name: 'Rosa', email: 'r@example.com', phone: '555 0100', address: '1 High St',
  emergency_contact: '{"name":"Jo","phone":"555 0101","relationship":"Sister"}', allergies: 'Penicillin', current_medications: null };

test('emergency contact reads from JSON, a JSON string, or junk', () => {
  assert.deepEqual(readEmergency(before.emergency_contact), { name: 'Jo', phone: '555 0101', relationship: 'Sister' });
  assert.deepEqual(readEmergency({ name: 'A' }), { name: 'A', phone: '', relationship: '' });
  assert.deepEqual(readEmergency('not json'), { name: 'not json', phone: '', relationship: '' });
  assert.deepEqual(readEmergency(null), { name: '', phone: '', relationship: '' });
});

test('only what changed is sent, and identity fields never', () => {
  const f = formFrom(before);
  assert.equal(changes(before, f), null);
  const c = changes(before, { ...f, phone: '+44 7700 900123', allergies: 'Penicillin, latex' });
  assert.deepEqual(c, { phone: '+44 7700 900123', allergies: 'Penicillin, latex' });
  for (const k of ['first_name', 'last_name', 'email', 'date_of_birth']) assert.ok(!(k in c));
  const e = changes(before, { ...f, emergency: { name: 'Jo', phone: '555 0199', relationship: 'Sister' } });
  assert.deepEqual(e, { emergencyContact: { name: 'Jo', phone: '555 0199', relationship: 'Sister' } });
});

test('phone numbers are checked', () => {
  const f = formFrom(before);
  assert.equal(formProblem(f), null);
  assert.match(formProblem({ ...f, phone: 'call me' }), /phone/);
  assert.match(formProblem({ ...f, emergency: { ...f.emergency, phone: 'x' } }), /emergency/);
});

// ── directory ──────────────────────────────────────────────────────────────────────
const r = { name: 'Alpha Skin', url: '/p/alpha', logo: null, specialties: ['Dermatology'], place: 'Springfield, IL', locations: 2,
  distanceKm: 3.2, providers: [{ name: 'Dr Rina Derm' }], moreProviders: 2 };

test('results link to the practice page on the chosen server', () => {
  assert.equal(profileUrl('https://app.example.test/', r), 'https://app.example.test/p/alpha');
  assert.equal(resultMeta(r), 'Dermatology · Springfield, IL · 2 locations · 3.2 km');
  assert.equal(providerLine(r), 'Dr Rina Derm +2 more');
  assert.equal(providerLine({ ...r, providers: [] }), null);
});

test('the search says what it understood', () => {
  assert.equal(understoodLine({ specialties: ['Dermatology'], place: 'springfield', name: null, nearby: false }), 'Showing Dermatology, in springfield');
  assert.equal(understoodLine({ specialties: [], place: null, name: 'riverside', practiceName: true, nearby: false }), 'Showing a practice name');
  assert.equal(understoodLine({ specialties: [], place: null, name: null, nearby: false }), null);
});
