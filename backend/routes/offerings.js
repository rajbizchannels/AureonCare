const express = require('express');
const router = express.Router();

// ==================== SERVICE CATEGORIES ====================

// Get all service categories
router.get('/categories', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const result = await pool.query(`
      SELECT sc.*,
             COUNT(DISTINCT ho.id) as offering_count
      FROM service_categories sc
      LEFT JOIN healthcare_offerings ho ON sc.id = ho.category_id AND ho.is_active = true
      GROUP BY sc.id
      ORDER BY sc.display_order, sc.name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching service categories:', error);
    res.status(500).json({ error: 'Failed to fetch service categories' });
  }
});

// Get single category
router.get('/categories/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM service_categories WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// Create service category
router.post('/categories', async (req, res) => {
  const pool = req.app.locals.pool;
  const { name, description, icon, color, display_order, is_active } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO service_categories (name, description, icon, color, display_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, description, icon, color, display_order || 0, is_active !== false]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Update service category
router.put('/categories/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;
  const { name, description, icon, color, display_order, is_active } = req.body;

  try {
    const result = await pool.query(
      `UPDATE service_categories
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           icon = COALESCE($3, icon),
           color = COALESCE($4, color),
           display_order = COALESCE($5, display_order),
           is_active = COALESCE($6, is_active)
       WHERE id = $7
       RETURNING *`,
      [name, description, icon, color, display_order, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Delete service category
router.delete('/categories/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;

  try {
    // Check if category has offerings
    const checkResult = await pool.query(
      'SELECT COUNT(*) as count FROM healthcare_offerings WHERE category_id = $1',
      [id]
    );

    if (parseInt(checkResult.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'Cannot delete category with associated offerings. Please reassign or delete offerings first.'
      });
    }

    const result = await pool.query(
      'DELETE FROM service_categories WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// ==================== HEALTHCARE OFFERINGS ====================

// Get all offerings with filtering and search
router.get('/', async (req, res) => {
  const pool = req.app.locals.pool;
  const {
    category_id,
    is_active,
    is_featured,
    search,
    available_online,
    min_duration,
    max_duration,
    specialization
  } = req.query;

  try {
    let query = `
      SELECT ho.*,
             sc.name as category_name,
             sc.color as category_color,
             COALESCE(
               (SELECT json_agg(json_build_object(
                 'id', op.id,
                 'pricing_type', op.pricing_type,
                 'pricing_name', op.pricing_name,
                 'base_price', op.base_price,
                 'final_price', op.final_price,
                 'is_active', op.is_active
               ))
               FROM offering_pricing op
               WHERE op.offering_id = ho.id AND op.is_active = true),
               '[]'
             ) as pricing_options,
             COALESCE(
               (SELECT AVG(rating) FROM offering_reviews WHERE offering_id = ho.id AND is_approved = true),
               0
             ) as average_rating,
             COALESCE(
               (SELECT COUNT(*) FROM offering_reviews WHERE offering_id = ho.id AND is_approved = true),
               0
             ) as review_count
      FROM healthcare_offerings ho
      LEFT JOIN service_categories sc ON ho.category_id = sc.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (category_id) {
      query += ` AND ho.category_id = $${paramCount}`;
      params.push(category_id);
      paramCount++;
    }

    if (is_active !== undefined) {
      query += ` AND ho.is_active = $${paramCount}`;
      params.push(is_active === 'true');
      paramCount++;
    }

    if (is_featured !== undefined) {
      query += ` AND ho.is_featured = $${paramCount}`;
      params.push(is_featured === 'true');
      paramCount++;
    }

    if (available_online !== undefined) {
      query += ` AND ho.available_online = $${paramCount}`;
      params.push(available_online === 'true');
      paramCount++;
    }

    if (min_duration) {
      query += ` AND ho.duration_minutes >= $${paramCount}`;
      params.push(parseInt(min_duration));
      paramCount++;
    }

    if (max_duration) {
      query += ` AND ho.duration_minutes <= $${paramCount}`;
      params.push(parseInt(max_duration));
      paramCount++;
    }

    if (specialization) {
      query += ` AND $${paramCount} = ANY(ho.allowed_provider_specializations)`;
      params.push(specialization);
      paramCount++;
    }

    if (search) {
      query += ` AND (
        ho.name ILIKE $${paramCount} OR
        ho.description ILIKE $${paramCount} OR
        sc.name ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ' ORDER BY ho.is_featured DESC, ho.booking_count DESC, ho.name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching offerings:', error);
    res.status(500).json({ error: 'Failed to fetch offerings' });
  }
});

// Get single offering with full details
router.get('/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;

  try {
    const offeringResult = await pool.query(`
      SELECT ho.*,
             sc.name as category_name,
             sc.color as category_color,
             u.first_name || ' ' || u.last_name as created_by_name,
             COALESCE(
               (SELECT AVG(rating) FROM offering_reviews WHERE offering_id = ho.id AND is_approved = true),
               0
             ) as average_rating,
             COALESCE(
               (SELECT COUNT(*) FROM offering_reviews WHERE offering_id = ho.id AND is_approved = true),
               0
             ) as review_count
      FROM healthcare_offerings ho
      LEFT JOIN service_categories sc ON ho.category_id = sc.id
      LEFT JOIN users u ON ho.created_by = u.id
      WHERE ho.id = $1
    `, [id]);

    if (offeringResult.rows.length === 0) {
      return res.status(404).json({ error: 'Offering not found' });
    }

    // Get pricing options
    const pricingResult = await pool.query(
      'SELECT * FROM offering_pricing WHERE offering_id = $1 ORDER BY is_active DESC, pricing_type',
      [id]
    );

    // Get insurance mappings
    const insuranceResult = await pool.query(
      'SELECT * FROM offering_insurance_mappings WHERE offering_id = $1 AND is_active = true',
      [id]
    );

    // Get recent reviews
    const reviewsResult = await pool.query(`
      SELECT or_.*,
             p.first_name || ' ' || p.last_name as patient_name
      FROM offering_reviews or_
      LEFT JOIN patients p ON or_.patient_id = p.id
      WHERE or_.offering_id = $1 AND or_.is_approved = true
      ORDER BY or_.created_at DESC
      LIMIT 10
    `, [id]);

    // Increment view count
    await pool.query(
      'UPDATE healthcare_offerings SET view_count = view_count + 1 WHERE id = $1',
      [id]
    );

    const offering = {
      ...offeringResult.rows[0],
      pricing_options: pricingResult.rows,
      insurance_mappings: insuranceResult.rows,
      reviews: reviewsResult.rows
    };

    res.json(offering);
  } catch (error) {
    console.error('Error fetching offering:', error);
    res.status(500).json({ error: 'Failed to fetch offering' });
  }
});

// Create healthcare offering
router.post('/', async (req, res) => {
  const pool = req.app.locals.pool;
  const {
    name,
    description,
    category_id,
    duration_minutes,
    requires_preparation,
    preparation_instructions,
    is_active,
    is_featured,
    available_online,
    requires_referral,
    cpt_codes,
    icd_codes,
    hcpcs_codes,
    min_age,
    max_age,
    gender_restriction,
    contraindications,
    prerequisites,
    allowed_provider_specializations,
    image_url,
    video_url,
    brochure_url,
    consent_form_required,
    consent_form_url,
    seo_title,
    seo_description,
    seo_keywords,
    created_by
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Offering name is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO healthcare_offerings (
        name, description, category_id, duration_minutes,
        requires_preparation, preparation_instructions,
        is_active, is_featured, available_online, requires_referral,
        cpt_codes, icd_codes, hcpcs_codes,
        min_age, max_age, gender_restriction,
        contraindications, prerequisites, allowed_provider_specializations,
        image_url, video_url, brochure_url,
        consent_form_required, consent_form_url,
        seo_title, seo_description, seo_keywords, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
      RETURNING *`,
      [
        name, description, category_id, duration_minutes,
        requires_preparation || false, preparation_instructions,
        is_active !== false, is_featured || false, available_online !== false, requires_referral || false,
        cpt_codes, icd_codes, hcpcs_codes,
        min_age, max_age, gender_restriction || 'any',
        contraindications, prerequisites, allowed_provider_specializations,
        image_url, video_url, brochure_url,
        consent_form_required || false, consent_form_url,
        seo_title, seo_description, seo_keywords, created_by
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating offering:', error);
    res.status(500).json({ error: 'Failed to create offering' });
  }
});

// Update healthcare offering
router.put('/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;
  const updates = req.body;

  try {
    // Build dynamic update query
    const fields = Object.keys(updates).filter(key =>
      !['id', 'created_at', 'updated_at', 'view_count', 'booking_count'].includes(key)
    );

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [id, ...fields.map(field => updates[field])];

    const result = await pool.query(
      `UPDATE healthcare_offerings SET ${setClause} WHERE id = $1 RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Offering not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating offering:', error);
    res.status(500).json({ error: 'Failed to update offering' });
  }
});

// Delete healthcare offering
router.delete('/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;

  try {
    // Check for dependencies
    const appointmentCheck = await pool.query(
      'SELECT COUNT(*) as count FROM appointments WHERE offering_id = $1',
      [id]
    );

    if (parseInt(appointmentCheck.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'Cannot delete offering with associated appointments. Consider deactivating instead.'
      });
    }

    const result = await pool.query(
      'DELETE FROM healthcare_offerings WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Offering not found' });
    }

    res.json({ message: 'Offering deleted successfully' });
  } catch (error) {
    console.error('Error deleting offering:', error);
    res.status(500).json({ error: 'Failed to delete offering' });
  }
});

// ==================== OFFERING PRICING ====================

// Get pricing for an offering
router.get('/:id/pricing', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM offering_pricing WHERE offering_id = $1 ORDER BY is_active DESC, pricing_type',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching pricing:', error);
    res.status(500).json({ error: 'Failed to fetch pricing' });
  }
});

// Add pricing option to offering
router.post('/:id/pricing', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;
  const {
    pricing_type,
    pricing_name,
    base_price,
    discount_percentage,
    insurance_provider,
    copay_amount,
    requires_preauthorization,
    effective_from,
    effective_until,
    is_active,
    additional_fees
  } = req.body;

  if (!pricing_type || base_price === undefined) {
    return res.status(400).json({ error: 'Pricing type and base price are required' });
  }

  try {
    const discount = discount_percentage || 0;
    const final_price = base_price - (base_price * discount / 100);

    const result = await pool.query(
      `INSERT INTO offering_pricing (
        offering_id, pricing_type, pricing_name, base_price, discount_percentage, final_price,
        insurance_provider, copay_amount, requires_preauthorization,
        effective_from, effective_until, is_active, additional_fees
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        id, pricing_type, pricing_name, base_price, discount, final_price,
        insurance_provider, copay_amount, requires_preauthorization || false,
        effective_from, effective_until, is_active !== false, additional_fees
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating pricing:', error);
    res.status(500).json({ error: 'Failed to create pricing' });
  }
});

// Update pricing option
router.put('/pricing/:pricing_id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { pricing_id } = req.params;
  const updates = req.body;

  try {
    // Recalculate final_price if base_price or discount changes
    if (updates.base_price !== undefined || updates.discount_percentage !== undefined) {
      const currentResult = await pool.query(
        'SELECT base_price, discount_percentage FROM offering_pricing WHERE id = $1',
        [pricing_id]
      );

      if (currentResult.rows.length > 0) {
        const current = currentResult.rows[0];
        const base = updates.base_price !== undefined ? updates.base_price : current.base_price;
        const discount = updates.discount_percentage !== undefined ? updates.discount_percentage : current.discount_percentage;
        updates.final_price = base - (base * discount / 100);
      }
    }

    const fields = Object.keys(updates).filter(key =>
      !['id', 'created_at', 'updated_at'].includes(key)
    );

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [pricing_id, ...fields.map(field => updates[field])];

    const result = await pool.query(
      `UPDATE offering_pricing SET ${setClause} WHERE id = $1 RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pricing option not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating pricing:', error);
    res.status(500).json({ error: 'Failed to update pricing' });
  }
});

// Delete pricing option
router.delete('/pricing/:pricing_id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { pricing_id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM offering_pricing WHERE id = $1 RETURNING *',
      [pricing_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pricing option not found' });
    }

    res.json({ message: 'Pricing option deleted successfully' });
  } catch (error) {
    console.error('Error deleting pricing:', error);
    res.status(500).json({ error: 'Failed to delete pricing' });
  }
});

// ==================== OFFERING PACKAGES ====================

// Get all packages
router.get('/packages/all', async (req, res) => {
  const pool = req.app.locals.pool;
  const { is_active, is_featured, category_id, package_type } = req.query;

  try {
    let query = `
      SELECT op.*,
             sc.name as category_name,
             sc.color as category_color,
             COALESCE(
               (SELECT json_agg(json_build_object(
                 'offering_id', po.offering_id,
                 'offering_name', ho.name,
                 'quantity', po.quantity_included,
                 'is_optional', po.is_optional
               ) ORDER BY po.display_order)
               FROM package_offerings po
               LEFT JOIN healthcare_offerings ho ON po.offering_id = ho.id
               WHERE po.package_id = op.id
             ), '[]') as included_offerings
      FROM offering_packages op
      LEFT JOIN service_categories sc ON op.category_id = sc.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (is_active !== undefined) {
      query += ` AND op.is_active = $${paramCount}`;
      params.push(is_active === 'true');
      paramCount++;
    }

    if (is_featured !== undefined) {
      query += ` AND op.is_featured = $${paramCount}`;
      params.push(is_featured === 'true');
      paramCount++;
    }

    if (category_id) {
      query += ` AND op.category_id = $${paramCount}`;
      params.push(category_id);
      paramCount++;
    }

    if (package_type) {
      query += ` AND op.package_type = $${paramCount}`;
      params.push(package_type);
      paramCount++;
    }

    query += ' ORDER BY op.is_featured DESC, op.enrollment_count DESC, op.name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching packages:', error);
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

// Get single package
router.get('/packages/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;

  try {
    const packageResult = await pool.query(`
      SELECT op.*,
             sc.name as category_name,
             u.first_name || ' ' || u.last_name as created_by_name
      FROM offering_packages op
      LEFT JOIN service_categories sc ON op.category_id = sc.id
      LEFT JOIN users u ON op.created_by = u.id
      WHERE op.id = $1
    `, [id]);

    if (packageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Package not found' });
    }

    // Get included offerings
    const offeringsResult = await pool.query(`
      SELECT po.*,
             ho.name as offering_name,
             ho.description as offering_description,
             ho.duration_minutes
      FROM package_offerings po
      LEFT JOIN healthcare_offerings ho ON po.offering_id = ho.id
      WHERE po.package_id = $1
      ORDER BY po.display_order
    `, [id]);

    const package = {
      ...packageResult.rows[0],
      included_offerings: offeringsResult.rows
    };

    res.json(package);
  } catch (error) {
    console.error('Error fetching package:', error);
    res.status(500).json({ error: 'Failed to fetch package' });
  }
});

// Create package
router.post('/packages', async (req, res) => {
  const pool = req.app.locals.pool;
  const {
    name,
    description,
    category_id,
    package_type,
    validity_days,
    max_uses,
    base_price,
    discount_percentage,
    benefits,
    features,
    image_url,
    terms_and_conditions,
    is_active,
    is_featured,
    available_from,
    available_until,
    created_by,
    offerings // Array of {offering_id, quantity_included, is_optional}
  } = req.body;

  if (!name || !base_price) {
    return res.status(400).json({ error: 'Package name and base price are required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const discount = discount_percentage || 0;
    const final_price = base_price - (base_price * discount / 100);

    // Create package
    const packageResult = await client.query(
      `INSERT INTO offering_packages (
        name, description, category_id, package_type, validity_days, max_uses,
        base_price, discount_percentage, final_price,
        benefits, features, image_url, terms_and_conditions,
        is_active, is_featured, available_from, available_until, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        name, description, category_id, package_type || 'bundle', validity_days, max_uses,
        base_price, discount, final_price,
        benefits, features, image_url, terms_and_conditions,
        is_active !== false, is_featured || false, available_from, available_until, created_by
      ]
    );

    const packageId = packageResult.rows[0].id;

    // Add offerings to package
    if (offerings && offerings.length > 0) {
      for (let i = 0; i < offerings.length; i++) {
        const offering = offerings[i];
        await client.query(
          `INSERT INTO package_offerings (package_id, offering_id, quantity_included, is_optional, display_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [packageId, offering.offering_id, offering.quantity_included || 1, offering.is_optional || false, i]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json(packageResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating package:', error);
    res.status(500).json({ error: 'Failed to create package' });
  } finally {
    client.release();
  }
});

// Update package
router.put('/packages/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;
  const updates = req.body;

  try {
    // Recalculate final_price if needed
    if (updates.base_price !== undefined || updates.discount_percentage !== undefined) {
      const currentResult = await pool.query(
        'SELECT base_price, discount_percentage FROM offering_packages WHERE id = $1',
        [id]
      );

      if (currentResult.rows.length > 0) {
        const current = currentResult.rows[0];
        const base = updates.base_price !== undefined ? updates.base_price : current.base_price;
        const discount = updates.discount_percentage !== undefined ? updates.discount_percentage : current.discount_percentage;
        updates.final_price = base - (base * discount / 100);
      }
    }

    const fields = Object.keys(updates).filter(key =>
      !['id', 'created_at', 'updated_at', 'enrollment_count', 'offerings'].includes(key)
    );

    if (fields.length === 0 && !updates.offerings) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Update package
      if (fields.length > 0) {
        const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
        const values = [id, ...fields.map(field => updates[field])];

        await client.query(
          `UPDATE offering_packages SET ${setClause} WHERE id = $1`,
          values
        );
      }

      // Update offerings if provided
      if (updates.offerings) {
        // Remove existing offerings
        await client.query('DELETE FROM package_offerings WHERE package_id = $1', [id]);

        // Add new offerings
        for (let i = 0; i < updates.offerings.length; i++) {
          const offering = updates.offerings[i];
          await client.query(
            `INSERT INTO package_offerings (package_id, offering_id, quantity_included, is_optional, display_order)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, offering.offering_id, offering.quantity_included || 1, offering.is_optional || false, i]
          );
        }
      }

      // Get updated package
      const result = await client.query('SELECT * FROM offering_packages WHERE id = $1', [id]);

      await client.query('COMMIT');

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Package not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating package:', error);
    res.status(500).json({ error: 'Failed to update package' });
  }
});

// Delete package
router.delete('/packages/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM offering_packages WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Package not found' });
    }

    res.json({ message: 'Package deleted successfully' });
  } catch (error) {
    console.error('Error deleting package:', error);
    res.status(500).json({ error: 'Failed to delete package' });
  }
});

// ==================== PATIENT ENROLLMENTS ====================

// Get patient enrollments
router.get('/enrollments/patient/:patient_id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { patient_id } = req.params;

  try {
    const result = await pool.query(`
      SELECT poe.*,
             ho.name as offering_name,
             op.name as package_name,
             op.validity_days,
             pm.amount as payment_amount,
             pm.status as payment_status
      FROM patient_offering_enrollments poe
      LEFT JOIN healthcare_offerings ho ON poe.offering_id = ho.id
      LEFT JOIN offering_packages op ON poe.package_id = op.id
      LEFT JOIN payments pm ON poe.payment_id = pm.id
      WHERE poe.patient_id = $1
      ORDER BY poe.created_at DESC
    `, [patient_id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
});

// Create enrollment
router.post('/enrollments', async (req, res) => {
  const pool = req.app.locals.pool;
  const {
    patient_id,
    package_id,
    offering_id,
    enrollment_date,
    expiry_date,
    total_allowed_uses,
    amount_paid,
    payment_method,
    payment_status,
    payment_id,
    notes,
    created_by
  } = req.body;

  if (!patient_id || (!package_id && !offering_id)) {
    return res.status(400).json({ error: 'Patient ID and either package_id or offering_id are required' });
  }

  try {
    const remaining = total_allowed_uses || 1;

    const result = await pool.query(
      `INSERT INTO patient_offering_enrollments (
        patient_id, package_id, offering_id, enrollment_date, expiry_date,
        total_allowed_uses, used_count, remaining_uses,
        amount_paid, payment_method, payment_status, payment_id,
        notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        patient_id, package_id, offering_id, enrollment_date || new Date(),
        expiry_date, total_allowed_uses || 1, 0, remaining,
        amount_paid, payment_method, payment_status || 'pending', payment_id,
        notes, created_by
      ]
    );

    // Update package enrollment count if applicable
    if (package_id) {
      await pool.query(
        'UPDATE offering_packages SET enrollment_count = enrollment_count + 1 WHERE id = $1',
        [package_id]
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating enrollment:', error);
    res.status(500).json({ error: 'Failed to create enrollment' });
  }
});

// Update enrollment
router.put('/enrollments/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;
  const updates = req.body;

  try {
    // Update remaining_uses if used_count or total_allowed_uses changes
    if (updates.used_count !== undefined || updates.total_allowed_uses !== undefined) {
      const currentResult = await pool.query(
        'SELECT used_count, total_allowed_uses FROM patient_offering_enrollments WHERE id = $1',
        [id]
      );

      if (currentResult.rows.length > 0) {
        const current = currentResult.rows[0];
        const used = updates.used_count !== undefined ? updates.used_count : current.used_count;
        const total = updates.total_allowed_uses !== undefined ? updates.total_allowed_uses : current.total_allowed_uses;
        updates.remaining_uses = total - used;

        // Auto-update status if fully used
        if (updates.remaining_uses <= 0) {
          updates.status = 'used';
        }
      }
    }

    const fields = Object.keys(updates).filter(key =>
      !['id', 'created_at', 'updated_at', 'patient_id'].includes(key)
    );

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [id, ...fields.map(field => updates[field])];

    const result = await pool.query(
      `UPDATE patient_offering_enrollments SET ${setClause} WHERE id = $1 RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating enrollment:', error);
    res.status(500).json({ error: 'Failed to update enrollment' });
  }
});

// ==================== REVIEWS ====================

// Get reviews for an offering
router.get('/:id/reviews', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;
  const { is_approved } = req.query;

  try {
    let query = `
      SELECT or_.*,
             p.first_name || ' ' || p.last_name as patient_name
      FROM offering_reviews or_
      LEFT JOIN patients p ON or_.patient_id = p.id
      WHERE or_.offering_id = $1
    `;

    const params = [id];

    if (is_approved !== undefined) {
      query += ' AND or_.is_approved = $2';
      params.push(is_approved === 'true');
    }

    query += ' ORDER BY or_.is_featured DESC, or_.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Create review
router.post('/:id/reviews', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;
  const { patient_id, appointment_id, rating, review_text } = req.body;

  if (!patient_id || !rating) {
    return res.status(400).json({ error: 'Patient ID and rating are required' });
  }

  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO offering_reviews (offering_id, patient_id, appointment_id, rating, review_text)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, patient_id, appointment_id, rating, review_text]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Review already exists for this appointment' });
    }
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// Moderate review (approve/feature)
router.put('/reviews/:review_id/moderate', async (req, res) => {
  const pool = req.app.locals.pool;
  const { review_id } = req.params;
  const { is_approved, is_featured, moderated_by } = req.body;

  try {
    const result = await pool.query(
      `UPDATE offering_reviews
       SET is_approved = COALESCE($1, is_approved),
           is_featured = COALESCE($2, is_featured),
           moderated_by = $3,
           moderated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [is_approved, is_featured, moderated_by, review_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error moderating review:', error);
    res.status(500).json({ error: 'Failed to moderate review' });
  }
});

// ==================== PROMOTIONS ====================

// Get all promotions
router.get('/promotions/all', async (req, res) => {
  const pool = req.app.locals.pool;
  const { is_active } = req.query;

  try {
    let query = 'SELECT * FROM offering_promotions WHERE 1=1';
    const params = [];

    if (is_active !== undefined) {
      query += ' AND is_active = $1';
      params.push(is_active === 'true');
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching promotions:', error);
    res.status(500).json({ error: 'Failed to fetch promotions' });
  }
});

// Validate promo code
router.post('/promotions/validate', async (req, res) => {
  const pool = req.app.locals.pool;
  const { promo_code, patient_id, offering_ids, package_ids } = req.body;

  if (!promo_code) {
    return res.status(400).json({ error: 'Promo code is required' });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM offering_promotions
       WHERE promo_code = $1
         AND is_active = true
         AND (valid_from IS NULL OR valid_from <= CURRENT_TIMESTAMP)
         AND (valid_until IS NULL OR valid_until >= CURRENT_TIMESTAMP)
         AND (max_uses IS NULL OR current_uses < max_uses)`,
      [promo_code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired promo code' });
    }

    const promo = result.rows[0];

    // Check if applicable to the offerings/packages
    let isApplicable = promo.applicable_to === 'all';

    if (!isApplicable && offering_ids && offering_ids.length > 0) {
      const hasMatch = offering_ids.some(id =>
        promo.offering_ids && promo.offering_ids.includes(id)
      );
      isApplicable = hasMatch;
    }

    if (!isApplicable && package_ids && package_ids.length > 0) {
      const hasMatch = package_ids.some(id =>
        promo.package_ids && promo.package_ids.includes(id)
      );
      isApplicable = hasMatch;
    }

    if (!isApplicable) {
      return res.status(400).json({ error: 'Promo code not applicable to selected items' });
    }

    // Check usage limits per patient
    if (patient_id && promo.max_uses_per_patient) {
      // TODO: Implement usage tracking per patient
      // This would require a separate table or JSONB field
    }

    res.json({
      valid: true,
      promotion: promo
    });
  } catch (error) {
    console.error('Error validating promo code:', error);
    res.status(500).json({ error: 'Failed to validate promo code' });
  }
});

// Create promotion
router.post('/promotions', async (req, res) => {
  const pool = req.app.locals.pool;
  const {
    name,
    description,
    promo_code,
    discount_type,
    discount_value,
    applicable_to,
    offering_ids,
    package_ids,
    category_ids,
    valid_from,
    valid_until,
    max_uses,
    max_uses_per_patient,
    min_purchase_amount,
    new_patients_only,
    is_active,
    created_by
  } = req.body;

  if (!name || !discount_type || !discount_value) {
    return res.status(400).json({ error: 'Name, discount type, and discount value are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO offering_promotions (
        name, description, promo_code, discount_type, discount_value,
        applicable_to, offering_ids, package_ids, category_ids,
        valid_from, valid_until, max_uses, max_uses_per_patient,
        min_purchase_amount, new_patients_only, is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        name, description, promo_code, discount_type, discount_value,
        applicable_to || 'all', offering_ids, package_ids, category_ids,
        valid_from, valid_until, max_uses, max_uses_per_patient || 1,
        min_purchase_amount, new_patients_only || false, is_active !== false, created_by
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation on promo_code
      return res.status(400).json({ error: 'Promo code already exists' });
    }
    console.error('Error creating promotion:', error);
    res.status(500).json({ error: 'Failed to create promotion' });
  }
});

// Update promotion
router.put('/promotions/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;
  const updates = req.body;

  try {
    const fields = Object.keys(updates).filter(key =>
      !['id', 'created_at', 'updated_at', 'current_uses'].includes(key)
    );

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [id, ...fields.map(field => updates[field])];

    const result = await pool.query(
      `UPDATE offering_promotions SET ${setClause} WHERE id = $1 RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Promotion not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating promotion:', error);
    res.status(500).json({ error: 'Failed to update promotion' });
  }
});

// ==================== STATISTICS ====================

// Get offering statistics
router.get('/statistics/overview', async (req, res) => {
  const pool = req.app.locals.pool;

  try {
    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM healthcare_offerings WHERE is_active = true) as active_offerings,
        (SELECT COUNT(*) FROM offering_packages WHERE is_active = true) as active_packages,
        (SELECT COUNT(*) FROM patient_offering_enrollments WHERE status = 'active') as active_enrollments,
        (SELECT SUM(amount_paid) FROM patient_offering_enrollments WHERE payment_status = 'completed') as total_revenue,
        (SELECT COUNT(*) FROM offering_reviews WHERE is_approved = true) as total_reviews,
        (SELECT AVG(rating) FROM offering_reviews WHERE is_approved = true) as average_rating
    `);

    const topOfferings = await pool.query(`
      SELECT id, name, booking_count, view_count
      FROM healthcare_offerings
      WHERE is_active = true
      ORDER BY booking_count DESC
      LIMIT 10
    `);

    const topPackages = await pool.query(`
      SELECT id, name, enrollment_count
      FROM offering_packages
      WHERE is_active = true
      ORDER BY enrollment_count DESC
      LIMIT 10
    `);

    res.json({
      overview: stats.rows[0],
      top_offerings: topOfferings.rows,
      top_packages: topPackages.rows
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;
