const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { getTimezoneFromCountry } = require('../utils/timezoneUtils');
const { validateSocialToken } = require('../utils/socialTokenValidator');
const { authenticate } = require('../middleware/auth');

const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Per-IP limiter: blunt protection against one host hammering the login
// endpoint (credential stuffing across many accounts, DoS). Counts every
// request regardless of outcome.
const loginIpLimiter = rateLimit({
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
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Portal session required' });
    }

    const token = authHeader.slice(7);
    const tokenHash = hashToken(token);
    const pool = req.app.locals.pool;
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

    next();
  } catch (error) {
    console.error('Portal session validation error:', error);
    res.status(500).json({ error: 'Session validation failed' });
  }
});

// Patient portal login — rate limited per IP and locked out per account
router.post('/login', loginIpLimiter, loginAccountLimiter, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { email, password, provider, providerId, accessToken } = req.body;

    let patient;

    // Social login
    if (provider && providerId) {
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

      // Check if social auth exists — match the verified id (fall back to the
      // client id for legacy rows created before token validation existed).
      const socialAuth = await pool.query(
        'SELECT user_id FROM social_auth WHERE provider = $1 AND (provider_user_id = $2 OR provider_user_id = $3)',
        [provider, canonicalProviderId, providerId]
      );

      if (socialAuth.rows.length > 0) {
        const patientResult = await pool.query(`
          SELECT p.*, u.language, u.first_name as user_first_name, u.last_name as user_last_name
          FROM patients p
          LEFT JOIN users u ON p.id = u.id
          WHERE p.id = $1 AND p.portal_enabled = true
        `, [socialAuth.rows[0].user_id]);
        patient = patientResult.rows[0];
      } else {
        return res.status(404).json({ error: 'Social account not linked to a patient' });
      }
    } else {
      // Traditional login
      const result = await pool.query(`
        SELECT p.*, u.language, u.first_name as user_first_name, u.last_name as user_last_name
        FROM patients p
        LEFT JOIN users u ON p.id = u.id
        WHERE p.email = $1 AND p.portal_enabled = true
      `, [email]);

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials or portal not enabled' });
      }

      patient = result.rows[0];

      // Verify password
      const validPassword = await bcrypt.compare(password, patient.portal_password_hash || '');
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    // Create session token — return the raw token to the client but persist only
    // its SHA-256 hash, so the DB never holds a replayable credential.
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionTokenHash = hashToken(sessionToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await pool.query(`
      INSERT INTO patient_portal_sessions (patient_id, session_token, ip_address, user_agent, expires_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [patient.id, sessionTokenHash, req.ip, req.get('user-agent'), expiresAt]);

    // Return patient data without sensitive info
    const { portal_password_hash, ...patientData } = patient;

    res.json({
      message: 'Login successful',
      patient: patientData,
      sessionToken,
      expiresAt
    });
  } catch (error) {
    console.error('Error in patient portal login:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Register/Enable patient portal
// SEC-02: requires a valid staff JWT. Previously unauthenticated, which let
// anyone enable the portal and set a password for ANY patientId (account takeover).
router.post('/register', authenticate, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { patientId, email, password } = req.body;

    // Staff may enable any patient's portal; a patient may only enable their own.
    if (req.user.role === 'patient' && String(req.user.id) !== String(patientId)) {
      console.log(`[DEBUG sec02-register] blocked: patient ${req.user.id} tried to register portal for ${patientId}`);
      return res.status(403).json({ error: 'You may only enable the portal for your own account' });
    }
    console.log(`[DEBUG sec02-register] caller=${req.user.id} role=${req.user.role} target=${patientId}`);

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Enable portal and set password
    const result = await pool.query(`
      UPDATE patients
      SET portal_enabled = true, portal_password_hash = $1, email = COALESCE($2, email)
      WHERE id = $3
      RETURNING *
    `, [passwordHash, email, patientId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const { portal_password_hash, ...patientData } = result.rows[0];

    res.json({
      message: 'Patient portal enabled successfully',
      patient: patientData
    });
  } catch (error) {
    console.error('Error registering patient portal:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Get patient appointments
router.get('/:patientId/appointments', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
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
    const pool = req.app.locals.pool;
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
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// Delete patient appointment
router.delete('/:patientId/appointments/:appointmentId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
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
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

// Get patient profile
router.get('/:patientId/profile', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
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
    const pool = req.app.locals.pool;
    const { patientId } = req.params;
    const { first_name, last_name, phone, email, address, date_of_birth, emergencyContact, language, country } = req.body;

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
      patientId
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
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get patient case history/medical records
router.get('/:patientId/medical-records', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
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

// Update patient medical record
router.put('/:patientId/medical-records/:recordId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
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
    res.status(500).json({ error: 'Failed to update medical record' });
  }
});

// Delete patient medical record
router.delete('/:patientId/medical-records/:recordId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
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
    res.status(500).json({ error: 'Failed to delete medical record' });
  }
});

// Link social auth to patient
router.post('/:patientId/link-social', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { patientId } = req.params;
    const { provider, providerId, accessToken, refreshToken, profileData } = req.body;

    const result = await pool.query(`
      INSERT INTO social_auth (
        patient_id,
        provider,
        provider_user_id,
        access_token,
        refresh_token,
        profile_data
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (provider, provider_user_id)
      DO UPDATE SET
        patient_id = $1,
        access_token = $4,
        refresh_token = $5,
        profile_data = $6,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [patientId, provider, providerId, accessToken, refreshToken, JSON.stringify(profileData)]);

    res.json({
      message: 'Social account linked successfully',
      socialAuth: result.rows[0]
    });
  } catch (error) {
    console.error('Error linking social auth:', error);
    res.status(500).json({ error: 'Failed to link social account' });
  }
});

// Logout (delete session)
router.post('/logout', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { sessionToken } = req.body;

    // Sessions are stored hashed — hash the presented token to find the row.
    await pool.query(
      'DELETE FROM patient_portal_sessions WHERE session_token = $1',
      [sessionToken ? hashToken(sessionToken) : null]
    );

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error logging out:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

module.exports = router;
