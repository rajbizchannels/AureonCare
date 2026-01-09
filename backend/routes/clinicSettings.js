const express = require('express');
const router = express.Router();

/**
 * Clinic Settings Management
 * Handles working hours, appointment settings, and other clinic-wide configurations
 */

/**
 * Get clinic info (name, address, etc.)
 * GET /api/clinic-settings/info
 * Fetches from organization_settings and practices tables
 */
router.get('/info', async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    // Try to get organization name from organization_settings first
    const orgResult = await pool.query(`
      SELECT organization_name as name, settings
      FROM organization_settings
      LIMIT 1
    `);

    // If organization name exists, return it
    if (orgResult.rows.length > 0 && orgResult.rows[0].name) {
      return res.json({
        name: orgResult.rows[0].name,
        source: 'organization_settings'
      });
    }

    // Fall back to practices table
    const practiceResult = await pool.query(`
      SELECT name, phone, email, address
      FROM practices
      ORDER BY created_at ASC
      LIMIT 1
    `);

    // If practice exists, return it
    if (practiceResult.rows.length > 0) {
      return res.json({
        name: practiceResult.rows[0].name,
        phone: practiceResult.rows[0].phone,
        email: practiceResult.rows[0].email,
        address: practiceResult.rows[0].address,
        source: 'practices'
      });
    }

    // If neither exists, return default
    res.json({
      name: 'Medical Practice',
      source: 'default'
    });
  } catch (error) {
    console.error('Error fetching clinic info:', error);
    res.status(500).json({ error: 'Failed to fetch clinic info' });
  }
});

/**
 * Get working hours
 * GET /api/clinic-settings/working-hours
 */
router.get('/working-hours', async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    // Create table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clinic_working_hours (
        id SERIAL PRIMARY KEY,
        day VARCHAR(20) NOT NULL UNIQUE,
        is_working BOOLEAN DEFAULT true,
        start_time TIME,
        end_time TIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const result = await pool.query('SELECT * FROM clinic_working_hours ORDER BY id');

    // If no data exists, return default working hours
    if (result.rows.length === 0) {
      const defaultHours = {
        monday: { enabled: true, open: '09:00', close: '17:00' },
        tuesday: { enabled: true, open: '09:00', close: '17:00' },
        wednesday: { enabled: true, open: '09:00', close: '17:00' },
        thursday: { enabled: true, open: '09:00', close: '17:00' },
        friday: { enabled: true, open: '09:00', close: '17:00' },
        saturday: { enabled: false, open: '09:00', close: '13:00' },
        sunday: { enabled: false, open: '09:00', close: '13:00' }
      };
      return res.json(defaultHours);
    }

    // Transform database rows to expected format
    const workingHours = {};
    result.rows.forEach(row => {
      workingHours[row.day] = {
        enabled: row.is_working,
        open: row.start_time || '09:00',
        close: row.end_time || '17:00'
      };
    });

    res.json(workingHours);
  } catch (error) {
    console.error('Error fetching working hours:', error);
    res.status(500).json({ error: 'Failed to fetch working hours' });
  }
});

/**
 * Save working hours
 * POST /api/clinic-settings/working-hours
 */
router.post('/working-hours', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const workingHours = req.body;

    // Create table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clinic_working_hours (
        id SERIAL PRIMARY KEY,
        day VARCHAR(20) NOT NULL UNIQUE,
        is_working BOOLEAN DEFAULT true,
        start_time TIME,
        end_time TIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Save each day's working hours
    for (const [day, hours] of Object.entries(workingHours)) {
      await pool.query(`
        INSERT INTO clinic_working_hours (day, is_working, start_time, end_time)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (day)
        DO UPDATE SET
          is_working = $2,
          start_time = $3,
          end_time = $4,
          updated_at = CURRENT_TIMESTAMP
      `, [day, hours.enabled, hours.open, hours.close]);
    }

    res.json({ success: true, message: 'Working hours saved successfully' });
  } catch (error) {
    console.error('Error saving working hours:', error);
    res.status(500).json({ error: 'Failed to save working hours' });
  }
});

/**
 * Get appointment settings
 * GET /api/clinic-settings/appointment-settings
 */
router.get('/appointment-settings', async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    // Create table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clinic_appointment_settings (
        id SERIAL PRIMARY KEY,
        default_duration INTEGER DEFAULT 30,
        slot_interval INTEGER DEFAULT 15,
        max_advance_booking INTEGER DEFAULT 90,
        cancellation_deadline INTEGER DEFAULT 24,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const result = await pool.query('SELECT * FROM clinic_appointment_settings LIMIT 1');

    // If no settings exist, return defaults
    if (result.rows.length === 0) {
      return res.json({
        defaultDuration: 30,
        slotInterval: 15,
        maxAdvanceBooking: 90,
        cancellationDeadline: 24
      });
    }

    const settings = result.rows[0];
    res.json({
      defaultDuration: settings.default_duration,
      slotInterval: settings.slot_interval,
      maxAdvanceBooking: settings.max_advance_booking,
      cancellationDeadline: settings.cancellation_deadline
    });
  } catch (error) {
    console.error('Error fetching appointment settings:', error);
    res.status(500).json({ error: 'Failed to fetch appointment settings' });
  }
});

/**
 * Save appointment settings
 * POST /api/clinic-settings/appointment-settings
 */
router.post('/appointment-settings', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { defaultDuration, slotInterval, maxAdvanceBooking, cancellationDeadline } = req.body;

    // Create table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clinic_appointment_settings (
        id SERIAL PRIMARY KEY,
        default_duration INTEGER DEFAULT 30,
        slot_interval INTEGER DEFAULT 15,
        max_advance_booking INTEGER DEFAULT 90,
        cancellation_deadline INTEGER DEFAULT 24,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check if settings exist
    const checkResult = await pool.query('SELECT id FROM clinic_appointment_settings LIMIT 1');

    if (checkResult.rows.length === 0) {
      // Insert new settings
      await pool.query(`
        INSERT INTO clinic_appointment_settings
        (default_duration, slot_interval, max_advance_booking, cancellation_deadline)
        VALUES ($1, $2, $3, $4)
      `, [defaultDuration, slotInterval, maxAdvanceBooking, cancellationDeadline]);
    } else {
      // Update existing settings
      await pool.query(`
        UPDATE clinic_appointment_settings
        SET default_duration = $1,
            slot_interval = $2,
            max_advance_booking = $3,
            cancellation_deadline = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
      `, [defaultDuration, slotInterval, maxAdvanceBooking, cancellationDeadline, checkResult.rows[0].id]);
    }

    res.json({ success: true, message: 'Appointment settings saved successfully' });
  } catch (error) {
    console.error('Error saving appointment settings:', error);
    res.status(500).json({ error: 'Failed to save appointment settings' });
  }
});

module.exports = router;
