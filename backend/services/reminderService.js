const nodemailer = require('nodemailer');
const pool = require('../db');
const WhatsAppService = require('./whatsappService');

// Create nodemailer transporter
const transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
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
        const formattedTime = appointmentDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const mailOptions = {
            from: `"${process.env.CLINIC_NAME || 'MedFlow'}" <${process.env.SMTP_USER}>`,
            to: patient.email,
            subject: `Appointment Confirmation - ${formattedDate}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            line-height: 1.6;
                            color: #333;
                        }
                        .container {
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        .header {
                            background-color: #3B82F6;
                            color: white;
                            padding: 20px;
                            text-align: center;
                            border-radius: 5px 5px 0 0;
                        }
                        .content {
                            background-color: #f9f9f9;
                            padding: 30px;
                            border-radius: 0 0 5px 5px;
                        }
                        .appointment-details {
                            background-color: white;
                            padding: 20px;
                            border-radius: 5px;
                            margin: 20px 0;
                        }
                        .detail-row {
                            display: flex;
                            justify-content: space-between;
                            padding: 10px 0;
                            border-bottom: 1px solid #eee;
                        }
                        .detail-row:last-child {
                            border-bottom: none;
                        }
                        .label {
                            font-weight: bold;
                            color: #666;
                        }
                        .value {
                            color: #333;
                        }
                        .footer {
                            text-align: center;
                            margin-top: 20px;
                            padding-top: 20px;
                            border-top: 1px solid #ddd;
                            color: #666;
                            font-size: 14px;
                        }
                        .button {
                            display: inline-block;
                            padding: 12px 24px;
                            background-color: #3B82F6;
                            color: white !important;
                            text-decoration: none;
                            border-radius: 5px;
                            margin: 10px 5px;
                        }
                        .button-secondary {
                            background-color: #6B7280;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Appointment Confirmed</h1>
                        </div>
                        <div class="content">
                            <p>Dear ${patient.first_name} ${patient.last_name},</p>
                            <p>Your appointment has been confirmed. Here are the details:</p>

                            <div class="appointment-details">
                                <div class="detail-row">
                                    <span class="label">Date:</span>
                                    <span class="value">${formattedDate}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Time:</span>
                                    <span class="value">${formattedTime}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Provider:</span>
                                    <span class="value">Dr. ${provider.first_name} ${provider.last_name}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Appointment Type:</span>
                                    <span class="value">${appointment.appointment_type}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Duration:</span>
                                    <span class="value">${appointment.duration_minutes} minutes</span>
                                </div>
                                ${appointment.reason ? `
                                <div class="detail-row">
                                    <span class="label">Reason:</span>
                                    <span class="value">${appointment.reason}</span>
                                </div>
                                ` : ''}
                            </div>

                            <div style="text-align: center; margin-top: 20px;">
                                ${process.env.FRONTEND_URL ? `
                                <a href="${process.env.FRONTEND_URL}/appointments/${appointment.id}" class="button">
                                    View Appointment
                                </a>
                                <a href="${process.env.FRONTEND_URL}/api/scheduling/cancel/${appointment.id}" class="button button-secondary">
                                    Cancel Appointment
                                </a>
                                ` : ''}
                            </div>

                            <p style="margin-top: 30px;">
                                If you need to cancel or reschedule, please do so at least 24 hours in advance.
                            </p>

                            <p>Thank you for choosing ${process.env.CLINIC_NAME || 'MedFlow'}!</p>
                        </div>
                        <div class="footer">
                            <p>This is an automated message. Please do not reply to this email.</p>
                            <p>&copy; ${new Date().getFullYear()} ${process.env.CLINIC_NAME || 'MedFlow'}. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
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
        const formattedTime = appointmentDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const hoursUntil = Math.floor((appointmentDate - new Date()) / (1000 * 60 * 60));

        const mailOptions = {
            from: `"${process.env.CLINIC_NAME || 'MedFlow'}" <${process.env.SMTP_USER}>`,
            to: patient.email,
            subject: `Appointment Reminder - ${formattedDate}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            line-height: 1.6;
                            color: #333;
                        }
                        .container {
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        .header {
                            background-color: #F59E0B;
                            color: white;
                            padding: 20px;
                            text-align: center;
                            border-radius: 5px 5px 0 0;
                        }
                        .content {
                            background-color: #f9f9f9;
                            padding: 30px;
                            border-radius: 0 0 5px 5px;
                        }
                        .reminder-badge {
                            background-color: #FEF3C7;
                            border-left: 4px solid #F59E0B;
                            padding: 15px;
                            margin: 20px 0;
                            border-radius: 5px;
                        }
                        .appointment-details {
                            background-color: white;
                            padding: 20px;
                            border-radius: 5px;
                            margin: 20px 0;
                        }
                        .detail-row {
                            display: flex;
                            justify-content: space-between;
                            padding: 10px 0;
                            border-bottom: 1px solid #eee;
                        }
                        .detail-row:last-child {
                            border-bottom: none;
                        }
                        .label {
                            font-weight: bold;
                            color: #666;
                        }
                        .value {
                            color: #333;
                        }
                        .footer {
                            text-align: center;
                            margin-top: 20px;
                            padding-top: 20px;
                            border-top: 1px solid #ddd;
                            color: #666;
                            font-size: 14px;
                        }
                        .button {
                            display: inline-block;
                            padding: 12px 24px;
                            background-color: #3B82F6;
                            color: white !important;
                            text-decoration: none;
                            border-radius: 5px;
                            margin: 10px 5px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>⏰ Appointment Reminder</h1>
                        </div>
                        <div class="content">
                            <p>Dear ${patient.first_name} ${patient.last_name},</p>

                            <div class="reminder-badge">
                                <strong>You have an upcoming appointment in approximately ${hoursUntil} hours!</strong>
                            </div>

                            <p>Here are your appointment details:</p>

                            <div class="appointment-details">
                                <div class="detail-row">
                                    <span class="label">Date:</span>
                                    <span class="value">${formattedDate}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Time:</span>
                                    <span class="value">${formattedTime}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Provider:</span>
                                    <span class="value">Dr. ${provider.first_name} ${provider.last_name}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Appointment Type:</span>
                                    <span class="value">${appointment.appointment_type}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Duration:</span>
                                    <span class="value">${appointment.duration_minutes} minutes</span>
                                </div>
                            </div>

                            <div style="text-align: center; margin-top: 20px;">
                                ${process.env.FRONTEND_URL ? `
                                <a href="${process.env.FRONTEND_URL}/appointments/${appointment.id}" class="button">
                                    View Details
                                </a>
                                ` : ''}
                            </div>

                            <p style="margin-top: 30px;">
                                <strong>Please arrive 15 minutes early</strong> for check-in.
                            </p>

                            <p>If you need to cancel or reschedule, please contact us as soon as possible.</p>

                            <p>We look forward to seeing you!</p>
                        </div>
                        <div class="footer">
                            <p>This is an automated reminder. Please do not reply to this email.</p>
                            <p>&copy; ${new Date().getFullYear()} ${process.env.CLINIC_NAME || 'MedFlow'}. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
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
        const formattedTime = appointmentDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const mailOptions = {
            from: `"${process.env.CLINIC_NAME || 'MedFlow'}" <${process.env.SMTP_USER}>`,
            to: patient.email,
            subject: `Appointment Cancelled - ${formattedDate}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            line-height: 1.6;
                            color: #333;
                        }
                        .container {
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        .header {
                            background-color: #EF4444;
                            color: white;
                            padding: 20px;
                            text-align: center;
                            border-radius: 5px 5px 0 0;
                        }
                        .content {
                            background-color: #f9f9f9;
                            padding: 30px;
                            border-radius: 0 0 5px 5px;
                        }
                        .appointment-details {
                            background-color: white;
                            padding: 20px;
                            border-radius: 5px;
                            margin: 20px 0;
                        }
                        .detail-row {
                            display: flex;
                            justify-content: space-between;
                            padding: 10px 0;
                            border-bottom: 1px solid #eee;
                        }
                        .detail-row:last-child {
                            border-bottom: none;
                        }
                        .label {
                            font-weight: bold;
                            color: #666;
                        }
                        .value {
                            color: #333;
                        }
                        .footer {
                            text-align: center;
                            margin-top: 20px;
                            padding-top: 20px;
                            border-top: 1px solid #ddd;
                            color: #666;
                            font-size: 14px;
                        }
                        .button {
                            display: inline-block;
                            padding: 12px 24px;
                            background-color: #3B82F6;
                            color: white !important;
                            text-decoration: none;
                            border-radius: 5px;
                            margin: 10px 5px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Appointment Cancelled</h1>
                        </div>
                        <div class="content">
                            <p>Dear ${patient.first_name} ${patient.last_name},</p>

                            <p>This is to confirm that your appointment has been cancelled.</p>

                            <div class="appointment-details">
                                <div class="detail-row">
                                    <span class="label">Date:</span>
                                    <span class="value">${formattedDate}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Time:</span>
                                    <span class="value">${formattedTime}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Provider:</span>
                                    <span class="value">Dr. ${provider.first_name} ${provider.last_name}</span>
                                </div>
                                ${appointment.cancellation_reason ? `
                                <div class="detail-row">
                                    <span class="label">Reason:</span>
                                    <span class="value">${appointment.cancellation_reason}</span>
                                </div>
                                ` : ''}
                            </div>

                            <div style="text-align: center; margin-top: 20px;">
                                ${process.env.FRONTEND_URL ? `
                                <a href="${process.env.FRONTEND_URL}/book" class="button">
                                    Book a New Appointment
                                </a>
                                ` : ''}
                            </div>

                            <p style="margin-top: 30px;">
                                If you would like to schedule a new appointment, please visit our website or contact us.
                            </p>

                            <p>Thank you!</p>
                        </div>
                        <div class="footer">
                            <p>This is an automated message. Please do not reply to this email.</p>
                            <p>&copy; ${new Date().getFullYear()} ${process.env.CLINIC_NAME || 'MedFlow'}. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
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
