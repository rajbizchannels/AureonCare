# Roles, Permissions and Plans

**Contents.** What actually decides whether a request is allowed (the `module_permissions`
layer and the coarse `authorize()` role check), the role tables and role-management API,
multiple roles per user and role switching, why changing a user's role never deletes their
patient or provider record, per-user language, and subscription plans with their feature
gates and usage limits. It merges the former `backend/RBAC_AND_PLANS_GUIDE.md` and
`backend/MULTI_ROLE_SUPPORT.md`. The frontend side — which modules and buttons a role is
*shown* — is in [`../../frontend/src/utils/PERMISSIONS_GUIDE.md`](../../frontend/src/utils/PERMISSIONS_GUIDE.md).

---

## 1. What is enforced

Access to a request is decided by two things:

- **`module_permissions`** — a per-practice table, read by
  `backend/middleware/modulePermissions.js` and mounted across seventeen routers. This is
  the layer that refuses a request. Its modules, resources, roles and actions are declared
  in `backend/utils/permissionRegistry.js`, which the admin screen, the write endpoint and
  the enforcement all read, so they cannot disagree. Roles in the grid: `admin`, `doctor`,
  `nurse`, `receptionist`, `billing_manager`, `crm_manager`, `staff`; actions: view, create,
  edit, delete, approve, export. Administrators manage it under **Admin Panel → Roles &
  Permissions**.
  - *No stored row is not a denial*: a practice that has never edited the screen falls back
    to the role defaults in the registry, which mirror how the application already behaved.
  - *An administrator is never denied*, and the API refuses an attempt to restrict `admin`.
  - A denial is a 403 that names the missing permission.
- **`authorize('admin', ...)`** — the coarse role check in `backend/middleware/auth.js`,
  still the gate on administrative routes.

The `roles` / `permissions` / `role_permissions` tables described in section 3 are the
original RBAC design. **They are empty on every installation checked, and no route reads
`role_permissions` to authorise a request**; the `checkPermission` query that the original
guide suggested was never wired in. Treat the registry as the current design and section 3
as the history of it — except role *management* (`/api/roles`) and role *assignment*
(`/api/users/:id/roles`), which are live.

## 2. System roles

| Role | Scope |
|---|---|
| `admin` — Administrator | full access; manages users, roles, plans |
| `doctor` — Doctor/Provider | patients, appointments, EHR, reports |
| `patient` — Patient | own appointments and records (patient portal) |
| `nurse` | patients, appointments, medical records (view/create/edit) |
| `receptionist` | patients and appointments (view/create/edit) |
| `billing_manager` — Billing Manager | billing; patients (view); reports |
| `crm_manager` — CRM Manager | CRM; reports |
| `staff` | limited access |

System roles (`is_system_role`) cannot be deleted. The per-module defaults that are
actually enforced are the ones in `permissionRegistry.js`.

## 3. Role tables (original design — migration `014_create_rbac_and_plans.sql`)

The migration is now kept for reference in `backend/migrations/history/global/`; its
tables are part of the baseline every database is built from.

| Table | Columns |
|---|---|
| `roles` | `id`, `name` (unique system identifier), `display_name`, `description`, `is_system_role`, `is_active` |
| `permissions` | `id`, `name` (e.g. `patients.view`), `display_name`, `description`, `module`, `action` |
| `role_permissions` | `role_id`, `permission_id` |
| `user_roles` | `user_id`, `role_id`, `assigned_at`, `assigned_by` |
| `subscription_plans` | `id`, `name`, `display_name`, `description`, `price`, `billing_cycle`, `max_users` / `max_patients` (`-1` = unlimited), `features` (JSONB) |
| `organization_settings` | `id`, `organization_name`, `current_plan_id`, `plan_start_date`, `plan_end_date`, `auto_renew` |

`users` gained `language` (default `en`) and `active_role`.

## 4. Role management API — `backend/routes/roles.js`

| Method and path | Who | Notes |
|---|---|---|
| `GET /api/roles` | signed in | roles with `user_count`, `permission_count` |
| `GET /api/roles/:id` | signed in | role with its permissions |
| `POST /api/roles` | admin | `{ name, display_name, description, permissions: [ids] }` |
| `PUT /api/roles/:id` | admin | `{ display_name, description, permissions, is_active }` |
| `DELETE /api/roles/:id` | admin | refused for system roles, and for a role held by any active user (checked against `users.role`) |
| `GET /api/roles/permissions/all` | signed in | permissions grouped by module |

The write routes were previously open to any signed-in account; they are now admin-only.

## 5. Multiple roles per user

### Assignment and switching — `backend/routes/users.js`

| Method and path | Who | Notes |
|---|---|---|
| `GET /api/users/:id/roles` | self or admin | the user's roles, with `is_active` on the current one |
| `POST /api/users/:id/roles` | admin | `{ role_id, assigned_by }` |
| `DELETE /api/users/:id/roles/:role_id` | admin | "Cannot remove last role from user"; if the removed role was active, another becomes active |
| `PUT /api/users/:id/switch-role` | self or admin | `{ role_name }` — returns the user and `new_role` |

Assignments are stored in `user_roles`. The role that authorisation uses is `users.role`
(it is what `req.user.role`, the permission registry and the enforcement read); switching
sets `active_role` and, for the user's current practice, `role` and the practice membership
role. A user who holds several roles (a doctor who is also a patient at the same clinic)
switches between them; each role sees its own dashboard.

### Changing a role never deletes the patient or provider record

Earlier, changing a user from patient to doctor deleted their patient row (and the reverse
deleted the provider row). That lost medical history and failed on foreign keys such as
`fhir_resources_patient_id_fkey` ("update or delete on table "patients" violates foreign key
constraint"). Now, in `PUT /api/users/:id`:

- changing to `doctor` creates a `providers` row if none exists, with `providers.id =
  users.id` (migration 025), and **keeps** any patient row;
- changing to `patient` creates a `patients` row if none exists, with `patients.id =
  users.id` (migration 023) and the next `MRN-NNNN` number, and **keeps** any provider row;
- staff → doctor creates the provider row and deletes nothing.

So records and history are preserved, appointments keep their provider, and FHIR
resources stay linked. `ON DELETE CASCADE` is deliberately not used on clinical
references: medical records must be retained (HIPAA, patient rights, patient safety).

Because the ids are shared, a user who is both is found by id, not through a `user_id`
column (there is none on either table):

```sql
SELECT u.id, u.first_name, u.last_name, u.role,
       (pr.id IS NOT NULL) AS is_provider,
       (pa.id IS NOT NULL) AS is_patient
FROM users u
LEFT JOIN providers pr ON pr.id = u.id
LEFT JOIN patients  pa ON pa.id = u.id
WHERE pr.id IS NOT NULL AND pa.id IS NOT NULL;
```

Ideas the original note listed for later, none implemented: a `status` column on
patient/provider rows, and a role-change history table.

## 6. Language

`PUT /api/users/:id/language` (self or admin) with `{ "language": "es" }` stores the
preference on the user; it persists across sessions. The product ships five languages:
**English, Spanish, French, German and Arabic**. (The endpoint's validator also accepts
`pt`, `zh` and `hi`, for which no translations ship.)

## 7. Plans, feature gates and usage limits

Enforced at the API boundary by `backend/middleware/planEnforcement.js`
(`enforceUserQuota`, `enforcePatientQuota`, `enforceProviderQuota`, `enforceFeature`,
`enforceActiveBilling`); every quota check counts in the database, so it cannot be bypassed
from the frontend.

- **Which plan applies.** For a request that carries a tenant, the plan comes from that
  practice's control-plane subscription (`services/entitlements.js`). Otherwise — or for a
  tenant with no subscription row — it falls back to the legacy single-tenant
  `organization_settings` → `subscription_plans` row. With nothing configured it fails open.
- **Seeded plans** (migration 014): `free` (3 users, 50 patients; EHR, appointments),
  `starter` ($99/month; 10 users, 200 patients; + billing, telehealth), `professional`
  ($299/month; 25 users, 1,000 patients; + CRM, integrations), `enterprise` ($999/month;
  unlimited; + custom branding, API access). Plans sold on the signup page are configured
  by the platform operator — see [`../../DEPLOYMENT_CHECKLIST.md`](../../DEPLOYMENT_CHECKLIST.md).

| Method and path | Who | Notes |
|---|---|---|
| `GET /api/plans` | signed in | available plans |
| `GET /api/plans/current` | signed in | the current plan, dates, limits, features |
| `GET /api/plans/preview/:planId` | admin | preview a change |
| `PUT /api/plans/current` | admin | `{ plan_id, auto_renew }` |
| `GET /api/plans/features` | signed in | `features` plus `limits.users` / `limits.patients` (`max`, `current`, `unlimited`) |
| `POST /api/plans/provider-seats` | admin | provider seats |

Errors you will see: "Maximum users exceeded for current plan" (upgrade or deactivate
users) and a feature-not-in-plan 403 (choose a plan that includes the module).
