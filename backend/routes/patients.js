const express = require('express');
const router = express.Router();
const { getTimezoneFromCountry } = require('../utils/timezoneUtils');

// Get all patients
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(`
      SELECT *,
             date_of_birth as dob
      FROM patients
      ORDER BY last_name, first_name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// Get single patient
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'SELECT * FROM patients WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({ error: 'Failed to fetch patient' });
  }
});

// Create new patient
router.post('/', async (req, res) => {
  const {
    first_name, last_name, mrn, dob, date_of_birth, gender, phone, email,
    address, city, state, zip, insurance, insurance_id, insurance_payer_id, status, createUserAccount
  } = req.body;

  const pool = req.app.locals.pool;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Use date_of_birth (database column name), fall back to dob for compatibility
    const birthDate = date_of_birth || dob;

    let userId;
    let tempPassword;

    // IMPORTANT: With new schema, patient.id = user.id
    // So we must create the user FIRST to get the ID

    // Create corresponding user account with patient role if email is provided
    if (email && createUserAccount !== false) {
      // Check if user with this email already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        // Use existing user ID
        userId = existingUser.rows[0].id;
      } else {
        // Create user with patient role
        const bcrypt = require('bcryptjs');
        // Generate a temporary password (user should reset via patient portal)
        tempPassword = Math.random().toString(36).slice(-8);
        const passwordHash = await bcrypt.hash(tempPassword, 10);

        const userResult = await client.query(
          `INSERT INTO users
           (email, password_hash, first_name, last_name, role, phone, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'patient', $5, 'active', NOW(), NOW())
           RETURNING id`,
          [email, passwordHash, first_name, last_name, phone]
        );

        userId = userResult.rows[0].id;
        console.log(`Created user account for patient ${first_name} ${last_name} with temporary password: ${tempPassword}`);
      }
    }

    // Create patient record with user ID (patient.id = user.id)
    const patientInsertQuery = userId
      ? `INSERT INTO patients
         (id, first_name, last_name, mrn, date_of_birth, gender, phone, email,
          address, insurance_payer_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
         RETURNING *`
      : `INSERT INTO patients
         (first_name, last_name, mrn, date_of_birth, gender, phone, email,
          address, insurance_payer_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
         RETURNING *`;

    const patientInsertParams = userId
      ? [userId, first_name, last_name, mrn, birthDate, gender, phone, email, address, insurance_payer_id || null, status || 'active']
      : [first_name, last_name, mrn, birthDate, gender, phone, email, address, insurance_payer_id || null, status || 'active'];

    const patientResult = await client.query(patientInsertQuery, patientInsertParams);
    const newPatient = patientResult.rows[0];

    await client.query('COMMIT');
    res.status(201).json(newPatient);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating patient:', error);
    res.status(500).json({ error: 'Failed to create patient' });
  } finally {
    client.release();
  }
});

// Update patient
router.put('/:id', async (req, res) => {
  const {
    first_name, last_name, mrn, dob, date_of_birth, gender, phone, email,
    address, city, state, zip, insurance, insurance_id, insurance_payer_id, status,
    height, weight, blood_type, allergies, past_history, family_history, current_medications, language, country
  } = req.body;

  try {
    const pool = req.app.locals.pool;
    // Use date_of_birth (database column name), fall back to dob for compatibility
    const birthDate = date_of_birth || dob;

    const result = await pool.query(
      `UPDATE patients
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           mrn = COALESCE($3, mrn),
           date_of_birth = COALESCE($4, date_of_birth),
           gender = COALESCE($5, gender),
           phone = COALESCE($6, phone),
           email = COALESCE($7, email),
           address = COALESCE($8, address),
           status = COALESCE($9, status),
           height = COALESCE($10, height),
           weight = COALESCE($11, weight),
           blood_type = COALESCE($12, blood_type),
           allergies = COALESCE($13, allergies),
           past_history = COALESCE($14, past_history),
           family_history = COALESCE($15, family_history),
           current_medications = COALESCE($16, current_medications),
           country = COALESCE($17, country),
           insurance_payer_id = COALESCE($18, insurance_payer_id),
           updated_at = NOW()
       WHERE id::text = $19::text
       RETURNING *`,
      [first_name, last_name, mrn, birthDate, gender, phone, email,
       address, status, height, weight, blood_type, allergies,
       past_history, family_history, current_medications, country, insurance_payer_id, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const updatedPatient = result.rows[0];

    // Update the users table since patient.id = user.id (no separate user_id)
    // Build dynamic update for users table
    const userUpdateFields = [];
    const userUpdateValues = [];
    let paramIndex = 1;

    if (first_name) {
      userUpdateFields.push(`first_name = $${paramIndex++}`);
      userUpdateValues.push(first_name);
    }
    if (last_name) {
      userUpdateFields.push(`last_name = $${paramIndex++}`);
      userUpdateValues.push(last_name);
    }
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
      userUpdateFields.push(`language = $${paramIndex++}`);
      userUpdateValues.push(languageCode);
    }
    if (country) {
      userUpdateFields.push(`country = $${paramIndex++}`);
      userUpdateValues.push(country);

      // Calculate and update timezone from country
      const timezone = getTimezoneFromCountry(country);
      if (timezone) {
        userUpdateFields.push(`timezone = $${paramIndex++}`);
        userUpdateValues.push(timezone);
      }
    }

    // Execute users table update if there are fields to update
    if (userUpdateFields.length > 0) {
      userUpdateFields.push(`updated_at = NOW()`);
      userUpdateValues.push(req.params.id);

      await pool.query(
        `UPDATE users SET ${userUpdateFields.join(', ')} WHERE id = $${paramIndex}`,
        userUpdateValues
      );
    }

    res.json(updatedPatient);
  } catch (error) {
    console.error('Error updating patient:', error);
    res.status(500).json({ error: 'Failed to update patient' });
  }
});

// Delete patient
router.delete('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'DELETE FROM patients WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    res.json({ message: 'Patient deleted successfully' });
  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({ error: 'Failed to delete patient' });
  }
});

module.exports = router;