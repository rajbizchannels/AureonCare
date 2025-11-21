const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getTimezoneFromCountry } = require('../utils/timezoneUtils');

// Patient portal login
router.post('/login', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { email, password, provider, providerId, accessToken } = req.body;

    let patient;

    // Social login
    if (provider && providerId) {
      // Check if social auth exists
      const socialAuth = await pool.query(
        'SELECT patient_id FROM social_auth WHERE provider = $1 AND provider_user_id = $2',
        [provider, providerId]
      );

      if (socialAuth.rows.length > 0) {
        const patientResult = await pool.query(`
          SELECT p.*, u.language, u.first_name as user_first_name, u.last_name as user_last_name
          FROM patients p
          LEFT JOIN users u ON p.id = u.id
          WHERE p.id = $1 AND p.portal_enabled = true
        `, [socialAuth.rows[0].patient_id]);
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

    // Create session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await pool.query(`
      INSERT INTO patient_portal_sessions (patient_id, session_token, ip_address, user_agent, expires_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [patient.id, sessionToken, req.ip, req.get('user-agent'), expiresAt]);

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
router.post('/register', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { patientId, email, password } = req.body;

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

    await pool.query(
      'DELETE FROM patient_portal_sessions WHERE session_token = $1',
      [sessionToken]
    );

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error logging out:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

module.exports = router;
