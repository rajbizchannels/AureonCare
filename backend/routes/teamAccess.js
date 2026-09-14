// Domain claims and join requests — the self-service half of onboarding.
//
// Three audiences share this file because they share one trust model, and splitting them
// made it easy to check the rule in one place and forget it in another:
//   * practice admins claim and verify domains, and decide on requests;
//   * anyone may ask whether their email domain leads somewhere (no account needed);
//   * a signup at a claimed domain lands here to be bound or queued.

const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { authenticate, authorize } = require('../middleware/auth');
const { storeFor } = require('../middleware/rateLimitStore');
const { validatePassword, BCRYPT_COST } = require('../utils/passwordPolicy');
const { sendEmail, buildEmailHtml } = require('../services/notificationService');
const {
  domainOf, isClaimable, newToken, checkDnsToken, resolveDomainClaim, TXT_PREFIX,
} = require('../services/domainJoin');

const router = express.Router();

const joinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
  store: storeFor('domain-join'),
});

/** An admin with no practice cannot claim a domain for one. Fail closed. */
const requirePractice = (req, res, next) => {
  if (!req.user.practiceId) {
    return res.status(403).json({ error: 'Your account is not linked to a practice.' });
  }
  next();
};

// ── Practice admin: claim, verify and manage domains ─────────────────────────

router.get('/domains', authenticate, authorize('admin'), requirePractice, async (req, res) => {
  try {
    const { rows } = await req.app.locals.pool.query(
      `SELECT id, domain, verification_token, verified_at, join_policy, default_role, created_at
         FROM public.practice_domains WHERE practice_id = $1 ORDER BY created_at DESC`,
      [req.user.practiceId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[teamAccess] list domains error:', err);
    res.status(500).json({ error: 'Failed to list domains' });
  }
});

router.post('/domains', authenticate, authorize('admin'), requirePractice, async (req, res) => {
  const check = isClaimable((req.body || {}).domain);
  if (!check.ok) return res.status(400).json({ error: check.reason });

  const role = ['staff', 'nurse', 'doctor'].includes((req.body || {}).defaultRole)
    ? req.body.defaultRole : 'staff';
  const policy = ['auto_request', 'auto_join', 'disabled'].includes((req.body || {}).joinPolicy)
    ? req.body.joinPolicy : 'auto_request';

  try {
    const { rows } = await req.app.locals.pool.query(
      `INSERT INTO public.practice_domains
         (practice_id, domain, verification_token, join_policy, default_role, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, domain, verification_token, verified_at, join_policy, default_role, created_at`,
      [req.user.practiceId, check.domain, newToken(), policy, role, req.user.id]
    );
    res.status(201).json({
      ...rows[0],
      instructions: `Publish a TXT record with this exact value at ${check.domain} `
        + `(or at _aureoncare.${check.domain}), then verify.`,
    });
  } catch (err) {
    if (err.code === '23505') {
      // Deliberately vague about who holds it: whether a competitor uses this platform is
      // not something an unrelated practice should be able to probe.
      return res.status(409).json({ error: 'That domain has already been claimed.' });
    }
    console.error('[teamAccess] claim domain error:', err);
    res.status(500).json({ error: 'Failed to claim domain' });
  }
});

router.post('/domains/:id/verify', authenticate, authorize('admin'), requirePractice, async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    // Scoped to the caller's practice: an admin cannot verify another practice's claim.
    const { rows } = await pool.query(
      'SELECT id, domain, verification_token FROM public.practice_domains WHERE id = $1 AND practice_id = $2',
      [req.params.id, req.user.practiceId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Domain claim not found' });

    const result = await checkDnsToken(rows[0].domain, rows[0].verification_token);
    if (!result.verified) {
      return res.status(400).json({
        error: 'The TXT record was not found yet.',
        expected: rows[0].verification_token,
        detail: result.detail,
        hint: 'DNS changes can take a while to propagate. Publish the record, then try again.',
      });
    }
    const { rows: updated } = await pool.query(
      `UPDATE public.practice_domains SET verified_at = now()
        WHERE id = $1 AND practice_id = $2
        RETURNING id, domain, verified_at, join_policy, default_role`,
      [req.params.id, req.user.practiceId]
    );
    res.json({ ...updated[0], foundAt: result.foundAt });
  } catch (err) {
    console.error('[teamAccess] verify domain error:', err);
    res.status(500).json({ error: 'Failed to verify domain' });
  }
});

router.patch('/domains/:id', authenticate, authorize('admin'), requirePractice, async (req, res) => {
  const { joinPolicy, defaultRole } = req.body || {};
  if (joinPolicy && !['auto_request', 'auto_join', 'disabled'].includes(joinPolicy)) {
    return res.status(400).json({ error: 'Unknown join policy' });
  }
  if (defaultRole && !['staff', 'nurse', 'doctor'].includes(defaultRole)) {
    return res.status(400).json({ error: 'Unknown role' });
  }
  try {
    const { rows } = await req.app.locals.pool.query(
      `UPDATE public.practice_domains
          SET join_policy  = COALESCE($3, join_policy),
              default_role = COALESCE($4, default_role)
        WHERE id = $1 AND practice_id = $2
        RETURNING id, domain, verified_at, join_policy, default_role`,
      [req.params.id, req.user.practiceId, joinPolicy || null, defaultRole || null]
    );
    if (!rows.length) return res.status(404).json({ error: 'Domain claim not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[teamAccess] update domain error:', err);
    res.status(500).json({ error: 'Failed to update domain' });
  }
});

router.delete('/domains/:id', authenticate, authorize('admin'), requirePractice, async (req, res) => {
  try {
    const { rowCount } = await req.app.locals.pool.query(
      'DELETE FROM public.practice_domains WHERE id = $1 AND practice_id = $2',
      [req.params.id, req.user.practiceId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Domain claim not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[teamAccess] delete domain error:', err);
    res.status(500).json({ error: 'Failed to remove domain' });
  }
});

// ── Practice admin: security policy ──────────────────────────────────────────

router.get('/security-policy', authenticate, authorize('admin'), requirePractice, async (req, res) => {
  try {
    const { rows } = await req.app.locals.pool.query(
      `SELECT session_idle_minutes, require_mfa,
              (SELECT COUNT(*) FROM public.users
                WHERE practice_id = $1 AND status = 'active' AND mfa_enabled = false) AS without_mfa,
              (SELECT COUNT(*) FROM public.users
                WHERE practice_id = $1 AND status = 'active') AS total_staff
         FROM public.practices WHERE id = $1`,
      [req.user.practiceId]
    );
    const r = rows[0] || {};
    res.json({
      sessionIdleMinutes: r.session_idle_minutes || null,
      requireMfa: Boolean(r.require_mfa),
      staffWithoutMfa: Number(r.without_mfa || 0),
      totalStaff: Number(r.total_staff || 0),
    });
  } catch (err) {
    console.error('[teamAccess] read security policy error:', err);
    res.status(500).json({ error: 'Failed to read the security policy' });
  }
});

router.patch('/security-policy', authenticate, authorize('admin'), requirePractice, async (req, res) => {
  const { sessionIdleMinutes, requireMfa } = req.body || {};

  // null is a legitimate value — it means "no idle limit" — so it has to be told apart
  // from "field not supplied", which means "leave it alone".
  let idle;
  if (sessionIdleMinutes !== undefined) {
    if (sessionIdleMinutes === null || sessionIdleMinutes === '') {
      idle = null;
    } else {
      const n = Number(sessionIdleMinutes);
      if (!Number.isInteger(n) || n < 5 || n > 1440) {
        return res.status(400).json({ error: 'The idle timeout must be between 5 and 1440 minutes.' });
      }
      idle = n;
    }
  }

  try {
    // Turning the requirement on while an admin has no second factor would lock the person
    // enabling it out of their own practice at the next sign-in. Refuse, and say who is
    // missing one — this is the mistake most likely to need an operator to undo.
    if (requireMfa === true) {
      const { rows } = await req.app.locals.pool.query(
        `SELECT email FROM public.users
          WHERE practice_id = $1 AND role = 'admin' AND status = 'active' AND mfa_enabled = false`,
        [req.user.practiceId]
      );
      if (rows.length) {
        return res.status(409).json({
          error: 'Set up two-factor authentication on every administrator account first, '
            + 'otherwise this would lock them out.',
          administratorsWithout: rows.map((r) => r.email),
        });
      }
    }

    const { rows } = await req.app.locals.pool.query(
      `UPDATE public.practices
          SET session_idle_minutes = CASE WHEN $2::boolean THEN $3::integer ELSE session_idle_minutes END,
              require_mfa          = COALESCE($4, require_mfa)
        WHERE id = $1
        RETURNING session_idle_minutes, require_mfa`,
      [req.user.practiceId, sessionIdleMinutes !== undefined, idle ?? null,
       typeof requireMfa === 'boolean' ? requireMfa : null]
    );
    res.json({
      sessionIdleMinutes: rows[0].session_idle_minutes || null,
      requireMfa: Boolean(rows[0].require_mfa),
    });
  } catch (err) {
    console.error('[teamAccess] update security policy error:', err);
    res.status(500).json({ error: 'Failed to update the security policy' });
  }
});

// ── Public: where does my email lead? ────────────────────────────────────────

/**
 * Tell a prospective joiner what will happen, before they fill anything in.
 *
 * Returns only the practice NAME for a verified, enabled claim — never its id, and nothing
 * at all for an unclaimed domain. That is enough to say "you'll be joining X", and not
 * enough to enumerate customers of the platform.
 */
router.get('/lookup', joinLimiter, async (req, res) => {
  try {
    const claim = await resolveDomainClaim(req.app.locals.pool, req.query.email);
    if (!claim) return res.json({ found: false });
    res.json({
      found: true,
      practiceName: claim.practice_name,
      requiresApproval: claim.join_policy === 'auto_request',
    });
  } catch (err) {
    console.error('[teamAccess] lookup error:', err);
    res.status(500).json({ error: 'Failed to check that address' });
  }
});

/**
 * Sign up against a claimed domain.
 *
 * The practice comes from the DOMAIN CLAIM, never from the request body — a client that
 * could name its own practice_id would make every claim meaningless.
 */
router.post('/join', joinLimiter, async (req, res) => {
  const pool = req.app.locals.pool;
  const { email, password, firstName, lastName } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();

  if (!domainOf(cleanEmail)) {
    return res.status(400).json({ error: 'A valid email address is required' });
  }
  const pw = validatePassword(password);
  if (!pw.valid) return res.status(400).json({ error: pw.message });

  const client = await pool.connect();
  try {
    const claim = await resolveDomainClaim(pool, cleanEmail);
    if (!claim) {
      // Same answer whether the domain is unclaimed or merely unverified: the difference
      // would let anyone probe which domains are registered here.
      return res.status(404).json({
        error: 'No practice accepts self-service signup for that email domain. '
          + 'Ask an administrator to send you an invitation.',
      });
    }

    await client.query('BEGIN');
    const dup = await client.query('SELECT 1 FROM public.users WHERE LOWER(email) = $1', [cleanEmail]);
    if (dup.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'An account with that email already exists. Please sign in.' });
    }

    const autoJoin = claim.join_policy === 'auto_join';
    const hash = await bcrypt.hash(password, BCRYPT_COST);

    // auto_join binds immediately; auto_request creates the account in 'pending', which the
    // login route already refuses with a clear message. Either way practice_id comes from
    // the claim. A pending account deliberately still carries practice_id: it is what the
    // approval flips to active, and it keeps the person out of the unbound state that
    // resolves to an empty public schema.
    const { rows: created } = await client.query(
      `INSERT INTO public.users
         (id, email, first_name, last_name, role, status, password_hash, practice_id, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id, email, first_name, last_name, role, status`,
      [cleanEmail, firstName || '', lastName || '', claim.default_role,
       autoJoin ? 'active' : 'pending', hash, claim.practice_id]
    );

    if (!autoJoin) {
      await client.query(
        `INSERT INTO public.join_requests
           (practice_id, user_id, email, requested_role, email_verified_via)
         VALUES ($1,$2,$3,$4,$5)`,
        [claim.practice_id, created[0].id, cleanEmail, claim.default_role, 'password_signup']
      );
    }
    await client.query('COMMIT');

    notifyAdminsOfRequest(pool, claim, created[0]).catch(() => { /* never block a signup */ });

    res.status(201).json({
      status: autoJoin ? 'active' : 'pending',
      practiceName: claim.practice_name,
      message: autoJoin
        ? `Your account is ready. You can sign in to ${claim.practice_name} now.`
        : `Your request to join ${claim.practice_name} has been sent to an administrator. `
          + 'You will be able to sign in once it is approved.',
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[teamAccess] join error:', err);
    res.status(500).json({ error: 'Could not complete signup' });
  } finally {
    client.release();
  }
});

/** Let the admins know somebody is waiting. Never allowed to fail the signup. */
async function notifyAdminsOfRequest(pool, claim, user) {
  const { rows: admins } = await pool.query(
    `SELECT email FROM public.users
      WHERE practice_id = $1 AND role = 'admin' AND status = 'active'`,
    [claim.practice_id]
  );
  if (!admins.length) return;
  const html = buildEmailHtml(
    'Someone has asked to join your practice',
    '#2563eb',
    'Hello,',
    `<strong>${user.email}</strong> signed up using your verified domain `
      + `<strong>${claim.domain}</strong> and is waiting for approval. They cannot sign in until `
      + 'an administrator approves the request.',
    [['Name', `${user.first_name} ${user.last_name}`.trim() || '—'],
     ['Email', user.email],
     ['Requested role', user.role]]
      .map(([k, v]) => `<tr><td style="padding:8px 12px;font-weight:bold;color:#555">${k}</td>`
        + `<td style="padding:8px 12px;color:#333">${v}</td></tr>`).join(''),
    'Review it under Settings → Team access.'
  );
  for (const a of admins) {
    await sendEmail(a.email, `Join request for ${claim.practice_name}`, html);
  }
}

// ── Practice admin: decide on requests ───────────────────────────────────────

router.get('/requests', authenticate, authorize('admin'), requirePractice, async (req, res) => {
  try {
    const { rows } = await req.app.locals.pool.query(
      `SELECT r.id, r.email, r.requested_role, r.status, r.created_at, r.decided_at,
              r.email_verified_via, u.first_name, u.last_name
         FROM public.join_requests r
         JOIN public.users u ON u.id = r.user_id
        WHERE r.practice_id = $1
        ORDER BY (r.status = 'pending') DESC, r.created_at DESC
        LIMIT 200`,
      [req.user.practiceId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[teamAccess] list requests error:', err);
    res.status(500).json({ error: 'Failed to list join requests' });
  }
});

router.post('/requests/:id/:decision', authenticate, authorize('admin'), requirePractice, async (req, res) => {
  const decision = req.params.decision;
  if (!['approve', 'reject'].includes(decision)) {
    return res.status(400).json({ error: 'Unknown decision' });
  }
  const pool = req.app.locals.pool;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Scoped to the caller's practice AND to a still-pending row, so two admins acting at
    // once cannot both apply a decision.
    const { rows } = await client.query(
      `UPDATE public.join_requests
          SET status = $3, decided_by = $4, decided_at = now(), decision_note = $5
        WHERE id = $1 AND practice_id = $2 AND status = 'pending'
        RETURNING user_id, email, requested_role`,
      [req.params.id, req.user.practiceId, decision === 'approve' ? 'approved' : 'rejected',
       req.user.id, (req.body || {}).note || null]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No pending request with that id' });
    }

    if (decision === 'approve') {
      // Re-assert practice_id from the REQUEST, not from whatever the user row holds now.
      await client.query(
        `UPDATE public.users SET status = 'active', practice_id = $2 WHERE id = $1`,
        [rows[0].user_id, req.user.practiceId]
      );
    } else {
      // A rejected applicant keeps no foothold: the account is blocked rather than left
      // pending, so it cannot be approved later by accident.
      await client.query(`UPDATE public.users SET status = 'blocked' WHERE id = $1`, [rows[0].user_id]);
    }
    await client.query('COMMIT');

    sendEmail(
      rows[0].email,
      decision === 'approve' ? 'Your access has been approved' : 'About your access request',
      buildEmailHtml(
        decision === 'approve' ? 'You can now sign in' : 'Your request was not approved',
        decision === 'approve' ? '#16a34a' : '#6b7280',
        'Hello,',
        decision === 'approve'
          ? 'An administrator approved your request. You can sign in with the password you chose.'
          : 'An administrator reviewed your request and did not approve it. If you think this is '
            + 'a mistake, contact them directly.',
        null, null
      )
    ).catch(() => { /* the decision stands whether or not the mail lands */ });

    res.json({ success: true, decision });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[teamAccess] decide request error:', err);
    res.status(500).json({ error: 'Failed to record the decision' });
  } finally {
    client.release();
  }
});

module.exports = { router, TXT_PREFIX };
