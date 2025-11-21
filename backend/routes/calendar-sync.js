const express = require('express');
const router = express.Router();
const { google } = require('googleapis');

// Google Calendar OAuth configuration
const getOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/calendar-sync/callback'
  );
};

// Get Google Calendar authorization URL
router.get('/auth-url', async (req, res) => {
  try {
    const { patientId } = req.query;

    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    const oauth2Client = getOAuth2Client();

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly'
      ],
      state: patientId // Pass patientId as state to retrieve it in callback
    });

    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
});

// OAuth callback handler
router.get('/callback', async (req, res) => {
  try {
    const { code, state: patientId } = req.query;

    if (!code || !patientId) {
      return res.status(400).json({ error: 'Missing authorization code or patient ID' });
    }

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    // Get user info from Google
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    // Store tokens in social_auth table
    const pool = req.app.locals.pool;
    await pool.query(`
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
    `, [
      patientId,
      'google_calendar',
      userInfo.data.id,
      tokens.access_token,
      tokens.refresh_token,
      JSON.stringify(userInfo.data)
    ]);

    // Redirect to patient portal with success message
    res.redirect(`/patient-portal?calendar_connected=true`);
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    res.redirect(`/patient-portal?calendar_error=true`);
  }
});

// Check if patient has Google Calendar connected
router.get('/status/:patientId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { patientId } = req.params;

    const result = await pool.query(`
      SELECT id, provider, provider_user_id, profile_data, created_at
      FROM social_auth
      WHERE patient_id = $1 AND provider = 'google_calendar'
    `, [patientId]);

    if (result.rows.length === 0) {
      return res.json({ connected: false });
    }

    res.json({
      connected: true,
      account: {
        email: result.rows[0].profile_data?.email,
        name: result.rows[0].profile_data?.name,
        connectedAt: result.rows[0].created_at
      }
    });
  } catch (error) {
    console.error('Error checking calendar status:', error);
    res.status(500).json({ error: 'Failed to check calendar status' });
  }
});

// Disconnect Google Calendar
router.delete('/disconnect/:patientId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { patientId } = req.params;

    const result = await pool.query(`
      DELETE FROM social_auth
      WHERE patient_id = $1 AND provider = 'google_calendar'
      RETURNING *
    `, [patientId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No calendar connection found' });
    }

    res.json({ message: 'Google Calendar disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting calendar:', error);
    res.status(500).json({ error: 'Failed to disconnect calendar' });
  }
});

// Sync appointment to Google Calendar
router.post('/sync-appointment', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { appointmentId, patientId } = req.body;

    if (!appointmentId || !patientId) {
      return res.status(400).json({ error: 'Appointment ID and Patient ID are required' });
    }

    // Get calendar auth tokens
    const authResult = await pool.query(`
      SELECT access_token, refresh_token
      FROM social_auth
      WHERE patient_id = $1 AND provider = 'google_calendar'
    `, [patientId]);

    if (authResult.rows.length === 0) {
      return res.status(404).json({ error: 'Google Calendar not connected' });
    }

    const { access_token, refresh_token } = authResult.rows[0];

    // Get appointment details
    const appointmentResult = await pool.query(`
      SELECT a.*, u.first_name as provider_first_name, u.last_name as provider_last_name
      FROM appointments a
      LEFT JOIN users u ON a.provider_id = u.id
      WHERE a.id = $1 AND a.patient_id = $2
    `, [appointmentId, patientId]);

    if (appointmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const appointment = appointmentResult.rows[0];

    // Set up OAuth2 client with tokens
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: access_token,
      refresh_token: refresh_token
    });

    // Create calendar event
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const event = {
      summary: `Appointment with Dr. ${appointment.provider_first_name} ${appointment.provider_last_name}`,
      description: appointment.reason || 'Medical appointment',
      start: {
        dateTime: appointment.start_time,
        timeZone: appointment.timezone || 'America/New_York',
      },
      end: {
        dateTime: appointment.end_time,
        timeZone: appointment.timezone || 'America/New_York',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 30 },      // 30 minutes before
        ],
      },
    };

    const calendarEvent = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    // Store calendar event ID in appointment
    await pool.query(`
      UPDATE appointments
      SET notes = COALESCE(notes, '') || E'\nGoogle Calendar Event ID: ${calendarEvent.data.id}'
      WHERE id = $1
    `, [appointmentId]);

    res.json({
      message: 'Appointment synced to Google Calendar successfully',
      eventId: calendarEvent.data.id,
      eventLink: calendarEvent.data.htmlLink
    });
  } catch (error) {
    console.error('Error syncing appointment to calendar:', error);
    res.status(500).json({ error: 'Failed to sync appointment to calendar' });
  }
});

// Enable/disable auto-sync for future appointments
router.put('/auto-sync/:patientId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { patientId } = req.params;
    const { enabled } = req.body;

    // Update patient preferences
    const result = await pool.query(`
      UPDATE patients
      SET preferences = COALESCE(preferences, '{}'::jsonb) || jsonb_build_object('calendar_auto_sync', $1)
      WHERE id = $2
      RETURNING *
    `, [enabled, patientId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json({
      message: `Auto-sync ${enabled ? 'enabled' : 'disabled'} successfully`,
      autoSync: enabled
    });
  } catch (error) {
    console.error('Error updating auto-sync setting:', error);
    res.status(500).json({ error: 'Failed to update auto-sync setting' });
  }
});

module.exports = router;
