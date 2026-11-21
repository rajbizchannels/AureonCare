// Account lockout after repeated wrong passwords — staff sign-in and the patient portal.
//
// Policy: the 4th wrong password (or second-factor code) within the window locks the
// address for LOCK_MINUTES. A successful sign-in, a password reset, or an administrator's
// "Unlock" clears it.
//
// Keyed by a keyed hash of the email, never the address, so the shared table is not a list
// of who has accounts. It works the same for addresses that have NO account: an unknown
// email locks after four tries too, so the "locked" answer cannot be used to discover which
// addresses are registered — which is also why the replies may say how many tries are left.
//
// Fails open: if the table is missing (migration 095 not yet applied) or the database
// hiccups, sign-in carries on without lockout rather than locking everyone out. The per-IP
// rate limit still applies.

const crypto = require('crypto');

const MAX_FAILURES = Math.max(1, parseInt(process.env.AC_LOCKOUT_MAX || '4', 10));
const LOCK_MINUTES = Math.max(1, parseInt(process.env.AC_LOCKOUT_MIN || '15', 10));

function keyFor(scope, email) {
  // AC_IDX_K is the deployment's identifier pepper; the token secret is the fallback so
  // lockout still works where the portal index is not configured.
  const secret = process.env.AC_IDX_K || process.env.AC_TK_S || process.env.AC_JWT_S || 'aureoncare-lockout';
  return crypto.createHmac('sha256', String(secret))
    .update(`lockout:${scope}:${String(email || '').trim().toLowerCase()}`).digest('hex');
}

const missingTable = (e) => e && (e.code === '42P01' || e.code === '42501');
const warnOnce = (() => { let said = false; return (e) => {
  if (!said) { said = true; console.warn('[lockout] disabled (', e.code || e.message, ') — apply migration 095_login_lockouts.sql'); }
}; })();

const lockedMessage = (minutes) =>
  `Too many wrong passwords. This account is locked for ${minutes} minute${minutes === 1 ? '' : 's'}. ` +
  'Reset your password, or ask your practice administrator to unlock it.';

/** { locked, minutesLeft } — call BEFORE checking the password. */
async function status(pool, scope, email) {
  try {
    const { rows: [r] } = await pool.query(
      `SELECT CEIL(EXTRACT(EPOCH FROM (locked_until - now())) / 60)::int AS mins
         FROM public.login_lockouts WHERE key_hash = $1 AND locked_until > now()`, [keyFor(scope, email)]);
    return r ? { locked: true, minutesLeft: Math.max(1, r.mins), message: lockedMessage(Math.max(1, r.mins)) } : { locked: false };
  } catch (e) {
    if (missingTable(e)) warnOnce(e); else console.warn('[lockout] status check failed:', e.message);
    return { locked: false };
  }
}

/**
 * Record a wrong password. Returns { locked, remaining, message } where message is what to
 * show the person (it says how many tries are left, or that the account is now locked).
 */
async function recordFailure(pool, scope, email, fallbackMessage) {
  try {
    const { rows: [r] } = await pool.query(
      `INSERT INTO public.login_lockouts (key_hash, scope, failed_count, last_failed_at)
       VALUES ($1, $2, 1, now())
       ON CONFLICT (key_hash) DO UPDATE SET
         -- failures older than the window start a fresh count
         failed_count = CASE WHEN login_lockouts.last_failed_at < now() - make_interval(mins => $3)
                             THEN 1 ELSE login_lockouts.failed_count + 1 END,
         last_failed_at = now()
       RETURNING failed_count`, [keyFor(scope, email), scope, LOCK_MINUTES]);
    const count = r.failed_count;
    if (count >= MAX_FAILURES) {
      await pool.query(
        `UPDATE public.login_lockouts SET locked_until = now() + make_interval(mins => $2), failed_count = 0 WHERE key_hash = $1`,
        [keyFor(scope, email), LOCK_MINUTES]);
      return { locked: true, remaining: 0, message: lockedMessage(LOCK_MINUTES) };
    }
    const remaining = MAX_FAILURES - count;
    return { locked: false, remaining,
      message: remaining === 1 ? `${fallbackMessage} 1 attempt left before the account is locked.` : fallbackMessage };
  } catch (e) {
    if (missingTable(e)) warnOnce(e); else console.warn('[lockout] could not record a failure:', e.message);
    return { locked: false, remaining: null, message: fallbackMessage };
  }
}

/** Clear failures and any lock (successful sign-in, password reset, admin unlock). */
async function clear(pool, scope, email) {
  try {
    const { rowCount } = await pool.query('DELETE FROM public.login_lockouts WHERE key_hash = $1', [keyFor(scope, email)]);
    return rowCount > 0;
  } catch (e) {
    if (missingTable(e)) warnOnce(e); else console.warn('[lockout] could not clear:', e.message);
    return false;
  }
}

/** Of these emails, which are locked right now? Returns a Set of lower-cased emails. */
async function lockedAmong(pool, scope, emails) {
  const list = [...new Set((emails || []).filter(Boolean).map((e) => String(e).trim().toLowerCase()))];
  if (!list.length) return new Set();
  const byKey = new Map(list.map((e) => [keyFor(scope, e), e]));
  try {
    const { rows } = await pool.query(
      'SELECT key_hash FROM public.login_lockouts WHERE key_hash = ANY($1) AND locked_until > now()', [[...byKey.keys()]]);
    return new Set(rows.map((r) => byKey.get(r.key_hash)));
  } catch (e) {
    if (missingTable(e)) warnOnce(e); else console.warn('[lockout] lookup failed:', e.message);
    return new Set();
  }
}

module.exports = { status, recordFailure, clear, lockedAmong, MAX_FAILURES, LOCK_MINUTES, keyFor };
