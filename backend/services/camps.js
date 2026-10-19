// Medical camps — the rules, kept out of the route layer so they can be tested directly
// and reused by the registration desk, the station board and the reports.
//
// Two decisions shape everything here:
//
//  1. A camp never gets its own clinical storage. Anything clinical a camp produces is an
//     ordinary medical_records / diagnosis / prescriptions / lab_orders row carrying a
//     camp_id. So there is no "camp patient" — there are registrations, which are promoted
//     to real patients rows when a clinician first touches them.
//
//  2. `location_id IS NULL` means the tenant's primary site (see utils/locations.js).
//     Every comparison involving a site has to resolve that, or a clinic appointment with
//     no explicit site looks like it is nowhere and conflicts with nothing.

const { primaryLocationId } = require('../utils/locations');

const CAMP_STATUSES = ['draft', 'published', 'in_progress', 'closed', 'archived'];

// Deliberately sparse. Reopening a closed camp would let its frozen counts and its sponsor
// report move after the fact, so it is not offered; unpublishing is allowed only while
// nobody has registered, which readinessFor checks.
const ALLOWED_TRANSITIONS = {
  draft:       ['published'],
  published:   ['draft', 'in_progress'],
  in_progress: ['closed'],
  closed:      ['archived'],
  archived:    [],
};

const CAMP_ROLES = ['lead', 'registrar', 'clinician', 'nurse', 'lab', 'pharmacy', 'volunteer'];
const FUNDING_SOURCES = ['self_funded', 'sponsored', 'government', 'ngo', 'csr'];

/** An error carrying an HTTP status and a stable code, so routes need no mapping table. */
function campError(status, code, message, extra = {}) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  Object.assign(err, extra);
  return err;
}

async function getCamp(db, campId) {
  const { rows } = await db.query('SELECT * FROM camps WHERE id = $1', [campId]);
  if (!rows.length) throw campError(404, 'CampNotFound', 'Camp not found');
  return rows[0];
}

/**
 * What still has to be true before `camp` may move to `to`.
 *
 * Returns an array of { code, message } — empty means ready. Returning every blocker at
 * once rather than the first is deliberate: "publish failed" that names one missing thing
 * at a time turns setting up a camp into a guessing game.
 */
async function readinessFor(db, camp, to) {
  const blockers = [];
  const count = async (sql, params) => {
    const { rows } = await db.query(sql, params);
    return Number(rows[0].n);
  };

  if (to === 'published') {
    if (!camp.location_id) {
      blockers.push({ code: 'NoLocation', message: 'Choose the venue for this camp.' });
    }
    if (await count('SELECT count(*)::int AS n FROM camp_services WHERE camp_id = $1', [camp.id]) === 0) {
      blockers.push({ code: 'NoServices', message: 'Add at least one service the camp will offer.' });
    }
    if (await count('SELECT count(*)::int AS n FROM camp_staff WHERE camp_id = $1', [camp.id]) === 0) {
      blockers.push({ code: 'NoStaff', message: 'Roster at least one member of staff.' });
    }
    // A camp runs as a pipeline; with no stations there is nothing for an attendee to walk
    // through and the station board would open empty.
    if (await count('SELECT count(*)::int AS n FROM camp_stations WHERE camp_id = $1 AND is_active', [camp.id]) === 0) {
      blockers.push({ code: 'NoStations', message: 'Define at least one active station.' });
    }
  }

  if (to === 'draft') {
    const regs = await count('SELECT count(*)::int AS n FROM camp_registrations WHERE camp_id = $1', [camp.id]);
    if (regs > 0) {
      blockers.push({
        code: 'HasRegistrations',
        message: `${regs} attendee(s) have already registered, so this camp can no longer be returned to draft.`,
      });
    }
  }

  if (to === 'closed') {
    // Supplies are optional — a counselling camp may carry none — so this only applies to
    // allocations that actually exist. What is NOT optional is that the ones issued are
    // accounted for, which is the whole point of recording them.
    const { rows: unrec } = await db.query(
      `SELECT a.id, i.name, a.qty_issued, a.qty_consumed, a.qty_returned
         FROM camp_inventory_allocations a
         JOIN inventory_items i ON i.id = a.item_id
        WHERE a.camp_id = $1
          AND (a.reconciled_at IS NULL OR a.qty_consumed + a.qty_returned <> a.qty_issued)`,
      [camp.id]
    );
    if (unrec.length) {
      blockers.push({
        code: 'UnreconciledStock',
        message: `Reconcile the stock issued to this camp first: ${unrec.map((r) => r.name).join(', ')}.`,
        items: unrec,
      });
    }

    const midway = await count(
      "SELECT count(*)::int AS n FROM camp_registrations WHERE camp_id = $1 AND status = 'in_progress'",
      [camp.id]
    );
    if (midway > 0) {
      blockers.push({
        code: 'AttendeesInProgress',
        message: `${midway} attendee(s) are still mid-pipeline. Complete or mark them as left early before closing.`,
      });
    }
  }

  return blockers;
}

/**
 * Move a camp to `to`, or throw with the reason. Caller supplies an open transaction.
 */
async function transition(db, campId, to, actorId) {
  if (!CAMP_STATUSES.includes(to)) {
    throw campError(400, 'UnknownStatus', `status must be one of: ${CAMP_STATUSES.join(', ')}`);
  }

  const { rows } = await db.query('SELECT * FROM camps WHERE id = $1 FOR UPDATE', [campId]);
  if (!rows.length) throw campError(404, 'CampNotFound', 'Camp not found');
  const camp = rows[0];

  if (camp.status === to) return camp; // idempotent

  const allowed = ALLOWED_TRANSITIONS[camp.status] || [];
  if (!allowed.includes(to)) {
    throw campError(409, 'IllegalTransition',
      `A camp cannot go from ${camp.status} to ${to}.`,
      { from: camp.status, to, allowed });
  }

  const blockers = await readinessFor(db, camp, to);
  if (blockers.length) {
    throw campError(409, 'NotReady',
      blockers.map((b) => b.message).join(' '),
      { blockers });
  }

  const stamp = {
    published:   'published_at',
    in_progress: 'started_at',
    closed:      'closed_at',
  }[to];

  const sets = ['status = $2', 'updated_at = CURRENT_TIMESTAMP'];
  const params = [campId, to];
  if (stamp) sets.push(`${stamp} = COALESCE(${stamp}, CURRENT_TIMESTAMP)`);
  if (to === 'closed') { params.push(actorId || null); sets.push(`closed_by = $${params.length}`); }

  const { rows: updated } = await db.query(
    `UPDATE camps SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params
  );
  return updated[0];
}

/**
 * Hand out the next queue token for a camp.
 *
 * Caller must be inside a transaction: the row lock on camps is what stops two
 * registration desks issuing the same number, and it also means a rolled-back
 * registration does not burn a token.
 */
async function allocateToken(db, campId) {
  const { rows } = await db.query(
    'UPDATE camps SET next_token_no = next_token_no + 1 WHERE id = $1 RETURNING next_token_no - 1 AS token_no',
    [campId]
  );
  if (!rows.length) throw campError(404, 'CampNotFound', 'Camp not found');
  return rows[0].token_no;
}

/**
 * Clinic work that would clash with rostering `userId` to `camp`.
 *
 * A camp takes a clinician away from the practice, and nothing in the scheduler knew that
 * before — so without this a provider is silently double-booked. Appointments already
 * AT this camp, or at the camp's own venue, are not conflicts.
 */
async function staffingConflicts(db, camp, userId) {
  const fallback = await primaryLocationId(db);
  const { rows } = await db.query(
    `SELECT a.id, a.start_time, a.end_time, a.status,
            COALESCE(l.name, '(primary site)') AS location_name
       FROM appointments a
       LEFT JOIN locations l ON l.id = COALESCE(a.location_id, $4)
      WHERE a.provider_id = $1
        AND a.status NOT IN ('cancelled', 'no-show', 'no_show')
        AND a.start_time < $3 AND a.end_time > $2
        AND (a.camp_id IS NULL OR a.camp_id <> $5)
        AND COALESCE(a.location_id, $4) IS DISTINCT FROM $6
      ORDER BY a.start_time
      LIMIT 50`,
    [userId, camp.starts_at, camp.ends_at, fallback, camp.id, camp.location_id]
  );
  return rows;
}

/**
 * Camp windows that should block a provider's bookable slots, shaped like
 * doctor_time_off rows so the slot generator can treat them identically.
 */
async function rosteredCampWindows(db, providerId, fromDate, toDate) {
  const { rows } = await db.query(
    `SELECT c.id AS camp_id, c.name, c.starts_at AS start_date, c.ends_at AS end_date
       FROM camp_staff s
       JOIN camps c ON c.id = s.camp_id
      WHERE s.user_id = $1
        AND c.status IN ('published', 'in_progress')
        AND c.starts_at <= $3::timestamp
        AND c.ends_at   >= $2::timestamp`,
    [providerId, fromDate, toDate]
  );
  return rows;
}

/** `full_name` is one field at the desk; patients needs two. Split on the last space. */
function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Unknown', lastName: '-' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '-' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

/**
 * Existing patients who might already be this attendee.
 *
 * Phone is the strong signal at a camp — names are transliterated inconsistently and ages
 * are approximate — so an exact phone match ranks above a name match.
 */
async function matchCandidates(db, registration) {
  const { firstName, lastName } = splitName(registration.full_name);
  const { rows } = await db.query(
    `SELECT p.id, p.mrn, p.first_name, p.last_name, p.date_of_birth, p.phone, p.email,
            CASE
              WHEN $1 <> '' AND p.phone = $1 THEN 'phone'
              WHEN $4 <> '' AND LOWER(p.email) = LOWER($4) THEN 'email'
              ELSE 'name'
            END AS matched_on
       FROM patients p
      WHERE ($1 <> '' AND p.phone = $1)
         OR ($4 <> '' AND LOWER(p.email) = LOWER($4))
         OR (LOWER(p.first_name) = LOWER($2) AND LOWER(p.last_name) = LOWER($3))
      ORDER BY CASE
                 WHEN $1 <> '' AND p.phone = $1 THEN 0
                 WHEN $4 <> '' AND LOWER(p.email) = LOWER($4) THEN 1
                 ELSE 2
               END
      LIMIT 10`,
    [registration.phone || '', firstName, lastName, registration.email || '']
  );
  return rows;
}

/** Next MRN in the existing `MRN-<n>` series. Mirrors routes/users.js. */
async function nextMrn(db) {
  const { rows } = await db.query(
    "SELECT MAX(CAST(SUBSTRING(mrn FROM 5) AS INTEGER)) AS max_mrn FROM patients WHERE mrn LIKE 'MRN-%'"
  );
  return `MRN-${(rows[0].max_mrn || 0) + 1}`;
}

/**
 * Turn a registration into a real patient, or link it to one that already exists.
 *
 * This is the ONLY path from a camp to the patients table, which is what keeps
 * deduplication an explicit, auditable act instead of an accident of throughput.
 *
 * patients.date_of_birth is NOT NULL, and attendees commonly give an age rather than a
 * date. Rather than invent a precise date silently, promotion requires either an explicit
 * dateOfBirth or `estimateDobFromAge: true`, which derives 1 January of the birth year and
 * says so in the result. Caller supplies an open transaction.
 */
async function promoteRegistration(db, registrationId, opts = {}) {
  const { patientId = null, dateOfBirth = null, estimateDobFromAge = false, actorId = null, practiceId = null } = opts;

  const { rows: regs } = await db.query(
    'SELECT * FROM camp_registrations WHERE id = $1 FOR UPDATE', [registrationId]
  );
  if (!regs.length) throw campError(404, 'RegistrationNotFound', 'Registration not found');
  const reg = regs[0];

  if (reg.patient_id) {
    const { rows } = await db.query('SELECT * FROM patients WHERE id = $1', [reg.patient_id]);
    return { patient: rows[0] || null, created: false, linked: false, alreadyPromoted: true };
  }

  // Linking to an existing patient: no new record, no DOB question.
  if (patientId) {
    const { rows: existing } = await db.query('SELECT * FROM patients WHERE id = $1', [patientId]);
    if (!existing.length) throw campError(404, 'PatientNotFound', 'That patient does not exist in this practice');
    await db.query(
      `UPDATE camp_registrations
          SET patient_id = $1, promoted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2`,
      [patientId, registrationId]
    );
    return { patient: existing[0], created: false, linked: true, dateOfBirthEstimated: false };
  }

  let dob = dateOfBirth || reg.date_of_birth || null;
  let estimated = false;
  if (!dob) {
    if (!estimateDobFromAge || reg.age_years === null) {
      throw campError(400, 'DateOfBirthRequired',
        'A patient record needs a date of birth. Supply dateOfBirth, or pass estimateDobFromAge to derive 1 January of the birth year from the recorded age.');
    }
    dob = `${new Date().getUTCFullYear() - Number(reg.age_years)}-01-01`;
    estimated = true;
  }

  const { firstName, lastName } = splitName(reg.full_name);
  const mrn = await nextMrn(db);

  const { rows: created } = await db.query(
    `INSERT INTO patients
       (id, practice_id, mrn, first_name, last_name, date_of_birth, gender,
        phone, email, address, city, status, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active',
             CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     RETURNING *`,
    [practiceId, mrn, firstName, lastName, dob, reg.gender || null,
     reg.phone || null, reg.email || null, reg.address || null, reg.city || null]
  );

  await db.query(
    `UPDATE camp_registrations
        SET patient_id = $1, promoted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2`,
    [created[0].id, registrationId]
  );

  // Provenance: creating a patient record from a camp desk is exactly the kind of act an
  // audit trail exists for.
  //
  // Wrapped in a SAVEPOINT, not a bare catch. A failed statement aborts the whole
  // transaction in Postgres, so swallowing the error would leave every following statement
  // failing with 25P02 — the promotion would be lost to the very code meant to record it.
  await db.query('SAVEPOINT camp_promote_audit');
  try {
    await db.query(
      `INSERT INTO audit_logs (
         user_id, action_type, resource_type, resource_name, resource_id,
         action_description, module, patient_id, status, metadata
       ) VALUES ($1, 'create', 'patient', 'patient', $2, $3, 'Camps', $4, 'success', $5)`,
      [
        actorId || null,
        String(created[0].id),
        `Patient created by promoting camp registration token ${reg.token_no}`,
        created[0].id,
        JSON.stringify({ registrationId, campId: reg.camp_id, dateOfBirthEstimated: estimated }),
      ]
    );
    await db.query('RELEASE SAVEPOINT camp_promote_audit');
  } catch (err) {
    await db.query('ROLLBACK TO SAVEPOINT camp_promote_audit');
    console.error('[camps] FAILED to audit registration promotion:', err.message);
  }

  return { patient: created[0], created: true, linked: false, dateOfBirthEstimated: estimated };
}

/**
 * Refuse any clinical station write for an attendee who has not consented.
 *
 * Checked here as well as at the route so the rule holds for every caller: under queue
 * pressure "we'll get the consent later" is exactly the shortcut that must not be
 * available.
 */
async function assertConsent(db, registration, station) {
  if (!station.is_clinical) return;
  if (!registration.consent_given_at) {
    throw campError(409, 'ConsentRequired',
      `Record consent for token ${registration.token_no} before any clinical station.`);
  }
}

/** Stock cost actually consumed by a camp, plus its budget — the camp's financial picture. */
async function costSummary(db, campId) {
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(a.qty_consumed * i.unit_cost), 0)::numeric(14,2) AS consumed_cost,
            COALESCE(SUM(a.qty_issued   * i.unit_cost), 0)::numeric(14,2) AS issued_cost,
            count(*)::int AS allocation_count
       FROM camp_inventory_allocations a
       JOIN inventory_items i ON i.id = a.item_id
      WHERE a.camp_id = $1`,
    [campId]
  );
  return rows[0];
}

module.exports = {
  CAMP_STATUSES,
  ALLOWED_TRANSITIONS,
  CAMP_ROLES,
  FUNDING_SOURCES,
  campError,
  getCamp,
  readinessFor,
  transition,
  allocateToken,
  staffingConflicts,
  rosteredCampWindows,
  matchCandidates,
  promoteRegistration,
  assertConsent,
  costSummary,
  splitName,
  nextMrn,
};
