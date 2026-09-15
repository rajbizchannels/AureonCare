# AureonCare Architecture Diagram

Comprehensive architecture diagrams for all components and infrastructure of the AureonCare healthcare practice management system.

> **Accuracy note.** These diagrams document what is **implemented in the code**, verified by reading the source. Several packages are declared in `package.json` but never imported; they are listed in §21 as *not implemented* rather than drawn as if they exist.

---

## 1. System Overview

```mermaid
graph TB
    subgraph Clients["Client Layer"]
        WEB["Clinic Web App<br/>React 18 SPA"]
        PORTAL["Patient Portal<br/>React SPA routes"]
        MOB["Native Mobile App<br/>React Native + Expo 54"]
        CONSOLE["Platform Console<br/>Static HTML/JS<br/>served by backend"]
    end

    subgraph Edge["Edge / Ingress"]
        VERCEL["Vercel<br/>Static + Serverless"]
        NGINX["Nginx / K8s Ingress<br/>self-hosted"]
    end

    subgraph Backend["Backend — Node.js / Express (single service)"]
        MW["Middleware Chain<br/>helmet · CORS · CSRF · rate limit<br/>authenticate · tenant context"]
        API["59 Route Modules<br/>/api/*"]
        PLAT["Control Plane API<br/>/api/platform"]
        SVC["20+ Services<br/>business logic"]
    end

    subgraph Data["Data Layer — PostgreSQL"]
        CTRL["control schema<br/>tenant registry · billing · operators"]
        TPL["template schema<br/>golden structural clone"]
        T1["tenant_a schema<br/>PHI"]
        T2["tenant_b schema<br/>PHI"]
        PUB["public schema<br/>identity + shared master data"]
    end

    subgraph Infra["Supporting Infra"]
        REDIS["Redis<br/>rate-limit store · send quota"]
        FILES["File Storage<br/>Multer → disk / PVC"]
    end

    subgraph External["External Services"]
        STRIPE["Stripe<br/>billing + webhooks"]
        VIDEO["Zoom · Google Meet<br/>Webex · Teams"]
        VENDOR["LabCorp · Optum<br/>SureScripts"]
        GOOG["Google APIs<br/>Drive backup · Calendar"]
        MSGRAPH["Microsoft Graph"]
        COMMS["SMTP / SendGrid<br/>WhatsApp Graph API"]
    end

    WEB --> Edge
    PORTAL --> Edge
    MOB --> Edge
    CONSOLE --> Edge
    Edge --> MW
    MW --> API
    MW --> PLAT
    API --> SVC
    PLAT --> CTRL
    SVC --> PUB
    SVC --> T1
    SVC --> T2
    CTRL -.provisions from.-> TPL
    TPL -.stamps.-> T1
    TPL -.stamps.-> T2
    MW --> REDIS
    SVC --> FILES
    SVC --> STRIPE
    SVC --> VIDEO
    SVC --> VENDOR
    SVC --> GOOG
    SVC --> MSGRAPH
    SVC --> COMMS
```

---

## 2. Multi-Tenancy Architecture (SEC-05 "Model D")

The single largest architectural change. Isolation is **schema-per-tenant**, enforced in application code plus a CI guard. There is **no Postgres Row-Level Security** anywhere in the codebase.

```mermaid
graph TB
    REQ["Incoming Request<br/>Bearer JWT or session cookie"]

    subgraph Resolve["Tenant Resolution"]
        AUTH["authenticate()<br/>middleware/auth.js"]
        ATTACH["attachTenantContext()<br/>auth.js:99"]
        CAT["tenantCatalog.js<br/>resolveTenantForUser()<br/>60s in-process cache"]
    end

    subgraph Lookup["Resolution Chain"]
        U["public.users.practice_id"]
        TEN["control.tenants<br/>status = 'active'"]
        SCH["schema_name"]
    end

    subgraph Scoped["Scoped DB Handle"]
        MK["makeTenantDb(pool, schema, res)<br/>db/requestTenantDb.js"]
        VAL["validate schema name<br/>/^[a-z_][a-z0-9_]*$/"]
        TX["per-statement transaction<br/>SET LOCAL search_path TO<br/>tenant, public, control"]
        REL["release client on<br/>res finish / close"]
    end

    RDB["req.db<br/>tenant-scoped pool"]

    subgraph Alt["Other Entry Points Setting req.db"]
        MSG["messagingAuth.js:130"]
        PORT["patient-portal.js:81<br/>routed by token hash, pre-auth"]
    end

    REQ --> AUTH --> ATTACH --> CAT
    CAT --> U --> TEN --> SCH
    SCH --> MK --> VAL --> TX --> RDB
    MK --> REL
    MSG --> RDB
    PORT --> RDB
```

**Why per-statement `SET LOCAL`:** Supabase's transaction pooler can hand consecutive statements to different backends, so a connection-level `search_path` is unreliable. Each statement is wrapped in its own transaction with `SET LOCAL`.

**Fallback behaviour:** unresolved tenants fall back to `public`, which holds **no clinical tables** — so the fallback fails loudly and is logged as a broken account rather than silently leaking.

### Portal routing without a tenant context

```mermaid
graph LR
    PLOGIN["Patient login<br/>email + password"]
    BI["blindIndex.js<br/>HMAC-SHA256(email, pepper)<br/>AC_IDX_K · KEY_VERSION"]
    ROUTE["control.portal_identity_route<br/>control.portal_session_route"]
    TSCHEMA["→ tenant schema"]

    PLOGIN --> BI --> ROUTE --> TSCHEMA
```

A blind index keeps the shared routing table from being a readable "which patient belongs to which clinic" map. Documented caveat in-file: this is a *coded identifier*, not de-identification under HIPAA Safe Harbor.

### Sweep coverage (honest status)

| Metric | Value |
|---|---|
| Route files using tenant-scoped `req.db` | 44 |
| Route files still using `app.locals.pool` directly | 56 |
| Enforcement | `backend/scripts/check-tenant-scoping.js` + explicit `RAW_POOL_ALLOWLIST` |
| Allowlist rationale | identity plane, shared master data, control-plane billing |
| CI gates | SEC-05 Tenant-Scoping Guard + Cross-Tenant Isolation Test |

> `SEC-05_MULTI_TENANCY_PLAN.md` is the design record for this work and is now marked **superseded**; its §0.1 carries the shipped-state summary. Read it for *why* Model D was chosen over app-only scoping or RLS — not as a description of the system.

---

## 3. Database Schema Topology

```mermaid
graph TB
    subgraph PUBLIC["public — identity & shared master data"]
        USERS["users<br/>+ mfa_secret, mfa_enabled<br/>mfa_backup_codes, last_activity_at"]
        PRACT["practices<br/>+ session_idle_minutes, require_mfa"]
        ROLES["roles · permissions<br/>role_permissions · user_roles"]
        MASTER["medical_codes · medications<br/>insurance_payers · pharmacies<br/>laboratories"]
    end

    subgraph CONTROL["control — control plane (13 tables)"]
        TENANTS["tenants"]
        TTABLES["tenant_tables"]
        CFG["config_baseline"]
        OPS["operators<br/>separate secret + own TOTP"]
        CAUDIT["audit_log<br/>immutable"]
        SUBS["subscriptions<br/>subscription_grants"]
        BILL["billing_events"]
        SIGNUP["signup_intents"]
        PROUTE["portal_identity_route<br/>portal_session_route"]
        PNOTIF["platform_notifications"]
        BG["break_glass_sessions"]
    end

    subgraph TEMPLATE["template — golden clone, no data"]
        TSTRUCT["full tenant structure"]
    end

    subgraph TENANT["tenant_* — one schema per clinic (PHI)"]
        PHI["patients · appointments · claims<br/>medical_records · prescriptions<br/>lab_orders · diagnosis · payments<br/>payment_postings · denials · preapprovals<br/>patient_intake_forms · patient_portal_sessions<br/>fhir_resources · audit_logs"]
    end

    TENANTS -->|schema_name| TENANT
    TEMPLATE -.stamped into.-> TENANT
    TTABLES -.canonical table list.-> TENANT
    USERS -->|practice_id| PRACT
    PRACT -.maps to.-> TENANTS
```

### Migration tracks

```mermaid
graph LR
    subgraph G["Global track"]
        GM["backend/migrations/*.sql<br/>001 – 082"]
        GR["run-migrations.js<br/>targets public + control"]
    end

    subgraph T["Tenant fan-out track"]
        TM["backend/migrations/tenant/*.sql<br/>001 adopt_runtime_created_tables<br/>002 audit_log_append_only<br/>003 audit_logs_keep_history"]
        TR["run-tenant-migrations.js<br/>npm run migrate:tenants"]
    end

    GM --> GR
    TM --> TR
    GR -->|"1. first"| DEPLOY["Deploy"]
    TR -->|"2. then, every tenant + template"| DEPLOY
```

Each tenant schema tracks applied versions in its own `<schema>.schema_migrations`, so the runner is idempotent and a safe no-op when the directory is empty.

---

## 4. Backend Architecture

```mermaid
graph TB
    subgraph Boot["server.js"]
        RAW["/api/stripe-webhook<br/>express.raw() — mounted BEFORE json()<br/>so signature verification works"]
        JSON["express.json()"]
        HELM["helmet<br/>COEP credentialless (Zoom WASM)<br/>COOP same-origin-allow-popups<br/>CSP frame-ancestors 'self'"]
        CORSM["CORS multi-origin allowlist<br/>+ same-host fallback for /platform"]
        STATIC["/platform static console<br/>X-Robots-Tag noindex · no-store"]
        UPL["/uploads/* — authenticate<br/>+ path-traversal check<br/>(express.static deliberately NOT used)"]
        HEALTH["GET /health<br/>pings Postgres"]
    end

    subgraph MWChain["Middleware"]
        CSRF["csrf.js<br/>double-submit; Bearer exempt"]
        RL["rateLimiters.js<br/>authLimiter 10/15min<br/>apiLimiter 1000/15min"]
        RLS["rateLimitStore.js<br/>Redis-backed, else MemoryStore"]
        AUTHM["auth.js<br/>JWT HS256 · token_version<br/>session idle timeout · tenant context"]
        PLATA["platformAuth.js<br/>control-plane operators"]
        MSGA["messagingAuth.js"]
        PHIL["phiAccessLog.js<br/>auditPhiRead()"]
        PLANE["planEnforcement.js<br/>entitlements"]
    end

    subgraph Routes["Route Groups (59 modules)"]
        CLIN["Clinical<br/>patients · appointments · medical-records<br/>prescriptions · diagnosis · lab-orders<br/>medications · telehealth · fhir"]
        RCMR["Revenue Cycle<br/>claims · payments · payment-postings<br/>preapprovals · denials · edi<br/>insurance-payers · billing"]
        FIN["Finance — NEW<br/>accounts (GL) · inventory · licenses<br/>stripeSettings · stripeWebhook"]
        IAMR["Identity<br/>auth · users · roles · permissions<br/>plans · invites · teamAccess"]
        TENR["Tenancy — NEW<br/>platform · signup"]
        ENG["Engagement<br/>patient-portal · notifications<br/>waitlist · campaigns · intake-forms<br/>messages"]
        PRACR["Practice<br/>providers · scheduling · offerings<br/>clinicSettings · form-management · tasks"]
        INTR["Integration<br/>integrationOAuth · vendorIntegrationSettings<br/>medical-codes · calendar-sync · search<br/>backup · archive · audit"]
    end

    subgraph Services["Services"]
        TENS["tenantCatalog · tenantProvisioning<br/>entitlements · portalRouting"]
        PLATS["platformAudit · platformBilling<br/>platformNotify · billingLedger"]
        SECS["userMfa (speakeasy+qrcode)<br/>phiAudit · domainJoin"]
        INTS["telehealthProviders/<br/>zoom · teams · googleMeet · webex"]
        VENS["vendorIntegrations/<br/>labcorp · optum · surescripts"]
        MISC["archiveScheduler · reminderService<br/>notificationService · whatsappService<br/>licenseService · cloudBackupStorage<br/>fhirTracking · messageDocumentFiling"]
    end

    RAW --> JSON --> HELM --> CORSM
    CORSM --> MWChain
    MWChain --> Routes
    Routes --> Services
    RL --> RLS
```

### New route modules

| Route | Mount | Purpose |
|---|---|---|
| `platform.js` | `/api/platform` | Control-plane console API — tenant fleet, subscriptions, break-glass. Operators authenticate against `control.operators` with a **separate secret and their own TOTP**. |
| `signup.js` | `/api/signup` | Public self-serve signup — plan selection, coupon preview, Stripe checkout. Two-phase commit across DB + Stripe. |
| `invites.js` | `/api/invites` | Staff invites; binds OAuth-created accounts to a practice (closes the `practice_id IS NULL` → `public` hole). |
| `teamAccess.js` | `/api/team-access` | Verified email-domain claims, self-service join requests with admin approval, **and security-policy endpoints**. |
| `messages.js` | `/api/messages` | Secure messaging — care-team and patient threads, attachments, AES-256-GCM at rest. |
| `accounts.js` | `/api/accounts` | Accounting / general ledger. |
| `inventory.js` | `/api/inventory` | Inventory management. |
| `licenses.js` | `/api/licenses` | Provider license tracking. |
| `stripeSettings.js` | `/api/stripe-settings` | Stripe configuration. |
| `stripeWebhook.js` | `/api/stripe-webhook` | Raw-body webhook receiver for signature verification. |

---

## 5. Frontend Architecture

```mermaid
graph TB
    subgraph Entry["Entry"]
        IDX["index.js"]
        APP["App.js — Router + Context"]
        CTX["AppContext.js<br/>auth · user · permissions"]
        EB["ErrorBoundary.js"]
    end

    subgraph Views["27 Views"]
        CORE["Dashboard · EHR · RCM · CRM<br/>Reports · Telehealth · FHIR"]
        PAT["PatientPortal · PatientHistory<br/>PatientHistoryDirectory<br/>PatientIntake · PatientDiagnosis"]
        MGMT["AdminPanel · PracticeManagement<br/>ProviderManagement · OfferingManagement<br/>LaboratoryManagement · PharmacyManagement<br/>AppointmentTypesManagement<br/>CampaignsManagement · WaitlistManagement"]
        NEW["NEW: Accounts · Inventory · Messages<br/>FormManagement · ClinicalServices<br/>Integrations"]
    end

    subgraph Comps["Notable Components"]
        SEC["TwoFactorPanel.js — 2FA enrolment UI"]
        TEAM["TeamAccessPanel.js<br/>InviteStaffPanel.js"]
        SUB["SubscriptionPlansPanel.js"]
        ZOOM["ZoomMeetingEmbed.js"]
        SHARED["IntegrationCard · Toggle<br/>modals · forms · panels · cards"]
    end

    subgraph API["API Layer"]
        SVCAPI["apiService.js<br/>CSRF token echo<br/>credentials: 'include'"]
        OAUTHC["oauthConfig.js<br/>Google · Microsoft (+ legacy Facebook)"]
    end

    IDX --> APP --> CTX
    APP --> EB
    APP --> Views
    Views --> Comps
    Views --> API
```

**Build:** React 18 + CRA/craco + Tailwind CSS. `@zoom/meetingsdk`, `jspdf`/`jspdf-autotable`, `xlsx`, `date-fns`, `lucide-react`, `@azure/msal-*`, `@react-oauth/google`.

### Platform console — a deliberately separate UI

`backend/public/platform/{index.html, console.js, console.css}` is served as **static files by the backend** at `/platform`, with `X-Robots-Tag: noindex` and `Cache-Control: no-store`. It is intentionally not part of the React SPA so operator code never ships in a clinic user's bundle.

---

## 6. Mobile App Architecture

```mermaid
graph TB
    subgraph Shell["React Native 0.81 + Expo SDK 54"]
        ROOT["RootNavigator.tsx<br/>React Navigation v7"]
        STACK["Native Stack<br/>SignIn · Server · App"]
    end

    subgraph Tabs["Actor-Selected Tab Sets"]
        STAFF["StaffTabs"]
        PATIENT["PatientTabs"]
    end

    subgraph StaffS["Staff Screens"]
        TODAY["TodayScreen"]
        SCHED["ScheduleScreen"]
        PATS["PatientsScreen"]
        CHART["ChartScreen<br/>tablet split-view"]
        ORD["OrdersScreen"]
        BILLS["BillingScreen"]
    end

    subgraph PatS["Patient Screens"]
        HOME["HomeScreen"]
        VIS["VisitsScreen"]
        REC["RecordsScreen"]
    end

    subgraph SharedS["Shared"]
        SIGN["SignInScreen"]
        SERV["ServerScreen"]
        MORE["MoreScreen"]
        MSGS["messaging/<br/>MessagesScreen · ThreadList · Conversation"]
    end

    subgraph Lib["src/lib"]
        APICL["api.ts<br/>Credential union:<br/>staff token | portal token+patientId"]
        STOR["storage.ts<br/>SecureStore (tokens)<br/>AsyncStorage (prefs)"]
        HLTH["health.ts<br/>probes /health then /api/health"]
        RES["useResource.ts · chart.ts<br/>server.ts · url.ts · device.ts"]
    end

    subgraph Ctx["Contexts"]
        SESS["SessionContext"]
        ACTIVE["ActivePatientContext"]
    end

    ROOT --> STACK --> Tabs
    Tabs --> STAFF --> StaffS
    Tabs --> PATIENT --> PatS
    STACK --> SharedS
    StaffS --> Lib
    PatS --> Lib
    Lib --> Ctx
```

- Native app (not a webview wrapper), `newArchEnabled: true`, bundle IDs `tech.aureoncare.app` (iOS + Android).
- Both credential kinds ride the same `Authorization: Bearer` header; only `/patient-portal/*` is portal-only.
- Tests: `mobile/tests/*.test.mjs` (node:test).

> Biometric unlock, push notifications and native OAuth are **described in `mobile/README.md` but not implemented** — see §21.

---

## 7. Authentication & Authorization Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant BE as Backend
    participant DB as PostgreSQL
    participant MFA as userMfa.js

    rect rgb(220, 235, 220)
        Note over C,MFA: Login with 2FA
        C->>BE: POST /api/auth/login {email, password, mfaCode?}
        BE->>BE: bcrypt compare (always runs<br/>DUMMY_PASSWORD_HASH if user absent)
        BE->>DB: load user + practice policy
        alt practice requires MFA and user has none
            BE-->>C: 403 {mfaEnrolmentRequired: true}
        else MFA enabled, no code supplied
            BE-->>C: {mfaRequired: true}
        else code supplied
            BE->>MFA: verify TOTP (30s step, window 1)
            MFA->>DB: else compare all backup-code hashes<br/>(no short-circuit) and array_remove on use
            BE-->>C: JWT (HS256) + HttpOnly cookie
        end
    end

    rect rgb(225, 225, 240)
        Note over C,DB: Authenticated request
        C->>BE: Bearer JWT or session cookie
        BE->>DB: re-check token_version (tv) claim
        BE->>DB: check last_activity_at vs<br/>practices.session_idle_minutes
        alt idle beyond policy
            BE-->>C: 401 {sessionTimedOut: true}
        else active
            BE->>DB: resolve tenant → req.db
            BE-->>C: response
        end
    end
```

| Control | Detail |
|---|---|
| **TOTP 2FA** | `speakeasy` + `qrcode`; 30s step, `window: 1` (±30s skew). Two-phase enrolment — secret stored, `mfa_enabled` stays false until a code verifies. |
| **Backup codes** | 10 codes, SHA-256 hashed, single-use, struck via `array_remove` before the session is issued. Verification compares against every hash without short-circuiting, so timing can't leak how many remain. |
| **Session idle timeout** | Server-enforced. `practices.session_idle_minutes` (CHECK 5–1440, NULL = unlimited). Activity stamp refreshed at most once per 60s to avoid a per-request row lock. |
| **Token revocation** | `token_version` (`tv`) claim re-checked against the DB every request; bumping it revokes all prior tokens. |
| **Algorithm pinning** | JWT pinned to `HS256`; startup **throws** if `AC_TK_S` < 32 bytes. |
| **Role integrity** | `requireAdmin` re-fetches role from the DB — never trusts the JWT role claim. |
| **Policy management** | `GET/PATCH /api/team-access/security-policy`; PATCH refuses `require_mfa=true` with 409 while any admin lacks 2FA. |

**MFA endpoints:** `/mfa/status`, `/mfa/enroll`, `/mfa/verify`, `/mfa/disable`, `/mfa/backup-codes`.

### OAuth

```mermaid
graph LR
    subgraph Current["Current — server-side code exchange"]
        G["/oauth/google/exchange"]
        M["/oauth/microsoft/exchange"]
    end
    subgraph Legacy["Legacy — token validation"]
        L["POST /api/auth/social-login"]
        FB["validateFacebook()"]
        KILL["AC_DISABLE_LEGACY_SOCIAL_TOKEN=true<br/>→ 410 Gone"]
    end
    G --> OK["Canonical provider ID<br/>resolved server-side"]
    M --> OK
    L --> FB
    KILL -.retires.-> L
```

Facebook is reachable **only** through the legacy endpoint, which a single env var retires. Treat it as deprecated, not a supported path.

---

## 8. RBAC Permission Model

```mermaid
graph TD
    subgraph Roles["8 System Roles"]
        ADMIN["Admin"]
        DOCTOR["Doctor"]
        NURSE["Nurse"]
        RECEPT["Receptionist"]
        BILLING["Billing Manager"]
        CRMR["CRM Manager"]
        STAFF["Staff"]
        PATIENT["Patient"]
    end

    subgraph Sep["Separate Identity Plane"]
        OPER["control.operators<br/>platform super-admins<br/>own secret + own TOTP"]
    end

    subgraph Modules["Permission Modules"]
        M["Patients · Appointments · Billing<br/>CRM · EHR · Reports · Admin"]
    end

    subgraph Actions["Actions"]
        A["view · create · edit · delete<br/>manage · process · export"]
    end

    subgraph Gate["Additional Gate"]
        ENT["planEnforcement.js<br/>entitlements.js<br/>per-tenant plan limits"]
    end

    Roles --> Modules --> Actions
    Modules --> Gate
    OPER -.never a clinic role.-> Sep
```

Clinic RBAC and platform-operator access are **entirely separate identity planes** — an Admin in a clinic has no path to the control plane.

---

## 9. Clinical Data Flow

```mermaid
flowchart TD
    subgraph Intake["Intake"]
        REG["Registration"]
        FORMS["Intake Forms"]
        CONSENT["Consent"]
    end

    subgraph Sched["Scheduling"]
        BOOK["Booking"]
        AVAIL["Availability Check"]
        CONF["Confirmation"]
        REMIND["Reminders"]
        WAIT["Waitlist"]
    end

    subgraph Enc["Encounter"]
        VISIT["Visit"]
        TELE["Telehealth Session"]
        EHR["EHR / SOAP Notes"]
        DX["Diagnosis (ICD-10)"]
        RX["e-Prescribe → SureScripts"]
        LAB["Lab Order → LabCorp"]
        FHIRS["FHIR R4 Sync"]
    end

    subgraph RCM["Revenue Cycle"]
        CODE["Coding (CPT + ICD-10)"]
        PRE["Pre-Auth → Optum"]
        CLAIM["Claim → EDI 837"]
        ERA["ERA ← EDI 835"]
        POST["Payment Posting"]
        DENY["Denial Management"]
    end

    subgraph Eng["Engagement"]
        MSG["Secure Messaging"]
        NOTIF["Email / WhatsApp"]
        PORTAL["Patient Portal"]
    end

    REG --> FORMS --> CONSENT --> BOOK
    BOOK --> AVAIL --> CONF
    CONF --> REMIND
    CONF --> VISIT --> TELE
    VISIT --> EHR --> DX
    DX --> RX
    DX --> LAB
    DX --> CODE
    EHR --> FHIRS
    CODE --> PRE --> CLAIM --> ERA
    ERA --> POST
    ERA --> DENY --> CODE
    CONF --> NOTIF
    EHR --> PORTAL
    PORTAL --> MSG
```

---

## 10. Billing & Subscription Architecture (Stripe)

```mermaid
graph TB
    subgraph Signup["Self-Serve Signup"]
        PLAN["Plan selection"]
        COUPON["Coupon preview"]
        INTENT["control.signup_intents"]
        CHECKOUT["Stripe Checkout"]
    end

    subgraph Webhook["Webhook Path"]
        RAWW["/api/stripe-webhook<br/>express.raw() before json()"]
        VERIFY["Signature verification"]
        EVENTS["control.billing_events"]
    end

    subgraph State["Subscription State"]
        SUBS["control.subscriptions"]
        GRANTS["control.subscription_grants"]
        ENTL["entitlements.js"]
        ENFORCE["planEnforcement.js"]
    end

    subgraph Provision["Tenant Provisioning"]
        PROV["tenantProvisioning.js"]
        STAMP["stamp schema from template"]
        TENREC["control.tenants row"]
    end

    subgraph Ledger["Internal Accounting"]
        BL["billingLedger.js"]
        ACCT["accounts.js — GL"]
    end

    PLAN --> COUPON --> INTENT --> CHECKOUT
    CHECKOUT --> RAWW --> VERIFY --> EVENTS
    EVENTS --> SUBS --> GRANTS --> ENTL --> ENFORCE
    EVENTS --> PROV --> STAMP --> TENREC
    SUBS --> BL --> ACCT
```

Signup is a **two-phase commit across the database and Stripe**. `platformBilling.js` is the only consumer of the `stripe` SDK.

---

## 11. Telehealth Integration

```mermaid
graph TB
    subgraph FE["Frontend"]
        TV["TelehealthView.js"]
        ZE["ZoomMeetingEmbed.js<br/>@zoom/meetingsdk in-browser"]
    end

    subgraph BE["Backend"]
        TR["/api/telehealth"]
        TS["/api/telehealth-settings"]
        OA["/api/integrations/oauth"]
        TSVC["services/telehealthProviders/"]
    end

    subgraph Providers["Platforms"]
        Z["Zoom — OAuth + Meeting SDK"]
        GM["Google Meet — Calendar API"]
        WX["Cisco Webex"]
        MT["Microsoft Teams — Graph"]
    end

    subgraph DB["Storage"]
        TSESS["telehealth_sessions"]
        TSET["telehealth_provider_settings"]
        VSET["vendor_integration_settings"]
    end

    TV --> ZE
    TV --> TR --> TSVC
    TS --> VSET
    OA --> Z
    OA --> GM
    TSVC --> Z & GM & WX & MT
    TSVC --> TSESS & TSET
```

Zoom's in-browser SDK is why `helmet` sets COEP `credentialless` and COOP `same-origin-allow-popups` — the WASM runtime requires it.

---

## 12. FHIR R4 & Vendor Integrations

```mermaid
graph TB
    subgraph FHIR["FHIR R4"]
        FR["/api/fhir"]
        FT["/api/fhir-tracking"]
        FRES["fhir_resources (per tenant)"]
        FTRK["fhir_tracking · tracking_events<br/>error_actions"]
        FTYPES["Patient · Observation · Condition<br/>MedicationRequest · DiagnosticReport<br/>Encounter · AllergyIntolerance<br/>Immunization · Practitioner · CarePlan"]
    end

    subgraph Vendors["Vendor Integrations"]
        LC["labcorpService.js → LabCorp<br/>lab orders + results"]
        OPT["optumService.js → Optum<br/>eligibility + claims"]
        SS["surescriptsService.js → SureScripts<br/>e-prescription network"]
        VLOG["vendor_transaction_log"]
        ERXQ["erx_message_queue"]
    end

    subgraph Ext["External Consumers"]
        EHRX["External EHR Systems"]
        PAYERS["Insurance Payers"]
    end

    FR --> FRES --> FTYPES
    FT --> FTRK
    FR <--> Ext
    LC --> VLOG
    OPT --> VLOG
    SS --> ERXQ
    SS --> VLOG
```

**Standards:** FHIR R4, HL7 v2 / EDI 837 + 835, ICD-10, CPT.

---

## 13. Messaging & Notifications

```mermaid
graph LR
    subgraph Triggers["Events"]
        T["Appointment booked / reminder<br/>Claim status · Rx ready<br/>Lab result · Portal message"]
    end

    subgraph Msg["Secure Messaging — messages.js"]
        THREADS["Care-team + patient threads"]
        ATT["Attachments"]
        CRYPTO["messageCrypto.js<br/>AES-256-GCM envelope<br/>versioned keys"]
        FILING["messageDocumentFiling.js"]
    end

    subgraph Notif["Notifications"]
        NR["/api/notifications"]
        NP["/api/notification-preferences"]
        NS["notificationService.js"]
    end

    subgraph Channels["Delivery"]
        EMAIL["Email — Nodemailer / SendGrid"]
        WA["WhatsApp — Meta Graph API v18"]
        INAPP["In-app — REST polling"]
    end

    T --> Notif --> NS --> Channels
    NP --> NS
    T --> Msg
    THREADS --> CRYPTO
    ATT --> CRYPTO
    ATT --> FILING
```

> **Delivery is poll-based REST, not push.** There is no WebSocket or SSE transport — `MessagesView.js` and the mobile `useResource.ts` fetch on interval/refresh. Message bodies are encrypted at rest but this is explicitly **not** end-to-end encryption; the rationale is documented in `messageCrypto.js`.

---

## 14. Deployment & Infrastructure

AureonCare now targets **three deployment models** from one codebase.

```mermaid
graph TB
    subgraph Vercel["Model 1 — Vercel (SaaS)"]
        VN["@vercel/node → backend/server.js"]
        VS["@vercel/static-build → frontend"]
        VR["Routes: /api/* · /platform* · /health<br/>/uploads/* · microsoft-identity-association<br/>SPA rewrites: /book/* · /patient-login<br/>/signup · /accept-invite · /join"]
        VH["Static security headers"]
    end

    subgraph Compose["Model 2 — Docker Compose (self-host)"]
        PG["postgres:15-alpine"]
        RD["redis:7-alpine"]
        BK["backend"]
        FE["frontend + nginx"]
        UA["update-agent"]
        VOL["volumes: pgdata · uploads-data<br/>network: aureoncare-net"]
    end

    subgraph K8s["Model 3 — Kubernetes / Helm"]
        CHART["helm/aureoncare"]
        DEPL["backend-deployment<br/>frontend-deployment"]
        CFG["configmap · secret"]
        ING["ingress"]
        HPA["hpa — autoscaling"]
        PVC["pvc — uploads"]
        PROF["values.saas.yaml<br/>values.customer-cloud.yaml<br/>values.onprem.yaml"]
    end

    subgraph Onprem["On-Premises Lifecycle"]
        INST["deployment/onprem/install.sh"]
        AGENT["update-agent/agent.js<br/>polls release registry<br/>webhook on new version<br/>optional docker compose pull && up -d<br/>/status endpoint on :8080"]
        ARGO["deployment/saas/argocd-app.yaml"]
    end

    Compose --> UA --> AGENT
    K8s --> PROF
    Onprem --> INST
```

**Health check:** exactly one endpoint — `GET /health` (`backend/server.js:127`), pinging Postgres. Referenced by `vercel.json`, both Helm probes, and the compose healthcheck. There is **no `/api/health`**; the mobile client probes `['/health', '/api/health']` in order purely as proxy tolerance.

**Redis status:** live for the rate-limit store and send quota when `AC_RD_H`/`AC_RD_URL` are set. The `redisClient` in `server.js` is **commented out**, so `/health` reports Redis as `"not configured"` even when the rate limiter is using it.

---

## 15. CI/CD Pipeline

```mermaid
graph TB
    subgraph CI[".github/workflows/ci.yml"]
        J1["1 · Lint and Test<br/>backend + frontend, Node 18"]
        J2["2 · Docker Build Verification<br/>backend · frontend · update-agent<br/>GHA cache, no push"]
        J3["3 · Helm Lint<br/>chart + all 3 values files<br/>+ dry-run template render"]
        J4["4 · SEC-05 Tenant-Scoping Guard<br/>npm run check:tenant-scoping"]
        J5["5 · SEC-05 Cross-Tenant Isolation Test<br/>postgres:16 service<br/>schema + migrations 063–073<br/>tenant fan-out<br/>isolation.test.js<br/>+ check-db-role.js (not superuser)"]
    end

    subgraph REL[".github/workflows/release.yml — on v*.*.* tags"]
        R1["Build and Push Docker Images → ghcr.io"]
        R2["Package Helm Chart"]
        R3["Create On-Premises Bundle"]
    end

    J1 --> J2
    J4 --> J5
    R1 --> R2 --> R3
```

**Backend test suites** (`backend/test/`): `sec05/isolation.test.js`, and `signup/{flow, plan-change, billing, accounting, notify, domain-join, mfa-session}.test.js` — wired to `test:sec05`, `test:signup`, `test:plans`, `test:billing`, `test:accounting`, `test:notify`, `test:domains`, `test:mfa`.

---

## 16. Security Architecture

```mermaid
graph TB
    subgraph Net["Network / Transport"]
        HELMET["helmet — COEP · COOP · CSP frame-ancestors"]
        CORSX["CORS allowlist + /platform fallback"]
        RATE["Rate limiting — Redis-backed store"]
        TLS["TLS at edge (Vercel / ingress)"]
    end

    subgraph App["Application"]
        CSRFX["CSRF double-submit"]
        JWTX["JWT HS256 pinned · 32-byte secret enforced<br/>token_version revocation"]
        MFAX["TOTP 2FA + hashed backup codes"]
        IDLE["Server-enforced session idle timeout"]
        PWD["Password policy — 12+ chars, 4 classes<br/>bcrypt cost 12"]
        TIMING["DUMMY_PASSWORD_HASH<br/>constant-time login"]
        LOCK["Portal lockout — 20/IP + 3/account per 15min"]
        UPLOADX["Authenticated uploads<br/>+ path-traversal check"]
    end

    subgraph Data["Data"]
        TENANTX["Schema-per-tenant isolation<br/>+ CI guard"]
        MSGENC["AES-256-GCM message envelope"]
        BAKENC["backupCrypto.js"]
        BLIND["Blind index — HMAC-SHA256 + pepper"]
        HASHSESS["Portal session tokens SHA-256 hashed"]
        LEASTP["aureoncare_app least-privilege role<br/>CI asserts not superuser"]
    end

    subgraph Audit["Audit & Compliance"]
        PHIA["PHI read trail — phiAccessLog + phiAudit<br/>logs resource, not payload; 2xx only"]
        APPEND["Append-only audit_logs<br/>BEFORE UPDATE/DELETE trigger raises"]
        CIMM["control.audit_log immutable"]
        BGLASS["break_glass_sessions"]
        STD["FHIR R4 · HL7 · ICD-10 · CPT"]
    end

    Net --> App --> Data --> Audit
```

**Not present:** Row-Level Security (zero policies), dedicated secrets-manager integration, WAF configuration. Staff login has no `failed_login_count`/`locked_until` columns — account lockout is portal-only; staff rely on the generic `authLimiter`.

---

## 17. Component Summary

| Layer | Technology | Status |
|---|---|---|
| **Clinic web** | React 18, CRA/craco, Tailwind, React Router v6 | Active |
| **Mobile** | React Native 0.81, Expo SDK 54, React Navigation v7, TypeScript | Active |
| **Platform console** | Static HTML/JS served by backend at `/platform` | Active |
| **Backend** | Node.js 18, Express 4, 59 route modules, 20+ services | Active |
| **Database** | PostgreSQL — `public` + `control` + `template` + per-tenant schemas | Active |
| **Tenancy** | Schema-per-tenant, `search_path` pinned per statement | Active |
| **Cache** | Redis — rate-limit store + send quota | Partial (client commented out in `server.js`) |
| **Auth** | JWT HS256, HttpOnly cookie, TOTP 2FA, idle timeout | Active |
| **Social auth** | Google + Microsoft code exchange | Active |
| **Social auth (legacy)** | Facebook via `/social-login` | Deprecated — retired by env var |
| **Billing** | Stripe Checkout + webhooks, internal GL | Active |
| **Messaging** | REST polling, AES-256-GCM at rest | Active |
| **Telehealth** | Zoom SDK, Google Meet, Webex, Teams | Active |
| **Vendors** | LabCorp, Optum, SureScripts | Active |
| **Interop** | FHIR R4, HL7 v2 / EDI 837+835, ICD-10, CPT | Active |
| **Containers** | Docker (backend, frontend, update-agent) | Active |
| **Orchestration** | Helm chart, 3 values profiles, HPA, ingress, PVC | Active |
| **On-prem** | `install.sh` + auto-update agent | Active |
| **CI/CD** | GitHub Actions — 5 CI jobs, tagged releases to ghcr.io | Active |

---

## 18. Declared But **Not Implemented**

These appear in dependency manifests or prose documentation but have **zero imports in the codebase**. They are recorded here so the diagrams above are not read as claiming them.

| Item | Reality |
|---|---|
| `socket.io` (root `package.json`) | **0 usages.** No WebSocket/SSE anywhere. `server.js` calls plain `app.listen()` and never creates an `http.Server` to attach to. Messaging is poll-based REST. |
| `winston` | **0 requires.** All logging is `console.*`. |
| `joi` | **0 requires.** Validation is hand-rolled. |
| Row-Level Security | **No policies exist.** Isolation is schema + `search_path`, enforced in app code and CI. |
| Redis client in `server.js` | **Commented out.** Redis is genuinely used by the rate-limit store, but `/health` reports `"not configured"`. |
| `expo-local-authentication` (biometric unlock) | Declared in mobile, **0 imports**. A `biometrics` preference key exists in `storage.ts` but nothing reads the biometric API. |
| `expo-notifications` (push / APNs / FCM) | Declared in mobile, **0 imports**. |
| `expo-auth-session` / `expo-web-browser` | Declared in mobile, **0 imports**; `app.json` client IDs are empty placeholders. |
| `expo-document-picker`, `expo-crypto`, `expo-linking`, `react-native-svg` | Declared in mobile, **0 imports** (RN's own `Linking` is used). |
| Backend `@azure/msal-*`, `@react-oauth/google`, `react` | Frontend dependencies leaked into the backend manifest; **0 backend requires**. |

`mobile/README.md` cites biometrics, push notifications and deep links as *motivation for choosing React Native* — that is rationale, not shipped functionality.
