const express = require('express');
const router = express.Router();

// Helper function to convert snake_case to camelCase
const toCamelCase = (obj) => {
  const newObj = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    newObj[camelKey] = obj[key];
  }
  return newObj;
};

// Helper function to ensure campaigns table exists
const ensureTableExists = async (pool) => {
  try {
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'campaigns'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      // Create campaigns table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS campaigns (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          subject VARCHAR(500),
          email_content TEXT,
          target_audience VARCHAR(100),
          status VARCHAR(50) DEFAULT 'draft',
          scheduled_date TIMESTAMP,
          offering_id TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✓ Campaigns table created successfully');
    } else {
      // Check if offering_id column needs to be migrated from INTEGER to TEXT
      const columnCheck = await pool.query(`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'campaigns'
        AND column_name = 'offering_id';
      `);

      if (columnCheck.rows.length > 0 && columnCheck.rows[0].data_type === 'integer') {
        // Migrate offering_id from INTEGER to TEXT
        console.log('Migrating campaigns.offering_id from INTEGER to TEXT...');
        await pool.query(`
          ALTER TABLE campaigns
          ALTER COLUMN offering_id TYPE TEXT USING offering_id::TEXT;
        `);
        console.log('✓ Campaigns table migrated successfully');
      }
    }
  } catch (error) {
    console.error('Error ensuring campaigns table exists:', error);
    throw error;
  }
};

// Get all campaigns
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    await ensureTableExists(pool);

    const { status, offeringId } = req.query;

    let query = 'SELECT * FROM campaigns WHERE 1=1';
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    if (offeringId) {
      params.push(offeringId);
      query += ` AND offering_id = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    const campaigns = result.rows.map(toCamelCase);
    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns', details: error.message });
  }
});

// Get single campaign
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    await ensureTableExists(pool);

    const result = await pool.query(
      'SELECT * FROM campaigns WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

// Create new campaign
router.post('/', async (req, res) => {
  const {
    name,
    subject,
    emailContent,
    targetAudience,
    status,
    scheduledDate,
    offeringId
  } = req.body;

  try {
    const pool = req.app.locals.pool;
    await ensureTableExists(pool);

    const result = await pool.query(
      `INSERT INTO campaigns (
        name, subject, email_content, target_audience, status, scheduled_date, offering_id, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *`,
      [
        name,
        subject,
        emailContent,
        targetAudience || 'all',
        status || 'draft',
        scheduledDate || null,
        offeringId || null
      ]
    );

    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign', details: error.message });
  }
});

// Update campaign
router.put('/:id', async (req, res) => {
  const {
    name,
    subject,
    emailContent,
    targetAudience,
    status,
    scheduledDate,
    offeringId
  } = req.body;

  try {
    const pool = req.app.locals.pool;
    await ensureTableExists(pool);

    const result = await pool.query(
      `UPDATE campaigns
       SET name = COALESCE($1, name),
           subject = COALESCE($2, subject),
           email_content = COALESCE($3, email_content),
           target_audience = COALESCE($4, target_audience),
           status = COALESCE($5, status),
           scheduled_date = COALESCE($6, scheduled_date),
           offering_id = COALESCE($7, offering_id),
           updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [name, subject, emailContent, targetAudience, status, scheduledDate, offeringId, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

// Delete campaign
router.delete('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    await ensureTableExists(pool);

    const result = await pool.query(
      'DELETE FROM campaigns WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

module.exports = router;
