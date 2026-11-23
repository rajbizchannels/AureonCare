# Data import — CSV and API

Bring patients and appointments into AureonCare from another system: by hand with a CSV file
(Settings → Import Data), or automatically through the API with a practice API key. Both use
the same published format and the same checks.

The format below is generated from the server's definition (`backend/services/dataImport`).
The authoritative, machine-readable copy is always served at **`GET /api/import/formats`**
(no sign-in needed), and the CSV templates at **`GET /api/import/templates/patients.csv`** and
**`/api/import/templates/appointments.csv`**.

## Rules

- **All or nothing.** Every row is checked first. If any row has a problem, nothing is written
  and every problem is returned with its row number (1 = first row under the header) and column.
- **Re-runnable.** Patients are matched on `mrn`; appointments on `patient_mrn` + `start_time`.
  Sending the same data twice adds nothing twice.
- **Modes.** `upsert` (default) updates matched records; `create_only` leaves them unchanged.
- **Empty cells never erase** stored values when updating.
- **Dry run.** `dryRun: true` checks everything and reports what would happen; nothing is written.
- **Order.** Import patients first; appointments refer to them by MRN.
- **Limits.** 5,000 rows per request; CSV body up to 10 MB. Split larger imports into batches.
- **CSV.** UTF-8; comma- or semicolon-separated (European Excel); quoted cells may contain the
  separator or line breaks. Header names are not case-sensitive; unknown columns are ignored
  and listed in the response.
- **Patients** are imported without portal accounts; invite them from the patient record.
  The plan's patient limit applies to new patients.
- **Appointments**: times are the clinic's local time (`YYYY-MM-DDTHH:MM`); `timezone` names it.
  `provider_email` must belong to a provider who is a member of this practice. With neither
  `end_time` nor `duration_minutes`, an appointment lasts 30 minutes.

## Format

### patients

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

### appointments

One row per appointment. The patient must exist (import patients first, or in the same session). Matched on patient + start time. Key: `patient_mrn + start_time`.

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

`{kind}` is `patients` or `appointments`.

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
