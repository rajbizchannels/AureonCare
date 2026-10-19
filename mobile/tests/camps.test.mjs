import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptsRegistrations, campIsOver, formatWait, hasLiveBoard,
  registrationBlockedReason, sortCamps, stationPressure, summariseBoard, validateAttendee,
} from '../src/lib/camps.ts';

const station = (over) => ({
  id: 'st', name: 'Vitals', stepOrder: 1, isClinical: true, isActive: true,
  queued: 0, inProgress: 0, completed: 0, longestWaitSeconds: 0, ...over,
});

test('only published and running camps take registrations', () => {
  assert.equal(acceptsRegistrations({ status: 'published' }), true);
  assert.equal(acceptsRegistrations({ status: 'in_progress' }), true);
  assert.equal(acceptsRegistrations({ status: 'draft' }), false);
  assert.equal(acceptsRegistrations({ status: 'completed' }), false);
  assert.equal(acceptsRegistrations({ status: 'cancelled' }), false);
});

test('only a running camp has a live board', () => {
  assert.equal(hasLiveBoard({ status: 'in_progress' }), true);
  assert.equal(hasLiveBoard({ status: 'published' }), false);
});

test('campIsOver covers both terminal states', () => {
  assert.equal(campIsOver({ status: 'completed' }), true);
  assert.equal(campIsOver({ status: 'cancelled' }), true);
  assert.equal(campIsOver({ status: 'draft' }), false);
});

test('a blocked registration says why, in the words the desk needs', () => {
  const draft = { status: 'draft', name: 'Eye camp', capacity: null, registrationCount: 0 };
  assert.match(registrationBlockedReason(draft), /Eye camp.*draft/);

  const full = { status: 'in_progress', name: 'Eye camp', capacity: 50, registrationCount: 50 };
  assert.match(registrationBlockedReason(full), /capacity of 50/);

  const open = { status: 'in_progress', name: 'Eye camp', capacity: 50, registrationCount: 49 };
  assert.equal(registrationBlockedReason(open), null);
});

test('capacity with no count recorded does not block', () => {
  // GET /camps/:id omits registrationCount; treating that as 0 registrations
  // is right, treating it as "full" would close the desk.
  const camp = { status: 'in_progress', name: 'Eye camp', capacity: 10 };
  assert.equal(registrationBlockedReason(camp), null);
});

test('an attendee needs a name and one of age or date of birth', () => {
  assert.match(validateAttendee({ fullName: '  ' }), /name is required/i);
  assert.match(validateAttendee({ fullName: 'Asha' }), /age or a date of birth/);
  assert.equal(validateAttendee({ fullName: 'Asha', ageYears: '34' }), null);
  assert.equal(validateAttendee({ fullName: 'Asha', dateOfBirth: '1992-02-04' }), null);
});

test('age is bounded the way the backend bounds it', () => {
  assert.match(validateAttendee({ fullName: 'Asha', ageYears: '131' }), /0 and 130/);
  assert.match(validateAttendee({ fullName: 'Asha', ageYears: '-1' }), /0 and 130/);
  assert.equal(validateAttendee({ fullName: 'Asha', ageYears: '0' }), null);
  assert.equal(validateAttendee({ fullName: 'Asha', ageYears: '130' }), null);
});

test('a date of birth that is not a date is refused before the round trip', () => {
  assert.match(validateAttendee({ fullName: 'Asha', dateOfBirth: 'yesterday' }), /not a date/);
});

test('waits read as a glance, not as seconds', () => {
  assert.equal(formatWait(null), '—');
  assert.equal(formatWait(-5), '—');
  assert.equal(formatWait(0), 'just now');
  assert.equal(formatWait(59), 'just now');
  assert.equal(formatWait(60), '1m');
  assert.equal(formatWait(25 * 60), '25m');
  assert.equal(formatWait(60 * 60), '1h');
  assert.equal(formatWait(95 * 60), '1h 35m');
});

test('pressure reads queue depth and waiting time, worst wins', () => {
  assert.equal(stationPressure(station()), 'clear');
  assert.equal(stationPressure(station({ queued: 3 })), 'clear');
  assert.equal(stationPressure(station({ queued: 4 })), 'busy');
  assert.equal(stationPressure(station({ queued: 10 })), 'blocked');

  // A short queue that has not moved in an hour is a problem a count misses.
  assert.equal(stationPressure(station({ queued: 1, longestWaitSeconds: 60 * 60 })), 'blocked');
  assert.equal(stationPressure(station({ queued: 1, longestWaitSeconds: 21 * 60 })), 'busy');

  // A long queue that is moving fast is only busy, not blocked.
  assert.equal(stationPressure(station({ queued: 5, longestWaitSeconds: 30 })), 'busy');
});

test('a missing wait is treated as no wait, not as infinite', () => {
  assert.equal(stationPressure(station({ queued: 0, longestWaitSeconds: null })), 'clear');
});

test('the board totals every station and names the real bottleneck', () => {
  const summary = summariseBoard([
    station({ id: 'a', name: 'Reception', queued: 8, inProgress: 1, completed: 40, longestWaitSeconds: 10 * 60 }),
    station({ id: 'b', name: 'Consult', queued: 4, inProgress: 2, completed: 12, longestWaitSeconds: 50 * 60 }),
    station({ id: 'c', name: 'Pharmacy', queued: 0, inProgress: 0, completed: 9, longestWaitSeconds: 0 }),
  ]);

  assert.equal(summary.waiting, 12);
  assert.equal(summary.inProgress, 3);
  assert.equal(summary.seen, 61);
  // Reception has the longer queue; Consult has people who have actually been
  // left waiting. The bottleneck is the one to walk to.
  assert.equal(summary.bottleneck.name, 'Consult');
});

test('a board with nothing under pressure names no bottleneck', () => {
  const summary = summariseBoard([station({ queued: 1 }), station({ id: 'b', queued: 2 })]);
  assert.equal(summary.bottleneck, null);
  assert.equal(summary.waiting, 3);
});

test('an empty board summarises to zeroes rather than throwing', () => {
  assert.deepEqual(summariseBoard([]), { waiting: 0, inProgress: 0, seen: 0, bottleneck: null });
});

test('camps sort by what is happening now, then by when', () => {
  const camps = [
    { id: 'done', status: 'completed', startsAt: '2026-01-01T09:00:00Z' },
    { id: 'later', status: 'published', startsAt: '2026-12-01T09:00:00Z' },
    { id: 'now', status: 'in_progress', startsAt: '2026-06-01T09:00:00Z' },
    { id: 'soon', status: 'published', startsAt: '2026-07-01T09:00:00Z' },
    { id: 'draft', status: 'draft', startsAt: '2026-02-01T09:00:00Z' },
  ];
  assert.deepEqual(
    sortCamps(camps).map((c) => c.id),
    ['now', 'soon', 'later', 'draft', 'done']
  );
});

test('the archive reads most recent first', () => {
  const camps = [
    { id: 'old', status: 'completed', startsAt: '2024-01-01T09:00:00Z' },
    { id: 'recent', status: 'completed', startsAt: '2026-01-01T09:00:00Z' },
  ];
  assert.deepEqual(sortCamps(camps).map((c) => c.id), ['recent', 'old']);
});

test('a malformed date sorts last instead of scrambling the order', () => {
  const camps = [
    { id: 'bad', status: 'published', startsAt: 'not-a-date' },
    { id: 'good', status: 'published', startsAt: '2026-07-01T09:00:00Z' },
  ];
  assert.deepEqual(sortCamps(camps).map((c) => c.id), ['good', 'bad']);
});

test('sortCamps does not mutate its input', () => {
  const camps = [
    { id: 'a', status: 'completed', startsAt: '2026-01-01T09:00:00Z' },
    { id: 'b', status: 'in_progress', startsAt: '2026-06-01T09:00:00Z' },
  ];
  sortCamps(camps);
  assert.deepEqual(camps.map((c) => c.id), ['a', 'b']);
});
