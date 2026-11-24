const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const billing = require('../services/platformBilling');
const subscriptionChanges = require('../services/subscriptionChanges');
const { invalidateEntitlements } = require('../services/entitlements');
const { sendDbError } = require('../utils/dbErrors');
const planCatalog = require('../services/planCatalog');
const router = express.Router();
router.use(authenticate);

// Get all subscription plans
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    // Only plans that can actually be switched to: active, and with a Stripe price, so
    // the page never offers a plan the change endpoint would then refuse.
    // tier / is_tier_default are read through to_jsonb so this still works before migration 107.
    const result = await pool.query(`
      SELECT id, name, display_name, description, price, currency, billing_cycle,
             max_users, max_providers, max_patients, features, trial_days,
             (stripe_price_id IS NOT NULL) AS purchasable,
             COALESCE(to_jsonb(sp)->>'tier', name) AS tier,
             COALESCE((to_jsonb(sp)->>'is_tier_default')::boolean, true) AS is_tier_default,
              (to_jsonb(sp)->>'included_providers')::int AS included_providers,
              (to_jsonb(sp)->>'extra_provider_price')::numeric AS extra_provider_price,
              (to_jsonb(sp)->>'included_locations')::int AS included_locations,
              (to_jsonb(sp)->>'max_locations')::int AS max_locations,
              (to_jsonb(sp)->>'extra_location_price')::numeric AS extra_location_price,
              (to_jsonb(sp)->>'storage_gb')::int AS storage_gb
        FROM public.subscription_plans sp
       WHERE is_active = true
       ORDER BY price ASC NULLS FIRST, id
    `);

    // One plan per tier, in the clinic's currency when the platform offers it, else the tier's
    // default — and always the plan the practice is already on (services/planCatalog.js).
    const practiceId = (req.tenant && req.tenant.practiceId) || (req.user && req.user.practiceId) || null;
    const currency = await planCatalog.practiceCurrency(pool, practiceId);
    let currentPlanId = null;
    if (practiceId) {
      try { currentPlanId = (await pool.query('SELECT plan_id FROM control.subscriptions WHERE practice_id = $1', [practiceId])).rows[0]?.plan_id || null; } catch { /* no control plane */ }
    }
    res.json(planCatalog.pickForCurrency(result.rows, currency, { keepIds: [currentPlanId] }));
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// The tenant's ACTUAL subscription.
//
// Reads control.subscriptions, which is authoritative, rather than the legacy global
// organization_settings row — that row is shared by every tenant, so on a multi-tenant
// install it showed one practice another practice's plan. Falls back to the legacy row
// only when no control-plane subscription exists (a pre-SEC-05 single-tenant install).
router.get('/current', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const practiceId = req.user.practiceId || null;

    if (practiceId) {
      const { rows } = await pool.query(
        `SELECT s.plan_id, s.plan_name, s.seats, s.trial_end, s.current_period_end,
                CASE WHEN s.status = 'trialing' AND s.stripe_subscription_id IS NULL AND s.trial_end < now()
                     THEN 'trial_expired' ELSE s.status END AS status,
                p.stripe_price_id IS NOT NULL AS plan_can_checkout,
                COALESCE(to_jsonb(p)->>'tier', p.name) AS tier,
                (s.stripe_subscription_id IS NOT NULL) AS billing_linked,
                p.display_name AS plan_display_name, p.description AS plan_description,
                p.price AS plan_price, p.currency, p.billing_cycle,
                p.max_users, p.max_providers, p.max_patients, p.features
           FROM control.subscriptions s
           LEFT JOIN public.subscription_plans p ON p.id = s.plan_id
          WHERE s.practice_id = $1
          LIMIT 1`,
        [practiceId]
      );
      if (rows.length) return res.json({ source: 'control_plane', ...rows[0] });
    }

    const legacy = await pool.query(`
      SELECT os.*, sp.name as plan_name, sp.display_name as plan_display_name,
             sp.description as plan_description, sp.price as plan_price,
             sp.billing_cycle, sp.max_users, sp.max_patients, sp.features
        FROM organization_settings os
        JOIN subscription_plans sp ON os.current_plan_id = sp.id
       LIMIT 1
    `);
    if (legacy.rows.length === 0) {
      return res.status(404).json({ error: 'No subscription found for this practice' });
    }
    res.json({ source: 'legacy', ...legacy.rows[0] });
  } catch (error) {
    console.error('Error fetching current plan:', error);
    res.status(500).json({ error: 'Failed to fetch current plan' });
  }
});

/**
 * POST /api/plans/start-trial { plan_id } — a practice on the free Listing plan starts the free
 * trial of a paid plan (admin). Once per practice: a practice that has had a trial subscribes.
 */
router.post('/start-trial', authorize('admin'), async (req, res) => {
  const pool = req.app.locals.pool;
  const practiceId = req.user.practiceId;
  if (!practiceId) return res.status(403).json({ error: 'Your account is not linked to a practice.' });
  try {
    const { rows: [sub] } = await pool.query(
      `SELECT s.*, p.features AS from_features FROM control.subscriptions s LEFT JOIN public.subscription_plans p ON p.id = s.plan_id
        WHERE s.practice_id = $1`, [practiceId]);
    if (!sub) return res.status(409).json({ error: 'This practice has no subscription record. Contact support.' });
    const onListing = sub.from_features && (sub.from_features.listing === true || sub.from_features.listing === 'true');
    if (!onListing) return res.status(409).json({ error: 'A free trial starts from the free Listing plan.' });
    if (sub.trial_end) return res.status(409).json({ error: 'This practice has already had its free trial — subscribe to a plan instead.' });
    const { rows: [plan] } = await pool.query(
      'SELECT * FROM public.subscription_plans WHERE id = $1 AND is_active = true AND COALESCE(trial_days, 0) > 0 AND COALESCE(price, 0) > 0', [req.body && req.body.plan_id]);
    if (!plan) return res.status(400).json({ error: 'That plan has no free trial.' });
    const trialEnd = new Date(Date.now() + plan.trial_days * 86400000);
    await pool.query(
      `UPDATE control.subscriptions SET plan_id = $2, plan_name = $3, status = 'trialing', trial_end = $4, current_period_end = $4, updated_at = now()
        WHERE practice_id = $1`, [practiceId, plan.id, plan.name, trialEnd]);
    invalidateEntitlements(practiceId);
    await pool.query(
      `INSERT INTO control.audit_log (operator_id, action, target_type, target_id, tenant_id, detail)
       VALUES (NULL, 'tenant.listing_trial_start', 'tenant', $1, $1, $2)`,
      [sub.tenant_id, JSON.stringify({ by: req.user.email, plan: plan.name, trialEnd })]).catch(() => {});
    res.json({ plan_id: plan.id, plan_name: plan.name, status: 'trialing', trial_end: trialEnd });
  } catch (e) {
    console.error('Error starting a trial from Listing:', e.message);
    res.status(500).json({ error: 'Could not start the trial.' });
  }
});

/**
 * GET /api/plans/usage — what the practice has and uses: providers and locations (included, extra
 * bought, limit, in use, price of one more) and hosted storage. Any signed-in staff member.
 */
router.get('/usage', async (req, res) => {
  try {
    if (!req.user.practiceId) return res.status(403).json({ error: 'Your account is not linked to a practice.' });
    res.json(await require('../services/planAddons').usage(req.app.locals.pool, req.db || req.app.locals.pool, req.user.practiceId));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error('Error reading plan usage:', e.message);
    res.status(500).json({ error: 'Could not read your plan usage.' });
  }
});

/**
 * PUT /api/plans/addons { extraProviders?, extraLocations? } — buy or remove extra providers and
 * locations (admin). Billed through Stripe for a Stripe-billed practice (prorated), else recorded.
 */
router.put('/addons', authorize('admin'), async (req, res) => {
  try {
    if (!req.user.practiceId) return res.status(403).json({ error: 'Your account is not linked to a practice.' });
    const A = require('../services/planAddons');
    const before = await A.usage(req.app.locals.pool, req.db || req.app.locals.pool, req.user.practiceId);
    const out = await A.setAddons(req.app.locals.pool, req.db || req.app.locals.pool, req.user.practiceId, req.body || {});
    await req.app.locals.pool.query(
      `INSERT INTO control.audit_log (operator_id, action, target_type, target_id, tenant_id, detail)
       SELECT NULL, 'tenant.addons_change', 'tenant', s.tenant_id, s.tenant_id, $2 FROM control.subscriptions s WHERE s.practice_id = $1`,
      [req.user.practiceId, JSON.stringify({ by: req.user.email, providers: [before.providers.extra, out.providers.extra], locations: [before.locations.extra, out.locations.extra] })])
      .catch(() => {});
    res.json(out);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    if (e.statusCode && !e.type) return res.status(e.statusCode).json({ error: e.message });
    console.error('Error changing add-ons:', e.message);
    res.status(502).json({ error: 'The change could not be made. Nothing was charged or changed.' });
  }
});

/**
 * Subscribe this practice through Stripe Checkout — how a free trial (or any practice Stripe
 * does not bill yet) becomes a paying one. Returns the Checkout URL; the signed webhook
 * attaches the subscription to this practice when payment is set up (signup intent kind
 * 'upgrade'). Days left on a trial carry over, so nobody pays before their trial ends.
 */
router.post('/checkout', authorize('admin'), async (req, res) => {
  const pool = req.app.locals.pool;
  const planId = req.body && req.body.plan_id;
  const practiceId = req.user.practiceId;
  const tenantId = req.tenant && req.tenant.tenantId;
  if (!planId) return res.status(400).json({ error: 'Plan ID is required' });
  if (!practiceId || !tenantId) return res.status(403).json({ error: 'Your account is not linked to a practice.' });
  if (!billing.isConfigured()) return res.status(503).json({ error: 'Online payment is not available yet. Please contact support to subscribe.' });
  try {
    const { rows: [plan] } = await pool.query(
      'SELECT * FROM public.subscription_plans WHERE id = $1 AND is_active = true', [planId]);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (!plan.stripe_price_id) return res.status(409).json({ error: 'That plan cannot be bought online yet. Please contact support.' });
    const { rows: [sub] } = await pool.query(
      `SELECT status, trial_end, stripe_subscription_id, seats, COALESCE((to_jsonb(s)->>'extra_locations')::int, 0) AS extra_locations
         FROM control.subscriptions s WHERE practice_id = $1`, [practiceId]);
    if (sub && sub.stripe_subscription_id && sub.status !== 'canceled') {
      return res.status(409).json({ error: 'This practice is already billed by Stripe — change plan instead.' });
    }
    const { rows: [pr] } = await pool.query('SELECT name FROM public.practices WHERE id = $1', [practiceId]);
    const trialLeft = sub && sub.trial_end ? Math.max(0, Math.floor((new Date(sub.trial_end) - Date.now()) / 86400000)) : 0;
    await pool.query(`UPDATE control.signup_intents SET status = 'expired' WHERE tenant_id = $1 AND kind = 'upgrade' AND status = 'pending'`, [tenantId]);
    await pool.query(`UPDATE control.signup_intents SET status = 'expired' WHERE LOWER(email) = LOWER($1) AND status = 'pending'`, [req.user.email]);
    const { rows: [intent] } = await pool.query(
      `INSERT INTO control.signup_intents (email, practice_name, first_name, last_name, password_hash, plan_id, kind, tenant_id, sample_data)
       VALUES ($1, $2, $3, $4, '', $5, 'upgrade', $6, false) RETURNING id`,
      [req.user.email, (pr && pr.name) || 'Practice', req.user.firstName || null, req.user.lastName || null, plan.id, tenantId]);
    const app = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/$/, '');
    const session = await billing.createSubscriptionCheckout({
      priceId: plan.stripe_price_id, email: req.user.email, clientReferenceId: intent.id, trialDays: trialLeft,
      // Extras the practice set up during its trial are billed from the start too.
      addons: [
        { priceId: plan.stripe_provider_price_id, quantity: (sub && sub.seats) || 0 },
        { priceId: plan.stripe_location_price_id, quantity: (sub && sub.extra_locations) || 0 },
      ],
      successUrl: `${app}/?subscribed=1`, cancelUrl: `${app}/`,
    });
    await pool.query('UPDATE control.signup_intents SET stripe_checkout_session_id = $2 WHERE id = $1', [intent.id, session.id]);
    res.status(201).json({ checkoutUrl: session.url });
  } catch (error) {
    console.error('Error starting subscription checkout:', error.message);
    res.status(502).json({ error: 'Could not start checkout. Please try again.' });
  }
});

/**
 * What changing to `planId` would cost right now, prorated. Read-only — nothing is
 * charged or changed by asking.
 */
router.get('/preview/:planId', authorize('admin'), async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    if (!req.user.practiceId) return res.status(403).json({ error: 'Your account is not linked to a practice.' });
    const { rows } = await pool.query(
      `SELECT s.stripe_subscription_id, s.current_period_start, s.current_period_end,
              old.price AS old_price,
              p.id, p.name, p.display_name, p.price, p.currency, p.billing_cycle, p.stripe_price_id
         FROM control.subscriptions s
         CROSS JOIN public.subscription_plans p
         LEFT JOIN public.subscription_plans old ON old.id = s.plan_id
        WHERE s.practice_id = $1 AND p.id = $2`,
      [req.user.practiceId, req.params.planId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Plan or subscription not found' });
    const r = rows[0];

    // The same quote the change itself will use, so what is shown and what is booked are
    // produced by one piece of code rather than two that can disagree. A practice not
    // billed through Stripe now gets a figure too — previously it was told the change cost
    // nothing, which was only true in the sense that no card would be charged.
    const quote = await subscriptionChanges.quotePlanChange({
      subscription: r,
      plan: r,
      prorationDate: req.query.at,
    });
    res.json({
      prorated: quote.source !== 'none',
      source: quote.source,
      amountDue: quote.amountDue,
      prorationNet: quote.netMinor / 100,
      credit: quote.creditMinor / 100,
      charge: quote.chargeMinor / 100,
      currency: quote.currency,
      effectiveAt: new Date(quote.prorationDate * 1000).toISOString(),
      prorationDate: quote.prorationDate,
      ...(quote.reason ? { reason: quote.reason } : {}),
      lines: quote.lines.length ? quote.lines : [
        ...(quote.creditMinor ? [{ description: 'Unused time on your current plan', amount: quote.creditMinor / 100 }] : []),
        ...(quote.chargeMinor ? [{ description: `Remaining time on ${r.display_name || r.name}`, amount: quote.chargeMinor / 100 }] : []),
      ],
    });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.message });
    console.error('Plan preview error:', e);
    res.status(502).json({ error: e.message || 'Could not price that change.' });
  }
});

/**
 * Change the practice's plan — prorated, and against the practice's OWN subscription.
 *
 * What this used to do: write current_plan_id into the LEGACY global organization_settings
 * row. That row is shared by every tenant, so on a multi-tenant install one practice's
 * upgrade silently moved everyone; and it changed no billing at all, so a practice could
 * "upgrade" without ever being charged.
 *
 * What it does now: move the Stripe subscription onto the new plan's price with
 * proration_behavior 'create_prorations' — Stripe credits the unused remainder of the
 * current period and bills the new plan pro rata — then record the result in
 * control.subscriptions, which is what entitlement checks read. The change is reflected in
 * the platform console immediately, and again when Stripe's webhook confirms it.
 *
 * Admin-only, and scoped to the caller's own practice: practiceId comes from the verified
 * session, never from the request body.
 */
router.put('/current', authorize('admin'), async (req, res) => {
  const pool = req.app.locals.pool;
  const { plan_id: planId, prorationDate } = req.body || {};
  if (!planId) return res.status(400).json({ error: 'Plan ID is required' });
  if (!req.user.practiceId) {
    return res.status(403).json({ error: 'Your account is not linked to a practice.' });
  }

  try {
    const { rows: planRows } = await pool.query(
      'SELECT * FROM public.subscription_plans WHERE id = $1 AND is_active = true', [planId]
    );
    if (!planRows.length) return res.status(404).json({ error: 'Plan not found' });
    const plan = planRows[0];

    // The plan being left is needed by name and by price: by name so the audit trail says
    // what the change moved FROM, by price so a tenant Stripe does not bill can still have
    // the change prorated locally.
    const { rows: subRows } = await pool.query(
      `SELECT s.*, p.price AS old_price, p.display_name AS old_plan_display_name,
              p.name AS old_plan_name, p.billing_cycle AS old_billing_cycle
         FROM control.subscriptions s
         LEFT JOIN public.subscription_plans p ON p.id = s.plan_id
        WHERE s.practice_id = $1 LIMIT 1`, [req.user.practiceId]
    );
    if (!subRows.length) {
      return res.status(409).json({
        error: 'This practice has no subscription record. Contact support.',
      });
    }
    const sub = subRows[0];
    if (sub.plan_id === plan.id) {
      return res.status(400).json({ error: 'You are already on that plan.' });
    }

    // The free Listing plan (migration 109). Leaving it for a paid plan goes through a free trial
    // or Stripe Checkout — never a free switch. Moving TO it is for practices Stripe does not bill
    // (e.g. a trial that ended), as long as they fit its limits (checked below).
    const isListingPlan = (p) => Boolean(p && p.features && (p.features.listing === true || p.features.listing === 'true'));
    const { rows: [fromPlan] } = sub.plan_id ? await pool.query('SELECT features FROM public.subscription_plans WHERE id = $1', [sub.plan_id]) : { rows: [] };
    if (isListingPlan(fromPlan) && Number(plan.price) > 0) {
      return res.status(402).json({ error: 'Start a free trial or subscribe to move from the free Listing plan.', upgrade_required: true });
    }
    if (isListingPlan(plan) && sub.stripe_subscription_id && sub.status !== 'canceled') {
      return res.status(409).json({ error: 'This practice is billed by Stripe. Cancel the subscription first (contact support), then move to the free Listing plan.' });
    }

    // A smaller tier must fit what the practice already uses: providers and locations above the new
    // tier's cap would be left without a place. Extras carry over, trimmed to the new tier's room.
    const addons = require('../services/planAddons');
    const now = await addons.usage(pool, req.db || pool, req.user.practiceId);
    const fits = (kind, info, inc, cap) => {
      if (inc == null) return null;
      if (cap != null && cap !== -1 && info.used > cap) return `${plan.display_name || plan.name} allows up to ${cap} ${kind}s and you have ${info.used} active. Deactivate some first.`;
      return null;
    };
    const tooBig = fits('provider', now.providers, plan.included_providers, plan.max_providers)
      || fits('location', now.locations, plan.included_locations, plan.max_locations);
    if (tooBig) return res.status(409).json({ error: tooBig });
    const roomFor = (inc, cap, price, extra, used) => {
      if (inc == null || !(Number(price) > 0)) return 0;                  // the new tier sells no extras
      const needed = Math.max(0, used - inc);                              // keep enough for what is in use
      const keep = Math.max(extra || 0, needed);
      return cap == null || cap === -1 ? keep : Math.min(keep, Math.max(0, cap - inc));
    };
    const nextExtras = {
      provider: roomFor(plan.included_providers, plan.max_providers, plan.extra_provider_price, now.providers.extra, now.providers.used),
      location: roomFor(plan.included_locations, plan.max_locations, plan.extra_location_price, now.locations.extra, now.locations.used),
    };

    // Price the change BEFORE applying it. Afterwards the subscription is already on the
    // new price and there is nothing left to quote — the proration would be recorded as
    // zero and the books would show a tier change that cost nothing.
    const quote = await subscriptionChanges.quotePlanChange({ subscription: sub, plan, prorationDate });

    // Move the money first. If Stripe refuses (card declined, subscription canceled), the
    // entitlement must NOT change — otherwise a practice could unlock a higher tier by
    // failing to pay for it.
    let prorated = false;
    if (sub.stripe_subscription_id && plan.stripe_price_id && billing.isConfigured()) {
      await billing.changeSubscriptionPlan({
        subscriptionId: sub.stripe_subscription_id,
        newPriceId: plan.stripe_price_id,
        // Pin to the instant the change was quoted at, so the amount recorded in the
        // ledger is the amount Stripe bills rather than a second reading taken later.
        prorationDate: quote.prorationDate,
      });
      // Extra providers / locations move to the new tier's add-on prices.
      await billing.setSubscriptionAddons({ subscriptionId: sub.stripe_subscription_id, addons: {
        provider: { priceId: plan.stripe_provider_price_id || null, quantity: nextExtras.provider },
        location: { priceId: plan.stripe_location_price_id || null, quantity: nextExtras.location },
      } });
      prorated = true;
    }

    const { rows: updated } = await pool.query(
      `UPDATE control.subscriptions
          SET plan_id = $2, plan_name = $3, seats = $4, extra_locations = $5, updated_at = now(),
              -- Back on the free Listing plan the workspace is active again; trial_end is kept, since
              -- it records that the practice has had its one free trial.
              status = CASE WHEN $6::boolean THEN 'active' ELSE status END
        WHERE practice_id = $1
        RETURNING plan_id, plan_name, status, current_period_end`,
      [req.user.practiceId, plan.id, plan.name, nextExtras.provider, nextExtras.location, isListingPlan(plan)]
    );
    invalidateEntitlements(req.user.practiceId);

    // Audit it and book it. A practice moving its own tier used to leave no trace in the
    // platform console and no entry in the ledger: the only evidence that anything had
    // happened was plan_id holding a different number.
    const { accountingError } = await subscriptionChanges.recordChange(pool, {
      tenantId: sub.tenant_id,
      practiceId: req.user.practiceId,
      actor: { type: 'tenant_user', id: req.user.id, label: req.user.email || null },
      ip: req.ip || req.headers['x-forwarded-for'] || null,
      fromPlan: sub.plan_id
        ? { id: sub.plan_id, name: sub.old_plan_name, display_name: sub.old_plan_display_name }
        : null,
      toPlan: plan,
      quote,
      pushedToStripe: prorated,
    });

    res.json({
      ...updated[0],
      prorated,
      proration: {
        source: quote.source,
        effectiveAt: new Date(quote.prorationDate * 1000).toISOString(),
        credit: quote.creditMinor / 100,
        charge: quote.chargeMinor / 100,
        net: quote.netMinor / 100,
        currency: quote.currency,
        ...(quote.reason ? { reason: quote.reason } : {}),
      },
      plan_display_name: plan.display_name,
      plan_price: plan.price,
      currency: plan.currency,
      billing_cycle: plan.billing_cycle,
      // Say which of the three happened, rather than implying a charge that is not coming.
      message: prorated
        ? 'Plan changed. The prorated credit and charge appear on your next invoice.'
        : quote.source === 'local'
          ? 'Plan changed. This practice is invoiced manually; the prorated amount has been recorded against your account.'
          : 'Plan changed. This practice is not billed through Stripe, so nothing was charged.',
      ...(accountingError ? { accountingWarning: 'The change was applied but could not be written to the billing ledger; support has been alerted.' } : {}),
    });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('Error updating plan:', error);
    // Stripe's own message is actionable ("card declined"); a generic 500 is not.
    res.status(502).json({ error: error.message || 'Could not change the plan.' });
  }
});

// Get plan features and limits (includes provider seats)
router.get('/features', async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(`
      SELECT
        sp.name                    AS plan_name,
        sp.display_name            AS plan_display_name,
        sp.features,
        sp.max_users,
        sp.max_patients,
        sp.max_providers,
        sp.base_price_per_provider,
        os.provider_seats_purchased,
        os.is_trial,
        os.trial_end_date,
        os.plan_end_date,
        os.auto_renew,
        os.enforcement_enabled,
        (SELECT COUNT(*) FROM users  WHERE status = 'active' AND role <> 'patient') AS current_users,
        (SELECT COUNT(*) FROM users  WHERE status = 'active' AND role = 'doctor')   AS current_providers,
        (SELECT COUNT(*) FROM patients WHERE status = 'Active')                     AS current_patients
      FROM organization_settings os
      JOIN subscription_plans sp ON os.current_plan_id = sp.id
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No plan configured' });
    }

    const d = result.rows[0];
    const effectiveProviderLimit =
      d.max_providers === -1 ? -1
        : d.max_providers + (d.provider_seats_purchased || 0);

    res.json({
      plan: {
        name:        d.plan_name,
        displayName: d.plan_display_name,
        isTrial:     d.is_trial,
        trialEndDate: d.trial_end_date,
        endDate:     d.plan_end_date,
        autoRenew:   d.auto_renew,
        enforcementEnabled: d.enforcement_enabled,
      },
      features: d.features || {},
      limits: {
        users: {
          max:       d.max_users,
          current:   parseInt(d.current_users, 10),
          unlimited: d.max_users === -1,
        },
        patients: {
          max:       d.max_patients,
          current:   parseInt(d.current_patients, 10),
          unlimited: d.max_patients === -1,
        },
        providers: {
          included:  d.max_providers,
          purchased: d.provider_seats_purchased || 0,
          effective: effectiveProviderLimit,
          current:   parseInt(d.current_providers, 10),
          unlimited: d.max_providers === -1,
          additionalSeatPrice: d.base_price_per_provider,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching plan features:', error);
    res.status(500).json({ error: 'Failed to fetch plan features' });
  }
});

// Purchase additional provider seats (admin only).
//
// Same defect as PUT /current: it increments purchased seats on the shared
// organization_settings row with no authorization at all, so any signed-in user could
// grant themselves capacity nobody paid for.
router.post('/provider-seats', authorize('admin'), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { additionalSeats } = req.body;

    if (!additionalSeats || additionalSeats < 1) {
      return res.status(400).json({ error: 'additionalSeats must be a positive integer' });
    }

    const result = await pool.query(`
      UPDATE organization_settings
      SET provider_seats_purchased = provider_seats_purchased + $1,
          updated_at = NOW()
      WHERE id = (SELECT id FROM organization_settings LIMIT 1)
      RETURNING provider_seats_purchased
    `, [parseInt(additionalSeats, 10)]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization settings not found' });
    }

    res.json({
      message: `${additionalSeats} provider seat(s) added.`,
      totalPurchasedSeats: result.rows[0].provider_seats_purchased,
    });
  } catch (error) {
    console.error('Error adding provider seats:', error);
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to add provider seats')) return;
    res.status(500).json({ error: 'Failed to add provider seats' });
  }
});

module.exports = router;
