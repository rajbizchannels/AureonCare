const express = require('express');
const { authenticate } = require('../middleware/auth');
const platformBilling = require('../services/platformBilling');

const router = express.Router();
router.use(authenticate);

/**
 * Stripe, as a practice sees it: read-only.
 *
 * Stripe is configured by the PLATFORM OPERATOR, in the environment (AC_STRIPE_SK,
 * AC_STRIPE_PK, AC_STRIPE_WHS), and is used for one thing: practices paying for their
 * AureonCare subscription (services/platformBilling.js).
 *
 * This router used to let a practice edit `public.stripe_integration_settings`. That is a
 * single row shared by every practice, its keys were read by no code at all, and its
 * webhook secret overrode the platform's — so whoever could edit it could sign forged
 * Stripe events (SEC-38). Practices never collected patient card payments through it:
 * patient payments are taken outside AureonCare and recorded under Billing › Payments.
 *
 * So the edit endpoints are gone. They answer 403 with an explanation rather than 404, so
 * a browser still running the old screen tells the admin why instead of failing silently.
 * Online patient payments, if wanted, belong in a per-practice design (Stripe Connect),
 * not in a shared row.
 */

// GET /api/stripe-settings — what the Integrations screen shows.
router.get('/', (req, res) => {
  res.json({
    managed_by: 'platform',
    subscription_billing_configured: platformBilling.isConfigured(),
    patient_payments: 'recorded',
  });
});

const MANAGED = (req, res) => res.status(403).json({
  error: 'Stripe is managed by the platform',
  message: 'Stripe is configured by the AureonCare platform operator and is used for '
    + 'subscription billing only. Practices do not configure Stripe keys. Patient payments '
    + 'are recorded under Billing › Payments.',
});

router.post('/', MANAGED);
router.patch('/toggle', MANAGED);
router.post('/test', MANAGED);

module.exports = router;
