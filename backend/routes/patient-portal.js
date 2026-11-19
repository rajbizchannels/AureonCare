const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { storeFor } = require('../middleware/rateLimitStore');
const { getTimezoneFromCountry } = require('../utils/timezoneUtils');
const { validateSocialToken } = require('../utils/socialTokenValidator');
const { exchangeAuthCode } = require('../utils/oauthExchange');
const { loadAttachment, recordReferencesAttachment, sendAttachment } = require('../utils/filedDocuments');
const { resolveTenantForUser } = require('../services/tenantCatalog');
const { makeTenantDb } = require('../db/requestTenantDb');
const { withTenant } = require('../db/tenantClient');
const { sendDbError } = require('../utils/dbErrors');
const { checkNewPassword, BCRYPT_COST } = require('../utils/passwordPolicy');
// A real bcrypt hash of a random value, compared against when no account matches so a
// miss costs the same time as a hit (no account enumeration by timing). It was referenced
// below but only ever defined in routes/auth.js, so every portal password login that
// reached it threw ReferenceError and answered 500.
const DUMMY_PASSWORD_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO3z8kU0m9Yb0aH3mHqz9uJm8lTgqQG0K';
const { getPortalCookie, issuePortalCookies, clearPortalCookie } = require('../utils/authCookies');
const {
  tenantForSession, candidateTenantsForEmail, registerSession, forgetSession, registerIdentity,
  defaultTenant, searchOrderForPatient,
} = require('../services/portalRouting');

const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Per-IP limiter: blunt protection against one host hammering the login
// endpoint (credential stuffing across many accounts, DoS). Counts every
// request regardless of outcome.
const loginIpLimiter = rateLimit({
  store: storeFor('portal-ip'),   // SEC-21: shared across instances
  windowMs: LOGIN_WINDOW_MS,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many login attempts from this device. Please try again later.' });
  },
});

// Per-account lockout: counts only FAILED logins (skipSuccessfulRequests),
// keyed by the submitted email, so a single account cannot be brute-forced
// even from a rotating set of IPs. A successful login resets the counter.
// Social logins (no password) bypass this — they can't be brute-forced and
// would otherwise share a single 'unknown'-email bucket.
const loginAccountLimiter = rateLimit({
  store: storeFor('portal-account'),  // SEC-21: shared across instances
  windowMs: LOGIN_WINDOW_MS,
  max: 3,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.body?.email || 'unknown').toLowerCase(),
  skip: (req) => Boolean(req.body?.provider && req.body?.providerId),
  handler: (req, res) => {
    res.status(429).json({ error: 'Account temporarily locked due to too many failed attempts. Please try again in 15 minutes.' });
  },
});

// Session tokens are stored HASHED (SHA-256) in patient_portal_sessions.session_token.
// The raw token is only ever held by the client; a DB leak exposes only hashes,
// which cannot be replayed as bearer tokens. SHA-256 (not bcrypt) is used because
// lookups must be deterministic — we query by the hash — and the token is already
// 256 bits of CSPRNG entropy, so slow hashing buys nothing.
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Verify the portal session token and bind it to the URL :patientId.
// Runs automatically for every route that includes :patientId in its path.
router.param('patientId', async (req, res, next, patientId) => {
  try {
    // SEC-15: a browser presents the session in the HttpOnly ac_portal cookie, which page
    // script cannot read. A Bearer header is still accepted for non-browser clients (it
    // cannot be forged cross-site, so it needs no CSRF token). Header wins, as in
    // middleware/auth.js, so a stale cookie never shadows an explicit token.
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.startsWith('Bearer '))
      ? authHeader.slice(7)
      : getPortalCookie(req);
    if (!token) {
      return res.status(401).json({ error: 'Portal session required' });
    }

    const tokenHash = hashToken(token);
    const basePool = req.app.locals.pool;

    // SEC-05 (Option D): resolve the tenant from the shared routing table FIRST. That
    // table maps a random token hash to a clinic and contains no identifiers, so it can
    // be consulted before any tenant context exists. The session itself is then verified
    // inside that tenant's schema, where patient_portal_sessions actually lives.
    const routed = await tenantForSession(basePool, tokenHash);
    req.tenant = { practiceId: null, tenantId: routed.tenantId, schemaName: routed.schemaName };
    req.db = makeTenantDb(basePool, routed.schemaName, req.res);

    const pool = req.db;
    const result = await pool.query(
      'SELECT patient_id FROM patient_portal_sessions WHERE session_token = $1 AND expires_at > NOW()',
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired portal session' });
    }

    const sessionPatientId = String(result.rows[0].patient_id);
    req.portalPatientId = sessionPatientId;

    if (String(patientId) !== sessionPatientId) {
      return res.status(403).json({ error: 'Access denied: session does not belong to this patient' });
    }

    // Enrich req.tenant with the practice id for downstream entitlement checks. The
    // schema is already settled by the session route above and must NOT be re-derived
    // here — that lookup ran inside the tenant we just routed to.
    try {
      const t = await resolveTenantForUser(basePool, sessionPatientId);
      if (t && t.practiceId) req.tenant.practiceId = t.practiceId;
      // A patient who joined by portal invitation has no users row, so the lookup above
      // finds nothing — take the practice from the tenant the session routed to.
      if (!req.tenant.practiceId && routed.tenantId) {
        const { rows } = await basePool.query('SELECT practice_id FROM control.tenants WHERE id = $1', [routed.tenantId]);
        if (rows[0] && rows[0].practice_id) req.tenant.practiceId = rows[0].practice_id;
      }
    } catch (e) {
      console.warn('[portal] practice lookup unavailable:', e.message);
    }

    next();
  } catch (error) {
    console.error('Portal session validation error:', error);
    res.status(500).json({ error: 'Session validation failed' });
  }
});

// Patient portal login — rate limited per IP and locked out per account
// SEC-20: extracted so the authorization-code exchange can reuse this exact path.
// Every portal protection lives here (SEC-03 provider-token validation, SEC-19
// canonical-id matching, the Option D tenant routing and session creation).
// SEC-20: a provider access token sent FROM THE BROWSER is the weakness itself (any XSS can
// lift a live token). The authorization-code routes redeem the code server-side and then
// call the same handler; they mark the request so it is told apart from a client that
// posted a token. AC_DISABLE_LEGACY_SOCIAL_TOKEN closes the client path, as it does for
// /api/auth/social-login.
const LEGACY_SOCIAL_DISABLED =
  String(process.env.AC_DISABLE_LEGACY_SOCIAL_TOKEN || '').toLowerCase() === 'true';
const LEGACY_RETIRED = {
  error: 'This sign-in method has been retired. Please update the app — sign-in now uses the authorization-code flow.',
};
const SERVER_EXCHANGED = Symbol('serverExchangedToken');

const portalLoginHandler = async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped on /:patientId routes
    const { email, password, provider, providerId, accessToken } = req.body;

    let patient;
    // SEC-05 (Option D): the tenant that authenticated this login. Set by the credential
    // branch below; the session row and its routing entry are written against it.
    let tenantDb = pool;
    let loginTenantId = null;

    // Social login. providerId is no longer required: since SEC-19 the canonical id
    // comes from the provider-verified token, and the authorization-code flow has no
    // client-side id at all.
    if (provider && (providerId || accessToken)) {
      if (LEGACY_SOCIAL_DISABLED && !req[SERVER_EXCHANGED]) {
        return res.status(410).json(LEGACY_RETIRED);
      }
      // SEC-03: validate the access token server-side with the provider before
      // trusting providerId. A providerId is a public identifier, not a secret;
      // without this check anyone could forge a session by supplying a known id.
      if (!accessToken) {
        return res.status(400).json({ error: 'Provider access token is required' });
      }
      let verified;
      try {
        verified = await validateSocialToken(provider, accessToken);
      } catch (validationErr) {
        console.log(`[DEBUG sec03-social] portal social token validation failed: provider=${provider}`);
        return res.status(401).json({ error: 'Social provider token validation failed. Please sign in again.' });
      }
      // Only trust the provider-verified canonical id, never the client-claimed providerId.
      const canonicalProviderId = verified.providerId;
      console.log(`[DEBUG sec03-social] portal social login verified: provider=${provider} canonicalId=${String(canonicalProviderId).slice(0, 8)}…`);

      // SEC-19: match only on the provider-verified canonical id (never the
      // client-supplied providerId). The Microsoft OID-prefix fallback matches
      // not-yet-migrated homeAccountId rows using verified data alone.
      let socialAuth = await pool.query(
        `SELECT user_id FROM social_auth
         WHERE provider = $1
           AND (provider_user_id = $2
                OR ($1 = 'microsoft' AND provider_user_id LIKE $2 || '.%'))`,
        [provider, canonicalProviderId]
      );

      // SEC-19 safe re-link: recover an existing link stored under a non-canonical id
      // (e.g. Microsoft personal-account homeAccountId) using the provider-VERIFIED
      // email only — never client input — then re-key it to the canonical id.
      if (socialAuth.rows.length === 0 && verified.email) {
        // Matched on users (the shared identity table; patients.id = users.id). It joined
        // `patients`, a per-practice table that the shared pool cannot see since the
        // schema-per-tenant cutover, so every not-yet-linked identity answered 500.
        const relink = await pool.query(
          `SELECT sa.id, sa.user_id FROM social_auth sa
           JOIN users u ON u.id = sa.patient_id
           WHERE sa.provider = $1 AND LOWER(u.email) = LOWER($2)`,
          [provider, verified.email]
        );
        if (relink.rows.length > 0) {
          await pool.query(
            'UPDATE social_auth SET provider_user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [canonicalProviderId, relink.rows[0].id]
          );
          socialAuth = { rows: [{ user_id: relink.rows[0].user_id }] };
          console.log('[DEBUG sec19-relink] portal: re-keyed legacy social_auth to canonical id via verified email');
        }
      }

      if (socialAuth.rows.length > 0) {
        const patientId = socialAuth.rows[0].user_id;
        // SEC-05: social_auth is global, but `patients` lives in a tenant schema — so the
        // patient row must be located, not assumed. This previously ran unscoped and so
        // always read the default tenant, meaning a patient at any other clinic could not
        // sign in socially (and, on a single-tenant install, appeared to work by accident).
        //
        // Search the blind-index candidates for the verified email first, then the default
        // tenant, then any remaining active tenant. The id is a primary key in every
        // schema, so each probe is a single index lookup.
        // patientId is passed so the patient's own tenant is resolved directly and tried
        // first. Without it the order ends in an enumeration capped at 100 tenants, and a
        // patient at the 101st practice was never probed at all.
        const order = await searchOrderForPatient(req.app.locals.pool, verified.email, patientId);
        let matchedSchema = null;
        for (const cand of order) {
          try {
            // Probe with withTenant, NOT makeTenantDb: makeTenantDb holds its pooled client
            // until the response ends, so probing N tenants pins N connections and exhausts
            // the pool (max 10) as soon as a deployment has more tenants than that — every
            // social portal login then fails with a connect timeout. withTenant checks a
            // client out and releases it per probe.
            const row = await withTenant(req.app.locals.pool, cand.schemaName, async (c) => {
              const r = await c.query(`
                SELECT p.*, u.language, u.first_name as user_first_name, u.last_name as user_last_name
                FROM patients p
                LEFT JOIN users u ON p.id = u.id
                WHERE p.id = $1 AND p.portal_enabled = true
              `, [patientId]);
              return r.rows[0] || null;
            });
            if (row) {
              patient = row;
              matchedSchema = cand.schemaName;
              loginTenantId = cand.tenantId;
              break;
            }
          } catch (err) {
            // A tenant whose schema is mid-migration must not block a login that belongs
            // to a different tenant.
            console.warn(`[portal] social lookup failed in ${cand.schemaName}:`, err.message);
          }
        }
        // No tenant holds this patient with the portal enabled. Said plainly, because
        // falling through left `patient` undefined and the handler then read .email off
        // it — a TypeError, caught upstairs and answered as a 500. A social login that
        // cannot be placed is a 404, not a server fault, and the difference is what tells
        // an administrator whether to look at the account or at the server.
        if (!matchedSchema) {
          console.warn('[portal] social login: no tenant holds patient', patientId,
            '— link exists but no portal-enabled patient row was found');
          return res.status(404).json({ error: 'Social account not linked to a patient' });
        }
        // Only the winning tenant gets a request-lifetime handle, for the session write.
        tenantDb = makeTenantDb(req.app.locals.pool, matchedSchema, req.res);
      } else {
        return res.status(404).json({ error: 'Social account not linked to a patient' });
      }
    } else {
      // Traditional login
      // Match either address: patients.email is what the portal registers, but a
      // record created through the staff EHR may only carry the email on the
      // linked users row, and the patient signs in with the address they know.
      // SEC-05 (Option D): the email is not stored in the shared routing table in the
      // clear — it is looked up as a keyed hash that yields only candidate TENANTS. The
      // credential is then verified inside each candidate's own schema, so the shared
      // slice never holds a password and never confirms where someone is a patient.
      const candidates = await candidateTenantsForEmail(req.app.locals.pool, email);

      let candidate = null;
      let matchedTenant = null;
      let anyCompareRun = false;

      for (const cand of candidates) {
        const candDb = makeTenantDb(req.app.locals.pool, cand.schemaName, req.res);
        let row;
        try {
          const r = await candDb.query(`
            SELECT p.*, u.language, u.first_name as user_first_name, u.last_name as user_last_name
            FROM patients p
            LEFT JOIN users u ON p.id = u.id
            WHERE (LOWER(p.email) = LOWER($1) OR LOWER(u.email) = LOWER($1))
              AND p.portal_enabled = true
          `, [email]);
          row = r.rows[0];
        } finally {
          candDb.release();
        }

        // SEC-17: run a compare for every candidate, using a dummy hash when the row or
        // its password is absent, so timing does not reveal which clinic (if any) knows
        // this address.
        const hashToCompare = row && row.portal_password_hash ? row.portal_password_hash : DUMMY_PASSWORD_HASH;
        const ok = await bcrypt.compare(password, hashToCompare);
        anyCompareRun = true;

        if (row && row.portal_password_hash && ok) {
          candidate = row;
          matchedTenant = cand;
          break; // first authenticated match wins; a picker would be post-auth UX
        }
      }

      // Guarantee at least one compare even when there were no candidates at all.
      if (!anyCompareRun) await bcrypt.compare(password, DUMMY_PASSWORD_HASH);

      if (!candidate) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      patient = candidate;
      if (matchedTenant) {
        req.tenant = { practiceId: null, tenantId: matchedTenant.tenantId, schemaName: matchedTenant.schemaName };
        tenantDb = makeTenantDb(req.app.locals.pool, matchedTenant.schemaName, req.res);
        loginTenantId = matchedTenant.tenantId;
      }
    }

    // Create session token — return the raw token to the client but persist only
    // its SHA-256 hash, so the DB never holds a replayable credential.
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionTokenHash = hashToken(sessionToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Last-resort fallback. Both login paths now identify their own tenant, so this only
    // fires when the control plane could not answer at all — without a routing entry the
    // next request could not find this session.
    if (!loginTenantId) {
      const d = await defaultTenant(req.app.locals.pool);
      loginTenantId = d.tenantId;
    }

    // Record the identity route so the NEXT login for this address is a single indexed
    // lookup rather than a search. Social logins previously never populated this, which is
    // why they had nothing to route on. Best-effort: registerIdentity swallows its own
    // errors, and a missing route only costs a slower next login.
    await registerIdentity(req.app.locals.pool, patient.email || email, loginTenantId);

    // The session row lives in the tenant that authenticated this login.
    await tenantDb.query(`
      INSERT INTO patient_portal_sessions (patient_id, session_token, ip_address, user_agent, expires_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [patient.id, sessionTokenHash, req.ip, req.get('user-agent'), expiresAt]);

    // SEC-05 (Option D): record token_hash -> tenant in the shared routing table so the
    // next request can find this session before any tenant context exists. The row holds
    // no patient id and no identifier — only a random hash and a clinic.
    await registerSession(req.app.locals.pool, sessionTokenHash, loginTenantId, expiresAt);

    // Return patient data without sensitive info.
    // `role` is stated explicitly: the patients table has no role column, and
    // the frontend keys navigation and access checks off user.role — without it
    // a portal session looks role-less and falls through to the staff shell.
    const { portal_password_hash, ...patientData } = patient;

    // SEC-15: the browser authenticates with this HttpOnly cookie from now on. The token
    // is still in the body for non-browser clients, but the web app no longer stores it.
    const csrfToken = issuePortalCookies(res, sessionToken, { expiresAt });

    res.json({
      message: 'Login successful',
      patient: { ...patientData, role: 'patient' },
      sessionToken,
      csrfToken,
      expiresAt
    });
  } catch (error) {
    console.error('Error in patient portal login:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

router.post('/login', loginIpLimiter, loginAccountLimiter, portalLoginHandler);

// SEC-20: portal authorization-code exchange. The patient's browser receives only a
// single-use code; it is redeemed here with the client secret and the provider token
// never reaches the browser. The request is then handed to portalLoginHandler unchanged,
// so SEC-03 token validation, SEC-19 canonical-id matching and the Option D tenant
// routing all still apply.
router.post('/oauth/:provider/exchange', loginIpLimiter, async (req, res) => {
  const { provider } = req.params;
  try {
    if (provider !== 'google' && provider !== 'microsoft') {
      return res.status(400).json({ error: `Unsupported provider: ${provider}` });
    }
    const { code, redirectUri, codeVerifier } = req.body || {};
    const { accessToken, refreshToken } = await exchangeAuthCode(provider, { code, redirectUri, codeVerifier });

    req.body = { provider, providerId: null, accessToken, refreshToken };
    req[SERVER_EXCHANGED] = true;   // a Symbol: no request body or header can set it
    return portalLoginHandler(req, res);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    console.error(`Error during portal ${provider} code exchange:`, err);
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, err, 'Social login failed')) return;
    res.status(500).json({ error: 'Social login failed' });
  }
});

// Portal access is granted by invitation (routes/portalInvites.js): staff send a one-time
// link and the patient chooses their own password. The old POST /register, where a staff
// member typed in the patient's password, was removed — staff should never know it.

// Get patient appointments
router.get('/:patientId/appointments', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped on /:patientId routes
    const { patientId } = req.params;

    const result = await pool.query(`
      SELECT
        a.*,
        json_build_object(
          'id', u.id,
          'first_name', u.first_name,
          'last_name', u.last_name,
          'specialty', u.specialty
        ) as provider
      FROM appointments a
      LEFT JOIN users u ON a.provider_id = u.id
      WHERE a.patient_id = $1
      ORDER BY a.start_time DESC
    `, [patientId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching patient appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Update patient appointment
router.put('/:patientId/appointments/:appointmentId', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped on /:patientId routes
    const { patientId, appointmentId } = req.params;
    const { startTime, endTime, reason, notes, appointmentType, providerId } = req.body;

    const result = await pool.query(`
      UPDATE appointments
      SET
        start_time = COALESCE($1, start_time),
        end_time = COALESCE($2, end_time),
        reason = COALESCE($3, reason),
        notes = COALESCE($4, notes),
        appointment_type = COALESCE($5, appointment_type),
        provider_id = COALESCE($6, provider_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND patient_id = $8
      RETURNING *
    `, [startTime, endTime, reason, notes, appointmentType, providerId, appointmentId, patientId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating appointment:', error);
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to update appointment')) return;
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// Delete patient appointment
router.delete('/:patientId/appointments/:appointmentId', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped on /:patientId routes
    const { patientId, appointmentId } = req.params;

    const result = await pool.query(
      'DELETE FROM appointments WHERE id = $1 AND patient_id = $2 RETURNING *',
      [appointmentId, patientId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found or not authorized to delete' });
    }

    res.json({ message: 'Appointment deleted successfully', appointment: result.rows[0] });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to delete appointment')) return;
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

// Get patient profile
router.get('/:patientId/profile', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped on /:patientId routes
    const { patientId } = req.params;

    // Join with users table to get language preference, country, and timezone
    // Note: patient.id now directly equals user.id (no separate user_id column)
    const result = await pool.query(`
      SELECT p.*, u.language, u.first_name as user_first_name, u.last_name as user_last_name,
             COALESCE(p.country, u.country) as country,
             COALESCE(p.timezone, u.timezone) as timezone
      FROM patients p
      LEFT JOIN users u ON p.id = u.id
      WHERE p.id = $1
    `, [patientId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const { portal_password_hash, ...patientData } = result.rows[0];
    res.json(patientData);
  } catch (error) {
    console.error('Error fetching patient profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update patient profile
router.put('/:patientId/profile', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped on /:patientId routes
    const { patientId } = req.params;
    const { first_name, last_name, phone, email, address, date_of_birth, emergencyContact, language, country } = req.body;
    // Health details the patient keeps up to date from the portal's profile form.
    const { height, weight, blood_type, allergies, past_history, family_history, current_medications, insurance_payer_id } = req.body;

    // Handle address - it should be plain TEXT, not JSON
    // If address is an object, convert it to a string; otherwise keep it as is
    const addressValue = typeof address === 'object' && address !== null
      ? `${address.street || ''}, ${address.city || ''}, ${address.state || ''} ${address.zip || ''}`.trim()
      : address;

    // Calculate timezone from country if country is provided
    let timezone = null;
    if (country) {
      timezone = getTimezoneFromCountry(country);
    }

    const result = await pool.query(`
      UPDATE patients
      SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        phone = COALESCE($3, phone),
        email = COALESCE($4, email),
        address = COALESCE($5, address),
        date_of_birth = COALESCE($6, date_of_birth),
        emergency_contact = COALESCE($7, emergency_contact),
        country = COALESCE($8, country),
        timezone = COALESCE($9, timezone),
        height = COALESCE($11, height),
        weight = COALESCE($12, weight),
        blood_type = COALESCE($13, blood_type),
        allergies = COALESCE($14, allergies),
        past_history = COALESCE($15, past_history),
        family_history = COALESCE($16, family_history),
        current_medications = COALESCE($17, current_medications),
        insurance_payer_id = COALESCE($18, insurance_payer_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `, [
      first_name,
      last_name,
      phone,
      email,
      addressValue,
      date_of_birth,
      emergencyContact ? JSON.stringify(emergencyContact) : null,
      country,
      timezone,
      patientId,
      height || null, weight || null, blood_type || null, allergies || null, past_history || null,
      family_history || null, current_medications || null, insurance_payer_id || null
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const updatedPatient = result.rows[0];

    // Update the users table since patient.id = user.id (no separate user_id)
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    // Update first_name and last_name if provided
    if (first_name) {
      updateFields.push(`first_name = $${paramIndex++}`);
      updateValues.push(first_name);
    }
    if (last_name) {
      updateFields.push(`last_name = $${paramIndex++}`);
      updateValues.push(last_name);
    }

    // Update language if provided
    if (language) {
      // Convert full language name to code if needed
      const languageMap = {
        'English': 'en',
        'Spanish': 'es',
        'French': 'fr',
        'German': 'de',
        'Arabic': 'ar'
      };
      const languageCode = languageMap[language] || language;
      updateFields.push(`language = $${paramIndex++}`);
      updateValues.push(languageCode);

      // Add language to the response
      updatedPatient.language = language;
    }

    // Update country and timezone if provided
    if (country) {
      updateFields.push(`country = $${paramIndex++}`);
      updateValues.push(country);
      updatedPatient.country = country;
    }
    if (timezone) {
      updateFields.push(`timezone = $${paramIndex++}`);
      updateValues.push(timezone);
      updatedPatient.timezone = timezone;
    }

    // Execute update if there are fields to update
    if (updateFields.length > 0) {
      updateFields.push(`updated_at = NOW()`);
      updateValues.push(patientId); // patient.id = user.id

      await pool.query(
        `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
        updateValues
      );
    }

    const { portal_password_hash, ...patientData } = updatedPatient;
    res.json(patientData);
  } catch (error) {
    console.error('Error updating patient profile:', error);
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to update profile')) return;
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get patient case history/medical records
router.get('/:patientId/medical-records', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped on /:patientId routes
    const { patientId } = req.params;

    const result = await pool.query(`
      SELECT
        mr.*,
        json_build_object(
          'id', u.id,
          'first_name', u.first_name,
          'last_name', u.last_name,
          'specialty', u.specialty
        ) as provider
      FROM medical_records mr
      LEFT JOIN users u ON mr.provider_id = u.id
      WHERE mr.patient_id = $1
      ORDER BY mr.record_date DESC
    `, [patientId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching medical records:', error);
    res.status(500).json({ error: 'Failed to fetch medical records' });
  }
});

/**
 * Documents that arrived through a secure message.
 *
 * A patient signed in with a portal session has no staff JWT, so they cannot
 * reach /medical-records or /form-management. These mirror those routes for
 * the portal, scoped by the :patientId the session is already bound to (see
 * the router.param above), which is the whole authorisation check.
 */
router.get('/:patientId/medical-records/:recordId/attachments/:attachmentId', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped on /:patientId routes
    const { patientId, recordId, attachmentId } = req.params;

    const recordResult = await pool.query(
      'SELECT * FROM medical_records WHERE id = $1 AND patient_id = $2',
      [recordId, patientId]
    );
    if (recordResult.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    if (!recordReferencesAttachment(recordResult.rows[0], attachmentId)) {
      return res.status(404).json({ error: 'Attachment is not part of this record' });
    }

    const attachment = await loadAttachment(pool, attachmentId);
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment no longer available' });
    }
    if (!sendAttachment(res, attachment)) {
      return res.status(500).json({ error: 'Document could not be decrypted' });
    }
  } catch (error) {
    console.error('Error downloading portal document:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

/** Forms Requested, for a portal session. */
router.get('/:patientId/form-requests', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped on /:patientId routes
    const result = await pool.query(
      `SELECT id, template_id, template_name, status, source,
              document_attachment_id, document_name, document_action,
              created_at, submitted_at
         FROM form_submissions
        WHERE patient_id = $1
        ORDER BY created_at DESC`,
      [req.params.patientId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching portal form requests:', error);
    res.status(500).json({ error: 'Failed to load requested forms' });
  }
});

router.get('/:patientId/form-requests/:submissionId/document', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped on /:patientId routes
    const { patientId, submissionId } = req.params;

    const result = await pool.query(
      'SELECT document_attachment_id FROM form_submissions WHERE id = $1 AND patient_id = $2',
      [submissionId, patientId]
    );
    if (result.rows.length === 0 || !result.rows[0].document_attachment_id) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const attachment = await loadAttachment(pool, result.rows[0].document_attachment_id);
    if (!attachment) {
      return res.status(404).json({ error: 'Document no longer available' });
    }
    if (!sendAttachment(res, attachment)) {
      return res.status(500).json({ error: 'Document could not be decrypted' });
    }
  } catch (error) {
    console.error('Error downloading requested document:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

router.post('/:patientId/form-requests/:submissionId/acknowledge', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped on /:patientId routes
    const { patientId, submissionId } = req.params;

    const result = await pool.query(
      `UPDATE form_submissions
          SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP,
              submitted_by = $1, submitted_by_role = 'patient',
              ip_address = $2, user_agent = $3, updated_at = NOW()
        WHERE id = $4 AND patient_id = $1 AND status = 'draft'
          AND document_attachment_id IS NOT NULL
        RETURNING *`,
      [patientId, req.ip, req.get('user-agent'), submissionId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No open document request with that id' });
    }
    res.json({ success: true, submission: result.rows[0] });
  } catch (error) {
    console.error('Error acknowledging requested document:', error);
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to complete request')) return;
    res.status(500).json({ error: 'Failed to complete request' });
  }
});

// Update patient medical record
router.put('/:patientId/medical-records/:recordId', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped on /:patientId routes
    const { patientId, recordId} = req.params;
    const { title, description, providerId } = req.body;

    const result = await pool.query(`
      UPDATE medical_records
      SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        provider_id = COALESCE($3, provider_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND patient_id = $5
      RETURNING *
    `, [title, description, providerId, recordId, patientId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medical record not found or not authorized to update' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating medical record:', error);
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to update medical record')) return;
    res.status(500).json({ error: 'Failed to update medical record' });
  }
});

// Delete patient medical record
router.delete('/:patientId/medical-records/:recordId', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped on /:patientId routes
    const { patientId, recordId } = req.params;
    const fs = require('fs');
    const path = require('path');

    // First get the record to find associated files
    const recordResult = await pool.query(
      'SELECT * FROM medical_records WHERE id = $1 AND patient_id = $2',
      [recordId, patientId]
    );

    if (recordResult.rows.length === 0) {
      return res.status(404).json({ error: 'Medical record not found or not authorized to delete' });
    }

    const record = recordResult.rows[0];

    // Delete associated files if they exist
    if (record.attachments) {
      try {
        const attachments = typeof record.attachments === 'string'
          ? JSON.parse(record.attachments)
          : record.attachments;

        if (Array.isArray(attachments)) {
          attachments.forEach(attachment => {
            // Support new dated path format (attachment.path) and legacy filename-only format
            let filePath;
            if (attachment.path) {
              // attachment.path is a URL path like /uploads/medical-records/2026-03-28/filename.ext
              filePath = path.join(__dirname, '..', attachment.path);
            } else if (attachment.filename) {
              filePath = path.join(__dirname, '../uploads/medical-records', attachment.filename);
            }
            if (filePath && fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log('Deleted file:', filePath);
            }
          });
        }
      } catch (fileError) {
        console.error('Error deleting attached files:', fileError);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete the database record
    const result = await pool.query(
      'DELETE FROM medical_records WHERE id = $1 AND patient_id = $2 RETURNING *',
      [recordId, patientId]
    );

    res.json({ message: 'Medical record deleted successfully', record: result.rows[0] });
  } catch (error) {
    console.error('Error deleting medical record:', error);
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to delete medical record')) return;
    res.status(500).json({ error: 'Failed to delete medical record' });
  }
});

// Link social auth to patient
router.post('/:patientId/link-social', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped on /:patientId routes
    const { patientId } = req.params;
    const { provider, providerId, accessToken, refreshToken, profileData } = req.body;

    // SEC-20: this route only ever takes a token posted by the browser (the portal UI does
    // not call it), so it closes with the other legacy paths.
    if (LEGACY_SOCIAL_DISABLED) {
      return res.status(410).json(LEGACY_RETIRED);
    }

    // SEC-08: validate the token with the provider and store ONLY the verified
    // canonical id, never the client-claimed providerId. (The :patientId param
    // guard already bound this request to the caller's portal session.)
    if (!provider || !accessToken) {
      return res.status(400).json({ error: 'Provider and access token are required' });
    }
    let verified;
    try {
      verified = await validateSocialToken(provider, accessToken);
    } catch (validationErr) {
      console.log(`[DEBUG sec08-link] portal link token validation failed: patient=${patientId} provider=${provider}`);
      return res.status(401).json({ error: 'Social provider token validation failed. Please try again.' });
    }
    const canonicalProviderId = verified.providerId;

    // If this social identity is already linked to a different patient, refuse.
    const existing = await pool.query(
      'SELECT patient_id FROM social_auth WHERE provider = $1 AND provider_user_id = $2',
      [provider, canonicalProviderId]
    );
    if (existing.rows.length > 0 && String(existing.rows[0].patient_id) !== String(patientId)) {
      return res.status(409).json({ error: 'This social account is already linked to another user' });
    }

    // patient.id === user.id in the current schema, so populate both columns.
    const result = await pool.query(`
      INSERT INTO social_auth (
        user_id,
        patient_id,
        provider,
        provider_user_id,
        access_token,
        refresh_token,
        profile_data
      )
      VALUES ($1, $1, $2, $3, $4, $5, $6)
      ON CONFLICT (provider, provider_user_id)
      DO UPDATE SET
        user_id = $1,
        patient_id = $1,
        access_token = $4,
        refresh_token = $5,
        profile_data = $6,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [patientId, provider, canonicalProviderId, accessToken, refreshToken, JSON.stringify(profileData)]);

    res.json({
      message: 'Social account linked successfully',
      socialAuth: result.rows[0]
    });
  } catch (error) {
    console.error('Error linking social auth:', error);
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to link social account')) return;
    res.status(500).json({ error: 'Failed to link social account' });
  }
});

// Who this portal session belongs to (SEC-40). A reloaded portal tab asks the SERVER who is
// signed in instead of trusting what the browser remembered, so the screen can never show
// one patient while the session cookie belongs to another. Reads the same credential the
// :patientId guard reads (Bearer header, else the HttpOnly ac_portal cookie).
router.get('/session', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.slice(7) : getPortalCookie(req);
    if (!token) return res.status(401).json({ error: 'Portal session required' });
    const tokenHash = hashToken(token);
    const basePool = req.app.locals.pool;
    const routed = await tenantForSession(basePool, tokenHash);
    if (!routed || !routed.schemaName || routed.schemaName === 'public') {
      return res.status(401).json({ error: 'Invalid or expired portal session' });
    }
    const patient = await withTenant(basePool, routed.schemaName, async (c) => {
      const { rows } = await c.query(
        `SELECT p.* FROM patient_portal_sessions s JOIN patients p ON p.id = s.patient_id
          WHERE s.session_token = $1 AND s.expires_at > NOW() AND p.portal_enabled = true`, [tokenHash]);
      return rows[0] || null;
    });
    if (!patient) return res.status(401).json({ error: 'Invalid or expired portal session' });
    const { portal_password_hash, ...patientData } = patient;   // eslint-disable-line no-unused-vars
    res.json({ patient: { ...patientData, role: 'patient' } });
  } catch (error) {
    console.error('Portal session lookup error:', error);
    res.status(500).json({ error: 'Could not check the portal session' });
  }
});

// Logout (delete session)
router.post('/logout', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped on /:patientId routes
    // SEC-15: the browser's session is in the cookie; the body token remains for
    // non-browser clients.
    const sessionToken = (req.body && req.body.sessionToken) || getPortalCookie(req);

    // Sessions are stored hashed — hash the presented token to find the row.
    const logoutHash = sessionToken ? hashToken(sessionToken) : null;
    clearPortalCookie(res);

    // SEC-05 (Option D): resolve the tenant from the routing table so the session is
    // deleted from the schema it actually lives in, then drop the routing entry.
    if (logoutHash) {
      const routed = await tenantForSession(req.app.locals.pool, logoutHash);
      const logoutDb = makeTenantDb(req.app.locals.pool, routed.schemaName, req.res);
      try {
        await logoutDb.query('DELETE FROM patient_portal_sessions WHERE session_token = $1', [logoutHash]);
      } finally {
        logoutDb.release();
      }
      await forgetSession(req.app.locals.pool, logoutHash);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error logging out:', error);
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Logout failed')) return;
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ─── Portal data endpoints ───────────────────────────────────────────────────────────
//
// The portal screen used to read these through STAFF routes (/api/appointments,
// /api/medical-records, /api/pharmacies, …). Those require a staff session, so a patient
// got 401/403 everywhere — and the few that once answered (e.g. GET /api/appointments,
// then filtered in the browser) would have handed a patient every appointment in the
// practice. Each endpoint below is bound by router.param to the session's own patient
// and practice schema, and returns only that patient's rows or practice reference data.

const portalCamel = (row) => {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) out[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = v;
  return out;
};
const portalDb = (req) => req.db;

// Diagnoses on the patient's own chart.
router.get('/:patientId/diagnoses', async (req, res) => {
  try {
    const { rows } = await portalDb(req).query(
      `SELECT d.*, prov.first_name || ' ' || prov.last_name AS provider_name
         FROM diagnosis d
         LEFT JOIN providers prov ON d.provider_id = prov.id
        WHERE d.patient_id = $1
        ORDER BY d.diagnosed_date DESC NULLS LAST, d.id DESC`, [req.params.patientId]);
    res.json(rows.map(portalCamel));
  } catch (error) {
    console.error('[portal] diagnoses:', error.message);
    res.status(500).json({ error: 'Failed to load diagnoses' });
  }
});

// Active prescriptions on the patient's own chart.
router.get('/:patientId/prescriptions/active', async (req, res) => {
  try {
    const db = portalDb(req);
    const { rows: cols } = await db.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'prescriptions' AND column_name = 'erx_status'`);
    const erx = cols.length > 0;
    const { rows } = await db.query(
      `SELECT p.*, prov.first_name || ' ' || prov.last_name AS provider_name,
              prov.specialization AS provider_specialization
              ${erx ? ', ph.pharmacy_name' : ''}
         FROM prescriptions p
         LEFT JOIN providers prov ON p.provider_id = prov.id
         ${erx ? 'LEFT JOIN pharmacies ph ON p.pharmacy_id = ph.id' : ''}
        WHERE p.patient_id = $1 AND p.status = 'Active'
          ${erx ? "AND (p.erx_status IS NULL OR p.erx_status NOT IN ('cancelled','rejected'))" : ''}
        ORDER BY p.prescribed_date DESC NULLS LAST`, [req.params.patientId]);
    res.json(rows.map(portalCamel));
  } catch (error) {
    console.error('[portal] prescriptions:', error.message);
    res.status(500).json({ error: 'Failed to load prescriptions' });
  }
});

// Pharmacies the practice works with, and the patient's own preferred one.
router.get('/:patientId/pharmacies', async (req, res) => {
  try {
    const { rows } = await portalDb(req).query(
      `SELECT * FROM pharmacies WHERE is_active = true ORDER BY chain_name, pharmacy_name`);
    res.json(rows.map(portalCamel));
  } catch (error) {
    console.error('[portal] pharmacies:', error.message);
    res.status(500).json({ error: 'Failed to load pharmacies' });
  }
});
router.get('/:patientId/pharmacies/preferred', async (req, res) => {
  try {
    const { rows } = await portalDb(req).query(
      `SELECT ph.*, pp.is_preferred, pp.added_date
         FROM patient_pharmacies pp JOIN pharmacies ph ON pp.pharmacy_id = ph.id
        WHERE pp.patient_id = $1 AND ph.is_active = true
        ORDER BY pp.is_preferred DESC, pp.added_date DESC`, [req.params.patientId]);
    res.json(rows.map(portalCamel));
  } catch (error) {
    console.error('[portal] preferred pharmacies:', error.message);
    res.status(500).json({ error: 'Failed to load preferred pharmacies' });
  }
});
router.post('/:patientId/pharmacies/preferred', async (req, res) => {
  const { pharmacyId, isPreferred } = req.body || {};
  if (!pharmacyId) return res.status(400).json({ error: 'pharmacyId is required' });
  try {
    const out = await withTenant(req.app.locals.pool, req.tenant.schemaName, async (client) => {
      await client.query('BEGIN');
      try {
        const ok = await client.query('SELECT 1 FROM pharmacies WHERE id = $1 AND is_active = true', [pharmacyId]);
        if (!ok.rows.length) { await client.query('ROLLBACK'); return null; }
        if (isPreferred) await client.query('DELETE FROM patient_pharmacies WHERE patient_id = $1', [req.params.patientId]);
        const { rows } = await client.query(
          `INSERT INTO patient_pharmacies (patient_id, pharmacy_id, is_preferred) VALUES ($1,$2,$3)
           ON CONFLICT (patient_id, pharmacy_id) DO UPDATE SET is_preferred = $3, added_date = CURRENT_TIMESTAMP
           RETURNING *`, [req.params.patientId, pharmacyId, Boolean(isPreferred)]);
        await client.query('COMMIT');
        return rows[0];
      } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; }
    });
    if (!out) return res.status(404).json({ error: 'Pharmacy not found' });
    res.status(201).json(portalCamel(out));
  } catch (error) {
    console.error('[portal] add pharmacy:', error.message);
    if (sendDbError(res, error, 'Failed to save pharmacy')) return;
    res.status(500).json({ error: 'Failed to save pharmacy' });
  }
});

// Bookable reference data: the practice's providers (names and speciality only),
// active appointment types, active insurance payers, featured services.
router.get('/:patientId/providers', async (req, res) => {
  try {
    if (!req.tenant.practiceId) return res.json([]);
    const { rows } = await req.app.locals.pool.query(
      `SELECT p.id, p.first_name, p.last_name, p.specialization, p.specialization AS specialty
         FROM providers p JOIN public.users u ON u.id = p.id
        WHERE u.practice_id = $1 AND COALESCE(u.status, 'active') = 'active'
        ORDER BY p.last_name, p.first_name`, [req.tenant.practiceId]);
    res.json(rows);
  } catch (error) {
    console.error('[portal] providers:', error.message);
    res.status(500).json({ error: 'Failed to load providers' });
  }
});
router.get('/:patientId/appointment-types', async (req, res) => {
  try {
    const { rows } = await portalDb(req).query(
      `SELECT * FROM appointment_types WHERE is_active = true ORDER BY display_order ASC, name ASC`);
    res.json(rows.map(portalCamel));
  } catch (error) {
    console.error('[portal] appointment types:', error.message);
    res.status(500).json({ error: 'Failed to load appointment types' });
  }
});
router.get('/:patientId/insurance-payers', async (req, res) => {
  try {
    const { rows } = await portalDb(req).query(
      `SELECT id, name, payer_id, payer_type, is_active FROM insurance_payers WHERE is_active = true ORDER BY name`);
    res.json(rows);
  } catch (error) {
    console.error('[portal] insurance payers:', error.message);
    res.status(500).json({ error: 'Failed to load insurance payers' });
  }
});
router.get('/:patientId/offerings', async (req, res) => {
  try {
    const featuredOnly = String(req.query.featured || '') === 'true';
    const { rows } = await portalDb(req).query(
      `SELECT ho.*, sc.name AS category_name, sc.color AS category_color
         FROM healthcare_offerings ho
         LEFT JOIN service_categories sc ON ho.category_id = sc.id
        WHERE ho.is_active = true ${featuredOnly ? 'AND ho.is_featured = true' : ''}
        ORDER BY ho.is_featured DESC, ho.name`);
    res.json(rows.map(portalCamel));
  } catch (error) {
    console.error('[portal] offerings:', error.message);
    res.status(500).json({ error: 'Failed to load services' });
  }
});

// Book an appointment for THIS patient. patient_id always comes from the session; the
// provider must belong to the practice, and an overlapping booking is refused.
router.post('/:patientId/appointments', async (req, res) => {
  const patientId = req.params.patientId;
  const { provider_id, start_time, end_time, duration_minutes, appointment_type, reason, offering_id } = req.body || {};
  if (!start_time || !end_time) return res.status(400).json({ error: 'start_time and end_time are required' });
  try {
    const db = portalDb(req);
    let providerId = provider_id || null;
    if (providerId) {
      const ok = await req.app.locals.pool.query(
        'SELECT 1 FROM providers p JOIN public.users u ON u.id = p.id WHERE p.id::text = $1::text AND u.practice_id = $2',
        [providerId, req.tenant.practiceId]);
      if (!ok.rows.length) return res.status(400).json({ error: 'That provider is not available at this practice.' });
      const busy = await db.query(
        `SELECT 1 FROM appointments WHERE provider_id::text = $1::text
           AND status NOT IN ('cancelled','canceled','completed') AND start_time < $3 AND end_time > $2 LIMIT 1`,
        [providerId, start_time, end_time]);
      if (busy.rows.length) return res.status(409).json({ error: 'That time is no longer available. Please choose another.', conflictType: 'provider' });
    }
    const mine = await db.query(
      `SELECT 1 FROM appointments WHERE patient_id::text = $1::text
         AND status NOT IN ('cancelled','canceled','completed') AND start_time < $3 AND end_time > $2 LIMIT 1`,
      [patientId, start_time, end_time]);
    if (mine.rows.length) return res.status(409).json({ error: 'You already have an appointment at that time.', conflictType: 'patient' });
    const { rows } = await db.query(
      `INSERT INTO appointments (patient_id, provider_id, practice_id, appointment_type, start_time, end_time,
                                 duration_minutes, reason, status, offering_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'scheduled',$9,NOW(),NOW()) RETURNING *`,
      [patientId, providerId, req.tenant.practiceId, appointment_type || null, start_time, end_time,
       duration_minutes || 30, reason || null, offering_id || null]);
    let appt = rows[0];
    if ((appointment_type || '').toLowerCase() === 'telehealth') {
      try {
        const TelehealthProviderManager = require('../services/telehealthProviders/index');
        const manager = new TelehealthProviderManager(db);
        const active = await manager.getActiveProvider();
        const meeting = active && active.is_enabled
          ? await manager.createMeeting({ topic: 'Telehealth Appointment', startTime: start_time, duration: duration_minutes || 30, recordingEnabled: false })
          : manager.createDefaultMeeting({});
        const url = meeting && (meeting.meetingUrl || meeting.meeting_url);
        if (url) appt = (await db.query('UPDATE appointments SET meeting_url = $1 WHERE id = $2 RETURNING *', [url, appt.id])).rows[0];
      } catch (e) { console.warn('[portal] telehealth link not created:', e.message); }
    }
    res.status(201).json(appt);
  } catch (error) {
    console.error('[portal] book appointment:', error.message);
    if (sendDbError(res, error, 'Failed to book appointment')) return;
    res.status(500).json({ error: 'Failed to book appointment' });
  }
});

// The patient's own waitlist entries.
router.get('/:patientId/waitlist', async (req, res) => {
  try {
    const { rows } = await portalDb(req).query(
      `SELECT w.*, p.first_name AS provider_first_name, p.last_name AS provider_last_name,
              p.specialization AS provider_specialization
         FROM appointment_waitlist w LEFT JOIN providers p ON w.provider_id = p.id
        WHERE w.patient_id = $1 ORDER BY w.preferred_date ASC, w.created_at ASC`, [req.params.patientId]);
    res.json(rows.map(portalCamel));
  } catch (error) {
    console.error('[portal] waitlist:', error.message);
    res.status(500).json({ error: 'Failed to load waitlist' });
  }
});
router.post('/:patientId/waitlist', async (req, res) => {
  const { providerId, preferredDate, preferredTimeStart, preferredTimeEnd, appointmentType, reason } = req.body || {};
  if (!preferredDate) return res.status(400).json({ error: 'Preferred date is required' });
  try {
    const db = portalDb(req);
    const dup = await db.query(
      `SELECT 1 FROM appointment_waitlist WHERE patient_id = $1 AND provider_id IS NOT DISTINCT FROM $2
         AND preferred_date = $3 AND status = 'active'`, [req.params.patientId, providerId || null, preferredDate]);
    if (dup.rows.length) return res.status(400).json({ error: 'Already on waitlist', message: 'You are already on the waitlist for this date and provider' });
    const { rows } = await db.query(
      `INSERT INTO appointment_waitlist (patient_id, provider_id, preferred_date, preferred_time_start, preferred_time_end, appointment_type, reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.patientId, providerId || null, preferredDate, preferredTimeStart || null, preferredTimeEnd || null, appointmentType || null, reason || null]);
    res.status(201).json({ success: true, message: 'Added to waitlist successfully. You will be notified when a slot becomes available.', waitlistEntry: portalCamel(rows[0]) });
  } catch (error) {
    console.error('[portal] add waitlist:', error.message);
    if (sendDbError(res, error, 'Failed to add to waitlist')) return;
    res.status(500).json({ error: 'Failed to add to waitlist' });
  }
});
router.delete('/:patientId/waitlist/:entryId', async (req, res) => {
  try {
    const { rows } = await portalDb(req).query(
      `UPDATE appointment_waitlist SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1 AND patient_id = $2 RETURNING *`, [req.params.entryId, req.params.patientId]);
    if (!rows.length) return res.status(404).json({ error: 'Waitlist entry not found' });
    res.json({ success: true, message: 'Removed from waitlist', waitlistEntry: portalCamel(rows[0]) });
  } catch (error) {
    console.error('[portal] remove waitlist:', error.message);
    res.status(500).json({ error: 'Failed to remove from waitlist' });
  }
});

// Notification channel preferences (email / sms / whatsapp).
router.get('/:patientId/notification-preferences', async (req, res) => {
  try {
    const { rows } = await portalDb(req).query(
      'SELECT * FROM notification_preferences WHERE patient_id = $1', [req.params.patientId]);
    res.json(rows);
  } catch (error) {
    console.error('[portal] notification prefs:', error.message);
    res.status(500).json({ error: 'Failed to load notification preferences' });
  }
});
router.put('/:patientId/notification-preferences', async (req, res) => {
  const { channel_type, is_enabled, contact_info } = req.body || {};
  if (!['email', 'sms', 'whatsapp'].includes(channel_type)) return res.status(400).json({ error: 'channel_type must be email, sms or whatsapp' });
  try {
    const db = portalDb(req);
    const upd = await db.query(
      `UPDATE notification_preferences SET is_enabled = $1, contact_info = $2, updated_at = CURRENT_TIMESTAMP
        WHERE patient_id = $3 AND channel_type = $4 RETURNING *`,
      [Boolean(is_enabled), contact_info || null, req.params.patientId, channel_type]);
    const row = upd.rows[0] || (await db.query(
      `INSERT INTO notification_preferences (patient_id, channel_type, is_enabled, contact_info)
       VALUES ($1,$2,$3,$4) RETURNING *`, [req.params.patientId, channel_type, Boolean(is_enabled), contact_info || null])).rows[0];
    res.json(row);
  } catch (error) {
    console.error('[portal] save notification pref:', error.message);
    if (sendDbError(res, error, 'Failed to save notification preference')) return;
    res.status(500).json({ error: 'Failed to save notification preference' });
  }
});

// Fill in a form the practice asked for. Only the patient's own, and only while it is
// still waiting for them.
router.put('/:patientId/form-requests/:submissionId', async (req, res) => {
  const { form_data } = req.body || {};
  if (!form_data || typeof form_data !== 'object') return res.status(400).json({ error: 'form_data is required' });
  try {
    const { rows } = await portalDb(req).query(
      `UPDATE form_submissions
          SET form_data = $1, status = 'submitted', submitted_at = NOW(), submitted_by_role = 'patient', updated_at = NOW()
        WHERE id = $2 AND patient_id = $3 AND status NOT IN ('submitted','reviewed','approved','completed')
        RETURNING id, status, submitted_at`,
      [JSON.stringify(form_data), req.params.submissionId, req.params.patientId]);
    if (!rows.length) return res.status(404).json({ error: 'This form is not waiting for you.' });
    res.json(rows[0]);
  } catch (error) {
    console.error('[portal] submit form:', error.message);
    if (sendDbError(res, error, 'Failed to submit form')) return;
    res.status(500).json({ error: 'Failed to submit form' });
  }
});

// Change the portal password. Other sessions of this patient are signed out.
router.post('/:patientId/change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  try {
    const db = portalDb(req);
    const { rows } = await db.query('SELECT portal_password_hash FROM patients WHERE id = $1', [req.params.patientId]);
    const hash = rows[0] && rows[0].portal_password_hash;
    if (!hash || !currentPassword || !(await bcrypt.compare(String(currentPassword), hash))) {
      return res.status(400).json({ error: 'Your current password is not correct.' });
    }
    const pw = await checkNewPassword(newPassword);
    if (!pw.valid) return res.status(400).json({ error: pw.message });
    await db.query('UPDATE patients SET portal_password_hash = $1, updated_at = NOW() WHERE id = $2',
      [await bcrypt.hash(String(newPassword), BCRYPT_COST), req.params.patientId]);
    const current = getPortalCookie(req) || ((req.headers.authorization || '').startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    await db.query('DELETE FROM patient_portal_sessions WHERE patient_id = $1 AND session_token <> $2',
      [req.params.patientId, current ? hashToken(current) : '']);
    res.json({ success: true });
  } catch (error) {
    console.error('[portal] change password:', error.message);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
