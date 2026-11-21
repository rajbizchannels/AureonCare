/**
 * Vendor integrations (Surescripts ePrescribe, Labcorp lab orders, Optum clearinghouse),
 * per practice. SEC-37.
 *
 * This used to be one process-wide singleton. It loaded vendor_integration_settings through
 * the shared pool, whose search_path is `public` — but since the schema-per-tenant cutover
 * that table lives in each practice's schema — so it never initialised, every "send to
 * vendor" path was silently off, and saving vendor settings answered 500. Pointing the
 * singleton at a tenant would have been worse: one practice's credentials would then have
 * served every practice's orders and prescriptions.
 *
 * Now each request asks for ITS practice's vendors:
 *
 *     const vendors = await vendorsFor(req);
 *     if (vendors.isVendorEnabled('labcorp')) { const labcorp = vendors.getLabcorp(); ... }
 *
 * - Settings are read through req.db, i.e. the caller's own schema. With no practice context
 *   nothing is enabled — this never guesses a tenant.
 * - Clients are cached under (schema, vendor), so a practice keeps its Labcorp/Optum OAuth
 *   token between requests, and two practices can never share a client.
 * - A cached client is reused only while a fingerprint of its settings row is unchanged, so a
 *   save or toggle takes effect on the next request, on every instance, with no reload step.
 * - "Enabled" means the row's is_enabled switch is on AND the client is configured. The
 *   clients' isConfigured() already includes the switch; checking the row as well keeps that
 *   true for any future client that forgets to.
 * - Transactions are logged to, and read from, the practice's own vendor_transaction_log.
 */

const crypto = require('crypto');
const SurescriptsService = require('./surescriptsService');
const LabcorpService = require('./labcorpService');
const OptumService = require('./optumService');

const SERVICES = { surescripts: SurescriptsService, labcorp: LabcorpService, optum: OptumService };
const VENDOR_TYPES = Object.keys(SERVICES);

// `${schema}:${vendorType}` -> { stamp, client }. Bounded by practices x 3.
const clientCache = new Map();

const fingerprint = (row) => crypto.createHash('sha256').update(JSON.stringify(row)).digest('hex');

class PracticeVendors {
  /**
   * @param {string|null} schema  the practice's schema (cache key); null = no practice context
   * @param {{query: Function}|null} db  the practice-scoped handle (req.db)
   * @param {Array<Object>} rows  that practice's vendor_integration_settings rows
   */
  constructor(schema, db, rows) {
    this.schema = schema;
    this.db = db;
    this.rows = {};
    for (const r of rows || []) {
      if (r && r.vendor_type) this.rows[String(r.vendor_type).toLowerCase()] = r;
    }
  }

  _client(vendorType) {
    const type = String(vendorType || '').toLowerCase();
    const row = this.rows[type];
    if (!this.schema || !row || !SERVICES[type]) return null;
    const key = `${this.schema}:${type}`;
    const stamp = fingerprint(row);
    const hit = clientCache.get(key);
    if (hit && hit.stamp === stamp) return hit.client;
    const client = new SERVICES[type](row);
    clientCache.set(key, { stamp, client });
    return client;
  }

  /** Switched on for this practice and configured. */
  isVendorEnabled(vendorType) {
    const type = String(vendorType || '').toLowerCase();
    const row = this.rows[type];
    if (!row || !row.is_enabled) return false;
    const client = this._client(type);
    try { return Boolean(client && client.isConfigured()); } catch { return false; }
  }

  /** The practice's client for a vendor; throws when it is not enabled for this practice. */
  getVendor(vendorType) {
    if (!this.isVendorEnabled(vendorType)) {
      throw new Error(`Vendor ${vendorType} is not enabled for this practice`);
    }
    return this._client(vendorType);
  }

  /**
   * The practice's client whether or not it is switched on — for the admin's connection
   * test, which has to work BEFORE a vendor is enabled. Null when nothing is stored.
   */
  clientForTest(vendorType) { return this._client(vendorType); }

  getSurescripts() { return this.getVendor('surescripts'); }

  getLabcorp() { return this.getVendor('labcorp'); }

  getOptum() { return this.getVendor('optum'); }

  getVendorStatuses() {
    const out = {};
    for (const type of VENDOR_TYPES) {
      const client = this._client(type);
      let configured = false;
      try { configured = Boolean(client && client.isConfigured()); } catch { configured = false; }
      out[type] = { enabled: this.isVendorEnabled(type), configured };
    }
    return out;
  }

  /** Never throws: logging must not break the clinical action it records. */
  async logTransaction(vendorType, transactionType, details = {}) {
    if (!this.db) return null;
    try {
      const { rows } = await this.db.query(
        `INSERT INTO vendor_transaction_log
           (vendor_type, transaction_type, request_data, response_data, status, error_message,
            external_id, internal_reference_id, patient_id, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          vendorType,
          transactionType,
          JSON.stringify(details.request || {}),
          JSON.stringify(details.response || {}),
          details.status || 'completed',
          details.error || null,
          details.externalId || null,
          details.internalReferenceId || null,
          details.patientId || null,
          details.completedAt || new Date(),
        ]
      );
      return rows[0] ? rows[0].id : null;
    } catch (error) {
      console.error('Error logging vendor transaction:', error.message);
      return null;
    }
  }

  async getTransactionHistory(internalReferenceId) {
    if (!this.db) return [];
    try {
      const { rows } = await this.db.query(
        `SELECT * FROM vendor_transaction_log
          WHERE internal_reference_id = $1
          ORDER BY created_at DESC`,
        [internalReferenceId]
      );
      return rows;
    } catch (error) {
      console.error('Error getting transaction history:', error.message);
      return [];
    }
  }
}

const NONE = new PracticeVendors(null, null, []);

/**
 * The vendors of the practice this request belongs to. Memoised on the request, so several
 * calls in one handler cost one settings read.
 * @returns {Promise<PracticeVendors>}
 */
function vendorsFor(req) {
  if (req && req.__vendors) return req.__vendors;
  const schema = req && req.tenant && req.tenant.schemaName;
  const db = req && req.db;
  const p = (async () => {
    if (!db || !schema || schema === 'public') return NONE;
    try {
      const { rows } = await db.query('SELECT * FROM vendor_integration_settings');
      return new PracticeVendors(schema, db, rows);
    } catch (error) {
      console.error('[vendors] could not read vendor settings:', error.message);
      return new PracticeVendors(schema, db, []);
    }
  })();
  if (req) req.__vendors = p;
  return p;
}

module.exports = { vendorsFor, VENDOR_TYPES, PracticeVendors, _clientCache: clientCache };
