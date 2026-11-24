# Data import — CSV and API

Bring a clinic's data into AureonCare from another system: by hand with a CSV or Excel file
(Settings → Import Data), or automatically through the API with a practice API key. Both use
the same published format and the same checks.

What can be imported, in this order: **suppliers → products & stock → services & prices →
insurers → patients → appointments.**

The format below is generated from the server's definition (`backend/services/dataImport`).
The authoritative, machine-readable copy is always served at **`GET /api/import/formats`**
(no sign-in needed), and a CSV template per kind at **`GET /api/import/templates/{kind}.csv`**.
Settings → Import Data also offers each template as **Excel (.xlsx)**, and one workbook with every
kind plus a "Read me" sheet.

## Rules

- **All or nothing.** Every row is checked first. If any row has a problem, nothing is written
  and every problem is returned with its row number (1 = first row under the header) and column.
- **Re-runnable.** Each kind matches existing records on its key — suppliers and services on
  `name` (not case-sensitive), products on `sku`, insurers on `payer_id`, patients on `mrn`,
  appointments on `patient_mrn` + `start_time`. Sending the same data twice adds nothing twice.
- **Modes.** `upsert` (default) updates matched records; `create_only` leaves them unchanged.
- **Empty cells never erase** stored values when updating.
- **Dry run.** `dryRun: true` checks everything and reports what would happen; nothing is written.
- **Order.** Import patients first; appointments refer to them by MRN.
- **Limits.** 5,000 rows per request; CSV body up to 10 MB. Split larger imports into batches.
- **Files.** CSV (UTF-8; comma- or semicolon-separated; quoted cells may contain the separator
  or line breaks) or Excel .xlsx / .xls on the Import Data screen — the sheet named after the kind,
  else the first sheet; Excel dates are read as dates. The API takes CSV or JSON; Excel is read in
  the browser, so the server never opens spreadsheet files.
- **Numbers** accept a decimal point or a decimal comma (`6.50` or `6,50`); **yes/no** columns
  accept yes/no, true/false, 1/0, sí, oui, ja, nein.
- **Products:** `quantity_on_hand` is the opening stock, set only when the product is created; a
  later import never overwrites stock. Categories that do not exist are created; the `supplier`
  must exist (import suppliers first).
- **Services:** `price` is the standard price; re-importing updates it. Header names are not case-sensitive; unknown columns are ignored
  and listed in the response.
- **Patients** are imported without portal accounts; invite them from the patient record.
  The plan's patient limit applies to new patients.
- **Appointments**: times are the clinic's local time (`YYYY-MM-DDTHH:MM`); `timezone` names it.
  `provider_email` must belong to a provider who is a member of this practice. With neither
  `end_time` nor `duration_minutes`, an appointment lasts 30 minutes.

## Format

### Suppliers (`suppliers`)

One row per supplier of stock. Matched on name (not case-sensitive). Import before products. Key: `name`.

| Column | Required | Type | Rules | Example |
|---|---|---|---|---|
| `name` | **yes** | text | max 200 chars; Supplier name, unique in the practice | `MedSupply Iberia` |
| `contact_name` |  | text | max 200 chars | `Lucia Ortega` |
| `email` |  | email | max 255 chars | `orders@medsupply.example` |
| `phone` |  | text | max 50 chars | `+34 910 000 000` |
| `address` |  | text | max 500 chars | `Calle Industria 4` |
| `city` |  | text | max 100 chars | `Madrid` |
| `country` |  | text | max 100 chars | `ES` |
| `payment_terms` |  | enum | one of: net_30, net_60, net_90, immediate, custom; net_30, net_60, net_90, immediate or custom | `net_30` |
| `tax_id` |  | text | max 50 chars; VAT or tax number | `ESB12345678` |
| `notes` |  | text | max 2000 chars | `Delivers Tuesdays` |
| `status` |  | enum | one of: active, inactive; active (default) or inactive | `active` |

### Products & stock (`products`)

One row per stock item (medicines, consumables, retail products). Matched on sku. quantity_on_hand is the opening stock, set only when the product is created. Key: `sku`.

| Column | Required | Type | Rules | Example |
|---|---|---|---|---|
| `sku` | **yes** | text | max 100 chars; Your product code — unique; used to match on re-import | `GLV-NIT-M` |
| `name` | **yes** | text | max 255 chars | `Nitrile gloves, medium` |
| `item_type` | **yes** | enum | one of: medication, supply, equipment, consumable, reagent, implant, other; medication, supply, equipment, consumable, reagent, implant or other | `consumable` |
| `unit_of_measure` | **yes** | enum | one of: unit, pack, box, kg, g, l, ml, each, dozen, case; unit, pack, box, kg, g, l, ml, each, dozen or case | `box` |
| `unit_cost` | **yes** | number | ≥ 0; What you pay per unit | `6.50` |
| `selling_price` |  | number | ≥ 0; Price to patients, if sold |  |
| `quantity_on_hand` |  | number | ≥ 0; Opening stock (only when the product is new) | `40` |
| `reorder_level` |  | number | ≥ 0; Alert when stock falls to this | `10` |
| `reorder_quantity` |  | number | ≥ 0 | `50` |
| `category` |  | text | max 100 chars; Created if it does not exist | `Consumables` |
| `supplier` |  | text | max 200 chars; Supplier name — must exist (import suppliers first) | `MedSupply Iberia` |
| `barcode` |  | text | max 100 chars | `8412345678901` |
| `lot_number` |  | text | max 100 chars | `L2611` |
| `expiry_date` |  | date | YYYY-MM-DD | `2027-06-30` |
| `requires_refrigeration` |  | bool | yes or no | `no` |
| `description` |  | text | max 2000 chars | `Powder-free` |
| `status` |  | enum | one of: active, inactive, discontinued; active (default), inactive or discontinued | `active` |

### Services & prices (`services`)

One row per service you offer (consultations, treatments). Matched on name (not case-sensitive). price becomes the standard price. Key: `name`.

| Column | Required | Type | Rules | Example |
|---|---|---|---|---|
| `name` | **yes** | text | max 255 chars | `Initial consultation` |
| `price` |  | number | ≥ 0; Standard price, in the practice currency | `60` |
| `duration_minutes` |  | int | 5–720 | `30` |
| `category` |  | text | max 100 chars; Created if it does not exist | `Consultations` |
| `description` |  | text | max 2000 chars | `First visit with history and examination` |
| `available_online` |  | bool | yes (default) or no — bookable online | `yes` |
| `requires_referral` |  | bool | yes or no | `no` |
| `cpt_codes` |  | list | max 500 chars; US only; separate with ; or \| |  |
| `status` |  | enum | one of: active, inactive; active (default) or inactive | `active` |

### Insurers (`insurers`)

One row per insurer or payer. Matched on payer_id. Key: `payer_id`.

| Column | Required | Type | Rules | Example |
|---|---|---|---|---|
| `payer_id` | **yes** | text | max 50 chars; Your code for the insurer — unique | `SANITAS` |
| `name` | **yes** | text | max 255 chars | `Sanitas` |
| `payer_type` |  | enum | one of: insurance, government, self_pay, other; insurance (default), government, self_pay or other | `insurance` |
| `phone` |  | text | max 50 chars | `+34 900 000 000` |
| `email` |  | email | max 255 chars | `claims@sanitas.example` |
| `website` |  | text | max 255 chars | `https://www.sanitas.example` |
| `address` |  | text | max 500 chars |  |
| `city` |  | text | max 100 chars | `Madrid` |
| `state` |  | text | max 100 chars |  |
| `zip` |  | text | max 20 chars |  |
| `electronic_payer_id` |  | text | max 50 chars; US clearinghouse payer ID |  |
| `timely_filing_limit` |  | int | 1–3650; Days to submit a claim | `90` |
| `prior_authorization_required` |  | bool | yes or no | `no` |
| `notes` |  | text | max 2000 chars |  |
| `status` |  | enum | one of: active, inactive; active (default) or inactive | `active` |

### Patients (`patients`)

One row per patient. Matched on mrn: an existing MRN is updated (mode "upsert") or left as it is ("create_only"). Key: `mrn`.

| Column | Required | Type | Rules | Example |
|---|---|---|---|---|
| `mrn` | **yes** | text | max 50 chars; Medical record number — your old system's patient ID works well. Unique in the practice. | `P-10023` |
| `first_name` | **yes** | text | max 100 chars; Given name | `Maria` |
| `last_name` | **yes** | text | max 100 chars; Family name | `Lopez` |
| `date_of_birth` | **yes** | date | YYYY-MM-DD | `1984-03-17` |
| `gender` |  | enum | one of: male, female, other, unknown; male, female, other or unknown | `female` |
| `email` |  | email | max 255 chars; Unique among the practice's patients | `maria.lopez@example.com` |
| `phone` |  | text | max 30 chars; With country code, e.g. +34… | `+34 600 123 456` |
| `address` |  | text | max 500 chars; Street and number | `Calle Mayor 12` |
| `city` |  | text | max 100 chars | `Madrid` |
| `state` |  | text | max 100 chars; State, province or region | `Madrid` |
| `zip` |  | text | max 20 chars; Postal code | `28013` |
| `country` |  | text | max 100 chars; Two-letter code (ES, DE, US…) or name | `ES` |
| `insurance` |  | text | max 255 chars; Insurer or plan name | `Sanitas` |
| `insurance_id` |  | text | max 100 chars; Member or policy number | `SAN-778812` |
| `allergies` |  | text | max 2000 chars | `Penicillin` |
| `current_medications` |  | text | max 2000 chars | `Metformin 500 mg twice daily` |
| `past_history` |  | text | max 5000 chars; Past medical history | `Type 2 diabetes since 2019` |
| `family_history` |  | text | max 5000 chars | `Father: hypertension` |
| `status` |  | enum | one of: active, inactive; active (default) or inactive | `active` |

### Appointments (`appointments`)

One row per appointment. The patient must exist (import patients first). Matched on patient + start time. Key: `patient_mrn + start_time`.

| Column | Required | Type | Rules | Example |
|---|---|---|---|---|
| `patient_mrn` | **yes** | text | max 50 chars; The patient's MRN, as imported | `P-10023` |
| `start_time` | **yes** | datetime | YYYY-MM-DDTHH:MM in the clinic's local time | `2026-12-01T09:30` |
| `end_time` |  | datetime | YYYY-MM-DDTHH:MM; or give duration_minutes | `2026-12-01T10:00` |
| `duration_minutes` |  | int | 5–720; Used when end_time is empty; 30 if both are empty | `30` |
| `provider_email` |  | email | max 255 chars; Email of a provider who is a member of this practice; empty = no provider | `dr.garcia@clinic.example` |
| `appointment_type` |  | text | max 100 chars; e.g. Consultation, Follow-up | `Follow-up` |
| `reason` |  | text | max 1000 chars | `Diabetes review` |
| `notes` |  | text | max 5000 chars | `Bring glucose diary` |
| `status` |  | enum | one of: scheduled, confirmed, completed, cancelled, no-show; scheduled (default), confirmed, completed, cancelled or no-show | `scheduled` |
| `timezone` |  | text | max 64 chars; IANA time zone of start_time, e.g. Europe/Madrid; empty = UTC | `Europe/Madrid` |

## API

### Authentication

An admin creates a key under **Settings → Import Data → Import by API**. The key is shown once;
only its hash is stored. Send it as `Authorization: Bearer ack_…` (or `X-API-Key: ack_…`).

A key belongs to one practice and has the `import` scope only: it can add and update patients
and appointments in that practice and nothing else. It cannot read records or manage keys.
Revoke it in the same screen; it stops working at once. Imports are recorded in the practice's
audit log, with the key's id.

A signed-in **admin** session can use the same endpoints (the web screen does).

### Endpoints

| Method | Path | Body | Purpose |
|---|---|---|---|
| GET | `/api/import/formats` | — | The format (JSON), no sign-in |
| GET | `/api/import/templates/{kind}.csv` | — | CSV template, no sign-in |
| POST | `/api/import/{kind}` | JSON `{ "rows": [ {…} ], "mode": "upsert", "dryRun": false }` or `{ "csv": "<text>", … }` | Import |
| POST | `/api/import/{kind}/csv?mode=upsert&dryRun=false` | the CSV file, `Content-Type: text/csv` | Import a file |
| GET / POST / DELETE | `/api/import/keys`, `/api/import/keys/{id}` | `{ "name": "…" }` | Manage keys (admin session only) |

`{kind}` is `suppliers`, `products`, `services`, `insurers`, `patients` or `appointments`.

### Responses

| Status | Meaning | Body |
|---|---|---|
| 200 | Checked (dry run) or imported | `{ "kind", "dryRun", "mode", "received", "created", "updated", "unchanged", "written", "ignoredColumns": [], "errors": [] }` |
| 422 | One or more rows have problems — **nothing written** | same, with `"errors": [ { "row": 2, "field": "date_of_birth", "message": "…" } ]` |
| 400 / 404 / 413 | Bad request, unknown kind, more than 5,000 rows | `{ "error": "…" }` |
| 401 / 403 | Missing, invalid or revoked key; signed in but not an admin | `{ "error": "…" }` |
| 402 | The practice's subscription is inactive (read-only) | `{ "error": "SubscriptionInactive", … }` |

### Examples

```bash
# Check a file without writing anything
curl -X POST "https://app.aureoncare.tech/api/import/patients/csv?dryRun=true" \
  -H "Authorization: Bearer $AUREONCARE_KEY" -H "Content-Type: text/csv" \
  --data-binary @patients.csv

# Import JSON rows (e.g. a nightly sync), leaving existing patients unchanged
curl -X POST "https://app.aureoncare.tech/api/import/patients" \
  -H "Authorization: Bearer $AUREONCARE_KEY" -H "Content-Type: application/json" \
  -d '{"mode":"create_only","rows":[{"mrn":"P-10023","first_name":"Maria","last_name":"Lopez","date_of_birth":"1984-03-17"}]}'

# Then the appointments
curl -X POST "https://app.aureoncare.tech/api/import/appointments/csv" \
  -H "Authorization: Bearer $AUREONCARE_KEY" -H "Content-Type: text/csv" \
  --data-binary @appointments.csv
```

## Moving from another system

Most systems export patients and appointments to CSV or Excel. Rename or reorder the columns to
match the template (any order works), save as CSV, run a dry run, fix what it lists, then import.
Clinical notes, letters and scans are not imported this way; attach them to each patient's
record as documents.

Setup: run migration `103_practice_api_keys.sql` (API keys). The CSV and JSON import itself needs
no migration.
