// Daily proration for a mid-period plan change.
//
// WHEN THIS IS USED: only for subscriptions we are NOT billing through Stripe — tenants an
// operator created by hand, tenants invoiced offline, and the period before a Stripe
// customer is linked. Where there IS a Stripe subscription, Stripe computes the proration
// and we record what it tells us. Reimplementing Stripe's arithmetic and then reporting
// our answer as if it were the invoice is how a ledger quietly stops matching the money.
//
// The method is the conventional one and the same shape Stripe uses: the unused remainder
// of the period is credited at the old price and re-charged at the new one, pro rata by
// elapsed time rather than by whole days, so a change at midday is priced at midday.
//
// Everything here is in MINOR UNITS (cents) and integer, because rounding a currency twice
// loses money — the same reason control.billing_events stores amount_minor.

/** Seconds in one billing period, used to derive a period start when none is recorded. */
const CYCLE_SECONDS = {
  weekly: 7 * 86400,
  monthly: 30 * 86400,
  quarterly: 91 * 86400,
  yearly: 365 * 86400,
  annual: 365 * 86400,
  annually: 365 * 86400,
};

/** Normalise anything date-ish to epoch seconds, or null. */
function toEpochSeconds(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.floor(v) : null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}

/** A plan price (major units, e.g. 49.99) as integer minor units. */
function toMinor(amount) {
  const n = Number(amount);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/**
 * Work out the period a change falls inside.
 *
 * Prefers the recorded start. Falls back to periodEnd minus one billing cycle, which is
 * what a period looks like for a subscription that renews on a fixed anchor. The fallback
 * is approximate for months of unequal length — deliberately so: an approximate period on
 * a tenant nobody is charging automatically is worth far more than refusing to produce an
 * accounting entry at all, and the entry records which of the two it used.
 */
function resolvePeriod({ periodStart, periodEnd, billingCycle }) {
  const end = toEpochSeconds(periodEnd);
  if (end == null) return null;
  const recorded = toEpochSeconds(periodStart);
  if (recorded != null && recorded < end) {
    return { start: recorded, end, derived: false };
  }
  const span = CYCLE_SECONDS[String(billingCycle || 'monthly').toLowerCase()];
  if (!span) return null;
  return { start: end - span, end, derived: true };
}

/**
 * Price a mid-period move from one plan to another.
 *
 * @returns {null|{creditMinor:number, chargeMinor:number, netMinor:number,
 *                 remainingSeconds:number, periodSeconds:number, remainingFraction:number,
 *                 prorationDate:number, periodStart:number, periodEnd:number,
 *                 periodStartDerived:boolean}}
 *   null when the period is unknown, so the caller can say why nothing was prorated
 *   instead of booking a figure it cannot stand behind.
 *
 *   creditMinor is negative (money back for time not used on the old plan), chargeMinor is
 *   positive, netMinor is what the customer owes — negative means they are owed a credit.
 */
function prorate({
  oldAmount, newAmount, periodStart, periodEnd, billingCycle, changeAt = Math.floor(Date.now() / 1000),
}) {
  const period = resolvePeriod({ periodStart, periodEnd, billingCycle });
  if (!period) return null;

  const periodSeconds = period.end - period.start;
  if (periodSeconds <= 0) return null;

  // A change quoted before the period opened prorates the whole period; one quoted after it
  // closed prorates nothing. Clamping rather than extrapolating keeps the credit from ever
  // exceeding what was actually paid for the period.
  const at = Math.min(Math.max(toEpochSeconds(changeAt), period.start), period.end);
  const remainingSeconds = period.end - at;
  const remainingFraction = remainingSeconds / periodSeconds;

  const creditMinor = -Math.round(toMinor(oldAmount) * remainingFraction);
  const chargeMinor = Math.round(toMinor(newAmount) * remainingFraction);

  return {
    creditMinor,
    chargeMinor,
    netMinor: creditMinor + chargeMinor,
    remainingSeconds,
    periodSeconds,
    remainingFraction,
    prorationDate: at,
    periodStart: period.start,
    periodEnd: period.end,
    periodStartDerived: period.derived,
  };
}

module.exports = { prorate, resolvePeriod, toEpochSeconds, toMinor, CYCLE_SECONDS };
