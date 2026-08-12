const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Dual-audience authentication for the messaging API.
 *
 * Messaging is the one surface both audiences share, and they authenticate
 * differently: staff carry a JWT signed with AC_TK_S, patients carry an opaque
 * portal session token whose SHA-256 hash is stored in
 * patient_portal_sessions. Both arrive as `Authorization: Bearer …`.
 *
 * Rather than fork the routes, this resolves either credential into a single
 * `req.actor`:
 *
 *   { kind: 'user' | 'patient', id, displayName, email, role }
 *
 * Everything downstream authorises on thread membership, which is expressed in
 * exactly those two terms — so a route never has to care which kind of caller
 * it is serving beyond the fields it echoes back.
 */

const JWT_SECRET = process.env.AC_TK_S;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/** A JWT is three base64url segments; a portal token is 64 hex characters. */
const looksLikeJwt = (token) => token.split('.').length === 3;

const resolveStaffActor = async (pool, token) => {
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }

  const result = await pool.query(
    `SELECT id, email, role, first_name, last_name
       FROM users
      WHERE id = $1 AND status = 'active'`,
    [payload.sub]
  );
  if (result.rows.length === 0) return null;

  const u = result.rows[0];
  return {
    kind: 'user',
    id: u.id,
    email: u.email,
    role: u.role,
    displayName: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email,
  };
};

const resolvePatientActor = async (pool, token) => {
  const result = await pool.query(
    `SELECT p.id, p.email, p.first_name, p.last_name
       FROM patient_portal_sessions s
       JOIN patients p ON p.id = s.patient_id
      WHERE s.session_token = $1
        AND s.expires_at > NOW()
        AND p.portal_enabled = true`,
    [hashToken(token)]
  );
  if (result.rows.length === 0) return null;

  const p = result.rows[0];
  return {
    kind: 'patient',
    id: p.id,
    email: p.email,
    role: 'patient',
    displayName: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email,
  };
};

/**
 * Populate req.actor from either credential, 401 if neither verifies.
 */
const resolveActor = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.slice(7);
    const pool = req.app.locals.pool;

    // Try the likelier shape first, then fall back — a malformed JWT and an
    // expired portal token should both end in the same 401, not a 500.
    const actor = looksLikeJwt(token)
      ? (await resolveStaffActor(pool, token)) || (await resolvePatientActor(pool, token))
      : (await resolvePatientActor(pool, token)) || (await resolveStaffActor(pool, token));

    if (!actor) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    req.actor = actor;
    next();
  } catch (error) {
    console.error('[messagingAuth] Actor resolution failed:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/** Guard for routes only staff may reach (e.g. the recipient directory). */
const requireStaffActor = (req, res, next) => {
  if (req.actor?.kind !== 'user') {
    return res.status(403).json({ error: 'Staff access required' });
  }
  next();
};

module.exports = { resolveActor, requireStaffActor };
