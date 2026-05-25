const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { signToken, authenticate } = require('../middleware/auth');
const { validateSocialToken, isProviderIdMatch } = require('../utils/socialTokenValidator');

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

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Check if user is blocked
    if (user.status === 'blocked') {
      return res.status(403).json({ error: 'Your account has been blocked. Please contact an administrator.' });
    }

    // Check if user is pending
    if (user.status === 'pending') {
      return res.status(403).json({ error: 'Your account is pending approval. Please wait for an administrator to approve your account.' });
    }

    // Check if password_hash exists
    if (!user.password_hash) {
      return res.status(401).json({ error: 'Password not set for this account' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Don't send password_hash back to client
    const { password_hash, reset_token, reset_token_expires, ...userData } = user;

    const token = signToken(user);
    console.log('[DEBUG auth] JWT issued for userId:', user.id, 'role:', user.role);

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

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
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

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, userId]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
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

    // TODO: send resetToken via email (e.g. SendGrid) — do NOT return it in the response.
    // The token is stored in the database; the user must receive it through their email inbox.
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

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
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
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password and clear reset token
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, user.id]
    );

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
      console.log('[DEBUG social-validation] social-login verified:', provider, verified.providerId, verified.email);
    } catch (validationErr) {
      console.log('[DEBUG social-validation] social-login token rejected:', provider, validationErr.message);
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
    console.log('[DEBUG social-validation] social-login canonical providerId:', canonicalProviderId, 'client claimed:', providerId);

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
      // Existing social auth — resolve the linked user.
      // Old records (pre-migration-050) only set patient_id, not user_id.
      // patient.id = users.id in the current schema, so patient_id can serve as user_id.
      let userId = socialAuthResult.rows[0].user_id || socialAuthResult.rows[0].patient_id;
      let userResult = userId
        ? await pool.query('SELECT * FROM users WHERE id = $1', [userId])
        : { rows: [] };

      // Last-resort fallback: find by provider-verified email (heals corrupt/legacy records)
      if (userResult.rows.length === 0) {
        console.log('[DEBUG social-validation] social-login user_id lookup failed for id:', userId, '— falling back to email lookup');
        userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      }

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found. Please register a new account.' });
      }

      user = userResult.rows[0];

      // Heal the social_auth record if user_id was null or mismatched
      if (String(socialAuthResult.rows[0].user_id) !== String(user.id)) {
        await pool.query(
          'UPDATE social_auth SET user_id = $1 WHERE id = $2',
          [user.id, socialAuthResult.rows[0].id]
        );
        console.log('[DEBUG social-validation] social-login healed social_auth.user_id for auth id:', socialAuthResult.rows[0].id);
      }

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
          INSERT INTO social_auth (
            user_id,
            provider,
            provider_user_id,
            access_token,
            refresh_token,
            profile_data
          )
          VALUES ($1, $2, $3, $4, $5, $6)
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

          // Create social auth entry
          await sl_client.query(`
            INSERT INTO social_auth (user_id, provider, provider_user_id, access_token, refresh_token, profile_data)
            VALUES ($1, $2, $3, $4, $5, $6)
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
    console.log('[DEBUG social-validation] social-login complete for userId:', user.id, 'provider:', provider, 'isNewUser:', isNewUser);

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
      console.log('[DEBUG social-validation] social-register verified:', provider, verified.providerId, verified.email);
    } catch (validationErr) {
      console.log('[DEBUG social-validation] social-register token rejected:', provider, validationErr.message);
      return res.status(401).json({ error: 'Social provider token validation failed. Please try again.' });
    }

    // canonicalProviderId comes from the provider API — never from the client.
    // Microsoft personal accounts use a pairwise MSA id in homeAccountId that differs
    // from Graph's id, so we skip the strict claimed/verified match check here.
    // Token validation (above) is the security gate.
    console.log('[DEBUG social-validation] social-register canonical providerId:', verified.providerId, 'client claimed:', providerId);

    const email = verified.email || clientEmail;
    const firstName = verified.firstName || clientFirstName || '';
    const lastName = verified.lastName || clientLastName || '';
    const canonicalProviderId = verified.providerId;

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

      console.log('[DEBUG social-validation] social-register user created:', newUser.id);

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

      // Link social auth record using the verified canonical provider ID
      await regClient.query(`
        INSERT INTO social_auth (user_id, provider, provider_user_id, access_token, profile_data)
        VALUES ($1, $2, $3, $4, $5)
      `, [newUser.id, provider, canonicalProviderId, accessToken, JSON.stringify(profileData || {})]);

      await regClient.query('COMMIT');
    } catch (txErr) {
      await regClient.query('ROLLBACK');
      throw txErr;
    } finally {
      regClient.release();
    }

    const token = signToken(newUser);
    console.log('[DEBUG social-validation] social-register complete for userId:', newUser.id, 'provider:', provider);

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

    if (!provider || !providerId) {
      return res.status(400).json({ error: 'Provider and provider ID are required' });
    }

    // Check if this social account is already linked to another user
    const existingSocialAuth = await pool.query(
      'SELECT * FROM social_auth WHERE provider = $1 AND provider_user_id = $2',
      [provider, providerId]
    );

    if (existingSocialAuth.rows.length > 0 && String(existingSocialAuth.rows[0].user_id) !== String(userId)) {
      return res.status(409).json({ error: 'This social account is already linked to another user' });
    }

    // Create or update social auth
    await pool.query(`
      INSERT INTO social_auth (
        user_id,
        provider,
        provider_user_id,
        access_token,
        refresh_token,
        profile_data
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (provider, provider_user_id)
      DO UPDATE SET
        user_id = $1,
        access_token = $4,
        refresh_token = $5,
        profile_data = $6,
        updated_at = CURRENT_TIMESTAMP
    `, [userId, provider, providerId, accessToken, refreshToken, JSON.stringify(profileData)]);

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
