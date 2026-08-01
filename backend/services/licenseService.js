/**
 * License Key Service
 *
 * Generates, validates, and activates license keys for On-Premises
 * and Customer Cloud deployments. Keys are stored in the license_keys table.
 *
 * Key format: AC-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX (32 hex chars, grouped)
 */

const crypto = require('crypto');

function generateKeyString() {
  const raw = crypto.randomBytes(16).toString('hex').toUpperCase();
  return `AC-${raw.slice(0,8)}-${raw.slice(8,16)}-${raw.slice(16,24)}-${raw.slice(24,32)}`;
}

/**
 * Generate and persist a new license key.
 *
 * @param {object} pool - pg Pool
 * @param {object} opts
 * @param {string} opts.planName       - Must match a subscription_plans.name value
 * @param {number} opts.maxProviders   - Provider seat limit (-1 = unlimited)
 * @param {number} opts.maxUsers       - Staff user limit (-1 = unlimited)
 * @param {number} opts.maxPatients    - Patient record limit (-1 = unlimited)
 * @param {string} opts.validFrom      - ISO date string, defaults to today
 * @param {string} opts.validUntil     - ISO date string, null = perpetual
 * @param {string} opts.notes          - Internal notes
 * @param {string} opts.createdBy      - Admin email or ID
 * @returns {object} The created license_keys row
 */
async function generateLicense(pool, opts) {
  const {
    planName,
    maxProviders = -1,
    maxUsers     = -1,
    maxPatients  = -1,
    validFrom    = null,
    validUntil   = null,
    notes        = null,
    createdBy    = null,
  } = opts;

  // Verify the plan exists
  const planCheck = await pool.query(
    'SELECT name FROM subscription_plans WHERE name = $1 AND is_active = true',
    [planName]
  );
  if (planCheck.rows.length === 0) {
    throw new Error(`Unknown or inactive plan: ${planName}`);
  }

  const key = generateKeyString();

  const { rows } = await pool.query(
    `INSERT INTO license_keys
       (key, plan_name, max_providers, max_users, max_patients,
        valid_from, valid_until, status, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,
             COALESCE($6::date, CURRENT_DATE), $7::date,
             'unactivated', $8, $9)
     RETURNING *`,
    [key, planName, maxProviders, maxUsers, maxPatients,
     validFrom, validUntil, notes, createdBy]
  );

  return rows[0];
}

/**
 * Validate and activate a license key.
 * On success, updates organization_settings to match the key's entitlements.
 *
 * @param {object} pool
 * @param {string} key              - The license key string
 * @param {string} installationId   - A stable identifier for this deployment
 * @returns {{ valid: boolean, message: string, license?: object }}
 */
async function activateLicense(pool, key, installationId) {
  const { rows } = await pool.query(
    'SELECT * FROM license_keys WHERE key = $1',
    [key]
  );

  if (rows.length === 0) {
    return { valid: false, message: 'License key not found.' };
  }

  const license = rows[0];

  if (license.status === 'revoked') {
    return { valid: false, message: 'This license key has been revoked.' };
  }
  if (license.status === 'expired') {
    return { valid: false, message: 'This license key has expired.' };
  }
  if (license.valid_until && new Date(license.valid_until) < new Date()) {
    await pool.query(
      "UPDATE license_keys SET status = 'expired', updated_at = NOW() WHERE id = $1",
      [license.id]
    );
    return { valid: false, message: 'This license key has expired.' };
  }

  // Allow re-activation on the same installation (idempotent)
  if (license.status === 'active' && license.installation_id &&
      license.installation_id !== installationId) {
    return {
      valid: false,
      message: 'This license key is already activated on a different installation. Contact support to transfer it.'
    };
  }

  // Activate the key
  await pool.query(
    `UPDATE license_keys
     SET status = 'active', activated_at = NOW(),
         installation_id = $1, updated_at = NOW()
     WHERE id = $2`,
    [installationId, license.id]
  );

  // Sync entitlements to organization_settings
  const planRow = await pool.query(
    'SELECT id FROM subscription_plans WHERE name = $1',
    [license.plan_name]
  );

  if (planRow.rows.length > 0) {
    const planId = planRow.rows[0].id;
    const validUntil = license.valid_until || null;

    await pool.query(
      `UPDATE organization_settings
       SET current_plan_id = $1,
           plan_start_date = COALESCE($2::date, CURRENT_DATE),
           plan_end_date   = $3::date,
           auto_renew      = false,
           provider_seats_purchased = 0,
           updated_at      = NOW()
       WHERE id = (SELECT id FROM organization_settings LIMIT 1)`,
      [planId, license.valid_from, validUntil]
    );
  }

  return { valid: true, message: 'License activated successfully.', license };
}

/**
 * Return the status of a license key without activating it.
 */
async function checkLicense(pool, key) {
  const { rows } = await pool.query(
    `SELECT lk.*, sp.display_name AS plan_display_name
     FROM license_keys lk
     JOIN subscription_plans sp ON lk.plan_name = sp.name
     WHERE lk.key = $1`,
    [key]
  );

  if (rows.length === 0) {
    return { found: false };
  }

  const lic = rows[0];
  const expired = lic.valid_until && new Date(lic.valid_until) < new Date();

  return {
    found: true,
    key: lic.key,
    plan: lic.plan_name,
    planDisplayName: lic.plan_display_name,
    status: expired ? 'expired' : lic.status,
    maxProviders: lic.max_providers,
    maxUsers: lic.max_users,
    maxPatients: lic.max_patients,
    validFrom: lic.valid_from,
    validUntil: lic.valid_until,
    activatedAt: lic.activated_at,
    installationId: lic.installation_id,
  };
}

/**
 * Revoke a license key (admin action).
 */
async function revokeLicense(pool, key) {
  const { rowCount } = await pool.query(
    "UPDATE license_keys SET status = 'revoked', updated_at = NOW() WHERE key = $1",
    [key]
  );
  return rowCount > 0;
}

module.exports = { generateLicense, activateLicense, checkLicense, revokeLicense };
