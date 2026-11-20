// Calendar values must read the same wherever the reader is.
//
// An appointment booked for 6 PM was listed as 7 PM. The value travelled as a UTC instant:
// the form sent the wall-clock string "2026-11-17 18:00:00", Postgres stored 18:00 in a
// `timestamp without time zone`, node-postgres turned it into a JS Date, res.json()
// serialised that as "2026-11-17T18:00:00.000Z", and the browser rendered the instant in
// its own timezone. One hour ahead of the server, 6 PM became 7 PM. Behind it, worse: New
// York showed 1 PM, Auckland 7 AM the next morning.
//
// The same happened to dates: a date of birth of 1980-04-02 arrived as
// "1980-04-02T00:00:00.000Z" and read as 1 April to every browser behind UTC.
//
// These checks are written as invariants on the LOCAL components, so they hold whatever
// timezone the test process runs in — which is the property the product needs.

import { parseApiDate, formatTime, formatDate, formatDateTime } from './formatters';

describe('a wall-clock value keeps its reading', () => {
  test('a timestamp keeps the hour it was booked for', () => {
    const d = parseApiDate('2026-11-17 18:00:00');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(10);      // November
    expect(d.getDate()).toBe(17);
    expect(d.getHours()).toBe(18);      // 6 PM, in any timezone
    expect(d.getMinutes()).toBe(0);
  });

  test('the ISO "T" spelling is treated the same as the space spelling', () => {
    expect(parseApiDate('2026-11-17T18:00:00').getHours()).toBe(18);
  });

  test('fractional seconds do not derail it', () => {
    expect(parseApiDate('2026-11-17 18:00:00.123456').getHours()).toBe(18);
  });

  test('a date-only value keeps its day', () => {
    // new Date('1980-04-02') is UTC midnight BY SPECIFICATION, so a browser behind UTC
    // renders it as 1 April. On a date of birth that is a wrong record.
    const d = parseApiDate('1980-04-02');
    expect(d.getFullYear()).toBe(1980);
    expect(d.getMonth()).toBe(3);       // April
    expect(d.getDate()).toBe(2);
  });

  test('formatTime shows the booked hour', () => {
    expect(formatTime('2026-11-17 18:00:00')).toMatch(/06:00\s*PM/i);
  });

  test('formatDate shows the stored day', () => {
    expect(formatDate('1980-04-02')).toMatch(/Apr 2, 1980/);
  });

  test('formatDateTime shows both', () => {
    const out = formatDateTime('2026-11-17 18:00:00');
    expect(out).toMatch(/Nov 17, 2026/);
    expect(out).toMatch(/06:00\s*PM/i);
  });

  test('midnight does not roll into the day before', () => {
    const d = parseApiDate('2026-11-17 00:00:00');
    expect(d.getDate()).toBe(17);
    expect(d.getHours()).toBe(0);
  });

  test('a time just before midnight does not roll into the next day', () => {
    const d = parseApiDate('2026-11-17 23:59:00');
    expect(d.getDate()).toBe(17);
    expect(d.getHours()).toBe(23);
  });
});

describe('a real instant is still localised', () => {
  // A value that carries a zone IS a point in time, and converting it to the reader's
  // local clock is the right behaviour. The fix must not flatten those too.
  test('a trailing Z is parsed as an instant', () => {
    expect(parseApiDate('2026-11-17T18:00:00Z').getTime())
      .toBe(new Date('2026-11-17T18:00:00Z').getTime());
  });

  test('an explicit offset is parsed as an instant', () => {
    expect(parseApiDate('2026-11-17T18:00:00+02:00').getTime())
      .toBe(new Date('2026-11-17T18:00:00+02:00').getTime());
  });

  test('a Date is passed through untouched', () => {
    const d = new Date(2026, 10, 17, 18, 0, 0);
    expect(parseApiDate(d)).toBe(d);
  });
});

describe('the edges', () => {
  test('null and empty are not dates', () => {
    expect(parseApiDate(null)).toBeNull();
    expect(parseApiDate('')).toBeNull();
    expect(formatTime(null)).toBe('N/A');
    expect(formatDate(null)).toBe('N/A');
  });

  test('a plain HH:MM string is left as it is', () => {
    expect(formatTime('09:30')).toBe('09:30');
  });

  test('rubbish is reported rather than rendered as a wrong time', () => {
    expect(formatDate('not a date')).toBe('Invalid Date');
  });
});
