import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOKING_HORIZON_DAYS, bookableDays, clashesWith, slotsForDay, toDateInput,
} from '../src/lib/booking.ts';

const dayAt = (y, m, d) => new Date(y, m - 1, d, 0, 0, 0, 0);

test('the bookable window starts tomorrow, never today', () => {
  const days = bookableDays();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  assert.equal(days.length, BOOKING_HORIZON_DAYS);
  assert.ok(days[0].getTime() > today.getTime(), 'first offered day must be after today');
  // Same-day booking is the desk's job, not the app's — a slot two hours out
  // would be taken by someone nobody has time to notice.
  assert.ok(days.every((d) => d.getTime() > today.getTime()));
});

test('the window is contiguous, one day apart', () => {
  const days = bookableDays(5);
  for (let i = 1; i < days.length; i += 1) {
    const gap = days[i].getTime() - days[i - 1].getTime();
    // Day length varies across a DST boundary, so assert the calendar day
    // advanced by one rather than that exactly 24h passed.
    assert.ok(gap >= 22 * 3600_000 && gap <= 26 * 3600_000, `gap ${gap} at ${i}`);
  }
});

test('slots fill the working day and stop at closing', () => {
  const slots = slotsForDay(dayAt(2026, 11, 24));
  assert.equal(slots.length, 16); // 09:00–17:00, every 30 minutes
  assert.equal(new Date(slots[0].startIso).getHours(), 9);
  // The last slot must END at closing, not start at it.
  const last = slots[slots.length - 1];
  assert.equal(new Date(last.endIso).getHours(), 17);
  assert.equal(new Date(last.startIso).getHours(), 16);
});

test('a duration that would overrun closing is not offered', () => {
  const slots = slotsForDay(dayAt(2026, 11, 24), {
    startHour: 9, endHour: 10, stepMinutes: 30, durationMinutes: 45,
  });
  // 09:00–09:45 fits; 09:30–10:15 does not.
  assert.equal(slots.length, 1);
  assert.equal(new Date(slots[0].endIso).getMinutes(), 45);
});

test('degenerate inputs produce no slots rather than hanging', () => {
  assert.deepEqual(slotsForDay(new Date('nonsense')), []);
  assert.deepEqual(slotsForDay(dayAt(2026, 11, 24), { stepMinutes: 0 }), []);
  assert.deepEqual(slotsForDay(dayAt(2026, 11, 24), { durationMinutes: -5 }), []);
  // A day that closes before it opens is empty, not negative.
  assert.deepEqual(slotsForDay(dayAt(2026, 11, 24), { startHour: 17, endHour: 9 }), []);
});

const slot = (startIso, endIso) => ({ startIso, endIso });

test('a clash is an overlap, and touching ends do not overlap', () => {
  const existing = [
    { start_time: '2026-11-24T09:30:00.000Z', end_time: '2026-11-24T10:00:00.000Z', status: 'scheduled' },
  ];
  assert.equal(
    clashesWith(slot('2026-11-24T09:30:00.000Z', '2026-11-24T10:00:00.000Z'), existing), true);
  assert.equal(
    clashesWith(slot('2026-11-24T09:45:00.000Z', '2026-11-24T10:15:00.000Z'), existing), true);
  // Back-to-back is fine: 09:00–09:30 ends exactly as the other begins.
  assert.equal(
    clashesWith(slot('2026-11-24T09:00:00.000Z', '2026-11-24T09:30:00.000Z'), existing), false);
  assert.equal(
    clashesWith(slot('2026-11-24T10:00:00.000Z', '2026-11-24T10:30:00.000Z'), existing), false);
});

test('a cancelled or completed appointment does not block the slot', () => {
  const window = slot('2026-11-24T09:30:00.000Z', '2026-11-24T10:00:00.000Z');
  for (const status of ['cancelled', 'canceled', 'completed', 'CANCELLED']) {
    assert.equal(
      clashesWith(window, [
        { start_time: '2026-11-24T09:30:00.000Z', end_time: '2026-11-24T10:00:00.000Z', status },
      ]),
      false,
      status
    );
  }
});

test('an unparseable existing appointment is ignored, not treated as a clash', () => {
  // A row with a malformed timestamp must not silently block the whole day.
  assert.equal(
    clashesWith(slot('2026-11-24T09:30:00.000Z', '2026-11-24T10:00:00.000Z'), [
      { start_time: 'not-a-date', end_time: 'also-not', status: 'scheduled' },
    ]),
    false
  );
});

test('no existing appointments means nothing clashes', () => {
  assert.equal(clashesWith(slot('2026-11-24T09:30:00.000Z', '2026-11-24T10:00:00.000Z'), []), false);
});

test('toDateInput writes the local calendar day, zero-padded', () => {
  assert.equal(toDateInput(dayAt(2026, 1, 5)), '2026-01-05');
  assert.equal(toDateInput(dayAt(2026, 11, 24)), '2026-11-24');
  // Late in the evening the UTC date can already be tomorrow; the waitlist
  // wants the day the patient means, which is the local one.
  const evening = new Date(2026, 10, 24, 23, 30, 0, 0);
  assert.equal(toDateInput(evening), '2026-11-24');
});
