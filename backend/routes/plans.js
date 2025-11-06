const express = require('express');
const router = express.Router();

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

// Update organization plan (admin only)
router.put('/current', async (req, res) => {
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

// Get plan features and limits
router.get('/features', async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(`
      SELECT
        sp.features,
        sp.max_users,
        sp.max_patients,
        (SELECT COUNT(*) FROM users WHERE status = 'active') as current_users,
        (SELECT COUNT(*) FROM patients WHERE status = 'Active') as current_patients
      FROM organization_settings os
      JOIN subscription_plans sp ON os.current_plan_id = sp.id
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No plan configured' });
    }

    const data = result.rows[0];
    const features = data.features || {};

    res.json({
      features,
      limits: {
        users: {
          max: data.max_users,
          current: parseInt(data.current_users),
          unlimited: data.max_users === -1
        },
        patients: {
          max: data.max_patients,
          current: parseInt(data.current_patients),
          unlimited: data.max_patients === -1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching plan features:', error);
    res.status(500).json({ error: 'Failed to fetch plan features' });
  }
});

module.exports = router;
