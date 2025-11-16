const express = require('express');
const router = express.Router();
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');

// ============================================================================
// DOCTOR AVAILABILITY ROUTES
// ============================================================================

/**
 * GET /api/scheduling/availability/:providerId
 * Get all availability schedules for a provider
 * Optional authentication - public can view, authenticated users get enhanced access
 */
router.get('/availability/:providerId', optionalAuth, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { providerId } = req.params;

        const result = await pool.query(
            `SELECT * FROM doctor_availability
             WHERE provider_id = $1
             ORDER BY day_of_week, start_time`,
            [providerId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching doctor availability:', error);
        res.status(500).json({ error: 'Failed to fetch availability' });
    }
});

/**
 * POST /api/scheduling/availability
 * Create new availability schedule
 * Body: { providerId, dayOfWeek, startTime, endTime, timezone, isAvailable }
 * Requires authentication - only admin/receptionist/doctor can create availability
 */
router.post('/availability', authenticate, authorize('admin', 'receptionist', 'doctor'), async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { providerId, dayOfWeek, startTime, endTime, timezone, isAvailable } = req.body;

        // Validation
        if (!providerId || dayOfWeek === undefined || !startTime || !endTime) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (dayOfWeek < 0 || dayOfWeek > 6) {
            return res.status(400).json({ error: 'dayOfWeek must be between 0 (Sunday) and 6 (Saturday)' });
        }

        const result = await pool.query(
            `INSERT INTO doctor_availability
             (provider_id, day_of_week, start_time, end_time, timezone, is_available)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [providerId, dayOfWeek, startTime, endTime, timezone || 'UTC', isAvailable !== false]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating availability:', error);
        res.status(500).json({ error: 'Failed to create availability' });
    }
});

/**
 * PUT /api/scheduling/availability/:id
 * Update availability schedule
 * Requires authentication - only admin/receptionist/doctor can update availability
 */
router.put('/availability/:id', authenticate, authorize('admin', 'receptionist', 'doctor'), async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { id } = req.params;
        const { dayOfWeek, startTime, endTime, timezone, isAvailable } = req.body;

        const result = await pool.query(
            `UPDATE doctor_availability
             SET day_of_week = COALESCE($1, day_of_week),
                 start_time = COALESCE($2, start_time),
                 end_time = COALESCE($3, end_time),
                 timezone = COALESCE($4, timezone),
                 is_available = COALESCE($5, is_available),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $6
             RETURNING *`,
            [dayOfWeek, startTime, endTime, timezone, isAvailable, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Availability not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating availability:', error);
        res.status(500).json({ error: 'Failed to update availability' });
    }
});

/**
 * DELETE /api/scheduling/availability/:id
 * Delete availability schedule
 * Requires authentication - only admin/receptionist/doctor can delete availability
 */
router.delete('/availability/:id', authenticate, authorize('admin', 'receptionist', 'doctor'), async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { id } = req.params;

        const result = await pool.query(
            'DELETE FROM doctor_availability WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Availability not found' });
        }

        res.json({ message: 'Availability deleted successfully' });
    } catch (error) {
        console.error('Error deleting availability:', error);
        res.status(500).json({ error: 'Failed to delete availability' });
    }
});

/**
 * POST /api/scheduling/availability/bulk
 * Bulk create/update availability (useful for setting up weekly schedule)
 * Body: { providerId, schedules: [{ dayOfWeek, startTime, endTime, timezone }] }
 * Requires authentication - only admin/receptionist/doctor can bulk update availability
 */
router.post('/availability/bulk', authenticate, authorize('admin', 'receptionist', 'doctor'), async (req, res) => {
    const pool = req.app.locals.pool;
    const client = await pool.connect();
    try {
        const { providerId, schedules } = req.body;

        if (!providerId || !Array.isArray(schedules)) {
            return res.status(400).json({ error: 'Invalid request format' });
        }

        await client.query('BEGIN');

        // Delete existing schedules for this provider
        await client.query('DELETE FROM doctor_availability WHERE provider_id = $1', [providerId]);

        // Insert new schedules
        const insertedSchedules = [];
        for (const schedule of schedules) {
            const { dayOfWeek, startTime, endTime, timezone, isAvailable } = schedule;

            const result = await client.query(
                `INSERT INTO doctor_availability
                 (provider_id, day_of_week, start_time, end_time, timezone, is_available)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *`,
                [providerId, dayOfWeek, startTime, endTime, timezone || 'UTC', isAvailable !== false]
            );

            insertedSchedules.push(result.rows[0]);
        }

        await client.query('COMMIT');
        res.status(201).json(insertedSchedules);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error bulk creating availability:', error);
        res.status(500).json({ error: 'Failed to create availability schedules' });
    } finally {
        client.release();
    }
});

// ============================================================================
// DOCTOR TIME-OFF ROUTES
// ============================================================================

/**
 * GET /api/scheduling/time-off/:providerId
 * Get all time-off periods for a provider
 * Optional authentication - public can view
 */
router.get('/time-off/:providerId', optionalAuth, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { providerId } = req.params;

        const result = await pool.query(
            `SELECT * FROM doctor_time_off
             WHERE provider_id = $1
             ORDER BY start_date`,
            [providerId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching time-off:', error);
        res.status(500).json({ error: 'Failed to fetch time-off periods' });
    }
});

/**
 * POST /api/scheduling/time-off
 * Create time-off period
 * Body: { providerId, startDate, endDate, reason, isRecurring, recurrenceRule }
 * Requires authentication - only admin/receptionist/doctor can create time-off
 */
router.post('/time-off', authenticate, authorize('admin', 'receptionist', 'doctor'), async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { providerId, startDate, endDate, reason, isRecurring, recurrenceRule } = req.body;

        if (!providerId || !startDate || !endDate) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const result = await pool.query(
            `INSERT INTO doctor_time_off
             (provider_id, start_date, end_date, reason, is_recurring, recurrence_rule)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [providerId, startDate, endDate, reason, isRecurring || false, recurrenceRule]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating time-off:', error);
        res.status(500).json({ error: 'Failed to create time-off period' });
    }
});

/**
 * PUT /api/scheduling/time-off/:id
 * Update time-off period
 * Requires authentication - only admin/receptionist/doctor can update time-off
 */
router.put('/time-off/:id', authenticate, authorize('admin', 'receptionist', 'doctor'), async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { id } = req.params;
        const { startDate, endDate, reason, isRecurring, recurrenceRule } = req.body;

        const result = await pool.query(
            `UPDATE doctor_time_off
             SET start_date = COALESCE($1, start_date),
                 end_date = COALESCE($2, end_date),
                 reason = COALESCE($3, reason),
                 is_recurring = COALESCE($4, is_recurring),
                 recurrence_rule = COALESCE($5, recurrence_rule),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $6
             RETURNING *`,
            [startDate, endDate, reason, isRecurring, recurrenceRule, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Time-off period not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating time-off:', error);
        res.status(500).json({ error: 'Failed to update time-off period' });
    }
});

/**
 * DELETE /api/scheduling/time-off/:id
 * Delete time-off period
 * Requires authentication - only admin/receptionist/doctor can delete time-off
 */
router.delete('/time-off/:id', authenticate, authorize('admin', 'receptionist', 'doctor'), async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { id } = req.params;

        const result = await pool.query(
            'DELETE FROM doctor_time_off WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Time-off period not found' });
        }

        res.json({ message: 'Time-off period deleted successfully' });
    } catch (error) {
        console.error('Error deleting time-off:', error);
        res.status(500).json({ error: 'Failed to delete time-off period' });
    }
});

// ============================================================================
// APPOINTMENT TYPE CONFIGURATION ROUTES
// ============================================================================

/**
 * GET /api/scheduling/appointment-types/:providerId
 * Get all appointment types for a provider
 * Optional authentication - public can view for booking purposes
 */
router.get('/appointment-types/:providerId', optionalAuth, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { providerId } = req.params;

        const result = await pool.query(
            `SELECT * FROM appointment_type_config
             WHERE (provider_id = $1 OR provider_id IS NULL)
             AND is_active = true
             ORDER BY name`,
            [providerId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching appointment types:', error);
        res.status(500).json({ error: 'Failed to fetch appointment types' });
    }
});

/**
 * GET /api/scheduling/appointment-types
 * Get all appointment types (clinic-wide)
 * Optional authentication - public can view for booking purposes
 */
router.get('/appointment-types', optionalAuth, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const result = await pool.query(
            `SELECT * FROM appointment_type_config
             WHERE is_active = true
             ORDER BY name`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching appointment types:', error);
        res.status(500).json({ error: 'Failed to fetch appointment types' });
    }
});

/**
 * POST /api/scheduling/appointment-types
 * Create appointment type
 * Requires authentication - only admin/receptionist can create appointment types
 */
router.post('/appointment-types', authenticate, authorize('admin', 'receptionist'), async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const {
            providerId,
            name,
            description,
            durationMinutes,
            bufferMinutes,
            color,
            price,
            requiresApproval,
            maxAdvanceBookingDays,
            minAdvanceBookingHours
        } = req.body;

        if (!name || !durationMinutes) {
            return res.status(400).json({ error: 'Name and duration are required' });
        }

        const result = await pool.query(
            `INSERT INTO appointment_type_config
             (provider_id, name, description, duration_minutes, buffer_minutes, color,
              price, requires_approval, max_advance_booking_days, min_advance_booking_hours)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [
                providerId || null,
                name,
                description,
                durationMinutes,
                bufferMinutes || 0,
                color || '#3B82F6',
                price || 0,
                requiresApproval || false,
                maxAdvanceBookingDays || 90,
                minAdvanceBookingHours || 24
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating appointment type:', error);
        res.status(500).json({ error: 'Failed to create appointment type' });
    }
});

/**
 * PUT /api/scheduling/appointment-types/:id
 * Update appointment type
 * Requires authentication - only admin/receptionist can update appointment types
 */
router.put('/appointment-types/:id', authenticate, authorize('admin', 'receptionist'), async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { id } = req.params;
        const {
            name,
            description,
            durationMinutes,
            bufferMinutes,
            color,
            price,
            isActive,
            requiresApproval,
            maxAdvanceBookingDays,
            minAdvanceBookingHours
        } = req.body;

        const result = await pool.query(
            `UPDATE appointment_type_config
             SET name = COALESCE($1, name),
                 description = COALESCE($2, description),
                 duration_minutes = COALESCE($3, duration_minutes),
                 buffer_minutes = COALESCE($4, buffer_minutes),
                 color = COALESCE($5, color),
                 price = COALESCE($6, price),
                 is_active = COALESCE($7, is_active),
                 requires_approval = COALESCE($8, requires_approval),
                 max_advance_booking_days = COALESCE($9, max_advance_booking_days),
                 min_advance_booking_hours = COALESCE($10, min_advance_booking_hours),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $11
             RETURNING *`,
            [
                name,
                description,
                durationMinutes,
                bufferMinutes,
                color,
                price,
                isActive,
                requiresApproval,
                maxAdvanceBookingDays,
                minAdvanceBookingHours,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Appointment type not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating appointment type:', error);
        res.status(500).json({ error: 'Failed to update appointment type' });
    }
});

/**
 * DELETE /api/scheduling/appointment-types/:id
 * Delete appointment type
 * Requires authentication - only admin can delete appointment types
 */
router.delete('/appointment-types/:id', authenticate, authorize('admin'), async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { id } = req.params;

        const result = await pool.query(
            'DELETE FROM appointment_type_config WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Appointment type not found' });
        }

        res.json({ message: 'Appointment type deleted successfully' });
    } catch (error) {
        console.error('Error deleting appointment type:', error);
        res.status(500).json({ error: 'Failed to delete appointment type' });
    }
});

// ============================================================================
// BOOKING CONFIGURATION ROUTES
// ============================================================================

/**
 * GET /api/scheduling/booking-config/:providerId
 * Get booking configuration for a provider
 * Optional authentication - authenticated users get full config, public gets limited info
 */
router.get('/booking-config/:providerId', optionalAuth, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { providerId } = req.params;

        const result = await pool.query(
            'SELECT * FROM provider_booking_config WHERE provider_id = $1',
            [providerId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Booking configuration not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching booking config:', error);
        res.status(500).json({ error: 'Failed to fetch booking configuration' });
    }
});

/**
 * GET /api/scheduling/booking-config/slug/:slug
 * Get provider by booking URL slug (for public booking page)
 * No authentication required - public endpoint
 */
router.get('/booking-config/slug/:slug', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { slug } = req.params;

        const result = await pool.query(
            `SELECT pbc.*, p.first_name, p.last_name, p.email, p.phone
             FROM provider_booking_config pbc
             JOIN providers p ON p.id = pbc.provider_id
             WHERE pbc.booking_url_slug = $1 AND pbc.allow_public_booking = true`,
            [slug]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Provider not found or booking not available' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching provider by slug:', error);
        res.status(500).json({ error: 'Failed to fetch provider' });
    }
});

/**
 * POST /api/scheduling/booking-config
 * Create booking configuration
 * Requires authentication - only admin/receptionist can create booking config
 */
router.post('/booking-config', authenticate, authorize('admin', 'receptionist'), async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const {
            providerId,
            bookingUrlSlug,
            timezone,
            slotIntervalMinutes,
            maxConcurrentBookings,
            allowPublicBooking,
            requirePatientAccount,
            sendConfirmationEmail,
            sendReminderEmail,
            reminderHoursBefore,
            allowCancellation,
            cancellationHoursBefore,
            allowRescheduling,
            rescheduleHoursBefore,
            bookingInstructions,
            customFields
        } = req.body;

        if (!providerId) {
            return res.status(400).json({ error: 'Provider ID is required' });
        }

        const result = await pool.query(
            `INSERT INTO provider_booking_config
             (provider_id, booking_url_slug, timezone, slot_interval_minutes, max_concurrent_bookings,
              allow_public_booking, require_patient_account, send_confirmation_email, send_reminder_email,
              reminder_hours_before, allow_cancellation, cancellation_hours_before, allow_rescheduling,
              reschedule_hours_before, booking_instructions, custom_fields)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
             RETURNING *`,
            [
                providerId,
                bookingUrlSlug,
                timezone || 'UTC',
                slotIntervalMinutes || 15,
                maxConcurrentBookings || 1,
                allowPublicBooking !== false,
                requirePatientAccount || false,
                sendConfirmationEmail !== false,
                sendReminderEmail !== false,
                reminderHoursBefore || 24,
                allowCancellation !== false,
                cancellationHoursBefore || 24,
                allowRescheduling !== false,
                rescheduleHoursBefore || 24,
                bookingInstructions,
                JSON.stringify(customFields || [])
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating booking config:', error);
        if (error.code === '23505') { // Unique constraint violation
            return res.status(409).json({ error: 'Booking URL slug already exists' });
        }
        res.status(500).json({ error: 'Failed to create booking configuration' });
    }
});

/**
 * PUT /api/scheduling/booking-config/:providerId
 * Update booking configuration
 * Requires authentication - only admin/receptionist can update booking config
 */
router.put('/booking-config/:providerId', authenticate, authorize('admin', 'receptionist'), async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { providerId } = req.params;
        const {
            bookingUrlSlug,
            timezone,
            slotIntervalMinutes,
            maxConcurrentBookings,
            allowPublicBooking,
            requirePatientAccount,
            sendConfirmationEmail,
            sendReminderEmail,
            reminderHoursBefore,
            allowCancellation,
            cancellationHoursBefore,
            allowRescheduling,
            rescheduleHoursBefore,
            bookingInstructions,
            customFields
        } = req.body;

        const result = await pool.query(
            `UPDATE provider_booking_config
             SET booking_url_slug = COALESCE($1, booking_url_slug),
                 timezone = COALESCE($2, timezone),
                 slot_interval_minutes = COALESCE($3, slot_interval_minutes),
                 max_concurrent_bookings = COALESCE($4, max_concurrent_bookings),
                 allow_public_booking = COALESCE($5, allow_public_booking),
                 require_patient_account = COALESCE($6, require_patient_account),
                 send_confirmation_email = COALESCE($7, send_confirmation_email),
                 send_reminder_email = COALESCE($8, send_reminder_email),
                 reminder_hours_before = COALESCE($9, reminder_hours_before),
                 allow_cancellation = COALESCE($10, allow_cancellation),
                 cancellation_hours_before = COALESCE($11, cancellation_hours_before),
                 allow_rescheduling = COALESCE($12, allow_rescheduling),
                 reschedule_hours_before = COALESCE($13, reschedule_hours_before),
                 booking_instructions = COALESCE($14, booking_instructions),
                 custom_fields = COALESCE($15, custom_fields),
                 updated_at = CURRENT_TIMESTAMP
             WHERE provider_id = $16
             RETURNING *`,
            [
                bookingUrlSlug,
                timezone,
                slotIntervalMinutes,
                maxConcurrentBookings,
                allowPublicBooking,
                requirePatientAccount,
                sendConfirmationEmail,
                sendReminderEmail,
                reminderHoursBefore,
                allowCancellation,
                cancellationHoursBefore,
                allowRescheduling,
                rescheduleHoursBefore,
                bookingInstructions,
                customFields ? JSON.stringify(customFields) : null,
                providerId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Booking configuration not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating booking config:', error);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Booking URL slug already exists' });
        }
        res.status(500).json({ error: 'Failed to update booking configuration' });
    }
});

// ============================================================================
// TIME SLOT GENERATION AND AVAILABILITY CHECKING
// ============================================================================

/**
 * GET /api/scheduling/slots/:providerId
 * Generate available time slots for a provider
 * Query params: date (YYYY-MM-DD), appointmentTypeId, timezone
 * No authentication required - public endpoint for booking
 */
router.get('/slots/:providerId', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { providerId } = req.params;
        const { date, appointmentTypeId, timezone = 'UTC' } = req.query;

        if (!date) {
            return res.status(400).json({ error: 'Date parameter is required' });
        }

        // Get appointment type configuration
        let appointmentType;
        if (appointmentTypeId) {
            const typeResult = await pool.query(
                'SELECT * FROM appointment_type_config WHERE id = $1 AND is_active = true',
                [appointmentTypeId]
            );
            if (typeResult.rows.length === 0) {
                return res.status(404).json({ error: 'Appointment type not found' });
            }
            appointmentType = typeResult.rows[0];
        } else {
            // Use default 30-minute slots
            appointmentType = {
                duration_minutes: 30,
                buffer_minutes: 0,
                min_advance_booking_hours: 0,
                max_advance_booking_days: 90
            };
        }

        // Get booking configuration
        const configResult = await pool.query(
            'SELECT * FROM provider_booking_config WHERE provider_id = $1',
            [providerId]
        );

        const bookingConfig = configResult.rows[0] || {
            slot_interval_minutes: 15,
            timezone: 'UTC'
        };

        // Get day of week for the requested date
        const requestedDate = new Date(date);
        const dayOfWeek = requestedDate.getDay();

        // Get availability schedule for that day
        const availabilityResult = await pool.query(
            `SELECT * FROM doctor_availability
             WHERE provider_id = $1 AND day_of_week = $2 AND is_available = true`,
            [providerId, dayOfWeek]
        );

        if (availabilityResult.rows.length === 0) {
            return res.json([]); // No availability on this day
        }

        // Get existing appointments for the day
        const appointmentsResult = await pool.query(
            `SELECT start_time, end_time FROM appointments
             WHERE provider_id = $1
             AND DATE(start_time) = $2
             AND status NOT IN ('cancelled', 'no-show')`,
            [providerId, date]
        );

        // Get time-off periods
        const timeOffResult = await pool.query(
            `SELECT start_date, end_date FROM doctor_time_off
             WHERE provider_id = $1
             AND start_date <= $2::timestamp + interval '1 day'
             AND end_date >= $2::timestamp`,
            [providerId, date]
        );

        // Generate time slots
        const slots = [];
        const slotDuration = appointmentType.duration_minutes;
        const slotInterval = bookingConfig.slot_interval_minutes;

        for (const availability of availabilityResult.rows) {
            const [startHour, startMinute] = availability.start_time.split(':').map(Number);
            const [endHour, endMinute] = availability.end_time.split(':').map(Number);

            let currentHour = startHour;
            let currentMinute = startMinute;

            while (
                currentHour < endHour ||
                (currentHour === endHour && currentMinute + slotDuration <= endMinute)
            ) {
                const slotStart = new Date(date);
                slotStart.setHours(currentHour, currentMinute, 0, 0);

                const slotEnd = new Date(slotStart);
                slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);

                // Check if slot is in the past
                const now = new Date();
                if (slotStart <= now) {
                    currentMinute += slotInterval;
                    if (currentMinute >= 60) {
                        currentHour += Math.floor(currentMinute / 60);
                        currentMinute = currentMinute % 60;
                    }
                    continue;
                }

                // Check if slot conflicts with existing appointments
                const hasConflict = appointmentsResult.rows.some(apt => {
                    const aptStart = new Date(apt.start_time);
                    const aptEnd = new Date(apt.end_time);
                    return (
                        (slotStart >= aptStart && slotStart < aptEnd) ||
                        (slotEnd > aptStart && slotEnd <= aptEnd) ||
                        (slotStart <= aptStart && slotEnd >= aptEnd)
                    );
                });

                // Check if slot conflicts with time-off
                const hasTimeOff = timeOffResult.rows.some(timeOff => {
                    const timeOffStart = new Date(timeOff.start_date);
                    const timeOffEnd = new Date(timeOff.end_date);
                    return (
                        (slotStart >= timeOffStart && slotStart < timeOffEnd) ||
                        (slotEnd > timeOffStart && slotEnd <= timeOffEnd) ||
                        (slotStart <= timeOffStart && slotEnd >= timeOffEnd)
                    );
                });

                if (!hasConflict && !hasTimeOff) {
                    slots.push({
                        startTime: slotStart.toISOString(),
                        endTime: slotEnd.toISOString(),
                        available: true
                    });
                }

                // Move to next slot
                currentMinute += slotInterval;
                if (currentMinute >= 60) {
                    currentHour += Math.floor(currentMinute / 60);
                    currentMinute = currentMinute % 60;
                }
            }
        }

        res.json(slots);
    } catch (error) {
        console.error('Error generating time slots:', error);
        res.status(500).json({ error: 'Failed to generate time slots' });
    }
});

/**
 * GET /api/scheduling/available-dates/:providerId
 * Get available dates for a provider within a date range
 * Query params: startDate, endDate, appointmentTypeId
 * No authentication required - public endpoint for booking
 */
router.get('/available-dates/:providerId', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { providerId } = req.params;
        const { startDate, endDate, appointmentTypeId } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }

        // Get availability schedules
        const availabilityResult = await pool.query(
            `SELECT DISTINCT day_of_week FROM doctor_availability
             WHERE provider_id = $1 AND is_available = true`,
            [providerId]
        );

        const availableDays = availabilityResult.rows.map(row => row.day_of_week);

        if (availableDays.length === 0) {
            return res.json([]);
        }

        // Get time-off periods
        const timeOffResult = await pool.query(
            `SELECT DATE(start_date) as start_date, DATE(end_date) as end_date
             FROM doctor_time_off
             WHERE provider_id = $1
             AND start_date <= $2::timestamp
             AND end_date >= $3::timestamp`,
            [providerId, endDate, startDate]
        );

        const timeOffDates = new Set();
        timeOffResult.rows.forEach(timeOff => {
            const start = new Date(timeOff.start_date);
            const end = new Date(timeOff.end_date);
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                timeOffDates.add(d.toISOString().split('T')[0]);
            }
        });

        // Generate list of available dates
        const availableDates = [];
        const start = new Date(startDate);
        const end = new Date(endDate);

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dayOfWeek = d.getDay();
            const dateStr = d.toISOString().split('T')[0];

            // Check if day is in available days and not in time-off
            if (availableDays.includes(dayOfWeek) && !timeOffDates.has(dateStr)) {
                // Check if date is in the past
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (d >= today) {
                    availableDates.push(dateStr);
                }
            }
        }

        res.json(availableDates);
    } catch (error) {
        console.error('Error getting available dates:', error);
        res.status(500).json({ error: 'Failed to get available dates' });
    }
});

/**
 * POST /api/scheduling/check-availability
 * Check if a specific time slot is available
 * Body: { providerId, startTime, endTime }
 */
router.post('/check-availability', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { providerId, startTime, endTime } = req.body;

        if (!providerId || !startTime || !endTime) {
            return res.status(400).json({ error: 'providerId, startTime, and endTime are required' });
        }

        // Use the database function to check availability
        const result = await pool.query(
            'SELECT is_slot_available($1, $2, $3) as available',
            [providerId, startTime, endTime]
        );

        res.json({ available: result.rows[0].available });
    } catch (error) {
        console.error('Error checking availability:', error);
        res.status(500).json({ error: 'Failed to check availability' });
    }
});

// ============================================================================
// PUBLIC BOOKING ENDPOINTS
// ============================================================================

/**
 * POST /api/scheduling/book
 * Public booking endpoint - create appointment without authentication
 * Body: { providerId, patientInfo, startTime, appointmentTypeId, customFormData }
 */
router.post('/book', async (req, res) => {
    const pool = req.app.locals.pool;
    const client = await pool.connect();
    try {
        const {
            providerId,
            patientInfo, // { firstName, lastName, email, phone, dob }
            startTime,
            appointmentTypeId,
            customFormData = {}
        } = req.body;

        // Validation
        if (!providerId || !patientInfo || !startTime || !appointmentTypeId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        await client.query('BEGIN');

        // Get appointment type
        const typeResult = await client.query(
            'SELECT * FROM appointment_type_config WHERE id = $1 AND is_active = true',
            [appointmentTypeId]
        );

        if (typeResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Appointment type not found' });
        }

        const appointmentType = typeResult.rows[0];
        const endTime = new Date(new Date(startTime).getTime() + appointmentType.duration_minutes * 60000);

        // Check availability
        const availabilityCheck = await client.query(
            'SELECT is_slot_available($1, $2, $3) as available',
            [providerId, startTime, endTime]
        );

        if (!availabilityCheck.rows[0].available) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Time slot is no longer available' });
        }

        // Find or create patient
        let patientId;
        const existingPatient = await client.query(
            'SELECT id FROM patients WHERE email = $1',
            [patientInfo.email]
        );

        if (existingPatient.rows.length > 0) {
            patientId = existingPatient.rows[0].id;
        } else {
            // Create new patient
            const newPatient = await client.query(
                `INSERT INTO patients
                 (first_name, last_name, email, phone, dob, status)
                 VALUES ($1, $2, $3, $4, $5, 'Active')
                 RETURNING id`,
                [
                    patientInfo.firstName,
                    patientInfo.lastName,
                    patientInfo.email,
                    patientInfo.phone,
                    patientInfo.dob || null
                ]
            );
            patientId = newPatient.rows[0].id;
        }

        // Create appointment
        const appointment = await client.query(
            `INSERT INTO appointments
             (patient_id, provider_id, start_time, end_time, duration_minutes,
              appointment_type, appointment_type_id, status, booking_source,
              reason, custom_form_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [
                patientId,
                providerId,
                startTime,
                endTime,
                appointmentType.duration_minutes,
                appointmentType.name,
                appointmentTypeId,
                appointmentType.requires_approval ? 'pending' : 'scheduled',
                'public',
                customFormData.reason || '',
                JSON.stringify(customFormData)
            ]
        );

        // Get booking config for reminders
        const configResult = await client.query(
            'SELECT * FROM provider_booking_config WHERE provider_id = $1',
            [providerId]
        );

        const config = configResult.rows[0];

        // Schedule confirmation email
        if (config && config.send_confirmation_email) {
            await client.query(
                `INSERT INTO appointment_reminders
                 (appointment_id, reminder_type, scheduled_for, delivery_status)
                 VALUES ($1, 'email', CURRENT_TIMESTAMP, 'pending')`,
                [appointment.rows[0].id]
            );
        }

        // Schedule reminder
        if (config && config.send_reminder_email) {
            const reminderTime = new Date(new Date(startTime).getTime() - config.reminder_hours_before * 3600000);
            await client.query(
                `INSERT INTO appointment_reminders
                 (appointment_id, reminder_type, scheduled_for, delivery_status)
                 VALUES ($1, 'email', $2, 'pending')`,
                [appointment.rows[0].id, reminderTime]
            );
        }

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            appointment: appointment.rows[0],
            message: appointmentType.requires_approval
                ? 'Appointment request submitted. Waiting for approval.'
                : 'Appointment booked successfully!'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error booking appointment:', error);
        res.status(500).json({ error: 'Failed to book appointment' });
    } finally {
        client.release();
    }
});

/**
 * POST /api/scheduling/cancel/:appointmentId
 * Cancel an appointment
 * Body: { cancellationReason, cancelledBy (optional) }
 */
router.post('/cancel/:appointmentId', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { appointmentId } = req.params;
        const { cancellationReason, cancelledBy } = req.body;

        // Get appointment
        const appointmentResult = await pool.query(
            'SELECT * FROM appointments WHERE id = $1',
            [appointmentId]
        );

        if (appointmentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        const appointment = appointmentResult.rows[0];

        if (appointment.status === 'cancelled') {
            return res.status(400).json({ error: 'Appointment is already cancelled' });
        }

        // Get booking config to check cancellation policy
        const configResult = await pool.query(
            'SELECT * FROM provider_booking_config WHERE provider_id = $1',
            [appointment.provider_id]
        );

        const config = configResult.rows[0];

        if (config && !config.allow_cancellation) {
            return res.status(403).json({ error: 'Cancellation is not allowed for this provider' });
        }

        // Check cancellation deadline
        if (config && config.cancellation_hours_before) {
            const appointmentTime = new Date(appointment.start_time);
            const now = new Date();
            const hoursUntilAppointment = (appointmentTime - now) / (1000 * 60 * 60);

            if (hoursUntilAppointment < config.cancellation_hours_before) {
                return res.status(403).json({
                    error: `Cancellation must be done at least ${config.cancellation_hours_before} hours before the appointment`
                });
            }
        }

        // Cancel appointment
        const result = await pool.query(
            `UPDATE appointments
             SET status = 'cancelled',
                 cancelled_at = CURRENT_TIMESTAMP,
                 cancelled_by = $1,
                 cancellation_reason = $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`,
            [cancelledBy || null, cancellationReason || '', appointmentId]
        );

        // Cancel pending reminders
        await pool.query(
            `UPDATE appointment_reminders
             SET delivery_status = 'cancelled'
             WHERE appointment_id = $1 AND delivery_status = 'pending'`,
            [appointmentId]
        );

        res.json({
            success: true,
            appointment: result.rows[0],
            message: 'Appointment cancelled successfully'
        });
    } catch (error) {
        console.error('Error cancelling appointment:', error);
        res.status(500).json({ error: 'Failed to cancel appointment' });
    }
});

/**
 * POST /api/scheduling/reschedule/:appointmentId
 * Reschedule an appointment
 * Body: { newStartTime, reason }
 */
router.post('/reschedule/:appointmentId', async (req, res) => {
    const pool = req.app.locals.pool;
    const client = await pool.connect();
    try {
        const { appointmentId } = req.params;
        const { newStartTime, reason } = req.body;

        if (!newStartTime) {
            return res.status(400).json({ error: 'newStartTime is required' });
        }

        await client.query('BEGIN');

        // Get appointment
        const appointmentResult = await client.query(
            'SELECT * FROM appointments WHERE id = $1',
            [appointmentId]
        );

        if (appointmentResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Appointment not found' });
        }

        const appointment = appointmentResult.rows[0];

        // Get booking config to check rescheduling policy
        const configResult = await client.query(
            'SELECT * FROM provider_booking_config WHERE provider_id = $1',
            [appointment.provider_id]
        );

        const config = configResult.rows[0];

        if (config && !config.allow_rescheduling) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Rescheduling is not allowed for this provider' });
        }

        // Check rescheduling deadline
        if (config && config.reschedule_hours_before) {
            const appointmentTime = new Date(appointment.start_time);
            const now = new Date();
            const hoursUntilAppointment = (appointmentTime - now) / (1000 * 60 * 60);

            if (hoursUntilAppointment < config.reschedule_hours_before) {
                await client.query('ROLLBACK');
                return res.status(403).json({
                    error: `Rescheduling must be done at least ${config.reschedule_hours_before} hours before the appointment`
                });
            }
        }

        // Calculate new end time
        const newEndTime = new Date(new Date(newStartTime).getTime() + appointment.duration_minutes * 60000);

        // Check if new slot is available
        const availabilityCheck = await client.query(
            'SELECT is_slot_available($1, $2, $3) as available',
            [appointment.provider_id, newStartTime, newEndTime]
        );

        if (!availabilityCheck.rows[0].available) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'New time slot is not available' });
        }

        // Update appointment
        const result = await client.query(
            `UPDATE appointments
             SET start_time = $1,
                 end_time = $2,
                 rescheduled_from = $3,
                 notes = CONCAT(COALESCE(notes, ''), '\nRescheduled: ', $4),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $5
             RETURNING *`,
            [newStartTime, newEndTime, appointmentId, reason || 'No reason provided', appointmentId]
        );

        // Reschedule reminders
        if (config && config.send_reminder_email) {
            const reminderTime = new Date(new Date(newStartTime).getTime() - config.reminder_hours_before * 3600000);
            await client.query(
                `UPDATE appointment_reminders
                 SET scheduled_for = $1, delivery_status = 'pending'
                 WHERE appointment_id = $2 AND reminder_type = 'email'`,
                [reminderTime, appointmentId]
            );
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            appointment: result.rows[0],
            message: 'Appointment rescheduled successfully'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error rescheduling appointment:', error);
        res.status(500).json({ error: 'Failed to reschedule appointment' });
    } finally {
        client.release();
    }
});

module.exports = router;
