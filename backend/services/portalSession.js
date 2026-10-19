// Issue a patient-portal session for a user who has just authenticated through the
// main login (password or social).
//
// The portal's routes are guarded by router.param('patientId') in routes/patient-portal.js,
// which accepts only a portal session token — a random secret stored as a SHA-256 hash in
// patient_portal_sessions. A staff JWT is not one, so a patient who signed in through the
// main LoginPage reached the portal holding a credential none of its routes accept, and
// every /api/patient-portal/:patientId/* call answered 401.
//
// The portal login mints that session itself. This does the same thing for the main login
// so the two entry points leave the browser in the same state.

const crypto = require('crypto');
const { withTenant } = require('../db/tenantClient');
const { resolveTenantForUser } = require('./tenantCatalog');
const { registerSession, defaultTenant } = require('./portalRouting');

// Matches the portal login's own TTL.
const PORTAL_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Mint a portal session for `user`, or return null when one is not warranted.
 *
 * Returns null — never throws — when the user is not a patient, has no patients row in
 * their tenant, has portal access switched off, or anything goes wrong. Authentication
 * has already succeeded by the time this runs, so a failure here must degrade the portal,
 * never block the sign-in that called it.
 *
 * @param {import('pg').Pool} pool  the shared (non-tenant) pool
 * @param {{id: string, role: string}} user  the freshly authenticated user
 * @param {{ip?: string, userAgent?: string}} meta  request metadata for the audit columns
 * @returns {Promise<{sessionToken: string, expiresAt: Date}|null>}
 */
const issuePortalSession = async (pool, user, meta = {}) => {
  if (!user || user.role !== 'patient' || !user.id) return null;

  try {
    let tenantId = null;
    let schemaName = null;
    try {
      const tenant = await resolveTenantForUser(pool, user.id);
      if (tenant) {
        tenantId = tenant.tenantId;
        schemaName = tenant.schemaName;
      }
    } catch (err) {
      console.warn('[portalSession] tenant lookup failed:', err.message);
    }

    // `public` holds no clinical tables since the SEC-05 cutover, so it is not somewhere
    // patient_portal_sessions can be written — treat it as unresolved.
    if (!schemaName || schemaName === 'public') {
      const fallback = await defaultTenant(pool);
      schemaName = fallback.schemaName;
      tenantId = tenantId || fallback.tenantId;
    }
    if (!tenantId || !schemaName || schemaName === 'public') return null;

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(sessionToken);
    const expiresAt = new Date(Date.now() + PORTAL_SESSION_TTL_MS);

    // portal_enabled is the switch that decides whether this patient may use the portal at
    // all, and the portal login refuses to issue a session without it. Checking it here too
    // keeps the main login from becoming a way around it. patients.id = users.id.
    const inserted = await withTenant(pool, schemaName, async (client) => {
      const { rows } = await client.query(
        'SELECT id FROM patients WHERE id = $1 AND portal_enabled = true',
        [user.id]
      );
      if (rows.length === 0) return false;

      await client.query(
        `INSERT INTO patient_portal_sessions (patient_id, session_token, ip_address, user_agent, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, tokenHash, meta.ip || null, meta.userAgent || null, expiresAt]
      );
      return true;
    });

    if (!inserted) return null;

    // The guard resolves a session's tenant from this shared table before any tenant
    // context exists, so without the entry the token would be unroutable on the next request.
    await registerSession(pool, tokenHash, tenantId, expiresAt);

    return { sessionToken, expiresAt };
  } catch (error) {
    console.warn('[portalSession] could not issue portal session:', error.message);
    return null;
  }
};

module.exports = { issuePortalSession, PORTAL_SESSION_TTL_MS };
