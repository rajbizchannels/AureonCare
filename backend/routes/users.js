const express = require('express');
const lockout = require('../services/loginLockout');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getTimezoneFromCountry } = require('../utils/timezoneUtils');
const { enforceUserQuota, enforceProviderQuota } = require('../middleware/planEnforcement');
const { BCRYPT_COST, checkNewPassword } = require('../utils/passwordPolicy');
const { sendDbError } = require('../utils/dbErrors');

// SEC-05: true only when the target row belongs to the caller's practice. A caller with
// no practice context never matches, so these checks fail CLOSED. Replaces an earlier
// sentinel-string comparison (which also introduced a stray null byte into this file).
const samePractice = (rowPracticeId, callerPracticeId) =>
  Boolean(callerPracticeId) && String(rowPracticeId || '') === String(callerPracticeId);

// Phase 1: a person can belong to several practices (public.memberships). "In the caller's
// practice" means an ACTIVE membership there — not the account's default practice.
async function memberOf(pool, userId, practiceId) {
  if (!practiceId) return null;
  const { rows } = await pool.query(
    `SELECT role FROM public.memberships WHERE user_id::text = $1::text AND practice_id = $2 AND status = 'active'`,
    [userId, practiceId]);
  return rows[0] || null;
}
/** How many OTHER practices the person is an active member of. */
async function otherPractices(pool, userId, practiceId) {
  const { rows: [{ n }] } = await pool.query(
    `SELECT count(*)::int AS n FROM public.memberships WHERE user_id::text = $1::text AND practice_id <> $2 AND status = 'active'`,
    [userId, practiceId]);
  return n;
}

// All user routes require a valid JWT
router.use(authenticate);

// Reusable guard: passes if caller is admin OR is acting on their own record
const isSelfOrAdmin = (req, res, next) => {
  if (req.user.role === 'admin' || String(req.user.id) === String(req.params.id)) {
    return next();
  }
  return res.status(403).json({ error: 'Access denied' });
};

// Helper function to convert snake_case to camelCase
const toCamelCase = (obj) => {
  const newObj = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    let value = obj[key];

    // Parse JSON fields if they're strings
    if (camelKey === 'preferences' && typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch (e) {
        // If parsing fails, keep as string
      }
    }

    newObj[camelKey] = value;
  }
  return newObj;
};

// Get all users — admin only
router.get('/', authorize('admin'), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    // SEC-05: staff are isolated to their practice. users lives in public (identity
    // plane), so search_path can't scope it — filter explicitly by the caller's
    // practice. (A caller with no practice context sees an empty list, not everyone.)
    // Phase 1: everyone with a membership in this practice, with their role HERE.
    const result = await pool.query(`
      SELECT u.*, m.role AS role, (u.practice_id IS DISTINCT FROM m.practice_id) AS default_elsewhere,
             (SELECT count(*)::int FROM public.memberships o
               WHERE o.user_id = u.id AND o.practice_id <> m.practice_id AND o.status = 'active') AS other_practices
      FROM users u
      JOIN public.memberships m ON m.user_id = u.id AND m.practice_id = $1 AND m.status = 'active'
      ORDER BY u.id ASC
    `, [req.user.practiceId || null]);
    // Locked out after repeated wrong passwords? (services/loginLockout.js)
    const locked = await lockout.lockedAmong(pool, 'staff', result.rows.map((r) => r.email));
    const users = result.rows.map((r) => ({ ...toCamelCase(r), locked: locked.has(String(r.email || '').toLowerCase()) }));
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Unlock a sign-in locked by repeated wrong passwords — admins, for people in their practice.
router.post('/:id/unlock', authorize('admin'), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { rows: [u] } = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name FROM users u
         JOIN public.memberships m ON m.user_id = u.id AND m.practice_id = $2 AND m.status = 'active'
        WHERE u.id::text = $1`, [req.params.id, req.user.practiceId || null]);
    if (!u) return res.status(404).json({ error: 'User not found' });
    const wasLocked = await lockout.clear(pool, 'staff', u.email);
    console.log(`[lockout] staff sign-in unlocked by admin ${req.user.id} for user ${u.id}`);
    res.json({ unlocked: true, wasLocked, message: `${u.first_name || 'The user'} ${u.last_name || ''} can sign in again.`.replace(/\s+/g, ' ').trim() });
  } catch (error) {
    console.error('Error unlocking user:', error);
    res.status(500).json({ error: 'Could not unlock the account' });
  }
});

// Get single user — admin or own user
router.get('/:id', isSelfOrAdmin, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    // SEC-05: allow viewing self always; otherwise only users in the caller's practice.
    const result = await pool.query(
      `SELECT u.*, COALESCE(m.role, u.role) AS role
       FROM users u
       LEFT JOIN public.memberships m ON m.user_id = u.id AND m.practice_id = $3 AND m.status = 'active'
       WHERE u.id::text = $1::text
         AND (u.id::text = $2::text OR m.user_id IS NOT NULL)`,
      [req.params.id, req.user.id, req.user.practiceId || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});


// Personal NPI and DEA number (US clinicians). '' clears a value; anything else must be valid.
const { isValidDea } = require('../utils/practiceRegion');
const { isValidNpi } = require('../services/eligibility/medicalNetwork');
function clinicianIds(body = {}) {
  const out = {};
  const npi = body.npi !== undefined ? body.npi : body.NPI;
  const dea = body.dea_number !== undefined ? body.dea_number : body.deaNumber;
  if (npi !== undefined) {
    const v = String(npi || '').trim();
    if (v && !isValidNpi(v)) return { error: 'That is not a valid NPI — 10 digits with a check digit.' };
    out.npi = v || null;
  }
  if (dea !== undefined) {
    const v = String(dea || '').trim().toUpperCase();
    if (v && !isValidDea(v)) return { error: 'That is not a valid DEA number — 2 letters and 7 digits with a check digit.' };
    out.dea = v || null;
  }
  return out;
}
async function saveClinicianIds(pool, userId, ids) {
  if (!('npi' in ids) && !('dea' in ids)) return null;
  const { rows: [u] } = await pool.query(
    `UPDATE users SET npi = CASE WHEN $2 THEN $3 ELSE npi END,
                      dea_number = CASE WHEN $4 THEN $5 ELSE dea_number END, updated_at = NOW()
      WHERE id::text = $1::text RETURNING *`,
    [userId, 'npi' in ids, ids.npi ?? null, 'dea' in ids, ids.dea ?? null]);
  return u;
}

// Create new user — admin only (quota + provider-seat checks run after)
router.post('/', authorize('admin'), enforceUserQuota, enforceProviderQuota, async (req, res) => {
  const { firstName, lastName, first_name, last_name, role, practice, avatar, email, phone, license, specialty, preferences, status, password } = req.body;

  try {
    const pool = req.app.locals.pool;
    const bcrypt = require('bcryptjs');
    const ids = clinicianIds(req.body);
    if (ids.error) return res.status(400).json({ error: ids.error });

    // SEC-05: table/column creation moved to migrations (see migrations/tenant/001 and 072).

    // Accept both camelCase and snake_case
    const finalFirstName = first_name || firstName || '';
    const finalLastName = last_name || lastName || '';

    // Hash password if provided
    let passwordHash = null;
    if (password) {
      // SEC-12: enforce policy + hash at the shared cost factor
      const pwCheck = await checkNewPassword(password);
      if (!pwCheck.valid) {
        return res.status(400).json({ error: pwCheck.message });
      }
      passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    }

    // Explicitly generate UUID for id
    // SEC-05: new staff belong to the creating admin's practice.
    const result = await pool.query(
      `INSERT INTO users (id, first_name, last_name, role, avatar, email, phone, license_number, specialty, preferences, status, password_hash, practice_id, created_at)
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
       RETURNING *`,
      [
        finalFirstName,
        finalLastName,
        role || 'patient',
        avatar,
        email,
        phone,
        license,
        specialty,
        JSON.stringify(preferences || {}),
        status || 'active',
        passwordHash,
        req.user.practiceId || null
      ]
    );

    let newUser = result.rows[0];
    newUser = (await saveClinicianIds(pool, newUser.id, ids)) || newUser;

    // Auto-create ancillary role records — non-fatal so the user creation
    // response always succeeds even if these steps fail.

    if (newUser.role === 'doctor' && newUser.email) {
      // Create providers record with id = user.id (migration 025 schema)
      try {
        const providerCheck = await pool.query(
          'SELECT id FROM providers WHERE id = $1 OR email = $2 LIMIT 1',
          [newUser.id, newUser.email]
        );
        if (providerCheck.rows.length === 0) {
          await pool.query(
            `INSERT INTO providers (id, first_name, last_name, specialization, email, phone, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
            [newUser.id, newUser.first_name, newUser.last_name, newUser.specialty || 'General Practice', newUser.email, newUser.phone]
          );
        }
      } catch (providerErr) {
        console.error('Non-fatal: failed to auto-create provider record for new doctor user:', providerErr.message);
      }

      try {
        const doctorRoleResult = await pool.query(
          "SELECT id FROM roles WHERE name = 'doctor' AND is_active = true LIMIT 1"
        );
        if (doctorRoleResult.rows.length > 0) {
          await pool.query(
            `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [newUser.id, doctorRoleResult.rows[0].id]
          );
        }
      } catch (roleErr) {
        console.error('Non-fatal: failed to assign doctor role for new user:', roleErr.message);
      }
    }

    if ((newUser.role || 'patient') === 'patient' && newUser.email) {
      // Create patients record with id = user.id (migration 023 schema)
      try {
        const patientCheck = await pool.query(
          'SELECT id FROM patients WHERE id = $1 OR email = $2 LIMIT 1',
          [newUser.id, newUser.email]
        );

        if (patientCheck.rows.length === 0) {
          const mrnResult = await pool.query(
            "SELECT MAX(CAST(SUBSTRING(mrn FROM 5) AS INTEGER)) as max_mrn FROM patients WHERE mrn LIKE 'MRN-%'"
          );
          const nextMrnNumber = (mrnResult.rows[0].max_mrn || 1000) + 1;
          const mrn = `MRN-${nextMrnNumber}`;

          await pool.query(
            `INSERT INTO patients (id, first_name, last_name, mrn, date_of_birth, email, phone, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, '1990-01-01', $5, $6, 'active', NOW(), NOW())`,
            [newUser.id, newUser.first_name, newUser.last_name, mrn, newUser.email, newUser.phone]
          );
        }
      } catch (patientErr) {
        console.error('Non-fatal: failed to auto-create patient record for new user:', patientErr.message);
      }

      try {
        const patientRoleResult = await pool.query(
          "SELECT id FROM roles WHERE name = 'patient' AND is_active = true LIMIT 1"
        );
        if (patientRoleResult.rows.length > 0) {
          await pool.query(
            `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [newUser.id, patientRoleResult.rows[0].id]
          );
        }
      } catch (roleErr) {
        console.error('Non-fatal: failed to assign patient role for new user:', roleErr.message);
      }
    }

    res.status(201).json(toCamelCase(newUser));
  } catch (error) {
    console.error('Error creating user:', error);

    // Handle duplicate email error
    if (error.code === '23505' && error.constraint === 'users_email_key') {
      return res.status(409).json({
        error: 'Email already exists',
        message: 'A user with this email address already exists. Please use a different email.'
      });
    }

    // Handle other constraint violations
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Duplicate entry',
        message: 'This user information conflicts with an existing user.'
      });
    }

    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to create user')) return;
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user — admin or own user
router.put('/:id', isSelfOrAdmin, async (req, res) => {
  const { firstName, lastName, first_name, last_name, role, avatar, email, phone, address, practice, license, specialty, preferences, status, language, country, password } = req.body;

  try {
    const pool = req.app.locals.pool;
    const bcrypt = require('bcryptjs');

    // SEC-01: privilege fields (role, status) may only be changed by an admin.
    // A non-admin editing their own record (isSelfOrAdmin) must not be able to
    // escalate to 'admin' or flip account status — silently ignore those fields.
    const isAdmin = req.user.role === 'admin';
    const safeRole = isAdmin ? role : undefined;
    const safeStatus = isAdmin ? status : undefined;
    if (!isAdmin && (role !== undefined || status !== undefined)) {
      console.log(`[DEBUG sec01-rbac] non-admin user ${req.user.id} attempted role/status change on ${req.params.id} (role=${role}, status=${status}) — ignored`);
    }

    // Accept both camelCase and snake_case
    const finalFirstName = first_name || firstName;
    const finalLastName = last_name || lastName;

    // Calculate timezone from country if country is provided
    let timezone = null;
    if (country) {
      timezone = getTimezoneFromCountry(country);
    }

    // Hash password if provided
    let passwordHash = null;
    if (password) {
      // SEC-12: enforce policy + hash at the shared cost factor
      const pwCheck = await checkNewPassword(password);
      if (!pwCheck.valid) {
        return res.status(400).json({ error: pwCheck.message });
      }
      passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    }

    // Get current user data to check for role changes
    const currentUserResult = await pool.query(
      'SELECT * FROM users WHERE id::text = $1::text',
      [req.params.id]
    );

    if (currentUserResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentUser = currentUserResult.rows[0];
    const isSelf = String(currentUser.id) === String(req.user.id);
    // SEC-05 / Phase 1: may only modify self or a member of the caller's practice.
    const membership = isSelf ? null : await memberOf(pool, currentUser.id, req.user.practiceId);
    if (!isSelf && !membership) {
      return res.status(404).json({ error: 'User not found' });
    }
    // Phase 1: an admin manages the person's role IN THIS PRACTICE. Account details (name,
    // email, password, phone, status…) belong to the person once they also work at another
    // practice — otherwise this practice's admin could reset their password and take over
    // their access elsewhere. Those fields are ignored, and the answer says so.
    const sharedAccount = !isSelf && (await otherPractices(pool, currentUser.id, req.user.practiceId)) > 0;
    const oldRole = membership ? membership.role : currentUser.role;
    const newRole = safeRole || oldRole;
    if (sharedAccount) {
      if (safeRole && safeRole !== oldRole) {
        await pool.query(
          `UPDATE public.memberships SET role = $3, updated_at = now() WHERE user_id = $1 AND practice_id = $2`,
          [currentUser.id, req.user.practiceId, safeRole]);
        // Keep the default-practice mirror in step only when this IS their default.
        if (String(currentUser.practice_id) === String(req.user.practiceId)) {
          await pool.query('UPDATE users SET role = $2, updated_at = NOW() WHERE id = $1', [currentUser.id, safeRole]);
        }
      }
      const { rows: [fresh] } = await pool.query('SELECT * FROM users WHERE id = $1', [currentUser.id]);
      return res.json({ ...toCamelCase(fresh), role: newRole, accountFieldsIgnored: true,
        message: 'This person also works at another practice, so only their role here was changed. They manage their own account details.' });
    }
    // Their default practice is another one only when they are shared (handled above);
    // for a single-practice member, role on the account and the membership are the same.

    const ids = clinicianIds(req.body);
    if (ids.error) return res.status(400).json({ error: ids.error });

    const result = await pool.query(
      `UPDATE users
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           role = COALESCE($3, role),
           avatar = COALESCE($4, avatar),
           email = COALESCE($5, email),
           phone = COALESCE($6, phone),
           license_number = COALESCE($7, license_number),
           specialty = COALESCE($8, specialty),
           preferences = CASE WHEN $9::jsonb IS NOT NULL
                              THEN preferences || $9::jsonb
                              ELSE preferences END,
           status = COALESCE($10, status),
           language = COALESCE($11, language),
           country = COALESCE($12, country),
           timezone = COALESCE($13, timezone),
           password_hash = COALESCE($14, password_hash),
           updated_at = NOW()
       WHERE id::text = $15::text
       RETURNING *`,
      [
        finalFirstName,
        finalLastName,
        safeRole,
        avatar,
        email,
        phone,
        license,
        specialty,
        preferences ? JSON.stringify(preferences) : null,
        safeStatus,
        language,
        country,
        timezone,
        passwordHash,
        req.params.id,
      ]
    );

    let updatedUser = result.rows[0];

    // Handle role-based table synchronization
    if (oldRole !== newRole) {
      // If new role is doctor, ensure a providers record exists with id = user.id
      if (newRole === 'doctor') {
        const providerCheck = await pool.query(
          'SELECT id FROM providers WHERE id = $1 OR email = $2 LIMIT 1',
          [updatedUser.id, updatedUser.email]
        );

        if (providerCheck.rows.length === 0) {
          // providers.id = users.id (migration 025 schema)
          await pool.query(
            `INSERT INTO providers (id, first_name, last_name, specialization, email, phone, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
            [
              updatedUser.id,
              updatedUser.first_name,
              updatedUser.last_name,
              updatedUser.specialty || 'General Practice',
              updatedUser.email,
              updatedUser.phone
            ]
          );
        }

        // NOTE: We do NOT remove from patients table — a user can be both a doctor
        // and a patient; medical records and FK integrity must be preserved.
      }
      // If new role is patient, ensure a patients record exists with id = user.id
      else if (newRole === 'patient') {
        const patientCheck = await pool.query(
          'SELECT id FROM patients WHERE id = $1 OR email = $2 LIMIT 1',
          [updatedUser.id, updatedUser.email]
        );

        if (patientCheck.rows.length === 0) {
          const mrnResult = await pool.query(
            "SELECT MAX(CAST(SUBSTRING(mrn FROM 5) AS INTEGER)) as max_mrn FROM patients WHERE mrn LIKE 'MRN-%'"
          );
          const nextMrnNumber = (mrnResult.rows[0].max_mrn || 1000) + 1;
          const mrn = `MRN-${nextMrnNumber}`;

          // patients.id = users.id (migration 023 schema)
          await pool.query(
            `INSERT INTO patients (id, first_name, last_name, mrn, date_of_birth, email, phone, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW(), NOW())`,
            [
              updatedUser.id,
              updatedUser.first_name,
              updatedUser.last_name,
              mrn,
              updatedUser.dob || updatedUser.date_of_birth || '1990-01-01',
              updatedUser.email,
              updatedUser.phone
            ]
          );
        }

        // NOTE: We do NOT remove from providers table — historical appointment data
        // and FK integrity must be preserved.
      }
    }

    updatedUser = (await saveClinicianIds(pool, updatedUser.id, ids)) || updatedUser;
    res.json(toCamelCase(updatedUser));
  } catch (error) {
    console.error('Error updating user:', error);

    // Handle duplicate email error
    if (error.code === '23505' && error.constraint === 'users_email_key') {
      return res.status(409).json({
        error: 'Email already exists',
        message: 'A user with this email address already exists. Please use a different email.'
      });
    }

    // Handle other constraint violations
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Duplicate entry',
        message: 'This user information conflicts with an existing user.'
      });
    }

    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to update user')) return;
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user — admin only
router.delete('/:id', authorize('admin'), async (req, res) => {
  const pool = req.app.locals.pool;
  // SEC-05: patient_portal_sessions moved into the tenant schema at the 068 cutover, so a
  // raw pooled client — whose search_path is the default — cannot see it and every deletion
  // failed with `relation "patient_portal_sessions" does not exist`, reported as a flat 500.
  // req.db is the caller's tenant-scoped handle; public tables still resolve through it.
  const db = req.db;
  if (!db) {
    return res.status(409).json({
      error: 'This account is not linked to an active tenant workspace, so user records '
        + 'cannot be changed. See GET /api/auth/tenant-status.',
    });
  }
  try {
    const userId = req.params.id;

    // Phase 1: someone who also works at another practice is REMOVED from this practice —
    // their account, and their access elsewhere, are not this practice's to delete.
    if (await memberOf(pool, userId, req.user.practiceId) && (await otherPractices(pool, userId, req.user.practiceId)) > 0) {
      if (String(userId) === String(req.user.id)) {
        return res.status(400).json({ error: 'You cannot remove yourself from the practice here.' });
      }
      await pool.query('DELETE FROM public.memberships WHERE user_id::text = $1::text AND practice_id = $2', [userId, req.user.practiceId]);
      // If this was their default practice, start their next sign-in in one they still have.
      const { rows: [next] } = await pool.query(
        `SELECT practice_id, role FROM public.memberships WHERE user_id::text = $1::text AND status = 'active'
          ORDER BY last_used_at DESC NULLS LAST, created_at ASC LIMIT 1`, [userId]);
      await pool.query(
        `UPDATE users SET practice_id = $2, role = $3, updated_at = NOW() WHERE id::text = $1::text AND practice_id = $4`,
        [userId, next.practice_id, next.role, req.user.practiceId]);
      return res.json({ message: 'Removed from this practice. Their account and their other practices are unchanged.', removedFromPractice: true });
    }

    await db.query('BEGIN');

    // These two are housekeeping, not the deletion itself, and the tables they touch have
    // moved between `public` and the tenant schema across the SEC-05 cutover — so on some
    // deployments one of them is not visible from this connection at all. A missing table
    // has no rows to orphan, so it must not be able to block the deletion; anything other
    // than "relation does not exist" still aborts, because that would mean rows we failed
    // to clean up. Each runs in a savepoint so a skip does not poison the transaction.
    const skippedCleanups = [];
    const cleanup = async (label, sql) => {
      await db.query('SAVEPOINT cleanup');
      try {
        await db.query(sql, [userId]);
        await db.query('RELEASE SAVEPOINT cleanup');
      } catch (err) {
        await db.query('ROLLBACK TO SAVEPOINT cleanup');
        if (err.code !== '42P01') throw err;
        console.warn(`[users] skipping ${label} cleanup — table not visible from this schema`);
        skippedCleanups.push(label);
      }
    };

    // social_auth has no FK to users, so it does not cascade on user deletion.
    // Explicitly remove the account's linked social identities (rows carry the
    // user id in BOTH user_id and patient_id) so no orphaned link survives — an
    // orphan would also keep the UNIQUE(provider, provider_user_id) slot occupied
    // and block that identity from linking to a new account later.
    await cleanup('social_auth',
      'DELETE FROM social_auth WHERE user_id::text = $1::text OR patient_id::text = $1::text');

    // Portal sessions are keyed by patient_id (= user id) and likewise do not
    // cascade; drop them so a deleted account leaves no usable session behind.
    await cleanup('patient_portal_sessions',
      'DELETE FROM patient_portal_sessions WHERE patient_id::text = $1::text');

    // SEC-05: only delete a user in the caller's practice. A cross-practice id
    // matches 0 rows -> rollback (undoing the cascade deletes above) -> 404.
    const result = await db.query(
      `DELETE FROM users WHERE id::text = $1::text
         AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = users.id AND m.practice_id = $2 AND m.status = 'active')
       RETURNING *`,
      [userId, req.user.practiceId || null]
    );

    if (result.rows.length === 0) {
      await db.query('ROLLBACK');
      // 0 rows has two quite different causes and they need different fixes: no such user,
      // or a user who exists but is not in the caller's practice — including one with no
      // practice at all, since `practice_id = $2` never matches NULL. Saying only "not
      // found" for the second sends an admin looking for a record that is right there.
      const exists = await pool.query(
        'SELECT practice_id FROM users WHERE id::text = $1::text', [userId]
      );
      if (exists.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.status(404).json({
        error: exists.rows[0].practice_id
          ? 'That user belongs to a different practice.'
          : 'That account is not linked to any practice, so it cannot be deleted from here.',
      });
    }

    await db.query('COMMIT');
    res.json({
      message: 'User deleted successfully',
      skippedCleanups: skippedCleanups.length ? skippedCleanups : undefined,
    });
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    console.error('Error deleting user:', error);
    // A foreign key violation means something still points at this account. Naming the
    // table turns an unactionable 500 into a specific thing to go and clear.
    if (error.code === '23503') {
      return res.status(409).json({
        error: 'That user cannot be deleted while other records still refer to them'
          + (error.table ? ` (${error.table})` : '')
          + '. Reassign or remove those first.',
        constraint: error.constraint || undefined,
      });
    }
    // Everything else has been answered with a bare "Failed to delete user", which is the
    // same string for a missing relation, a broken constraint and a dead connection. The
    // admin who sees it cannot act on it and nobody without server log access can diagnose
    // it. Carry the database's own code and message — this route is admin-only, and the
    // text is schema detail, never patient data.
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to delete user')) return;
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Update user language preference — admin or own user
router.put('/:id/language', isSelfOrAdmin, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { language } = req.body;

    if (!language) {
      return res.status(400).json({ error: 'Language is required' });
    }

    // The languages the app is translated into (frontend/src/config/translations.js).
    const supportedLanguages = ['en', 'es', 'fr', 'de', 'ar'];
    if (!supportedLanguages.includes(language)) {
      return res.status(400).json({
        error: 'Unsupported language',
        supported: supportedLanguages
      });
    }

    const result = await pool.query(
      `UPDATE users
       SET language = $1, updated_at = NOW()
       WHERE id::text = $2::text
       RETURNING *`,
      [language, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error updating language:', error);
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to update language')) return;
    res.status(500).json({ error: 'Failed to update language' });
  }
});

// Switch active role — own user only
router.put('/:id/switch-role', isSelfOrAdmin, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role_name } = req.body;

    if (!role_name) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    // Check if user has this role
    const roleCheck = await pool.query(`
      SELECT r.id, r.name, r.display_name
      FROM roles r
      JOIN user_roles ur ON r.id = ur.role_id
      WHERE ur.user_id::text = $1::text AND r.name = $2
    `, [req.params.id, role_name]);

    if (roleCheck.rows.length === 0) {
      return res.status(403).json({
        error: 'User does not have this role',
        requested_role: role_name
      });
    }

    // Update active role — SEC-05: only self or a user in the caller's practice.
    if (String(req.params.id) !== String(req.user.id) && !(await memberOf(pool, req.params.id, req.user.practiceId))) {
      return res.status(404).json({ error: 'User not found' });
    }
    const result = await pool.query(
      `UPDATE users
       SET active_role = $1, role = CASE WHEN practice_id IS NOT DISTINCT FROM $3 THEN $1 ELSE role END, updated_at = NOW()
       WHERE id::text = $2::text
       RETURNING *`,
      [role_name, req.params.id, req.user.practiceId || null]
    );
    // Phase 1: the role applies to the practice the session is working in.
    if (req.user.practiceId) {
      await pool.query(`UPDATE public.memberships SET role = $3, updated_at = now() WHERE user_id::text = $1::text AND practice_id = $2`,
        [req.params.id, req.user.practiceId, role_name]);
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Role switched successfully',
      user: toCamelCase(result.rows[0]),
      new_role: roleCheck.rows[0]
    });
  } catch (error) {
    console.error('Error switching role:', error);
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to switch role')) return;
    res.status(500).json({ error: 'Failed to switch role' });
  }
});

// Get user's roles — admin or own user
router.get('/:id/roles', isSelfOrAdmin, async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(`
      SELECT r.id, r.name, r.display_name, r.description,
             ur.assigned_at,
             CASE WHEN u.active_role = r.name THEN true ELSE false END as is_active
      FROM roles r
      JOIN user_roles ur ON r.id = ur.role_id
      JOIN users u ON ur.user_id = u.id
      WHERE ur.user_id::text = $1::text
      ORDER BY is_active DESC, r.display_name
    `, [req.params.id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user roles:', error);
    res.status(500).json({ error: 'Failed to fetch user roles' });
  }
});

// Assign role to user — admin only
router.post('/:id/roles', authorize('admin'), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role_id, assigned_by } = req.body;

    if (!role_id) {
      return res.status(400).json({ error: 'Role ID is required' });
    }

    // SEC-05: the target user must belong to the caller's practice.
    if (!(await memberOf(pool, req.params.id, req.user.practiceId))) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if role exists
    const roleCheck = await pool.query(
      'SELECT * FROM roles WHERE id = $1 AND is_active = true',
      [role_id]
    );

    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const role = roleCheck.rows[0];

    // Check if already assigned
    const existingCheck = await pool.query(
      'SELECT * FROM user_roles WHERE user_id::text = $1::text AND role_id = $2',
      [req.params.id, role_id]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Role already assigned to user' });
    }

    // Assign role
    await pool.query(
      `INSERT INTO user_roles (user_id, role_id, assigned_by)
       VALUES ($1, $2, $3)`,
      [req.params.id, role_id, assigned_by || null]
    );

    // If this is the first role or user doesn't have an active role, set it as active
    const userCheck = await pool.query(
      'SELECT active_role FROM users WHERE id::text = $1::text',
      [req.params.id]
    );

    if (userCheck.rows.length > 0 && !userCheck.rows[0].active_role) {
      await pool.query(
        'UPDATE users SET active_role = $1, role = $1 WHERE id::text = $2::text',
        [role.name, req.params.id]
      );
    }

    res.json({
      message: 'Role assigned successfully',
      role: role
    });
  } catch (error) {
    console.error('Error assigning role:', error);
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to assign role')) return;
    res.status(500).json({ error: 'Failed to assign role' });
  }
});

// Remove role from user — admin only
router.delete('/:id/roles/:role_id', authorize('admin'), async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    // SEC-05: the target user must belong to the caller's practice.
    if (!(await memberOf(pool, req.params.id, req.user.practiceId))) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has other roles
    const rolesCheck = await pool.query(
      'SELECT COUNT(*) as count FROM user_roles WHERE user_id::text = $1::text',
      [req.params.id]
    );

    if (parseInt(rolesCheck.rows[0].count) <= 1) {
      return res.status(400).json({ error: 'Cannot remove last role from user' });
    }

    // Remove role
    const result = await pool.query(
      'DELETE FROM user_roles WHERE user_id::text = $1::text AND role_id = $2 RETURNING *',
      [req.params.id, req.params.role_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Role assignment not found' });
    }

    // If removed role was active, switch to another role
    const userCheck = await pool.query(
      'SELECT active_role FROM users WHERE id::text = $1::text',
      [req.params.id]
    );

    const roleCheck = await pool.query(
      'SELECT name FROM roles WHERE id = $1',
      [req.params.role_id]
    );

    if (userCheck.rows.length > 0 && roleCheck.rows.length > 0 &&
        userCheck.rows[0].active_role === roleCheck.rows[0].name) {
      // Get first remaining role
      const newRole = await pool.query(`
        SELECT r.name
        FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id::text = $1::text
        LIMIT 1
      `, [req.params.id]);

      if (newRole.rows.length > 0) {
        await pool.query(
          'UPDATE users SET active_role = $1, role = $1 WHERE id::text = $2::text',
          [newRole.rows[0].name, req.params.id]
        );
      }
    }

    res.json({ message: 'Role removed successfully' });
  } catch (error) {
    console.error('Error removing role:', error);
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to remove role')) return;
    res.status(500).json({ error: 'Failed to remove role' });
  }
});

module.exports = router;
