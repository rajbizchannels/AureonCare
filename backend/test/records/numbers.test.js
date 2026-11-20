// Record numbers — the server-side numbering for claims, pre-authorizations and lab orders
// (utils/recordNumbers.js).
//
// Needs no database. What makes "highest this year, plus one" safe is ordering, and a
// fake connection that records every statement can prove the order:
//   * the advisory lock is taken in its own statement BEFORE the read, so the read's
//     snapshot cannot miss a number committed while this transaction waited for the lock;
//   * the lock, the read and the INSERT run inside one BEGIN/COMMIT on one connection;
//   * a failed INSERT rolls back, releasing the lock without consuming a number;
//   * a pg Pool gets a checked-out client (a BEGIN sent to a pool lands on one connection
//     and the statements after it on others), while the per-request tenant handle, which
//     is already one connection, is used as it is.
// What it cannot prove is the SQL against Postgres — the backend's DB-backed suites do that.

const path = require('path');

const BACKEND = path.join(__dirname, '..', '..');
const { insertNumbered, nextRecordNumber } = require(path.join(BACKEND, 'utils/recordNumbers.js'));

const results = [];
const check = (name, cond) => results.push([name, !!cond]);

/** A connection that answers the numbering read with `highest` and logs every statement. */
function fakeConnection(highest, { failInsert = false } = {}) {
  const log = [];
  return {
    log,
    async query(text, params) {
      const sql = String(text).replace(/\s+/g, ' ').trim();
      log.push({ sql, params });
      if (/^SELECT COALESCE\(MAX/.test(sql)) return { rows: [{ n: highest }] };
      if (/^INSERT/.test(sql)) {
        if (failInsert) throw new Error('insert failed');
        return { rows: [{ id: 1, number: params[0] }] };
      }
      return { rows: [] };
    },
  };
}

const kind = (entry) => {
  if (/^BEGIN/.test(entry.sql)) return 'BEGIN';
  if (/^COMMIT/.test(entry.sql)) return 'COMMIT';
  if (/^ROLLBACK/.test(entry.sql)) return 'ROLLBACK';
  if (/pg_advisory_xact_lock/.test(entry.sql)) return 'LOCK';
  if (/^SELECT COALESCE\(MAX/.test(entry.sql)) return 'READ';
  if (/^INSERT/.test(entry.sql)) return 'INSERT';
  return entry.sql;
};

const insertRow = (q, number) => q.query('INSERT INTO claims (claim_number) VALUES ($1)', [number]);
const CLAIMS = { table: 'claims', column: 'claim_number', prefix: 'CLM' };

(async () => {
  const year = new Date().getFullYear();

  // ── formatting ─────────────────────────────────────────────────────────────
  {
    const q = fakeConnection(118);
    const n = await nextRecordNumber(q, { ...CLAIMS, now: new Date('2026-10-27T12:00:00Z') });
    check('continues the year\'s sequence, zero-padded to six', n === 'CLM-2026-000119');
    const readParams = q.log.find((e) => kind(e) === 'READ').params[0];
    check('reads only this year\'s numbers in this prefix', readParams === '^CLM-2026-[0-9]+$');
  }
  {
    const q = fakeConnection(0);
    check('first number of a new year is 000001',
      (await nextRecordNumber(q, { ...CLAIMS, now: new Date('2027-01-02T09:00:00Z') })) === 'CLM-2027-000001');
  }
  {
    const q = fakeConnection(999999);
    check('does not truncate past six digits',
      (await nextRecordNumber(q, { ...CLAIMS, now: new Date('2026-06-01') })) === 'CLM-2026-1000000');
  }

  // ── ordering on the per-request tenant handle (one connection, no .connect) ─
  {
    const db = fakeConnection(41);
    const out = await insertNumbered(db, CLAIMS, insertRow);
    const order = db.log.map(kind);
    check('tenant handle: BEGIN, LOCK, READ, INSERT, COMMIT in that order',
      order.join(',') === 'BEGIN,LOCK,READ,INSERT,COMMIT');
    check('the lock is its own statement, not part of the read',
      !/pg_advisory_xact_lock/.test(db.log.find((e) => kind(e) === 'READ').sql));
    check('the inserted row carries the generated number', out.rows[0].number === `CLM-${year}-000042`);
    check('the lock key names the table and column',
      db.log.find((e) => kind(e) === 'LOCK').params[0] === 'record-number:claims.claim_number');
  }

  // ── a failed INSERT rolls back ──────────────────────────────────────────────
  {
    const db = fakeConnection(5, { failInsert: true });
    let threw = false;
    try { await insertNumbered(db, CLAIMS, insertRow); } catch (_) { threw = true; }
    const order = db.log.map(kind);
    check('a failed INSERT surfaces the error', threw);
    check('a failed INSERT rolls back instead of committing',
      order.includes('ROLLBACK') && !order.includes('COMMIT'));
  }

  // ── a pg Pool gets a dedicated client, released afterwards ─────────────────
  {
    const client = fakeConnection(7);
    let released = 0;
    client.release = () => { released += 1; };
    const poolQueries = [];
    const pool = {
      connect: async () => client,
      query: async (text) => { poolQueries.push(text); return { rows: [] }; },
    };
    await insertNumbered(pool, CLAIMS, insertRow);
    check('a pool is never sent BEGIN directly', poolQueries.length === 0);
    check('the whole transaction runs on the checked-out client',
      client.log.map(kind).join(',') === 'BEGIN,LOCK,READ,INSERT,COMMIT');
    check('the client is released exactly once', released === 1);
  }
  {
    const client = fakeConnection(7, { failInsert: true });
    let released = 0;
    client.release = () => { released += 1; };
    const pool = { connect: async () => client, query: async () => ({ rows: [] }) };
    await insertNumbered(pool, CLAIMS, insertRow).catch(() => {});
    check('the client is released even when the INSERT fails', released === 1);
  }

  // ── report ─────────────────────────────────────────────────────────────────
  let failed = 0;
  for (const [name, ok] of results) {
    console.log(`${ok ? '  ✓' : '  ✗'} ${name}`);
    if (!ok) failed += 1;
  }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
