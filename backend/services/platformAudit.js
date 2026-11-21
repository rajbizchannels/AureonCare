// SEC-05 Model D — Step S10: platform audit trail helper.
//
// Appends to control.audit_log (append-only; the DB trigger blocks UPDATE/DELETE).
// Best-effort by design: an audit write must never break the action it records, but a
// failure is logged loudly so it is noticed.

async function logPlatformAction(pool, entry) {
  const {
    operatorId = null, action, targetType = null, targetId = null, tenantId = null,
    detail = null, ip = null, actorType = null, actorLabel = null,
  } = entry;

  // Not every audited action is performed by an operator: a practice admin changing their
  // own plan, and the Stripe webhook, both belong in this trail but cannot be written to
  // operator_id, which is a foreign key into control.operators. Before migration 086 there
  // was nowhere to put them, so those actions were simply not recorded. Default to
  // 'operator' when there IS an operator so existing callers need no change.
  const who = actorType || (operatorId ? 'operator' : 'system');

  // Every privileged action already passes through here, so this is the one place that has
  // to know about alerting. Fire-and-forget: an alert must never delay or fail the action
  // it reports, and routing decides whether this particular action is worth an email at
  // all — an unrouted action is silent.
  try {
    require('./platformNotify').notifyAsync(pool, { action, actorId: operatorId, tenantId, detail, ip });
  } catch (err) {
    console.error('[platformAudit] could not raise alert:', err.message);
  }

  try {
    await pool.query(
      `INSERT INTO control.audit_log
         (operator_id, action, target_type, target_id, tenant_id, detail, ip_address,
          actor_type, actor_label)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [operatorId, action, targetType, targetId, tenantId,
       detail ? JSON.stringify(detail) : null, ip, who, actorLabel]
    );
  } catch (err) {
    console.error(`[platformAudit] FAILED to record ${action}:`, err.message);
  }
}

module.exports = { logPlatformAction };
