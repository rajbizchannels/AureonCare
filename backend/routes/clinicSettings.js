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
 * Get full clinic settings
 * GET /api/clinic-settings
 */
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    // Get organization settings
    const orgResult = await pool.query(`
      SELECT organization_name, settings
      FROM organization_settings
      LIMIT 1
    `);

    // Get practice settings
    const practiceResult = await pool.query(`
      SELECT name, tax_id, phone, email, address, plan_tier
      FROM practices
      ORDER BY created_at ASC
      LIMIT 1
    `);

    let settings = {};

    // Merge organization and practice data
    if (orgResult.rows.length > 0) {
      const orgSettings = orgResult.rows[0].settings || {};
      settings = {
        name: orgResult.rows[0].organization_name || '',
        website: orgSettings.website || '',
        npi: orgSettings.npi || '',
      };
    }

    if (practiceResult.rows.length > 0) {
      const practice = practiceResult.rows[0];
      settings = {
        ...settings,
        name: settings.name || practice.name || '',
        taxId: practice.tax_id || '',
        phone: practice.phone || '',
        email: practice.email || '',
        address: typeof practice.address === 'string' ? practice.address : (practice.address?.street || ''),
      };
    }

    res.json(settings);
  } catch (error) {
    console.error('Error fetching clinic settings:', error);
    res.status(500).json({ error: 'Failed to fetch clinic settings' });
  }
});

/**
 * Save clinic settings
 * POST /api/clinic-settings
 */
router.post('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { name, address, phone, email, website, taxId, npi } = req.body;

    // Start transaction
    await pool.query('BEGIN');

    try {
      // Update or insert into organization_settings
      const orgResult = await pool.query(`
        SELECT id FROM organization_settings LIMIT 1
      `);

      if (orgResult.rows.length > 0) {
        // Update existing organization settings
        await pool.query(`
          UPDATE organization_settings
          SET organization_name = $1,
              settings = jsonb_set(
                COALESCE(settings, '{}'::jsonb),
                '{website}',
                $2::jsonb
              ),
              settings = jsonb_set(
                COALESCE(settings, '{}'::jsonb),
                '{npi}',
                $3::jsonb
              ),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
        `, [name, JSON.stringify(website || ''), JSON.stringify(npi || ''), orgResult.rows[0].id]);
      } else {
        // Insert new organization settings
        await pool.query(`
          INSERT INTO organization_settings (organization_name, settings)
          VALUES ($1, $2)
        `, [name, JSON.stringify({ website: website || '', npi: npi || '' })]);
      }

      // Update or insert into practices table
      const practiceResult = await pool.query(`
        SELECT id FROM practices ORDER BY created_at ASC LIMIT 1
      `);

      if (practiceResult.rows.length > 0) {
        // Update existing practice
        await pool.query(`
          UPDATE practices
          SET name = $1,
              tax_id = $2,
              phone = $3,
              email = $4,
              address = $5::jsonb,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $6
        `, [
          name,
          taxId || null,
          phone || null,
          email || null,
          JSON.stringify({ street: address || '' }),
          practiceResult.rows[0].id
        ]);
      } else {
        // Insert new practice
        await pool.query(`
          INSERT INTO practices (name, tax_id, phone, email, address)
          VALUES ($1, $2, $3, $4, $5::jsonb)
        `, [
          name,
          taxId || null,
          phone || null,
          email || null,
          JSON.stringify({ street: address || '' })
        ]);
      }

      // Commit transaction
      await pool.query('COMMIT');

      res.json({ success: true, message: 'Clinic settings saved successfully' });
    } catch (error) {
      // Rollback on error
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error saving clinic settings:', error);
    res.status(500).json({ error: 'Failed to save clinic settings' });
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
