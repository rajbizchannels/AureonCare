const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const TelehealthProviderManager = require('../services/telehealthProviders');

// Get all telehealth sessions
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(`
      SELECT
        ts.*,
        json_build_object(
          'id', p.id,
          'first_name', p.first_name,
          'last_name', p.last_name,
          'mrn', p.mrn
        ) as patient,
        json_build_object(
          'id', u.id,
          'first_name', u.first_name,
          'last_name', u.last_name,
          'specialty', u.specialty
        ) as provider
      FROM telehealth_sessions ts
      LEFT JOIN patients p ON ts.patient_id = p.id
      LEFT JOIN users u ON ts.provider_id = u.id
      ORDER BY ts.start_time DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching telehealth sessions:', error);
    res.status(500).json({ error: 'Failed to fetch telehealth sessions' });
  }
});

// Get single telehealth session
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        ts.*,
        json_build_object(
          'id', p.id,
          'first_name', p.first_name,
          'last_name', p.last_name,
          'mrn', p.mrn,
          'email', p.email,
          'phone', p.phone
        ) as patient,
        json_build_object(
          'id', u.id,
          'first_name', u.first_name,
          'last_name', u.last_name,
          'specialty', u.specialty,
          'email', u.email
        ) as provider
      FROM telehealth_sessions ts
      LEFT JOIN patients p ON ts.patient_id = p.id
      LEFT JOIN users u ON ts.provider_id = u.id
      WHERE ts.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching telehealth session:', error);
    res.status(500).json({ error: 'Failed to fetch telehealth session' });
  }
});

// Create new telehealth session
router.post('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const {
      appointmentId,
      patientId,
      providerId,
      startTime,
      duration,
      recordingEnabled = false,
      providerType = null // Optional: specify provider (zoom, google_meet, webex)
    } = req.body;

    // Get patient and provider details for meeting creation
    const patientResult = await pool.query(
      'SELECT first_name, last_name FROM patients WHERE id = $1',
      [patientId]
    );
    const providerResult = await pool.query(
      'SELECT first_name, last_name FROM users WHERE id = $1',
      [providerId]
    );

    const patient = patientResult.rows[0];
    const provider = providerResult.rows[0];

    // Use TelehealthProviderManager to create meeting
    const manager = new TelehealthProviderManager(pool);
    const sessionData = {
      patientName: `${patient.first_name} ${patient.last_name}`,
      providerName: `${provider.first_name} ${provider.last_name}`,
      topic: `Telehealth Session - ${patient.first_name} ${patient.last_name}`,
      startTime: startTime,
      duration: duration || 30,
      recordingEnabled: recordingEnabled
    };

    const meetingResult = await manager.createMeeting(sessionData, providerType);

    // Store session in database
    const result = await pool.query(`
      INSERT INTO telehealth_sessions (
        appointment_id,
        patient_id,
        provider_id,
        session_status,
        room_id,
        meeting_url,
        start_time,
        duration_minutes,
        recording_enabled,
        provider_type
      )
      VALUES ($1, $2, $3, 'scheduled', $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      appointmentId,
      patientId,
      providerId,
      meetingResult.roomId,
      meetingResult.meetingUrl,
      startTime,
      duration,
      recordingEnabled,
      meetingResult.provider
    ]);

    res.status(201).json({
      ...result.rows[0],
      meetingDetails: meetingResult
    });
  } catch (error) {
    console.error('Error creating telehealth session:', error);
    res.status(500).json({ error: 'Failed to create telehealth session: ' + error.message });
  }
});

// Update telehealth session
router.put('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    const {
      sessionStatus,
      startTime,
      endTime,
      durationMinutes,
      recordingUrl,
      participants,
      sessionNotes
    } = req.body;

    const result = await pool.query(`
      UPDATE telehealth_sessions
      SET
        session_status = COALESCE($1, session_status),
        start_time = COALESCE($2, start_time),
        end_time = COALESCE($3, end_time),
        duration_minutes = COALESCE($4, duration_minutes),
        recording_url = COALESCE($5, recording_url),
        participants = COALESCE($6, participants),
        session_notes = COALESCE($7, session_notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `, [sessionStatus, startTime, endTime, durationMinutes, recordingUrl,
        JSON.stringify(participants), sessionNotes, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating telehealth session:', error);
    res.status(500).json({ error: 'Failed to update telehealth session' });
  }
});

// Delete telehealth session
router.delete('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM telehealth_sessions WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ message: 'Session deleted successfully', id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting telehealth session:', error);
    res.status(500).json({ error: 'Failed to delete telehealth session' });
  }
});

// Join session (add participant)
router.post('/:id/join', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    const { participantName, participantType } = req.body;

    // Get current participants
    const session = await pool.query(
      'SELECT participants FROM telehealth_sessions WHERE id = $1',
      [id]
    );

    if (session.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const participants = session.rows[0].participants || [];
    participants.push({
      name: participantName,
      type: participantType,
      joinedAt: new Date().toISOString()
    });

    await pool.query(
      'UPDATE telehealth_sessions SET participants = $1 WHERE id = $2',
      [JSON.stringify(participants), id]
    );

    res.json({ message: 'Joined session successfully', participants });
  } catch (error) {
    console.error('Error joining session:', error);
    res.status(500).json({ error: 'Failed to join session' });
  }
});

module.exports = router;
