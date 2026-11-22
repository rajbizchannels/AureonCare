const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');

// SEC-36: the practice's name, working hours and appointment rules could be changed by ANY signed-in
// user, a patient included. The Settings screens that edit them are admin-only; so are the writes.
const adminOnly = authorize('admin');
const { sendDbError } = require('../utils/dbErrors');
const router = express.Router();
router.use(authenticate);
router.use(require('../middleware/planEnforcement').enforceActiveBilling); // SEC-05 S11: read-only when subscription past_due/canceled

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
    // SEC-53: the caller's own practice. This used to return the one organization name shared
    // by every practice (or the oldest practice's details), so practice B saw practice A's name.
    const p = await ownPractice(req);
    if (p) return res.json({ name: p.name, phone: p.phone, email: p.email, address: p.address, source: 'practice' });
    res.json({ name: 'Medical Practice', source: 'default' });
  } catch (error) {
    console.error('Error fetching clinic info:', error);
    res.status(500).json({ error: 'Failed to fetch clinic info' });
  }
});

/** The signed-in user's practice row (public.practices), or null. */
async function ownPractice(req) {
  const practiceId = (req.tenant && req.tenant.practiceId) || (req.user && req.user.practiceId);
  if (!practiceId) return null;
  const pool = req.db || req.app.locals.pool;
  const { rows } = await pool.query(
    `SELECT id, name, tax_id, phone, email, address, npi, website, currency
       FROM public.practices WHERE id::text = $1::text`, [practiceId]);
  return rows[0] || null;
}

/**
 * Get full clinic settings
 * GET /api/clinic-settings
 */
router.get('/', async (req, res) => {
  try {
    const p = await ownPractice(req);
    if (!p) return res.json({ name: '', website: '', npi: '', currency: 'USD' });
    res.json({
      name: p.name || '',
      website: p.website || '',
      npi: p.npi || '',
      currency: p.currency || 'USD',
      taxId: p.tax_id || '',
      phone: p.phone || '',
      email: p.email || '',
      address: typeof p.address === 'string' ? p.address : (p.address?.street || ''),
    });
  } catch (error) {
    console.error('Error fetching clinic settings:', error);
    res.status(500).json({ error: 'Failed to fetch clinic settings' });
  }
});

/**
 * Save clinic settings
 * POST /api/clinic-settings
 *
 * SEC-53: writes the caller's own practice only. It used to update one organization_settings row
 * shared by every practice and the OLDEST practice in public.practices — so one practice's admin
 * overwrote another practice's name, tax ID, phone, email, address, NPI and currency.
 */
router.post('/', adminOnly, async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { name, address, phone, email, website, taxId, npi, currency } = req.body || {};
    const practiceId = (req.tenant && req.tenant.practiceId) || (req.user && req.user.practiceId);
    if (!practiceId) return res.status(400).json({ error: 'No practice selected.' });
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Practice name is required.' });
    if (npi && !/^\d{10}$/.test(String(npi))) return res.status(400).json({ error: 'NPI must be 10 digits.' });
    if (currency && !/^[A-Za-z]{3}$/.test(String(currency))) return res.status(400).json({ error: 'Currency must be a 3-letter code.' });

    const { rowCount } = await pool.query(
      `UPDATE public.practices
          SET name = $1, tax_id = $2, phone = $3, email = $4, address = $5::jsonb,
              npi = $6, website = $7, currency = $8, updated_at = CURRENT_TIMESTAMP
        WHERE id::text = $9::text`,
      [String(name).trim(), taxId || null, phone || null, email || null,
       JSON.stringify({ street: address || '' }), npi || null, website || null,
       (currency || 'USD').toUpperCase(), practiceId]);
    if (!rowCount) return res.status(404).json({ error: 'Practice not found.' });
    res.json({ success: true, message: 'Clinic settings saved successfully' });
  } catch (error) {
    console.error('Error saving clinic settings:', error);
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to save clinic settings')) return;
    res.status(500).json({ error: 'Failed to save clinic settings' });
  }
});

/**
 * Get working hours
 * GET /api/clinic-settings/working-hours
 */
router.get('/working-hours', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request

    // Create table if it doesn't exist
    // SEC-05: table/column creation moved to migrations (see migrations/tenant/001 and 072).

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
router.post('/working-hours', adminOnly, async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const workingHours = req.body;

    // Create table if it doesn't exist
    // SEC-05: table/column creation moved to migrations (see migrations/tenant/001 and 072).

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
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to save working hours')) return;
    res.status(500).json({ error: 'Failed to save working hours' });
  }
});

/**
 * Get appointment settings
 * GET /api/clinic-settings/appointment-settings
 */
router.get('/appointment-settings', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request

    // Create table if it doesn't exist
    // SEC-05: table/column creation moved to migrations (see migrations/tenant/001 and 072).

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
router.post('/appointment-settings', adminOnly, async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { defaultDuration, slotInterval, maxAdvanceBooking, cancellationDeadline } = req.body;

    // Create table if it doesn't exist
    // SEC-05: table/column creation moved to migrations (see migrations/tenant/001 and 072).

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
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to save appointment settings')) return;
    res.status(500).json({ error: 'Failed to save appointment settings' });
  }
});

module.exports = router;
