const nodemailer = require('nodemailer');
const pool = require('../db');
const WhatsAppService = require('./whatsappService');
const {
    renderAppointmentConfirmationEmail,
    renderAppointmentReminderEmail,
    renderAppointmentCancellationEmail,
} = require('./emailTemplates');

// Create nodemailer transporter
const transporter = nodemailer.createTransporter({
    host: process.env.AC_SM_H || 'smtp.gmail.com',
    port: process.env.AC_SM_P || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.AC_SM_U,
        pass: process.env.AC_SM_W
    }
});

// Initialize WhatsApp service
let whatsappService = null;

/**
 * Initialize WhatsApp service with configuration from database
 */
async function initWhatsAppService() {
    try {
        const config = await WhatsAppService.getConfig(pool);
        if (config && config.enabled) {
            whatsappService = new WhatsAppService(config);
            console.log('WhatsApp service initialized');
        }
    } catch (error) {
        console.error('Error initializing WhatsApp service:', error);
    }
}

/**
 * Check if patient has WhatsApp enabled
 */
async function isWhatsAppEnabled(patientId) {
    try {
        const result = await pool.query(
            `SELECT is_enabled FROM notification_preferences
             WHERE patient_id = $1 AND channel_type = 'whatsapp'`,
            [patientId]
        );
        return result.rows.length > 0 && result.rows[0].is_enabled;
    } catch (error) {
        console.error('Error checking WhatsApp preference:', error);
        return false;
    }
}

/**
 * Send appointment confirmation email
 * @param {Object} appointment - Appointment details
 * @param {Object} patient - Patient details
 * @param {Object} provider - Provider details
 */
async function sendConfirmationEmail(appointment, patient, provider) {
    try {
        const appointmentDate = new Date(appointment.start_time);
        const formattedDate = appointmentDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const mailOptions = {
            from: `"${process.env.AC_CLN || 'AureonCare'}" <${process.env.AC_SM_U}>`,
            to: patient.email,
            subject: `Appointment Confirmation - ${formattedDate}`,
            html: renderAppointmentConfirmationEmail({ appointment, patient, provider })
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Confirmation email sent:', info.messageId);

        // Update reminder status in database
        await pool.query(
            `UPDATE appointment_reminders
             SET sent_at = CURRENT_TIMESTAMP,
                 delivery_status = 'sent'
             WHERE appointment_id = $1 AND reminder_type = 'email'
             AND delivery_status = 'pending'
             AND scheduled_for <= CURRENT_TIMESTAMP + INTERVAL '5 minutes'`,
            [appointment.id]
        );

        // Also send WhatsApp if enabled
        if (whatsappService && await isWhatsAppEnabled(patient.id)) {
            try {
                await whatsappService.sendAppointmentConfirmation(appointment, patient, provider);
                console.log('WhatsApp confirmation sent to patient:', patient.id);
            } catch (whatsappError) {
                console.error('Error sending WhatsApp confirmation:', whatsappError);
                // Don't fail the whole operation if WhatsApp fails
            }
        }

        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending confirmation email:', error);

        // Update reminder status to failed
        await pool.query(
            `UPDATE appointment_reminders
             SET delivery_status = 'failed',
                 error_message = $1
             WHERE appointment_id = $2 AND reminder_type = 'email' AND delivery_status = 'pending'`,
            [error.message, appointment.id]
        );

        return { success: false, error: error.message };
    }
}

/**
 * Send appointment reminder email
 * @param {Object} appointment - Appointment details
 * @param {Object} patient - Patient details
 * @param {Object} provider - Provider details
 */
async function sendReminderEmail(appointment, patient, provider) {
    try {
        const appointmentDate = new Date(appointment.start_time);
        const formattedDate = appointmentDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const mailOptions = {
            from: `"${process.env.AC_CLN || 'AureonCare'}" <${process.env.AC_SM_U}>`,
            to: patient.email,
            subject: `Appointment Reminder - ${formattedDate}`,
            html: renderAppointmentReminderEmail({ appointment, patient, provider })
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Reminder email sent:', info.messageId);

        // Update reminder status in database
        await pool.query(
            `UPDATE appointment_reminders
             SET sent_at = CURRENT_TIMESTAMP,
                 delivery_status = 'sent'
             WHERE appointment_id = $1 AND reminder_type = 'email' AND delivery_status = 'pending'`,
            [appointment.id]
        );

        // Also send WhatsApp reminder if enabled
        if (whatsappService && await isWhatsAppEnabled(patient.id)) {
            try {
                await whatsappService.sendAppointmentReminder(appointment, patient, provider);
                console.log('WhatsApp reminder sent to patient:', patient.id);
            } catch (whatsappError) {
                console.error('Error sending WhatsApp reminder:', whatsappError);
                // Don't fail the whole operation if WhatsApp fails
            }
        }

        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending reminder email:', error);

        // Update reminder status to failed
        await pool.query(
            `UPDATE appointment_reminders
             SET delivery_status = 'failed',
                 error_message = $1
             WHERE appointment_id = $2 AND reminder_type = 'email' AND delivery_status = 'pending'`,
            [error.message, appointment.id]
        );

        return { success: false, error: error.message };
    }
}

/**
 * Send cancellation confirmation email
 * @param {Object} appointment - Appointment details
 * @param {Object} patient - Patient details
 * @param {Object} provider - Provider details
 */
async function sendCancellationEmail(appointment, patient, provider) {
    try {
        const appointmentDate = new Date(appointment.start_time);
        const formattedDate = appointmentDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const mailOptions = {
            from: `"${process.env.AC_CLN || 'AureonCare'}" <${process.env.AC_SM_U}>`,
            to: patient.email,
            subject: `Appointment Cancelled - ${formattedDate}`,
            html: renderAppointmentCancellationEmail({ appointment, patient, provider })
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Cancellation email sent:', info.messageId);

        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending cancellation email:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Process pending reminders
 * This function should be called periodically (e.g., every 5 minutes via cron job)
 */
async function processPendingReminders() {
    try {
        // Get pending reminders that are due
        const remindersResult = await pool.query(
            `SELECT ar.*, a.*,
                    p.id as patient_id, p.first_name as patient_first_name, p.last_name as patient_last_name, p.email as patient_email,
                    pr.id as provider_id, pr.first_name as provider_first_name, pr.last_name as provider_last_name
             FROM appointment_reminders ar
             JOIN appointments a ON a.id = ar.appointment_id
             JOIN patients p ON p.id = a.patient_id
             JOIN providers pr ON pr.id = a.provider_id
             WHERE ar.delivery_status = 'pending'
             AND ar.scheduled_for <= CURRENT_TIMESTAMP
             AND a.status IN ('scheduled', 'pending')
             LIMIT 50`
        );

        console.log(`Processing ${remindersResult.rows.length} pending reminders...`);

        for (const row of remindersResult.rows) {
            const appointment = {
                id: row.appointment_id,
                start_time: row.start_time,
                appointment_type: row.appointment_type,
                duration_minutes: row.duration_minutes,
                reason: row.reason
            };

            const patient = {
                id: row.patient_id,
                first_name: row.patient_first_name,
                last_name: row.patient_last_name,
                email: row.patient_email
            };

            const provider = {
                id: row.provider_id,
                first_name: row.provider_first_name,
                last_name: row.provider_last_name
            };

            // Check if it's a confirmation or reminder
            const isConfirmation = new Date(row.scheduled_for) <= new Date(new Date().getTime() + 5 * 60000);

            if (isConfirmation) {
                await sendConfirmationEmail(appointment, patient, provider);
            } else {
                await sendReminderEmail(appointment, patient, provider);
            }
        }

        return { success: true, processed: remindersResult.rows.length };
    } catch (error) {
        console.error('Error processing reminders:', error);
        return { success: false, error: error.message };
    }
}

// Initialize WhatsApp service on module load
initWhatsAppService();

module.exports = {
    sendConfirmationEmail,
    sendReminderEmail,
    sendCancellationEmail,
    processPendingReminders,
    initWhatsAppService
};
