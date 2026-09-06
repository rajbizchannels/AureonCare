// Staff invites — how a colleague joins an existing practice.
//
// This closes the gap where an OAuth-created account was never bound to a practice: such
// a user had practice_id NULL, resolved to the `public` schema (which holds no tenant
// tables after the SEC-05 cutover) and hit fail-closed guards everywhere. The invite
// carries the practice, so accepting it — by password OR by Google/Microsoft — creates the
// user with practice_id already set.
//
// Only the SHA-256 of the token is stored, so a database leak yields no usable invites.

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { authenticate, authorize } = require('../middleware/auth');
const { storeFor } = require('../middleware/rateLimitStore');
const { validatePassword, BCRYPT_COST } = require('../utils/passwordPolicy');
const { sendEmail, buildEmailHtml } = require('../services/notificationService');

const router = express.Router();

/**
 * Mail the invite to the person being invited.
 *
 * The link is the whole message — it carries the one-time token, and the token exists
 * nowhere else, so this mail cannot be regenerated later. That is why the caller reports
 * the send result to the admin instead of assuming it worked: a silently dropped invite
 * means a colleague who is simply never onboarded, with nothing on screen to say so.
 */
async function sendInviteEmail({ to, practiceName, inviterName, role, inviteUrl, expiresAt }) {
  const product = process.env.AC_CLN || 'AureonCare';
  const html = buildEmailHtml(
    `You have been invited to ${practiceName}`,
    '#2563eb',
    'Hello,',
    `${inviterName || 'An administrator'} has invited you to join <strong>${practiceName}</strong> on ${product}. ` +
      'Use the button below to set up your account — you can finish with a password or with your Google account.',
    [
      ['Practice', practiceName],
      ['Your role', role],
      ['Invited by', inviterName || '—'],
      ['Link expires', expiresAt ? new Date(expiresAt).toUTCString() : '—'],
    ]
      .map(([label, value]) =>
        `<tr><td style="padding:8px 12px;font-weight:bold;color:#555;white-space:nowrap;width:35%">${label}</td>` +
        `<td style="padding:8px 12px;color:#333">${value}</td></tr>`)
      .join(''),
    `<a href="${inviteUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;` +
      `border-radius:6px;text-decoration:none;font-weight:bold">Accept the invitation</a>` +
      `<br><br><span style="color:#666;font-size:13px">If the button does not work, paste this into your browser:<br>` +
      `${inviteUrl}</span><br><br><span style="color:#666;font-size:13px">If you were not expecting this, ignore ` +
      `this email — the invitation expires on its own and no account is created until it is used.</span>`
  );
  return sendEmail(to, `You have been invited to join ${practiceName} on ${product}`, html);
}

const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

const acceptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
  store: storeFor('invite-accept'),
});

/**
 * Look up a usable invite by its raw token. Returns null for anything not currently
 * redeemable — unknown, revoked, already accepted, or expired — so callers cannot tell
 * those cases apart.
 */
async function findUsableInvite(pool, token) {
  if (!token || typeof token !== 'string') return null;
  const { rows } = await pool.query(
    `SELECT i.*, p.name AS practice_name
       FROM public.staff_invites i
       JOIN public.practices p ON p.id = i.practice_id
      WHERE i.token_hash = $1 AND i.status = 'pending' AND i.expires_at > now()`,
    [hashToken(token)]
  );
  return rows[0] || null;
}

/** Mark an invite accepted, but only if it is still pending — one redemption, ever. */
async function claimInvite(client, inviteId, userId) {
  const { rowCount } = await client.query(
    `UPDATE public.staff_invites
        SET status='accepted', accepted_by=$2, accepted_at=now()
      WHERE id=$1 AND status='pending' AND expires_at > now()`,
    [inviteId, userId]
  );
  return rowCount === 1;
}

// ── Admin: create and manage invites ─────────────────────────────────────────

router.post('/', authenticate, authorize('admin'), async (req, res) => {
  const pool = req.app.locals.pool;
  const { email, role } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: 'A valid email address is required' });
  }
  // An admin with no practice cannot bind anyone to one — fail closed rather than minting
  // an invite that would create another unbound user.
  if (!req.user.practiceId) {
    return res.status(403).json({ error: 'Your account is not linked to a practice.' });
  }
  const inviteRole = ['admin', 'doctor', 'staff', 'nurse'].includes(role) ? role : 'staff';

  try {
    const dup = await pool.query('SELECT 1 FROM public.users WHERE LOWER(email) = $1', [cleanEmail]);
    if (dup.rows.length) {
      return res.status(409).json({ error: 'A user with that email already exists.' });
    }

    // Supersede any outstanding invite for the same address at this practice.
    await pool.query(
      `UPDATE public.staff_invites SET status='revoked'
        WHERE LOWER(email)=$1 AND practice_id=$2 AND status='pending'`,
      [cleanEmail, req.user.practiceId]
    );

    const token = crypto.randomBytes(32).toString('base64url');
    const { rows } = await pool.query(
      `INSERT INTO public.staff_invites (token_hash, email, practice_id, role, invited_by)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, email, role, status, expires_at, created_at`,
      [hashToken(token), cleanEmail, req.user.practiceId, inviteRole, req.user.id]
    );

    const base = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/$/, '');
    const inviteUrl = `${base}/accept-invite?token=${token}`;

    const practice = await pool.query('SELECT name FROM public.practices WHERE id = $1', [req.user.practiceId]);
    const delivery = await sendInviteEmail({
      to: cleanEmail,
      practiceName: (practice.rows[0] && practice.rows[0].name) || process.env.AC_CLN || 'AureonCare',
      inviterName: [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email,
      role: inviteRole,
      inviteUrl,
      expiresAt: rows[0].expires_at,
    });

    // The raw token is returned exactly once, here. It is not stored and cannot be
    // recovered — a lost invite must be reissued. The link is still returned even when the
    // mail went out, so an admin can hand it over directly if the invitee never sees it.
    res.status(201).json({
      ...rows[0],
      inviteUrl,
      emailed: delivery.sent,
      emailError: delivery.sent ? undefined : delivery.reason,
      // Shown to the practice admin who created the invite — they are the only person who
      // can act on a mail-server rejection, and without it the failure is undiagnosable
      // from anywhere but the server log.
      emailErrorDetail: delivery.sent ? undefined : delivery.detail,
    });
  } catch (err) {
    console.error('[invites] create error:', err);
    res.status(500).json({ error: 'Failed to create invite' });
  }
});

router.get('/', authenticate, authorize('admin'), async (req, res) => {
  if (!req.user.practiceId) return res.json([]);
  try {
    const { rows } = await req.app.locals.pool.query(
      `SELECT id, email, role, status, expires_at, created_at, accepted_at
         FROM public.staff_invites WHERE practice_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [req.user.practiceId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[invites] list error:', err);
    res.status(500).json({ error: 'Failed to list invites' });
  }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  if (!req.user.practiceId) return res.status(403).json({ error: 'Your account is not linked to a practice.' });
  try {
    // Scoped to the caller's practice: an admin cannot revoke another clinic's invite.
    const { rowCount } = await req.app.locals.pool.query(
      `UPDATE public.staff_invites SET status='revoked'
        WHERE id=$1 AND practice_id=$2 AND status='pending'`,
      [req.params.id, req.user.practiceId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Invite not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[invites] revoke error:', err);
    res.status(500).json({ error: 'Failed to revoke invite' });
  }
});

// ── Public: inspect and accept ───────────────────────────────────────────────

/** What the accept page shows before asking for a password. Deliberately minimal. */
router.get('/lookup/:token', acceptLimiter, async (req, res) => {
  try {
    const invite = await findUsableInvite(req.app.locals.pool, req.params.token);
    if (!invite) return res.status(404).json({ error: 'This invite is no longer valid.' });
    res.json({ email: invite.email, role: invite.role, practiceName: invite.practice_name });
  } catch (err) {
    console.error('[invites] lookup error:', err);
    res.status(500).json({ error: 'Failed to check invite' });
  }
});

/**
 * Accept with a password. The account is created with practice_id from the INVITE, never
 * from anything the client sent.
 */
router.post('/accept', acceptLimiter, async (req, res) => {
  const pool = req.app.locals.pool;
  const { token, password, firstName, lastName } = req.body || {};
  const pw = validatePassword(password);
  if (!pw.valid) return res.status(400).json({ error: pw.message });

  const client = await pool.connect();
  try {
    const invite = await findUsableInvite(pool, token);
    if (!invite) return res.status(404).json({ error: 'This invite is no longer valid.' });

    await client.query('BEGIN');
    const dup = await client.query('SELECT 1 FROM public.users WHERE LOWER(email) = $1', [invite.email]);
    if (dup.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'An account with that email already exists. Please sign in.' });
    }

    const hash = await bcrypt.hash(password, BCRYPT_COST);
    const { rows } = await client.query(
      `INSERT INTO public.users
         (id, email, first_name, last_name, role, status, password_hash, practice_id, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'active', $5, $6, NOW())
       RETURNING id, email, first_name, last_name, role`,
      // users.first_name / last_name are NOT NULL.
      [invite.email, firstName || '', lastName || '', invite.role, hash, invite.practice_id]
    );
    if (!(await claimInvite(client, invite.id, rows[0].id))) {
      // Someone redeemed it between the lookup and here.
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This invite has already been used.' });
    }
    await client.query('COMMIT');
    res.status(201).json({ success: true, user: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[invites] accept error:', err);
    res.status(500).json({ error: 'Failed to accept invite' });
  } finally {
    client.release();
  }
});

module.exports = { router, findUsableInvite, claimInvite, hashToken };
