const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Helper function to convert snake_case to camelCase
const toCamelCase = (obj) => {
  const newObj = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    newObj[camelKey] = obj[key];
  }
  return newObj;
};

// Login endpoint
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

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

    res.json({
      message: 'Login successful',
      user: toCamelCase(userData)
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Change password endpoint
router.post('/change-password', async (req, res) => {
  const { userId, currentPassword, newPassword } = req.body;

  if (!userId || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'User ID, current password, and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  try {
    const pool = req.app.locals.pool;

    // Get user
    const userResult = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Verify current password
    if (user.password_hash) {
      const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
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
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
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

    // In a real application, you would send an email here
    // For now, we'll just return the token (in production, NEVER do this!)
    res.json({
      message: 'If the email exists, a password reset link has been sent',
      resetToken // Remove this in production!
    });
  } catch (error) {
    console.error('Error requesting password reset:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  const { resetToken, newPassword } = req.body;

  if (!resetToken || !newPassword) {
    return res.status(400).json({ error: 'Reset token and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  try {
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
      email,
      firstName,
      lastName,
      profileData
    } = req.body;

    if (!provider || !providerId || !email) {
      return res.status(400).json({ error: 'Provider, provider ID, and email are required' });
    }

    // Check if social auth already exists
    const socialAuthResult = await pool.query(
      'SELECT * FROM social_auth WHERE provider = $1 AND provider_user_id = $2',
      [provider, providerId]
    );

    let user;

    if (socialAuthResult.rows.length > 0) {
      // Existing social auth - get the user
      const userId = socialAuthResult.rows[0].user_id;
      const userResult = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      user = userResult.rows[0];

      // Update tokens
      await pool.query(`
        UPDATE social_auth
        SET access_token = $1, refresh_token = $2, profile_data = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [accessToken, refreshToken, JSON.stringify(profileData), socialAuthResult.rows[0].id]);

    } else {
      // New social auth - check if user exists by email
      const existingUserResult = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );

      if (existingUserResult.rows.length > 0) {
        // User exists - link social auth
        user = existingUserResult.rows[0];

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
        `, [user.id, provider, providerId, accessToken, refreshToken, JSON.stringify(profileData)]);

      } else {
        // Create new user
        const newUserResult = await pool.query(`
          INSERT INTO users (
            email,
            first_name,
            last_name,
            role,
            status,
            avatar
          )
          VALUES ($1, $2, $3, 'staff', 'active', $4)
          RETURNING *
        `, [
          email,
          firstName || '',
          lastName || '',
          `${(firstName?.[0] || '')}${(lastName?.[0] || '')}`.toUpperCase()
        ]);

        user = newUserResult.rows[0];

        // Create social auth entry
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
        `, [user.id, provider, providerId, accessToken, refreshToken, JSON.stringify(profileData)]);
      }
    }

    // Update last login
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Don't send password_hash back to client
    const { password_hash, ...userData } = user;

    res.json({
      message: 'Social login successful',
      user: toCamelCase(userData),
      isNewUser: !existingUserResult || existingUserResult.rows.length === 0
    });

  } catch (error) {
    console.error('Error during social login:', error);
    res.status(500).json({ error: 'Social login failed' });
  }
});

// Link social account to existing user
router.post('/link-social-account', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const {
      userId,
      provider,
      providerId,
      accessToken,
      refreshToken,
      profileData
    } = req.body;

    if (!userId || !provider || !providerId) {
      return res.status(400).json({ error: 'User ID, provider, and provider ID are required' });
    }

    // Check if user exists
    const userResult = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if this social account is already linked to another user
    const existingSocialAuth = await pool.query(
      'SELECT * FROM social_auth WHERE provider = $1 AND provider_user_id = $2',
      [provider, providerId]
    );

    if (existingSocialAuth.rows.length > 0 && existingSocialAuth.rows[0].user_id !== userId) {
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

// Unlink social account
router.post('/unlink-social-account', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { userId, provider } = req.body;

    if (!userId || !provider) {
      return res.status(400).json({ error: 'User ID and provider are required' });
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

// Get linked social accounts for a user
router.get('/social-accounts/:userId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { userId } = req.params;

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
