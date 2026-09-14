const express = require('express');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);

/**
 * Stripe Integration Settings API
 *
 * Subscribers can either:
 *   a) Supply their own publishable/secret keys, or
 *   b) Enable use_platform_integration to rely on the platform's Stripe account
 *
 * Secret credentials are never returned in GET responses.
 */

// Helper: ensure the stripe_integration_settings table exists and return the singleton row
async function getOrInitRow(pool) {
  // SEC-05: table/column creation moved to migrations (see migrations/tenant/001 and 072).

  const existing = await pool.query('SELECT id FROM stripe_integration_settings LIMIT 1');
  if (existing.rows.length === 0) {
    await pool.query('INSERT INTO stripe_integration_settings DEFAULT VALUES');
  }
}

// GET /api/stripe-settings
// Returns settings without exposing secret fields
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    await getOrInitRow(pool);

    const result = await pool.query(`
      SELECT
        id,
        is_enabled,
        publishable_key,
        CASE WHEN secret_key IS NOT NULL AND secret_key <> '' THEN true ELSE false END AS has_secret_key,
        CASE WHEN webhook_secret IS NOT NULL AND webhook_secret <> '' THEN true ELSE false END AS has_webhook_secret,
        sandbox_mode,
        use_platform_integration,
        settings,
        created_at,
        updated_at,
        last_tested_at,
        test_status,
        test_message
      FROM stripe_integration_settings
      LIMIT 1
    `);

    const row = result.rows[0] || {};

    // When platform integration is active, surface the platform publishable key
    // so the frontend can initialise Stripe.js without a separate request.
    if (row.use_platform_integration) {
      const platformPk = process.env.AC_STRIPE_PK || process.env.STRIPE_PUBLISHABLE_KEY;
      if (platformPk) row.publishable_key = platformPk;
      row.has_platform_secret = !!(process.env.AC_STRIPE_SK || process.env.STRIPE_SECRET_KEY);
      row.has_platform_webhook = !!(process.env.AC_STRIPE_WHS || process.env.STRIPE_WEBHOOK_SECRET);
    }

    res.json(row);
  } catch (error) {
    console.error('Error fetching Stripe settings:', error);
    res.status(500).json({ error: 'Failed to fetch Stripe settings' });
  }
});

// POST /api/stripe-settings
// Create or update settings
router.post('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    await getOrInitRow(pool);

    const {
      publishable_key,
      secret_key,
      webhook_secret,
      sandbox_mode,
      use_platform_integration,
      settings
    } = req.body;

    const result = await pool.query(`
      UPDATE stripe_integration_settings SET
        publishable_key = CASE WHEN $1::text IS NOT NULL THEN $1 ELSE publishable_key END,
        secret_key = CASE WHEN $2::text IS NOT NULL THEN $2 ELSE secret_key END,
        webhook_secret = CASE WHEN $3::text IS NOT NULL THEN $3 ELSE webhook_secret END,
        sandbox_mode = COALESCE($4, sandbox_mode),
        use_platform_integration = COALESCE($5, use_platform_integration),
        settings = COALESCE($6, settings),
        updated_at = CURRENT_TIMESTAMP
      RETURNING
        id,
        is_enabled,
        publishable_key,
        CASE WHEN secret_key IS NOT NULL AND secret_key <> '' THEN true ELSE false END AS has_secret_key,
        CASE WHEN webhook_secret IS NOT NULL AND webhook_secret <> '' THEN true ELSE false END AS has_webhook_secret,
        sandbox_mode,
        use_platform_integration,
        settings,
        updated_at
    `, [
      publishable_key || null,
      secret_key || null,
      webhook_secret || null,
      sandbox_mode,
      use_platform_integration,
      settings ? JSON.stringify(settings) : null
    ]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving Stripe settings:', error);
    res.status(500).json({ error: 'Failed to save Stripe settings' });
  }
});

// PATCH /api/stripe-settings/toggle
router.patch('/toggle', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    await getOrInitRow(pool);

    const { is_enabled } = req.body;

    const result = await pool.query(`
      UPDATE stripe_integration_settings
      SET is_enabled = $1, updated_at = CURRENT_TIMESTAMP
      RETURNING id, is_enabled, updated_at
    `, [is_enabled]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error toggling Stripe integration:', error);
    res.status(500).json({ error: 'Failed to toggle Stripe integration' });
  }
});

// POST /api/stripe-settings/test
// Verify the saved secret key can reach Stripe
router.post('/test', async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const settingsResult = await pool.query(
      'SELECT secret_key, use_platform_integration, sandbox_mode FROM stripe_integration_settings LIMIT 1'
    );

    if (settingsResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Stripe settings not configured' });
    }

    const row = settingsResult.rows[0];

    // Resolve which secret key to use
    let secretKey = row.secret_key;
    if (row.use_platform_integration) {
      secretKey = process.env.AC_STRIPE_SK || process.env.STRIPE_SECRET_KEY;
    }

    if (!secretKey) {
      return res.status(400).json({
        success: false,
        error: 'No Stripe secret key configured. Add your secret key or enable platform integration.'
      });
    }

    // Validate key format
    const isTestKey = secretKey.startsWith('sk_test_');
    const isLiveKey = secretKey.startsWith('sk_live_');
    if (!isTestKey && !isLiveKey) {
      await pool.query(`
        UPDATE stripe_integration_settings SET
          last_tested_at = CURRENT_TIMESTAMP,
          test_status = 'failed',
          test_message = 'Invalid secret key format'
      `);
      return res.status(400).json({ success: false, error: 'Invalid Stripe secret key format' });
    }

    // Attempt a lightweight Stripe API call (list balance — no side effects)
    const https = require('https');
    const testResult = await new Promise((resolve) => {
      const options = {
        hostname: 'api.stripe.com',
        path: '/v1/balance',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      };

      const request = https.request(options, (response) => {
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (response.statusCode === 200) {
              resolve({ success: true, message: 'Stripe connection successful' });
            } else {
              resolve({
                success: false,
                error: parsed.error?.message || `Stripe API error (${response.statusCode})`
              });
            }
          } catch {
            resolve({ success: false, error: 'Invalid response from Stripe' });
          }
        });
      });

      request.on('error', (err) => {
        resolve({ success: false, error: `Connection failed: ${err.message}` });
      });

      request.setTimeout(8000, () => {
        request.destroy();
        resolve({ success: false, error: 'Connection timed out' });
      });

      request.end();
    });

    await pool.query(`
      UPDATE stripe_integration_settings SET
        last_tested_at = CURRENT_TIMESTAMP,
        test_status = $1,
        test_message = $2
    `, [
      testResult.success ? 'success' : 'failed',
      testResult.success ? testResult.message : testResult.error
    ]);

    if (testResult.success) {
      res.json(testResult);
    } else {
      res.status(400).json(testResult);
    }
  } catch (error) {
    console.error('Error testing Stripe connection:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
