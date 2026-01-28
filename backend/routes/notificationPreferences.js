const express = require('express');
const router = express.Router();

/**
 * Notification Preferences API
 * Manages patient notification channel preferences (email, SMS, WhatsApp)
 */

// Get notification preferences for a patient
router.get('/:patientId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { patientId } = req.params;

    const result = await pool.query(
      'SELECT * FROM notification_preferences WHERE patient_id = $1',
      [patientId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
});

// Create or update notification preference
router.post('/:patientId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { patientId } = req.params;
    const { channel_type, is_enabled, contact_info } = req.body;

    // Check if preference already exists
    const existing = await pool.query(
      'SELECT id FROM notification_preferences WHERE patient_id = $1 AND channel_type = $2',
      [patientId, channel_type]
    );

    let result;
    if (existing.rows.length > 0) {
      // Update existing
      result = await pool.query(
        `UPDATE notification_preferences
         SET is_enabled = $1, contact_info = $2, updated_at = CURRENT_TIMESTAMP
         WHERE patient_id = $3 AND channel_type = $4
         RETURNING *`,
        [is_enabled, contact_info, patientId, channel_type]
      );
    } else {
      // Insert new
      result = await pool.query(
        `INSERT INTO notification_preferences (patient_id, channel_type, is_enabled, contact_info)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [patientId, channel_type, is_enabled, contact_info]
      );
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving notification preference:', error);
    res.status(500).json({ error: 'Failed to save notification preference' });
  }
});

// Delete notification preference
router.delete('/:patientId/:channelType', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { patientId, channelType } = req.params;

    const result = await pool.query(
      'DELETE FROM notification_preferences WHERE patient_id = $1 AND channel_type = $2 RETURNING id',
      [patientId, channelType]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification preference not found' });
    }

    res.json({ message: 'Notification preference deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification preference:', error);
    res.status(500).json({ error: 'Failed to delete notification preference' });
  }
});

module.exports = router;
