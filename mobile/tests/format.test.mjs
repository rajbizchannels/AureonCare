import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fullName, isDueToday, isPastDue, isToday, isUpcoming, formatDate, formatTime,
} from '../src/lib/useResource.ts';

/** A DATE column comes back as midnight, which is how this went wrong. */
const dueDateFor = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00:00.000Z`;
};

test('a task due today is not overdue', () => {
  // The bug this exists for: due_date is a DATE, so it arrives as midnight.
  // Comparing it to Date.now() made everything due today read as overdue from
  // 00:01 — and the row paints red, which is the worst way to be wrong.
  assert.equal(isPastDue(dueDateFor(0)), false);
  assert.equal(isDueToday(dueDateFor(0)), true);
});

test('overdue is strictly before today, by calendar day', () => {
  assert.equal(isPastDue(dueDateFor(-1)), true);
  assert.equal(isPastDue(dueDateFor(-30)), true);
  assert.equal(isPastDue(dueDateFor(1)), false);
  assert.equal(isDueToday(dueDateFor(1)), false);
  assert.equal(isDueToday(dueDateFor(-1)), false);
});

test('no due date is neither overdue nor due today', () => {
  for (const bad of [null, undefined, '', 'not-a-date']) {
    assert.equal(isPastDue(bad), false, String(bad));
    assert.equal(isDueToday(bad), false, String(bad));
  }
});

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

test('isToday is a calendar-day test, not a 24-hour window', () => {
  const now = new Date();
  // One minute past midnight today is still today; one minute before was not.
  const justAfterMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 1);
  const justBeforeMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0);
  justBeforeMidnight.setMinutes(-1);

  assert.equal(isToday(justAfterMidnight.toISOString()), true);
  assert.equal(isToday(justBeforeMidnight.toISOString()), false);
  assert.equal(isToday(new Date(now.getTime() + 36 * 3600_000).toISOString()), false);
});

test('isToday rejects nothing-shaped input rather than throwing', () => {
  for (const bad of [null, undefined, '', 'not-a-date']) {
    assert.equal(isToday(bad), false, String(bad));
  }
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
