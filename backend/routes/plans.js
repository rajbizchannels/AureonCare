const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const billing = require('../services/platformBilling');
const { invalidateEntitlements } = require('../services/entitlements');
const router = express.Router();
router.use(authenticate);

// Get all subscription plans
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    // Only plans that can actually be switched to: active, and with a Stripe price, so
    // the page never offers a plan the change endpoint would then refuse.
    const result = await pool.query(`
      SELECT id, name, display_name, description, price, currency, billing_cycle,
             max_users, max_providers, max_patients, features, trial_days,
             (stripe_price_id IS NOT NULL) AS purchasable
        FROM subscription_plans
       WHERE is_active = true
       ORDER BY price ASC NULLS FIRST, id
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// The tenant's ACTUAL subscription.
//
// Reads control.subscriptions, which is authoritative, rather than the legacy global
// organization_settings row — that row is shared by every tenant, so on a multi-tenant
// install it showed one practice another practice's plan. Falls back to the legacy row
// only when no control-plane subscription exists (a pre-SEC-05 single-tenant install).
router.get('/current', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const practiceId = req.user.practiceId || null;

    if (practiceId) {
      const { rows } = await pool.query(
        `SELECT s.plan_id, s.plan_name, s.status, s.seats, s.trial_end, s.current_period_end,
                (s.stripe_subscription_id IS NOT NULL) AS billing_linked,
                p.display_name AS plan_display_name, p.description AS plan_description,
                p.price AS plan_price, p.currency, p.billing_cycle,
                p.max_users, p.max_providers, p.max_patients, p.features
           FROM control.subscriptions s
           LEFT JOIN public.subscription_plans p ON p.id = s.plan_id
          WHERE s.practice_id = $1
          LIMIT 1`,
        [practiceId]
      );
      if (rows.length) return res.json({ source: 'control_plane', ...rows[0] });
    }

    const legacy = await pool.query(`
      SELECT os.*, sp.name as plan_name, sp.display_name as plan_display_name,
             sp.description as plan_description, sp.price as plan_price,
             sp.billing_cycle, sp.max_users, sp.max_patients, sp.features
        FROM organization_settings os
        JOIN subscription_plans sp ON os.current_plan_id = sp.id
       LIMIT 1
    `);
    if (legacy.rows.length === 0) {
      return res.status(404).json({ error: 'No subscription found for this practice' });
    }
    res.json({ source: 'legacy', ...legacy.rows[0] });
  } catch (error) {
    console.error('Error fetching current plan:', error);
    res.status(500).json({ error: 'Failed to fetch current plan' });
  }
});

/**
 * What changing to `planId` would cost right now, prorated. Read-only — nothing is
 * charged or changed by asking.
 */
router.get('/preview/:planId', authorize('admin'), async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    if (!req.user.practiceId) return res.status(403).json({ error: 'Your account is not linked to a practice.' });
    const { rows } = await pool.query(
      `SELECT s.stripe_subscription_id, p.stripe_price_id, p.display_name
         FROM control.subscriptions s
         CROSS JOIN public.subscription_plans p
        WHERE s.practice_id = $1 AND p.id = $2`,
      [req.user.practiceId, req.params.planId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Plan or subscription not found' });
    const { stripe_subscription_id: subId, stripe_price_id: priceId } = rows[0];

    // No Stripe subscription (an operator-created tenant, or one still on the legacy
    // path): the switch is a records-only change with nothing to prorate.
    if (!subId || !priceId || !billing.isConfigured()) {
      return res.json({ prorated: false, amountDue: 0, lines: [] });
    }
    const preview = await billing.previewPlanChange({ subscriptionId: subId, newPriceId: priceId });
    res.json({ prorated: true, ...preview });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.message });
    console.error('Plan preview error:', e);
    res.status(502).json({ error: e.message || 'Could not price that change.' });
  }
});

/**
 * Change the practice's plan — prorated, and against the practice's OWN subscription.
 *
 * What this used to do: write current_plan_id into the LEGACY global organization_settings
 * row. That row is shared by every tenant, so on a multi-tenant install one practice's
 * upgrade silently moved everyone; and it changed no billing at all, so a practice could
 * "upgrade" without ever being charged.
 *
 * What it does now: move the Stripe subscription onto the new plan's price with
 * proration_behavior 'create_prorations' — Stripe credits the unused remainder of the
 * current period and bills the new plan pro rata — then record the result in
 * control.subscriptions, which is what entitlement checks read. The change is reflected in
 * the platform console immediately, and again when Stripe's webhook confirms it.
 *
 * Admin-only, and scoped to the caller's own practice: practiceId comes from the verified
 * session, never from the request body.
 */
router.put('/current', authorize('admin'), async (req, res) => {
  const pool = req.app.locals.pool;
  const { plan_id: planId, prorationDate } = req.body || {};
  if (!planId) return res.status(400).json({ error: 'Plan ID is required' });
  if (!req.user.practiceId) {
    return res.status(403).json({ error: 'Your account is not linked to a practice.' });
  }

  try {
    const { rows: planRows } = await pool.query(
      'SELECT * FROM public.subscription_plans WHERE id = $1 AND is_active = true', [planId]
    );
    if (!planRows.length) return res.status(404).json({ error: 'Plan not found' });
    const plan = planRows[0];

    const { rows: subRows } = await pool.query(
      'SELECT * FROM control.subscriptions WHERE practice_id = $1 LIMIT 1', [req.user.practiceId]
    );
    if (!subRows.length) {
      return res.status(409).json({
        error: 'This practice has no subscription record. Contact support.',
      });
    }
    const sub = subRows[0];
    if (sub.plan_id === plan.id) {
      return res.status(400).json({ error: 'You are already on that plan.' });
    }

    // Move the money first. If Stripe refuses (card declined, subscription canceled), the
    // entitlement must NOT change — otherwise a practice could unlock a higher tier by
    // failing to pay for it.
    let prorated = false;
    if (sub.stripe_subscription_id && plan.stripe_price_id && billing.isConfigured()) {
      await billing.changeSubscriptionPlan({
        subscriptionId: sub.stripe_subscription_id,
        newPriceId: plan.stripe_price_id,
        prorationDate: prorationDate ? Number(prorationDate) : undefined,
      });
      prorated = true;
    }

    const { rows: updated } = await pool.query(
      `UPDATE control.subscriptions
          SET plan_id = $2, plan_name = $3, updated_at = now()
        WHERE practice_id = $1
        RETURNING plan_id, plan_name, status, current_period_end`,
      [req.user.practiceId, plan.id, plan.name]
    );
    invalidateEntitlements(req.user.practiceId);

    res.json({
      ...updated[0],
      prorated,
      plan_display_name: plan.display_name,
      plan_price: plan.price,
      currency: plan.currency,
      billing_cycle: plan.billing_cycle,
      message: prorated
        ? 'Plan changed. The prorated credit and charge appear on your next invoice.'
        : 'Plan changed. This practice is not billed through Stripe, so nothing was charged.',
    });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('Error updating plan:', error);
    // Stripe's own message is actionable ("card declined"); a generic 500 is not.
    res.status(502).json({ error: error.message || 'Could not change the plan.' });
  }
});

// Get plan features and limits (includes provider seats)
router.get('/features', async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(`
      SELECT
        sp.name                    AS plan_name,
        sp.display_name            AS plan_display_name,
        sp.features,
        sp.max_users,
        sp.max_patients,
        sp.max_providers,
        sp.base_price_per_provider,
        os.provider_seats_purchased,
        os.is_trial,
        os.trial_end_date,
        os.plan_end_date,
        os.auto_renew,
        os.enforcement_enabled,
        (SELECT COUNT(*) FROM users  WHERE status = 'active' AND role <> 'patient') AS current_users,
        (SELECT COUNT(*) FROM users  WHERE status = 'active' AND role = 'doctor')   AS current_providers,
        (SELECT COUNT(*) FROM patients WHERE status = 'Active')                     AS current_patients
      FROM organization_settings os
      JOIN subscription_plans sp ON os.current_plan_id = sp.id
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No plan configured' });
    }

    const d = result.rows[0];
    const effectiveProviderLimit =
      d.max_providers === -1 ? -1
        : d.max_providers + (d.provider_seats_purchased || 0);

    res.json({
      plan: {
        name:        d.plan_name,
        displayName: d.plan_display_name,
        isTrial:     d.is_trial,
        trialEndDate: d.trial_end_date,
        endDate:     d.plan_end_date,
        autoRenew:   d.auto_renew,
        enforcementEnabled: d.enforcement_enabled,
      },
      features: d.features || {},
      limits: {
        users: {
          max:       d.max_users,
          current:   parseInt(d.current_users, 10),
          unlimited: d.max_users === -1,
        },
        patients: {
          max:       d.max_patients,
          current:   parseInt(d.current_patients, 10),
          unlimited: d.max_patients === -1,
        },
        providers: {
          included:  d.max_providers,
          purchased: d.provider_seats_purchased || 0,
          effective: effectiveProviderLimit,
          current:   parseInt(d.current_providers, 10),
          unlimited: d.max_providers === -1,
          additionalSeatPrice: d.base_price_per_provider,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching plan features:', error);
    res.status(500).json({ error: 'Failed to fetch plan features' });
  }
});

// Purchase additional provider seats (admin only).
//
// Same defect as PUT /current: it increments purchased seats on the shared
// organization_settings row with no authorization at all, so any signed-in user could
// grant themselves capacity nobody paid for.
router.post('/provider-seats', authorize('admin'), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { additionalSeats } = req.body;

    if (!additionalSeats || additionalSeats < 1) {
      return res.status(400).json({ error: 'additionalSeats must be a positive integer' });
    }

    const result = await pool.query(`
      UPDATE organization_settings
      SET provider_seats_purchased = provider_seats_purchased + $1,
          updated_at = NOW()
      WHERE id = (SELECT id FROM organization_settings LIMIT 1)
      RETURNING provider_seats_purchased
    `, [parseInt(additionalSeats, 10)]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization settings not found' });
    }

    res.json({
      message: `${additionalSeats} provider seat(s) added.`,
      totalPurchasedSeats: result.rows[0].provider_seats_purchased,
    });
  } catch (error) {
    console.error('Error adding provider seats:', error);
    res.status(500).json({ error: 'Failed to add provider seats' });
  }
});

module.exports = router;
