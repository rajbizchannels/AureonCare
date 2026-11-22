/**
 * Surescripts e-prescribing — sends NCPDP SCRIPT 2017071 messages (services/ncpdp/script.js).
 *
 * Transport: one HTTPS POST of the SCRIPT XML (Content-Type application/xml) to the endpoint
 * Surescripts assigns the practice (vendor settings → base URL). The answer is a SCRIPT Status
 * (accepted), Verify (delivered) or Error message, mapped to { success, status, errors }.
 *
 * Authentication: HTTP Basic with the settings' username/password (or client id/secret).
 * Surescripts also uses mutual TLS. A client certificate is read from the server environment —
 * AC_SURESCRIPTS_TLS_CERT and AC_SURESCRIPTS_TLS_KEY (PEM text) — not from the settings row,
 * so a private key is never stored in, or returned from, the practice's settings.
 *
 * Prescriber identifiers live in the vendor settings JSON, because users have no NPI/SPI
 * columns:  settings.prescribers = { "<user id>": { spi, npi, dea } }, with settings.spi /
 * settings.npi as the default for a single-prescriber practice, and settings.practice_address
 * { line1, city, state, postalCode } / settings.practice_phone for the prescriber's address.
 *
 * NOT certified: Surescripts requires certification testing, an account, an SPI per prescriber
 * and (for controlled substances) EPCS before go-live. See DEPLOYMENT_CHECKLIST.md.
 */

const axios = require('axios');
const https = require('https');
const script = require('../ncpdp/script');

class SurescriptsService {
  constructor(config = {}) {
    this.config = config;
    // There is no public default: the endpoint is assigned by Surescripts. These are kept only
    // so an unconfigured client fails against an obviously-Surescripts host, not a random one.
    this.baseUrl = config.base_url || (config.sandbox_mode ? 'https://cert.surescripts.net' : 'https://production.surescripts.net');
    this.clientId = config.client_id;
    this.clientSecret = config.client_secret;
    this.username = config.username;
    this.password = config.password;
    this.isEnabled = config.is_enabled || false;
    this.settings = (typeof config.settings === 'string' ? safeJson(config.settings) : config.settings) || {};
    this.spi = this.settings.spi || '';
    this.accountId = this.settings.account_id || '';
    this.timeoutMs = Number(this.settings.timeout_ms) || 30000;
  }

  /** Basic-auth credentials, preferring the username/password pair. */
  credentials() {
    if (this.username && this.password) return { username: this.username, password: this.password };
    if (this.clientId && this.clientSecret) return { username: this.clientId, password: this.clientSecret };
    return null;
  }

  isConfigured() {
    return Boolean(this.isEnabled && this.credentials() && this.baseUrl);
  }

  /** Prescriber identifiers for a user: per-prescriber entry, then the practice default. */
  prescriberIds(userId) {
    const per = (this.settings.prescribers && this.settings.prescribers[String(userId)]) || {};
    return { spi: per.spi || this.settings.spi || '', npi: per.npi || this.settings.npi || '', dea: per.dea || '' };
  }

  /**
   * AureonCare records → the SCRIPT data shape.
   * @param {object} r { prescription, patient (patients row), provider (users row), pharmacy (pharmacies row), prescriberDea }
   */
  toScript({ prescription = {}, patient = {}, provider = {}, pharmacy = {}, prescriberDea } = {}) {
    const ids = this.prescriberIds(prescription.provider_id || provider.id);
    const pa = this.settings.practice_address || {};
    const sig = prescription.instructions
      || [prescription.dosage, prescription.frequency, prescription.duration ? `for ${prescription.duration}` : null].filter(Boolean).join(' ');
    return {
      prescriberOrderNumber: prescription.id ? String(prescription.id).replace(/-/g, '').slice(0, 35) : undefined,
      patient: {
        firstName: patient.first_name, lastName: patient.last_name, gender: patient.gender,
        dateOfBirth: patient.date_of_birth, phone: patient.phone,
        address: { line1: firstLine(patient.address), city: patient.city, state: patient.state, postalCode: patient.zip },
      },
      pharmacy: {
        ncpdpId: pharmacy.ncpdp_id, npi: pharmacy.npi, name: pharmacy.pharmacy_name || pharmacy.name, phone: pharmacy.phone,
        address: { line1: pharmacy.address_line1, line2: pharmacy.address_line2, city: pharmacy.city, state: pharmacy.state, postalCode: pharmacy.zip_code },
      },
      prescriber: {
        spi: ids.spi, npi: ids.npi,
        dea: prescriberDea || prescription.prescriber_dea_number || ids.dea,
        firstName: provider.first_name, lastName: provider.last_name,
        phone: this.settings.practice_phone || provider.phone,
        address: { line1: pa.line1, line2: pa.line2, city: pa.city, state: pa.state, postalCode: pa.postalCode || pa.zip },
      },
      medication: {
        description: [prescription.medication_name, prescription.drug_strength, prescription.drug_form].filter(Boolean).join(' '),
        ndc: prescription.ndc_code, quantity: prescription.quantity, unit: prescription.drug_form,
        daysSupply: prescription.days_supply, writtenDate: prescription.prescribed_date,
        substitutionAllowed: prescription.substitution_allowed !== false,
        refills: prescription.refills, sig,
        deaSchedule: prescription.controlled_substance_class,
        diagnosisCode: prescription.diagnosis_code,
        noteToPharmacist: prescription.notes_to_pharmacist,
      },
    };
  }

  async testConnection() {
    if (!this.isEnabled) return { success: false, message: 'Surescripts integration is not enabled' };
    if (!this.credentials()) return { success: false, message: 'Surescripts credentials not configured' };
    // SCRIPT has no "ping" transaction; a connection test is a TLS + auth round trip to the
    // endpoint. Any HTTP answer other than 401/403 means the address and credentials reach it.
    try {
      const r = await this.post('', { probe: true });
      if (r.status === 401 || r.status === 403) return { success: false, message: `Surescripts refused the credentials (HTTP ${r.status})` };
      return { success: true, message: `Reached Surescripts endpoint (HTTP ${r.status})` };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Send a NewRx. Accepts either { prescription, patient, provider, pharmacy } records or a
   * ready-made SCRIPT shape ({ patient: { firstName, ... }, ... }).
   * @returns {{ success, status, vendorId?, messageId?, missing?, errors?, error?, response?, sentAt? }}
   */
  async sendPrescription(input, opts = {}) {
    if (!this.isEnabled) return { success: false, status: 'failed', error: 'Surescripts integration is not enabled' };
    const rx = isScriptShape(input) ? input : this.toScript(input);
    const built = script.buildNewRx(rx, opts);
    if (!built.ok) return missingResult(built.missing);
    return this.transmit(built, 'sent');
  }

  /**
   * Send a CancelRx for a NewRx sent earlier.
   * @param {string} originalMessageId the NewRx MessageID (stored as vendor_prescription_id)
   * @param {object} details { prescription, patient, provider, pharmacy, reason } or a SCRIPT shape
   */
  async cancelPrescription(originalMessageId, details = {}, opts = {}) {
    if (!this.isEnabled) return { success: false, status: 'failed', error: 'Surescripts integration is not enabled' };
    const rx = isScriptShape(details) ? { ...details } : this.toScript(details);
    rx.originalMessageId = originalMessageId;
    if (details.reason) rx.medication = { ...rx.medication, noteToPharmacist: `Cancel: ${details.reason}` };
    const built = script.buildCancelRx(rx, opts);
    if (!built.ok) return missingResult(built.missing);
    return this.transmit(built, 'cancel_requested');
  }

  /** SCRIPT has no status query; status arrives as Verify/Status messages. */
  async getPrescriptionStatus() {
    return { success: false, error: 'Surescripts reports status by sending Verify/Status messages; there is no status query.' };
  }

  /** The Surescripts directory is a separate licensed product; not part of this integration. */
  async searchPharmacies() {
    return { success: false, error: 'Pharmacy directory search via Surescripts is not available; use the practice pharmacy list.', pharmacies: [] };
  }

  async transmit(built, okStatus) {
    let res;
    try {
      res = await this.post(built.xml);
    } catch (e) {
      return { success: false, status: 'failed', messageId: built.messageId, error: `Could not reach Surescripts: ${e.message}`, request: built.xml };
    }
    if (res.status === 401 || res.status === 403) {
      return { success: false, status: 'failed', messageId: built.messageId, error: `Surescripts refused the credentials (HTTP ${res.status})`, response: String(res.data || '') };
    }
    const parsed = await script.parseResponse(res.data);
    if (parsed.ok) {
      return {
        success: true,
        status: parsed.code === '010' ? 'delivered' : okStatus,
        vendorId: built.messageId,
        messageId: built.messageId,
        response: { type: parsed.type, code: parsed.code, description: parsed.description, raw: String(res.data) },
        sentAt: new Date().toISOString(),
        request: built.xml,
      };
    }
    const errors = [{ code: parsed.code, descriptionCode: parsed.descriptionCode, description: parsed.description }];
    return {
      success: false,
      status: 'failed',
      messageId: built.messageId,
      error: parsed.description || `Surescripts answered HTTP ${res.status}`,
      errors,
      response: { type: parsed.type, code: parsed.code, description: parsed.description, raw: String(res.data || ''), httpStatus: res.status },
      request: built.xml,
    };
  }

  /** POST SCRIPT XML. Resolves for any HTTP status; rejects only on network/TLS failure. */
  async post(xml, { probe = false } = {}) {
    const cred = this.credentials();
    const agentOpts = {};
    if (process.env.AC_SURESCRIPTS_TLS_CERT && process.env.AC_SURESCRIPTS_TLS_KEY) {
      agentOpts.cert = process.env.AC_SURESCRIPTS_TLS_CERT;
      agentOpts.key = process.env.AC_SURESCRIPTS_TLS_KEY;
    }
    return axios({
      method: probe ? 'GET' : 'POST',
      url: this.baseUrl,
      data: probe ? undefined : xml,
      headers: { 'Content-Type': 'application/xml; charset=utf-8', Accept: 'application/xml' },
      auth: cred || undefined,
      timeout: this.timeoutMs,
      responseType: 'text',
      transformResponse: [(d) => d],
      validateStatus: () => true,
      ...(Object.keys(agentOpts).length && String(this.baseUrl).startsWith('https:') ? { httpsAgent: new https.Agent(agentOpts) } : {}),
    });
  }

  generateMessageId() { return script.newMessageId(); }
}

function safeJson(s) { try { return JSON.parse(s); } catch { return {}; } }
const firstLine = (a) => (a ? String(a).split(/\r?\n|,/)[0].trim() || null : null);
const isScriptShape = (x) => Boolean(x && x.medication && x.prescriber && !x.prescription);

function missingResult(missing) {
  return {
    success: false,
    status: 'incomplete',
    missing,
    error: `Cannot send electronically — missing: ${missing.join('; ')}`,
  };
}

module.exports = SurescriptsService;
