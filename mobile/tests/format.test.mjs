import test from 'node:test';
import assert from 'node:assert/strict';
import { fullName, isUpcoming, formatDate, formatTime } from '../src/lib/useResource.ts';

test('fullName joins what is present', () => {
  assert.equal(fullName('Ada', 'Okonkwo'), 'Ada Okonkwo');
  assert.equal(fullName('Ada', null), 'Ada');
  assert.equal(fullName(null, 'Okonkwo'), 'Okonkwo');
});

test('fullName falls back rather than rendering an empty name', () => {
  assert.equal(fullName(null, null), 'Unknown');
  assert.equal(fullName(undefined, undefined, 'Care team'), 'Care team');
  // A whitespace-only name must not pass as a real one.
  assert.equal(fullName('', '', 'Care team'), 'Care team');
});

test('isUpcoming splits future from past', () => {
  const future = new Date(Date.now() + 3600_000).toISOString();
  const past = new Date(Date.now() - 3600_000).toISOString();
  assert.equal(isUpcoming(future), true);
  assert.equal(isUpcoming(past), false);
});

test('date and time formatters return empty for missing or unparseable input', () => {
  // Appointment and record rows carry nullable timestamps, so these are hit in
  // normal use — they must not render "Invalid Date" into the UI.
  for (const bad of [null, undefined, '', 'not-a-date']) {
    assert.equal(formatDate(bad), '', String(bad));
    assert.equal(formatTime(bad), '', String(bad));
  }
});

test('formatters produce something for a real timestamp', () => {
  const iso = new Date('2026-09-10T09:30:00Z').toISOString();
  assert.ok(formatDate(iso).length > 0);
  assert.ok(formatTime(iso).length > 0);
});
