const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { signToken, authenticate } = require('../middleware/auth');
const { validateSocialToken } = require('../utils/socialTokenValidator');
const { sendEmail, buildEmailHtml } = require('../services/notificationService');
const { BCRYPT_COST, validatePassword } = require('../utils/passwordPolicy');
const { issueAuthCookies, clearAuthCookies } = require('../utils/authCookies');
const { exchangeAuthCode } = require('../utils/oauthExchange');
const { findUsableInvite, claimInvite } = require('./invites');

// SEC-17: a fixed dummy bcrypt hash (of a random string) used to run a real compare
// when an account is missing or has no password, so the response time does not reveal
// whether the email exists. Cost factor matches the policy so timing lines up.
const DUMMY_PASSWORD_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO3z8kU0m9Yb0aH3mHqz9uJm8lTgqQG0K';

// Helper function to convert snake_case to camelCase
const toCamelCase = (obj) => {
  const newObj = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    let value = obj[key];

    // Parse JSON fields if they're strings
    if (camelKey === 'preferences' && typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch (e) {
        // If parsing fails, keep as string
      }
    }

    newObj[camelKey] = value;
  }
  return newObj;
};

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const pool = req.app.locals.pool;
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];

    // SEC-17: always run a bcrypt compare — against the real hash when the account
    // exists and has a password, otherwise against a fixed dummy hash — so response
    // timing and the error message are identical whether or not the email is known.
    const hashToCompare = user && user.password_hash ? user.password_hash : DUMMY_PASSWORD_HASH;
    const isMatch = await bcrypt.compare(password, hashToCompare);

    if (!user || !user.password_hash || !isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Only after the credentials are proven correct do we reveal account-state
    // details — so these messages can never be used to enumerate valid accounts.
    if (user.status === 'blocked') {
      return res.status(403).json({ error: 'Your account has been blocked. Please contact an administrator.' });
    }
    if (user.status === 'pending') {
      return res.status(403).json({ error: 'Your account is pending approval. Please wait for an administrator to approve your account.' });
    }

    // Don't send password_hash back to client
    const { password_hash, reset_token, reset_token_expires, ...userData } = user;

    const token = signToken(user);

    // SEC-15: also deliver the session as an HttpOnly cookie so a browser client never
    // has to keep it in JS-readable storage. `token` stays in the body for existing
    // clients; the frontend migrates to the cookie and stops storing it.
    const csrfToken = issueAuthCookies(res, token);

    res.json({
      message: 'Login successful',
      token,
      csrfToken,
      user: toCamelCase(userData)
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Change password — requires a valid JWT; user can only change their own password
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    // userId comes exclusively from the verified JWT — never from the request body
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    // SEC-12: enforce the shared password policy (length + complexity)
    const pwCheck = validatePassword(newPassword);
    if (!pwCheck.valid) {
      return res.status(400).json({ error: pwCheck.message });
    }

    const pool = req.app.locals.pool;

    const userResult = await pool.query(
      'SELECT id, password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    if (user.password_hash) {
      const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
    }

    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_COST);

    // SEC-09: bump token_version so every JWT issued before this change is rejected,
    // then mint a fresh token for the caller's current session so they are not logged
    // out of the tab they just changed their password in. Other sessions are revoked.
    const updateResult = await pool.query(
      'UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = NOW() WHERE id = $2 RETURNING token_version',
      [newPasswordHash, userId]
    );

    // SEC-18: also revoke any active patient-portal sessions for this account.
    await pool.query('DELETE FROM patient_portal_sessions WHERE patient_id = $1', [userId]);

    const token = signToken({
      id: userId,
      role: req.user.role,
      email: req.user.email,
      token_version: updateResult.rows[0].token_version
    });

    const csrfToken = issueAuthCookies(res, token);
    res.json({ message: 'Password changed successfully', token, csrfToken });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// SEC-15: current-user endpoint. The browser no longer persists the user object, so it
// re-fetches identity here after a reload. Returns UI/identity fields only — never the
// clinical record, which the relevant view fetches on its own.
router.get('/me', authenticate, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { rows } = await pool.query(
      `SELECT id, email, first_name, last_name, role, active_role, avatar, phone,
              language, country, timezone, specialty, preferences, status, practice_id
         FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(toCamelCase(rows[0]));
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ error: 'Failed to fetch current user' });
  }
});

/**
 * Why is this account seeing errors everywhere?
 *
 * A staff account is only usable if it resolves to an active tenant schema. When it does
 * not — no practice_id, or a practice with no active row in control.tenants — resolution
 * falls back to `public`, which since the SEC-05 cutover contains none of the clinical
 * tables. Every tenant-scoped route then fails with `relation "..." does not exist` and
 * returns its own 500, so the browser shows a storm of identical errors that say nothing
 * about the cause.
 *
 * This endpoint says the cause out loud. It reports only the caller's own binding — no
 * other tenant is visible through it — and names the concrete repair.
 */
router.get('/tenant-status', authenticate, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { rows } = await pool.query(
      `SELECT u.practice_id,
              p.name  AS practice_name,
              t.id    AS tenant_id,
              t.status AS tenant_status,
              t.schema_name
         FROM public.users u
         LEFT JOIN public.practices  p ON p.id = u.practice_id
         LEFT JOIN control.tenants   t ON t.practice_id = u.practice_id
        WHERE u.id = $1`,
      [req.user.id]
    );
    const r = rows[0] || {};
    const resolved = req.tenant && req.tenant.schemaName;
    const routed = Boolean(resolved && resolved !== 'public');

    // Routing to a non-public schema is not the same as that schema being usable. Reporting
    // only the former gave a clean bill of health to an account that was still 500ing on
    // every read, which is worse than reporting nothing. Actually read from the tables the
    // failing endpoints read, through the caller's own tenant handle, and hand back the
    // database's own error. The list is a fixed allowlist — never anything caller-supplied.
    const PROBES = ['notifications', 'payments', 'tasks', 'audit_logs', 'appointments', 'patients'];
    const probes = {};
    if (routed && req.db) {
      for (const t of PROBES) {
        try {
          await req.db.query(`SELECT 1 FROM ${t} LIMIT 1`);
          probes[t] = 'ok';
        } catch (e) {
          probes[t] = `${e.code || 'error'}: ${String(e.message || '').slice(0, 200)}`;
        }
      }
    }
    const broken = Object.entries(probes).filter(([, v]) => v !== 'ok');
    const healthy = routed && broken.length === 0;

    let problem = null;
    if (routed && broken.length) {
      problem = `Routing is correct — this account resolves to "${resolved}" — but ${broken.length} of `
        + `${PROBES.length} core tables could not be read there. See "probes" for the database's own `
        + 'error on each. A missing relation means that schema was never fully built from the '
        + 'template; a permission error means the app role lacks grants on it.';
    } else if (!routed) {
      if (!r.practice_id) {
        problem = 'This account has no practice_id, so it is not bound to any tenant. Bind it '
          + 'by accepting a staff invite, or set users.practice_id to the practice it belongs to.';
      } else if (!r.tenant_id) {
        problem = `Practice ${r.practice_id} has no row in control.tenants, so it was never `
          + 'provisioned. Provision it (the platform console creates the schema and the control-plane rows).';
      } else if (r.tenant_status !== 'active') {
        problem = `The tenant for this practice exists but its status is "${r.tenant_status}", not "active".`;
      } else if (!r.schema_name) {
        problem = 'The tenant row has no schema_name, so there is no schema to route to.';
      } else {
        problem = 'The tenant looks correct but resolution still fell back to public — check the server log.';
      }
    }

    res.json({
      healthy,
      resolvedSchema: resolved || null,
      practiceId: r.practice_id || null,
      practiceName: r.practice_name || null,
      tenantId: r.tenant_id || null,
      tenantStatus: r.tenant_status || null,
      schemaName: r.schema_name || null,
      probes,
      problem,
    });
  } catch (error) {
    console.error('Error reporting tenant status:', error);
    res.status(500).json({ error: 'Failed to report tenant status' });
  }
});

// Logout — server-side revocation (SEC-16). Bumping token_version invalidates every
// clinician JWT currently held for this account (this device and any other), and we
// clear any portal sessions too. The client still discards its local token, but this
// guarantees a stolen/old token cannot be replayed after logout.
router.post('/logout', authenticate, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user.id;

    await pool.query(
      'UPDATE users SET token_version = token_version + 1, updated_at = NOW() WHERE id = $1',
      [userId]
    );
    await pool.query('DELETE FROM patient_portal_sessions WHERE patient_id = $1', [userId]);

    // SEC-15: drop the browser's session + CSRF cookies as well as revoking server-side.
    clearAuthCookies(res);

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// Forgot password - request reset token
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const pool = req.app.locals.pool;

    // Check if user exists
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      // Don't reveal whether the email exists or not
      return res.json({ message: 'If the email exists, a password reset link has been sent' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour from now

    // Save reset token
    await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2, updated_at = NOW() WHERE email = $3',
      [resetToken, resetTokenExpires, email]
    );

    // SEC-04: deliver the token out-of-band via email (Google SMTP relay) and
    // NEVER return it in the API response. If SMTP is unconfigured the send is a
    // no-op inside sendEmail; we still return the generic message either way so
    // the endpoint never reveals whether the email exists.
    const user = userResult.rows[0];
    const firstName = user.first_name || 'there';
    const frontendBase = (process.env.FRONTEND_URL || '').split(',')[0].trim();
    const resetLink = frontendBase
      ? `${frontendBase}/reset-password?token=${resetToken}`
      : null;
    const html = buildEmailHtml(
      'Password Reset Request',
      '#2563eb',
      `Hi ${firstName},`,
      'We received a request to reset your AureonCare password. Use the reset code below — it expires in 1 hour. If you did not request this, you can safely ignore this email.',
      `<tr><td style="padding:8px 12px;font-weight:bold;color:#555;width:35%">Reset code</td>
        <td style="padding:8px 12px;color:#111;font-family:monospace;font-size:15px;word-break:break-all">${resetToken}</td></tr>`,
      resetLink
        ? `Or click here to reset your password: <a href="${resetLink}">${resetLink}</a>`
        : 'Enter this code in the password reset screen to choose a new password.'
    );
    console.log(`[DEBUG sec04-email] sending reset email to ${email} (token ${resetToken.slice(0, 6)}…)`);
    await sendEmail(email, 'Reset your AureonCare password', html);

    res.json({
      message: 'If the email exists, a password reset link has been sent'
    });
  } catch (error) {
    console.error('Error requesting password reset:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body || {};

    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password are required' });
    }

    // SEC-12: enforce the shared password policy (length + complexity)
    const pwCheck = validatePassword(newPassword);
    if (!pwCheck.valid) {
      return res.status(400).json({ error: pwCheck.message });
    }

    const pool = req.app.locals.pool;

    // Find user with valid reset token
    const userResult = await pool.query(
      'SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [resetToken]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const user = userResult.rows[0];

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_COST);

    // Update password and clear reset token.
    // SEC-18: a reset is a credential-recovery event — assume the old credentials are
    // compromised and revoke every outstanding session. Bumping token_version kills all
    // existing JWTs and we delete the account's portal sessions. The user must sign in
    // fresh, so (unlike change-password) we do NOT reissue a token here.
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL, token_version = token_version + 1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, user.id]
    );
    await pool.query('DELETE FROM patient_portal_sessions WHERE patient_id = $1', [user.id]);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Social login endpoint (Google, Microsoft, Facebook)
// SEC-20: extracted so the authorization-code exchange below can reuse this exact
// logic. All the social-account protections live here (SEC-07 verified-email
// linking, SEC-19 canonical-id matching, blocked/pending checks, cookie issuance),
// so the new flow must not reimplement them.
const socialLoginHandler = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const {
      provider, // 'google', 'microsoft', or 'facebook'
      providerId,
      accessToken,
      refreshToken,
      email: clientEmail,
      firstName: clientFirstName,
      lastName: clientLastName,
      profileData,
      // Optional staff invite. When present and matching the provider-VERIFIED email, the
      // account is created bound to the inviting practice instead of unbound.
      inviteToken
    } = req.body;

    // SEC-19/SEC-20: providerId is no longer required. Since SEC-19 the canonical id
    // comes from the provider-verified token, so a client-supplied id is unused (it is
    // still accepted for backward compatibility). The authorization-code flow has no
    // client-side id at all, which is the point.
    if (!provider || !accessToken) {
      return res.status(400).json({ error: 'Provider, provider ID, and access token are required' });
    }

    // Validate the access token server-side with the provider's identity API.
    // This prevents account takeover by clients that forge providerId/email.
    let verified;
    try {
      verified = await validateSocialToken(provider, accessToken);
    } catch (validationErr) {
      return res.status(401).json({ error: 'Social provider token validation failed. Please sign in again.' });
    }

    // Use provider-verified identity; fall back to client-supplied names if provider omits them.
    // Note: canonicalProviderId always comes from the provider API (never from the client).
    // Microsoft personal accounts use a pairwise MSA id in homeAccountId that differs from
    // Graph's id, so we do not enforce an exact match between claimedId and verifiedId —
    // the token validation itself is the security gate.
    const email = verified.email || clientEmail;
    const firstName = verified.firstName || clientFirstName || '';
    const lastName = verified.lastName || clientLastName || '';
    const canonicalProviderId = verified.providerId;
    // SEC-07: true only when the PROVIDER itself vouches for the email. Used to
    // decide whether this social identity may attach to a pre-existing account.
    const providerEmailVerified = verified.emailVerified === true && Boolean(verified.email);

    if (!email) {
      return res.status(400).json({ error: 'Could not determine email from social provider' });
    }

    // Resolve a staff invite, if one was presented. Two conditions, both required:
    //   * the provider itself vouches for the email (providerEmailVerified), and
    //   * that verified email is the one the invite was issued to.
    // Without the first, anyone could claim an invite by asserting an address; without the
    // second, any valid invite token would bind any Google account to that practice.
    let invite = null;
    if (inviteToken) {
      const candidate = await findUsableInvite(pool, inviteToken);
      if (candidate && providerEmailVerified &&
          candidate.email.toLowerCase() === String(verified.email).toLowerCase()) {
        invite = candidate;
      }
    }

    // SEC-19: match ONLY on the provider-verified canonical id — never the
    // client-supplied providerId, which an attacker could set to a victim's id.
    // For not-yet-migrated Microsoft work/school rows still keyed by the MSAL
    // homeAccountId ("<oid>.<tenantId>"), we additionally match rows whose id begins
    // with the verified OID — still derived solely from verified data. Rows in other
    // legacy formats are recovered by the verified-email re-link just below.
    const socialAuthResult = await pool.query(
      `SELECT * FROM social_auth
       WHERE provider = $1
         AND (provider_user_id = $2
              OR ($1 = 'microsoft' AND provider_user_id LIKE $2 || '.%'))`,
      [provider, canonicalProviderId]
    );

    let socialRows = socialAuthResult.rows;

    // SEC-19 safe re-link: the lookup above intentionally ignores the client-supplied
    // providerId. That can miss a legacy row for an EXISTING user whose provider_user_id
    // was stored in a non-canonical format — notably Microsoft personal (MSA) accounts,
    // whose MSAL homeAccountId is a pairwise id unrelated to the Graph OID. To restore
    // those logins WITHOUT trusting client input, adopt an existing row only when the
    // PROVIDER-VERIFIED email (from the validated token, never the client) matches the
    // account the row is linked to, then re-key it to the canonical id so it self-heals.
    if (socialRows.length === 0 && verified.email) {
      const relink = await pool.query(
        `SELECT sa.* FROM social_auth sa
         JOIN users u ON u.id = sa.user_id
         WHERE sa.provider = $1 AND LOWER(u.email) = LOWER($2)`,
        [provider, verified.email]
      );
      if (relink.rows.length > 0) {
        await pool.query(
          'UPDATE social_auth SET provider_user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [canonicalProviderId, relink.rows[0].id]
        );
        socialRows = relink.rows;
        console.log(`[DEBUG sec19-relink] re-keyed legacy ${provider} social_auth to canonical id via verified email`);
      }
    }

    let user;
    let isNewUser = false;

    if (socialRows.length > 0) {
      // Existing social auth — user_id is the canonical identifier (= patients.id = users.id).
      // Migration 058 ensures all rows have user_id populated, so a single direct lookup suffices.
      const userId = socialRows[0].user_id;
      const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found. Please register a new account.' });
      }

      user = userResult.rows[0];

      // Check if user is blocked
      if (user.status === 'blocked') {
        return res.status(403).json({ error: 'Your account has been blocked. Please contact an administrator.' });
      }

      // Check if user is pending
      if (user.status === 'pending') {
        return res.status(403).json({ error: 'Your account is pending approval. Please wait for an administrator to approve your account.' });
      }

      // An existing but unbound account (created by social signup before invites existed)
      // adopts the practice when it presents a matching invite. Only ever fills a NULL —
      // an invite can never move a user from one practice to another.
      if (invite && !user.practice_id) {
        const bindClient = await pool.connect();
        try {
          await bindClient.query('BEGIN');
          if (await claimInvite(bindClient, invite.id, user.id)) {
            const upd = await bindClient.query(
              `UPDATE users SET practice_id = $2, role = $3, updated_at = NOW()
                WHERE id = $1 AND practice_id IS NULL RETURNING *`,
              [user.id, invite.practice_id, invite.role]
            );
            if (upd.rows[0]) user = upd.rows[0];
          }
          await bindClient.query('COMMIT');
        } catch (bindErr) {
          await bindClient.query('ROLLBACK').catch(() => {});
          console.error('[auth] invite binding failed:', bindErr.message);
        } finally {
          bindClient.release();
        }
      }

      // Update tokens
      await pool.query(`
        UPDATE social_auth
        SET access_token = $1, refresh_token = $2, profile_data = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [accessToken, refreshToken, JSON.stringify(profileData), socialRows[0].id]);

    } else {
      // No existing social auth — check if user exists by email
      const existingUserResult = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );

      if (existingUserResult.rows.length > 0) {
        // SEC-07: a matching-email account may only be auto-linked when the
        // provider verified the email. Otherwise an attacker who sets an
        // unverified provider email to a victim's address could seize their
        // account. Require explicit, authenticated linking instead.
        if (!providerEmailVerified) {
          console.log(`[DEBUG sec07-link] refused auto-link: unverified provider email for ${email} (${provider})`);
          return res.status(409).json({
            error: 'An account with this email already exists. Please sign in with your password, then link your social account from settings.'
          });
        }

        // User exists — link social auth
        user = existingUserResult.rows[0];

        // Check if user is blocked
        if (user.status === 'blocked') {
          return res.status(403).json({ error: 'Your account has been blocked. Please contact an administrator.' });
        }

        // Check if user is pending
        if (user.status === 'pending') {
          return res.status(403).json({ error: 'Your account is pending approval. Please wait for an administrator to approve your account.' });
        }

        await pool.query(`
          INSERT INTO social_auth (user_id, patient_id, provider, provider_user_id, access_token, refresh_token, profile_data)
          VALUES ($1, $1, $2, $3, $4, $5, $6)
        `, [user.id, provider, canonicalProviderId, accessToken, refreshToken, JSON.stringify(profileData)]);

      } else {
        isNewUser = true;
        // Create new active patient user — use a transaction so that a failure in
        // patient/role/social_auth creation does not leave an orphaned users row.
        const sl_client = await pool.connect();
        try {
          await sl_client.query('BEGIN');

          const sl_firstName = firstName || '';
          const sl_lastName = lastName || '';

          // An invite makes this a STAFF signup: the account is created with the inviting
          // practice's id and role. Without one it stays a patient self-registration, as
          // before. practice_id set here is what binds every later request to a tenant —
          // an unbound user resolves to `public`, which holds no tenant tables.
          const newUserResult = await sl_client.query(`
            INSERT INTO users (id, email, first_name, last_name, role, status, avatar, practice_id, created_at, updated_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $5, 'active', $4, $6, NOW(), NOW())
            RETURNING *
          `, [
            email,
            sl_firstName,
            sl_lastName,
            `${(sl_firstName[0] || '')}${(sl_lastName[0] || '')}`.toUpperCase(),
            invite ? invite.role : 'patient',
            invite ? invite.practice_id : null
          ]);

          user = newUserResult.rows[0];

          if (invite) {
            if (!(await claimInvite(sl_client, invite.id, user.id))) {
              throw new Error('This invite has already been used.');
            }
          }

          // Staff do not get a patient chart. Skip straight past patient/role creation —
          // the rest of this block is the patient self-registration path.
          if (!invite) {
          // Create patient record — patients.id = users.id in current schema
          const sl_patientCheck = await sl_client.query(
            'SELECT id FROM patients WHERE id = $1 OR email = $2 LIMIT 1',
            [user.id, user.email]
          );
          if (sl_patientCheck.rows.length === 0) {
            const sl_mrnResult = await sl_client.query(
              "SELECT MAX(CAST(SUBSTRING(mrn FROM 5) AS INTEGER)) as max_mrn FROM patients WHERE mrn LIKE 'MRN-%'"
            );
            const sl_mrn = `MRN-${(sl_mrnResult.rows[0].max_mrn || 1000) + 1}`;
            await sl_client.query(
              `INSERT INTO patients (id, first_name, last_name, mrn, date_of_birth, email, status, created_at, updated_at)
               VALUES ($1, $2, $3, $4, '1990-01-01', $5, 'active', NOW(), NOW())`,
              [user.id, sl_firstName, sl_lastName, sl_mrn, user.email]
            );
          }

          // Assign patient role
          const sl_roleResult = await sl_client.query(
            "SELECT id FROM roles WHERE name = 'patient' AND is_active = true LIMIT 1"
          );
          if (sl_roleResult.rows.length > 0) {
            await sl_client.query(
              `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [user.id, sl_roleResult.rows[0].id]
            );
          }
          } // end patient self-registration path

          // Create social auth entry — set both user_id and patient_id to the same UUID
          // (patients.id = users.id in current schema, so both columns hold user.id)
          await sl_client.query(`
            INSERT INTO social_auth (user_id, patient_id, provider, provider_user_id, access_token, refresh_token, profile_data)
            VALUES ($1, $1, $2, $3, $4, $5, $6)
          `, [user.id, provider, canonicalProviderId, accessToken, refreshToken, JSON.stringify(profileData)]);

          await sl_client.query('COMMIT');
        } catch (txErr) {
          await sl_client.query('ROLLBACK');
          throw txErr;
        } finally {
          sl_client.release();
        }
      }
    }

    // Update last login
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Don't send password_hash back to client
    const { password_hash, ...userData } = user;

    const token = signToken(user);

    const csrfToken = issueAuthCookies(res, token);

    res.json({
      message: 'Social login successful',
      token,
      csrfToken,
      user: toCamelCase(userData),
      isNewUser
    });

  } catch (error) {
    console.error('Error during social login:', error);
    res.status(500).json({ error: 'Social login failed' });
  }
};

// SEC-20: the legacy endpoint still accepts a provider access token minted in the
// browser, which is the vulnerability itself. It stays enabled by default so clients can
// migrate, but setting AC_DISABLE_LEGACY_SOCIAL_TOKEN=true closes it — that flip is what
// actually completes SEC-20 once every client uses /oauth/*/exchange.
const LEGACY_SOCIAL_DISABLED =
  String(process.env.AC_DISABLE_LEGACY_SOCIAL_TOKEN || '').toLowerCase() === 'true';

const legacySocialGuard = (req, res, next) => {
  if (LEGACY_SOCIAL_DISABLED) {
    return res.status(410).json({
      error: 'This sign-in method has been retired. Please update the app — sign-in now uses the authorization-code flow.',
    });
  }
  next();
};

router.post('/social-login', legacySocialGuard, socialLoginHandler);

// SEC-20: authorization-code exchange (server-side).
//
// The implicit flow hands the provider's ACCESS TOKEN to browser JavaScript and the SPA
// then forwards it here as a login credential — so any XSS can lift a live provider
// token. In the authorization-code flow the browser only ever sees a single-use code,
// which is worthless without the client secret held on the server.
//
// The redeemed token never leaves this process: after exchanging, the request is handed
// to socialLoginHandler unchanged, so every existing protection still applies
// (SEC-07 verified-email linking, SEC-19 canonical-id matching, blocked/pending checks).
//
// Requires AC_GG_CID / AC_GG_CSK, and REACT_APP_GG_CID in the SPA MUST be the same client
// id — a code issued to one client cannot be redeemed by another.
// SEC-20 (Microsoft): same server-side exchange. Uses the Azure app registration's Web
// platform secret (AC_MS_CID / AC_MS_CSK). The 'common' authority is used because the
// registration accepts both organizational and personal Microsoft accounts — the Teams
// telehealth integration keeps using the 'organizations' endpoint on the same app, which
// is unaffected.
router.post('/oauth/microsoft/exchange', async (req, res) => {
  try {
    const { code, redirectUri, codeVerifier } = req.body || {};
    const { accessToken, refreshToken } = await exchangeAuthCode('microsoft', { code, redirectUri, codeVerifier });

    // Delegate to the existing social-login path. providerId is intentionally omitted:
    // SEC-19 resolves the canonical id from the provider itself, never from the client.
    // Preserve the invite token: rebuilding req.body wholesale would drop it, and the
    // staff binding would be silently lost on the code-exchange path.
    req.body = { provider: 'microsoft', providerId: null, accessToken, refreshToken, profileData: {}, inviteToken: (req.body || {}).inviteToken };
    return socialLoginHandler(req, res);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    console.error('Error during microsoft code exchange:', err);
    res.status(500).json({ error: 'Social login failed' });
  }
});

router.post('/oauth/google/exchange', async (req, res) => {
  try {
    const { code, redirectUri } = req.body || {};
    const { accessToken, refreshToken } = await exchangeAuthCode('google', { code, redirectUri });

    // Delegate to the existing social-login path. providerId is intentionally omitted:
    // SEC-19 resolves the canonical id from the provider itself, never from the client.
    req.body = { provider: 'google', providerId: null, accessToken, refreshToken, profileData: {}, inviteToken: (req.body || {}).inviteToken };
    return socialLoginHandler(req, res);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    console.error('Error during google code exchange:', err);
    res.status(500).json({ error: 'Social login failed' });
  }
});

// Social registration endpoint (Google, Microsoft)
// Creates a new pending account linked to the social provider.
// Unlike /social-login, this never rejects with 403 for pending status —
// returning 201 + a message is the expected success path.
router.post('/social-register', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const {
      provider,
      providerId,
      accessToken,
      email: clientEmail,
      firstName: clientFirstName,
      lastName: clientLastName,
      profileData
    } = req.body;

    if (!provider || !providerId || !accessToken) {
      return res.status(400).json({ error: 'Provider, provider ID, and access token are required' });
    }

    // Validate the access token server-side before creating any account
    let verified;
    try {
      verified = await validateSocialToken(provider, accessToken);
    } catch (validationErr) {
      return res.status(401).json({ error: 'Social provider token validation failed. Please try again.' });
    }

    // canonicalProviderId comes from the provider API — never from the client.
    // Microsoft personal accounts use a pairwise MSA id in homeAccountId that differs
    // from Graph's id, so we skip the strict claimed/verified match check here.
    // Token validation (above) is the security gate.
    const email = verified.email || clientEmail;
    const firstName = verified.firstName || clientFirstName || '';
    const lastName = verified.lastName || clientLastName || '';
    const canonicalProviderId = verified.providerId;
    // SEC-07: true only when the PROVIDER itself vouches for the email. Used to
    // decide whether this social identity may attach to a pre-existing account.
    const providerEmailVerified = verified.emailVerified === true && Boolean(verified.email);

    if (!email) {
      return res.status(400).json({ error: 'Could not determine email from social provider' });
    }

    // SEC-19: match only on the provider-verified canonical id (plus the verified
    // OID-prefix fallback for un-migrated Microsoft rows). Never the client id.
    const existingSocial = await pool.query(
      `SELECT id FROM social_auth
       WHERE provider = $1
         AND (provider_user_id = $2
              OR ($1 = 'microsoft' AND provider_user_id LIKE $2 || '.%'))`,
      [provider, canonicalProviderId]
    );
    if (existingSocial.rows.length > 0) {
      return res.status(409).json({ error: 'An account already exists for this social profile. Please sign in instead.' });
    }

    // If the email is already registered, tell the user to sign in or link
    const existingEmail = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (existingEmail.rows.length > 0) {
      return res.status(409).json({ error: 'This email is already registered. Please sign in or link your social account from your profile settings.' });
    }

    // Create user + patient + social_auth atomically so no orphaned rows on failure
    const firstName_ = firstName || '';
    const lastName_ = lastName || '';
    const avatarInitials = `${(firstName_[0] || '')}${(lastName_[0] || '')}`.toUpperCase();

    const regClient = await pool.connect();
    let newUser;
    try {
      await regClient.query('BEGIN');

      const newUserResult = await regClient.query(`
        INSERT INTO users (id, email, first_name, last_name, role, status, avatar, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, 'patient', 'active', $4, NOW(), NOW())
        RETURNING id, email, first_name, last_name, role, status
      `, [email, firstName_, lastName_, avatarInitials]);
      newUser = newUserResult.rows[0];

      // Create patient record — patients.id = users.id in current schema
      const patientCheck = await regClient.query(
        'SELECT id FROM patients WHERE id = $1 OR email = $2 LIMIT 1',
        [newUser.id, newUser.email]
      );
      if (patientCheck.rows.length === 0) {
        const mrnResult = await regClient.query(
          "SELECT MAX(CAST(SUBSTRING(mrn FROM 5) AS INTEGER)) as max_mrn FROM patients WHERE mrn LIKE 'MRN-%'"
        );
        const mrn = `MRN-${(mrnResult.rows[0].max_mrn || 1000) + 1}`;
        await regClient.query(
          `INSERT INTO patients (id, first_name, last_name, mrn, date_of_birth, email, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, '1990-01-01', $5, 'active', NOW(), NOW())`,
          [newUser.id, firstName_, lastName_, mrn, newUser.email]
        );
      }

      // Assign patient role
      const patientRoleResult = await regClient.query(
        "SELECT id FROM roles WHERE name = 'patient' AND is_active = true LIMIT 1"
      );
      if (patientRoleResult.rows.length > 0) {
        await regClient.query(
          `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [newUser.id, patientRoleResult.rows[0].id]
        );
      }

      // Link social auth — set both user_id and patient_id to the same UUID
      await regClient.query(`
        INSERT INTO social_auth (user_id, patient_id, provider, provider_user_id, access_token, profile_data)
        VALUES ($1, $1, $2, $3, $4, $5)
      `, [newUser.id, provider, canonicalProviderId, accessToken, JSON.stringify(profileData || {})]);

      await regClient.query('COMMIT');
    } catch (txErr) {
      await regClient.query('ROLLBACK');
      throw txErr;
    } finally {
      regClient.release();
    }

    const token = signToken(newUser);

    res.status(201).json({
      message: 'Registration successful! Your account is ready to use.',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        role: newUser.role,
        status: newUser.status
      }
    });
  } catch (error) {
    console.error('Error during social registration:', error);
    res.status(500).json({
      error: 'Registration failed. Please try again.',
      detail: error.message
    });
  }
});

// Link social account to existing user — requires a valid JWT; can only link to own account
router.post('/link-social-account', authenticate, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    // userId comes from the verified JWT, not the request body
    const userId = req.user.id;
    const { provider, providerId, accessToken, refreshToken, profileData } = req.body;

    if (!provider || !accessToken) {
      return res.status(400).json({ error: 'Provider and access token are required' });
    }

    // SEC-08: validate the access token with the provider and link ONLY the
    // provider-verified canonical id. Previously the client-supplied providerId
    // was stored unverified, letting a user claim someone else's social identity.
    let verified;
    try {
      verified = await validateSocialToken(provider, accessToken);
    } catch (validationErr) {
      console.log(`[DEBUG sec08-link] token validation failed on link for user ${userId} (${provider})`);
      return res.status(401).json({ error: 'Social provider token validation failed. Please try again.' });
    }
    const canonicalProviderId = verified.providerId;

    // Check if this social account is already linked to another user
    const existingSocialAuth = await pool.query(
      'SELECT * FROM social_auth WHERE provider = $1 AND provider_user_id = $2',
      [provider, canonicalProviderId]
    );

    if (existingSocialAuth.rows.length > 0 && String(existingSocialAuth.rows[0].user_id) !== String(userId)) {
      return res.status(409).json({ error: 'This social account is already linked to another user' });
    }

    // Create or update social auth — both user_id and patient_id hold the same UUID
    await pool.query(`
      INSERT INTO social_auth (user_id, patient_id, provider, provider_user_id, access_token, refresh_token, profile_data)
      VALUES ($1, $1, $2, $3, $4, $5, $6)
      ON CONFLICT (provider, provider_user_id)
      DO UPDATE SET
        user_id = $1,
        patient_id = $1,
        access_token = $4,
        refresh_token = $5,
        profile_data = $6,
        updated_at = CURRENT_TIMESTAMP
    `, [userId, provider, canonicalProviderId, accessToken, refreshToken, JSON.stringify(profileData)]);

    res.json({ message: 'Social account linked successfully' });

  } catch (error) {
    console.error('Error linking social account:', error);
    res.status(500).json({ error: 'Failed to link social account' });
  }
});

// Unlink social account — requires a valid JWT; can only unlink own account
router.post('/unlink-social-account', authenticate, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    // userId comes from the verified JWT, not the request body
    const userId = req.user.id;
    const { provider } = req.body;

    if (!provider) {
      return res.status(400).json({ error: 'Provider is required' });
    }

    const result = await pool.query(
      'DELETE FROM social_auth WHERE user_id = $1 AND provider = $2 RETURNING id',
      [userId, provider]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Social account link not found' });
    }

    res.json({ message: 'Social account unlinked successfully' });

  } catch (error) {
    console.error('Error unlinking social account:', error);
    res.status(500).json({ error: 'Failed to unlink social account' });
  }
});

// Get linked social accounts for a user — self or admin only
router.get('/social-accounts/:userId', authenticate, async (req, res) => {
  const { userId } = req.params;
  if (req.user.role !== 'admin' && String(req.user.id) !== String(userId)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(
      'SELECT id, provider, provider_user_id, created_at FROM social_auth WHERE user_id = $1',
      [userId]
    );

    res.json(result.rows);

  } catch (error) {
    console.error('Error fetching social accounts:', error);
    res.status(500).json({ error: 'Failed to fetch social accounts' });
  }
});

module.exports = router;
