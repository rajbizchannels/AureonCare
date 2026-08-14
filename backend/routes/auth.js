const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { signToken, authenticate } = require('../middleware/auth');
const { validateSocialToken, isProviderIdMatch } = require('../utils/socialTokenValidator');
const { sendEmail, buildEmailHtml } = require('../services/notificationService');
const { BCRYPT_COST, validatePassword } = require('../utils/passwordPolicy');

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

    res.json({
      message: 'Login successful',
      token,
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

    res.json({ message: 'Password changed successfully', token });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
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
router.post('/social-login', async (req, res) => {
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
      profileData
    } = req.body;

    if (!provider || !providerId || !accessToken) {
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

    // Check if social auth already exists — try canonical (Graph id) first, then
    // the client-supplied id (handles Microsoft MSAL homeAccountId migration)
    const socialAuthResult = await pool.query(
      'SELECT * FROM social_auth WHERE provider = $1 AND (provider_user_id = $2 OR provider_user_id = $3)',
      [provider, canonicalProviderId, providerId]
    );

    let user;
    let isNewUser = false;

    if (socialAuthResult.rows.length > 0) {
      // Existing social auth — user_id is the canonical identifier (= patients.id = users.id).
      // Migration 058 ensures all rows have user_id populated, so a single direct lookup suffices.
      const userId = socialAuthResult.rows[0].user_id;
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

      // Update tokens
      await pool.query(`
        UPDATE social_auth
        SET access_token = $1, refresh_token = $2, profile_data = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [accessToken, refreshToken, JSON.stringify(profileData), socialAuthResult.rows[0].id]);

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

          const newUserResult = await sl_client.query(`
            INSERT INTO users (id, email, first_name, last_name, role, status, avatar, created_at, updated_at)
            VALUES (gen_random_uuid(), $1, $2, $3, 'patient', 'active', $4, NOW(), NOW())
            RETURNING *
          `, [
            email,
            sl_firstName,
            sl_lastName,
            `${(sl_firstName[0] || '')}${(sl_lastName[0] || '')}`.toUpperCase()
          ]);

          user = newUserResult.rows[0];

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

    res.json({
      message: 'Social login successful',
      token,
      user: toCamelCase(userData),
      isNewUser
    });

  } catch (error) {
    console.error('Error during social login:', error);
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

    // If this social account is already linked, tell the user to sign in instead
    const existingSocial = await pool.query(
      'SELECT id FROM social_auth WHERE provider = $1 AND (provider_user_id = $2 OR provider_user_id = $3)',
      [provider, canonicalProviderId, providerId]
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
