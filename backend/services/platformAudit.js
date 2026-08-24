// SEC-05 Model D — Step S10: platform audit trail helper.
//
// Appends to control.audit_log (append-only; the DB trigger blocks UPDATE/DELETE).
// Best-effort by design: an audit write must never break the action it records, but a
// failure is logged loudly so it is noticed.

async function logPlatformAction(pool, entry) {
  const { operatorId = null, action, targetType = null, targetId = null, tenantId = null, detail = null, ip = null } = entry;
  try {
    await pool.query(
      `INSERT INTO control.audit_log (operator_id, action, target_type, target_id, tenant_id, detail, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [operatorId, action, targetType, targetId, tenantId, detail ? JSON.stringify(detail) : null, ip]
    );
  } catch (err) {
    console.error(`[platformAudit] FAILED to record ${action}:`, err.message);
  }
}

module.exports = { logPlatformAction };
