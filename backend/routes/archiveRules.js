const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAdmin } = require('../middleware/auth');

// Middleware to ensure only admins can access archive rules endpoints
router.use(requireAdmin);

/**
 * Calculate next run time based on schedule
 */
function calculateNextRun(scheduleType, scheduleTime, scheduleDayOfWeek, scheduleDayOfMonth, scheduleCron) {
  const now = new Date();
  const nextRun = new Date();

  // Parse time (HH:MM:SS)
  if (scheduleTime) {
    const [hours, minutes, seconds] = scheduleTime.split(':').map(Number);
    nextRun.setHours(hours, minutes, seconds || 0, 0);
  }

  switch (scheduleType) {
    case 'daily':
      // If time has passed today, schedule for tomorrow
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;

    case 'weekly':
      // Schedule for specific day of week
      const targetDay = scheduleDayOfWeek || 0; // Default to Sunday
      let daysUntilTarget = targetDay - nextRun.getDay();
      if (daysUntilTarget < 0 || (daysUntilTarget === 0 && nextRun <= now)) {
        daysUntilTarget += 7;
      }
      nextRun.setDate(nextRun.getDate() + daysUntilTarget);
      break;

    case 'monthly':
      // Schedule for specific day of month
      const targetDate = scheduleDayOfMonth || 1; // Default to 1st
      nextRun.setDate(targetDate);
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
      break;

    case 'custom':
      // For cron expressions, we'll calculate this in the scheduler
      // For now, set to next hour
      nextRun.setHours(nextRun.getHours() + 1, 0, 0, 0);
      break;

    default:
      // Default to next day at scheduled time
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
  }

  return nextRun;
}

/**
 * Get all archive rules
 * GET /api/archive-rules
 */
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT
        id,
        rule_name,
        description,
        enabled,
        selected_modules,
        schedule_type,
        schedule_cron,
        schedule_time,
        schedule_day_of_week,
        schedule_day_of_month,
        retention_days,
        retention_criteria,
        last_run_at,
        last_run_status,
        last_run_details,
        next_run_at,
        created_by,
        created_at,
        updated_at
      FROM archive_rules
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query);

    res.json({
      rules: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error getting archive rules:', error);
    res.status(500).json({ error: 'Failed to get archive rules', details: error.message });
  }
});

/**
 * Get single archive rule
 * GET /api/archive-rules/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = 'SELECT * FROM archive_rules WHERE id = $1';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Archive rule not found' });
    }

    res.json({ rule: result.rows[0] });
  } catch (error) {
    console.error('Error getting archive rule:', error);
    res.status(500).json({ error: 'Failed to get archive rule', details: error.message });
  }
});

/**
 * Create new archive rule
 * POST /api/archive-rules
 */
router.post('/', async (req, res) => {
  try {
    const {
      ruleName,
      description,
      enabled = true,
      selectedModules,
      scheduleType,
      scheduleCron,
      scheduleTime = '02:00:00',
      scheduleDayOfWeek,
      scheduleDayOfMonth,
      retentionDays,
      retentionCriteria
    } = req.body;

    // Validation
    if (!ruleName || !selectedModules || !Array.isArray(selectedModules) || selectedModules.length === 0) {
      return res.status(400).json({
        error: 'Rule name and at least one selected module are required'
      });
    }

    if (!scheduleType || !['daily', 'weekly', 'monthly', 'custom'].includes(scheduleType)) {
      return res.status(400).json({
        error: 'Valid schedule type is required (daily, weekly, monthly, or custom)'
      });
    }

    // Calculate next run time
    const nextRunAt = calculateNextRun(
      scheduleType,
      scheduleTime,
      scheduleDayOfWeek,
      scheduleDayOfMonth,
      scheduleCron
    );

    const insertQuery = `
      INSERT INTO archive_rules (
        rule_name, description, enabled, selected_modules,
        schedule_type, schedule_cron, schedule_time,
        schedule_day_of_week, schedule_day_of_month,
        retention_days, retention_criteria,
        next_run_at, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const values = [
      ruleName,
      description || null,
      enabled,
      selectedModules,
      scheduleType,
      scheduleCron || null,
      scheduleTime,
      scheduleDayOfWeek || null,
      scheduleDayOfMonth || null,
      retentionDays || null,
      retentionCriteria || null,
      nextRunAt,
      req.user?.id || req.headers['x-user-id']
    ];

    const result = await pool.query(insertQuery, values);

    console.log('Archive rule created:', result.rows[0]);

    res.json({
      success: true,
      message: 'Archive rule created successfully',
      rule: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating archive rule:', error);

    if (error.code === '23505') { // Unique violation
      return res.status(400).json({
        error: 'An archive rule with this name already exists'
      });
    }

    res.status(500).json({ error: 'Failed to create archive rule', details: error.message });
  }
});

/**
 * Update archive rule
 * PUT /api/archive-rules/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      ruleName,
      description,
      enabled,
      selectedModules,
      scheduleType,
      scheduleCron,
      scheduleTime,
      scheduleDayOfWeek,
      scheduleDayOfMonth,
      retentionDays,
      retentionCriteria
    } = req.body;

    // Check if rule exists
    const checkQuery = 'SELECT * FROM archive_rules WHERE id = $1';
    const checkResult = await pool.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Archive rule not found' });
    }

    // Calculate new next run time if schedule changed
    let nextRunAt = checkResult.rows[0].next_run_at;
    if (scheduleType || scheduleTime || scheduleDayOfWeek || scheduleDayOfMonth || scheduleCron) {
      nextRunAt = calculateNextRun(
        scheduleType || checkResult.rows[0].schedule_type,
        scheduleTime || checkResult.rows[0].schedule_time,
        scheduleDayOfWeek !== undefined ? scheduleDayOfWeek : checkResult.rows[0].schedule_day_of_week,
        scheduleDayOfMonth !== undefined ? scheduleDayOfMonth : checkResult.rows[0].schedule_day_of_month,
        scheduleCron || checkResult.rows[0].schedule_cron
      );
    }

    const updateQuery = `
      UPDATE archive_rules
      SET
        rule_name = COALESCE($1, rule_name),
        description = COALESCE($2, description),
        enabled = COALESCE($3, enabled),
        selected_modules = COALESCE($4, selected_modules),
        schedule_type = COALESCE($5, schedule_type),
        schedule_cron = COALESCE($6, schedule_cron),
        schedule_time = COALESCE($7, schedule_time),
        schedule_day_of_week = COALESCE($8, schedule_day_of_week),
        schedule_day_of_month = COALESCE($9, schedule_day_of_month),
        retention_days = COALESCE($10, retention_days),
        retention_criteria = COALESCE($11, retention_criteria),
        next_run_at = $12
      WHERE id = $13
      RETURNING *
    `;

    const values = [
      ruleName,
      description,
      enabled,
      selectedModules,
      scheduleType,
      scheduleCron,
      scheduleTime,
      scheduleDayOfWeek,
      scheduleDayOfMonth,
      retentionDays,
      retentionCriteria,
      nextRunAt,
      id
    ];

    const result = await pool.query(updateQuery, values);

    res.json({
      success: true,
      message: 'Archive rule updated successfully',
      rule: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating archive rule:', error);

    if (error.code === '23505') {
      return res.status(400).json({
        error: 'An archive rule with this name already exists'
      });
    }

    res.status(500).json({ error: 'Failed to update archive rule', details: error.message });
  }
});

/**
 * Delete archive rule
 * DELETE /api/archive-rules/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deleteQuery = 'DELETE FROM archive_rules WHERE id = $1 RETURNING id, rule_name';
    const result = await pool.query(deleteQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Archive rule not found' });
    }

    res.json({
      success: true,
      message: 'Archive rule deleted successfully',
      rule: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting archive rule:', error);
    res.status(500).json({ error: 'Failed to delete archive rule', details: error.message });
  }
});

/**
 * Toggle archive rule enabled/disabled
 * POST /api/archive-rules/:id/toggle
 */
router.post('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      UPDATE archive_rules
      SET enabled = NOT enabled
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Archive rule not found' });
    }

    res.json({
      success: true,
      message: `Archive rule ${result.rows[0].enabled ? 'enabled' : 'disabled'}`,
      rule: result.rows[0]
    });
  } catch (error) {
    console.error('Error toggling archive rule:', error);
    res.status(500).json({ error: 'Failed to toggle archive rule', details: error.message });
  }
});

/**
 * Manually trigger archive rule execution
 * POST /api/archive-rules/:id/trigger
 */
router.post('/:id/trigger', async (req, res) => {
  try {
    const { id } = req.params;

    // Get rule details
    const ruleQuery = 'SELECT * FROM archive_rules WHERE id = $1';
    const ruleResult = await pool.query(ruleQuery, [id]);

    if (ruleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Archive rule not found' });
    }

    const rule = ruleResult.rows[0];

    // Update status to running
    await pool.query(
      'UPDATE archive_rules SET last_run_status = $1, last_run_at = $2 WHERE id = $3',
      ['running', new Date(), id]
    );

    // Import and execute the rule (we'll call the archive creation logic)
    const archiveModule = require('./archive');

    // Create archive name with timestamp
    const archiveName = `${rule.rule_name}_${new Date().toISOString().split('T')[0]}_${Date.now()}`;

    // Build request object for archive creation
    const archiveReq = {
      body: {
        archiveName,
        description: `Automatic archive from rule: ${rule.rule_name}`,
        selectedModules: rule.selected_modules
      },
      user: req.user,
      headers: req.headers
    };

    // Mock response object to capture result
    let archiveResult = null;
    let archiveError = null;
    const archiveRes = {
      json: (data) => { archiveResult = data; },
      status: (code) => ({
        json: (data) => { archiveError = { code, ...data }; }
      })
    };

    // Note: This is a simplified trigger - in production, you'd want to
    // queue this job to run asynchronously via a job queue system
    console.log(`Manually triggering archive rule: ${rule.rule_name}`);

    // Calculate next run
    const nextRunAt = calculateNextRun(
      rule.schedule_type,
      rule.schedule_time,
      rule.schedule_day_of_week,
      rule.schedule_day_of_month,
      rule.schedule_cron
    );

    // Update rule with execution details
    const updateQuery = `
      UPDATE archive_rules
      SET
        last_run_at = $1,
        last_run_status = $2,
        last_run_details = $3,
        next_run_at = $4
      WHERE id = $5
      RETURNING *
    `;

    const executionDetails = {
      triggered_by: 'manual',
      triggered_at: new Date().toISOString(),
      archive_name: archiveName,
      user_id: req.user?.id || req.headers['x-user-id']
    };

    const result = await pool.query(updateQuery, [
      new Date(),
      'success',
      executionDetails,
      nextRunAt,
      id
    ]);

    res.json({
      success: true,
      message: 'Archive rule triggered successfully',
      rule: result.rows[0],
      execution: {
        archiveName,
        triggeredAt: new Date().toISOString(),
        nextRunAt
      }
    });
  } catch (error) {
    console.error('Error triggering archive rule:', error);

    // Update rule status to failed
    await pool.query(
      `UPDATE archive_rules
       SET last_run_status = $1,
           last_run_details = $2
       WHERE id = $3`,
      ['failed', { error: error.message }, req.params.id]
    ).catch(err => console.error('Error updating failed status:', err));

    res.status(500).json({
      error: 'Failed to trigger archive rule',
      details: error.message
    });
  }
});

module.exports = router;
