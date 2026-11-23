# Audit Logging

**Contents.** How AureonCare records who did what: the per-practice `audit_logs` table and
why it is append-only, the server-side record of PHI reads, the frontend `useAudit` hook
with the patterns for forms, modals and views (every one of which now uses it), the audit
API, viewing and exporting logs in the Admin Panel, retention, and troubleshooting. It
merges the former `AUDIT_IMPLEMENTATION_GUIDE.md` and `AUDIT_LOGGING_SUMMARY.md` (a
progress log of the roll-out, now complete).

---

## 1. Where audit records live

| Trail | Table | Written by |
|---|---|---|
| Clinical / practice activity | `audit_logs` in **each tenant schema** (created by migration `040_create_audit_logs_table.sql`, now in `backend/migrations/history/global/`; moved into tenant schemas at the SEC-05 cut-over) | the frontend through `POST /api/audit`, and the backend for PHI reads |
| Platform operator actions | `control.audit_log` (migration 069) | the operator console (`logPlatformAction`) |

Each record carries the actor (`user_id`, plus `user_email`, `user_name`, `user_role`
denormalised), session, IP and user agent, `action_type` (`view`, `create`, `update`,
`delete`, `submit`, `open`, `close`, `error`), `resource_type` (`form`, `modal`, `view`),
`resource_name`, `resource_id`, `module`, related `patient_id` / `provider_id` /
`appointment_id` / `claim_id`, `old_values` / `new_values` / `changed_fields` for updates,
`status` and `error_message`, `metadata`, and an optional duration.

**Append-only (SEC-25).** Tenant migration 002 adds a `BEFORE UPDATE OR DELETE` trigger
(`audit_logs_no_mutate`) that rejects both: an audit trail the application can rewrite is
not evidence. Tenant migration 003 then dropped the foreign keys on `user_id`,
`patient_id` and `provider_id` — their `ON DELETE SET NULL` is an UPDATE, which the trigger
rejected, so deleting any user, patient or provider failed. The ids remain plain uuids that
may point at deleted rows; the denormalised name, email and role keep attribution intact.
Both are in `backend/migrations/history/tenant/` and part of the baseline.

**PHI reads are recorded server-side (SEC-25).** `backend/middleware/phiAccessLog.js`
(`auditPhiRead`) and `backend/services/phiAudit.js` log a successful (2xx) read *after* the
response is sent, so auditing adds no latency and a logging failure never breaks a clinical
read (it is logged loudly instead). It records the resource accessed, never the data
returned. It is mounted on the read routes of patients, medical records, diagnoses,
prescriptions, lab orders, sick notes and eligibility.

**Form actor integrity (SEC-51).** `backend/routes/form-management.js` takes the actor for
submissions, reviews, templates and the form audit log from the verified session
(`req.user`), never from client-supplied headers.

## 2. The `useAudit` hook — `frontend/src/hooks/useAudit.js`

```javascript
import { useAudit } from '../../hooks/useAudit';

const {
  logAudit, logFormView, logFormSubmit, logModalOpen, logModalClose, logViewAccess,
  logCreate, logUpdate, logDelete, logError, startAction,
} = useAudit();
```

| Function | Signature | Records |
|---|---|---|
| `startAction()` | — | starts the duration timer |
| `logFormView` | `(name, options)` | `view` of a form |
| `logFormSubmit` | `(name, options)` | `submit` |
| `logModalOpen` / `logModalClose` | `(name, options)` | `open` / `close` of a modal |
| `logViewAccess` | `(name, options)` | `view` of a page |
| `logCreate` | `(name, data, options)` | `create`, `new_values = data`, with duration |
| `logUpdate` | `(name, oldData, newData, options)` | `update`, old/new values and the computed `changed_fields`, with duration |
| `logDelete` | `(name, data, options)` | `delete`, `old_values = data` |
| `logError` | `(name, resourceType, message, options)` | `error` with `status: 'error'` |
| `logAudit` | `({ ... })` | any of the above, all fields explicit |

`options` takes `module`, `resource_id`, `patient_id`, `provider_id`, `appointment_id`,
`claim_id`, `status`, `metadata` and `includeDuration` (time since `startAction()`).

### Pattern 1 — forms

Log the view on mount, the create/update on success, and errors.

```javascript
const { logFormView, logCreate, logUpdate, logError, startAction } = useAudit();

useEffect(() => {
  startAction();
  logFormView('DiagnosisForm', {
    module: 'EHR',
    patient_id: patient?.id,
    metadata: { mode: editMode ? 'edit' : 'create' },
  });
}, []);

const handleSubmit = async () => {
  // Prepare the payload before the try block, so the catch can refer to it.
  const data = { ...formState };
  try {
    const result = editMode ? await api.updateDiagnosis(id, data) : await api.createDiagnosis(data);
    if (editMode) {
      logUpdate('DiagnosisForm', original, data, { module: 'EHR', resource_id: result.id, patient_id: data.patientId });
    } else {
      logCreate('DiagnosisForm', data, { module: 'EHR', resource_id: result.id, patient_id: data.patientId, provider_id: data.providerId });
    }
  } catch (error) {
    logError('DiagnosisForm', 'form', error.message, { module: 'EHR', patient_id: data.patientId });
  }
};
```

### Pattern 2 — modals

```javascript
const { logModalOpen, logModalClose, logError, startAction } = useAudit();

useEffect(() => {
  if (isOpen) {
    startAction();
    logModalOpen('CredentialModal', { module: 'Admin', metadata: { provider: providerName } });
  }
}, [isOpen]);

const handleClose = () => {
  logModalClose('CredentialModal', { module: 'Admin', metadata: { provider: providerName } });
  onClose();
};
// on a failed save: logError('CredentialModal', 'modal', error.message, { module: 'Admin' });
```

### Pattern 3 — views

```javascript
const { logViewAccess, logError } = useAudit();
useEffect(() => { logViewAccess('PatientLoginPage', { module: 'Patient Portal' }); }, []);
// login success is recorded by the auth system; failures with logError(..., 'view', ...)
```

### Coverage

Every form, modal and view on the original roll-out list uses the hook, including the 14
forms the roll-out log tracked (`NewDenialForm`, `NewHealthcareOfferingForm`,
`NewInsurancePayerForm`, `NewIntakeFlowForm`, `NewIntakeFormForm`, `NewLaboratoryForm`,
`NewLabOrderForm`, `NewPatientForm`, `NewPaymentForm`, `NewPaymentPostingForm`,
`NewPharmacyForm`, `NewPreapprovalForm`, `NewTaskForm`, `NewUserForm`), the other forms
(`DiagnosisForm`, `MedicalRecordUploadForm`, `NewAppointmentForm`, `NewAppointmentTypeForm`,
`NewCampaignForm`, `NewClaimForm`, `NewConsentFormForm`, `NewCouponForm`), the modals
(`CredentialModal`, `ePrescribeModal`, `ForgotPasswordModal`, `PatientLoginPage`,
`SettingsModal`, `UserProfileModal`, `ViewEditModal`) and the views (Admin Panel,
appointment types, campaigns, clinical services, CRM, dashboard, EHR, FHIR, integrations,
laboratories, offerings, patient diagnosis/history/intake/portal, pharmacies, practice
management, providers, RCM, reports, telehealth, waitlist, plus accounts, forms, inventory
and messages). `RegisterPage` was removed with self-registration (SEC-39); portal
invitations are recorded server-side in `portal_invites`.

**Module names are not normalised.** The convention was a display name — `EHR`, `RCM`,
`Admin`, `CRM`, `Scheduling`, `Offerings`, `Patient Intake`, `Practice Management`,
`Patient Portal`, `Settings`, `Profile`, `Auth` — and most forms follow it, but several
views log camelCase identifiers instead (`patientPortal`, `inventory`, `accounts`, `rcm`,
`admin`, …). Filter on `module` case-insensitively, and use the display-name form in new
code.

### Practices

1. Always pass `module`.
2. Pass the related ids (`patient_id`, `provider_id`, `claim_id`, …) — they are what an
   investigation filters on.
3. Keep `metadata` to identifying fields (name, type, status), not whole records: the
   trail must not become a second copy of the PHI it protects.
4. Always log errors.
5. Call `startAction()` at the start of the view effect so create/update carry a duration.

## 3. Audit API — `backend/routes/audit.js`

All routes require authentication and run against the caller's tenant schema
(`req.db`).

| Method and path | Purpose |
|---|---|
| `POST /api/audit` | create an entry |
| `GET /api/audit` | list, filtered by `user_id`, `user_email`, `action_type`, `resource_type`, `resource_name`, `module`, `patient_id`, `provider_id`, `status`, `start_date`, `end_date` |
| `GET /api/audit/:id` | one entry |
| `GET /api/audit/stats/summary`, `/stats/top-users`, `/stats/top-resources` | statistics |
| `GET /api/audit/export/csv` | CSV export, same filters |
| `DELETE /api/audit/cleanup?days=90` | delete entries older than N days — **rejected by the append-only trigger** on any migrated tenant |

Migration 040 grants the `audit.view`, `audit.export` and `audit.admin` permissions to the
`admin` role in the legacy `role_permissions` table. The routes themselves check
authentication only, not that permission; the Admin Panel is where the logs are offered.

If a tenant schema has no `audit_logs` table the API answers 503 naming the schema; an
account that is not bound to an active tenant resolves to `public` (which holds no
`audit_logs`) and gets a 503 pointing at `GET /api/auth/tenant-status`. The existence check
is cached per schema for five minutes.

## 4. Viewing and exporting

1. **Admin Panel → Audit Logs**.
2. Filter by user, action type, resource, module, status or date range.
3. **View Details** shows the full entry; **Export** downloads CSV.

## 5. Retention

Entries cannot be deleted by the application. Retention or rotation, when introduced, must
run as a role that drops the trigger deliberately, not as the application deleting rows.

## 6. Troubleshooting

- **Logs not appearing** — check the browser console; check the API is up
  (`GET /health`); a 503 from `/api/audit` names the schema without the table (run both
  migration runners — see [`SETUP.md`](SETUP.md)) or says the account has no tenant.
- **Missing context** — pass the related ids in `options`.
- **Performance** — audit calls are fire-and-forget and must not block the UI; the indexes
  come with migration 040.
- **`audit_logs is append-only (UPDATE is not permitted)`** when deleting a user, patient or
  provider — tenant migration 003 has not reached that schema; run `npm run migrate:tenants`.
