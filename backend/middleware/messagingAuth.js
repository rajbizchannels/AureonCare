const jwt = require('jsonwebtoken');
const { getSessionCookie, getPortalCookie } = require('../utils/authCookies');
const { resolveTenantForUser } = require('../services/tenantCatalog');
const { makeTenantDb } = require('../db/requestTenantDb');
const { withTenant } = require('../db/tenantClient');
const { tenantForSession } = require('../services/portalRouting');
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
    // SEC-11: pin the algorithm, as middleware/auth.js does for the same tokens.
    payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
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
  const displayName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;

  // A patient can hold either credential: a portal session, or a JWT against a
  // users row whose role is 'patient' (the staff login path). Migration 023
  // merged the two id spaces — "a patient IS a user, so they share the same
  // id" — so the same person must resolve to the same actor either way.
  //
  // Without this they resolve as kind 'user', which silently breaks
  // everything: thread membership is recorded as kind 'patient', so their
  // inbox matches nothing, /care-team falls through to a staff lookup, and
  // requireStaffActor would let them read the practice directory.
  if (u.role === 'patient') {
    return { kind: 'patient', id: u.id, email: u.email, role: 'patient', displayName };
  }

  return { kind: 'user', id: u.id, email: u.email, role: u.role, displayName };
};

const resolvePatientActor = async (pool, token) => {
  // patient_portal_sessions and patients are tenant tables. This used to query them through
  // the shared pool (search_path `public`, where they no longer exist since the SEC-05
  // cutover), so every portal patient's messaging request — and every refused JWT that
  // fell through to here — answered 500. Route the token hash to its tenant first, exactly
  // as the portal's own guard does.
  const tokenHash = hashToken(token);
  const routed = await tenantForSession(pool, tokenHash);
  if (!routed || !routed.schemaName || routed.schemaName === 'public') return null;
  const result = await withTenant(pool, routed.schemaName, (client) => client.query(
    `SELECT p.id, p.email, p.first_name, p.last_name
       FROM patient_portal_sessions s
       JOIN patients p ON p.id = s.patient_id
      WHERE s.session_token = $1
        AND s.expires_at > NOW()
        AND p.portal_enabled = true`,
    [tokenHash]
  ));
  if (result.rows.length === 0) return null;

  const p = result.rows[0];
  return {
    kind: 'patient',
    id: p.id,
    email: p.email,
    role: 'patient',
    displayName: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email,
    // The practice the session routed to — authoritative for a portal patient, who has no
    // users row to resolve a practice from.
    tenantId: routed.tenantId,
    schemaName: routed.schemaName,
  };
};

/**
 * Populate req.actor from either credential, 401 if neither verifies.
 */
const resolveActor = async (req, res, next) => {
  try {
    // Header first, then the HttpOnly session cookie — the same order as extractToken in
    // middleware/auth.js. Since SEC-15 the staff session normally lives ONLY in that
    // cookie, so requiring a Bearer header here meant every messaging request from a
    // cookie session was rejected before it was ever looked up. Portal patients still
    // present their opaque token as a Bearer header, which the first branch covers.
    // SEC-15: portal patients in a browser now hold their session in the HttpOnly
    // ac_portal cookie instead. Staff cookie first: a staff member previewing the portal
    // is still acting as staff.
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.startsWith('Bearer '))
      ? authHeader.slice(7)
      : (getSessionCookie(req) || getPortalCookie(req));

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

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

    // SEC-05: attach a tenant-scoped db handle for messaging (staff and portal patients
    // both key off users.id — patients.id = users.id — so their practice resolves the
    // tenant schema). Defensive: only set req.db when a real tenant resolves, else
    // handlers fall back to the default pool.
    try {
      const t = actor.schemaName
        ? { tenantId: actor.tenantId, schemaName: actor.schemaName, practiceId: null }
        : await resolveTenantForUser(pool, actor.id);
      if (t && t.tenantId) {
        req.tenant = { practiceId: t.practiceId, tenantId: t.tenantId, schemaName: t.schemaName || 'public' };
        req.db = makeTenantDb(pool, req.tenant.schemaName, req.res);
      }
    } catch (e) {
      console.warn('[messagingAuth] tenant resolution unavailable, using default pool:', e.message);
    }

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

module.exports = { resolveActor, requireStaffActor, resolvePatientActor };
