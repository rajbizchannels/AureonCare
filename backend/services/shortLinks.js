// Short links — /s/<code> on our own domain (see migrations/history/global/091_short_links.sql).
//
// shorten(url, { expiresAt, kind }) returns the short URL, or the ORIGINAL url when the
// feature is unavailable (table missing, database error). A message is never held back
// because a link could not be shortened.
//
// The code is 12 base62 characters (~71 bits). Only SHA-256(code) is stored, and the
// destination is AES-256-GCM encrypted under a key derived from the code, so the table
// alone reveals neither. Lookups are rate-limited at the route.

const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const CODE_LEN = 12;
const CODE_RE = /^[A-Za-z0-9]{12}$/;

function newCode() {
  // Rejection sampling: 248 = 62 * 4, so bytes >= 248 are dropped to keep it uniform.
  let out = '';
  while (out.length < CODE_LEN) {
    for (const b of crypto.randomBytes(16)) {
      if (b < 248 && out.length < CODE_LEN) out += ALPHABET[b % 62];
    }
  }
  return out;
}

const codeHash = (code) => crypto.createHash('sha256').update(`ac-short:${code}`).digest('hex');
const codeKey = (code) => crypto.createHash('sha256').update(`ac-short-key:${code}`).digest();

/** Where short links live: AC_SHORT_BASE (a dedicated short domain), else the app URL. */
function shortBase() {
  const raw = process.env.AC_SHORT_BASE || process.env.FRONTEND_URL || process.env.AC_FE_URL || '';
  return raw.split(',')[0].trim().replace(/\/+$/, '');
}

let pool = null;
const getPool = () => pool || (pool = require('../db.js'));

/**
 * Store a short link for `url` and return its public short URL.
 * @param {string} url absolute http(s) URL
 * @param {{ expiresAt?: Date|string|null, kind?: string, db?: object }} opts
 */
async function shorten(url, { expiresAt = null, kind = 'link', db } = {}) {
  try {
    const base = shortBase();
    if (!base || !/^https?:\/\//i.test(String(url || ''))) return url;
    const code = newCode();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', codeKey(code), iv);
    const enc = Buffer.concat([cipher.update(String(url), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    await (db || getPool()).query(
      `INSERT INTO public.short_links (code_hash, iv, tag, target_enc, kind, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [codeHash(code), iv, tag, enc, String(kind).slice(0, 32), expiresAt ? new Date(expiresAt) : null]);
    return `${base}/s/${code}`;
  } catch (e) {
    console.warn('[shortLinks] not shortened, sending the full link:', e.message);
    return url;
  }
}

/** The destination for a code, or null when unknown / expired. */
async function resolve(code, { db } = {}) {
  if (!CODE_RE.test(String(code || ''))) return null;
  const q = db || getPool();
  const { rows: [row] } = await q.query(
    `UPDATE public.short_links SET use_count = use_count + 1, last_used_at = now()
      WHERE code_hash = $1 AND (expires_at IS NULL OR expires_at > now())
      RETURNING iv, tag, target_enc`, [codeHash(code)]);
  if (!row) return null;
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', codeKey(code), row.iv);
    d.setAuthTag(row.tag);
    return Buffer.concat([d.update(row.target_enc), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** Drop links that expired more than a day ago (called opportunistically). */
async function purgeExpired({ db } = {}) {
  try {
    await (db || getPool()).query(
      `DELETE FROM public.short_links WHERE expires_at IS NOT NULL AND expires_at < now() - interval '1 day'`);
  } catch { /* table may not exist yet */ }
}

module.exports = { shorten, resolve, purgeExpired, shortBase, CODE_RE, _codeHash: codeHash };
