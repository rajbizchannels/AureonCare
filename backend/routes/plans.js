const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);

// Get all subscription plans
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(`
      SELECT * FROM subscription_plans
      WHERE is_active = true
      ORDER BY price ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// Get current organization plan
router.get('/current', async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(`
      SELECT
        os.*,
        sp.name as plan_name,
        sp.display_name as plan_display_name,
        sp.description as plan_description,
        sp.price as plan_price,
        sp.billing_cycle,
        sp.max_users,
        sp.max_patients,
        sp.features
      FROM organization_settings os
      JOIN subscription_plans sp ON os.current_plan_id = sp.id
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No organization settings found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching current plan:', error);
    res.status(500).json({ error: 'Failed to fetch current plan' });
  }
});

// Update organization plan (admin only).
//
// The comment said "admin only" but nothing enforced it: any authenticated user — a
// patient-portal account included — could change the workspace's plan. It writes the
// LEGACY global organization_settings row, which is shared by every tenant and is what
// plan enforcement falls back to when a tenant has no control.subscriptions row, so an
// unprivileged caller could raise (or drop) limits for everyone. Real entitlements now
// come from control.subscriptions, which only a platform operator or a paid Stripe
// subscription can change.
router.put('/current', authorize('admin'), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { plan_id, auto_renew } = req.body;

    if (!plan_id) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    // Verify plan exists
    const planCheck = await pool.query(
      'SELECT * FROM subscription_plans WHERE id = $1 AND is_active = true',
      [plan_id]
    );

    if (planCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const plan = planCheck.rows[0];

    // Calculate new end date based on billing cycle
    let planEndDate = new Date();
    if (plan.billing_cycle === 'yearly') {
      planEndDate.setFullYear(planEndDate.getFullYear() + 1);
    } else {
      planEndDate.setMonth(planEndDate.getMonth() + 1);
    }

    // Update organization settings
    const result = await pool.query(`
      UPDATE organization_settings
      SET
        current_plan_id = $1,
        plan_start_date = CURRENT_DATE,
        plan_end_date = $2,
        auto_renew = COALESCE($3, auto_renew),
        updated_at = NOW()
      WHERE id = (SELECT id FROM organization_settings LIMIT 1)
      RETURNING *
    `, [plan_id, planEndDate, auto_renew]);

    if (result.rows.length === 0) {
      // Create if doesn't exist
      await pool.query(`
        INSERT INTO organization_settings (current_plan_id, plan_start_date, plan_end_date, auto_renew)
        VALUES ($1, CURRENT_DATE, $2, $3)
      `, [plan_id, planEndDate, auto_renew !== undefined ? auto_renew : true]);
    }

    // Get updated plan info
    const updatedResult = await pool.query(`
      SELECT
        os.*,
        sp.name as plan_name,
        sp.display_name as plan_display_name,
        sp.description as plan_description,
        sp.price as plan_price,
        sp.billing_cycle,
        sp.max_users,
        sp.max_patients,
        sp.features
      FROM organization_settings os
      JOIN subscription_plans sp ON os.current_plan_id = sp.id
      LIMIT 1
    `);

    res.json({
      message: 'Plan updated successfully',
      plan: updatedResult.rows[0]
    });
  } catch (error) {
    console.error('Error updating plan:', error);
    res.status(500).json({ error: 'Failed to update plan' });
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
