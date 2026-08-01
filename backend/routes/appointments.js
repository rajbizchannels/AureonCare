const express = require('express');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);
const WhatsAppService = require('../services/whatsappService');
const TelehealthProviderManager = require('../services/telehealthProviders/index');
const notificationService = require('../services/notificationService');

// Get all appointments
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { patientId } = req.query;

    let query = `
      SELECT a.*,
             CONCAT(p.first_name, ' ', p.last_name) as patient,
             CONCAT(pr.first_name, ' ', pr.last_name) as doctor,
             pr.first_name as provider_first_name,
             pr.last_name as provider_last_name,
             pr.specialization as provider_specialization
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id::text = p.id::text
      LEFT JOIN providers pr ON a.provider_id::text = pr.id::text
    `;

    const params = [];
    if (patientId) {
      query += ` WHERE a.patient_id::text = $1::text`;
      params.push(patientId);
    }

    query += ` ORDER BY a.start_time DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Get single appointment
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'SELECT * FROM appointments WHERE id::text = $1::text',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

// Create new appointment
router.post('/', async (req, res) => {
  let {
    patient_id, user_id, provider_id, practice_id, appointment_type,
    start_time, end_time, duration_minutes, reason, notes, status
  } = req.body;

  try {
    const pool = req.app.locals.pool;

    console.log('Creating appointment with:', { patient_id, user_id, appointment_type, start_time });

    // If user_id is provided instead of patient_id, use it directly
    // (patient.id = user.id in new schema)
    if (!patient_id && user_id) {
      console.log('Using user_id as patient_id:', user_id);
      patient_id = user_id; // patient.id = user.id

      // Verify patient exists
      const patientLookup = await pool.query(
        'SELECT id FROM patients WHERE id::text = $1::text',
        [patient_id]
      );

      console.log('Patient lookup result:', patientLookup.rows);

      if (patientLookup.rows.length === 0) {
        console.error('No patient found for user_id:', user_id);
        return res.status(404).json({
          error: 'Patient record not found for this user. Please contact support.',
          details: `No patient record found for user ID: ${user_id}`
        });
      }
    }

    // If patient_id is provided, verify it exists
    if (patient_id) {
      console.log('Verifying patient_id exists:', patient_id);
      const patientCheck = await pool.query(
        'SELECT id, first_name, last_name FROM patients WHERE id::text = $1::text',
        [patient_id]
      );

      console.log('Patient verification result:', patientCheck.rows);

      if (patientCheck.rows.length === 0) {
        console.error('Patient not found:', patient_id);
        return res.status(404).json({
          error: 'Patient record not found. Please contact support.',
          details: `Patient ID ${patient_id} does not exist in the system.`
        });
      }

      console.log('Patient verified:', patientCheck.rows[0]);
    }

    if (!patient_id) {
      console.error('No patient_id could be determined');
      return res.status(400).json({ error: 'patient_id or user_id is required' });
    }

    // Validate provider_id if provided
    if (provider_id && provider_id !== '' && provider_id !== 'null' && provider_id !== 'undefined') {
      console.log('Validating provider_id:', provider_id);

      // Check if provider exists in providers table
      // Note: providers.id now directly references users.id (no separate user_id column)
      const providerCheck = await pool.query(
        'SELECT id, first_name, last_name FROM providers WHERE id::text = $1::text',
        [provider_id]
      );

      if (providerCheck.rows.length === 0) {
        console.warn('Provider not found in providers table:', provider_id);

        // Check if this ID exists in users table with a doctor/physician role
        const userCheck = await pool.query(
          `SELECT id, first_name, last_name, specialty, email, phone, license_number, role, active_role
           FROM users WHERE id::text = $1::text`,
          [provider_id]
        );

        if (userCheck.rows.length > 0) {
          const user = userCheck.rows[0];
          const doctorRoles = ['doctor', 'physician'];
          const isDoctor = doctorRoles.includes(user.role) || doctorRoles.includes(user.active_role);

          if (isDoctor) {
            // Auto-sync: insert the doctor into the providers table
            console.log('Auto-syncing doctor from users to providers table:', provider_id);
            try {
              await pool.query(
                `INSERT INTO providers (id, first_name, last_name, specialization, email, phone, license_number)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (id) DO NOTHING`,
                [user.id, user.first_name, user.last_name, user.specialty || 'General Practice', user.email, user.phone, user.license_number]
              );
              console.log('Provider synced successfully:', provider_id);
            } catch (syncError) {
              console.error('Failed to sync provider:', syncError.message);
              // Continue anyway — the INSERT into appointments may still work
              // if the foreign key constraint is relaxed or the sync partially succeeded
            }
          } else {
            // User exists but isn't a doctor — allow appointment but log the mismatch
            console.warn('User exists but is not a doctor (role:', user.role, '). Attempting to use as provider anyway.');
            try {
              await pool.query(
                `INSERT INTO providers (id, first_name, last_name, specialization, email, phone, license_number)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (id) DO NOTHING`,
                [user.id, user.first_name, user.last_name, user.specialty || null, user.email, user.phone, user.license_number]
              );
            } catch (syncError) {
              console.error('Failed to sync user as provider:', syncError.message);
              provider_id = null;
            }
          }
        } else {
          // Provider doesn't exist anywhere - set to null and allow appointment without provider
          console.warn('Provider not found anywhere - Setting provider_id to NULL');
          provider_id = null;
        }
      } else {
        console.log('Provider verified:', providerCheck.rows[0]);
      }
    } else {
      // Convert empty string, 'null', or 'undefined' to actual NULL
      console.log('Provider ID is empty or invalid, setting to NULL:', provider_id);
      provider_id = null;
    }

    // Check for scheduling conflicts (overlapping time ranges)
    if (start_time && end_time) {
      // Check provider conflict
      if (provider_id) {
        const providerConflict = await pool.query(
          `SELECT a.id,
                  CONCAT(pr.first_name, ' ', pr.last_name) as doctor,
                  CONCAT(p.first_name, ' ', p.last_name) as patient,
                  a.start_time, a.end_time
           FROM appointments a
           LEFT JOIN providers pr ON a.provider_id::text = pr.id::text
           LEFT JOIN patients p ON a.patient_id::text = p.id::text
           WHERE a.provider_id::text = $1::text
             AND a.status NOT IN ('cancelled', 'canceled', 'completed')
             AND a.start_time < $3
             AND a.end_time > $2`,
          [provider_id, start_time, end_time]
        );

        if (providerConflict.rows.length > 0) {
          const conflict = providerConflict.rows[0];
          return res.status(409).json({
            error: `Provider ${conflict.doctor || 'selected'} is busy at the selected time (already has an appointment with ${conflict.patient || 'another patient'}).`,
            conflictType: 'provider'
          });
        }
      }

      // Check patient conflict
      if (patient_id) {
        const patientConflict = await pool.query(
          `SELECT a.id,
                  CONCAT(p.first_name, ' ', p.last_name) as patient,
                  CONCAT(pr.first_name, ' ', pr.last_name) as doctor,
                  a.start_time, a.end_time
           FROM appointments a
           LEFT JOIN patients p ON a.patient_id::text = p.id::text
           LEFT JOIN providers pr ON a.provider_id::text = pr.id::text
           WHERE a.patient_id::text = $1::text
             AND a.status NOT IN ('cancelled', 'canceled', 'completed')
             AND a.start_time < $3
             AND a.end_time > $2`,
          [patient_id, start_time, end_time]
        );

        if (patientConflict.rows.length > 0) {
          const conflict = patientConflict.rows[0];
          return res.status(409).json({
            error: `Patient ${conflict.patient || 'selected'} already has an appointment booked at the selected time${conflict.doctor ? ` (with ${conflict.doctor})` : ''}.`,
            conflictType: 'patient'
          });
        }
      }
    }

    // Log the final values being inserted
    console.log('Inserting appointment with values:', {
      patient_id,
      provider_id,
      practice_id,
      appointment_type,
      start_time,
      end_time,
      duration_minutes,
      reason,
      status: status || 'scheduled'
    });

    const result = await pool.query(
      `INSERT INTO appointments
       (patient_id, provider_id, practice_id, appointment_type, start_time, end_time,
        duration_minutes, reason, notes, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       RETURNING *`,
      [patient_id, provider_id, practice_id, appointment_type, start_time, end_time,
       duration_minutes, reason, notes, status || 'scheduled']
    );

    const newAppointment = result.rows[0];

    // Re-query with JOINs to include patient and doctor names (matches GET response format)
    const fullResult = await pool.query(
      `SELECT a.*,
              CONCAT(p.first_name, ' ', p.last_name) as patient,
              CONCAT(pr.first_name, ' ', pr.last_name) as doctor,
              pr.first_name as provider_first_name,
              pr.last_name as provider_last_name,
              pr.specialization as provider_specialization
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id::text = p.id::text
       LEFT JOIN providers pr ON a.provider_id::text = pr.id::text
       WHERE a.id = $1`,
      [newAppointment.id]
    );

    let finalAppointment = fullResult.rows[0] || newAppointment;

    // Auto-generate a meeting URL for Telehealth appointments
    if ((appointment_type || '').toLowerCase() === 'telehealth') {
      try {
        const providerManager = new TelehealthProviderManager(pool);
        const activeProvider = await providerManager.getActiveProvider();

        let meetingResult;
        if (activeProvider && activeProvider.is_enabled) {
          meetingResult = await providerManager.createMeeting({
            topic: `Telehealth Appointment`,
            startTime: start_time,
            duration: duration_minutes || 30,
            recordingEnabled: false,
          });
        } else {
          // No provider configured — generate a default AureonCare room link
          meetingResult = providerManager.createDefaultMeeting({});
        }

        const meetingUrl = meetingResult.meetingUrl || meetingResult.meeting_url;
        if (meetingUrl) {
          await pool.query(
            'UPDATE appointments SET meeting_url = $1 WHERE id = $2',
            [meetingUrl, newAppointment.id]
          );
          // Re-fetch with updated meeting_url
          const updatedResult = await pool.query(
            `SELECT a.*,
                    CONCAT(p.first_name, ' ', p.last_name) as patient,
                    CONCAT(pr.first_name, ' ', pr.last_name) as doctor,
                    pr.first_name as provider_first_name,
                    pr.last_name as provider_last_name,
                    pr.specialization as provider_specialization
             FROM appointments a
             LEFT JOIN patients p ON a.patient_id::text = p.id::text
             LEFT JOIN providers pr ON a.provider_id::text = pr.id::text
             WHERE a.id = $1`,
            [newAppointment.id]
          );
          finalAppointment = updatedResult.rows[0] || finalAppointment;
        }
      } catch (telehealthError) {
        // Non-fatal: log but do not fail the appointment creation
        console.warn('Could not generate telehealth meeting URL:', telehealthError.message);
      }
    }

    res.status(201).json(finalAppointment);

    // Send notifications (non-blocking)
    notificationService.dispatch(pool, 'appointment.created', { appointment: finalAppointment }).catch(() => {});
  } catch (error) {
    console.error('Error creating appointment:', error);

    // Check if this is a foreign key constraint violation
    if (error.code === '23503' && error.constraint === 'appointments_provider_id_fkey') {
      console.error('Foreign key constraint violation on provider_id');
      console.error('This usually means the database schema needs to be updated.');
      console.error('Please run: npm run migrate');

      return res.status(500).json({
        error: 'Database schema issue detected',
        details: 'The appointments table has an outdated foreign key constraint. Please run database migrations to fix this issue. Contact your system administrator.',
        technicalDetails: 'Foreign key constraint "appointments_provider_id_fkey" is pointing to the wrong table. Run: npm run migrate',
        code: 'FK_CONSTRAINT_ERROR'
      });
    }

    res.status(500).json({ error: 'Failed to create appointment', details: error.message });
  }
});

// Update appointment status only (lightweight PATCH — avoids sending and
// re-validating every field, which can trip the provider FK constraint when
// a provider_id in an older appointment no longer exists in the providers table)
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'status is required' });
  }

  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `UPDATE appointments SET status = $1, updated_at = NOW() WHERE id::text = $2::text RETURNING *`,
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Return enriched row (same shape as GET /appointments) so callers
    // can use patient_id / provider_id without a second fetch.
    const fullResult = await pool.query(
      `SELECT a.*,
              CONCAT(p.first_name, ' ', p.last_name) as patient,
              CONCAT(pr.first_name, ' ', pr.last_name) as doctor,
              pr.first_name as provider_first_name,
              pr.last_name  as provider_last_name,
              pr.specialization as provider_specialization
       FROM appointments a
       LEFT JOIN patients  p  ON a.patient_id::text  = p.id::text
       LEFT JOIN providers pr ON a.provider_id::text = pr.id::text
       WHERE a.id = $1`,
      [result.rows[0].id]
    );

    const updated = fullResult.rows[0] || result.rows[0];
    res.json(updated);

    // Send notification (non-blocking)
    notificationService.dispatch(pool, 'appointment.status_changed', {
      appointment: updated,
      old_status: result.rows[0].status,
    }).catch(() => {});
  } catch (error) {
    console.error('Error updating appointment status:', error);
    res.status(500).json({ error: 'Failed to update appointment status', details: error.message });
  }
});

// Update appointment
router.put('/:id', async (req, res) => {
  const {
    patient_id, provider_id, practice_id, appointment_type,
    start_time, end_time, duration_minutes, reason, notes, status
  } = req.body;

  try {
    const pool = req.app.locals.pool;

    // Get old appointment data for comparison
    const oldAppointmentResult = await pool.query(
      'SELECT * FROM appointments WHERE id::text = $1::text',
      [req.params.id]
    );

    if (oldAppointmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const oldAppointment = oldAppointmentResult.rows[0];

    // Check for scheduling conflicts (overlapping time ranges, excluding current appointment)
    if (start_time && end_time) {
      // Check provider conflict
      if (provider_id) {
        const providerConflict = await pool.query(
          `SELECT a.id,
                  CONCAT(pr.first_name, ' ', pr.last_name) as doctor,
                  CONCAT(p.first_name, ' ', p.last_name) as patient
           FROM appointments a
           LEFT JOIN providers pr ON a.provider_id::text = pr.id::text
           LEFT JOIN patients p ON a.patient_id::text = p.id::text
           WHERE a.provider_id::text = $1::text
             AND a.id::text != $4::text
             AND a.status NOT IN ('cancelled', 'canceled', 'completed')
             AND a.start_time < $3
             AND a.end_time > $2`,
          [provider_id, start_time, end_time, req.params.id]
        );

        if (providerConflict.rows.length > 0) {
          const conflict = providerConflict.rows[0];
          return res.status(409).json({
            error: `Provider ${conflict.doctor || 'selected'} is busy at the selected time (already has an appointment with ${conflict.patient || 'another patient'}).`,
            conflictType: 'provider'
          });
        }
      }

      // Check patient conflict
      if (patient_id) {
        const patientConflict = await pool.query(
          `SELECT a.id,
                  CONCAT(p.first_name, ' ', p.last_name) as patient,
                  CONCAT(pr.first_name, ' ', pr.last_name) as doctor
           FROM appointments a
           LEFT JOIN patients p ON a.patient_id::text = p.id::text
           LEFT JOIN providers pr ON a.provider_id::text = pr.id::text
           WHERE a.patient_id::text = $1::text
             AND a.id::text != $4::text
             AND a.status NOT IN ('cancelled', 'canceled', 'completed')
             AND a.start_time < $3
             AND a.end_time > $2`,
          [patient_id, start_time, end_time, req.params.id]
        );

        if (patientConflict.rows.length > 0) {
          const conflict = patientConflict.rows[0];
          return res.status(409).json({
            error: `Patient ${conflict.patient || 'selected'} already has an appointment booked at the selected time${conflict.doctor ? ` (with ${conflict.doctor})` : ''}.`,
            conflictType: 'patient'
          });
        }
      }
    }

    const result = await pool.query(
      `UPDATE appointments
       SET patient_id = $1, provider_id = $2, practice_id = $3, appointment_type = $4,
           start_time = $5, end_time = $6, duration_minutes = $7, reason = $8,
           notes = $9, status = $10, updated_at = NOW()
       WHERE id::text = $11::text
       RETURNING *`,
      [patient_id, provider_id, practice_id, appointment_type, start_time, end_time,
       duration_minutes, reason, notes, status, req.params.id]
    );

    // Re-query with JOINs to include patient and doctor names (matches GET response format)
    const fullResult = await pool.query(
      `SELECT a.*,
              CONCAT(p.first_name, ' ', p.last_name) as patient,
              CONCAT(pr.first_name, ' ', pr.last_name) as doctor,
              pr.first_name as provider_first_name,
              pr.last_name as provider_last_name,
              pr.specialization as provider_specialization
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id::text = p.id::text
       LEFT JOIN providers pr ON a.provider_id::text = pr.id::text
       WHERE a.id = $1`,
      [result.rows[0]?.id]
    );

    const updatedAppointment = fullResult.rows[0] || result.rows[0];

    // Send WhatsApp notification if appointment was rescheduled or cancelled
    try {
      const whatsappPref = await WhatsAppService.isEnabledForPatient(pool, patient_id);

      if (whatsappPref.enabled) {
        // Check if appointment was rescheduled or cancelled
        const timeChanged = new Date(oldAppointment.start_time).getTime() !== new Date(start_time).getTime();
        const statusChanged = oldAppointment.status !== status;
        const wasCancelled = status === 'cancelled' || status === 'canceled';

        if (timeChanged || wasCancelled) {
          // Get patient and provider details (fall back to users table if not in providers)
          const patientResult = await pool.query(
            'SELECT id, first_name, last_name, phone FROM patients WHERE id::text = $1::text',
            [patient_id]
          );
          let providerResult = await pool.query(
            'SELECT id, first_name, last_name FROM providers WHERE id::text = $1::text',
            [provider_id]
          );
          if (providerResult.rows.length === 0) {
            providerResult = await pool.query(
              'SELECT id, first_name, last_name FROM users WHERE id::text = $1::text',
              [provider_id]
            );
          }

          if (patientResult.rows.length > 0 && providerResult.rows.length > 0) {
            const patient = {
              ...patientResult.rows[0],
              phone: whatsappPref.phoneNumber || patientResult.rows[0].phone
            };
            const provider = providerResult.rows[0];

            // Get WhatsApp config
            const whatsappConfig = await WhatsAppService.getConfig(pool);

            if (whatsappConfig) {
              const whatsappService = new WhatsAppService(whatsappConfig);
              const updateType = wasCancelled ? 'cancelled' : 'rescheduled';
              await whatsappService.sendScheduleUpdateNotification(
                updatedAppointment,
                patient,
                provider,
                updateType
              );
            }
          }
        }
      }
    } catch (whatsappError) {
      console.error('Error sending WhatsApp notification for appointment update:', whatsappError);
      // Don't fail the request if notification fails
    }

    res.json(updatedAppointment);

    // Send notification (non-blocking)
    const isCancelled = status === 'cancelled' || status === 'canceled';
    notificationService.dispatch(pool, isCancelled ? 'appointment.cancelled' : 'appointment.updated', {
      appointment: updatedAppointment,
    }).catch(() => {});
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// Delete appointment
router.delete('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'DELETE FROM appointments WHERE id::text = $1::text RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const deletedAppointment = result.rows[0];

    // Send WhatsApp notification about cancelled appointment
    try {
      const whatsappPref = await WhatsAppService.isEnabledForPatient(pool, deletedAppointment.patient_id);

      if (whatsappPref.enabled) {
        // Get patient and provider details (fall back to users table if not in providers)
        const patientResult = await pool.query(
          'SELECT id, first_name, last_name, phone FROM patients WHERE id::text = $1::text',
          [deletedAppointment.patient_id]
        );
        let providerResult = await pool.query(
          'SELECT id, first_name, last_name FROM providers WHERE id::text = $1::text',
          [deletedAppointment.provider_id]
        );
        if (providerResult.rows.length === 0) {
          providerResult = await pool.query(
            'SELECT id, first_name, last_name FROM users WHERE id::text = $1::text',
            [deletedAppointment.provider_id]
          );
        }

        if (patientResult.rows.length > 0 && providerResult.rows.length > 0) {
          const patient = {
            ...patientResult.rows[0],
            phone: whatsappPref.phoneNumber || patientResult.rows[0].phone
          };
          const provider = providerResult.rows[0];

          // Get WhatsApp config
          const whatsappConfig = await WhatsAppService.getConfig(pool);

          if (whatsappConfig) {
            const whatsappService = new WhatsAppService(whatsappConfig);
            await whatsappService.sendScheduleUpdateNotification(
              deletedAppointment,
              patient,
              provider,
              'cancelled'
            );
          }
        }
      }
    } catch (whatsappError) {
      console.error('Error sending WhatsApp notification for appointment deletion:', whatsappError);
      // Don't fail the request if notification fails
    }

    res.json({ message: 'Appointment deleted successfully' });

    // Send notification (non-blocking)
    notificationService.dispatch(pool, 'appointment.cancelled', { appointment: deletedAppointment }).catch(() => {});
  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

module.exports = router;