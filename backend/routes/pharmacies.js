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

// Search pharmacies by location
router.get('/search', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { zip_code, city, state, pharmacy_name, accepts_erx, preferred_only, limit = 50 } = req.query;

    let query = `
      SELECT *,
        (CASE WHEN accepts_erx THEN 1 ELSE 0 END) as erx_score,
        (CASE WHEN preferred_network THEN 1 ELSE 0 END) as preferred_score
      FROM pharmacies
      WHERE is_active = true
    `;
    const params = [];
    let paramCount = 1;

    if (zip_code) {
      query += ` AND zip_code = $${paramCount}`;
      params.push(zip_code);
      paramCount++;
    }

    if (city) {
      query += ` AND LOWER(city) = LOWER($${paramCount})`;
      params.push(city);
      paramCount++;
    }

    if (state) {
      query += ` AND UPPER(state) = UPPER($${paramCount})`;
      params.push(state);
      paramCount++;
    }

    if (pharmacy_name) {
      query += ` AND (LOWER(pharmacy_name) LIKE LOWER($${paramCount}) OR LOWER(chain_name) LIKE LOWER($${paramCount}))`;
      params.push(`%${pharmacy_name}%`);
      paramCount++;
    }

    if (accepts_erx === 'true') {
      query += ` AND accepts_erx = true`;
    }

    if (preferred_only === 'true') {
      query += ` AND preferred_network = true`;
    }

    query += ` ORDER BY preferred_score DESC, erx_score DESC, pharmacy_name ASC LIMIT $${paramCount}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);
    res.json(result.rows.map(toCamelCase));
  } catch (error) {
    console.error('Error searching pharmacies:', error);
    res.status(500).json({ error: 'Failed to search pharmacies' });
  }
});

// Get all pharmacies
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(`
      SELECT * FROM pharmacies
      WHERE is_active = true
      ORDER BY chain_name, pharmacy_name
    `);
    res.json(result.rows.map(toCamelCase));
  } catch (error) {
    console.error('Error fetching pharmacies:', error);
    res.status(500).json({ error: 'Failed to fetch pharmacies' });
  }
});

// Get single pharmacy
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'SELECT * FROM pharmacies WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pharmacy not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error fetching pharmacy:', error);
    res.status(500).json({ error: 'Failed to fetch pharmacy' });
  }
});

// Get patient's preferred pharmacies
router.get('/patient/:patientId/preferred', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(`
      SELECT ph.*, pp.is_preferred, pp.added_date
      FROM patient_pharmacies pp
      JOIN pharmacies ph ON pp.pharmacy_id = ph.id
      WHERE pp.patient_id = $1 AND ph.is_active = true
      ORDER BY pp.is_preferred DESC, pp.added_date DESC
    `, [req.params.patientId]);

    res.json(result.rows.map(toCamelCase));
  } catch (error) {
    console.error('Error fetching patient pharmacies:', error);
    res.status(500).json({ error: 'Failed to fetch patient pharmacies' });
  }
});

// Add pharmacy to patient's list
router.post('/patient/:patientId/preferred', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { pharmacyId, isPreferred } = req.body;

    // If marking as preferred, unmark all others
    if (isPreferred) {
      await pool.query(
        'UPDATE patient_pharmacies SET is_preferred = false WHERE patient_id = $1',
        [req.params.patientId]
      );
    }

    const result = await pool.query(`
      INSERT INTO patient_pharmacies (patient_id, pharmacy_id, is_preferred)
      VALUES ($1, $2, $3)
      ON CONFLICT (patient_id, pharmacy_id)
      DO UPDATE SET is_preferred = $3, added_date = CURRENT_TIMESTAMP
      RETURNING *
    `, [req.params.patientId, pharmacyId, isPreferred || false]);

    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error adding patient pharmacy:', error);
    res.status(500).json({ error: 'Failed to add patient pharmacy' });
  }
});

// Remove pharmacy from patient's list
router.delete('/patient/:patientId/preferred/:pharmacyId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'DELETE FROM patient_pharmacies WHERE patient_id = $1 AND pharmacy_id = $2 RETURNING *',
      [req.params.patientId, req.params.pharmacyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient pharmacy not found' });
    }

    res.json({ message: 'Pharmacy removed from patient list' });
  } catch (error) {
    console.error('Error removing patient pharmacy:', error);
    res.status(500).json({ error: 'Failed to remove patient pharmacy' });
  }
});

// Create new pharmacy (admin)
router.post('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const {
      ncpdpId, npi, pharmacyName, chainName, addressLine1, addressLine2,
      city, state, zipCode, phone, fax, email, website, is24Hours,
      acceptsErx, erxEndpointUrl, erxSystemType, deliveryAvailable,
      driveThrough, acceptsInsurance, preferredNetwork
    } = req.body;

    const result = await pool.query(`
      INSERT INTO pharmacies (
        ncpdp_id, npi, pharmacy_name, chain_name, address_line1, address_line2,
        city, state, zip_code, phone, fax, email, website, is_24_hours,
        accepts_erx, erx_endpoint_url, erx_system_type, delivery_available,
        drive_through, accepts_insurance, preferred_network
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *
    `, [
      ncpdpId, npi, pharmacyName, chainName, addressLine1, addressLine2,
      city, state, zipCode, phone, fax, email, website, is24Hours,
      acceptsErx, erxEndpointUrl, erxSystemType, deliveryAvailable,
      driveThrough, acceptsInsurance, preferredNetwork
    ]);

    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error creating pharmacy:', error);
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ error: 'Pharmacy with this NCPDP ID already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create pharmacy' });
    }
  }
});

// Update pharmacy
router.put('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const {
      pharmacyName, chainName, addressLine1, addressLine2, city, state,
      zipCode, phone, fax, email, website, is24Hours, acceptsErx,
      erxEndpointUrl, erxSystemType, deliveryAvailable, driveThrough,
      acceptsInsurance, preferredNetwork, isActive
    } = req.body;

    const result = await pool.query(`
      UPDATE pharmacies SET
        pharmacy_name = COALESCE($1, pharmacy_name),
        chain_name = COALESCE($2, chain_name),
        address_line1 = COALESCE($3, address_line1),
        address_line2 = COALESCE($4, address_line2),
        city = COALESCE($5, city),
        state = COALESCE($6, state),
        zip_code = COALESCE($7, zip_code),
        phone = COALESCE($8, phone),
        fax = COALESCE($9, fax),
        email = COALESCE($10, email),
        website = COALESCE($11, website),
        is_24_hours = COALESCE($12, is_24_hours),
        accepts_erx = COALESCE($13, accepts_erx),
        erx_endpoint_url = COALESCE($14, erx_endpoint_url),
        erx_system_type = COALESCE($15, erx_system_type),
        delivery_available = COALESCE($16, delivery_available),
        drive_through = COALESCE($17, drive_through),
        accepts_insurance = COALESCE($18, accepts_insurance),
        preferred_network = COALESCE($19, preferred_network),
        is_active = COALESCE($20, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $21
      RETURNING *
    `, [
      pharmacyName, chainName, addressLine1, addressLine2, city, state,
      zipCode, phone, fax, email, website, is24Hours, acceptsErx,
      erxEndpointUrl, erxSystemType, deliveryAvailable, driveThrough,
      acceptsInsurance, preferredNetwork, isActive, req.params.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pharmacy not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error updating pharmacy:', error);
    res.status(500).json({ error: 'Failed to update pharmacy' });
  }
});

// Delete pharmacy (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'UPDATE pharmacies SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pharmacy not found' });
    }

    res.json({ message: 'Pharmacy deactivated successfully' });
  } catch (error) {
    console.error('Error deleting pharmacy:', error);
    res.status(500).json({ error: 'Failed to delete pharmacy' });
  }
});

module.exports = router;
