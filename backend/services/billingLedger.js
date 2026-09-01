// Platform billing ledger — recording and reporting what tenants were invoiced and paid.
//
// Writes go through recordEvent, which is idempotent on Stripe's own object id: webhook
// deliveries retry, and two instances can process the same delivery, so double-counting
// revenue has to be impossible by construction rather than by care.

const pool = require('../db');

/** Normalise a plan price to a monthly figure so plans on different cycles can be summed. */
function monthlyValue(price, billingCycle) {
  const p = Number(price);
  if (!Number.isFinite(p)) return 0;
  switch (String(billingCycle || 'monthly').toLowerCase()) {
    case 'yearly':
    case 'annual':
    case 'annually': return p / 12;
    case 'quarterly': return p / 3;
    case 'weekly': return (p * 52) / 12;
    default: return p;
  }
}

/**
 * Append a billing event. Silently ignores a duplicate Stripe object id — that is the
 * point: a retried webhook must not book the same payment twice.
 */
async function recordEvent({
  tenantId = null, practiceId = null, eventType, stripeObjectId = null,
  stripeCustomerId = null, amountMinor = 0, currency = null, description = null,
  occurredAt = null, detail = null,
}) {
  try {
    await pool.query(
      `INSERT INTO control.billing_events
         (tenant_id, practice_id, event_type, stripe_object_id, stripe_customer_id,
          amount_minor, currency, description, occurred_at, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9, now()),$10)
       ON CONFLICT (stripe_object_id) DO NOTHING`,
      [tenantId, practiceId, eventType, stripeObjectId, stripeCustomerId,
       Math.round(Number(amountMinor) || 0), currency, description,
       occurredAt ? new Date(occurredAt * 1000) : null,
       detail ? JSON.stringify(detail) : null]
    );
  } catch (err) {
    // Never let bookkeeping break the webhook: Stripe would retry the whole delivery and
    // the caller has already done the important work (provisioning, status sync).
    console.error('[billingLedger] could not record event:', err.message);
  }
}

/** Find the tenant a Stripe customer belongs to, so an event can be attributed. */
async function tenantForCustomer(stripeCustomerId) {
  if (!stripeCustomerId) return {};
  const { rows } = await pool.query(
    'SELECT tenant_id, practice_id FROM control.subscriptions WHERE stripe_customer_id = $1 LIMIT 1',
    [stripeCustomerId]
  );
  return rows[0] || {};
}

/**
 * Platform-level billing summary.
 *
 * MRR is computed from the plans tenants are ON (recurring contracted value), while
 * collected revenue comes from the ledger (money actually received). They are deliberately
 * separate numbers: MRR is forward-looking and excludes discounts and failed payments,
 * collected is historical fact. Reporting one as the other is the usual way a SaaS
 * dashboard ends up lying.
 */
async function summary() {
  const { rows: subs } = await pool.query(
    `SELECT s.status, p.price, p.billing_cycle, p.currency
       FROM control.subscriptions s
       LEFT JOIN public.subscription_plans p ON p.id = s.plan_id
       JOIN control.tenants t ON t.id = s.tenant_id
      WHERE t.status = 'active'`
  );

  const byStatus = {};
  let mrr = 0;
  for (const r of subs) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    // Only statuses that are actually billing contribute to MRR. A trial pays nothing yet;
    // past_due and canceled are not reliable revenue.
    if (r.status === 'active') mrr += monthlyValue(r.price, r.billing_cycle);
  }

  const { rows: collected } = await pool.query(
    `SELECT to_char(date_trunc('month', occurred_at), 'YYYY-MM') AS month,
            currency,
            SUM(amount_minor)::bigint AS minor
       FROM control.billing_events
      WHERE occurred_at >= date_trunc('month', now()) - interval '11 months'
        -- Only rows that moved money. Failed payments and subscription changes are real
        -- ledger entries but carry no amount; including them produced a second, empty row
        -- per month in the collected table.
        AND amount_minor <> 0
        AND currency IS NOT NULL
      GROUP BY 1, 2
      ORDER BY 1`
  );

  const { rows: outstanding } = await pool.query(
    `SELECT count(*)::int AS failed_payments,
            COALESCE(SUM(amount_minor), 0)::bigint AS minor
       FROM control.billing_events
      WHERE event_type = 'invoice.payment_failed'
        AND occurred_at >= now() - interval '90 days'`
  );

  return {
    tenants: subs.length,
    byStatus,
    mrr: Number(mrr.toFixed(2)),
    arr: Number((mrr * 12).toFixed(2)),
    collectedByMonth: collected.map((r) => ({
      month: r.month, currency: r.currency, amount: Number(r.minor) / 100,
    })),
    failedPayments90d: {
      count: outstanding[0].failed_payments,
      amount: Number(outstanding[0].minor) / 100,
    },
  };
}

/** Ledger rows, newest first, optionally for one tenant. */
async function events({ tenantId = null, limit = 100, offset = 0 } = {}) {
  const { rows } = await pool.query(
    `SELECT b.id, b.tenant_id, t.slug AS tenant_slug, t.name AS tenant_name,
            b.event_type, b.amount_minor, b.currency, b.description, b.occurred_at,
            b.stripe_object_id
       FROM control.billing_events b
       LEFT JOIN control.tenants t ON t.id = b.tenant_id
      WHERE ($1::uuid IS NULL OR b.tenant_id = $1)
      ORDER BY b.occurred_at DESC, b.id DESC
      LIMIT $2 OFFSET $3`,
    [tenantId, Math.min(Number(limit) || 100, 500), Number(offset) || 0]
  );
  return rows.map((r) => ({ ...r, amount: Number(r.amount_minor) / 100 }));
}

/** Per-tenant revenue totals — the accounting view of who has paid what. */
async function perTenantTotals() {
  const { rows } = await pool.query(
    `SELECT t.id AS tenant_id, t.slug, t.name, t.status AS tenant_status,
            s.plan_name, s.status AS subscription_status, s.current_period_end,
            p.price, p.currency, p.billing_cycle,
            COALESCE(SUM(b.amount_minor) FILTER (WHERE b.amount_minor > 0), 0)::bigint AS collected_minor,
            COALESCE(SUM(b.amount_minor) FILTER (WHERE b.amount_minor < 0), 0)::bigint AS refunded_minor,
            MAX(b.occurred_at) FILTER (WHERE b.event_type = 'invoice.paid') AS last_payment_at
       FROM control.tenants t
       LEFT JOIN control.subscriptions s ON s.tenant_id = t.id
       LEFT JOIN public.subscription_plans p ON p.id = s.plan_id
       LEFT JOIN control.billing_events b ON b.tenant_id = t.id
      GROUP BY t.id, t.slug, t.name, t.status, s.plan_name, s.status, s.current_period_end,
               p.price, p.currency, p.billing_cycle
      ORDER BY t.created_at`
  );
  return rows.map((r) => ({
    ...r,
    collected: Number(r.collected_minor) / 100,
    // Positive magnitude: the column is headed "Refunded", so a negative there reads as a
    // double negative. The signed value stays in the ledger, where the arithmetic lives.
    refunded: Math.abs(Number(r.refunded_minor)) / 100,
    net: (Number(r.collected_minor) + Number(r.refunded_minor)) / 100,
    mrr: Number(monthlyValue(r.price, r.billing_cycle).toFixed(2)),
  }));
}

module.exports = { recordEvent, tenantForCustomer, summary, events, perTenantTotals, monthlyValue };
