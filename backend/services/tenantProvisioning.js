// Tenant provisioning — the one place a tenant comes into existence.
//
// Both entry points funnel through here: an operator creating a tenant in the platform
// console, and a customer completing Stripe Checkout. Keeping it in one function is what
// guarantees a self-serve tenant is identical to an operator-created one — including the
// control.subscriptions row, whose absence previously made entitlements fail open to the
// legacy global organization_settings.

const bcrypt = require('bcryptjs');
const { BCRYPT_COST } = require('../utils/passwordPolicy');

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Create a practice, its schema, its tenant row and its subscription — atomically.
 *
 * @param {import('pg').Pool} pool
 * @param {object} opts
 * @param {string} opts.name                practice/tenant display name
 * @param {string} [opts.planTier]
 * @param {number} [opts.planId]            public.subscription_plans.id
 * @param {string} [opts.country] ISO-3166 alpha-2
 * @param {string} [opts.timezone]
 * @param {object} [opts.subscription]      { status, stripeCustomerId, stripeSubscriptionId,
 *                                            trialEnd, currentPeriodEnd, seats }
 * @param {object} [opts.admin]             { email, passwordHash, firstName, lastName } —
 *                                          the first user, created bound to the practice
 * @returns {Promise<{tenant: object, practiceId: string, adminUserId: string|null}>}
 */
async function provisionTenant(pool, opts) {
  const {
    name, planTier, planId, country, timezone,
    subscription = {}, admin = null,
  } = opts;
  if (!name) throw new Error('name is required');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: pr } = await client.query(
      `INSERT INTO public.practices (id, name, plan_tier, country, timezone)
       VALUES (gen_random_uuid(), $1, COALESCE($2,'professional'), $3, $4) RETURNING id`,
      [name, planTier || null, country || null, timezone || null]
    );
    const practiceId = pr[0].id;
    const schema = 'tenant_' + practiceId.replace(/-/g, '');

    await client.query('SELECT control.provision_schema($1)', [schema]);

    let slug = slugify(name) || ('t' + practiceId.slice(0, 8));
    const clash = await client.query('SELECT 1 FROM control.tenants WHERE slug = $1', [slug]);
    if (clash.rows.length) slug = `${slug}-${practiceId.slice(0, 6)}`;

    const { rows: tr } = await client.query(
      `INSERT INTO control.tenants (slug, name, schema_name, practice_id, plan_tier, country, timezone, status)
       VALUES ($1, $2, $3, $4, COALESCE($5,'professional'), $6, $7, 'active') RETURNING *`,
      [slug, name, schema, practiceId, planTier || null, country || null, timezone || null]
    );
    const tenant = tr[0];

    // Resolve the plan: an explicit id, else the cheapest active plan. A tenant without a
    // subscription row makes entitlement checks fail open, so there is always one.
    const { rows: planRows } = await client.query(
      planId
        ? 'SELECT id, name FROM public.subscription_plans WHERE id = $1'
        : `SELECT id, name FROM public.subscription_plans WHERE is_active = true
             ORDER BY price ASC NULLS LAST, id ASC LIMIT 1`,
      planId ? [planId] : []
    );
    const plan = planRows[0] || null;

    await client.query(
      `INSERT INTO control.subscriptions
         (tenant_id, practice_id, plan_id, plan_name, status, seats,
          stripe_customer_id, stripe_subscription_id, trial_end, current_period_end)
       VALUES ($1,$2,$3,$4,COALESCE($5,'active'),COALESCE($6,0),$7,$8,$9,$10)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [
        tenant.id, practiceId, plan ? plan.id : null, plan ? plan.name : null,
        subscription.status || null, subscription.seats || null,
        subscription.stripeCustomerId || null, subscription.stripeSubscriptionId || null,
        subscription.trialEnd || null, subscription.currentPeriodEnd || null,
      ]
    );

    let adminUserId = null;
    if (admin && admin.email) {
      // The first user is an admin of this practice. practice_id is set here and nowhere
      // else for this account — it is what binds every later request to the tenant.
      const { rows: ur } = await client.query(
        `INSERT INTO public.users
           (id, email, first_name, last_name, role, status, password_hash, practice_id, created_at)
         VALUES (gen_random_uuid(), LOWER($1), $2, $3, 'admin', 'active', $4, $5, NOW())
         RETURNING id`,
        // users.first_name / last_name are NOT NULL — empty string, never null.
        [admin.email, admin.firstName || '', admin.lastName || '',
         admin.passwordHash || null, practiceId]
      );
      adminUserId = ur[0].id;
    }

    await client.query('COMMIT');
    return { tenant, practiceId, adminUserId };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** bcrypt at the shared cost — used by signup before any tenant exists. */
const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_COST);

module.exports = { provisionTenant, hashPassword, slugify };
