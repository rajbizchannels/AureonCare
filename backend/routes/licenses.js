const express = require('express');
const { authenticate } = require('../middleware/auth');
const router  = express.Router();
router.use(authenticate);
const {
  generateLicense,
  activateLicense,
  checkLicense,
  revokeLicense,
} = require('../services/licenseService');

// ─── POST /api/licenses/generate ─────────────────────────────────────────────
// Admin-only: generate a new license key.
// Body: { planName, maxProviders, maxUsers, maxPatients, validFrom, validUntil, notes }
router.post('/generate', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const {
      planName, maxProviders, maxUsers, maxPatients,
      validFrom, validUntil, notes,
    } = req.body;

    if (!planName) {
      return res.status(400).json({ error: 'planName is required' });
    }

    const createdBy = req.headers['x-user-id'] || null;
    const license = await generateLicense(pool, {
      planName, maxProviders, maxUsers, maxPatients,
      validFrom, validUntil, notes, createdBy,
    });

    res.status(201).json({ message: 'License key generated.', license });
  } catch (err) {
    console.error('[licenses] generate error:', err.message);
    const status = err.message.startsWith('Unknown') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

// ─── POST /api/licenses/activate ─────────────────────────────────────────────
// Activate a license key on this installation.
// Body: { key, installationId }
router.post('/activate', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { key, installationId } = req.body;

    if (!key)            return res.status(400).json({ error: 'key is required' });
    if (!installationId) return res.status(400).json({ error: 'installationId is required' });

    const result = await activateLicense(pool, key, installationId);

    if (!result.valid) {
      return res.status(402).json({ error: result.message });
    }

    res.json({ message: result.message, license: result.license });
  } catch (err) {
    console.error('[licenses] activate error:', err.message);
    res.status(500).json({ error: 'Failed to activate license' });
  }
});

// ─── GET /api/licenses/check/:key ────────────────────────────────────────────
// Check the status of a key without activating it.
router.get('/check/:key', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await checkLicense(pool, req.params.key);

    if (!result.found) {
      return res.status(404).json({ error: 'License key not found' });
    }

    res.json(result);
  } catch (err) {
    console.error('[licenses] check error:', err.message);
    res.status(500).json({ error: 'Failed to check license' });
  }
});

// ─── GET /api/licenses ───────────────────────────────────────────────────────
// Admin: list all license keys with plan info.
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { rows } = await pool.query(`
      SELECT lk.*, sp.display_name AS plan_display_name, sp.price AS plan_price
      FROM license_keys lk
      JOIN subscription_plans sp ON lk.plan_name = sp.name
      ORDER BY lk.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('[licenses] list error:', err.message);
    res.status(500).json({ error: 'Failed to list licenses' });
  }
});

// ─── POST /api/licenses/revoke ───────────────────────────────────────────────
// Admin: revoke a license key.
// Body: { key }
router.post('/revoke', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { key } = req.body;

    if (!key) return res.status(400).json({ error: 'key is required' });

    const revoked = await revokeLicense(pool, key);
    if (!revoked) {
      return res.status(404).json({ error: 'License key not found' });
    }

    res.json({ message: 'License key revoked.' });
  } catch (err) {
    console.error('[licenses] revoke error:', err.message);
    res.status(500).json({ error: 'Failed to revoke license' });
  }
});

module.exports = router;
