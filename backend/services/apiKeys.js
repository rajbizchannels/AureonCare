/**
 * Practice API keys (migration 103) — for scripts that import data without a person signing in.
 *
 *   create(db, { practiceId, name, createdBy }) → { key (shown once), record }
 *   list(db, practiceId)                         → records, newest first (never the key)
 *   revoke(db, practiceId, id)                   → true when a live key was revoked
 *   verify(db, presented)                        → { id, practiceId, scopes } | null
 *
 * A key looks like  ack_<12 random>_<32 random>  (base62). Only SHA-256(key) is stored, with the
 * first 12 characters as a prefix so people can tell keys apart in the list. Keys carry scopes;
 * 'import' is the only one, and only the import routes accept a key at all.
 */
const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const KEY_RE = /^ack_[A-Za-z0-9]{12}_[A-Za-z0-9]{32}$/;

function randomBase62(n) {
  let out = '';
  while (out.length < n) {
    for (const b of crypto.randomBytes(n * 2)) {
      if (b < 248 && out.length < n) out += ALPHABET[b % 62]; // 248 = 62 * 4: uniform
    }
  }
  return out;
}

const hashKey = (key) => crypto.createHash('sha256').update(`ac-api-key:${key}`).digest('hex');

const present = (r) => r && ({
  id: r.id, name: r.name, prefix: r.key_prefix, scopes: r.scopes, createdAt: r.created_at,
  createdBy: r.created_by, lastUsedAt: r.last_used_at, revokedAt: r.revoked_at,
});

async function create(db, { practiceId, name, createdBy }) {
  const key = `ack_${randomBase62(12)}_${randomBase62(32)}`;
  const { rows: [r] } = await db.query(
    `INSERT INTO public.practice_api_keys (practice_id, name, key_prefix, key_hash, scopes, created_by)
     VALUES ($1, $2, $3, $4, ARRAY['import'], $5) RETURNING *`,
    [practiceId, String(name || '').trim().slice(0, 100) || 'Import key', key.slice(0, 16), hashKey(key), createdBy || null]);
  return { key, record: present(r) };
}

async function list(db, practiceId) {
  const { rows } = await db.query(
    'SELECT * FROM public.practice_api_keys WHERE practice_id = $1 ORDER BY created_at DESC', [practiceId]);
  return rows.map(present);
}

async function revoke(db, practiceId, id) {
  const { rowCount } = await db.query(
    `UPDATE public.practice_api_keys SET revoked_at = now()
      WHERE id::text = $1::text AND practice_id = $2 AND revoked_at IS NULL`, [id, practiceId]);
  return rowCount > 0;
}

async function verify(db, presented) {
  const key = String(presented || '').trim();
  if (!KEY_RE.test(key)) return null;
  const { rows: [r] } = await db.query(
    `UPDATE public.practice_api_keys SET last_used_at = now()
      WHERE key_hash = $1 AND revoked_at IS NULL
      RETURNING id, practice_id, scopes`, [hashKey(key)]);
  return r ? { id: r.id, practiceId: r.practice_id, scopes: r.scopes || [] } : null;
}

module.exports = { create, list, revoke, verify, hashKey, KEY_RE };
