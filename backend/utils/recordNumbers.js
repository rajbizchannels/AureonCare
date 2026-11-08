// Server-side record numbers for the tables that have no database generator.
//
// Denials, payment postings, quotes, invoices and billing payments are numbered by
// generate_*_number() triggers in the migrations, as PREFIX-YYYY-NNNNNN. Claims,
// pre-authorizations and lab orders never were. Claims were numbered in the browser
// as `CLM-2024-` plus the count of claims that browser happened to have loaded: the
// year was frozen at 2024, and two staff creating claims at once — or anyone creating
// one after a deletion — produced the same number twice. A claim number goes out on
// the 837 and is what a remittance is matched back to, so a duplicate is a billing
// fault rather than a cosmetic one. Pre-authorizations were `PA-<epoch ms>` from the
// browser and lab orders `LO-<epoch ms>-<random>` from here: unique, but not numbers a
// person can read out over the phone. All three now follow the generators' format.
//
// "Highest number this year, plus one" is only safe if two inserts cannot read the same
// highest number. The generator triggers get that from running inside the INSERT. Here
// it comes from an advisory lock taken in its own statement, inside a transaction,
// BEFORE the read: under READ COMMITTED a statement's snapshot is taken when it starts,
// so a read in the same statement as the lock would still miss a number another
// transaction committed while this one was waiting for it.

const WIDTH = 6;

/**
 * Run `fn` inside a transaction on a single connection.
 *
 * A pg Pool hands each .query() to whichever client is free, so a BEGIN sent to the
 * pool opens a transaction on one connection while the statements after it run on
 * others. Check out a client in that case. The per-request tenant handle
 * (db/requestTenantDb.js) is already one connection and honours a caller's BEGIN, so
 * it is used as it is.
 */
async function withTransaction(db, fn) {
  if (typeof db.connect === 'function') {
    const client = await db.connect();
    try {
      return await inTransaction(client, fn);
    } finally {
      client.release();
    }
  }
  return inTransaction(db, fn);
}

async function inTransaction(q, fn) {
  await q.query('BEGIN');
  try {
    const out = await fn(q);
    await q.query('COMMIT');
    return out;
  } catch (err) {
    await q.query('ROLLBACK').catch(() => {});
    throw err;
  }
}

/**
 * The next number in `table.column` for the current year, e.g. CLM-2026-000119.
 * Must be called inside withTransaction(); the lock it takes is released at commit,
 * so hold the INSERT in the same transaction.
 *
 * `table`, `column` and `prefix` are interpolated, so they must be constants from the
 * calling code — never request input.
 */
async function nextRecordNumber(q, { table, column, prefix, now = new Date() }) {
  const year = now.getFullYear();
  await q.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`record-number:${table}.${column}`]);
  const { rows } = await q.query(
    `SELECT COALESCE(MAX(substring(${column} FROM '[0-9]+$')::int), 0) AS n
       FROM ${table}
      WHERE ${column} ~ $1`,
    [`^${prefix}-${year}-[0-9]+$`]
  );
  const next = Number(rows[0] && rows[0].n) + 1;
  return `${prefix}-${year}-${String(next).padStart(WIDTH, '0')}`;
}

/**
 * Insert a row numbered from its table's sequence, atomically.
 * `insert(q, number)` runs the INSERT on the same connection and returns its result.
 */
async function insertNumbered(db, spec, insert) {
  return withTransaction(db, async (q) => {
    const number = await nextRecordNumber(q, spec);
    return insert(q, number);
  });
}

module.exports = { insertNumbered, nextRecordNumber, withTransaction, WIDTH };
