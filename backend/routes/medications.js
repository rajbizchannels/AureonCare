const express = require('express');
const router = express.Router();

// Helper function to convert snake_case to camelCase
const toCamelCase = (obj) => {
  if (!obj) return obj;
  const newObj = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    newObj[camelKey] = obj[key];
  }
  return newObj;
};

// Search medications
router.get('/search', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { query, drug_class, generic_only, limit = 50 } = req.query;

    let sqlQuery = `
      SELECT * FROM medications
      WHERE is_active = true
    `;
    const params = [];
    let paramCount = 1;

    if (query) {
      sqlQuery += ` AND (
        LOWER(drug_name) LIKE LOWER($${paramCount}) OR
        LOWER(generic_name) LIKE LOWER($${paramCount}) OR
        LOWER(brand_name) LIKE LOWER($${paramCount}) OR
        ndc_code LIKE $${paramCount}
      )`;
      params.push(`%${query}%`);
      paramCount++;
    }

    if (drug_class) {
      sqlQuery += ` AND LOWER(drug_class) = LOWER($${paramCount})`;
      params.push(drug_class);
      paramCount++;
    }

    if (generic_only === 'true') {
      sqlQuery += ` AND is_generic = true`;
    }

    sqlQuery += ` ORDER BY
      CASE
        WHEN LOWER(drug_name) = LOWER($${paramCount}) THEN 1
        WHEN LOWER(generic_name) = LOWER($${paramCount}) THEN 2
        WHEN LOWER(brand_name) = LOWER($${paramCount}) THEN 3
        ELSE 4
      END,
      formulary_status,
      drug_name
      LIMIT $${paramCount + 1}
    `;
    params.push(query || '');
    params.push(parseInt(limit));

    const result = await pool.query(sqlQuery, params);
    res.json(result.rows.map(toCamelCase));
  } catch (error) {
    console.error('Error searching medications:', error);
    res.status(500).json({ error: 'Failed to search medications' });
  }
});

// Get all medications
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { drug_class, controlled_only } = req.query;

    let query = 'SELECT * FROM medications WHERE is_active = true';
    const params = [];
    let paramCount = 1;

    if (drug_class) {
      query += ` AND LOWER(drug_class) = LOWER($${paramCount})`;
      params.push(drug_class);
      paramCount++;
    }

    if (controlled_only === 'true') {
      query += ` AND controlled_substance = true`;
    }

    query += ' ORDER BY drug_name';

    const result = await pool.query(query, params);
    res.json(result.rows.map(toCamelCase));
  } catch (error) {
    console.error('Error fetching medications:', error);
    res.status(500).json({ error: 'Failed to fetch medications' });
  }
});

// Get single medication by ID
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'SELECT * FROM medications WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error fetching medication:', error);
    res.status(500).json({ error: 'Failed to fetch medication' });
  }
});

// Get medication by NDC code
router.get('/ndc/:ndcCode', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'SELECT * FROM medications WHERE ndc_code = $1',
      [req.params.ndcCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error fetching medication:', error);
    res.status(500).json({ error: 'Failed to fetch medication' });
  }
});

// Get medication alternatives (generic/brand equivalents)
router.get('/:id/alternatives', async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    // Get the original medication's NDC
    const originalResult = await pool.query(
      'SELECT ndc_code FROM medications WHERE id = $1',
      [req.params.id]
    );

    if (originalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    const ndcCode = originalResult.rows[0].ndc_code;

    // Get alternatives
    const result = await pool.query(`
      SELECT
        m.*,
        ma.relationship_type,
        ma.cost_difference,
        ma.notes as alternative_notes
      FROM medication_alternatives ma
      JOIN medications m ON ma.alternative_ndc = m.ndc_code
      WHERE ma.original_ndc = $1 AND m.is_active = true
      ORDER BY
        CASE ma.relationship_type
          WHEN 'generic-of' THEN 1
          WHEN 'brand-of' THEN 2
          ELSE 3
        END,
        m.average_cost
    `, [ndcCode]);

    res.json(result.rows.map(toCamelCase));
  } catch (error) {
    console.error('Error fetching medication alternatives:', error);
    res.status(500).json({ error: 'Failed to fetch medication alternatives' });
  }
});

// Check drug interactions
router.post('/check-interactions', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { ndcCodes } = req.body; // Array of NDC codes

    if (!Array.isArray(ndcCodes) || ndcCodes.length < 2) {
      return res.status(400).json({ error: 'At least two medications required for interaction check' });
    }

    const interactions = [];

    // Check each pair of medications
    for (let i = 0; i < ndcCodes.length; i++) {
      for (let j = i + 1; j < ndcCodes.length; j++) {
        const result = await pool.query(`
          SELECT
            di.*,
            m1.drug_name as drug1_name,
            m2.drug_name as drug2_name
          FROM drug_interactions di
          JOIN medications m1 ON di.drug1_ndc = m1.ndc_code
          JOIN medications m2 ON di.drug2_ndc = m2.ndc_code
          WHERE (di.drug1_ndc = $1 AND di.drug2_ndc = $2)
             OR (di.drug1_ndc = $2 AND di.drug2_ndc = $1)
        `, [ndcCodes[i], ndcCodes[j]]);

        if (result.rows.length > 0) {
          interactions.push(...result.rows.map(toCamelCase));
        }
      }
    }

    res.json({
      checked: ndcCodes.length,
      interactions: interactions,
      hasInteractions: interactions.length > 0,
      severityLevels: {
        severe: interactions.filter(i => i.interactionSeverity === 'severe').length,
        moderate: interactions.filter(i => i.interactionSeverity === 'moderate').length,
        mild: interactions.filter(i => i.interactionSeverity === 'mild').length
      }
    });
  } catch (error) {
    console.error('Error checking drug interactions:', error);
    res.status(500).json({ error: 'Failed to check drug interactions' });
  }
});

// Get common drug classes
router.get('/drug-classes/list', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(`
      SELECT DISTINCT drug_class, COUNT(*) as medication_count
      FROM medications
      WHERE is_active = true AND drug_class IS NOT NULL
      GROUP BY drug_class
      ORDER BY drug_class
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching drug classes:', error);
    res.status(500).json({ error: 'Failed to fetch drug classes' });
  }
});

// Create new medication (admin)
router.post('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const {
      ndcCode, drugName, genericName, brandName, drugClass, strength,
      dosageForm, route, manufacturer, controlledSubstance, deaSchedule,
      requiresPriorAuth, formularyStatus, averageCost, isGeneric
    } = req.body;

    const result = await pool.query(`
      INSERT INTO medications (
        ndc_code, drug_name, generic_name, brand_name, drug_class, strength,
        dosage_form, route, manufacturer, controlled_substance, dea_schedule,
        requires_prior_auth, formulary_status, average_cost, is_generic
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      ndcCode, drugName, genericName, brandName, drugClass, strength,
      dosageForm, route, manufacturer, controlledSubstance, deaSchedule,
      requiresPriorAuth, formularyStatus, averageCost, isGeneric
    ]);

    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error creating medication:', error);
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ error: 'Medication with this NDC code already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create medication' });
    }
  }
});

// Update medication
router.put('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const {
      drugName, genericName, brandName, drugClass, strength, dosageForm,
      route, manufacturer, controlledSubstance, deaSchedule,
      requiresPriorAuth, formularyStatus, averageCost, isGeneric, isActive
    } = req.body;

    const result = await pool.query(`
      UPDATE medications SET
        drug_name = COALESCE($1, drug_name),
        generic_name = COALESCE($2, generic_name),
        brand_name = COALESCE($3, brand_name),
        drug_class = COALESCE($4, drug_class),
        strength = COALESCE($5, strength),
        dosage_form = COALESCE($6, dosage_form),
        route = COALESCE($7, route),
        manufacturer = COALESCE($8, manufacturer),
        controlled_substance = COALESCE($9, controlled_substance),
        dea_schedule = COALESCE($10, dea_schedule),
        requires_prior_auth = COALESCE($11, requires_prior_auth),
        formulary_status = COALESCE($12, formulary_status),
        average_cost = COALESCE($13, average_cost),
        is_generic = COALESCE($14, is_generic),
        is_active = COALESCE($15, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $16
      RETURNING *
    `, [
      drugName, genericName, brandName, drugClass, strength, dosageForm,
      route, manufacturer, controlledSubstance, deaSchedule,
      requiresPriorAuth, formularyStatus, averageCost, isGeneric, isActive,
      req.params.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error updating medication:', error);
    res.status(500).json({ error: 'Failed to update medication' });
  }
});

module.exports = router;
