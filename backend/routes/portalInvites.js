// Patient portal invitations — Phase 1 of patient onboarding.
//
// The practice invites a patient it already has on file; the patient opens a one-time link
// and sets a password, or continues with Google/Microsoft, and lands in the portal signed
// in. This is the SimplePractice / Jane model: the practice vouches for the patient, the
// account is tied to the chart that already exists (no duplicate records), and only the
// patient ever chooses their password — staff never see or set it.
//
// Storage, per the schema-per-tenant design:
//   - the invite (who, which chart, used/revoked) lives in the practice's own schema
//     (portal_invites, tenant migration 012);
//   - the shared control plane holds only token-hash -> practice + expiry
//     (control.portal_invite_route, migration 090), so the anonymous link can be routed
//     without a patient identifier ever sitting in a shared table.
// Only the SHA-256 of the token is stored; the raw token exists in the email alone.

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../middleware/auth');
const { storeFor } = require('../middleware/rateLimitStore');
const { checkNewPassword, BCRYPT_COST } = require('../utils/passwordPolicy');
const { sendEmail, buildEmailHtml } = require('../services/notificationService');
const { sendDbError } = require('../utils/dbErrors');
const { withTenant } = require('../db/tenantClient');
const { tenantIdFor } = require('../services/bookingRouting');
const { registerIdentity } = require('../services/portalRouting');
const { issuePortalSessionIn } = require('../services/portalSession');
const { issuePortalCookies } = require('../utils/authCookies');
const { exchangeAuthCode } = require('../utils/oauthExchange');
const { validateSocialToken } = require('../utils/socialTokenValidator');

const router = express.Router();

const INVITE_TTL_DAYS = 14;               // MyChart activation codes and NHS linkage keys: 14 days
const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const escapeHtml = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// j***@example.com — enough for the patient to recognise, not enough to harvest.
const maskEmail = (e) => {
  const [user, domain] = String(e || '').split('@');
  if (!domain) return '';
  return `${user.slice(0, 1)}${'*'.repeat(Math.max(2, Math.min(user.length - 1, 6)))}@${domain}`;
};
const frontendBase = () =>
  (process.env.FRONTEND_URL || process.env.AC_FE_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/$/, '');

// Staff only: a patient never invites anyone, including themselves.
const staffOnly = (req, res, next) => (req.user && req.user.role !== 'patient'
  ? next()
  : res.status(403).json({ error: 'Staff access required' }));

// The public endpoints are guessable-token targets; keep them slow to brute-force.
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
  store: storeFor('portal-invite'),
});

const INVALID = { error: 'This invitation is no longer valid. It may have expired or already been used — ask your practice to send a new one.' };

// ── control-plane route ──────────────────────────────────────────────────────────────
async function routeFor(basePool, tokenHash) {
  const { rows } = await basePool.query(
    'SELECT tenant_id, schema_name FROM control.resolve_portal_invite($1)', [tokenHash]);
  return rows[0] ? { tenantId: rows[0].tenant_id, schemaName: rows[0].schema_name } : null;
}
const forgetRoute = (basePool, tokenHash) =>
  basePool.query('SELECT control.forget_portal_invite($1)', [tokenHash]).catch((e) =>
    console.warn('[portal-invites] could not drop route:', e.message));

async function practiceName(basePool, tenantId) {
  try {
    const { rows } = await basePool.query('SELECT name FROM control.tenants WHERE id = $1', [tenantId]);
    return (rows[0] && rows[0].name) || process.env.AC_CLN || 'your practice';
  } catch { return process.env.AC_CLN || 'your practice'; }
}

async function sendInviteEmail({ to, firstName, practice, url, expiresAt }) {
  const html = buildEmailHtml(
    `Your ${escapeHtml(practice)} patient portal`,
    '#2563eb',
    `Hello ${escapeHtml(firstName) || 'there'},`,
    `<strong>${escapeHtml(practice)}</strong> has invited you to its patient portal, where you can see your ` +
      'appointments, messages and records. Setting up takes a minute: choose a password, or continue with ' +
      'your Google or Microsoft account.',
    `<tr><td style="padding:8px 12px;font-weight:bold;color:#555">Link expires</td>` +
      `<td style="padding:8px 12px;color:#333">${escapeHtml(new Date(expiresAt).toUTCString())}</td></tr>`,
    `<a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;` +
      `border-radius:6px;text-decoration:none;font-weight:bold">Set up my portal</a>` +
      `<br><br><span style="color:#666;font-size:13px">If the button does not work, paste this into your browser:<br>${url}</span>` +
      `<br><br><span style="color:#666;font-size:13px">If you were not expecting this, you can ignore it — ` +
      'the link works once and expires on its own.</span>'
  );
  return sendEmail(to, `Set up your ${practice} patient portal`, html);
}

// ── staff: send (or re-send) an invite ───────────────────────────────────────────────
router.post('/', authenticate, staffOnly, async (req, res) => {
  const db = req.db;
  const basePool = req.app.locals.pool;
  const { patientId } = req.body || {};
  if (!db || !patientId) return res.status(400).json({ error: 'patientId is required' });
  try {
    const tenantId = await tenantIdFor(basePool, req);
    if (!tenantId) return res.status(409).json({ error: 'Your account is not linked to a practice.' });

    // Scoped to the caller's own schema: another practice's patient simply is not found.
    const { rows: [patient] } = await db.query(
      'SELECT id, first_name, email FROM patients WHERE id = $1', [patientId]);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    const email = String(patient.email || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: 'Add an email address to this patient before inviting them to the portal.' });
    }

    // One live invite per patient: re-sending revokes the previous link.
    const { rows: old } = await db.query(
      `UPDATE portal_invites SET revoked_at = now()
        WHERE patient_id = $1 AND used_at IS NULL AND revoked_at IS NULL
        RETURNING token_hash`, [patient.id]);
    for (const o of old) await forgetRoute(basePool, o.token_hash);

    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
    const { rows: [invite] } = await db.query(
      `INSERT INTO portal_invites (patient_id, token_hash, email, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, expires_at, created_at`,
      [patient.id, tokenHash, email, expiresAt, req.user.id]);
    await basePool.query('SELECT control.register_portal_invite($1, $2, $3)', [tokenHash, tenantId, expiresAt]);

    const url = `${frontendBase()}/portal/activate?token=${token}`;
    const delivery = await sendInviteEmail({
      to: email, firstName: patient.first_name, practice: await practiceName(basePool, tenantId), url, expiresAt,
    }).catch((e) => ({ sent: false, reason: e.message }));
    const emailed = Boolean(delivery && delivery.sent);
    await db.query('UPDATE portal_invites SET emailed = $2 WHERE id = $1', [invite.id, emailed]);

    res.status(201).json({
      id: invite.id,
      email,
      expiresAt: invite.expires_at,
      emailed,
      // The link is only handed to staff when the email could not be sent, so they can
      // deliver it another way. Normally it exists in the patient's inbox alone.
      ...(emailed ? {} : { inviteUrl: url, emailError: (delivery && delivery.reason) || 'Email is not configured' }),
    });
  } catch (err) {
    console.error('[portal-invites] create error:', err);
    if (sendDbError(res, err, 'Could not send the invitation')) return;
    res.status(500).json({ error: 'Could not send the invitation' });
  }
});

// ── staff: status of a patient's portal access ───────────────────────────────────────
router.get('/patient/:patientId', authenticate, staffOnly, async (req, res) => {
  const db = req.db;
  if (!db) return res.status(409).json({ error: 'Your account is not linked to a practice.' });
  try {
    const { rows: [patient] } = await db.query(
      'SELECT id, email, portal_enabled FROM patients WHERE id = $1', [req.params.patientId]);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    const { rows: [inv] } = await db.query(
      `SELECT id, email, expires_at, used_at, revoked_at, emailed, created_at
         FROM portal_invites WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 1`, [patient.id]);
    let invite = null;
    if (inv) {
      const status = inv.used_at ? 'accepted' : inv.revoked_at ? 'revoked'
        : new Date(inv.expires_at) <= new Date() ? 'expired' : 'pending';
      invite = { id: inv.id, email: inv.email, status, sentAt: inv.created_at, expiresAt: inv.expires_at,
        acceptedAt: inv.used_at, emailed: inv.emailed };
    }
    res.json({ portalEnabled: Boolean(patient.portal_enabled), hasEmail: Boolean(patient.email), invite });
  } catch (err) {
    console.error('[portal-invites] status error:', err);
    if (sendDbError(res, err, 'Could not load portal status')) return;
    res.status(500).json({ error: 'Could not load portal status' });
  }
});

// ── staff: withdraw a pending invite ─────────────────────────────────────────────────
router.delete('/patient/:patientId', authenticate, staffOnly, async (req, res) => {
  const db = req.db;
  if (!db) return res.status(409).json({ error: 'Your account is not linked to a practice.' });
  try {
    const { rows } = await db.query(
      `UPDATE portal_invites SET revoked_at = now()
        WHERE patient_id = $1 AND used_at IS NULL AND revoked_at IS NULL
        RETURNING token_hash`, [req.params.patientId]);
    for (const r of rows) await forgetRoute(req.app.locals.pool, r.token_hash);
    res.json({ revoked: rows.length });
  } catch (err) {
    console.error('[portal-invites] revoke error:', err);
    if (sendDbError(res, err, 'Could not withdraw the invitation')) return;
    res.status(500).json({ error: 'Could not withdraw the invitation' });
  }
});

// ── public: what the link is for (no account needed) ────────────────────────────────
/** The live invite behind a raw token, with its practice, or null — never says why. */
async function usableInvite(basePool, token) {
  if (!token || typeof token !== 'string' || token.length > 200) return null;
  const tokenHash = hashToken(token);
  const route = await routeFor(basePool, tokenHash);
  if (!route) return null;
  const row = await withTenant(basePool, route.schemaName, async (c) => {
    const { rows } = await c.query(
      `SELECT i.id, i.patient_id, i.email, i.expires_at, p.first_name, p.last_name
         FROM portal_invites i JOIN patients p ON p.id = i.patient_id
        WHERE i.token_hash = $1 AND i.used_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()`,
      [tokenHash]);
    return rows[0] || null;
  });
  return row ? { ...row, tokenHash, route } : null;
}

router.get('/lookup/:token', publicLimiter, async (req, res) => {
  try {
    const inv = await usableInvite(req.app.locals.pool, req.params.token);
    if (!inv) return res.status(404).json(INVALID);
    // Deliberately little: a first name to greet, the practice, a masked address.
    res.json({
      firstName: inv.first_name,
      practiceName: await practiceName(req.app.locals.pool, inv.route.tenantId),
      email: maskEmail(inv.email),
      expiresAt: inv.expires_at,
    });
  } catch (err) {
    console.error('[portal-invites] lookup error:', err);
    res.status(500).json({ error: 'Could not open the invitation' });
  }
});

/**
 * Redeem the invite and enable the portal, inside the practice's schema, in one
 * transaction: the invite is claimed only if still unused, so a link works exactly once
 * even if two tabs submit together. `applyCredential(client, patientId)` sets the password
 * or links the social account. Then the identity is routed for future password logins and
 * a portal session is issued, so the patient lands in the portal signed in.
 */
async function redeem(req, res, inv, applyCredential) {
  const basePool = req.app.locals.pool;
  const claimed = await withTenant(basePool, inv.route.schemaName, async (c) => {
    const { rows } = await c.query(
      `UPDATE portal_invites SET used_at = now()
        WHERE id = $1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
        RETURNING patient_id`, [inv.id]);
    if (!rows[0]) return null;
    await applyCredential(c, rows[0].patient_id);
    await c.query('UPDATE patients SET portal_enabled = true WHERE id = $1', [rows[0].patient_id]);
    const { rows: [patient] } = await c.query('SELECT * FROM patients WHERE id = $1', [rows[0].patient_id]);
    return patient;
  });
  if (!claimed) return res.status(410).json(INVALID);

  await forgetRoute(basePool, inv.tokenHash);
  await registerIdentity(basePool, claimed.email || inv.email, inv.route.tenantId);

  const session = await issuePortalSessionIn(basePool, inv.route, claimed.id,
    { ip: req.ip, userAgent: req.get('user-agent') });
  const csrfToken = session ? issuePortalCookies(res, session.sessionToken, { expiresAt: session.expiresAt }) : undefined;
  const { portal_password_hash, ...patient } = claimed;   // eslint-disable-line no-unused-vars
  res.json({
    message: 'Your patient portal is ready',
    patient: { ...patient, role: 'patient' },
    ...(session ? { sessionToken: session.sessionToken, expiresAt: session.expiresAt, csrfToken } : {}),
  });
}

// ── public: accept with a password ───────────────────────────────────────────────────
router.post('/accept', publicLimiter, async (req, res) => {
  const { token, password } = req.body || {};
  try {
    const pw = await checkNewPassword(password);
    if (!pw.valid) return res.status(400).json({ error: pw.message });
    const inv = await usableInvite(req.app.locals.pool, token);
    if (!inv) return res.status(410).json(INVALID);
    const hash = await bcrypt.hash(password, BCRYPT_COST);
    await redeem(req, res, inv, (c, patientId) =>
      c.query('UPDATE patients SET portal_password_hash = $2 WHERE id = $1', [patientId, hash]));
  } catch (err) {
    console.error('[portal-invites] accept error:', err);
    if (sendDbError(res, err, 'Could not set up the portal')) return;
    res.status(500).json({ error: 'Could not set up the portal' });
  }
});

// ── public: accept with Google / Microsoft (authorization code, SEC-20) ──────────────
router.post('/accept/oauth/:provider', publicLimiter, async (req, res) => {
  const { provider } = req.params;
  if (provider !== 'google' && provider !== 'microsoft') {
    return res.status(400).json({ error: 'Unsupported provider' });
  }
  const { token, code, redirectUri, codeVerifier } = req.body || {};
  const basePool = req.app.locals.pool;
  try {
    const inv = await usableInvite(basePool, token);
    if (!inv) return res.status(410).json(INVALID);

    // The code is redeemed here with the client secret; no provider token reaches the browser.
    const { accessToken } = await exchangeAuthCode(provider, { code, redirectUri, codeVerifier });
    let verified;
    try {
      verified = await validateSocialToken(provider, accessToken);
    } catch {
      return res.status(401).json({ error: 'Could not verify your account with the provider. Please try again.' });
    }
    const canonicalId = verified.providerId;

    // A social account already linked to someone else stays theirs.
    const { rows: linked } = await basePool.query(
      'SELECT patient_id FROM social_auth WHERE provider = $1 AND provider_user_id = $2', [provider, canonicalId]);
    if (linked[0] && String(linked[0].patient_id) !== String(inv.patient_id)) {
      return res.status(409).json({ error: 'That account is already linked to another patient. Use a password instead, or a different account.' });
    }

    // Social sign-in finds the patient through users (patients.id = users.id) and social_auth.
    // A patient added without a portal login has no users row yet; create it, bound to the
    // practice, unless the address already belongs to a different account.
    const { rows: [byId] } = await basePool.query('SELECT id FROM public.users WHERE id = $1', [inv.patient_id]);
    if (!byId) {
      const { rows: [byEmail] } = await basePool.query(
        'SELECT id FROM public.users WHERE LOWER(email) = LOWER($1)', [inv.email]);
      if (byEmail) {
        return res.status(409).json({ error: 'That email address belongs to another account here. Set up the portal with a password instead.' });
      }
      const { rows: [t] } = await basePool.query('SELECT practice_id FROM control.tenants WHERE id = $1', [inv.route.tenantId]);
      await basePool.query(
        `INSERT INTO public.users (id, email, first_name, last_name, role, status, practice_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'patient', 'active', $5, NOW(), NOW())`,
        [inv.patient_id, inv.email.toLowerCase(), inv.first_name || '', inv.last_name || '', t ? t.practice_id : null]);
    }

    await redeem(req, res, inv, async () => {
      await basePool.query(
        `INSERT INTO social_auth (user_id, patient_id, provider, provider_user_id, profile_data, created_at, updated_at)
         VALUES ($1, $1, $2, $3, '{}'::jsonb, NOW(), NOW())
         ON CONFLICT (provider, provider_user_id) DO UPDATE
           SET user_id = $1, patient_id = $1, updated_at = NOW()`,
        [inv.patient_id, provider, canonicalId]);
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    console.error(`[portal-invites] ${provider} accept error:`, err);
    if (sendDbError(res, err, 'Could not set up the portal')) return;
    res.status(500).json({ error: 'Could not set up the portal' });
  }
});

module.exports = router;
