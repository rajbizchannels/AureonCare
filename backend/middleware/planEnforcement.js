/**
 * Plan Enforcement Middleware
 *
 * Enforces subscription tier limits (users, patients, providers) and
 * feature access at the API boundary. All quota checks hit the DB so
 * they cannot be bypassed via the frontend.
 */

const UNLIMITED = -1;
const { getTenantEntitlements } = require('../services/entitlements');

/**
 * Loads the effective plan for this request. SEC-05 (S11): when the request carries a
 * tenant (req.tenant.practiceId), the plan comes from that tenant's control-plane
 * subscription; otherwise it falls back to the legacy single-tenant
 * organization_settings row. Returns null if nothing is configured (fail open).
 */
async function loadPlan(pool, req) {
  const practiceId = req && req.tenant && req.tenant.practiceId;
  if (practiceId) {
    const ent = await getTenantEntitlements(pool, practiceId);
    if (ent) {
      return {
        plan_name: ent.planName || 'your',
        max_users: ent.maxUsers ?? UNLIMITED,
        max_patients: ent.maxPatients ?? UNLIMITED,
        max_providers: ent.maxProviders ?? UNLIMITED,
        features: ent.features,
        provider_seats_purchased: ent.seats,
        enforcement_enabled: ent.enforcementEnabled,
        plan_end_date: ent.currentPeriodEnd,   // period end acts as the expiry date
        is_trial: ent.status === 'trialing',
        trial_end_date: null,
        _practiceId: practiceId,
      };
    }
    // Has a tenant but no subscription row — fall through to the global fallback.
  }
  const result = await pool.query(`
    SELECT
      sp.name            AS plan_name,
      sp.max_users,
      sp.max_patients,
      sp.max_providers,
      sp.features,
      os.provider_seats_purchased,
      os.enforcement_enabled,
      os.plan_end_date,
      os.auto_renew,
      os.is_trial,
      os.trial_end_date
    FROM organization_settings os
    JOIN subscription_plans sp ON os.current_plan_id = sp.id
    LIMIT 1
  `);
  return result.rows[0] || null;
}

function isPlanExpired(plan) {
  if (!plan.plan_end_date) return false;
  return new Date(plan.plan_end_date) < new Date();
}

function effectiveProviderLimit(plan) {
  if (plan.max_providers === UNLIMITED) return UNLIMITED;
  return plan.max_providers + (plan.provider_seats_purchased || 0);
}

/**
 * Builds a 402 response payload for quota violations.
 */
function quotaError(res, resource, current, max, planName) {
  return res.status(402).json({
    error: 'QuotaExceeded',
    message: `Your ${planName} plan allows ${max} ${resource}. You currently have ${current}. Upgrade your plan to add more.`,
    resource,
    current,
    limit: max,
    upgrade_required: true
  });
}

/**
 * Builds a 402 response payload for feature access violations.
 */
function featureError(res, feature, planName) {
  return res.status(402).json({
    error: 'FeatureNotIncluded',
    message: `The "${feature}" feature is not included in your ${planName} plan. Please upgrade to access it.`,
    feature,
    upgrade_required: true
  });
}

/**
 * Builds a 402 response payload for expired plans.
 */
function expiredError(res, planName) {
  return res.status(402).json({
    error: 'SubscriptionExpired',
    message: `Your ${planName} subscription has expired. Please renew to continue creating records.`,
    upgrade_required: true
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Exported middleware factories
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Blocks POST /api/users when the staff-user seat limit is reached.
 * Patient-role users are excluded from the staff count.
 */
async function enforceUserQuota(req, res, next) {
  try {
    const pool = req.app.locals.pool;
    const plan = await loadPlan(pool, req);

    if (!plan || !plan.enforcement_enabled) return next();
    if (plan.max_users === UNLIMITED) return next();
    if (isPlanExpired(plan)) return expiredError(res, plan.plan_name);

    // SEC-05: staff count is per-practice (users lives in the shared public schema).
    const practiceId = req.tenant && req.tenant.practiceId;
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM users
        WHERE status = 'active' AND role <> 'patient'
          AND ($1::uuid IS NULL OR practice_id = $1)`,
      [practiceId || null]
    );
    const current = parseInt(rows[0].cnt, 10);

    if (current >= plan.max_users) {
      return quotaError(res, 'staff users', current, plan.max_users, plan.plan_name);
    }

    next();
  } catch (err) {
    console.error('[planEnforcement] enforceUserQuota error:', err.message);
    next(); // fail open — never block due to an internal error
  }
}

/**
 * Blocks POST /api/patients when the patient record limit is reached.
 */
async function enforcePatientQuota(req, res, next) {
  try {
    const pool = req.app.locals.pool;
    const plan = await loadPlan(pool, req);

    if (!plan || !plan.enforcement_enabled) return next();
    if (plan.max_patients === UNLIMITED) return next();
    if (isPlanExpired(plan)) return expiredError(res, plan.plan_name);

    // SEC-05: patients is a per-tenant table — count via the request's tenant db.
    const db = req.db || pool;
    const { rows } = await db.query(`
      SELECT COUNT(*) AS cnt FROM patients WHERE status = 'Active'
    `);
    const current = parseInt(rows[0].cnt, 10);

    if (current >= plan.max_patients) {
      return quotaError(res, 'patient records', current, plan.max_patients, plan.plan_name);
    }

    next();
  } catch (err) {
    console.error('[planEnforcement] enforcePatientQuota error:', err.message);
    next();
  }
}

/**
 * Blocks POST /api/users when the provider (doctor) seat limit is reached.
 * Only applied when the new user's role is 'doctor'.
 */
async function enforceProviderQuota(req, res, next) {
  try {
    const incomingRole = req.body.role || req.body.roles?.[0];
    if (incomingRole !== 'doctor') return next(); // only applies to provider creation

    const pool = req.app.locals.pool;
    const plan = await loadPlan(pool, req);

    if (!plan || !plan.enforcement_enabled) return next();
    const limit = effectiveProviderLimit(plan);
    if (limit === UNLIMITED) return next();
    if (isPlanExpired(plan)) return expiredError(res, plan.plan_name);

    // SEC-05: provider (doctor) count is per-practice.
    const practiceId = req.tenant && req.tenant.practiceId;
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM users WHERE role = 'doctor' AND status = 'active'
         AND ($1::uuid IS NULL OR practice_id = $1)`,
      [practiceId || null]
    );
    const current = parseInt(rows[0].cnt, 10);

    if (current >= limit) {
      return res.status(402).json({
        error: 'ProviderSeatLimitReached',
        message: `Your ${plan.plan_name} plan includes ${plan.max_providers} provider seat(s) with ${plan.provider_seats_purchased} additional seat(s) purchased (${limit} total). Purchase additional provider seats to add more doctors.`,
        resource: 'providers',
        current,
        limit,
        included: plan.max_providers,
        purchased: plan.provider_seats_purchased,
        upgrade_required: true
      });
    }

    next();
  } catch (err) {
    console.error('[planEnforcement] enforceProviderQuota error:', err.message);
    next();
  }
}

/**
 * Returns middleware that blocks a route when the plan's feature JSONB
 * does not include the given featureKey.
 *
 * Usage: router.post('/telehealth/session', enforceFeature('telehealth'), handler)
 */
function enforceFeature(featureKey) {
  return async function featureGate(req, res, next) {
    try {
      const pool = req.app.locals.pool;
      const plan = await loadPlan(pool, req);

      if (!plan || !plan.enforcement_enabled) return next();
      if (isPlanExpired(plan)) return expiredError(res, plan.plan_name);

      const features = plan.features || {};
      if (!features[featureKey]) {
        return featureError(res, featureKey, plan.plan_name);
      }

      next();
    } catch (err) {
      console.error(`[planEnforcement] enforceFeature(${featureKey}) error:`, err.message);
      next();
    }
  };
}

/**
 * SEC-05 (S11): read-only billing gate. When a tenant's subscription is past_due or
 * canceled, block mutating requests (POST/PUT/PATCH/DELETE) with 402 while still
 * allowing reads (GET/HEAD). Apply after authenticate on tenant routers. Fails open on
 * error and when there is no tenant/subscription context.
 */
async function enforceActiveBilling(req, res, next) {
  try {
    const method = (req.method || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();

    const practiceId = req.tenant && req.tenant.practiceId;
    if (!practiceId) return next();

    const ent = await getTenantEntitlements(req.app.locals.pool, practiceId);
    if (ent && ent.enforcementEnabled && ent.isReadOnly) {
      return res.status(402).json({
        error: 'SubscriptionInactive',
        message: `This workspace is read-only because its subscription is ${ent.status}. Update billing to resume changes.`,
        status: ent.status,
        upgrade_required: true,
      });
    }
    next();
  } catch (err) {
    console.error('[planEnforcement] enforceActiveBilling error:', err.message);
    next(); // fail open
  }
}

module.exports = {
  enforceUserQuota,
  enforcePatientQuota,
  enforceProviderQuota,
  enforceFeature,
  enforceActiveBilling,
};
