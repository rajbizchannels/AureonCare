# Specialty packs

A pack is the starting configuration for one medical specialty: its services, appointment
types, intake and consent forms, supply categories, code shortlists and terminology. The
wizard (`/api/practice-setup`) applies one or more to a practice.

```
backend/data/specialty-packs/<code>.v<N>.json   authored here
        ↓  npm run packs:load  (validates ALL, loads NOTHING if any fails)
public.specialty_packs                          the catalogue
        ↓  POST /api/practice-setup/apply
the tenant's own rows, each stamped source_pack / source_pack_version
```

## The one rule

**A pack never overwrites a row the practice has edited.** Every row a pack creates carries
`source_pack`, `source_pack_version` and `is_customised` (tenant migration 007). The moment
a user edits one through the API, `is_customised` becomes true and no later pack version
will touch it — the upgrade reports it as a conflict instead.

A pack also never *adopts* a row it did not create. If a practice already has an offering
called "Scaling & Polishing", a pack that wants to seed one leaves the existing row alone
and reports it. Stamping it would hand the pack ownership of something it never put there,
and the next upgrade would then feel entitled to rewrite it.

## A pack is data, not code

`backend/utils/specialtyPackSchema.js` enforces this; it is not a convention. A pack may
not contain:

- SQL, in any identifier-like field
- references to functions, files or modules
- role or permission definitions — authority is not configuration, and `roles` is a `public`
  table shared by every tenant, so a pack could not seed it per-practice anyway
- a `modules.show` list. Specialty may only ever **narrow** what the plan tier and the
  user's role already permit. A pack that could reveal a module would be an entitlement
  bypass dressed up as configuration.

The schema is **closed**: an unrecognised key is an error. A pack written against a newer
format must fail loudly rather than apply three of its five sections and leave the practice
half-configured.

Free prose (`description`, `preparationInstructions`, a field's `label` and `options`) is
exempt from the SQL scan. "Select the affected tooth" and "create a treatment plan" are
ordinary clinical English; flagging them would make the check something authors route
around rather than respect. Prose is never interpolated — every value reaches the database
as a bound parameter.

## Sections

| Section | Table | Natural key |
|---|---|---|
| `serviceCategories` | `service_categories` | `name` |
| `appointmentTypes` | `appointment_types` | `name` |
| `offerings` | `healthcare_offerings` | `name` |
| `formTemplates` | `form_templates` | `slug` |
| `inventoryCategories` | `inventory_categories` | `code` |

| Section | Where it lands |
|---|---|
| `modules.hide` | `practices.setup.hiddenModules` |
| `terminology` | `practices.setup.terminology` |
| `codeSets` | `practices.setup.favouriteCodes` |
| `settings` | `practices.setup.specialtySettings` |
| `reports.show` | `practices.setup.visibleReports` |

Per-practice state lives in **`public.practices.setup`**, not `organization_settings` —
that table holds a single row that every tenant shares, so anything per-practice written
there would leak across practices. See migration 085.

## Clinical review

CPT/ICD shortlists and clinical forms are regulated content. Every pack loads with
`clinical_review_status = 'pending'`, and:

- a pending pack **can** be applied — the product would be unusable otherwise — but only
  with `acknowledgeUnreviewed`, and the wizard makes the administrator tick a box saying
  they will check the content before clinical use
- `npm run packs:load` will not overwrite a version a clinician has already approved.
  Approval is attached to `(code, version)`, so edited content must get a **new version
  number**. Otherwise "approved" would mean "approved at some earlier, unknown content".

A clinician signs one off directly:

```sql
UPDATE public.specialty_packs
   SET clinical_review_status = 'approved', reviewed_by = 'Dr Name', reviewed_at = now()
 WHERE code = 'dentistry' AND version = 1;
```

## Authoring

1. Copy an existing file. `code` must be a row in `public.specialties`; `version` must be a
   positive integer and must increase whenever the content changes.
2. `npm run packs:load -- --dry-run` validates without writing.
3. `npm run packs:load` loads them.
4. `npm run test:specialty` covers the engine. Add a case if the pack exercises something
   new.

Offerings reference categories by `categoryName`, which must match a `serviceCategories`
entry in the same pack — the validator checks this, because an offering pointing at a
category nobody defined would silently land uncategorised and look like a seeding bug long
afterwards.

## Multi-specialty practices

Several packs merge, and the **first code chosen is primary**:

- additive sections (offerings, forms, categories, codes) **union**
- scalars and terminology: **primary wins**, and every clash is reported rather than
  resolved silently
- `modules.hide` **intersects**. A module is only hidden when *every* chosen specialty hides
  it — a cardiology pack hiding `rcm` must not take billing away from a hospital that also
  does oncology and bills for it.

## Form fields use `id`, not `name`

`DynamicFormRenderer` keys everything on `field.id` — `formData[field.id]`, the React key,
the change handler — so submitted form data is keyed by id. A field without one renders
with an undefined key and collides with every other such field. The validator rejects it.

The first three packs shipped with `name`, which made 57 fields unusable. There was briefly
an alias normalising `name` to `id` in the apply engine; it is gone, because no pack uses it
and untested code that papers over exactly the mistake a check exists to catch is worse
than the check alone.

## Shipped packs

| Code | Version | Review | Notes |
|---|---|---|---|
| `behavioral_health` | 1 | pending | PHQ-9, GAD-7 and intake, moved out of the base library |
| `dentistry` | 1, 2 | pending | v2 adds the dental health history form |
| `ophthalmology` | 1, 2 | pending | v2 is the field-key fix only; no content change |
| `paediatrics` | 1, 2 | pending | v2 adds the paediatric wellness intake |

Five form templates moved out of the base form library into these packs (tenant/009), so a
practice gets them because it does that specialty rather than because it exists. PHQ-9 and
GAD-7 are standardised instruments — the clinical-review gate matters especially for them,
since the item wording and scoring are part of the instrument's validity.

`backend/scripts/generate-form-library-migration.js --pack-forms <specialty>` converts a
template from the seed library into pack format, carrying every column. It was used for
those 71 field definitions; retyping them is the kind of job where a dropped
`required: true` on a consent checkbox never gets noticed.

All three are **engineering drafts**. The service names, durations, code shortlists and form
fields are plausible rather than authoritative, and need a clinician's eye per specialty
before a practice uses them with patients.
