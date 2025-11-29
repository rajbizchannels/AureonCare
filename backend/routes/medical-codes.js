const express = require('express');
const router = express.Router();

// Search medical codes (ICD-10 and CPT) - Now queries from database
router.get('/search', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { query, type } = req.query;

    if (!query || query.trim().length === 0) {
      return res.json([]);
    }

    const searchTerm = query.toLowerCase().trim();
    let sqlQuery = `
      SELECT
        code,
        description,
        code_type as type,
        category
      FROM medical_codes
      WHERE is_active = true
        AND (
          LOWER(code) LIKE $1
          OR LOWER(description) LIKE $2
          OR to_tsvector('english', description) @@ plainto_tsquery('english', $3)
        )
    `;

    const params = [
      `%${searchTerm}%`,
      `%${searchTerm}%`,
      searchTerm
    ];

    // Filter by code type if specified
    if (type && type !== 'all') {
      if (type === 'icd') {
        sqlQuery += ` AND code_type = 'ICD-10'`;
      } else if (type === 'cpt') {
        sqlQuery += ` AND code_type = 'CPT'`;
      }
    }

    // Order by relevance: exact code matches first, then prefix matches, then description matches
    sqlQuery += `
      ORDER BY
        CASE
          WHEN LOWER(code) = $4 THEN 1
          WHEN LOWER(code) LIKE $5 THEN 2
          ELSE 3
        END,
        code
      LIMIT 50
    `;

    params.push(searchTerm, `${searchTerm}%`);

    const result = await pool.query(sqlQuery, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error searching medical codes:', error);
    res.status(500).json({ error: 'Failed to search medical codes' });
  }
});

// Get all ICD-10 codes
router.get('/icd10', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { limit } = req.query;

    let query = `
      SELECT
        code,
        description,
        code_type as type,
        category
      FROM medical_codes
      WHERE code_type = 'ICD-10' AND is_active = true
      ORDER BY code
    `;

    if (limit) {
      query += ` LIMIT $1`;
      const result = await pool.query(query, [parseInt(limit)]);
      res.json(result.rows);
    } else {
      const result = await pool.query(query);
      res.json(result.rows);
    }
  } catch (error) {
    console.error('Error fetching ICD-10 codes:', error);
    res.status(500).json({ error: 'Failed to fetch ICD-10 codes' });
  }
});

// Get all CPT codes
router.get('/cpt', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { limit } = req.query;

    let query = `
      SELECT
        code,
        description,
        code_type as type,
        category
      FROM medical_codes
      WHERE code_type = 'CPT' AND is_active = true
      ORDER BY code
    `;

    if (limit) {
      query += ` LIMIT $1`;
      const result = await pool.query(query, [parseInt(limit)]);
      res.json(result.rows);
    } else {
      const result = await pool.query(query);
      res.json(result.rows);
    }
  } catch (error) {
    console.error('Error fetching CPT codes:', error);
    res.status(500).json({ error: 'Failed to fetch CPT codes' });
  }
});

// Get code by exact code value
router.get('/code/:code', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { code } = req.params;

    const result = await pool.query(
      `SELECT
        code,
        description,
        code_type as type,
        category
      FROM medical_codes
      WHERE UPPER(code) = UPPER($1) AND is_active = true
      LIMIT 1`,
      [code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Code not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching code:', error);
    res.status(500).json({ error: 'Failed to fetch code' });
  }
});

// Get all categories
router.get('/categories', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { type } = req.query;

    let query = `
      SELECT DISTINCT category
      FROM medical_codes
      WHERE is_active = true AND category IS NOT NULL
    `;

    if (type && type !== 'all') {
      if (type === 'icd') {
        query += ` AND code_type = 'ICD-10'`;
      } else if (type === 'cpt') {
        query += ` AND code_type = 'CPT'`;
      }
    }

    query += ` ORDER BY category`;

    const result = await pool.query(query);
    res.json(result.rows.map(row => row.category));
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

module.exports = router;
