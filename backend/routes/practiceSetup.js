// The specialty configuration wizard.
//
// Thin on purpose: every decision lives in services/specialtyPack.js and
// utils/specialtyPackSchema.js, so the same rules hold whether a pack is applied from the
// wizard, a script or a test. This file is routing, authorisation and shape.
//
// Two things worth knowing before reading on:
//
//  * Per-practice state is in public.practices.setup, NOT organization_settings — that
//    table holds a single row shared by every tenant (see migration 085).
//  * Applying a pack is an authenticated admin action, never part of provisioning, so it
//    is attributable in audit_logs and so a tenant is usable before anyone configures it.

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { enforceActiveBilling } = require('../middleware/planEnforcement');
const packs = require('../services/specialtyPack');

router.use(authenticate);
router.use(enforceActiveBilling);

const STEPS = ['profile', 'specialty', 'services', 'providers', 'forms', 'review'];

const db_ = (req) => req.db || req.app.locals.pool;
const practiceId_ = (req) => req.tenant && req.tenant.practiceId;

function fail(res, err, what) {
  if (err && err.status) {
    const body = { error: err.code || 'Error', message: err.message };
    for (const k of ['blockers', 'errors', 'reviewStatus', 'clashes']) {
      if (err[k] !== undefined) body[k] = err[k];
    }
    return res.status(err.status).json(body);
  }
  console.error(`Error ${what}:`, err);
  return res.status(500).json({
    error: `Failed ${what}`, code: err && err.code,
    detail: (err && (err.detail || err.message)) || undefined,
  });
}

async function withTx(db, fn) {
  await db.query('BEGIN');
  try {
    const out = await fn();
    await db.query('COMMIT');
    return out;
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    throw err;
  }
}

/** The practice row carrying the setup blob. */
async function getPractice(db, practiceId) {
  if (!practiceId) {
    throw packs.packError(409, 'NoTenant',
      'This account is not bound to a practice, so there is nothing to configure.');
  }
  const { rows } = await db.query(
    `SELECT id, name, country, timezone, plan_tier, setup FROM public.practices WHERE id = $1`,
    [practiceId]
  );
  if (!rows.length) throw packs.packError(404, 'PracticeNotFound', 'Practice not found');
  return rows[0];
}

// ─── state ───────────────────────────────────────────────────────────────────────────

// GET /api/practice-setup/state
// Read by every authenticated client, because the shell needs hiddenModules and
// terminology on load — not only by the wizard.
router.get('/state', async (req, res) => {
  try {
    const practice = await getPractice(db_(req), practiceId_(req));
    const setup = practice.setup || {};
    res.json({
      practice: {
        id: practice.id, name: practice.name,
        country: practice.country, timezone: practice.timezone, planTier: practice.plan_tier,
      },
      onboarding: setup.onboarding || { startedAt: null, completedAt: null, currentStep: null, skipped: false },
      specialtyCodes: setup.specialtyCodes || [],
      hiddenModules: setup.hiddenModules || [],
      terminology: setup.terminology || {},
      favouriteCodes: setup.favouriteCodes || {},
      specialtySettings: setup.specialtySettings || {},
      visibleReports: setup.visibleReports || null,
      appliedPacks: setup.appliedPacks || [],
      // An admin can always re-show what a pack hid. The pack sets defaults, not limits.
      pinnedModules: setup.pinnedModules || [],
      steps: STEPS,
    });
  } catch (err) { fail(res, err, 'to read setup state'); }
});

// PUT /api/practice-setup/state — per-step save, so the wizard is resumable.
router.put('/state', authorize('admin'), async (req, res) => {
  const { currentStep, specialtyCodes, completed, skipped } = req.body || {};
  if (currentStep && !STEPS.includes(currentStep)) {
    return res.status(400).json({ error: `currentStep must be one of: ${STEPS.join(', ')}` });
  }
  if (specialtyCodes !== undefined && !Array.isArray(specialtyCodes)) {
    return res.status(400).json({ error: 'specialtyCodes must be an array' });
  }
  try {
    const db = db_(req);
    const practiceId = practiceId_(req);
    await getPractice(db, practiceId);

    const onboarding = {};
    if (currentStep) onboarding.currentStep = currentStep;
    if (completed === true) onboarding.completedAt = new Date().toISOString();
    if (skipped === true) onboarding.skipped = true;
    if (skipped === false) onboarding.skipped = false;

    const { rows } = await db.query(
      `UPDATE public.practices
          SET setup = COALESCE(setup, '{}'::jsonb)
                      || jsonb_build_object(
                           'onboarding',
                           COALESCE(setup -> 'onboarding', '{}'::jsonb)
                             || jsonb_build_object('startedAt',
                                  COALESCE(setup -> 'onboarding' -> 'startedAt', to_jsonb(now()::text)))
                             || $2::jsonb
                         )
                      || CASE WHEN $3::jsonb IS NULL THEN '{}'::jsonb
                              ELSE jsonb_build_object('specialtyCodes', $3::jsonb) END,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING setup`,
      [practiceId, JSON.stringify(onboarding),
       specialtyCodes === undefined ? null : JSON.stringify(specialtyCodes)]
    );
    res.json(rows[0].setup);
  } catch (err) { fail(res, err, 'to save setup state'); }
});

// ─── catalogue ───────────────────────────────────────────────────────────────────────

// GET /api/practice-setup/specialties — the taxonomy, with the pack (if any) per entry.
router.get('/specialties', async (req, res) => {
  try {
    const { rows } = await db_(req).query(
      `SELECT s.code, s.name, s.parent_code, s.sort_order,
              p.version AS pack_version, p.label AS pack_label,
              p.clinical_review_status
         FROM public.specialties s
         LEFT JOIN LATERAL (
           SELECT version, label, clinical_review_status
             FROM public.specialty_packs
            WHERE code = s.code AND is_active = true
            ORDER BY version DESC LIMIT 1
         ) p ON true
        WHERE s.is_active = true
        ORDER BY s.sort_order, s.name`
    );
    res.json(rows.map((r) => ({
      code: r.code, name: r.name, parentCode: r.parent_code,
      hasPack: r.pack_version !== null,
      packVersion: r.pack_version,
      packLabel: r.pack_label,
      clinicalReviewStatus: r.clinical_review_status,
    })));
  } catch (err) { fail(res, err, 'to list specialties'); }
});

// GET /api/practice-setup/packs
router.get('/packs', async (req, res) => {
  try {
    res.json(await packs.listPacks(db_(req)));
  } catch (err) { fail(res, err, 'to list specialty packs'); }
});

// GET /api/practice-setup/footprint?code=dentistry
// What a pack put in this tenant, and what has since been edited.
router.get('/footprint', authorize('admin'), async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'code is required' });
  try {
    res.json({ code, rows: await packs.packFootprint(db_(req), code) });
  } catch (err) { fail(res, err, 'to read pack footprint'); }
});

// ─── preview and apply ───────────────────────────────────────────────────────────────

/** Resolve the requested pack(s) into one definition, merging for multi-specialty. */
async function resolve(db, codes) {
  const list = [];
  for (const code of codes) list.push(await packs.loadPack(db, code));
  if (list.length === 1) return { pack: list[0], clashes: [] };
  const { definition, clashes } = packs.mergePacks(list);
  // The merged pseudo-pack carries the primary's identity: that is what rows get stamped
  // with, and what an upgrade later matches on.
  const worstReview = list.some((p) => p.clinical_review_status !== 'approved') ? 'pending' : 'approved';
  return {
    pack: {
      ...list[0],
      definition,
      clinical_review_status: worstReview,
      label: list.map((p) => p.label || p.code).join(' + '),
    },
    clashes,
  };
}

function readCodes(req) {
  const raw = req.body && req.body.specialtyCodes;
  const codes = Array.isArray(raw) ? raw.filter(Boolean) : (raw ? [raw] : []);
  if (!codes.length) {
    throw packs.packError(400, 'NoSpecialty', 'Choose at least one specialty.');
  }
  if (codes.length > 6) {
    throw packs.packError(400, 'TooManySpecialties',
      'Six specialties is the most that can be merged at once. Apply the rest afterwards.');
  }
  return codes;
}

// POST /api/practice-setup/preview { specialtyCodes: [...] }
// Writes nothing. This is the diff the wizard shows at step 6.
router.post('/preview', authorize('admin'), async (req, res) => {
  try {
    const db = db_(req);
    const codes = readCodes(req);
    const { pack, clashes } = await resolve(db, codes);
    const diff = await packs.applyPack(db, pack, {
      mode: 'preview', practiceId: practiceId_(req),
    });
    res.json({ ...diff, specialtyCodes: codes, mergeClashes: clashes });
  } catch (err) { fail(res, err, 'to preview the specialty pack'); }
});

// POST /api/practice-setup/apply
// { specialtyCodes: [...], mode: 'seed'|'upgrade', acknowledgeUnreviewed: bool }
router.post('/apply', authorize('admin'), async (req, res) => {
  const mode = (req.body && req.body.mode) || 'seed';
  if (!['seed', 'upgrade'].includes(mode)) {
    return res.status(400).json({ error: "mode must be 'seed' or 'upgrade'" });
  }
  try {
    const db = db_(req);
    const practiceId = practiceId_(req);
    const codes = readCodes(req);

    const out = await withTx(db, async () => {
      const { pack, clashes } = await resolve(db, codes);
      const diff = await packs.applyPack(db, pack, {
        mode, practiceId, actorId: req.user.id,
        acknowledgeUnreviewed: Boolean(req.body && req.body.acknowledgeUnreviewed),
      });

      await db.query(
        `UPDATE public.practices
            SET setup = COALESCE(setup, '{}'::jsonb)
                        || jsonb_build_object('specialtyCodes', $2::jsonb),
                updated_at = CURRENT_TIMESTAMP
          WHERE id = $1`,
        [practiceId, JSON.stringify(codes)]
      );

      // Attributable: creating a practice's whole service catalogue is exactly the kind of
      // act an audit trail is for. Wrapped in a SAVEPOINT because a failed statement aborts
      // the transaction in Postgres — a bare catch would lose the apply to the code meant
      // to record it.
      await db.query('SAVEPOINT pack_apply_audit');
      try {
        await db.query(
          `INSERT INTO audit_logs (
             user_id, user_email, user_role, action_type, resource_type, resource_name,
             resource_id, action_description, module, status, metadata
           ) VALUES ($1,$2,$3,'update','practice','practice',$4,$5,'Practice Setup','success',$6)`,
          [req.user.id, req.user.email || null, req.user.role || null, String(practiceId),
           `Applied specialty pack(s) ${codes.join(', ')} in ${mode} mode`,
           JSON.stringify({
             specialtyCodes: codes, mode, summary: diff.summary,
             reviewStatus: diff.reviewStatus,
           })]
        );
        await db.query('RELEASE SAVEPOINT pack_apply_audit');
      } catch (e) {
        await db.query('ROLLBACK TO SAVEPOINT pack_apply_audit');
        console.error('[practiceSetup] FAILED to audit pack application:', e.message);
      }

      return { ...diff, specialtyCodes: codes, mergeClashes: clashes };
    });
    res.json(out);
  } catch (err) { fail(res, err, 'to apply the specialty pack'); }
});

// ─── module visibility overrides ─────────────────────────────────────────────────────

// PUT /api/practice-setup/modules { pinnedModules: [...] }
//
// A pack sets defaults, never limits. An administrator can re-show anything it hid, and
// "show everything" is one call — hiding modules a practice pays for with no way back
// would be both a support burden and lost upsell surface.
router.put('/modules', authorize('admin'), async (req, res) => {
  const { pinnedModules } = req.body || {};
  if (!Array.isArray(pinnedModules)) {
    return res.status(400).json({ error: 'pinnedModules must be an array of module ids' });
  }
  try {
    const db = db_(req);
    const practiceId = practiceId_(req);
    await getPractice(db, practiceId);
    const { rows } = await db.query(
      `UPDATE public.practices
          SET setup = COALESCE(setup, '{}'::jsonb) || jsonb_build_object('pinnedModules', $2::jsonb),
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 RETURNING setup`,
      [practiceId, JSON.stringify(pinnedModules)]
    );
    res.json({ pinnedModules: (rows[0].setup || {}).pinnedModules || [] });
  } catch (err) { fail(res, err, 'to update module visibility'); }
});

// PUT /api/practice-setup/terminology { terminology: {key: label} }
router.put('/terminology', authorize('admin'), async (req, res) => {
  const { terminology } = req.body || {};
  if (terminology === null || typeof terminology !== 'object' || Array.isArray(terminology)) {
    return res.status(400).json({ error: 'terminology must be an object of key/label pairs' });
  }
  for (const [k, v] of Object.entries(terminology)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(k) || typeof v !== 'string' || v.length > 120) {
      return res.status(400).json({
        error: 'InvalidTerminology',
        message: `"${k}" must be a translation key mapped to a label of 120 characters or fewer.`,
      });
    }
  }
  try {
    const db = db_(req);
    const practiceId = practiceId_(req);
    await getPractice(db, practiceId);
    const { rows } = await db.query(
      `UPDATE public.practices
          SET setup = COALESCE(setup, '{}'::jsonb) || jsonb_build_object('terminology', $2::jsonb),
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 RETURNING setup`,
      [practiceId, JSON.stringify(terminology)]
    );
    res.json({ terminology: (rows[0].setup || {}).terminology || {} });
  } catch (err) { fail(res, err, 'to update terminology'); }
});

module.exports = router;
