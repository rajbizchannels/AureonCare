// Specialty pack validation.
//
// A pack is DATA, and this file is what makes that true rather than aspirational. It is a
// closed schema: an unrecognised key is an error, not something quietly ignored — a pack
// written against a newer format must fail loudly instead of applying three of its five
// sections and leaving the practice half-configured.
//
// What a pack may never contain, enforced here rather than left to review:
//   * SQL, in any field
//   * references to functions, files or modules
//   * role or permission definitions. Authority is not configuration. (And `roles` is a
//     public table shared by every tenant, so a pack could not seed it per-practice even
//     if we wanted it to.)
//   * a `modules.show` list. Specialty may only ever NARROW what the plan tier and the
//     user's role already permit; a pack that could reveal a module would be an
//     entitlement bypass dressed as configuration.

const SECTIONS = [
  'modules', 'terminology', 'appointmentTypes', 'serviceCategories', 'offerings',
  'formTemplates', 'codeSets', 'inventoryCategories', 'settings', 'reports',
];

const TOP_LEVEL = ['code', 'version', 'label', 'description', 'appliesTo', ...SECTIONS];

// Module ids the shell knows about (frontend/src/config/modules.js plus dashboard/admin).
const KNOWN_MODULES = [
  'dashboard', 'practiceManagement', 'providerManagement', 'ehr', 'telehealth', 'rcm',
  'accounts', 'inventory', 'messages', 'clinicalServices', 'formManagement', 'reports',
  'crm', 'integrations', 'patientPortal', 'offerings', 'camps', 'adminPanel',
];

// Looks like SQL or like a path/module reference. Deliberately blunt: a false positive on
// a pack label is a one-line edit, whereas a pack that can smuggle a statement into the
// applier is a remote-code-execution hole in a medical product.
const SQL_LIKE = /\b(select|insert|update|delete|drop|alter|create|truncate|grant|revoke|union|exec|execute|pg_|information_schema)\b/i;
const CODE_LIKE = /(\brequire\s*\(|\bimport\s+|=>|\$\{|\.\.\/|\bfunction\s*\(|;\s*--|\/\*)/;

const SLUG = /^[a-z0-9][a-z0-9_-]{0,59}$/;

// Form widget types the form engine renders. A closed vocabulary, so it is allowlisted
// rather than pattern-matched — which also keeps "select" from tripping the SQL check.
//
// This list is EXACTLY what frontend DynamicFormRenderer can draw and what
// DynamicFormBuilder offers. An earlier version of this file invented seven types nothing
// renders (time, datetime, multiselect, file, divider, yesno, and `checkboxgroup` for what
// the renderer calls `checkboxes`), so a pack could declare a field that validated cleanly
// and then appeared to the patient as a label with no input. Three consumers, one
// vocabulary: change it in all three or in none.
const FIELD_TYPES = [
  'text', 'textarea', 'select', 'radio', 'checkbox', 'checkboxes', 'date', 'number',
  'email', 'phone', 'scale', 'signature', 'heading', 'paragraph',
];

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Validate a pack definition.
 *
 * @param {object} pack
 * @param {{knownSpecialties?: string[]}} [opts] when given, `code` must be one of them
 * @returns {{valid: boolean, errors: string[]}}
 */
function validatePack(pack, opts = {}) {
  const errors = [];
  const err = (m) => errors.push(m);

  if (!isPlainObject(pack)) return { valid: false, errors: ['pack must be an object'] };

  // ── structure ──
  for (const key of Object.keys(pack)) {
    if (!TOP_LEVEL.includes(key)) {
      err(`unknown top-level key "${key}" — the pack schema is closed; add it to specialtyPackSchema.js first`);
    }
  }
  if (Object.prototype.hasOwnProperty.call(pack, 'roles')) {
    err('packs may not define roles: authority is not configuration, and `roles` is a public table shared by every tenant');
  }

  if (!SLUG.test(String(pack.code || ''))) {
    err('code must be a lowercase slug (a-z, 0-9, _ or -), 1-60 characters');
  } else if (Array.isArray(opts.knownSpecialties) && !opts.knownSpecialties.includes(pack.code)) {
    err(`code "${pack.code}" is not in public.specialties`);
  }
  if (!Number.isInteger(pack.version) || pack.version < 1) {
    err('version must be a positive integer');
  }
  if (pack.label !== undefined && (typeof pack.label !== 'string' || !pack.label.trim())) {
    err('label must be a non-empty string when present');
  }

  // ── no code in the identifier-ish fields ──
  //
  // Walked over the whole document rather than only the fields a section validator reads,
  // so a field added later cannot quietly become an injection surface.
  //
  // Free prose is EXEMPT, and deliberately so. "Select the affected tooth", "Create a
  // treatment plan" and "update the chart" are ordinary clinical English; flagging them
  // would make the check something authors route around rather than respect. Prose is
  // never interpolated — every value reaches the database as a bound parameter — so
  // scanning it buys nothing. The scan is defence in depth over the fields that behave
  // like identifiers.
  // Prose, plus the fields validated against a closed vocabulary further down. A form
  // field's `type` is "select", "text", "date" and so on: an allowlist is strictly more
  // precise there than a regex, and "select" is a perfectly ordinary widget name. `label`
  // and `options` are what the patient reads, so they are prose too.
  const PROSE_FIELDS = new Set([
    'description', 'preparationInstructions', 'instructions', 'notes', 'note',
    'help', 'helpText', 'placeholder', 'contraindications', 'prerequisites',
    'label', 'options', 'type',
  ]);
  const walk = (node, path, key) => {
    if (typeof node === 'string') {
      if (PROSE_FIELDS.has(key)) return;
      if (SQL_LIKE.test(node)) err(`${path}: looks like SQL — packs carry data, never statements`);
      if (CODE_LIKE.test(node)) err(`${path}: looks like code or a file/module reference`);
      return;
    }
    if (Array.isArray(node)) { node.forEach((v, i) => walk(v, `${path}[${i}]`, key)); return; }
    if (isPlainObject(node)) {
      for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`, k);
    }
  };
  walk(pack, 'pack', null);

  // ── sections ──
  const { modules } = pack;
  if (modules !== undefined) {
    if (!isPlainObject(modules)) err('modules must be an object');
    else {
      for (const key of Object.keys(modules)) {
        if (key !== 'hide') {
          err(`modules.${key} is not allowed — a pack may only "hide" modules, never reveal them`);
        }
      }
      if (modules.hide !== undefined) {
        if (!Array.isArray(modules.hide)) err('modules.hide must be an array');
        else {
          modules.hide.forEach((m, i) => {
            if (typeof m !== 'string') err(`modules.hide[${i}] must be a string`);
            else if (!KNOWN_MODULES.includes(m)) err(`modules.hide[${i}]: unknown module "${m}"`);
            else if (m === 'dashboard' || m === 'adminPanel') {
              err(`modules.hide[${i}]: "${m}" cannot be hidden — it would leave the practice with no way back`);
            }
          });
        }
      }
    }
  }

  if (pack.terminology !== undefined) {
    if (!isPlainObject(pack.terminology)) err('terminology must be an object of translation-key overrides');
    else {
      for (const [k, v] of Object.entries(pack.terminology)) {
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(k)) err(`terminology key "${k}" must be a translation key identifier`);
        if (typeof v !== 'string' || !v.trim()) err(`terminology.${k} must be a non-empty string`);
        if (String(v).length > 120) err(`terminology.${k} is too long for a label (max 120)`);
      }
    }
  }

  const arraySection = (name, validator) => {
    const v = pack[name];
    if (v === undefined) return;
    if (!Array.isArray(v)) { err(`${name} must be an array`); return; }
    v.forEach((row, i) => {
      if (!isPlainObject(row)) { err(`${name}[${i}] must be an object`); return; }
      validator(row, `${name}[${i}]`);
    });
  };

  const requireName = (row, path) => {
    if (typeof row.name !== 'string' || !row.name.trim()) err(`${path}.name is required`);
    else if (row.name.length > 255) err(`${path}.name is too long (max 255)`);
  };
  const optInt = (row, key, path, min, max) => {
    if (row[key] === undefined || row[key] === null) return;
    if (!Number.isInteger(row[key]) || row[key] < min || row[key] > max) {
      err(`${path}.${key} must be an integer between ${min} and ${max}`);
    }
  };

  arraySection('appointmentTypes', (row, path) => {
    requireName(row, path);
    optInt(row, 'durationMinutes', path, 1, 1440);
    optInt(row, 'displayOrder', path, 0, 9999);
    if (row.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(String(row.color))) {
      err(`${path}.color must be a #rrggbb hex colour`);
    }
  });

  arraySection('serviceCategories', (row, path) => {
    requireName(row, path);
    optInt(row, 'displayOrder', path, 0, 9999);
    if (row.color !== undefined && typeof row.color !== 'string') err(`${path}.color must be a string`);
    if (row.icon !== undefined && typeof row.icon !== 'string') err(`${path}.icon must be a string`);
  });

  arraySection('offerings', (row, path) => {
    requireName(row, path);
    optInt(row, 'durationMinutes', path, 1, 1440);
    optInt(row, 'minAge', path, 0, 130);
    optInt(row, 'maxAge', path, 0, 130);
    if (row.minAge != null && row.maxAge != null && row.minAge > row.maxAge) {
      err(`${path}: minAge is greater than maxAge`);
    }
    if (row.categoryName !== undefined && typeof row.categoryName !== 'string') {
      err(`${path}.categoryName must be a string naming an entry in serviceCategories`);
    }
    for (const codeKey of ['cptCodes', 'icdCodes', 'hcpcsCodes']) {
      if (row[codeKey] === undefined) continue;
      if (!Array.isArray(row[codeKey])) { err(`${path}.${codeKey} must be an array`); continue; }
      row[codeKey].forEach((c, j) => {
        if (typeof c !== 'string' || !/^[A-Za-z0-9.\-]{1,20}$/.test(c)) {
          err(`${path}.${codeKey}[${j}] is not a plausible code`);
        }
      });
    }
    if (row.genderRestriction !== undefined
        && !['male', 'female', 'any'].includes(String(row.genderRestriction))) {
      err(`${path}.genderRestriction must be male, female or any`);
    }
  });

  arraySection('formTemplates', (row, path) => {
    if (!SLUG.test(String(row.slug || ''))) err(`${path}.slug must be a lowercase slug`);
    requireName(row, path);
    if (row.templateType !== undefined && typeof row.templateType !== 'string') {
      err(`${path}.templateType must be a string`);
    }
    // The form_templates columns this section used to drop on the floor. Carrying them
    // matters: `requireWitness` on a consent form is a clinical property, `languages`
    // decides whether a patient is offered the form in their own language, and
    // `complianceTags` is what a HIPAA audit filters on. A pack that could not express
    // them could not be the home for a real template.
    for (const key of ['subcategory', 'categorySlug', 'version']) {
      if (row[key] !== undefined && typeof row[key] !== 'string') {
        err(`${path}.${key} must be a string`);
      }
    }
    for (const key of ['requireWitness', 'intakeFlowEligible', 'allowPdfExport']) {
      if (row[key] !== undefined && typeof row[key] !== 'boolean') {
        err(`${path}.${key} must be a boolean`);
      }
    }
    for (const key of ['languages', 'tags', 'complianceTags']) {
      if (row[key] === undefined) continue;
      if (!Array.isArray(row[key])) { err(`${path}.${key} must be an array of strings`); continue; }
      row[key].forEach((v, j) => {
        if (typeof v !== 'string' || !v.trim()) err(`${path}.${key}[${j}] must be a non-empty string`);
      });
    }
    if (row.languages !== undefined) {
      row.languages.forEach((l, j) => {
        if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(l)) err(`${path}.languages[${j}] must be a language code like "en" or "pt-BR"`);
      });
    }
    if (row.fields !== undefined) {
      if (!Array.isArray(row.fields)) err(`${path}.fields must be an array of field definitions`);
      else row.fields.forEach((f, j) => {
        if (!isPlainObject(f)) { err(`${path}.fields[${j}] must be an object`); return; }
        // `id`, NOT `name`, and required. DynamicFormRenderer keys everything on
        // field.id — formData[field.id], the React key, the change handler — so submitted
        // form data is keyed by id. A field without one renders with an undefined key and
        // collides with every other such field, which is how the first three packs shipped
        // with 57 unusable fields.
        //
        // `name` was briefly accepted as an alias and normalised by the apply engine. That
        // path is gone: no pack uses it, so it was untested code papering over exactly the
        // mistake this check exists to catch. Rejecting it at load time is better.
        if (typeof f.id !== 'string' || !f.id.trim()) {
          err(`${path}.fields[${j}].id is required — the form renderer keys submitted data by it`
            + (f.name ? ` (found "name": "${f.name}"; rename it to "id")` : ''));
        }
        if (typeof f.type !== 'string' || !FIELD_TYPES.includes(f.type)) {
          err(`${path}.fields[${j}].type must be one of: ${FIELD_TYPES.join(', ')}`);
        }
        if (f.options !== undefined && !Array.isArray(f.options)) {
          err(`${path}.fields[${j}].options must be an array`);
        }
        if (f.required !== undefined && typeof f.required !== 'boolean') {
          err(`${path}.fields[${j}].required must be a boolean`);
        }
      });
    }
    if (row.requireSignature !== undefined && typeof row.requireSignature !== 'boolean') {
      err(`${path}.requireSignature must be a boolean`);
    }
  });

  arraySection('inventoryCategories', (row, path) => {
    requireName(row, path);
    if (!SLUG.test(String(row.code || '').toLowerCase())) {
      err(`${path}.code is required and must be a slug (inventory_categories.code is NOT NULL)`);
    }
    // The COLUMN widths, not just the shape. A 22-character code passed every structural
    // check and then failed at apply time with `value too long for type character
    // varying(20)` — after the transaction had already written other rows. A pack that
    // validates must be a pack that applies.
    if (String(row.code || '').length > 20) {
      err(`${path}.code is ${row.code.length} characters; inventory_categories.code is varchar(20)`);
    }
    if (String(row.name || '').length > 100) {
      err(`${path}.name is ${row.name.length} characters; inventory_categories.name is varchar(100)`);
    }
  });

  if (pack.codeSets !== undefined) {
    if (!isPlainObject(pack.codeSets)) err('codeSets must be an object keyed by code system');
    else {
      for (const [system, list] of Object.entries(pack.codeSets)) {
        if (!['icd10', 'cpt', 'hcpcs', 'snomed', 'loinc'].includes(system)) {
          err(`codeSets.${system}: unknown code system`);
        }
        if (!Array.isArray(list)) { err(`codeSets.${system} must be an array`); continue; }
        list.forEach((c, i) => {
          if (typeof c !== 'string' || !/^[A-Za-z0-9.\-]{1,20}$/.test(c)) {
            err(`codeSets.${system}[${i}] is not a plausible code`);
          }
        });
      }
    }
  }

  if (pack.settings !== undefined) {
    if (!isPlainObject(pack.settings)) err('settings must be an object');
    else {
      // Scalars only. A pack that could write nested structures into a practice's setup
      // blob would be able to express far more than "defaults for this specialty".
      for (const [k, v] of Object.entries(pack.settings)) {
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(k)) err(`settings key "${k}" must be an identifier`);
        if (v !== null && !['string', 'number', 'boolean'].includes(typeof v)) {
          err(`settings.${k} must be a string, number, boolean or null`);
        }
      }
    }
  }

  if (pack.reports !== undefined) {
    if (!isPlainObject(pack.reports)) err('reports must be an object');
    else {
      for (const key of Object.keys(pack.reports)) {
        if (key !== 'show') err(`reports.${key} is not allowed — only "show" is supported`);
      }
      if (pack.reports.show !== undefined && !Array.isArray(pack.reports.show)) {
        err('reports.show must be an array');
      }
    }
  }

  if (pack.appliesTo !== undefined) {
    if (!Array.isArray(pack.appliesTo)) err('appliesTo must be an array of country codes');
    else pack.appliesTo.forEach((c, i) => {
      if (typeof c !== 'string' || !/^[A-Z]{2}$/.test(c)) {
        err(`appliesTo[${i}] must be a 2-letter uppercase ISO-3166 code`);
      }
    });
  }

  // An offering naming a category the pack does not define would silently land
  // uncategorised, which looks like a seeding bug long after the fact.
  if (Array.isArray(pack.offerings)) {
    const known = new Set((pack.serviceCategories || []).map((c) => c.name));
    pack.offerings.forEach((o, i) => {
      if (o && o.categoryName && !known.has(o.categoryName)) {
        err(`offerings[${i}].categoryName "${o.categoryName}" is not defined in serviceCategories`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validatePack, SECTIONS, KNOWN_MODULES, TOP_LEVEL, FIELD_TYPES };
