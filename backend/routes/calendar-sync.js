const express = require('express');
const jwt = require('jsonwebtoken');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
const { google } = require('googleapis');

const JWT_SECRET = process.env.AC_TK_S;

// ─── Configuration ───────────────────────────────────────────────────────────
// AC_GG_CID / AC_GG_CSK  Google OAuth client id + secret (Calendar API enabled)
// AC_GG_URI              OAuth redirect URI registered on that client
// AC_FE_URL              frontend origin the callback returns the patient to
const GOOGLE_CLIENT_ID = process.env.AC_GG_CID;
const GOOGLE_CLIENT_SECRET = process.env.AC_GG_CSK;
const GOOGLE_REDIRECT_URI =
  process.env.AC_GG_URI ||
  `${process.env.AC_BE_URL || 'http://localhost:3001'}/api/calendar-sync/callback`;
const APP_URL = process.env.AC_FE_URL || 'http://localhost:3000';

const isConfigured = () => Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

if (!isConfigured()) {
  console.warn(
    '[calendar-sync] AC_GG_CID / AC_GG_CSK are not set — Google Calendar sync is disabled'
  );
}

const getOAuth2Client = () =>
  new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);

/** 503 rather than a confusing 500 when the deployment has no Google client. */
const requireGoogleConfig = (req, res, next) => {
  if (!isConfigured()) {
    return res.status(503).json({
      error: 'Google Calendar sync is not configured on this server',
      code: 'CALENDAR_SYNC_NOT_CONFIGURED'
    });
  }
  next();
};

/**
 * A patient record belongs to the caller when the caller *is* that patient, or
 * when the caller is staff. In the current schema patients.id equals the linked
 * users.id; patients.user_id is still honoured for rows created before that
 * merge (migration 023).
 */
const STAFF_ROLES = new Set([
  'admin', 'doctor', 'nurse', 'receptionist', 'staff', 'billing_manager', 'crm_manager'
]);

const authorizePatientAccess = async (req, res, next) => {
  try {
    const patientId = req.params.patientId || req.body.patientId || req.query.patientId;

    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    if (STAFF_ROLES.has(req.user.role)) {
      req.patientId = patientId;
      return next();
    }

    if (String(patientId) === String(req.user.id)) {
      req.patientId = patientId;
      return next();
    }

    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const owned = await pool.query(
      'SELECT 1 FROM patients WHERE id = $1 AND user_id = $2',
      [patientId, req.user.id]
    );

    if (owned.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied for this patient record' });
    }

    req.patientId = patientId;
    next();
  } catch (error) {
    console.error('Error authorizing patient access:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * The OAuth `state` is a short-lived signed token rather than a bare patient id.
 * Google hands `state` back to an unauthenticated callback, so without a
 * signature anyone could complete the flow against someone else's patient
 * record and bind their Google account to it.
 */
const signOAuthState = (patientId, userId) =>
  jwt.sign({ patientId: String(patientId), uid: String(userId) }, JWT_SECRET, { expiresIn: '10m' });

const verifyOAuthState = (state) => {
  try {
    return jwt.verify(state, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

// ─── Routes ──────────────────────────────────────────────────────────────────

// Get Google Calendar authorization URL
router.get('/auth-url', authenticate, requireGoogleConfig, authorizePatientAccess, async (req, res) => {
  try {
    const authUrl = getOAuth2Client().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // force a refresh_token on re-authorisation
      scope: [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
      ],
      state: signOAuthState(req.patientId, req.user.id)
    });

    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
});

/**
 * OAuth callback. Deliberately *not* behind `authenticate`: Google redirects the
 * browser here as a top-level navigation, which carries no Authorization header
 * (this app holds its JWT in sessionStorage, not a cookie). The signed `state`
 * is what authorises the exchange.
 */
router.get('/callback', async (req, res) => {
  const back = (params) => res.redirect(`${APP_URL}/?${new URLSearchParams(params).toString()}`);

  try {
    if (!isConfigured()) {
      return back({ calendar_error: 'not_configured' });
    }

    const { code, state } = req.query;
    if (!code || !state) {
      return back({ calendar_error: 'missing_code' });
    }

    const claims = verifyOAuthState(state);
    if (!claims) {
      return back({ calendar_error: 'invalid_state' });
    }
    const patientId = claims.patientId;

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    await pool.query(
      `
      INSERT INTO social_auth (
        user_id, patient_id, provider, provider_user_id,
        access_token, refresh_token, token_expires_at, profile_data
      )
      VALUES ($1, $1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (provider, provider_user_id)
      DO UPDATE SET
        user_id          = $1,
        patient_id       = $1,
        access_token     = $4,
        -- Google omits refresh_token on re-consent; keep the stored one.
        refresh_token    = COALESCE($5, social_auth.refresh_token),
        token_expires_at = $6,
        profile_data     = $7,
        updated_at       = CURRENT_TIMESTAMP
      `,
      [
        patientId,
        'google_calendar',
        userInfo.data.id,
        tokens.access_token,
        tokens.refresh_token || null,
        tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        JSON.stringify(userInfo.data)
      ]
    );

    back({ calendar_connected: 'true' });
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    back({ calendar_error: 'exchange_failed' });
  }
});

// Check if patient has Google Calendar connected
router.get('/status/:patientId', authenticate, authorizePatientAccess, async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const result = await pool.query(
      `SELECT id, provider, provider_user_id, profile_data, created_at
       FROM social_auth
       WHERE patient_id = $1 AND provider = 'google_calendar'`,
      [req.patientId]
    );

    if (result.rows.length === 0) {
      return res.json({ connected: false, configured: isConfigured() });
    }

    res.json({
      connected: true,
      configured: isConfigured(),
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
router.delete('/disconnect/:patientId', authenticate, authorizePatientAccess, async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const result = await pool.query(
      `DELETE FROM social_auth
       WHERE patient_id = $1 AND provider = 'google_calendar'
       RETURNING id`,
      [req.patientId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No calendar connection found' });
    }

    res.json({ message: 'Google Calendar disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting calendar:', error);
    res.status(500).json({ error: 'Failed to disconnect calendar' });
  }
});

// Sync one appointment to Google Calendar
router.post('/sync-appointment', authenticate, requireGoogleConfig, authorizePatientAccess, async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { appointmentId } = req.body;
    const patientId = req.patientId;

    if (!appointmentId) {
      return res.status(400).json({ error: 'Appointment ID is required' });
    }

    const authResult = await pool.query(
      `SELECT access_token, refresh_token
       FROM social_auth
       WHERE patient_id = $1 AND provider = 'google_calendar'`,
      [patientId]
    );

    if (authResult.rows.length === 0) {
      return res.status(404).json({ error: 'Google Calendar not connected' });
    }

    const { access_token, refresh_token } = authResult.rows[0];

    // Scoped to the patient, so one patient can never sync another's appointment.
    const appointmentResult = await pool.query(
      `SELECT a.*, u.first_name AS provider_first_name, u.last_name AS provider_last_name
       FROM appointments a
       LEFT JOIN users u ON a.provider_id = u.id
       WHERE a.id = $1 AND a.patient_id = $2`,
      [appointmentId, patientId]
    );

    if (appointmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const appointment = appointmentResult.rows[0];

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token, refresh_token });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const providerName = [appointment.provider_first_name, appointment.provider_last_name]
      .filter(Boolean)
      .join(' ');

    const calendarEvent = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: providerName ? `Appointment with Dr. ${providerName}` : 'Medical appointment',
        description: appointment.reason || 'Medical appointment',
        start: {
          dateTime: new Date(appointment.start_time).toISOString(),
          timeZone: appointment.timezone || 'America/New_York'
        },
        end: {
          dateTime: new Date(appointment.end_time).toISOString(),
          timeZone: appointment.timezone || 'America/New_York'
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 30 }
          ]
        }
      }
    });

    // Parameterised — the event id must never be concatenated into SQL.
    await pool.query(
      `UPDATE appointments
       SET notes = COALESCE(notes, '') || E'\nGoogle Calendar Event ID: ' || $2
       WHERE id = $1`,
      [appointmentId, calendarEvent.data.id]
    );

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
router.put('/auto-sync/:patientId', authenticate, authorizePatientAccess, async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: '`enabled` must be a boolean' });
    }

    const result = await pool.query(
      `UPDATE patients
       SET preferences = COALESCE(preferences, '{}'::jsonb) || jsonb_build_object('calendar_auto_sync', $1::boolean)
       WHERE id = $2
       RETURNING id`,
      [enabled, req.patientId]
    );

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
