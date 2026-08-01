# AureonCare Architecture Diagram

This document provides comprehensive architecture diagrams for all components and infrastructure of the AureonCare healthcare practice management system.

---

## 1. System Overview

```mermaid
graph TB
    subgraph Clients["Client Layer"]
        WEB["Web Browser<br/>(React SPA)"]
        PATIENT["Patient Portal<br/>(React SPA)"]
        MOBILE["Mobile Browser<br/>(PWA)"]
    end

    subgraph CDN["CDN / Hosting"]
        VERCEL["Vercel<br/>Static Hosting + Serverless"]
    end

    subgraph Backend["Backend Layer (Node.js / Express)"]
        API["Express.js API Server<br/>50+ Route Handlers"]
        MW["Middleware<br/>Auth · CORS · Rate Limit · Helmet"]
        SVC["Service Layer<br/>Business Logic"]
    end

    subgraph Data["Data Layer"]
        PG["PostgreSQL<br/>(Supabase Hosted)<br/>76 Tables"]
        REDIS["Redis Cache<br/>(Optional)"]
        FILES["File Storage<br/>Multer / Local"]
    end

    subgraph External["External Services"]
        ZOOM["Zoom SDK"]
        GMEET["Google Meet"]
        WEBEX["Cisco Webex"]
        LABCORP["LabCorp API"]
        OPTUM["Optum API"]
        SURESX["SureScripts eRx"]
        SMTP["SMTP / SendGrid<br/>(Email)"]
        WHATSAPP["WhatsApp API"]
    end

    subgraph Auth["Identity Providers"]
        GOOGLE["Google OAuth 2.0"]
        MSAZURE["Microsoft Azure AD"]
    end

    WEB --> VERCEL
    PATIENT --> VERCEL
    MOBILE --> VERCEL
    VERCEL --> API
    API --> MW
    MW --> SVC
    SVC --> PG
    SVC --> REDIS
    SVC --> FILES
    SVC --> ZOOM
    SVC --> GMEET
    SVC --> WEBEX
    SVC --> LABCORP
    SVC --> OPTUM
    SVC --> SURESX
    SVC --> SMTP
    SVC --> WHATSAPP
    MW --> GOOGLE
    MW --> MSAZURE
```

---

## 2. Frontend Architecture

```mermaid
graph TB
    subgraph Entry["Entry Point"]
        IDX["index.js<br/>React DOM Root"]
        APP["App.js<br/>Router + Context Provider"]
    end

    subgraph Context["Global State"]
        CTX["AppContext.js<br/>React Context API<br/>Auth · User · Permissions"]
    end

    subgraph Router["React Router v6"]
        direction LR
        PUB["Public Routes<br/>Login · Register · Patient Portal"]
        PRIV["Protected Routes<br/>Role-Based Access"]
    end

    subgraph Views["24+ Page Views"]
        DASH["Dashboard"]
        PATIENTS["Patients"]
        APPTS["Appointments"]
        EHR["EHR / Medical Records"]
        TELE["Telehealth"]
        RCM["Revenue Cycle (RCM)"]
        FHIR["FHIR Integration"]
        CRM["CRM"]
        REPORTS["Reports & Analytics"]
        ADMIN["Admin Panel"]
        PPVIEW["Patient Portal"]
        PROVIDERS["Provider Management"]
        SCHED["Scheduling"]
        FORMS["Form Management"]
        INTEG["Integrations"]
    end

    subgraph Components["Reusable Components"]
        MODALS["Modals"]
        CARDS["Cards"]
        FORMS_C["Forms"]
        PANELS["Side Panels"]
        CALENDAR["Calendar"]
        QUICKV["Quick Views"]
        ADMIN_C["Admin Components"]
        HELP["Help / Support"]
        SCHED_C["Scheduling Components"]
    end

    subgraph Services["Frontend Services"]
        APISVC["apiService.js<br/>Centralized HTTP Client (Axios)"]
        OAUTHCFG["oauthConfig.js<br/>Google · Microsoft"]
    end

    subgraph Hooks["Custom Hooks"]
        USEAUDIT["useAudit"]
        USEPERM["usePermissions"]
        USEHOOKS["Other Hooks"]
    end

    subgraph UILibs["UI Libraries"]
        TAILWIND["Tailwind CSS 3.4"]
        LUCIDE["Lucide React Icons"]
        RECHARTS["Recharts / Chart.js"]
        ZOOM_SDK["@zoom/meetingsdk"]
        JSPDF["jsPDF"]
        XLSX["XLSX (Excel)"]
        DATEFNS["date-fns"]
    end

    IDX --> APP
    APP --> CTX
    APP --> Router
    Router --> PUB
    Router --> PRIV
    PRIV --> Views
    Views --> Components
    Views --> Services
    Views --> Hooks
    Components --> UILibs
```

---

## 3. Backend Architecture

```mermaid
graph TB
    subgraph Server["Express.js Server (server.js)"]
        direction TB
        INIT["App Initialization<br/>Port · CORS · Helmet · Rate-Limit"]
        ROUTES["Route Mounting<br/>50+ Router Files"]
    end

    subgraph Middleware["Middleware Pipeline"]
        AUTHM["auth.js<br/>JWT Verification · Session Check"]
        ERRM["Error Handler<br/>Centralized Error Responses"]
        LOGM["Winston Logger<br/>Request / Error Logging"]
        UPLOADM["Multer<br/>File Upload Handling"]
    end

    subgraph RouteGroups["API Route Groups"]
        direction LR
        subgraph Clinical["Clinical"]
            R_PAT["patients"]
            R_APPT["appointments"]
            R_EHR["medical-records"]
            R_RX["prescriptions"]
            R_DX["diagnosis"]
            R_LAB["lab-orders"]
            R_TELE["telehealth"]
            R_FHIR["fhir"]
            R_MED["medications"]
        end

        subgraph RCM_R["Revenue Cycle"]
            R_CLAIMS["claims"]
            R_PAY["payments"]
            R_PAYPOST["payment-postings"]
            R_PREAUTH["preapprovals"]
            R_DENY["denials"]
            R_EDI["edi"]
            R_INS["insurance-payers"]
        end

        subgraph AuthAdmin["Auth & Admin"]
            R_AUTH["auth"]
            R_USERS["users"]
            R_ROLES["roles"]
            R_PERM["permissions"]
            R_PLANS["plans"]
            R_CLINIC["clinic-settings"]
        end

        subgraph PatientEng["Patient Engagement"]
            R_PP["patient-portal"]
            R_NOTIF["notifications"]
            R_WAIT["waitlist"]
            R_INTAKE["intake-forms"]
            R_CAMP["campaigns"]
        end

        subgraph Practice["Practice Management"]
            R_PROV["providers"]
            R_SCHED["scheduling"]
            R_OFFER["healthcare-offerings"]
            R_FORMS["form-management"]
            R_TASK["tasks"]
        end

        subgraph IntegR["Integration"]
            R_OAUTH["integrations/oauth"]
            R_VENDOR["vendor-integration-settings"]
            R_MCODE["medical-codes"]
            R_CALSYNC["calendar-sync"]
            R_SEARCH["search"]
            R_BACKUP["backup"]
        end
    end

    subgraph ServiceLayer["Service Layer"]
        TELE_SVC["Telehealth Providers<br/>Zoom · Google Meet · Webex"]
        VENDOR_SVC["Vendor Integrations<br/>LabCorp · Optum · SureScripts"]
        EDI_SVC["EDI / HL7 Parser<br/>837 Claims Processing"]
        EMAIL_SVC["Email Service<br/>Nodemailer / SendGrid"]
        WHATSAPP_SVC["WhatsApp Service"]
        FHIR_SVC["FHIR R4 Service"]
        CRYPT["Encryption Utility<br/>(AES-256)"]
        TZ["Timezone Utilities"]
    end

    subgraph DB_LAYER["Data Access Layer"]
        DBJS["db.js<br/>PostgreSQL Pool (pg)"]
        SBJS["supabase.js<br/>Supabase Client"]
        ARCHDB["archiveDb.js<br/>Data Archival"]
    end

    INIT --> ROUTES
    INIT --> SOCKET
    ROUTES --> Middleware
    Middleware --> RouteGroups
    RouteGroups --> ServiceLayer
    RouteGroups --> DB_LAYER
    ServiceLayer --> DB_LAYER
```

---

## 4. Database Schema Overview

```mermaid
erDiagram
    users ||--o{ user_roles : has
    users ||--o{ social_auth : has
    users ||--o{ audit_logs : generates
    roles ||--o{ user_roles : assigned_via
    roles ||--o{ role_permissions : has
    permissions ||--o{ role_permissions : granted_via

    patients ||--o{ appointments : books
    patients ||--o{ medical_records : has
    patients ||--o{ prescriptions : receives
    patients ||--o{ diagnosis : has
    patients ||--o{ lab_orders : orders
    patients ||--o{ claims : generates
    patients ||--o{ payments : makes
    patients ||--o{ telehealth_sessions : attends
    patients ||--o{ patient_allergies : has
    patients ||--o{ patient_pharmacies : prefers
    patients ||--o{ fhir_resources : has
    patients ||--o{ notifications : receives

    providers ||--o{ appointments : conducts
    providers ||--o{ telehealth_sessions : hosts
    providers ||--o{ doctor_availability : has
    providers ||--o{ doctor_time_off : takes
    providers ||--o{ prescriptions : writes

    appointments ||--o{ appointment_reminders : triggers
    appointments ||--o{ claims : generates

    claims ||--o{ claim_submissions : tracked_via
    claims ||--o{ payment_postings : reconciled_via
    claims ||--o{ denials : may_have

    payments ||--o{ payment_postings : posted_via

    healthcare_offerings ||--o{ offering_pricing : has
    healthcare_offerings ||--o{ offering_packages : bundled_in
    healthcare_offerings ||--o{ offering_insurance_mappings : covered_by
```

---

## 5. Database Domain Map

```mermaid
graph LR
    subgraph IAM["Identity & Access (8 tables)"]
        T_USERS["users"]
        T_ROLES["roles"]
        T_PERMS["permissions"]
        T_ROLEPERMS["role_permissions"]
        T_USERROLES["user_roles"]
        T_URHIST["user_role_history"]
        T_SOCIAL["social_auth"]
        T_PPSESS["patient_portal_sessions"]
    end

    subgraph PATIENT_DOM["Patient Management (7 tables)"]
        T_PAT["patients"]
        T_PALLERG["patient_allergies"]
        T_PPHARM["patient_pharmacies"]
        T_PCONSENT["patient_consent_forms"]
        T_PENROLL["patient_offering_enrollments"]
        T_PINTAKE["patient_intake_forms"]
        T_PINTFLOW["patient_intake_flows"]
    end

    subgraph CLINICAL_DOM["Clinical / EHR (10 tables)"]
        T_MR["medical_records"]
        T_RX["prescriptions"]
        T_RXHIST["prescription_history"]
        T_DX["diagnosis"]
        T_MEDS["medications"]
        T_MEDALTS["medication_alternatives"]
        T_DRUGIX["drug_interactions"]
        T_MCODE["medical_codes"]
        T_LAB["lab_orders"]
        T_FHIR["fhir_resources"]
    end

    subgraph SCHED_DOM["Scheduling (11 tables)"]
        T_APPT["appointments"]
        T_APPTTYPE["appointment_types"]
        T_APPTREM["appointment_reminders"]
        T_WAITLIST["appointment_waitlist"]
        T_APPTCFG["appointment_type_config"]
        T_CLNAPPTSET["clinic_appointment_settings"]
        T_PVBKCFG["provider_booking_config"]
        T_DOCAVAIL["doctor_availability"]
        T_DOCTOFF["doctor_time_off"]
        T_RECAPPT["recurring_appointments"]
        T_BKANALYTICS["booking_analytics"]
    end

    subgraph TELE_DOM["Telehealth (2 tables)"]
        T_TELESESS["telehealth_sessions"]
        T_TELESET["telehealth_provider_settings"]
    end

    subgraph RCM_DOM["Revenue Cycle (7 tables)"]
        T_CLAIMS["claims"]
        T_CLMSUB["claim_submissions"]
        T_PYMTS["payments"]
        T_PAYPOST["payment_postings"]
        T_PREAUTH["preapprovals"]
        T_DENIALS["denials"]
        T_INSPAY["insurance_payers"]
    end

    subgraph OFFER_DOM["Offerings & Services (7 tables)"]
        T_OFFER["healthcare_offerings"]
        T_OFFPKG["offering_packages"]
        T_OFFPRICE["offering_pricing"]
        T_OFFPROMO["offering_promotions"]
        T_OFFINSMAPPL["offering_insurance_mappings"]
        T_OFFREV["offering_reviews"]
        T_SVCCAT["service_categories"]
    end

    subgraph PROV_DOM["Providers & Practices (5 tables)"]
        T_PROVS["providers"]
        T_PRACTICES["practices"]
        T_CLINIC["clinic_info"]
        T_CLINICHRS["clinic_working_hours"]
        T_BACKUPPROV["backup_provider_settings"]
    end

    subgraph INTEG_DOM["Integration (5 tables)"]
        T_FHIRTRACK["fhir_tracking"]
        T_FHIRTRACKEVT["fhir_tracking_events"]
        T_FHIRERR["fhir_error_actions"]
        T_VENDSET["vendor_integration_settings"]
        T_VENDLOG["vendor_transaction_log"]
        T_ERX["erx_message_queue"]
    end

    subgraph BIZ_DOM["Business & Engagement (4 tables)"]
        T_TASKS["tasks"]
        T_NOTIF["notifications"]
        T_NOTIFPREF["notification_preferences"]
        T_CAMP["campaigns"]
    end

    subgraph ORG_DOM["Organization & Compliance (5 tables)"]
        T_ORGSETT["organization_settings"]
        T_SUBPLANS["subscription_plans"]
        T_AUDIT["audit_logs"]
        T_ARCHIVE["archives"]
        T_ARCHRULES["archive_rules"]
    end
```

---

## 6. Authentication & Authorization Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant FE as React Frontend
    participant BE as Express Backend
    participant AUTH as Auth Middleware
    participant DB as PostgreSQL
    participant OAUTH as OAuth Provider

    rect rgb(200, 230, 200)
        Note over C,DB: Standard Email/Password Login
        C->>FE: Submit credentials
        FE->>BE: POST /api/auth/login
        BE->>DB: SELECT user + bcrypt verify
        DB-->>BE: User record
        BE-->>FE: JWT token + user info
        FE->>FE: Store token in localStorage
    end

    rect rgb(200, 200, 230)
        Note over C,OAUTH: OAuth 2.0 Social Login
        C->>FE: Click Google/Microsoft
        FE->>OAUTH: Authorization request
        OAUTH-->>FE: Auth code + user profile
        FE->>BE: POST /api/auth/social-login
        BE->>DB: Upsert user + social_auth record
        DB-->>BE: User record
        BE-->>FE: JWT token
    end

    rect rgb(230, 200, 200)
        Note over C,DB: Authenticated API Request
        C->>FE: User action
        FE->>BE: API Request + Bearer JWT
        BE->>AUTH: Verify JWT token
        AUTH->>DB: Check user_roles + permissions
        DB-->>AUTH: Role/Permission set
        AUTH-->>BE: Authorized context
        BE-->>FE: API Response
    end
```

---

## 7. RBAC Permission Model

```mermaid
graph TD
    subgraph Roles["8 System Roles"]
        ADMIN["Admin"]
        DOCTOR["Doctor"]
        NURSE["Nurse"]
        RECEPTIONIST["Receptionist"]
        BILLING["Billing Manager"]
        CRM_R["CRM Manager"]
        STAFF["Staff"]
        PATIENT_R["Patient"]
    end

    subgraph Modules["Permission Modules"]
        M_PAT["Patients Module"]
        M_APPT["Appointments Module"]
        M_BILLING["Billing Module"]
        M_CRM["CRM Module"]
        M_EHR["EHR Module"]
        M_REPORTS["Reports Module"]
        M_ADMIN["Admin Module"]
    end

    subgraph Actions["Permission Actions"]
        A_VIEW["view"]
        A_CREATE["create"]
        A_EDIT["edit"]
        A_DELETE["delete"]
        A_MANAGE["manage"]
        A_PROCESS["process"]
        A_EXPORT["export"]
    end

    ADMIN -->|"full access"| M_PAT & M_APPT & M_BILLING & M_CRM & M_EHR & M_REPORTS & M_ADMIN
    DOCTOR -->|"clinical access"| M_PAT & M_APPT & M_EHR & M_REPORTS
    NURSE -->|"clinical support"| M_PAT & M_APPT & M_EHR
    RECEPTIONIST -->|"scheduling"| M_PAT & M_APPT
    BILLING -->|"financial"| M_BILLING & M_REPORTS
    CRM_R -->|"engagement"| M_CRM & M_REPORTS
    STAFF -->|"limited"| M_PAT & M_APPT
    PATIENT_R -->|"own data only"| M_PAT

    M_PAT --> A_VIEW & A_CREATE & A_EDIT & A_DELETE
    M_BILLING --> A_PROCESS & A_EXPORT
    M_REPORTS --> A_VIEW & A_EXPORT
    M_ADMIN --> A_MANAGE
```

---

## 8. Clinical Data Flow

```mermaid
flowchart TD
    subgraph Intake["Patient Intake"]
        REG["Patient Registration"]
        INTAKE_FORM["Intake Forms"]
        CONSENT["Consent Management"]
    end

    subgraph Scheduling["Appointment Scheduling"]
        BOOK["Booking Request"]
        AVAIL["Provider Availability Check"]
        CONFIRM["Appointment Confirmation"]
        REMIND["Automated Reminders"]
        WAITLIST["Waitlist Management"]
    end

    subgraph Clinical["Clinical Encounter"]
        VISIT["Visit / Encounter"]
        EHR_ENTRY["EHR Entry<br/>(Vitals, Notes, SOAP)"]
        DX["Diagnosis (ICD-10)"]
        RX["E-Prescriptions<br/>(SureScripts)"]
        LAB["Lab Orders<br/>(LabCorp)"]
        TELE_SESS["Telehealth Session<br/>(Zoom / Meet / Webex)"]
        FHIR_SYNC["FHIR R4 Sync"]
    end

    subgraph RCM_FLOW["Revenue Cycle"]
        CODING["Medical Coding<br/>(ICD-10 + CPT)"]
        PREAUTH["Pre-Authorization<br/>(Optum)"]
        CLAIM["Claim Generation<br/>(EDI 837)"]
        SUBMISSION["Claim Submission"]
        ERA["ERA Processing<br/>(EDI 835)"]
        PAYMENT["Payment Posting"]
        DENIAL["Denial Management"]
        RECONCILE["Reconciliation"]
    end

    subgraph PatientEng["Patient Engagement"]
        NOTIF_E["Email / WhatsApp Notifications"]
        PORTAL["Patient Portal<br/>Self-Service"]
        RECORDS_ACCESS["Records Access"]
    end

    REG --> INTAKE_FORM --> CONSENT
    CONSENT --> BOOK
    BOOK --> AVAIL --> CONFIRM
    CONFIRM --> REMIND
    CONFIRM --> VISIT
    VISIT --> TELE_SESS
    VISIT --> EHR_ENTRY
    EHR_ENTRY --> DX
    DX --> RX
    DX --> LAB
    DX --> CODING
    EHR_ENTRY --> FHIR_SYNC
    CODING --> PREAUTH
    PREAUTH --> CLAIM
    CLAIM --> SUBMISSION
    SUBMISSION --> ERA
    ERA --> PAYMENT
    ERA --> DENIAL
    PAYMENT --> RECONCILE
    DENIAL --> CODING

    CONFIRM --> NOTIF_E
    REMIND --> NOTIF_E
    EHR_ENTRY --> PORTAL
    PORTAL --> RECORDS_ACCESS
```

---

## 9. Telehealth Integration Architecture

```mermaid
graph TB
    subgraph FE_TELE["Frontend - Telehealth View"]
        TELE_UI["TelehealthView.js"]
        ZOOM_SDK_FE["@zoom/meetingsdk<br/>In-Browser Meeting"]
        GMEET_URL["Google Meet URL Redirect"]
        WEBEX_URL["Webex URL Redirect"]
    end

    subgraph BE_TELE["Backend - Telehealth Service"]
        TELE_ROUTE["/api/telehealth"]
        TELE_SETT["/api/telehealth-settings"]
        OAUTH_ROUTE["/api/integrations/oauth"]
        TELE_SVC_B["telehealthProviders/<br/>Service Classes"]
    end

    subgraph Providers["Video Platform APIs"]
        ZOOM_API["Zoom OAuth API<br/>Meeting Creation"]
        GMEET_API["Google Calendar API<br/>Meet Link Generation"]
        WEBEX_API["Cisco Webex API<br/>Meeting Scheduling"]
        TEAMS_API["Microsoft Teams<br/>(Azure AD)"]
    end

    subgraph DB_TELE["Database"]
        TELE_DB["telehealth_sessions"]
        TELE_SET_DB["telehealth_provider_settings"]
        VENDOR_DB["vendor_integration_settings"]
    end

    TELE_UI --> ZOOM_SDK_FE
    TELE_UI --> GMEET_URL
    TELE_UI --> WEBEX_URL
    TELE_UI --> TELE_ROUTE

    TELE_ROUTE --> TELE_SVC_B
    TELE_SETT --> VENDOR_DB
    OAUTH_ROUTE --> ZOOM_API
    OAUTH_ROUTE --> GMEET_API

    TELE_SVC_B --> ZOOM_API
    TELE_SVC_B --> GMEET_API
    TELE_SVC_B --> WEBEX_API
    TELE_SVC_B --> TEAMS_API

    TELE_SVC_B --> TELE_DB
    TELE_SVC_B --> TELE_SET_DB
```

---

## 10. Revenue Cycle Management (RCM) Flow

```mermaid
flowchart LR
    subgraph Eligibility["Eligibility Verification"]
        INS_CHECK["Insurance Payer Lookup"]
        ELIG_API["Optum Eligibility API"]
        ELIG_RESULT["Eligibility Result"]
    end

    subgraph PreAuth["Pre-Authorization"]
        PREAUTH_REQ["Pre-Auth Request"]
        PREAUTH_DB["preapprovals table"]
        PREAUTH_RESP["Auth Decision"]
    end

    subgraph Claims["Claim Processing"]
        CLAIM_GEN["Claim Generation<br/>(CPT + ICD-10 codes)"]
        EDI_837["EDI 837 Formatting<br/>(HL7 Parser)"]
        CLAIM_SUB["Claim Submission<br/>claim_submissions table"]
        CLAIM_TRACK["Claim Tracking<br/>claims table"]
    end

    subgraph Payments["Payment Processing"]
        ERA_835["EDI 835<br/>Remittance Advice"]
        PAY_POST["Payment Posting<br/>payment_postings table"]
        PAY_RECORD["Payment Record<br/>payments table"]
        RECONCILE["Reconciliation<br/>Reports"]
    end

    subgraph Denials["Denial Management"]
        DENIAL_RECV["Denial Receipt"]
        DENIAL_TRACK["Denial Tracking<br/>denials table"]
        APPEAL["Appeal / Resubmission"]
    end

    INS_CHECK --> ELIG_API --> ELIG_RESULT
    ELIG_RESULT --> PREAUTH_REQ
    PREAUTH_REQ --> PREAUTH_DB --> PREAUTH_RESP
    PREAUTH_RESP --> CLAIM_GEN
    CLAIM_GEN --> EDI_837
    EDI_837 --> CLAIM_SUB
    CLAIM_SUB --> CLAIM_TRACK
    CLAIM_TRACK --> ERA_835
    ERA_835 --> PAY_POST
    ERA_835 --> DENIAL_RECV
    PAY_POST --> PAY_RECORD
    PAY_RECORD --> RECONCILE
    DENIAL_RECV --> DENIAL_TRACK
    DENIAL_TRACK --> APPEAL
    APPEAL --> CLAIM_GEN
```

---

## 11. FHIR R4 Integration Architecture

```mermaid
graph TB
    subgraph FE_FHIR["Frontend"]
        FHIR_VIEW["FHIRView.js"]
        FHIR_API_FE["apiService.js - FHIR endpoints"]
    end

    subgraph BE_FHIR["Backend FHIR Layer"]
        FHIR_ROUTE["/api/fhir<br/>FHIR R4 Resource CRUD"]
        FHIR_TRACK_R["/api/fhir-tracking<br/>Tracking & Events"]
    end

    subgraph FHIR_DB["FHIR Database Tables"]
        FHIR_RES["fhir_resources<br/>(Patient, Observation,<br/>Condition, MedicationRequest...)"]
        FHIR_TRACK_T["fhir_tracking"]
        FHIR_EVT["fhir_tracking_events"]
        FHIR_ERR["fhir_error_actions"]
    end

    subgraph FHIR_RESOURCES["FHIR R4 Resource Types"]
        R_PATIENT["Patient"]
        R_OBSERVATION["Observation"]
        R_CONDITION["Condition"]
        R_MEDREQ["MedicationRequest"]
        R_DIAGRPT["DiagnosticReport"]
        R_ENCOUNTER["Encounter"]
        R_ALLERGY["AllergyIntolerance"]
        R_IMMUNIZE["Immunization"]
        R_PRACTITIONER["Practitioner"]
        R_ORGANIZATION["Organization"]
        R_CAREPLAN["CarePlan"]
        R_CLAIM_FHIR["Claim (FHIR)"]
    end

    subgraph External_FHIR["External FHIR Consumers"]
        EHR_EXT["External EHR Systems"]
        PAYER_EXT["Insurance Payers"]
        HEALTH_GOV["Health Registries"]
    end

    FHIR_VIEW --> FHIR_API_FE
    FHIR_API_FE --> FHIR_ROUTE
    FHIR_ROUTE --> FHIR_RES
    FHIR_TRACK_R --> FHIR_TRACK_T
    FHIR_TRACK_R --> FHIR_EVT
    FHIR_TRACK_R --> FHIR_ERR
    FHIR_RES --> FHIR_RESOURCES
    FHIR_ROUTE <--> External_FHIR
```

---

## 12. Vendor Integration Architecture

```mermaid
graph TB
    subgraph BE_VENDOR["Backend Vendor Layer"]
        VENDOR_ROUTE["/api/vendor-integration-settings"]
        VENDOR_SVC_DIR["services/vendorIntegrations/"]
    end

    subgraph LabCorp["LabCorp Integration"]
        LC_SVC["labcorpService.js"]
        LC_ORDERS["/api/lab-orders"]
        LC_DB["lab_orders table"]
        LC_API["LabCorp API"]
    end

    subgraph Optum["Optum Integration"]
        OPT_SVC["optumService.js"]
        OPT_CLAIMS["/api/claims + /api/preapprovals"]
        OPT_DB["preapprovals + insurance_payers tables"]
        OPT_API["Optum Health API"]
    end

    subgraph SureScripts["SureScripts eRx Integration"]
        SS_SVC["surescriptsService.js"]
        SS_RX["/api/prescriptions"]
        SS_QUEUE["erx_message_queue table"]
        SS_LOG["vendor_transaction_log table"]
        SS_API["SureScripts Network"]
    end

    subgraph VendorConfig["Vendor Configuration DB"]
        VEND_SET_DB["vendor_integration_settings"]
        VEND_LOG_DB["vendor_transaction_log"]
    end

    VENDOR_ROUTE --> VEND_SET_DB
    VENDOR_SVC_DIR --> LC_SVC
    VENDOR_SVC_DIR --> OPT_SVC
    VENDOR_SVC_DIR --> SS_SVC

    LC_SVC --> LC_ORDERS --> LC_DB
    LC_SVC --> LC_API
    LC_SVC --> VEND_LOG_DB

    OPT_SVC --> OPT_CLAIMS --> OPT_DB
    OPT_SVC --> OPT_API
    OPT_SVC --> VEND_LOG_DB

    SS_SVC --> SS_RX --> SS_QUEUE
    SS_SVC --> SS_API
    SS_SVC --> SS_LOG
```

---

## 13. Notification & Communication Architecture

```mermaid
graph LR
    subgraph Triggers["Event Triggers"]
        APPT_BOOK["Appointment Booked"]
        APPT_REMIND["Appointment Reminder"]
        CLAIM_UPDATE["Claim Status Update"]
        RX_READY["Prescription Ready"]
        LAB_RESULT["Lab Results Available"]
        PORTAL_MSG["Patient Portal Message"]
    end

    subgraph NotifService["Notification Service"]
        NOTIF_ROUTE["/api/notifications"]
        NOTIF_PREF["/api/notification-preferences"]
        NOTIF_DB["notifications table"]
        PREF_DB["notification_preferences table"]
    end

    subgraph Channels["Delivery Channels"]
        EMAIL_CH["Email<br/>(Nodemailer / SendGrid)"]
        WHATSAPP_CH["WhatsApp<br/>API"]
        SMS_CH["SMS<br/>(future)"]
    end

    subgraph Templates["Notification Templates"]
        APPT_TMPL["Appointment Templates"]
        CLAIM_TMPL["Claim Templates"]
        CLINICAL_TMPL["Clinical Alert Templates"]
    end

    Triggers --> NotifService
    NotifService --> NOTIF_DB
    PREF_DB --> NotifService
    NotifService --> Channels
    Templates --> NotifService
```

---

## 14. Deployment & Infrastructure Architecture

```mermaid
graph TB
    subgraph Internet["Internet"]
        USER_BR["User Browser"]
        PATIENT_BR["Patient Browser"]
    end

    subgraph Vercel["Vercel Platform"]
        subgraph FE_VERCEL["Frontend (Static)"]
            REACT_BUILD["React Build (npm run build)<br/>Served as Static Files"]
            CDN_VERCEL["Vercel Edge CDN<br/>Global Distribution"]
        end

        subgraph BE_VERCEL["Backend (Serverless)"]
            NODE_SLS["@vercel/node Runtime<br/>Serverless Functions"]
            API_FUNC["Express.js API Handler<br/>/api/* routes"]
        end

        VERCEL_CFG["vercel.json<br/>Route Config + Build Settings"]
    end

    subgraph Supabase["Supabase Cloud"]
        PG_SB["PostgreSQL Database<br/>76 Tables"]
        SB_AUTH["Supabase Auth<br/>(optional)"]
        SB_STORAGE["Supabase Storage<br/>(optional)"]
        SB_REALTIME["Supabase Realtime"]
    end

    subgraph Redis_Infra["Redis (Optional)"]
        REDIS_INST["Redis Instance<br/>Session Cache · Rate Limiting"]
    end

    subgraph ExtAPIs["External APIs"]
        OAUTH_EXT["OAuth Providers<br/>Google · Microsoft"]
        HEALTH_APIS["Healthcare APIs<br/>LabCorp · Optum · SureScripts"]
        VIDEO_APIS["Video APIs<br/>Zoom · Google Meet · Webex"]
        EMAIL_SVC["Email Services<br/>SMTP · SendGrid"]
    end

    USER_BR -->|"HTTPS"| CDN_VERCEL
    PATIENT_BR -->|"HTTPS"| CDN_VERCEL
    CDN_VERCEL --> REACT_BUILD
    REACT_BUILD -->|"API calls /api/*"| NODE_SLS
    NODE_SLS --> API_FUNC
    API_FUNC -->|"pg driver + SSL"| PG_SB
    API_FUNC -->|"@supabase/supabase-js"| SB_AUTH
    API_FUNC -->|"ioredis"| REDIS_INST
    API_FUNC -->|"HTTPS"| OAUTH_EXT
    API_FUNC -->|"HTTPS"| HEALTH_APIS
    API_FUNC -->|"HTTPS"| VIDEO_APIS
    API_FUNC -->|"SMTP/TLS"| EMAIL_SVC
```

---

## 15. Security Architecture

```mermaid
graph TB
    subgraph Network["Network Security"]
        HELMET["Helmet.js<br/>HTTP Security Headers"]
        CORS_SEC["CORS Policy<br/>Allowed Origins Only"]
        RATELIMIT["Rate Limiting<br/>express-rate-limit"]
        HTTPS_ENF["HTTPS Enforcement<br/>(Vercel TLS)"]
    end

    subgraph AppSecurity["Application Security"]
        JWT_AUTH["JWT Authentication<br/>HS256 Signed Tokens"]
        BCRYPT["bcryptjs<br/>Password Hashing"]
        AES["AES-256 Encryption<br/>Sensitive Data at Rest"]
        RBAC_SEC["RBAC Authorization<br/>Role + Permission Checks"]
        INPUT_VAL["Input Validation<br/>Joi Schema Validation"]
        SQL_PARAM["Parameterized Queries<br/>SQL Injection Prevention"]
    end

    subgraph DataSecurity["Data Security"]
        PG_SSL["PostgreSQL SSL<br/>Encrypted Connections"]
        ENV_VARS["Environment Variables<br/>No Secrets in Code"]
        AUDIT_LOG["Audit Logging<br/>All Data Changes Tracked"]
        ARCHIVE["Data Archival<br/>Retention Policies"]
    end

    subgraph Compliance["Healthcare Compliance"]
        FHIR_COMP["FHIR R4 Compliance<br/>Interoperability Standard"]
        HL7_COMP["HL7 v2 / EDI<br/>Claims Standards"]
        ICD_CPT["ICD-10 + CPT Codes<br/>Clinical Standards"]
        AUDIT_TRAIL["Complete Audit Trail<br/>audit_logs table"]
    end

    Network --> AppSecurity
    AppSecurity --> DataSecurity
    DataSecurity --> Compliance
```

---

## 16. Data Flow Summary

```mermaid
flowchart TD
    subgraph External_In["External Inputs"]
        PATIENT_INPUT["Patient Data Input"]
        PROVIDER_INPUT["Provider Input"]
        INSURANCE_INPUT["Insurance Data"]
        LAB_RESULTS["Lab Results (LabCorp)"]
        ERA_INPUT["EDI 835 Remittance"]
    end

    subgraph Processing["AureonCare System"]
        FE_PROC["React Frontend<br/>Presentation Layer"]
        BE_PROC["Express API<br/>Business Logic"]
        DB_PROC["PostgreSQL<br/>Data Storage"]
        CACHE["Redis Cache<br/>Session/Performance"]
    end

    subgraph External_Out["External Outputs"]
        ERX_OUT["E-Prescriptions<br/>(SureScripts)"]
        CLAIM_OUT["EDI 837 Claims<br/>(Insurance Payers)"]
        FHIR_OUT["FHIR Resources<br/>(External EHRs)"]
        NOTIF_OUT["Notifications<br/>(Email/WhatsApp)"]
        TELE_OUT["Telehealth Sessions<br/>(Zoom/Meet/Webex)"]
        REPORTS_OUT["Reports & Analytics"]
        CALENDAR_OUT["Calendar Events<br/>(Google/MS)"]
    end

    External_In --> FE_PROC
    FE_PROC <--> BE_PROC
    BE_PROC <--> DB_PROC
    BE_PROC <--> CACHE
    BE_PROC --> External_Out
```

---

## Component Summary Table

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18.2 + Tailwind CSS | SPA Web Application |
| **State Management** | React Context API | Global App State |
| **Routing** | React Router v6 | Client-Side Navigation |
| **API Client** | Axios | HTTP Communication |
| **Charts** | Recharts + Chart.js | Analytics Visualization |
| **PDF/Excel** | jsPDF + XLSX | Document Export |
| **Video SDK** | @zoom/meetingsdk | In-Browser Telehealth |
| **Backend** | Node.js + Express.js 4.x | REST API Server |
| **Authentication** | JWT + bcryptjs | Auth Tokens + Hashing |
| **Authorization** | Custom RBAC Middleware | Role/Permission Checks |
| **Social Auth** | Google + MS MSAL OAuth | SSO Integration |
| **Database** | PostgreSQL 12+ (Supabase) | Primary Data Store |
| **Cache** | Redis 6+ | Session + Performance Cache |
| **File Storage** | Multer + Local/Cloud | Document Uploads |
| **Email** | Nodemailer + SendGrid | Transactional Email |
| **Hosting** | Vercel (Frontend + Backend) | Cloud Deployment |
| **Lab Integration** | LabCorp API | Lab Order Management |
| **Insurance** | Optum API | Claims + Eligibility |
| **e-Prescriptions** | SureScripts | Electronic Prescriptions |
| **Telehealth** | Zoom + Google Meet + Webex + Teams | Video Consultations |
| **Interoperability** | FHIR R4 + HL7 v2/EDI | Healthcare Standards |
| **Compliance** | Audit Logs + AES-256 | HIPAA-Aligned Controls |
| **Security** | Helmet + CORS + Rate Limiting | Network Protection |
