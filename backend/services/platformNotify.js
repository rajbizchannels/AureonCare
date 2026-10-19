// Email alerts to platform operators.
//
// Routed by ROLE, not broadcast: a support engineer does not need every coupon change, and
// a finance contractor does not need break-glass alerts. The routing table below is the
// single place that decides who hears about what — adding an event means adding a row, and
// an unrouted action is deliberately silent rather than mailed to everyone.
//
// Never blocks the action it reports. A mail failure must not turn a successful tenant
// suspension into a 500, so every call is fire-and-forget with loud logging.

const { sendEmail, buildEmailHtml } = require('./notificationService');

// Global off switch. Set AC_PLATFORM_ALERTS=false to silence platform email entirely —
// useful in staging, where the same database may be restored from production.
const alertsEnabled = () =>
  String(process.env.AC_PLATFORM_ALERTS ?? 'true').toLowerCase() !== 'false';

/**
 * action -> who hears about it, how loudly, and what the subject says.
 *
 * `roles` are the roles notified. `alsoActor` sends to the person who did it as well —
 * true for security-relevant changes, where a mail the actor did not expect is exactly how
 * a compromised account is noticed, and false for routine work they just performed.
 */
const ROUTING = {
  // Security and access — everyone senior hears, including the actor.
  'operator.create': { roles: ['owner'], severity: 'critical', alsoActor: true,
    title: 'A platform operator was created' },
  'operator.update': { roles: ['owner'], severity: 'critical', alsoActor: true,
    title: 'A platform operator was changed' },
  'break_glass.start': { roles: ['owner', 'support'], severity: 'critical', alsoActor: true,
    title: 'Break-glass access opened over tenant data' },
  'break_glass.end': { roles: ['owner', 'support'], severity: 'info', alsoActor: false,
    title: 'Break-glass session ended' },

  // Tenant lifecycle.
  'tenant.create': { roles: ['owner', 'support'], severity: 'info', alsoActor: false,
    title: 'A tenant was created' },
  'tenant.self_serve_create': { roles: ['owner', 'billing', 'support'], severity: 'info', alsoActor: false,
    title: 'A customer signed up' },
  'tenant.suspend': { roles: ['owner', 'support', 'billing'], severity: 'warning', alsoActor: false,
    title: 'A tenant was suspended' },
  'tenant.resume': { roles: ['owner', 'support'], severity: 'info', alsoActor: false,
    title: 'A tenant was resumed' },

  // Money.
  'billing.adjustment.credit': { roles: ['owner', 'billing'], severity: 'warning', alsoActor: true,
    title: 'A billing credit was posted' },
  'billing.adjustment.debit': { roles: ['owner', 'billing'], severity: 'warning', alsoActor: true,
    title: 'A billing debit was posted' },
  'subscription.free_months': { roles: ['owner', 'billing'], severity: 'warning', alsoActor: true,
    title: 'Free months were granted' },
  'subscription.update': { roles: ['owner', 'billing'], severity: 'info', alsoActor: false,
    title: "A tenant's subscription changed" },
  'coupon.create': { roles: ['owner', 'billing'], severity: 'info', alsoActor: false,
    title: 'A coupon was created' },
  'coupon.deactivate': { roles: ['owner', 'billing'], severity: 'info', alsoActor: false,
    title: 'A coupon was deactivated' },

  // Payments, raised by the Stripe webhook rather than by an operator.
  'payment.failed': { roles: ['owner', 'billing'], severity: 'warning', alsoActor: false,
    title: 'A tenant payment failed' },
  'subscription.canceled': { roles: ['owner', 'billing'], severity: 'warning', alsoActor: false,
    title: 'A subscription was canceled' },
};

const COLOURS = { info: '#2563eb', warning: '#d97706', critical: '#dc2626' };

/** Operators who should receive this event, honouring their own opt-out. */
async function recipientsFor(pool, { roles, alsoActor }, actorId) {
  const { rows } = await pool.query(
    `SELECT id, email, name FROM control.operators
      WHERE status = 'active'
        AND notify_platform_events = true
        AND role = ANY($1)
        AND ($2::uuid IS NULL OR $3::boolean OR id <> $2)`,
    [roles, actorId || null, Boolean(alsoActor)]
  );
  return rows;
}

function renderRows(detail, tenantName, actorEmail, ip) {
  const rows = [];
  if (tenantName) rows.push(['Tenant', tenantName]);
  if (actorEmail) rows.push(['By', actorEmail]);
  if (ip) rows.push(['From', ip]);
  rows.push(['When', new Date().toISOString()]);
  if (detail && typeof detail === 'object') {
    for (const [k, v] of Object.entries(detail)) {
      if (v == null || v === '') continue;
      // Never put anything clinical in an email. Platform details are plan names, amounts
      // and reasons — but the guard is explicit so a future caller cannot widen it by
      // accident.
      if (/patient|dob|diagnos|mrn|ssn/i.test(k)) continue;
      rows.push([k, typeof v === 'object' ? JSON.stringify(v) : String(v)]);
    }
  }
  return rows;
}

/**
 * Send one platform alert.
 *
 * `dedupeKey` makes this safe to call from a webhook: the unique index means a retried
 * delivery records nothing and sends nothing the second time.
 */
async function notify(pool, { action, actorId = null, tenantId = null, detail = null, ip = null, dedupeKey = null }) {
  if (!alertsEnabled()) return { sent: 0, reason: 'alerts disabled' };
  const route = ROUTING[action];
  if (!route) return { sent: 0, reason: 'not routed' };

  try {
    const [ops, tenant, actor] = await Promise.all([
      recipientsFor(pool, route, actorId),
      tenantId
        ? pool.query('SELECT name, slug FROM control.tenants WHERE id = $1', [tenantId]).then((r) => r.rows[0])
        : null,
      actorId
        ? pool.query('SELECT email FROM control.operators WHERE id = $1', [actorId]).then((r) => r.rows[0])
        : null,
    ]);
    if (ops.length === 0) return { sent: 0, reason: 'no recipients' };

    const tenantName = tenant ? (tenant.name || tenant.slug) : null;
    const subject = `[AureonCare platform] ${route.title}${tenantName ? ` — ${tenantName}` : ''}`;
    const key = dedupeKey || `${action}:${tenantId || '-'}:${actorId || '-'}:${Date.now()}`;

    // Claim the send FIRST. If two instances process the same webhook, only one gets past
    // the unique index, so only one set of emails goes out.
    try {
      await pool.query(
        `INSERT INTO control.platform_notifications
           (dedupe_key, action, severity, subject, recipients, tenant_id, actor_id, detail)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [key, action, route.severity, subject, ops.map((o) => o.email),
         tenantId, actorId, detail ? JSON.stringify(detail) : null]
      );
    } catch (err) {
      if (err.code === '23505') return { sent: 0, reason: 'already notified' };
      throw err;
    }

    const html = buildEmailHtml(
      route.title,
      COLOURS[route.severity] || COLOURS.info,
      'Platform operator',
      route.severity === 'critical'
        ? 'This is a security-relevant change to the AureonCare platform. If you were not expecting it, investigate now.'
        : 'This is an automated notice from the AureonCare platform console.',
      renderRows(detail, tenantName, actor && actor.email, ip),
      null
    );

    // Sequential rather than Promise.all: the shared send quota is per recipient, and a
    // burst of parallel sends through one transporter is how a provider starts refusing.
    for (const op of ops) {
      await sendEmail(op.email, subject, html);
    }
    return { sent: ops.length, subject, recipients: ops.map((o) => o.email) };
  } catch (err) {
    console.error(`[platformNotify] ${action} alert failed:`, err.message);
    return { sent: 0, reason: err.message };
  }
}

/** Fire-and-forget wrapper: never let an alert delay or fail the action it reports. */
function notifyAsync(pool, opts) {
  Promise.resolve()
    .then(() => notify(pool, opts))
    .catch((err) => console.error('[platformNotify] unexpected failure:', err.message));
}

module.exports = { notify, notifyAsync, ROUTING, alertsEnabled };
