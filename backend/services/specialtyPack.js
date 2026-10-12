// Specialty pack application.
//
// One entry point, three modes, and a single rule that everything else follows from:
//
//     a pack NEVER overwrites a row the practice has edited.
//
// That is what `is_customised` (tenant/007) exists for, and it is why this engine reports
// conflicts instead of resolving them. A configuration system that silently reverts a
// practice's own edits on upgrade is worse than one that does nothing.
//
// A second, quieter rule: a row the pack did not create is not the pack's to claim. If a
// practice already has an offering called "Scaling & Polishing" and a pack wants to seed
// one, the existing row is left alone and reported — stamping it with source_pack would
// hand the pack ownership of something it never put there, and the next upgrade would
// then feel entitled to rewrite it.
//
// Preview mode writes nothing and returns exactly the diff the wizard shows before an
// administrator presses Apply.

const MODES = ['preview', 'seed', 'upgrade'];

/** Sections that land in rows, with their natural key and the table behind them. */
const TABLE_SECTIONS = [
  { section: 'serviceCategories',  table: 'service_categories',   key: 'name' },
  { section: 'appointmentTypes',   table: 'appointment_types',    key: 'name' },
  { section: 'offerings',          table: 'healthcare_offerings', key: 'name' },
  { section: 'formTemplates',      table: 'form_templates',       key: 'slug' },
  { section: 'inventoryCategories', table: 'inventory_categories', key: 'code' },
];

function packError(status, code, message, extra = {}) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  Object.assign(err, extra);
  return err;
}

/** The newest version of a pack, or a specific one. */
async function loadPack(pool, code, version = null) {
  const { rows } = await pool.query(
    version
      ? `SELECT * FROM public.specialty_packs WHERE code = $1 AND version = $2`
      : `SELECT * FROM public.specialty_packs
          WHERE code = $1 AND is_active = true
          ORDER BY version DESC LIMIT 1`,
    version ? [code, version] : [code]
  );
  if (!rows.length) {
    throw packError(404, 'PackNotFound',
      `No ${version ? `version ${version} of ` : 'active '}specialty pack "${code}" is published.`);
  }
  return rows[0];
}

async function listPacks(pool) {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (p.code)
            p.code, p.version, p.label, p.clinical_review_status, p.reviewed_by, p.published_at,
            s.name AS specialty_name, s.parent_code
       FROM public.specialty_packs p
       LEFT JOIN public.specialties s ON s.code = p.code
      WHERE p.is_active = true
      ORDER BY p.code, p.version DESC`
  );
  return rows;
}

/** Row values the pack wants, per section. Returns null for sections handled elsewhere. */
function rowFor(section, item, ctx) {
  switch (section) {
    case 'serviceCategories':
      return {
        name: item.name,
        description: item.description ?? null,
        icon: item.icon ?? null,
        color: item.color ?? null,
        display_order: item.displayOrder ?? 0,
        is_active: true,
      };
    case 'appointmentTypes':
      return {
        name: item.name,
        description: item.description ?? null,
        duration_minutes: item.durationMinutes ?? 30,
        color: item.color ?? '#3B82F6',
        display_order: item.displayOrder ?? 0,
        is_active: true,
      };
    case 'offerings':
      return {
        name: item.name,
        description: item.description ?? null,
        category_id: item.categoryName ? (ctx.categoryIds[item.categoryName] ?? null) : null,
        duration_minutes: item.durationMinutes ?? null,
        cpt_codes: item.cptCodes ?? null,
        icd_codes: item.icdCodes ?? null,
        hcpcs_codes: item.hcpcsCodes ?? null,
        min_age: item.minAge ?? null,
        max_age: item.maxAge ?? null,
        gender_restriction: item.genderRestriction === 'any' ? null : (item.genderRestriction ?? null),
        requires_preparation: item.requiresPreparation ?? false,
        preparation_instructions: item.preparationInstructions ?? null,
        consent_form_required: item.consentFormRequired ?? false,
        is_active: true,
      };
    case 'formTemplates': {
      // Fields reach the database exactly as the pack declares them. `id` is mandatory and
      // checked at load time (utils/specialtyPackSchema.js) rather than patched here — the
      // renderer keys submitted data by it, so a silent fix-up would hide a real mistake.
      const fields = item.fields ?? [];
      return {
        slug: item.slug,
        name: item.name,
        description: item.description ?? null,
        template_type: item.templateType ?? null,
        category_slug: item.categorySlug ?? null,
        subcategory: item.subcategory ?? null,
        specialty: ctx.pack.code,
        fields: JSON.stringify(fields),
        settings: JSON.stringify(item.settings ?? {}),
        require_signature: item.requireSignature ?? false,
        require_witness: item.requireWitness ?? false,
        allow_pdf_export: item.allowPdfExport ?? true,
        intake_flow_eligible: item.intakeFlowEligible ?? true,
        languages: JSON.stringify(item.languages ?? ['en']),
        tags: JSON.stringify(item.tags ?? []),
        compliance_tags: JSON.stringify(item.complianceTags ?? []),
        version: item.version ?? '1.0',
        version_number: parseInt(item.version, 10) || 1,
        is_system_template: true,
        is_active: true,
      };
    }
    case 'inventoryCategories':
      return {
        code: String(item.code).toLowerCase(),
        name: item.name,
        description: item.description ?? null,
        is_active: true,
      };
    default:
      return null;
  }
}

/** Which of a row's pack-managed values differ from what the pack now wants. */
function changedFields(existing, wanted) {
  const diffs = [];
  for (const [col, val] of Object.entries(wanted)) {
    const was = existing[col];
    const a = was === null || was === undefined ? null : (typeof was === 'object' ? JSON.stringify(was) : String(was));
    const b = val === null || val === undefined ? null : String(val);
    if (a !== b) diffs.push(col);
  }
  return diffs;
}

/**
 * Apply (or preview) a pack against the caller's tenant.
 *
 * @param {object} db        req.db — tenant-scoped. Caller supplies an open transaction
 *                           for 'seed' and 'upgrade'.
 * @param {object} pack      the pack ROW from public.specialty_packs
 * @param {object} opts      { mode, practiceId, actorId, acknowledgeUnreviewed }
 * @returns {Promise<object>} the diff, plus what was written
 */
async function applyPack(db, pack, opts = {}) {
  const { mode = 'preview', practiceId = null, actorId = null, acknowledgeUnreviewed = false } = opts;
  if (!MODES.includes(mode)) {
    throw packError(400, 'UnknownMode', `mode must be one of: ${MODES.join(', ')}`);
  }

  const def = pack.definition || {};
  const write = mode !== 'preview';

  // Clinical content needs clinical sign-off. A pending pack can still be applied — the
  // product would be unusable otherwise — but only deliberately, and the fact is carried
  // all the way back to the caller rather than buried.
  const unreviewed = pack.clinical_review_status !== 'approved';
  if (write && unreviewed && !acknowledgeUnreviewed) {
    throw packError(409, 'ClinicalReviewPending',
      `Pack "${pack.code}" v${pack.version} has not had clinical review. Its services, codes and forms are engineering drafts. Re-send with acknowledgeUnreviewed to apply it anyway.`,
      { reviewStatus: pack.clinical_review_status });
  }

  const result = {
    pack: { code: pack.code, version: pack.version, label: pack.label },
    mode,
    reviewStatus: pack.clinical_review_status,
    creates: [],
    updates: [],
    skips: [],
    conflicts: [],
    settings: null,
    applied: write,
  };

  // Categories first: offerings reference them by name, so their ids have to exist (or be
  // known) before the offerings pass runs.
  const ctx = { pack, categoryIds: {} };
  {
    const { rows } = await db.query('SELECT id, name FROM service_categories');
    rows.forEach((r) => { ctx.categoryIds[r.name] = r.id; });
  }

  for (const { section, table, key } of TABLE_SECTIONS) {
    const items = Array.isArray(def[section]) ? def[section] : [];
    for (const item of items) {
      const wanted = rowFor(section, item, ctx);
      if (!wanted) continue;
      const keyValue = wanted[key];
      const label = `${section}: ${item.name || keyValue}`;

      const { rows: found } = await db.query(
        `SELECT * FROM ${table} WHERE ${key} = $1 LIMIT 1`, [keyValue]
      );

      // ── absent: create ──
      if (!found.length) {
        if (write) {
          const cols = [...Object.keys(wanted), 'source_pack', 'source_pack_version'];
          const vals = [...Object.values(wanted), pack.code, pack.version];
          const ph = vals.map((_, i) => `$${i + 1}`).join(', ');
          const { rows: made } = await db.query(
            `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${ph}) RETURNING ${key}`, vals
          );
          if (section === 'serviceCategories') {
            const { rows: back } = await db.query('SELECT id, name FROM service_categories WHERE name = $1', [keyValue]);
            if (back.length) ctx.categoryIds[keyValue] = back[0].id;
          }
          result.creates.push({ section, table, key: made[0][key], label });
        } else {
          result.creates.push({ section, table, key: keyValue, label });
        }
        continue;
      }

      const existing = found[0];

      // ── the practice edited it: never touch ──
      if (existing.is_customised) {
        result.conflicts.push({
          section, table, key: keyValue, label, reason: 'customised',
          message: `"${label}" has been edited in this practice, so the pack left it alone.`,
        });
        continue;
      }

      // ── not ours: never adopt ──
      if (!existing.source_pack) {
        result.conflicts.push({
          section, table, key: keyValue, label, reason: 'pre_existing',
          message: `"${label}" already exists and was not created by a pack, so it was left alone.`,
        });
        continue;
      }
      if (existing.source_pack !== pack.code) {
        result.conflicts.push({
          section, table, key: keyValue, label, reason: 'other_pack',
          message: `"${label}" belongs to the "${existing.source_pack}" pack, so the "${pack.code}" pack left it alone.`,
          otherPack: existing.source_pack,
        });
        continue;
      }

      // ── ours, untouched ──
      const diffs = changedFields(existing, wanted);
      if (mode === 'seed' || diffs.length === 0) {
        result.skips.push({ section, table, key: keyValue, label });
        continue;
      }

      if (write) {
        const cols = Object.keys(wanted);
        const sets = cols.map((c, i) => `${c} = $${i + 1}`);
        const vals = Object.values(wanted);
        vals.push(pack.version);
        sets.push(`source_pack_version = $${vals.length}`);
        vals.push(keyValue);
        await db.query(
          `UPDATE ${table} SET ${sets.join(', ')} WHERE ${key} = $${vals.length}`, vals
        );
      }
      result.updates.push({ section, table, key: keyValue, label, fields: diffs });
    }
  }

  // ── the non-row sections ──
  //
  // modules.hide, terminology, settings, codeSets and reports are not rows; they are this
  // practice's resolved configuration, and they live in public.practices.setup. NOT in
  // organization_settings, which is a single row shared by every tenant (see migration
  // 085).
  const setup = {
    hiddenModules: (def.modules && def.modules.hide) || [],
    terminology: def.terminology || {},
    favouriteCodes: def.codeSets || {},
    reports: (def.reports && def.reports.show) || null,
    settings: def.settings || {},
  };
  result.settings = setup;

  if (write && practiceId) {
    // jsonb_strip_nulls + || merge: later packs add to earlier ones for the additive maps,
    // and appliedPacks is an audit trail of what has been applied, in order.
    await db.query(
      `UPDATE public.practices
          SET setup = jsonb_strip_nulls(
                COALESCE(setup, '{}'::jsonb)
                || jsonb_build_object(
                     'hiddenModules', $2::jsonb,
                     'terminology',   COALESCE(setup -> 'terminology', '{}'::jsonb) || $3::jsonb,
                     'favouriteCodes', COALESCE(setup -> 'favouriteCodes', '{}'::jsonb) || $4::jsonb,
                     'specialtySettings', COALESCE(setup -> 'specialtySettings', '{}'::jsonb) || $5::jsonb,
                     'visibleReports', $7::jsonb,
                     'appliedPacks',  COALESCE(setup -> 'appliedPacks', '[]'::jsonb) || $6::jsonb
                   )
              ),
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [
        practiceId,
        JSON.stringify(setup.hiddenModules),
        JSON.stringify(setup.terminology),
        JSON.stringify(setup.favouriteCodes),
        JSON.stringify(setup.settings),
        JSON.stringify([{
          code: pack.code, version: pack.version, mode,
          reviewStatus: pack.clinical_review_status,
          appliedAt: new Date().toISOString(),
          appliedBy: actorId,
        }]),
        setup.reports === null ? null : JSON.stringify(setup.reports),
      ]
    );
  }

  result.summary = {
    created: result.creates.length,
    updated: result.updates.length,
    skipped: result.skips.length,
    conflicts: result.conflicts.length,
  };
  return result;
}

/**
 * Merge several packs for a multi-specialty practice.
 *
 * Union for the additive sections, primary-pack-wins for scalars and terminology, and
 * every clash reported rather than resolved silently — a hospital that picks cardiology and
 * paediatrics should be told which of the two decided its appointment durations.
 */
function mergePacks(packs) {
  if (!packs.length) throw packError(400, 'NoPacks', 'At least one pack is required');
  const [primary, ...rest] = packs;
  const merged = {
    code: primary.code,
    version: primary.version,
    label: primary.label,
    ...JSON.parse(JSON.stringify(primary.definition || {})),
  };
  const clashes = [];

  for (const pack of rest) {
    const def = pack.definition || {};

    for (const { section, key } of TABLE_SECTIONS) {
      if (!Array.isArray(def[section])) continue;
      merged[section] = merged[section] || [];
      const seen = new Set(merged[section].map((r) => r[key] ?? r.name));
      for (const row of def[section]) {
        const id = row[key] ?? row.name;
        if (seen.has(id)) {
          clashes.push({ section, key: id, keptFrom: primary.code, alsoIn: pack.code });
        } else {
          merged[section].push(row);
          seen.add(id);
        }
      }
    }

    // Hiding is an intersection, not a union: a module is only hidden when EVERY chosen
    // specialty wants it hidden. A cardiology pack hiding `rcm` must not take billing away
    // from a hospital that also does oncology and bills for it.
    if (def.modules && def.modules.hide) {
      const mine = new Set(merged.modules && merged.modules.hide ? merged.modules.hide : []);
      const theirs = new Set(def.modules.hide);
      merged.modules = { hide: [...mine].filter((m) => theirs.has(m)) };
    } else if (merged.modules) {
      merged.modules = { hide: [] };
    }

    for (const scalarSection of ['terminology', 'settings']) {
      if (!def[scalarSection]) continue;
      merged[scalarSection] = merged[scalarSection] || {};
      for (const [k, v] of Object.entries(def[scalarSection])) {
        if (Object.prototype.hasOwnProperty.call(merged[scalarSection], k)) {
          if (merged[scalarSection][k] !== v) {
            clashes.push({ section: scalarSection, key: k, keptFrom: primary.code, alsoIn: pack.code });
          }
        } else {
          merged[scalarSection][k] = v;
        }
      }
    }

    if (def.codeSets) {
      merged.codeSets = merged.codeSets || {};
      for (const [system, list] of Object.entries(def.codeSets)) {
        merged.codeSets[system] = [...new Set([...(merged.codeSets[system] || []), ...list])];
      }
    }
  }

  return { definition: merged, clashes };
}

/** What a pack put in this tenant, and what has since been customised. */
async function packFootprint(db, packCode) {
  const out = [];
  for (const { section, table, key } of TABLE_SECTIONS) {
    const { rows } = await db.query(
      `SELECT ${key} AS k, source_pack_version, is_customised
         FROM ${table} WHERE source_pack = $1 ORDER BY ${key}`,
      [packCode]
    );
    rows.forEach((r) => out.push({
      section, table, key: r.k, version: r.source_pack_version, customised: r.is_customised,
    }));
  }
  return out;
}

module.exports = {
  MODES,
  TABLE_SECTIONS,
  packError,
  loadPack,
  listPacks,
  applyPack,
  mergePacks,
  packFootprint,
};
