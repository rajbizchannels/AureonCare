// Medical camps — planning, staffing, supplies and the station board.
//
// Registration and the attendee queue live in routes/camp-registrations.js; the clinical
// and sponsor reports in routes/camp-reports.js. The rules themselves are in
// services/camps.js so they can be tested without Express.

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { enforceActiveBilling, enforceFeature } = require('../middleware/planEnforcement');
const { assertUsableLocation } = require('../utils/locations');
const camps = require('../services/camps');

router.use(authenticate);
router.use(enforceActiveBilling); // SEC-05 S11: read-only when subscription past_due/canceled
router.use(enforceFeature('camps')); // Clinical Pro and above (migration 084)

// Planning is operational work, not just an admin chore — receptionists and clinicians
// organise camps. Deleting one stays admin-only.
const canPlan = authorize('admin', 'receptionist', 'doctor', 'provider', 'nurse');

const toCamelCase = (obj) => {
  if (!obj) return obj;
  const out = {};
  for (const key in obj) out[key.replace(/_([a-z])/g, (g) => g[1].toUpperCase())] = obj[key];
  return out;
};
const camelRows = (rows) => rows.map(toCamelCase);

/**
 * Run `fn` inside a transaction on the per-request tenant db.
 *
 * req.db has query/getClient/release but no connect(), and its wrapper re-pins
 * search_path with SET LOCAL immediately after BEGIN — which is what keeps the block on
 * one backend under Supabase's transaction pooler.
 */
async function withTx(db, fn) {
  await db.query('BEGIN');
  try {
    const out = await fn();
    await db.query('COMMIT');
    return out;
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    throw err;
  }
}

/** Turn a service-layer error into its intended response; anything else is a 500. */
function fail(res, err, what) {
  if (err && err.status) {
    const body = { error: err.code || 'Error', message: err.message };
    if (err.blockers) body.blockers = err.blockers;
    if (err.allowed) { body.from = err.from; body.to = err.to; body.allowed = err.allowed; }
    if (err.items) body.items = err.items;
    return res.status(err.status).json(body);
  }
  console.error(`Error ${what}:`, err);
  return res.status(500).json({
    error: `Failed ${what}`, code: err && err.code, detail: (err && (err.detail || err.message)) || undefined,
  });
}

const db_ = (req) => req.db || req.app.locals.pool;

// ─── camps ───────────────────────────────────────────────────────────────────────────

// GET /api/camps?status=&from=&to=&locationId=
router.get('/', async (req, res) => {
  try {
    const db = db_(req);
    const { status, from, to, locationId } = req.query;
    const where = [];
    const params = [];
    if (status)     { params.push(status);     where.push(`c.status = $${params.length}`); }
    if (locationId) { params.push(locationId); where.push(`c.location_id = $${params.length}`); }
    if (from)       { params.push(from);       where.push(`c.ends_at   >= $${params.length}::timestamp`); }
    if (to)         { params.push(to);         where.push(`c.starts_at <= $${params.length}::timestamp`); }

    const { rows } = await db.query(
      `SELECT c.*, l.name AS location_name,
              (SELECT count(*) FROM camp_registrations r WHERE r.camp_id = c.id)::int AS registration_count,
              (SELECT count(*) FROM camp_staff s        WHERE s.camp_id = c.id)::int AS staff_count,
              (SELECT count(*) FROM camp_services v     WHERE v.camp_id = c.id)::int AS service_count
         FROM camps c
         LEFT JOIN locations l ON l.id = c.location_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY c.starts_at DESC`,
      params
    );
    res.json(camelRows(rows));
  } catch (err) { fail(res, err, 'to fetch camps'); }
});

// GET /api/camps/:id
router.get('/:id', async (req, res) => {
  try {
    const db = db_(req);
    const { rows } = await db.query(
      `SELECT c.*, l.name AS location_name, l.address AS location_address, l.city AS location_city,
              (SELECT count(*) FROM camp_registrations r WHERE r.camp_id = c.id)::int AS registration_count,
              (SELECT count(*) FROM camp_registrations r WHERE r.camp_id = c.id AND r.patient_id IS NOT NULL)::int AS promoted_count
         FROM camps c
         LEFT JOIN locations l ON l.id = c.location_id
        WHERE c.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'CampNotFound', message: 'Camp not found' });
    res.json(toCamelCase(rows[0]));
  } catch (err) { fail(res, err, 'to fetch camp'); }
});

// GET /api/camps/:id/readiness?to=published
// What would block the next transition — so the UI can show it before the button is pressed.
router.get('/:id/readiness', async (req, res) => {
  try {
    const db = db_(req);
    const camp = await camps.getCamp(db, req.params.id);
    const to = req.query.to || (camps.ALLOWED_TRANSITIONS[camp.status] || [])[0] || null;
    if (!to) return res.json({ status: camp.status, to: null, ready: false, blockers: [], allowed: [] });
    const blockers = await camps.readinessFor(db, camp, to);
    res.json({
      status: camp.status, to, ready: blockers.length === 0, blockers,
      allowed: camps.ALLOWED_TRANSITIONS[camp.status] || [],
    });
  } catch (err) { fail(res, err, 'to check camp readiness'); }
});

// POST /api/camps
router.post('/', canPlan, async (req, res) => {
  const {
    name, description, locationId, sponsorName, sponsorContact, fundingSource,
    isFree, budget, currency, startsAt, endsAt, timezone, capacity, notes,
  } = req.body || {};

  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required' });
  if (!startsAt || !endsAt) return res.status(400).json({ error: 'startsAt and endsAt are required' });
  if (new Date(endsAt) <= new Date(startsAt)) {
    return res.status(400).json({ error: 'endsAt must be after startsAt' });
  }
  if (fundingSource && !camps.FUNDING_SOURCES.includes(fundingSource)) {
    return res.status(400).json({ error: `fundingSource must be one of: ${camps.FUNDING_SOURCES.join(', ')}` });
  }

  try {
    const db = db_(req);
    if (locationId) await assertUsableLocation(db, locationId);

    const { rows } = await db.query(
      `INSERT INTO camps
         (name, description, location_id, sponsor_name, sponsor_contact, funding_source,
          is_free, budget, currency, starts_at, ends_at, timezone, capacity, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6,'self_funded'),COALESCE($7,true),$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [String(name).trim(), description || null, locationId || null, sponsorName || null,
       sponsorContact || null, fundingSource || null,
       isFree === undefined ? null : isFree, budget ?? null, currency || null,
       startsAt, endsAt, timezone || null, capacity ?? null, notes || null, req.user.id]
    );
    res.status(201).json(toCamelCase(rows[0]));
  } catch (err) { fail(res, err, 'to create camp'); }
});

// PUT /api/camps/:id — the shape of a camp is frozen once it is running.
router.put('/:id', canPlan, async (req, res) => {
  const {
    name, description, locationId, sponsorName, sponsorContact, fundingSource,
    isFree, budget, currency, startsAt, endsAt, timezone, capacity, notes,
  } = req.body || {};

  if (fundingSource && !camps.FUNDING_SOURCES.includes(fundingSource)) {
    return res.status(400).json({ error: `fundingSource must be one of: ${camps.FUNDING_SOURCES.join(', ')}` });
  }

  try {
    const db = db_(req);
    const camp = await camps.getCamp(db, req.params.id);
    if (camp.status === 'closed' || camp.status === 'archived') {
      return res.status(409).json({
        error: 'CampFrozen',
        message: `This camp is ${camp.status}; its details and counts are frozen so its reports stay reproducible.`,
      });
    }
    if (locationId) await assertUsableLocation(db, locationId);

    // Moving a free camp to paid, or vice versa, must not leave priced services behind on
    // a camp that claims to be free.
    if (isFree === true) {
      const { rows: priced } = await db.query(
        'SELECT count(*)::int AS n FROM camp_services WHERE camp_id = $1 AND price IS NOT NULL AND price > 0',
        [camp.id]
      );
      if (priced[0].n > 0) {
        return res.status(409).json({
          error: 'PricedServicesPresent',
          message: `${priced[0].n} service(s) on this camp carry a price. Clear those prices before marking the camp free.`,
        });
      }
    }

    const { rows } = await db.query(
      `UPDATE camps SET
         name = COALESCE($1, name), description = COALESCE($2, description),
         location_id = COALESCE($3, location_id), sponsor_name = COALESCE($4, sponsor_name),
         sponsor_contact = COALESCE($5, sponsor_contact),
         funding_source = COALESCE($6, funding_source), is_free = COALESCE($7, is_free),
         budget = COALESCE($8, budget), currency = COALESCE($9, currency),
         starts_at = COALESCE($10, starts_at), ends_at = COALESCE($11, ends_at),
         timezone = COALESCE($12, timezone), capacity = COALESCE($13, capacity),
         notes = COALESCE($14, notes), updated_at = CURRENT_TIMESTAMP
       WHERE id = $15
       RETURNING *`,
      [name ? String(name).trim() : null, description ?? null, locationId || null,
       sponsorName ?? null, sponsorContact ?? null, fundingSource || null,
       isFree === undefined ? null : isFree, budget ?? null, currency || null,
       startsAt || null, endsAt || null, timezone || null, capacity ?? null, notes ?? null,
       req.params.id]
    );
    res.json(toCamelCase(rows[0]));
  } catch (err) { fail(res, err, 'to update camp'); }
});

// POST /api/camps/:id/status { status }
router.post('/:id/status', canPlan, async (req, res) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: 'status is required' });
  try {
    const db = db_(req);
    const updated = await withTx(db, () => camps.transition(db, req.params.id, status, req.user.id));
    res.json(toCamelCase(updated));
  } catch (err) { fail(res, err, 'to change camp status'); }
});

// DELETE /api/camps/:id — only an untouched draft.
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const db = db_(req);
    const camp = await camps.getCamp(db, req.params.id);
    if (camp.status !== 'draft') {
      return res.status(409).json({
        error: 'CampNotDraft',
        message: `Only a draft camp can be deleted; this one is ${camp.status}. Archive it instead.`,
      });
    }
    const { rows: regs } = await db.query(
      'SELECT count(*)::int AS n FROM camp_registrations WHERE camp_id = $1', [camp.id]
    );
    if (regs[0].n > 0) {
      return res.status(409).json({
        error: 'HasRegistrations',
        message: `${regs[0].n} attendee(s) are registered. Archive this camp rather than deleting it.`,
      });
    }
    await db.query('DELETE FROM camps WHERE id = $1', [camp.id]);
    res.json({ success: true, id: camp.id });
  } catch (err) { fail(res, err, 'to delete camp'); }
});

// ─── services ────────────────────────────────────────────────────────────────────────

router.get('/:id/services', async (req, res) => {
  try {
    const { rows } = await db_(req).query(
      `SELECT s.*, o.name AS offering_name, o.duration_minutes
         FROM camp_services s
         LEFT JOIN healthcare_offerings o ON o.id = s.offering_id
        WHERE s.camp_id = $1
        ORDER BY s.display_order, COALESCE(o.name, s.label)`,
      [req.params.id]
    );
    res.json(camelRows(rows));
  } catch (err) { fail(res, err, 'to fetch camp services'); }
});

router.post('/:id/services', canPlan, async (req, res) => {
  const { offeringId, label, isFree, price, displayOrder } = req.body || {};
  if (!offeringId && !label) {
    return res.status(400).json({ error: 'Either offeringId or label is required' });
  }
  try {
    const db = db_(req);
    const camp = await camps.getCamp(db, req.params.id);

    // A free camp cannot hold a priced service. The database CHECK catches the
    // self-contradictory row (is_free with a price); only the route can see the parent.
    if (camp.is_free && price != null && Number(price) > 0) {
      return res.status(409).json({
        error: 'CampIsFree',
        message: `"${camp.name}" is a free camp, so its services cannot carry a price. Mark the camp as paid first.`,
      });
    }

    // Derive is_free from the price when the caller does not say, rather than leaving the
    // flag and the price free to disagree.
    const free = isFree === undefined ? (price == null || Number(price) === 0) : Boolean(isFree);

    const { rows } = await db.query(
      `INSERT INTO camp_services (camp_id, offering_id, label, is_free, price, display_order)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6,0))
       RETURNING *`,
      [camp.id, offeringId || null, label || null, free, price ?? null, displayOrder ?? null]
    );
    res.status(201).json(toCamelCase(rows[0]));
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'DuplicateService', message: 'That service is already on this camp.' });
    }
    fail(res, err, 'to add camp service');
  }
});

router.delete('/services/:serviceId', canPlan, async (req, res) => {
  try {
    const { rows } = await db_(req).query(
      'DELETE FROM camp_services WHERE id = $1 RETURNING *', [req.params.serviceId]
    );
    if (!rows.length) return res.status(404).json({ error: 'ServiceNotFound' });
    res.json({ success: true, service: toCamelCase(rows[0]) });
  } catch (err) { fail(res, err, 'to remove camp service'); }
});

// ─── staff ───────────────────────────────────────────────────────────────────────────

router.get('/:id/staff', async (req, res) => {
  try {
    const { rows } = await db_(req).query(
      `SELECT s.*, u.first_name, u.last_name, u.email, u.role AS account_role
         FROM camp_staff s
         LEFT JOIN users u ON u.id = s.user_id
        WHERE s.camp_id = $1
        ORDER BY s.camp_role, u.last_name, u.first_name`,
      [req.params.id]
    );
    res.json(camelRows(rows));
  } catch (err) { fail(res, err, 'to fetch camp staff'); }
});

// GET /api/camps/:id/staff/conflicts?userId=…
// Asked by the UI before the roster button is pressed, so the clash is visible up front.
router.get('/:id/staff/conflicts', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  try {
    const db = db_(req);
    const camp = await camps.getCamp(db, req.params.id);
    const conflicts = await camps.staffingConflicts(db, camp, userId);
    res.json({ conflicts: camelRows(conflicts), count: conflicts.length });
  } catch (err) { fail(res, err, 'to check staffing conflicts'); }
});

// POST /api/camps/:id/staff { userId, campRole, force }
router.post('/:id/staff', canPlan, async (req, res) => {
  const { userId, campRole, notes, force } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  if (campRole && !camps.CAMP_ROLES.includes(campRole)) {
    return res.status(400).json({ error: `campRole must be one of: ${camps.CAMP_ROLES.join(', ')}` });
  }
  try {
    const db = db_(req);
    const camp = await camps.getCamp(db, req.params.id);

    // The account has to belong to this practice; users is a shared table, so without this
    // a stray uuid would roster someone from another tenant.
    const { rows: who } = await db.query(
      'SELECT id, first_name, last_name FROM users WHERE id = $1 AND practice_id = $2',
      [userId, req.tenant && req.tenant.practiceId]
    );
    if (!who.length) {
      return res.status(404).json({ error: 'UserNotFound', message: 'That account is not part of this practice.' });
    }

    // A camp takes someone away from the clinic for its whole window. Refuse by default and
    // name every clash; `force` is for the case where a human has already decided.
    const conflicts = await camps.staffingConflicts(db, camp, userId);
    if (conflicts.length && !force) {
      return res.status(409).json({
        error: 'StaffingConflict',
        message: `${who[0].first_name} ${who[0].last_name} has ${conflicts.length} appointment(s) elsewhere during this camp. Move or cancel them, or pass force to roster anyway.`,
        conflicts: camelRows(conflicts),
      });
    }

    const { rows } = await db.query(
      `INSERT INTO camp_staff (camp_id, user_id, camp_role, notes)
       VALUES ($1,$2,COALESCE($3,'clinician'),$4) RETURNING *`,
      [camp.id, userId, campRole || null, notes || null]
    );
    res.status(201).json({ ...toCamelCase(rows[0]), conflictsOverridden: conflicts.length });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'AlreadyRostered', message: 'That person is already on this camp.' });
    }
    fail(res, err, 'to roster camp staff');
  }
});

router.delete('/staff/:staffId', canPlan, async (req, res) => {
  try {
    const { rows } = await db_(req).query(
      'DELETE FROM camp_staff WHERE id = $1 RETURNING *', [req.params.staffId]
    );
    if (!rows.length) return res.status(404).json({ error: 'StaffNotFound' });
    res.json({ success: true, staff: toCamelCase(rows[0]) });
  } catch (err) { fail(res, err, 'to remove camp staff'); }
});

// ─── stations ────────────────────────────────────────────────────────────────────────

router.get('/:id/stations', async (req, res) => {
  try {
    const { rows } = await db_(req).query(
      `SELECT st.*, o.name AS offering_name, f.name AS form_name
         FROM camp_stations st
         LEFT JOIN healthcare_offerings o ON o.id = st.offering_id
         LEFT JOIN form_templates f       ON f.id = st.form_template_id
        WHERE st.camp_id = $1
        ORDER BY st.step_order, st.name`,
      [req.params.id]
    );
    res.json(camelRows(rows));
  } catch (err) { fail(res, err, 'to fetch camp stations'); }
});

router.post('/:id/stations', canPlan, async (req, res) => {
  const { name, stepOrder, offeringId, formTemplateId, isClinical } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required' });
  try {
    const db = db_(req);
    const camp = await camps.getCamp(db, req.params.id);
    const { rows } = await db.query(
      `INSERT INTO camp_stations (camp_id, name, step_order, offering_id, form_template_id, is_clinical)
       VALUES ($1,$2,COALESCE($3,0),$4,$5,COALESCE($6,true)) RETURNING *`,
      [camp.id, String(name).trim(), stepOrder ?? null, offeringId || null,
       formTemplateId || null, isClinical === undefined ? null : isClinical]
    );
    res.status(201).json(toCamelCase(rows[0]));
  } catch (err) { fail(res, err, 'to add camp station'); }
});

router.put('/stations/:stationId', canPlan, async (req, res) => {
  const { name, stepOrder, offeringId, formTemplateId, isClinical, isActive } = req.body || {};
  try {
    const { rows } = await db_(req).query(
      `UPDATE camp_stations SET
         name = COALESCE($1, name), step_order = COALESCE($2, step_order),
         offering_id = COALESCE($3, offering_id), form_template_id = COALESCE($4, form_template_id),
         is_clinical = COALESCE($5, is_clinical), is_active = COALESCE($6, is_active),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING *`,
      [name ? String(name).trim() : null, stepOrder ?? null, offeringId || null,
       formTemplateId || null, isClinical === undefined ? null : isClinical,
       isActive === undefined ? null : isActive, req.params.stationId]
    );
    if (!rows.length) return res.status(404).json({ error: 'StationNotFound' });
    res.json(toCamelCase(rows[0]));
  } catch (err) { fail(res, err, 'to update camp station'); }
});

router.delete('/stations/:stationId', canPlan, async (req, res) => {
  try {
    const db = db_(req);
    const { rows: used } = await db.query(
      'SELECT count(*)::int AS n FROM camp_station_visits WHERE station_id = $1', [req.params.stationId]
    );
    if (used[0].n > 0) {
      return res.status(409).json({
        error: 'StationInUse',
        message: `${used[0].n} attendee visit(s) have passed through this station. Deactivate it instead of deleting it.`,
      });
    }
    const { rows } = await db.query(
      'DELETE FROM camp_stations WHERE id = $1 RETURNING *', [req.params.stationId]
    );
    if (!rows.length) return res.status(404).json({ error: 'StationNotFound' });
    res.json({ success: true, station: toCamelCase(rows[0]) });
  } catch (err) { fail(res, err, 'to delete camp station'); }
});

// ─── inventory allocations ───────────────────────────────────────────────────────────

router.get('/:id/allocations', async (req, res) => {
  try {
    const { rows } = await db_(req).query(
      `SELECT a.*, i.name AS item_name, i.item_number, i.unit_of_measure, i.unit_cost,
              (a.qty_issued - a.qty_consumed - a.qty_returned) AS qty_unaccounted
         FROM camp_inventory_allocations a
         JOIN inventory_items i ON i.id = a.item_id
        WHERE a.camp_id = $1
        ORDER BY i.name`,
      [req.params.id]
    );
    res.json(camelRows(rows));
  } catch (err) { fail(res, err, 'to fetch camp allocations'); }
});

router.get('/:id/cost', async (req, res) => {
  try {
    const db = db_(req);
    const camp = await camps.getCamp(db, req.params.id);
    const cost = await camps.costSummary(db, camp.id);
    // Camps are normally free or sponsor-funded, and nothing in the product bills an
    // attendee automatically — so the camp's financial picture is its budget against the
    // stock it actually consumed, not a revenue line.
    res.json({
      campId: camp.id, isFree: camp.is_free, fundingSource: camp.funding_source,
      budget: camp.budget, currency: camp.currency, ...toCamelCase(cost),
    });
  } catch (err) { fail(res, err, 'to fetch camp cost'); }
});

// POST /api/camps/:id/allocations { itemId, qtyIssued, notes }
// Issues stock out of the store: one movement, one allocation, one balance update.
router.post('/:id/allocations', canPlan, async (req, res) => {
  const { itemId, qtyIssued, notes } = req.body || {};
  if (!itemId) return res.status(400).json({ error: 'itemId is required' });
  const qty = Number(qtyIssued);
  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ error: 'qtyIssued must be a positive number' });
  }

  try {
    const db = db_(req);
    const out = await withTx(db, async () => {
      const camp = await camps.getCamp(db, req.params.id);
      if (camp.status === 'closed' || camp.status === 'archived') {
        throw camps.campError(409, 'CampFrozen', `This camp is ${camp.status}; stock can no longer be issued to it.`);
      }

      const { rows: items } = await db.query(
        'SELECT * FROM inventory_items WHERE id = $1 FOR UPDATE', [itemId]
      );
      if (!items.length) throw camps.campError(404, 'ItemNotFound', 'Inventory item not found');
      const item = items[0];

      const newBalance = parseFloat(item.quantity_on_hand) - qty;
      if (newBalance < 0) {
        throw camps.campError(400, 'InsufficientStock',
          `Only ${item.quantity_on_hand} ${item.unit_of_measure} of ${item.name} on hand; ${qty} requested.`);
      }

      await db.query(
        'UPDATE inventory_items SET quantity_on_hand = $1, updated_by = $2 WHERE id = $3',
        [newBalance, req.user.id, itemId]
      );

      const { rows: mv } = await db.query('SELECT generate_movement_number() AS num');
      const { rows: movement } = await db.query(
        `INSERT INTO inventory_stock_movements
           (movement_number, item_id, movement_type, reference_type, reference_id,
            quantity, unit_cost, movement_date, notes, balance_after, performed_by, location_id)
         VALUES ($1,$2,'issue','camp',$3,$4,$5,CURRENT_DATE,$6,$7,$8,$9)
         RETURNING *`,
        [mv[0].num, itemId, camp.id, -qty, item.unit_cost,
         notes || `Issued to camp: ${camp.name}`, newBalance, req.user.id, camp.location_id]
      );

      const { rows: alloc } = await db.query(
        `INSERT INTO camp_inventory_allocations (camp_id, item_id, qty_issued, issue_movement_id, notes)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (camp_id, item_id) DO UPDATE
           SET qty_issued = camp_inventory_allocations.qty_issued + EXCLUDED.qty_issued,
               reconciled_at = NULL,
               updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [camp.id, itemId, qty, movement[0].id, notes || null]
      );

      return { allocation: toCamelCase(alloc[0]), movement: toCamelCase(movement[0]) };
    });
    res.status(201).json(out);
  } catch (err) { fail(res, err, 'to issue stock to camp'); }
});

// POST /api/camps/allocations/:allocId/reconcile { qtyConsumed, qtyReturned }
// Returning the unused balance to the store is what makes a camp's stock account close.
router.post('/allocations/:allocId/reconcile', canPlan, async (req, res) => {
  const { qtyConsumed, qtyReturned } = req.body || {};
  const consumed = Number(qtyConsumed);
  const returned = Number(qtyReturned);
  if (!Number.isFinite(consumed) || consumed < 0 || !Number.isFinite(returned) || returned < 0) {
    return res.status(400).json({ error: 'qtyConsumed and qtyReturned must both be numbers >= 0' });
  }

  try {
    const db = db_(req);
    const out = await withTx(db, async () => {
      const { rows: allocs } = await db.query(
        'SELECT * FROM camp_inventory_allocations WHERE id = $1 FOR UPDATE', [req.params.allocId]
      );
      if (!allocs.length) throw camps.campError(404, 'AllocationNotFound', 'Allocation not found');
      const alloc = allocs[0];

      const issued = parseFloat(alloc.qty_issued);
      if (consumed + returned !== issued) {
        throw camps.campError(400, 'DoesNotBalance',
          `${issued} was issued; consumed (${consumed}) plus returned (${returned}) must equal that exactly.`);
      }

      let returnMovementId = alloc.return_movement_id;
      if (returned > 0) {
        const { rows: items } = await db.query(
          'SELECT * FROM inventory_items WHERE id = $1 FOR UPDATE', [alloc.item_id]
        );
        const item = items[0];
        const newBalance = parseFloat(item.quantity_on_hand) + returned;
        await db.query(
          'UPDATE inventory_items SET quantity_on_hand = $1, updated_by = $2 WHERE id = $3',
          [newBalance, req.user.id, alloc.item_id]
        );
        const { rows: mv } = await db.query('SELECT generate_movement_number() AS num');
        const { rows: movement } = await db.query(
          `INSERT INTO inventory_stock_movements
             (movement_number, item_id, movement_type, reference_type, reference_id,
              quantity, unit_cost, movement_date, notes, balance_after, performed_by)
           VALUES ($1,$2,'return','camp',$3,$4,$5,CURRENT_DATE,$6,$7,$8)
           RETURNING id`,
          [mv[0].num, alloc.item_id, alloc.camp_id, returned, item.unit_cost,
           'Unused stock returned from camp', newBalance, req.user.id]
        );
        returnMovementId = movement[0].id;
      }

      const { rows } = await db.query(
        `UPDATE camp_inventory_allocations
            SET qty_consumed = $1, qty_returned = $2, return_movement_id = $3,
                reconciled_at = CURRENT_TIMESTAMP, reconciled_by = $4,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = $5 RETURNING *`,
        [consumed, returned, returnMovementId, req.user.id, alloc.id]
      );
      return toCamelCase(rows[0]);
    });
    res.json(out);
  } catch (err) { fail(res, err, 'to reconcile camp stock'); }
});

// ─── station board and visits (B5) ───────────────────────────────────────────────────

// GET /api/camps/:id/board — every station with its live queue depth and waiting times.
router.get('/:id/board', async (req, res) => {
  try {
    const { rows } = await db_(req).query(
      `SELECT st.id, st.name, st.step_order, st.is_clinical, st.is_active,
              count(v.id) FILTER (WHERE v.status = 'queued')::int      AS queued,
              count(v.id) FILTER (WHERE v.status = 'in_progress')::int AS in_progress,
              count(v.id) FILTER (WHERE v.status = 'completed')::int   AS completed,
              EXTRACT(EPOCH FROM (
                now() - MIN(v.queued_at) FILTER (WHERE v.status = 'queued')
              ))::int AS longest_wait_seconds
         FROM camp_stations st
         LEFT JOIN camp_station_visits v ON v.station_id = st.id
        WHERE st.camp_id = $1
        GROUP BY st.id
        ORDER BY st.step_order, st.name`,
      [req.params.id]
    );
    res.json(camelRows(rows));
  } catch (err) { fail(res, err, 'to fetch camp board'); }
});

// GET /api/camps/stations/:stationId/queue
router.get('/stations/:stationId/queue', async (req, res) => {
  try {
    const { rows } = await db_(req).query(
      `SELECT v.*, r.token_no, r.full_name, r.age_years, r.date_of_birth, r.gender,
              r.consent_given_at, r.patient_id
         FROM camp_station_visits v
         JOIN camp_registrations r ON r.id = v.registration_id
        WHERE v.station_id = $1 AND v.status IN ('queued', 'in_progress')
        ORDER BY v.status DESC, v.queued_at`,
      [req.params.stationId]
    );
    res.json(camelRows(rows));
  } catch (err) { fail(res, err, 'to fetch station queue'); }
});

// POST /api/camps/visits/:visitId/start
router.post('/visits/:visitId/start', async (req, res) => {
  try {
    const db = db_(req);
    const out = await withTx(db, async () => {
      const { rows: visits } = await db.query(
        `SELECT v.*, st.is_clinical, st.camp_id
           FROM camp_station_visits v JOIN camp_stations st ON st.id = v.station_id
          WHERE v.id = $1 FOR UPDATE OF v`,
        [req.params.visitId]
      );
      if (!visits.length) throw camps.campError(404, 'VisitNotFound', 'Queue entry not found');
      const visit = visits[0];
      if (visit.status === 'completed') {
        throw camps.campError(409, 'VisitCompleted', 'That station visit is already finished.');
      }

      const { rows: regs } = await db.query(
        'SELECT * FROM camp_registrations WHERE id = $1', [visit.registration_id]
      );
      // The consent gate, enforced again here: starting the station IS the clinical touch.
      await camps.assertConsent(db, regs[0], { is_clinical: visit.is_clinical });

      const { rows } = await db.query(
        `UPDATE camp_station_visits
            SET status = 'in_progress', started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
                handled_by = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2 RETURNING *`,
        [req.user.id, visit.id]
      );
      await db.query(
        `UPDATE camp_registrations SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND status = 'registered'`,
        [visit.registration_id]
      );
      return toCamelCase(rows[0]);
    });
    res.json(out);
  } catch (err) { fail(res, err, 'to start station visit'); }
});

// POST /api/camps/visits/:visitId/complete { outcome, notes }
router.post('/visits/:visitId/complete', async (req, res) => {
  const { outcome, notes } = req.body || {};
  const OUTCOMES = ['normal', 'referred', 'follow_up', 'declined', 'no_show'];
  if (outcome && !OUTCOMES.includes(outcome)) {
    return res.status(400).json({ error: `outcome must be one of: ${OUTCOMES.join(', ')}` });
  }
  try {
    const db = db_(req);
    const { rows } = await db.query(
      `UPDATE camp_station_visits
          SET status = 'completed', completed_at = CURRENT_TIMESTAMP,
              started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
              handled_by = COALESCE(handled_by, $1),
              outcome = COALESCE($2, outcome), notes = COALESCE($3, notes),
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $4 RETURNING *`,
      [req.user.id, outcome || null, notes || null, req.params.visitId]
    );
    if (!rows.length) return res.status(404).json({ error: 'VisitNotFound' });
    res.json(toCamelCase(rows[0]));
  } catch (err) { fail(res, err, 'to complete station visit'); }
});

module.exports = router;
