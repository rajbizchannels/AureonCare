// Appointment times are wall-clock times (timestamp without time zone). Run under TZ=Europe/Paris
// too (npm test does) — the bug only shows when the device is not on UTC.
import test from 'node:test';
import assert from 'node:assert/strict';
import { localDay, timeOf, toDate, wallClock } from '../src/lib/time.ts';
import { clashesWith, slotsForDay } from '../src/lib/booking.ts';

test('a booking is sent as the local time the patient picked, never a UTC instant', () => {
  const slots = slotsForDay(new Date(2026, 10, 23));
  assert.equal(slots[2].startIso, '2026-11-23 10:00:00');
  assert.equal(slots[2].endIso, '2026-11-23 10:30:00');
  assert.ok(!/Z|[+-]\d{2}:\d{2}$/.test(slots[2].startIso), 'no offset in what is sent');
});

test('what the server returns reads back as the same time (no hour lost)', () => {
  const sent = slotsForDay(new Date(2026, 10, 23))[2].startIso;
  // The server returns the column's characters: "2026-11-23 10:00:00".
  const shown = toDate(sent);
  assert.equal(shown.getHours(), 10);
  assert.equal(shown.getMinutes(), 0);
  assert.equal(toDate('2026-11-23T10:00:00').getHours(), 10);
  assert.equal(toDate('2026-11-23T10:00:00.000').getHours(), 10);
});

test('real instants (with Z or an offset) are still instants', () => {
  assert.equal(toDate('2026-11-23T09:00:00.000Z').getTime(), Date.UTC(2026, 10, 23, 9));
  assert.equal(toDate('2026-11-23T10:00:00+01:00').getTime(), Date.UTC(2026, 10, 23, 9));
});

test('unreadable values', () => {
  assert.equal(toDate(null), null);
  assert.equal(toDate(''), null);
  assert.equal(toDate('soon'), null);
  assert.ok(Number.isNaN(timeOf('soon')));
});

test('wall clock and local day', () => {
  const d = new Date(2026, 0, 5, 0, 30, 0);
  assert.equal(wallClock(d), '2026-01-05 00:30:00');
  assert.equal(localDay(d), '2026-01-05', 'a 00:30 visit stays on its own day');
});

test('clash check compares wall-clock times with the stored ones', () => {
  const slot = slotsForDay(new Date(2026, 10, 23))[2];
  assert.equal(clashesWith(slot, [{ start_time: '2026-11-23 10:15:00', end_time: '2026-11-23 10:45:00', status: 'scheduled' }]), true);
  assert.equal(clashesWith(slot, [{ start_time: '2026-11-23 10:30:00', end_time: '2026-11-23 11:00:00', status: 'scheduled' }]), false);
});
