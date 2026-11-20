const axios = require('axios');

// Meta Graph API version for the WhatsApp Cloud API. v18.0 (the old hard-coded value) is
// past Meta's ~2-year support window; v26.0 was released 2026-07-29. Override with
// AC_WA_GRAPH_VERSION when Meta retires it (developers.facebook.com/docs/graph-api/changelog/versions).
const DEFAULT_GRAPH_VERSION = 'v26.0';
const SECRET_KEYS = ['auth_token', 'account_sid', 'access_token', 'api_key', 'token', 'secret'];

/**
 * WhatsApp Notification Service
 * Supports multiple providers: Twilio, WhatsApp Business API, etc.
 */

class WhatsAppService {
  constructor(config) {
    this.config = config || {};
    this.provider = config?.provider || 'twilio'; // Default to Twilio
  }

  /**
   * The WhatsApp configuration, or null when WhatsApp is not set up.
   *
   * Credentials come ONLY from the environment (platform-level, like Stripe — SEC-38):
   *   AC_WA_PROVIDER        'twilio' | 'whatsapp_business'
   *   Twilio:               AC_WA_TWILIO_SID, AC_WA_TWILIO_TOKEN, AC_WA_TWILIO_FROM (+E.164)
   *   Meta Cloud API:       AC_WA_META_TOKEN (system-user token), AC_WA_META_PHONE_ID
   *   optional              AC_WA_GRAPH_VERSION (default DEFAULT_GRAPH_VERSION)
   *
   * They used to live in plain text in organization_settings.settings.whatsapp — one row
   * shared by every practice, readable by anyone with database access and copied into every
   * backup. Credentials found there are now IGNORED (with a warning). That row keeps one
   * job: `"enabled": false` switches WhatsApp off without touching the environment.
   */
  static async getConfig(pool) {
    const env = WhatsAppService.envConfig();
    let dbSettings = null;
    try {
      const result = await pool.query('SELECT settings FROM organization_settings WHERE id = 1');
      dbSettings = (result.rows[0] && result.rows[0].settings && result.rows[0].settings.whatsapp) || null;
    } catch (error) {
      console.warn('[whatsapp] could not read the on/off switch from organization_settings:', error.message);
    }
    if (dbSettings && SECRET_KEYS.some((k) => dbSettings[k])) {
      console.warn('[whatsapp] credentials in organization_settings.settings.whatsapp are ignored — '
        + 'set AC_WA_* environment variables and remove them from the database (see DEPLOYMENT_CHECKLIST.md).');
    }
    if (!env) return null;
    if (dbSettings && dbSettings.enabled === false) return null;
    return env;
  }

  /** Configuration from AC_WA_* environment variables, or null when incomplete. */
  static envConfig(e = process.env) {
    const provider = String(e.AC_WA_PROVIDER || '').trim().toLowerCase();
    if (provider === 'twilio') {
      if (!e.AC_WA_TWILIO_SID || !e.AC_WA_TWILIO_TOKEN || !e.AC_WA_TWILIO_FROM) return null;
      return {
        enabled: true, provider,
        account_sid: e.AC_WA_TWILIO_SID.trim(),
        auth_token: e.AC_WA_TWILIO_TOKEN.trim(),
        phone_number: e.AC_WA_TWILIO_FROM.trim().replace(/^whatsapp:/i, ''),
      };
    }
    if (provider === 'whatsapp_business' || provider === 'meta') {
      if (!e.AC_WA_META_TOKEN || !e.AC_WA_META_PHONE_ID) return null;
      const v = String(e.AC_WA_GRAPH_VERSION || '').trim();
      return {
        enabled: true, provider: 'whatsapp_business',
        access_token: e.AC_WA_META_TOKEN.trim(),
        phone_number_id: e.AC_WA_META_PHONE_ID.trim(),
        graph_version: /^v\d+\.\d+$/.test(v) ? v : DEFAULT_GRAPH_VERSION,
      };
    }
    return null;
  }

  /**
   * Send WhatsApp message via Twilio
   */
  async sendViaTwilio(to, message, { mediaUrl } = {}) {
    if (!this.config.account_sid || !this.config.auth_token || !this.config.phone_number) {
      throw new Error('Twilio configuration is incomplete');
    }

    try {
      const auth = Buffer.from(`${this.config.account_sid}:${this.config.auth_token}`).toString('base64');

      const response = await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${this.config.account_sid}/Messages.json`,
        new URLSearchParams({
          From: `whatsapp:${this.config.phone_number}`,
          To: `whatsapp:${to}`,
          Body: message,
          // Twilio fetches the image from this public URL and sends it with the text.
          ...(mediaUrl ? { MediaUrl: mediaUrl } : {})
        }),
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return {
        success: true,
        messageId: response.data.sid,
        status: response.data.status
      };
    } catch (error) {
      console.error('Error sending WhatsApp via Twilio:', error.response?.data || error.message);
      throw new Error('Failed to send WhatsApp message via Twilio');
    }
  }

  /**
   * Send WhatsApp message via WhatsApp Business API
   */
  async sendViaWhatsAppAPI(to, message, template = null, { mediaUrl } = {}) {
    if (!this.config.access_token || !this.config.phone_number_id) {
      throw new Error('WhatsApp Business API configuration is incomplete');
    }

    try {
      const messageData = template
        ? {
            messaging_product: 'whatsapp',
            to: to,
            type: 'template',
            template: {
              name: template.name,
              language: { code: template.language || 'en' },
              components: template.components || []
            }
          }
        : mediaUrl && String(message || '').length <= 1024
          // An image message: the QR code, with the whole text as its caption (WhatsApp
          // allows 1024 characters there; longer texts go as plain text, no image).
          ? {
              messaging_product: 'whatsapp',
              to: to,
              type: 'image',
              image: { link: mediaUrl, caption: message }
            }
          : {
              messaging_product: 'whatsapp',
              to: to,
              type: 'text',
              text: { body: message }
            };

      const response = await axios.post(
        `https://graph.facebook.com/${this.config.graph_version || DEFAULT_GRAPH_VERSION}/${encodeURIComponent(this.config.phone_number_id)}/messages`,
        messageData,
        {
          headers: {
            'Authorization': `Bearer ${this.config.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        messageId: response.data.messages[0].id,
        status: 'sent'
      };
    } catch (error) {
      console.error('Error sending WhatsApp via Business API:', error.response?.data || error.message);
      throw new Error('Failed to send WhatsApp message via Business API');
    }
  }

  /**
   * Send WhatsApp message (auto-detects provider)
   */
  async sendMessage(to, message, template = null) {
    // A message carrying one of our short links (/s/<code>) also gets that link's QR code,
    // so it can be scanned from another screen. If the provider will not take the image,
    // the text goes out on its own — a message is never lost to its QR code.
    const mediaUrl = template ? null : WhatsAppService.qrImageFor(message);
    const send = (opts) => {
      if (this.provider === 'twilio') return this.sendViaTwilio(to, message, opts);
      if (this.provider === 'whatsapp_business') return this.sendViaWhatsAppAPI(to, message, template, opts);
      throw new Error(`Unknown WhatsApp provider: ${this.provider}`);
    };
    if (!mediaUrl) return await send({});
    try {
      return await send({ mediaUrl });
    } catch (e) {
      console.warn('[whatsapp] sending with the QR code failed, sending text only:', e.message);
      return await send({});
    }
  }

  /**
   * The QR image URL for the first short link in a message, or null.
   * Only for links on our own short-link base over https: the messaging provider has to
   * fetch the image from the public internet.
   */
  static qrImageFor(message) {
    const base = require('./shortLinks').shortBase();
    if (!/^https:\/\//i.test(base)) return null;
    const esc = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = new RegExp(`${esc}/s/([A-Za-z0-9]{12})(?![A-Za-z0-9])`).exec(String(message || ''));
    return m ? `${base}/s/${m[1]}/qr.png` : null;
  }

  /**
   * Send appointment confirmation via WhatsApp
   */
  async sendAppointmentConfirmation(appointment, patient, provider) {
    try {
      if (!patient.phone) {
        throw new Error('Patient phone number not available');
      }

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

      const message = `
🏥 *Appointment Confirmed*

Dear ${patient.first_name} ${patient.last_name},

Your appointment has been confirmed:

📅 *Date:* ${formattedDate}
🕒 *Time:* ${formattedTime}
👨‍⚕️ *Provider:* Dr. ${provider.first_name} ${provider.last_name}
⏱️ *Duration:* ${appointment.duration_minutes} minutes
${appointment.reason ? `📝 *Reason:* ${appointment.reason}` : ''}

Please arrive 15 minutes early for check-in.

If you need to cancel or reschedule, please contact us at least 24 hours in advance.

Thank you for choosing ${process.env.AC_CLN || 'AureonCare'}!
      `.trim();

      return await this.sendMessage(patient.phone, message);
    } catch (error) {
      console.error('Error sending appointment confirmation:', error);
      throw error;
    }
  }

  /**
   * Send appointment reminder via WhatsApp
   */
  async sendAppointmentReminder(appointment, patient, provider) {
    try {
      if (!patient.phone) {
        throw new Error('Patient phone number not available');
      }

      const appointmentDate = new Date(appointment.start_time);
      const formattedDate = appointmentDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });
      const formattedTime = appointmentDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });

      const hoursUntil = Math.floor((appointmentDate - new Date()) / (1000 * 60 * 60));

      const message = `
⏰ *Appointment Reminder*

Dear ${patient.first_name},

You have an upcoming appointment in approximately ${hoursUntil} hours!

📅 *Date:* ${formattedDate}
🕒 *Time:* ${formattedTime}
👨‍⚕️ *Provider:* Dr. ${provider.first_name} ${provider.last_name}

Please arrive 15 minutes early for check-in.

See you soon!
      `.trim();

      return await this.sendMessage(patient.phone, message);
    } catch (error) {
      console.error('Error sending appointment reminder:', error);
      throw error;
    }
  }

  /**
   * Send telehealth meeting link via WhatsApp
   */
  async sendTelehealthLink(appointment, patient, provider, meetingUrl) {
    try {
      if (!patient.phone) {
        throw new Error('Patient phone number not available');
      }

      const appointmentDate = new Date(appointment.start_time);
      const formattedTime = appointmentDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
      // Short link (/s/<code>) valid until a day after the appointment starts.
      meetingUrl = await require('./shortLinks').shorten(meetingUrl, {
        expiresAt: Number.isNaN(appointmentDate.getTime()) ? null : new Date(appointmentDate.getTime() + 24 * 3600 * 1000),
        kind: 'telehealth',
      });

      const message = `
💻 *Telehealth Appointment*

Dear ${patient.first_name},

Your virtual appointment is scheduled for ${formattedTime}.

🔗 *Join Meeting:*
${meetingUrl}

👨‍⚕️ *Provider:* Dr. ${provider.first_name} ${provider.last_name}

Please join a few minutes early to test your audio and video.

See you online!
      `.trim();

      return await this.sendMessage(patient.phone, message);
    } catch (error) {
      console.error('Error sending telehealth link:', error);
      throw error;
    }
  }

  /**
   * Send ePrescription notification via WhatsApp
   */
  async sendPrescriptionNotification(prescription, patient, provider, pharmacy = null) {
    try {
      if (!patient.phone) {
        throw new Error('Patient phone number not available');
      }

      const prescriptionDate = new Date(prescription.created_at || prescription.date);
      const formattedDate = prescriptionDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });

      let pharmacyInfo = '';
      if (pharmacy) {
        pharmacyInfo = `
🏪 *Pharmacy:* ${pharmacy.name}
📍 *Address:* ${pharmacy.address || 'N/A'}
📞 *Phone:* ${pharmacy.phone || 'N/A'}
`;
      }

      const message = `
💊 *New ePrescription*

Dear ${patient.first_name} ${patient.last_name},

You have a new prescription from Dr. ${provider.first_name} ${provider.last_name}:

📋 *Medication:* ${prescription.medication_name}
💊 *Dosage:* ${prescription.dosage}
📅 *Prescribed on:* ${formattedDate}
${prescription.instructions ? `📝 *Instructions:* ${prescription.instructions}` : ''}
${prescription.refills !== undefined ? `🔄 *Refills:* ${prescription.refills}` : ''}
${pharmacyInfo}
${prescription.notes ? `\nℹ️ *Additional Notes:* ${prescription.notes}` : ''}

${pharmacy ? 'Your prescription has been sent to the pharmacy and should be ready for pickup soon.' : 'Please contact your pharmacy to have this prescription filled.'}

If you have any questions, please contact us.

Thank you,
${process.env.AC_CLN || 'AureonCare'}
      `.trim();

      return await this.sendMessage(patient.phone, message);
    } catch (error) {
      console.error('Error sending prescription notification:', error);
      throw error;
    }
  }

  /**
   * Send appointment schedule update notification via WhatsApp
   */
  async sendScheduleUpdateNotification(appointment, patient, provider, updateType = 'updated') {
    try {
      if (!patient.phone) {
        throw new Error('Patient phone number not available');
      }

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

      let emoji = '📅';
      let title = 'Appointment Updated';
      let body = 'Your appointment has been rescheduled:';

      if (updateType === 'cancelled' || updateType === 'canceled') {
        emoji = '❌';
        title = 'Appointment Cancelled';
        body = 'Your appointment has been cancelled:';
      } else if (updateType === 'rescheduled') {
        emoji = '🔄';
        title = 'Appointment Rescheduled';
        body = 'Your appointment has been rescheduled to:';
      }

      const message = `
${emoji} *${title}*

Dear ${patient.first_name} ${patient.last_name},

${body}

📅 *Date:* ${formattedDate}
🕒 *Time:* ${formattedTime}
👨‍⚕️ *Provider:* Dr. ${provider.first_name} ${provider.last_name}
${appointment.reason ? `📝 *Reason:* ${appointment.reason}` : ''}

${updateType === 'cancelled' || updateType === 'canceled'
  ? `If you need to schedule a new appointment, please contact us or use the patient portal.\n\nThank you for your understanding.`
  : `Please arrive 15 minutes early for check-in.\n\nIf you need to make changes, please contact us at least 24 hours in advance.`
}

${process.env.AC_CLN || 'AureonCare'}
      `.trim();

      return await this.sendMessage(patient.phone, message);
    } catch (error) {
      console.error('Error sending schedule update notification:', error);
      throw error;
    }
  }

  /**
   * Check if WhatsApp notifications are enabled for a patient
   */
  static async isEnabledForPatient(pool, patientId) {
    try {
      const result = await pool.query(
        `SELECT is_enabled, contact_info
         FROM notification_preferences
         WHERE patient_id = $1 AND channel_type = 'whatsapp' AND is_enabled = true`,
        [patientId]
      );

      if (result.rows.length > 0) {
        return {
          enabled: true,
          phoneNumber: result.rows[0].contact_info
        };
      }

      return { enabled: false, phoneNumber: null };
    } catch (error) {
      console.error('Error checking WhatsApp preference:', error);
      return { enabled: false, phoneNumber: null };
    }
  }
}

module.exports = WhatsAppService;
module.exports.DEFAULT_GRAPH_VERSION = DEFAULT_GRAPH_VERSION;
