# AureonCare Mobile — Feature Scope

Scoping document for the AureonCare companion mobile app (phone + tablet).
Every feature below is mapped to something that already exists in this
repository, so the mobile app consumes the same backend and the same
authorisation model as the web app.

---

## 1. Guiding constraints

| Constraint | Decision |
|---|---|
| Don't crowd the interface | Max 5 bottom-tab destinations; everything else lives behind a **More** sheet. The web three-pane shell (`PrimaryNav` → `SecondaryNav` → content) collapses to **tabs → list → detail**. |
| Theme parity with web | Same tokens as `frontend/src`: dark `slate-950 / slate-900` surfaces, `slate-700` borders, `cyan-500 → blue-500` gradient accent, `rounded-xl` cards, Lucide icons. Light mode mirrors `gray-100 / white`. |
| One app, two audiences | Role decides the shell at login: **Patient mode** for `patient`, **Staff mode** for `admin / doctor / nurse / receptionist / billing_manager / crm_manager / staff` (`frontend/src/utils/rolePermissions.js`). |
| Plan gating is server-truth | Reuse the tier lists in `frontend/src/config/planFeatures.js` (`essentials / clinical_pro / enterprise / onprem`). A module hidden by plan or role on web stays hidden on mobile. |
| Phone is for *doing*, tablet is for *working* | Phone = read, confirm, capture, join. Tablet = the above plus data-entry screens with multi-select and coding pickers. |

---

## 2. Cross-cutting foundations (Phase 0 — required by everything else)

### 2.1 Configurable hosted URL
- Settings screen field: **Server URL**, defaulting to `https://app.aureoncare.tech`.
- Editable pre-login (on the login screen, behind a small "Change server" affordance so it doesn't crowd the form) and post-login in Settings.
- On save: normalise scheme/trailing slash, probe the health endpoint, reject non-HTTPS unless the user explicitly opts into a LAN host, then persist to secure storage.
- Supports the `onprem` tier and per-tenant deployments; changing the URL clears the session and returns to login.

### 2.2 Authentication
Backed by `backend/routes/auth.js` and `backend/routes/patient-portal.js`.

- **Google sign-in** — native Google Sign-In SDK; posts to the existing social path (`provider: 'google'`), config from `REACT_APP_GG_CID` equivalent.
- **Microsoft sign-in** — MSAL native broker (`@azure/msal-*` on web, `authority: .../common`); `provider: 'microsoft'`.
- **Email + password** — staff login, and the separate patient-portal login.
- **Register**, **Forgot password**, **Terms** and **Privacy Policy** screens (mirror `RegisterPage.js`, `ForgotPasswordModal.js`, `TermsOfServicePage.js`, `PrivacyPolicyPage.js`).
- **Social account linking** for patients (`POST /:patientId/link-social`).
- **TOTP second factor** where enabled (`speakeasy` + `qrcode` already in the stack).
- **Biometric unlock** (Face ID / fingerprint) to re-open a live session — mobile-only addition.
- Tokens in Keychain / Keystore, never in plain preferences.

### 2.3 Telehealth
Provider adapters already exist for **Zoom**, **Google Meet**, **Webex** and **Microsoft Teams**
(`backend/services/telehealthProviders/`).

- Join flow: native provider app via deep link when installed → in-app secure webview fallback.
- Zoom additionally supports an embedded meeting surface (`ZoomMeetingEmbed.js` on web; Zoom Mobile SDK is the phase-2 equivalent).
- Pre-join check: camera / mic permission, network quality, "Join as patient / provider".
- Session lifecycle (start, join, end, waiting room) via `backend/routes/telehealth.js`.
- Provider *credentials setup* stays web-only (`telehealthSettings.js`) — the app consumes configured providers, it does not configure them.

### 2.4 Notifications
- Push notifications (APNs / FCM) for appointment reminders, telehealth "provider is ready", new form requests, lab results, task assignment.
- In-app notification centre backed by `backend/routes/notifications.js` and per-user preferences from `notificationPreferences.js`.

---

## 3. Patient mode — renders well on phone ✅

Bottom tabs: **Home · Appointments · Records · Messages · More**

| Feature | Backing code | Phone | Tablet |
|---|---|---|---|
| Home: next appointment, join-visit button, outstanding forms, balance due | `PatientPortalView.js` | ✅ | ✅ |
| Upcoming & past appointments | `GET /:patientId/appointments` | ✅ | ✅ |
| Book an appointment (service → provider → slot) | `offerings.js`, `appointment-types.js`, `scheduling.js` | ✅ | ✅ |
| Reschedule / cancel | `PUT`/`DELETE /:patientId/appointments/:id` | ✅ | ✅ |
| Add to device calendar | `AddToCalendarButton.js` | ✅ | ✅ |
| **Join telehealth visit** | `telehealth.js` | ✅ | ✅ |
| Diagnoses | portal `diagnoses` tab | ✅ | ✅ |
| Prescriptions / medication list | `prescriptions.js`, `medications.js` | ✅ | ✅ |
| Medical records — view & download | `GET /:patientId/medical-records` | ✅ | ✅ |
| **Upload a record from camera or files** | `MedicalRecordUploadForm.js` | ✅ (camera is a mobile win) | ✅ |
| Requested forms — fill & submit | `DynamicFormRenderer.js` | ✅ | ✅ |
| **Signature capture** | `SignatureCapture.js` | ✅ (touch beats mouse) | ✅ |
| Consent forms | `NewConsentFormForm.js` | ✅ | ✅ |
| Profile & demographics | `GET/PUT /:patientId/profile` | ✅ | ✅ |
| Invoices, quotes, pay a bill | `payments.js`, `stripeSettings.js` | ✅ | ✅ |
| Notification preferences | `notificationPreferences.js` | ✅ | ✅ |

---

## 4. Staff / provider mode — renders well on phone ✅

Bottom tabs: **Today · Schedule · Patients · Telehealth · More**

| Feature | Backing code | Phone | Tablet |
|---|---|---|---|
| Today dashboard: appointment count, arrivals, open tasks | `DashboardView.js`, `StatCard.js` | ✅ (stacked tiles, no dense grid) | ✅ |
| Day / agenda schedule | `PracticeManagementView.js` → `calendar` | ✅ agenda | ✅ day + week |
| Appointment list with filters | → `list` tab | ✅ | ✅ |
| Appointment detail: check-in, status change, no-show | `appointments.js` | ✅ | ✅ |
| Waitlist | `WaitlistManagementView.js` | ✅ | ✅ |
| Patient search | `SearchPanel.js`, `search.js` | ✅ | ✅ |
| Patient summary card (demographics, allergies, active meds, recent visits) | `EHRView.js` (read-only subset) | ✅ | ✅ |
| Patient history timeline | `PatientHistoryView.js` | ✅ | ✅ |
| **Telehealth session list + start / join** | `TelehealthView.js` | ✅ | ✅ |
| Tasks — view, complete, create | `tasks.js`, `NewTaskForm.js` | ✅ | ✅ |
| Notifications | `NotificationsPanel.js` | ✅ | ✅ |
| Intake status at a glance | `PatientIntakeView.js` | ✅ read-only | ✅ full |
| Provider availability — own schedule | `ProviderManagementView.js` | ✅ own only | ✅ team |
| AI assistant / help | `EnhancedAIAssistant.js`, `HelpDrawer.js` | ✅ (chat is natively mobile) | ✅ |
| Clinic directory: pharmacies, labs | `PharmacyManagementView.js`, `LaboratoryManagementView.js` | ✅ read-only | ✅ |

---

## 5. Tablet-first — works on tablet, not worth cramming onto a phone 📱→🖥

These need a wide canvas (multi-select pickers, code lookups, side-by-side context).
Ship them tablet-only in v1; revisit for phone once the core is stable.

| Feature | Backing code |
|---|---|
| Encounter note / diagnosis capture with ICD & CPT pickers | `DiagnosisForm.js`, `MedicalCodeMultiSelect.js` |
| e-Prescribe | `ePrescribeModal.js`, `prescriptions.js` |
| Lab order entry | `NewLabOrderForm.js`, `LabCPTMultiSelect.js`, `ResultRecipientsMultiSelect.js` |
| Full EHR chart | `EHRView.js` |
| Intake packet review and completion | `PatientIntakeView.js` |
| Reports & analytics | `ReportsView.js` |
| RCM: claims, pre-authorisations, denials | `RCMView.js`, `claims.js`, `preapprovals.js`, `denials.js` |
| Payments & payment postings | `payments.js`, `payment-postings.js` |
| Quotes & invoices | `NewQuoteForm.js`, `NewInvoiceForm.js` |
| CRM pipeline & campaigns | `CRMView.js`, `CampaignsManagementView.js` |
| Service catalog, packages, promotions | `OfferingManagementView.js` |
| Inventory: items, stock, purchase orders | `InventoryView.js` |
| FHIR resources & tracking dashboards | `FHIRView.js`, `FHIRTrackingDashboard.js` |

---

## 6. Deliberately web-only ❌

Administrative and configuration surfaces. Deep-link to the hosted web app instead of
rebuilding them — this is the main thing keeping the mobile UI uncrowded.

- Admin panel, user management, roles & permissions (`AdminPanelView.js`, `roles.js`, `permissions.js`)
- Subscription plans and licensing (`plans.js`, `licenses.js`)
- Integrations & OAuth connection setup (`IntegrationsView.js`, `integrationOAuth.js`)
- Telehealth provider credentials (`telehealthSettings.js`)
- Backup & restore, archive management (`backup.js`, `archive.js`, `archiveRules.js`)
- Audit logs (`AuditLogsTab.js`, `audit.js`)
- Form builder / template authoring (`DynamicFormBuilder.js`, `FormTemplateLibrary.js`)
- Custom report builder
- Accounting ledger: chart of accounts, journal, reconciliation, statements (`AccountsView.js`)
- EDI, insurance payer setup (`edi.js`, `insurance-payers.js`)
- Clinic settings, working hours, appointment types setup (`clinicSettings.js`, `appointment-types.js`)

---

## 7. Suggested delivery order

1. **Foundations** — hosted-URL config, Google / Microsoft / email auth, theme system, secure storage, app shell.
2. **Patient v1** — appointments, join telehealth, records, forms + signature, profile.
3. **Staff v1** — today dashboard, agenda, patient summary, telehealth sessions, tasks.
4. **Push notifications** across both modes.
5. **Tablet layer** — encounter capture, e-prescribe, lab orders, reports.
6. **Polish** — biometric unlock, offline read cache for today's schedule, camera capture for records.
