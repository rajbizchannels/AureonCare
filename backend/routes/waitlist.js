const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');

// Helper function to convert snake_case to camelCase
const toCamelCase = (obj) => {
  const newObj = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    newObj[camelKey] = obj[key];
  }
  return newObj;
};

// Add patient to waitlist (authenticated patients only)
router.post('/', authenticate, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const patientId = req.user.id;
    const { providerId, preferredDate, preferredTimeStart, preferredTimeEnd, appointmentType, reason } = req.body;

    if (!preferredDate) {
      return res.status(400).json({ error: 'Preferred date is required' });
    }

    // Verify patient exists
    const patientCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND role = $2',
      [patientId, 'patient']
    );

    if (patientCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Check if patient already on waitlist for this date/provider
    const existingCheck = await pool.query(
      `SELECT id FROM appointment_waitlist
       WHERE patient_id = $1
       AND provider_id = $2
       AND preferred_date = $3
       AND status = 'active'`,
      [patientId, providerId || null, preferredDate]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(400).json({
        error: 'Already on waitlist',
        message: 'You are already on the waitlist for this date and provider'
      });
    }

    const result = await pool.query(
      `INSERT INTO appointment_waitlist
        (patient_id, provider_id, preferred_date, preferred_time_start, preferred_time_end, appointment_type, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [patientId, providerId || null, preferredDate, preferredTimeStart || null, preferredTimeEnd || null, appointmentType || null, reason || null]
    );

    res.status(201).json({
      success: true,
      message: 'Added to waitlist successfully. You will be notified when a slot becomes available.',
      waitlistEntry: toCamelCase(result.rows[0])
    });
  } catch (error) {
    console.error('Error adding to waitlist:', error);
    res.status(500).json({ error: 'Failed to add to waitlist' });
  }
});

// Get patient's waitlist entries
router.get('/my-waitlist', authenticate, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const patientId = req.user.id;

    const result = await pool.query(
      `SELECT
        w.*,
        p.first_name as provider_first_name,
        p.last_name as provider_last_name,
        p.specialization as provider_specialization
       FROM appointment_waitlist w
       LEFT JOIN providers p ON w.provider_id = p.id
       WHERE w.patient_id = $1
       ORDER BY w.preferred_date ASC, w.created_at ASC`,
      [patientId]
    );

    const waitlistEntries = result.rows.map(toCamelCase);
    res.json(waitlistEntries);
  } catch (error) {
    console.error('Error fetching waitlist:', error);
    res.status(500).json({ error: 'Failed to fetch waitlist entries' });
  }
});

// Cancel/remove from waitlist
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check ownership or admin access
    const waitlistEntry = await pool.query(
      'SELECT * FROM appointment_waitlist WHERE id = $1',
      [id]
    );

    if (waitlistEntry.rows.length === 0) {
      return res.status(404).json({ error: 'Waitlist entry not found' });
    }

    const entry = waitlistEntry.rows[0];

    // Only allow patient who created it or admin to cancel
    if (entry.patient_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to cancel this waitlist entry' });
    }

    const result = await pool.query(
      `UPDATE appointment_waitlist
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    res.json({
      success: true,
      message: 'Removed from waitlist successfully',
      waitlistEntry: toCamelCase(result.rows[0])
    });
  } catch (error) {
    console.error('Error removing from waitlist:', error);
    res.status(500).json({ error: 'Failed to remove from waitlist' });
  }
});

// Admin: Get all waitlist entries with filters
router.get('/admin/all', authenticate, authorize('admin', 'receptionist'), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { status, providerId, date } = req.query;

    let query = `
      SELECT
        w.*,
        u.first_name as patient_first_name,
        u.last_name as patient_last_name,
        u.email as patient_email,
        u.phone as patient_phone,
        p.first_name as provider_first_name,
        p.last_name as provider_last_name,
        p.specialization as provider_specialization
      FROM appointment_waitlist w
      JOIN users u ON w.patient_id = u.id
      LEFT JOIN providers p ON w.provider_id = p.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND w.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (providerId) {
      query += ` AND w.provider_id = $${paramCount}`;
      params.push(providerId);
      paramCount++;
    }

    if (date) {
      query += ` AND w.preferred_date = $${paramCount}`;
      params.push(date);
      paramCount++;
    }

    query += ' ORDER BY w.priority DESC, w.created_at ASC';

    const result = await pool.query(query, params);
    const waitlistEntries = result.rows.map(toCamelCase);
    res.json(waitlistEntries);
  } catch (error) {
    console.error('Error fetching waitlist:', error);
    res.status(500).json({ error: 'Failed to fetch waitlist entries' });
  }
});

// Admin: Notify next person on waitlist (when slot becomes available)
router.post('/admin/notify-next', authenticate, authorize('admin', 'receptionist'), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { providerId, date } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Find next active waitlist entry
    const result = await pool.query(
      `SELECT w.*, u.email, u.first_name, u.last_name
       FROM appointment_waitlist w
       JOIN users u ON w.patient_id = u.id
       WHERE w.status = 'active'
       AND w.preferred_date = $1
       AND ($2::integer IS NULL OR w.provider_id = $2)
       ORDER BY w.priority DESC, w.created_at ASC
       LIMIT 1`,
      [date, providerId || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active waitlist entries found for this date/provider'
      });
    }

    const waitlistEntry = result.rows[0];

    // Update status to notified and set expiry (24 hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await pool.query(
      `UPDATE appointment_waitlist
       SET status = 'notified',
           notified_at = CURRENT_TIMESTAMP,
           expires_at = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [expiresAt, waitlistEntry.id]
    );

    // Here you would integrate with your notification system
    // For now, we'll just return the patient info for manual notification

    res.json({
      success: true,
      message: 'Next person on waitlist identified',
      patient: {
        id: waitlistEntry.patient_id,
        name: `${waitlistEntry.first_name} ${waitlistEntry.last_name}`,
        email: waitlistEntry.email,
        waitlistId: waitlistEntry.id,
        expiresAt: expiresAt
      },
      waitlistEntry: toCamelCase(waitlistEntry)
    });
  } catch (error) {
    console.error('Error notifying waitlist:', error);
    res.status(500).json({ error: 'Failed to notify next person on waitlist' });
  }
});

// Admin: Mark waitlist entry as scheduled
router.post('/admin/:id/scheduled', authenticate, authorize('admin', 'receptionist'), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE appointment_waitlist
       SET status = 'scheduled', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Waitlist entry not found' });
    }

    res.json({
      success: true,
      message: 'Waitlist entry marked as scheduled',
      waitlistEntry: toCamelCase(result.rows[0])
    });
  } catch (error) {
    console.error('Error updating waitlist:', error);
    res.status(500).json({ error: 'Failed to update waitlist entry' });
  }
});

module.exports = router;
