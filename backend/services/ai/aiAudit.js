// Audit + in-app notifications for the AI layer.
//
// Audit rows go to the tenant's append-only audit_logs (module 'AI'), next to every other
// action, so "who turned this on", "who sent what to which provider" and "who approved
// this draft" are answered from the same Audit Logs tab. Rows record identifiers, counts
// and hashes — never the prompt, the draft or an API key.

async function logAiAudit(req, {
  action,                // e.g. 'ai_feature_enabled', 'ai_generate', 'ai_review_accepted'
  resourceType,          // 'ai_feature' | 'ai_provider' | 'ai_request' | 'ai_suggestion'
  resourceId = null,
  resourceName = null,
  description = null,
  patientId = null,
  oldValues = null,
  newValues = null,
  status = 'success',
  errorMessage = null,
  metadata = {},
}) {
  const db = req.db || (req.app && req.app.locals && req.app.locals.pool);
  if (!db) return;
  const user = req.user || {};
  const changed = oldValues && newValues
    ? Object.keys(newValues).filter((k) => JSON.stringify(oldValues[k]) !== JSON.stringify(newValues[k]))
    : null;

  const insert = (pid) => db.query(
    `INSERT INTO audit_logs (
       user_id, user_email, user_name, user_role, ip_address, user_agent,
       action_type, resource_type, resource_name, resource_id, action_description,
       module, old_values, new_values, changed_fields, patient_id, status, error_message, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'AI',$12,$13,$14,$15,$16,$17,$18)`,
    [
      user.id || null,
      user.email || null,
      [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
      user.role || null,
      req.ip || null,
      req.headers?.['user-agent'] || null,
      action,
      resourceType,
      resourceName || resourceType,
      resourceId ? String(resourceId) : null,
      description,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      changed,
      pid,
      status,
      errorMessage,
      JSON.stringify(metadata || {}),
    ]
  );

  try {
    try {
      await insert(patientId || null);
    } catch (err) {
      // Unknown patient id must not make the audit write fail (same rule as phiAudit).
      if (patientId && err.code === '23503') await insert(null);
      else throw err;
    }
  } catch (err) {
    console.error(`[aiAudit] FAILED to record ${action}:`, err.message);
  }
}

/**
 * In-app notification to every user of this practice holding one of `roles`.
 * Best-effort: a notification failure never fails the AI action itself.
 */
async function notifyRoles(req, roles, type, message, { excludeUserId = null } = {}) {
  const db = req.db || (req.app && req.app.locals && req.app.locals.pool);
  const practiceId = (req.tenant && req.tenant.practiceId) || (req.user && req.user.practiceId) || null;
  if (!db || !roles || roles.length === 0) return 0;
  try {
    const params = [roles];
    let where = '(u.role = ANY($1) OR u.active_role = ANY($1))';
    if (practiceId) {
      params.push(practiceId);
      where += ` AND u.practice_id = $${params.length}`;
    }
    if (excludeUserId) {
      params.push(excludeUserId);
      where += ` AND u.id <> $${params.length}`;
    }
    const { rows } = await db.query(`SELECT u.id FROM public.users u WHERE ${where} LIMIT 200`, params);
    for (const r of rows) {
      await db.query(
        `INSERT INTO notifications (user_id, type, message, read, created_at) VALUES ($1, $2, $3, false, NOW())`,
        [r.id, type, message]
      );
    }
    return rows.length;
  } catch (err) {
    console.error('[aiAudit] notification failed:', err.message);
    return 0;
  }
}

async function notifyUser(req, userId, type, message) {
  const db = req.db || (req.app && req.app.locals && req.app.locals.pool);
  if (!db || !userId) return;
  try {
    await db.query(
      `INSERT INTO notifications (user_id, type, message, read, created_at) VALUES ($1, $2, $3, false, NOW())`,
      [userId, type, message]
    );
  } catch (err) {
    console.error('[aiAudit] notification failed:', err.message);
  }
}

module.exports = { logAiAudit, notifyRoles, notifyUser };
