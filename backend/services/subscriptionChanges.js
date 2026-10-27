// Everything that must happen when a subscription changes, in ONE place.
//
// A subscription can be changed from two directions: a practice admin moving their own
// plan (PUT /api/plans/current) and an operator moving it for them
// (PUT /api/platform/tenants/:id/subscription). Those two routes had grown different
// answers to the same three questions, and the tenant-facing one answered none of them:
// it pushed the change to Stripe and updated the row, leaving no audit entry in the
// platform console and no accounting entry anywhere. A practice could move between tiers
// and the only evidence was plan_id having silently changed value.
//
// So the rules live here rather than in either route:
//
//   AUDIT      every change writes control.audit_log, naming who did it — operator or
//              tenant user — and what it moved FROM as well as to. "plan_id: 5" is not an
//              audit record; "Essentials -> Clinical Pro, by admin@clinic.example" is.
//
//   ACCOUNTING every change that moves money writes control.billing_events, dated at the
//              proration date rather than at the moment the row was written, so the books
//              show the change on the day it took effect.
//
//   PRORATION  the change is priced from the change date. Stripe does that arithmetic
//              where a Stripe subscription exists; utils/proration.js does it where one
//              does not, so a manually invoiced tenant still gets a dated, prorated entry
//              rather than nothing at all.
//
// Nothing here throws into the caller's happy path. A plan change that succeeded must not
// be reported as failed because bookkeeping hiccuped — but a bookkeeping failure is itself
// written to the audit trail, so it surfaces in the console instead of only in a log file
// nobody reads.

const billing = require('./platformBilling');
const ledger = require('./billingLedger');
const { logPlatformAction } = require('./platformAudit');
const { prorate } = require('../utils/proration');

/**
 * Price a pending plan change, and say where the figures came from.
 *
 * `source` is part of the answer, not decoration: 'stripe' means the invoice will carry
 * these exact lines, 'local' means we computed them for a tenant Stripe does not bill, and
 * 'none' means they could not be computed and why. Recording a locally computed figure as
 * if Stripe had produced it is the failure mode this field exists to prevent.
 *
 * @returns {Promise<{source:'stripe'|'local'|'none', reason?:string, prorationDate:number,
 *                    creditMinor:number, chargeMinor:number, netMinor:number,
 *                    currency:string|null, lines:Array}>}
 */
/**
 * How long a quoted proration date stays usable, for a caller who is not trusted to pick
 * one. Long enough to read a confirmation dialog and click it; far too short to be worth
 * gaming.
 */
const QUOTE_TTL_SECONDS = 15 * 60;

/**
 * Settle on the instant a change is priced at.
 *
 * A client sends one back so it is billed the amount it was quoted. That is the ONLY
 * legitimate use, and it needs a bound: the proration date decides how much of the period
 * is credited, so a practice admin free to name any instant could downgrade, backdate the
 * change to the start of the period, and claim a full period's credit for a period they
 * had already used. Anything outside the window is ignored and the change is priced now —
 * at worst the customer is re-quoted, which is the safe direction to fail in.
 *
 * `allowBackdating` is for operators, who may legitimately date a correction to when it
 * should have happened, and who are already gated behind the `billing` role and audited.
 */
function resolveProrationDate(prorationDate, allowBackdating) {
  const now = Math.floor(Date.now() / 1000);
  const asked = Number(prorationDate);
  if (!(asked > 0)) return now;
  if (allowBackdating) return Math.floor(asked);
  // A small forward allowance absorbs clock skew between the browser and the server.
  if (asked <= now + 60 && asked >= now - QUOTE_TTL_SECONDS) return Math.floor(asked);
  return now;
}

async function quotePlanChange({ subscription, plan, prorationDate, allowBackdating = false }) {
  const at = resolveProrationDate(prorationDate, allowBackdating);
  const empty = {
    prorationDate: at, creditMinor: 0, chargeMinor: 0, netMinor: 0,
    currency: null, lines: [], amountDue: 0,
  };

  const subId = subscription.stripe_subscription_id;
  if (subId && plan.stripe_price_id && billing.isConfigured()) {
    try {
      // Ask at the SAME instant the change will be pinned to, so the recorded entry and
      // the eventual invoice line are the same number rather than two readings taken
      // moments apart.
      const preview = await billing.previewPlanChange({
        subscriptionId: subId, newPriceId: plan.stripe_price_id, prorationDate: at,
      });
      const lines = preview.lines || [];
      const creditMinor = Math.round(lines.filter((l) => l.amount < 0).reduce((s, l) => s + l.amount, 0) * 100);
      const chargeMinor = Math.round(lines.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0) * 100);
      return {
        source: 'stripe',
        // Stripe prices the preview at its own instant; pin everything to that one so the
        // ledger date, the idempotency key and the Stripe update all agree.
        prorationDate: preview.prorationDate || at,
        creditMinor,
        chargeMinor,
        netMinor: creditMinor + chargeMinor,
        currency: preview.currency || null,
        lines,
        // What the next invoice will actually come to, which is NOT the same as the
        // proration net: it also carries the period's regular charge, any discount and
        // any existing credit balance. The net is what gets booked; this is what gets
        // quoted to the customer. Conflating them understates the bill.
        amountDue: preview.amountDue || 0,
      };
    } catch (err) {
      // A preview failure must not stop the change: the customer asked to move plan, not
      // to be shown a number. The entry then records that it could not be priced.
      console.error('[subscriptionChanges] could not price change with Stripe:', err.message);
      return { ...empty, source: 'none', reason: `Stripe could not price the change: ${err.message}` };
    }
  }

  const local = prorate({
    oldAmount: subscription.old_price,
    newAmount: plan.price,
    periodStart: subscription.current_period_start,
    periodEnd: subscription.current_period_end,
    billingCycle: plan.billing_cycle,
    changeAt: at,
  });
  if (!local) {
    return {
      ...empty,
      source: 'none',
      reason: subscription.current_period_end
        ? 'The plan billing cycle is not one that can be prorated.'
        : 'No billing period end is recorded for this subscription, so the change cannot be prorated.',
    };
  }
  return {
    source: 'local',
    prorationDate: local.prorationDate,
    creditMinor: local.creditMinor,
    chargeMinor: local.chargeMinor,
    netMinor: local.netMinor,
    currency: plan.currency || null,
    lines: [],
    // Nothing else is on a manual invoice yet, so the proration net IS what is owed.
    amountDue: local.netMinor / 100,
    periodStartDerived: local.periodStartDerived,
    remainingFraction: local.remainingFraction,
  };
}

/**
 * Write the accounting entries for a priced change.
 *
 * TWO rows, not three: the credit and the charge sum to the net, so adding a third "net"
 * row would double-count the moment anyone totals the accruals. Both are entry_kind
 * 'accrual' — the money has not moved yet, it lands on the next invoice, which arrives
 * separately as invoice.paid. Counting a proration as collected revenue AND then counting
 * the invoice that settles it is the classic way a SaaS ledger overstates itself.
 *
 * Both are dated at the proration date, which is the whole point of the exercise: the
 * books show the change on the day it took effect, not on the day the row was inserted.
 */
async function recordAccounting(pool, { tenantId, practiceId, quote, fromPlan, toPlan, actor }) {
  // The idempotency key identifies the CHANGE, not just the instant. Keyed on the time
  // alone, two different moves made inside the same second — a correction straight after a
  // mistake, most likely — would collide and the second would be silently dropped as a
  // duplicate. Keyed on from/to as well, a retry of the same move still dedupes while a
  // genuinely different move books separately.
  const key = `sub:${tenantId}:plan:${fromPlan ? fromPlan.id : 'none'}->${toPlan.id}:proration:${quote.prorationDate}`;
  const common = {
    tenantId,
    practiceId,
    currency: quote.currency,
    occurredAt: quote.prorationDate,
    entryKind: 'accrual',
    operatorId: actor.type === 'operator' ? actor.id : null,
  };
  const detail = {
    from: fromPlan ? { id: fromPlan.id, name: fromPlan.display_name || fromPlan.name } : null,
    to: { id: toPlan.id, name: toPlan.display_name || toPlan.name },
    pricedBy: quote.source,
    actor: { type: actor.type, label: actor.label },
    ...(quote.reason ? { reason: quote.reason } : {}),
    ...(quote.periodStartDerived ? { periodStartDerived: true } : {}),
  };

  const rows = [];
  if (quote.creditMinor !== 0) {
    rows.push({
      ...common,
      eventType: 'subscription.proration_credit',
      stripeObjectId: `${key}:credit`,
      amountMinor: quote.creditMinor,
      description: `Unused time on ${detail.from ? detail.from.name : 'the previous plan'}`,
      detail,
    });
  }
  if (quote.chargeMinor !== 0) {
    rows.push({
      ...common,
      eventType: 'subscription.proration_charge',
      stripeObjectId: `${key}:charge`,
      amountMinor: quote.chargeMinor,
      description: `Remaining time on ${detail.to.name}`,
      detail,
    });
  }
  if (rows.length === 0) {
    // Nothing to prorate — a free plan, a change on the renewal boundary, or a period we
    // could not establish. Still an accounting entry: "this changed and cost nothing" is a
    // fact the books should carry, and `reason` says which of those it was.
    rows.push({
      ...common,
      eventType: 'subscription.changed',
      stripeObjectId: `${key}:noop`,
      amountMinor: 0,
      description: `Moved to ${detail.to.name}${quote.reason ? ` — not prorated: ${quote.reason}` : ' — nothing to prorate'}`,
      detail,
    });
  }

  const written = [];
  for (const row of rows) {
    try {
      // Strict, not best-effort: an accounting entry that silently did not happen is worse
      // than a loud failure, and the caller turns a failure here into an audit entry rather
      // than into a failed request.
      const r = await ledger.recordEventStrict(row);
      written.push({ id: r.id, type: row.eventType, amountMinor: row.amountMinor });
    } catch (err) {
      // A duplicate is success: the same change, priced at the same instant, has already
      // been booked. That is the unique index doing its job on a retry or a double-submit.
      if (err.code === '23505') {
        written.push({ duplicate: true, type: row.eventType, amountMinor: row.amountMinor });
        continue;
      }
      throw err;
    }
  }
  return written;
}

/**
 * Record a subscription change: audit it, and book it.
 *
 * Call this AFTER the change has been applied, with what it moved from and to. Returns
 * what was written so a route can report it; never throws.
 */
async function recordChange(pool, {
  tenantId, practiceId, actor, ip, fromPlan = null, toPlan = null, quote = null,
  statusFrom = null, statusTo = null, seatsFrom = null, seatsTo = null, pushedToStripe = false,
}) {
  let accounting = null;
  let accountingError = null;

  if (toPlan && quote) {
    try {
      accounting = await recordAccounting(pool, { tenantId, practiceId, quote, fromPlan, toPlan, actor });
    } catch (err) {
      accountingError = err.message;
      console.error('[subscriptionChanges] FAILED to book the change:', err.message);
    }
  }

  const planMoved = Boolean(toPlan && (!fromPlan || fromPlan.id !== toPlan.id));
  const detail = {
    ...(planMoved
      ? {
        plan: {
          from: fromPlan ? { id: fromPlan.id, name: fromPlan.display_name || fromPlan.name } : null,
          to: { id: toPlan.id, name: toPlan.display_name || toPlan.name },
        },
      }
      : {}),
    ...(statusTo && statusTo !== statusFrom ? { status: { from: statusFrom, to: statusTo } } : {}),
    ...(seatsTo != null && seatsTo !== seatsFrom ? { seats: { from: seatsFrom, to: seatsTo } } : {}),
    ...(quote
      ? {
        proration: {
          pricedBy: quote.source,
          effectiveAt: new Date(quote.prorationDate * 1000).toISOString(),
          creditMinor: quote.creditMinor,
          chargeMinor: quote.chargeMinor,
          netMinor: quote.netMinor,
          currency: quote.currency,
          ...(quote.reason ? { reason: quote.reason } : {}),
        },
      }
      : {}),
    pushedToStripe,
    ...(accounting ? { ledgerEntries: accounting } : {}),
    // An accounting write that failed is itself an auditable event. Burying it in a server
    // log would mean the books are short an entry and nobody can see that they are.
    ...(accountingError ? { accountingError } : {}),
  };

  await logPlatformAction(pool, {
    operatorId: actor.type === 'operator' ? actor.id : null,
    actorType: actor.type,
    actorLabel: actor.label,
    action: planMoved ? 'subscription.plan_changed' : 'subscription.update',
    targetType: 'tenant',
    targetId: tenantId,
    tenantId,
    detail,
    ip,
  });

  return { accounting, accountingError };
}

module.exports = { quotePlanChange, recordAccounting, recordChange };
