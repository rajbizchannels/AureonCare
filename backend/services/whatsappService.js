const axios = require('axios');
const pool = require('../db');

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
   * Get WhatsApp configuration from organization settings
   */
  static async getConfig(pool) {
    try {
      const result = await pool.query(
        'SELECT settings FROM organization_settings WHERE id = 1'
      );

      if (result.rows.length === 0) {
        return null;
      }

      const settings = result.rows[0].settings;
      return settings?.whatsapp || null;
    } catch (error) {
      console.error('Error getting WhatsApp config:', error);
      return null;
    }
  }

  /**
   * Send WhatsApp message via Twilio
   */
  async sendViaTwilio(to, message) {
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
          Body: message
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
  async sendViaWhatsAppAPI(to, message, template = null) {
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
        : {
            messaging_product: 'whatsapp',
            to: to,
            type: 'text',
            text: { body: message }
          };

      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${this.config.phone_number_id}/messages`,
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
    if (this.provider === 'twilio') {
      return await this.sendViaTwilio(to, message);
    } else if (this.provider === 'whatsapp_business') {
      return await this.sendViaWhatsAppAPI(to, message, template);
    } else {
      throw new Error(`Unknown WhatsApp provider: ${this.provider}`);
    }
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

Thank you for choosing ${process.env.CLINIC_NAME || 'MedFlow'}!
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
}

module.exports = WhatsAppService;
