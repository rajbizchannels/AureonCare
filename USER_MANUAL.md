# AureonCare User Manual

**Version 1.3 - Updated August 2026**
**Modern Healthcare Practice Management System**

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Dashboard Overview](#4-dashboard-overview)
5. [Patient Management](#5-patient-management)
6. [Appointment Scheduling](#6-appointment-scheduling)
7. [Provider Management](#7-provider-management)
8. [Electronic Health Records (EHR)](#8-electronic-health-records-ehr)
9. [Prescriptions Management](#9-prescriptions-management)
10. [Diagnosis Management](#10-diagnosis-management)
11. [Telehealth Video Consultations](#11-telehealth-video-consultations)
12. [Laboratory Orders & Results](#12-laboratory-orders--results)
13. [Pharmacy Management](#13-pharmacy-management)
14. [Revenue Cycle Management](#14-revenue-cycle-management)
15. [Healthcare Offerings](#15-healthcare-offerings)
16. [Patient Portal](#16-patient-portal)
17. [Reports & Analytics](#17-reports--analytics)
18. [Notifications & Tasks](#18-notifications--tasks)
19. [Administration](#19-administration)
20. [Settings & Preferences](#20-settings--preferences)
21. [Troubleshooting & FAQs](#21-troubleshooting--faqs)
22. [Best Practices](#22-best-practices)
23. [Glossary](#23-glossary)
24. [Form Management](#24-form-management)
25. [Accounting](#25-accounting)
26. [Inventory Management](#26-inventory-management)
27. [Subscription Plans & Licensing](#27-subscription-plans--licensing)

---

## 1. Introduction

### 1.1 About AureonCare

AureonCare is a comprehensive, enterprise-grade medical practice management platform designed to streamline healthcare operations, enhance patient care, and optimize revenue cycles. The system integrates multiple healthcare functions into a single, unified platform.

**Key Capabilities:**
- Electronic Health Records (EHR) management
- Appointment scheduling, waitlist, and public self-booking links
- Revenue Cycle Management (RCM) with claims and billing
- Double-entry accounting and inventory management
- Custom form building with automated patient intake
- Telehealth video consultations across Zoom, Google Meet, Teams, and Webex
- Patient portal for self-service
- Laboratory and pharmacy management
- Email and WhatsApp notifications across every module
- FHIR HL7 compliant for interoperability
- Multi-language support (8 languages)
- HIPAA-ready security and compliance
- Cloud, customer-cloud, and on-premises deployment

### 1.2 Who Should Use This Manual

This manual is designed for:
- **Healthcare Administrators** - Managing the entire system
- **Physicians/Providers** - Clinical care and patient management
- **Nurses** - Patient care support and documentation
- **Receptionists** - Patient intake and appointment scheduling
- **Billing Managers** - Revenue cycle and claims management
- **CRM Managers** - Patient engagement and communications
- **Patients** - Using the patient portal
- **IT Staff** - System configuration and maintenance

### 1.3 System Requirements

**For Healthcare Staff:**
- Modern web browser (Chrome, Firefox, Safari, Edge - latest versions)
- Internet connection (minimum 5 Mbps recommended)
- Screen resolution: 1280x720 or higher
- For telehealth: Webcam and microphone

**For Patients:**
- Modern web browser or mobile device
- Internet connection
- Email address for portal access
- For telehealth: Webcam and microphone

### 1.4 Conventions Used in This Manual

- **Bold text** - Important terms or UI elements
- `Code text` - Technical terms or data fields
- ⚠️ **Warning** - Important information to prevent errors
- 💡 **Tip** - Helpful suggestions and best practices
- ✅ **Note** - Additional information

### 1.5 What's New in Version 1.3 (August 2026)

**Major New Features:**

🆕 **Three-Pane Application Shell**
- The platform is reorganised around a three-pane workspace layout
- **Pane 1 — Workspace groups:** Home, Scheduling, Patients, Clinical, Billing, Operations, Growth, Insights, Settings
- **Pane 2 — Modules:** the modules and sub-modules inside the active group
- **Pane 3 — Content:** the module view itself
- Breadcrumb trail shows your position across all three panes
- Every module from earlier versions is still reachable — nothing was removed
- Home collapses to a single pane so the dashboard fills the content area
- See Section 2.4 for the full navigation map

🆕 **Accounting Module** (Operations)
- Double-entry accounting built into the platform
- Chart of Accounts, Journal Entries, Receivables, Payables
- Bank reconciliation and financial statements
- Ties directly to Revenue Cycle payments and Inventory purchase orders
- See Section 25

🆕 **Inventory Management** (Operations)
- Track items, stock levels, and reorder points
- Purchase orders and supplier management
- Item categories and stock movement history
- Low-stock alerts routed through the notification system
- See Section 26

🆕 **Form Management** (Patients)
- Build and version custom forms from a template library
- Default intake forms trigger automatically on patient registration
- Patients complete assigned forms in the Patient Portal
- Submission tracking with a full form audit trail
- See Section 24

🆕 **Expanded Telehealth Providers**
- Zoom, Google Meet, Microsoft Teams, and Webex are all supported
- Per-patient telehealth preference is honoured when scheduling
- OAuth connection and token refresh handled per provider in Settings → Integrations
- Zoom Marketplace compliance: consent dialogs, recording indicator, Active Apps Notifier

🆕 **Public Booking Links**
- Share a public self-scheduling link at `/book/<practice-slug>`
- Patients book without an account; no login required
- Prices display in the practice's configured currency
- Bookings flow into the normal appointment queue

🆕 **Centralised Notification System**
- Email (SMTP) and WhatsApp notifications across all modules
- Notifies patients, providers, and admins on the events that matter
- Patients opt in to WhatsApp; providers and admins use the number on record
- Notification failures never block the underlying action

🆕 **Stripe Payment Integration**
- Card payments processed through Stripe
- Webhook handler keeps payment status in sync automatically
- Stripe credentials configured in Settings → Integrations

🆕 **Subscription Tiers & License Keys**
- Four tiers: **Practice Essentials**, **Clinical Pro**, **Enterprise**, **On-Premises**
- Module access is gated by tier *and* by role — both must permit access
- License key generation, activation, and revocation for on-premises deployments
- Seat limits on providers, users, and patients
- See Section 27

🆕 **Rebuilt Reports Module**
- Reports reorganised into categories under Insights
- Custom report builder for ad-hoc queries
- Consistent export to PDF, Excel, and CSV

🆕 **Security Hardening**
- JWT-based authentication issued at login and verified on every API call
- All user, clinical, and admin endpoints require authentication
- Session state moved from `localStorage` to `sessionStorage`
- Patient portal: rate limiting and account lockout on repeated failed logins
- Portal session tokens hashed at rest and bound to the patient
- Social login tokens validated server-side before an account is created
- Clickjacking protections added

🆕 **Patient Portal Enhancements**
- The portal is now the patient's Home workspace
- Assigned forms appear directly in the portal
- Dated patient record uploads with cloud storage sync
- Appointment, diagnosis, prescription, and record views reorganised

🆕 **FHIR Tracking & Calendar Sync**
- FHIR resource tracking restored under Clinical
- Provider calendar synchronisation re-enabled

🆕 **Deployment Options**
- Docker and Helm charts for self-hosted installs
- CI/CD pipelines and an automated update agent
- Supports cloud, customer-cloud, and on-premises deployment

### 1.6 What's New in Version 1.2 (January 2026)

**Major New Features:**

🆕 **Universal Search**
- Powerful global search across all modules (Patients, Providers, Appointments, etc.)
- Click search results to instantly navigate to detailed views
- Search by name, MRN, phone, email, diagnosis, medication, and more
- Results show relevant context and entity type
- Real-time search as you type
- Available from any page via search icon in header

🆕 **Comprehensive Data Archiving System**
- Automated data archiving to separate archive database
- Configurable archiving rules by data age and module
- Support for 14 modules: Patients, Appointments, Medical Records, Prescriptions, and more
- Manual and scheduled archiving options
- Browse and search archived data
- Restore archived records when needed
- Compliance with data retention policies
- Archive size tracking and management

🆕 **Complete Audit Logging**
- Track all user actions across the system
- Comprehensive audit trail for compliance (HIPAA, SOX, etc.)
- Log captures: user, action, entity type, timestamp, IP address, changes made
- View audit logs in Administration > Audit Logs tab
- Filter by date range, user, action type, entity type
- Export audit logs for compliance reporting
- Automatic retention and archiving of audit logs

🆕 **SOAP Notes in Diagnosis Management**
- Added SOAP Notes field to diagnosis form
- Document Subjective, Objective, Assessment, Plan
- Structured clinical documentation
- Better quality of care tracking
- Supports medical necessity documentation

🆕 **Enhanced Patient Registration**
- Allergies field added to patient form
- Past Medical History (PMH) field
- Family History field
- Comprehensive patient medical background capture
- Better clinical decision support

🆕 **Expanded Roles & Permissions**
- Now supports all 14 modules in permission system
- Granular access control: View, Create, Edit, Delete
- Modules: Patients, Appointments, Providers, EHR, Prescriptions, Diagnoses, Lab Orders, Telehealth, RCM, Pharmacy, Offerings, CRM, Administration, Reports
- Custom role creation with specific permissions
- Enhanced security and access control

🆕 **Cloud Backup Integration**
- OAuth integration for Google Drive backup
- OAuth integration for OneDrive backup
- Secure cloud storage for automated backups
- Easy reconfiguration and provider switching
- Backup status monitoring

🆕 **Inline Form Experience**
- User management now uses full-screen inline forms (no modals)
- Role management with inline forms
- Better UX for complex data entry
- Improved accessibility and mobile experience

🆕 **Language Selection in User Profile**
- Users can select preferred language in their profile
- Automatic language switching on login
- Supported languages: English, Spanish, French, German, Arabic, Hindi, Mandarin, Portuguese
- Enhanced localization support

🆕 **Themed Modals and Confirmations**
- Replace browser confirm/alert popups with themed modals
- Consistent design across all confirmation dialogs
- Better visual feedback for user actions
- Improved accessibility

🆕 **Comprehensive Help & Documentation System**
- Interactive in-app help drawer accessible from any page
- AI-powered assistant for contextual help
- 9 comprehensive documentation guides covering all major features:
  - Clinical Notes & SOAP documentation
  - Vital signs recording and management
  - Telehealth video consultations
  - Insurance claims management
  - Payment processing and collections
  - Reports and analytics
  - User management and permissions
  - Practice settings configuration
  - Common issues troubleshooting
- Publicly accessible documentation website (no login required)
- Professional styling matching main AureonCare theme
- Search functionality across all help articles
- Step-by-step instructions with tables, lists, and best practices
- Contextual help based on current module
- Quick access via Help icon in header or ?help=true URL parameter

### 1.7 What's New in Version 1.1 (December 2025)

**Previous Enhancements:**

🆕 **Waitlist Management Integration**
- Waitlist now fully integrated into Practice Management module
- Access via **Practice Management > Waitlist** tab
- Unified workflow for appointments and waitlist
- Enhanced status tracking and priority management
- Auto-notification for available slots

🆕 **Advanced Lab Order System**
- CPT code multiselect dropdown (80+ common lab tests)
- Support for recurring and future lab orders
- Collection method specification (clinic vs. lab collect)
- Result recipient multiselect
- Print functionality for professional lab orders
- Lab Orders tab in Patient History

🆕 **Enhanced ePrescribe Workflow**
- Edit mode support in ePrescribe modal
- Medication name prefilled when editing
- Step-by-step guided workflow
- Smart context retention across steps
- Improved user experience for prescription management

🆕 **Diagnosis-Prescription Linking**
- Link prescriptions directly to diagnoses
- Better clinical documentation
- View associated prescriptions per diagnosis
- Enhanced quality tracking and reporting

🆕 **Modern UI Improvements**
- Toggle switches replace checkboxes throughout system
- Better visual indicators (ON/OFF states)
- More accessible and touch-friendly interface
- Consistent with modern design patterns
- Improved forms in Pharmacy and Laboratory modules

🆕 **Pharmacy & Laboratory Management**
- Comprehensive pharmacy directory with enhanced fields
- Laboratory facility management with toggle switches
- Detailed service feature tracking
- Integration settings for HL7/FHIR
- Operating hours and contact management

🆕 **User Experience Enhancements**
- Action confirmation popups on all forms
- Read-only patient field in diagnosis form (auto-populated from context)
- Improved CRM card count refresh
- Better error handling and validation
- Enhanced appointment display (showing only today or later)

---

## 2. Getting Started

### 2.1 Logging In

**Staff Portal Login:**

1. Navigate to the AureonCare URL provided by your administrator
2. Enter your **Email Address**
3. Enter your **Password**
4. Click **Sign In**

**Patient Portal Login:**

1. Navigate to the Patient Portal URL
2. Enter your registered **Email Address**
3. Enter your **Password**
4. Click **Sign In**

💡 **Tip:** Use the "Remember Me" option on trusted devices for faster access.

**Forgot Password:**

1. Click **Forgot Password** on the login screen
2. Enter your email address
3. Check your email for a password reset link (valid for 1 hour)
4. Click the link and create a new password
5. Confirm your new password
6. Log in with your new credentials

### 2.2 First-Time Login

When logging in for the first time:

1. You may be prompted to change your temporary password
2. Set up your user profile (name, contact information)
3. Upload a profile picture (optional)
4. Set your language preference
5. Review your assigned roles and permissions

### 2.3 Social Login (OAuth)

AureonCare supports social login options:

1. On the login screen, click one of the social login buttons:
   - **Sign in with Google**
   - **Sign in with Microsoft**
   - **Sign in with Facebook**
2. Authorize AureonCare to access your account
3. Complete your profile setup if this is your first login

### 2.4 Understanding the Interface

**🆕 UPDATED IN V1.3:** AureonCare uses a three-pane application shell.

**The Three Panes:**

| Pane | Name | What it holds |
|------|------|---------------|
| **1** | Primary navigation | Workspace groups — Home, Scheduling, Patients, Clinical, Billing, Operations, Growth, Insights, Settings |
| **2** | Secondary navigation | The modules and sub-modules inside the workspace you selected |
| **3** | Content | The module view you are working in |

Select a workspace in pane 1, pick a module in pane 2, and it opens in pane 3. A breadcrumb trail above the content shows your position and lets you step back.

✅ **Note:** Home holds a single destination, so the shell hides pane 2 and the dashboard fills the content area.

**Header Controls:**
- **Universal Search** - Search every module (Ctrl+K / Cmd+K)
- **Notifications Icon** - View system notifications
- **Help Icon (?)** - Open the help drawer
- **User Profile Icon** - Access settings and logout
- **Theme Toggle** - Switch between light and dark mode
- **Language Selector** - Change interface language

**Dashboard Layout:**
- **Stat Cards** - Key metrics at a glance
- **Quick Actions** - Frequently used functions
- **Recent Activity** - Latest updates and changes
- **Upcoming Appointments** - Today's schedule
- **Pending Tasks** - Action items requiring attention

Dashboard cards drill down into detail views nested under Home.

### 2.5 Navigation Map

Every module in AureonCare lives in exactly one workspace group. Use this map to find what you need.

**🏠 Home**
- Dashboard — today at a glance

**📅 Scheduling**
- *Calendar:* Calendar view (day/week/month), Appointment list, Waitlist
- *Providers:* Provider management
- *Setup:* Appointment types

**👥 Patients**
- *Records:* EHR, Diagnosis, Patient history
- *Forms:* Patient intake, Form templates, Form submissions, Form audit
- *Engagement:* Patient portal — appointments, diagnoses, prescriptions, records, forms

**🩺 Clinical**
- *Care:* Telehealth
- *Network:* Pharmacies, Laboratories
- *FHIR:* FHIR tracking

**💰 Billing**
- *Revenue Cycle:* Claims, Pre-approvals, Payments, Payment postings, Denials
- *Patient Billing:* Invoices
- *Setup:* Insurance payers

**⚙️ Operations**
- *Accounting:* Overview, Chart of accounts, Journal, Receivables, Payables, Reconciliation, Statements
- *Inventory:* Overview, Items, Stock, Purchase orders, Suppliers, Categories

**📈 Growth**
- *CRM:* Overview, Campaigns
- *Catalog:* Offerings, Packages, Service categories, Promotions, Catalog stats

**📊 Insights**
- Reports (by category)
- Custom report builder

**🔧 Settings**
- *Practice:* Clinic settings, Working hours, Appointment settings
- *Access:* Users, Roles, Plans
- *System:* Integrations, Telehealth setup, Backup, Archive, Audit logs

💡 **Tip:** What you see depends on your subscription tier *and* your role. A module must be included in your plan **and** permitted by your role before it appears. See Section 27.

**Common Actions:**
- **View** - Click on a record to see details
- **Edit** - Click the Edit button or pencil icon
- **Delete** - Click the Delete button or trash icon
- **Search** - Use the search box at the top of lists
- **Filter** - Use filter dropdowns to narrow results

### 2.6 Universal Search

**🆕 NEW IN V1.2:** Powerful global search across all modules!

**What is Universal Search?**

Universal Search allows you to search across all modules and records in AureonCare from a single search bar. Instead of navigating to each module separately, you can find patients, providers, appointments, prescriptions, diagnoses, and more from anywhere in the system.

**Accessing Universal Search:**

1. Click the **Search icon** (magnifying glass) in the top header
2. Or use keyboard shortcut **Ctrl+K** (Windows) or **Cmd+K** (Mac)
3. Search bar appears with focus ready for input

**What You Can Search:**

Universal Search covers **all major entities**:
- **Patients** - Search by name, MRN, phone number, email, date of birth
- **Providers** - Search by name, specialty, license number
- **Appointments** - Search by patient name, provider name, date, status
- **Prescriptions** - Search by medication name, patient name
- **Diagnoses** - Search by ICD code, diagnosis name, patient name
- **Lab Orders** - Search by test name, patient name, CPT code
- **Medical Records** - Search by patient name, record type
- **Pharmacies** - Search by pharmacy name, address
- **Lab Facilities** - Search by facility name, CLIA number
- **Insurance Payers** - Search by payer name
- **Healthcare Offerings** - Search by offering name, description
- **CRM Campaigns** - Search by campaign name, status

**How to Use Universal Search:**

1. Click the search icon or press Ctrl+K
2. Start typing your search query (minimum 2 characters)
3. Results appear in real-time as you type
4. Results are grouped by entity type (Patients, Providers, etc.)
5. Each result shows:
   - **Entity name** (e.g., patient name, provider name)
   - **Entity type** (e.g., "Patient", "Prescription")
   - **Relevant details** (e.g., MRN, phone, DOB for patients)
6. Click on any search result to navigate directly to that record

**Clickable Results:**

When you click a search result, AureonCare automatically:
- Opens the appropriate module
- Loads the specific record
- Shows the detailed view or edit form
- For patients: Opens the patient chart with correct tab
- For prescriptions/diagnoses/lab orders: Opens patient chart on the relevant tab
- For appointments: Opens the appointment in edit mode

**Example Search Scenarios:**

**Find a Patient:**
- Type: "John Smith" or "12345" (MRN) or "555-1234" (phone)
- Results show all matching patients
- Click patient to open their chart

**Find a Prescription:**
- Type: "Lisinopril" or "Smith Lisinopril"
- Results show all prescriptions containing that medication
- Click to open patient chart on Prescriptions tab

**Find an Appointment:**
- Type: "Dr. Johnson 2026-01-30"
- Results show appointments for that provider on that date
- Click to view/edit appointment

**Search Tips:**

💡 **Partial Matching:**
- Search supports partial matches
- "Smi" will find "Smith", "Smithson", etc.

💡 **Multiple Words:**
- Searches across all searchable fields
- "John 555" will find patients with "John" in name AND "555" in phone

💡 **Case Insensitive:**
- Search is not case-sensitive
- "john smith" = "John Smith" = "JOHN SMITH"

💡 **Special Characters:**
- Phone numbers can be entered with or without formatting
- "5551234" = "555-1234" = "(555) 123-4"

💡 **Recent Searches:**
- System remembers your recent searches
- Quickly re-run previous searches

**Search Performance:**

- Real-time results as you type
- Results typically appear in < 500ms
- Maximum 50 results shown per entity type
- Ordered by relevance and recency

**Access Control:**

- You can only search and view records you have permission to access
- Search results respect role-based permissions
- Hidden/archived records not shown in search results

### 2.7 Help & Documentation System

**🆕 NEW IN V1.2:** Comprehensive in-app help and documentation!

AureonCare now includes a powerful help system to assist you with any questions or tasks. Get instant answers, step-by-step instructions, and contextual guidance without leaving the application.

#### 2.7.1 Accessing Help

**In-App Help Drawer:**

1. Click the **Help icon** (question mark) in the top header
2. Or add `?help=true` to any URL to open help automatically after login
3. Help drawer slides in from the right side of the screen

**Documentation Website:**

1. Navigate to `/docs` from your browser (e.g., `http://localhost:3001/docs`)
2. No login required - publicly accessible
3. Browse all documentation guides and articles

#### 2.7.2 Help Drawer Features

The help drawer provides three main tabs:

**📚 Browse Tab:**
- Explore all help articles organized by category:
  - **Getting Started** - Login, navigation, dashboard basics
  - **Clinical Workflows** - Patient management, EHR, prescriptions, diagnoses
  - **Revenue Cycle** - Claims, payments, billing
  - **Administration** - User management, settings, reports
  - **Troubleshooting** - Common issues and solutions
- Click any article to view full content
- Click "Read Full Documentation" to open detailed guide in new tab

**🔍 Search Tab:**
- Search across all help articles
- Real-time results as you type
- Shows article title, category, and summary (headline + 2 lines)
- Click any result to view full article
- Search by keywords, module names, or topics

**🤖 AI Assistant Tab:**
- Interactive AI-powered help assistant
- Ask questions in natural language
- Get contextual answers based on your current module
- Suggested questions to get started
- View related documentation articles
- Click articles to see full content
- AI provides specific, actionable guidance

#### 2.7.3 Comprehensive Documentation Guides

The following detailed guides are available in the documentation system:

| Guide | Description | Access URL |
|-------|-------------|------------|
| **Clinical Notes** | Complete guide to clinical documentation with SOAP notes format, templates, macros, voice dictation, signing procedures, and addendums | `/docs/guides/clinical-notes.html` |
| **Vital Signs** | Vital signs management including recording methods, normal ranges, color-coded alerts, trending, and graphs | `/docs/guides/vitals.html` |
| **Telehealth** | Virtual care guide covering scheduling, video controls, billing with CPT codes and Modifier 95, privacy, security, and troubleshooting | `/docs/guides/telehealth.html` |
| **Claims Management** | Insurance claims workflow including CPT codes, eligibility verification, submissions (EDI 837, CMS-1500), claim status, denials, and appeals | `/docs/guides/claims.html` |
| **Payment Processing** | Complete payment guide with payment methods (Cash, Check, Card, ACH, Portal), payment types, posting to claims, refunds, and reports | `/docs/guides/payments.html` |
| **Reports & Analytics** | Reports system covering clinical, operational, and financial reports with parameters, filters, exports (PDF, Excel, CSV), and scheduled reports | `/docs/guides/reports.html` |
| **User Management** | User administration with v1.2 features including language selection (8 languages with auto-switching), inline forms, role assignment, and permissions for all 14 modules | `/docs/guides/user-management.html` |
| **Practice Settings** | Practice configuration guide covering organization info, working hours, appointment settings, billing, communication, security, integrations, and OAuth cloud backups | `/docs/guides/practice-settings.html` |
| **Common Issues** | Troubleshooting guide for login issues, performance problems, appointments, prescriptions, claims, telehealth, data entry, and browser compatibility | `/docs/troubleshooting/common-issues.html` |

#### 2.7.4 Documentation Features

**Professional Styling:**
- Blue gradient theme matching main AureonCare interface
- Responsive design for desktop, tablet, and mobile
- Clean, readable layout with proper typography
- Consistent headers, footers, and navigation

**Comprehensive Content:**
- Step-by-step instructions for all major workflows
- Tables summarizing key information (CPT codes, vital ranges, payment types, etc.)
- Lists of features and options
- Best practices and tips
- Common questions and answers
- Visual hierarchy with headings and sections

**No Authentication Required:**
- All documentation is publicly accessible
- No login needed to browse guides
- Direct URL access for sharing with team members
- Can be accessed from any device or browser

**Easy Navigation:**
- Home button to return to main website
- Back to documentation link on each page
- Hash-based navigation for deep linking
- Breadcrumb navigation showing current location

#### 2.7.5 Using the AI Assistant

The AI Assistant provides intelligent, contextual help:

**How to Use:**

1. Open Help Drawer and click **AI Assistant** tab
2. Type your question in the chat input
3. Press Enter or click Send
4. AI analyzes your question and current context
5. Receive detailed answer with relevant documentation links
6. Click suggested articles to learn more

**Example Questions:**

- "How do I create a new patient?"
- "What are the steps to submit a claim?"
- "How do I schedule a telehealth appointment?"
- "Where can I find payment reports?"
- "How do I add a new user with specific permissions?"
- "What should I do if a patient's chart won't load?"

**AI Assistant Features:**

- **Context-Aware:** Knows which module you're currently using
- **Documentation Links:** Provides relevant help articles with each response
- **Conversational:** Ask follow-up questions for clarification
- **Suggested Questions:** Click pre-written questions to get started
- **Article Preview:** View full article content in modal without leaving chat
- **Persistent History:** See previous questions and answers in session

**Tips for Best Results:**

💡 **Be Specific:** "How do I record vital signs?" is better than "vitals?"
💡 **Include Context:** "How do I void a posted payment?" vs "void payment"
💡 **Ask Follow-ups:** Get clarification or more details on any answer
💡 **Check Articles:** Click related articles for comprehensive step-by-step guides

#### 2.7.6 Help Access by Module

Help is contextual - when you open the help drawer from a specific module, you'll see:

- Relevant articles for that module highlighted
- AI Assistant knows your current module context
- Search results prioritized by relevance to current module
- Quick actions specific to the module you're working in

**Module-Specific Help:**

| Module | Contextual Help Includes |
|--------|-------------------------|
| **Patients** | Patient registration, searching, demographics, allergies, PMH, family history |
| **Appointments** | Scheduling, rescheduling, cancellations, waitlist, calendar views |
| **EHR/Medical Records** | Clinical notes, SOAP format, vital signs, templates, macros, signing |
| **Prescriptions** | ePrescribe workflow, medication search, drug interactions, refills |
| **Diagnoses** | ICD code search, SOAP notes, linking prescriptions, diagnosis tracking |
| **Telehealth** | Session setup, video controls, troubleshooting, billing, documentation |
| **Lab Orders** | Creating orders, CPT codes, tracking results, printing orders |
| **Claims** | Creating claims, CPT codes, submissions, status tracking, denials |
| **Payments** | Recording payments, payment types, posting, refunds, reports |
| **Reports** | Accessing reports, parameters, filters, exports, scheduled reports |
| **Administration** | User management, roles, permissions, settings, backups, audit logs |

#### 2.7.7 Getting Help When You Need It

**During Onboarding:**
- First-time users can access guided tours (opt-in)
- Help drawer provides getting started articles
- AI Assistant answers common beginner questions

**While Working:**
- Click Help icon anytime you have questions
- Search for specific topics instantly
- Get step-by-step guidance without leaving your workflow

**For Troubleshooting:**
- Access comprehensive troubleshooting guide
- Search for error messages or symptoms
- AI Assistant helps diagnose common issues
- Links to technical support when needed

**For Advanced Features:**
- Detailed guides for complex workflows
- Best practices from clinical and operational experts
- Tips for optimizing efficiency
- Instructions for all v1.2 features

---

## 3. User Roles & Permissions

### 3.1 Understanding Roles

AureonCare uses a Role-Based Access Control (RBAC) system with 8 predefined roles:

#### 3.1.1 Administrator
**Full system access for practice managers and IT staff**

**Permissions:**
- All system permissions
- User management (create, edit, delete users)
- Role management (assign roles, manage permissions)
- Subscription plan management
- Organization settings configuration
- System-wide reports and analytics

**Typical Users:** Practice administrators, IT managers, system administrators

**Key Responsibilities:**
- Configure clinic settings
- Manage user accounts and roles
- Monitor system usage
- Handle subscription and billing
- Ensure data security and compliance

#### 3.1.2 Doctor/Provider
**Clinical staff providing patient care**

**Permissions:**
- View, create, edit patient records
- Manage appointments
- Create and update medical records
- Prescribe medications
- Create diagnoses
- Conduct telehealth sessions
- Order lab tests
- View reports and analytics
- Access EHR system

**Typical Users:** Physicians, specialists, nurse practitioners

**Key Responsibilities:**
- Provide patient care
- Document clinical encounters
- Review lab results
- Manage prescriptions
- Conduct video consultations

#### 3.1.3 Patient
**Patients accessing their own health information**

**Permissions:**
- View own appointments
- Book new appointments
- View own medical records
- View prescriptions
- View diagnoses
- Access patient portal
- Manage profile
- Join telehealth sessions

**Typical Users:** Patients registered in the system

**Key Responsibilities:**
- Keep personal information up to date
- Attend scheduled appointments
- Follow treatment plans
- Communicate with care team

#### 3.1.4 Nurse
**Nursing staff supporting patient care**

**Permissions:**
- View and edit patient records
- Manage appointments
- Update medical records
- View prescriptions and diagnoses
- Record vital signs
- Assist with telehealth sessions
- View lab results

**Typical Users:** Registered nurses, licensed practical nurses, medical assistants

**Key Responsibilities:**
- Patient intake and triage
- Vital signs documentation
- Medication administration tracking
- Patient education
- Clinical documentation support

#### 3.1.5 Receptionist
**Front desk staff managing patient flow**

**Permissions:**
- Create and edit patient records
- Schedule, reschedule, cancel appointments
- Manage waitlist
- Check-in patients
- View appointment calendar
- Update patient contact information
- Manage patient demographics

**Typical Users:** Front desk staff, schedulers, patient coordinators

**Key Responsibilities:**
- Patient registration and check-in
- Appointment scheduling
- Insurance information collection
- Phone call management
- Waitlist coordination

#### 3.1.6 Billing Manager
**Financial staff managing revenue cycle**

**Permissions:**
- Full access to billing and claims
- Create and manage claims
- Process payments
- Manage insurance payers
- View financial reports
- Access revenue analytics
- Export financial data

**Typical Users:** Billing specialists, revenue cycle managers, accountants

**Key Responsibilities:**
- Claims submission and tracking
- Payment processing
- Insurance verification
- Denial management
- Financial reporting
- Revenue cycle optimization

#### 3.1.7 CRM Manager
**Staff managing patient engagement and communications**

**Permissions:**
- Full CRM access
- View patient communications history
- Manage marketing campaigns
- Create healthcare offerings
- View engagement reports
- Manage patient relationships

**Typical Users:** Marketing staff, patient engagement coordinators

**Key Responsibilities:**
- Patient outreach and engagement
- Marketing campaign management
- Patient satisfaction tracking
- Communication coordination
- Relationship management

#### 3.1.8 Staff
**General staff with limited access**

**Permissions:**
- Basic view access
- Limited patient information access
- View appointments
- Basic reporting

**Typical Users:** Interns, temporary staff, support personnel

**Key Responsibilities:**
- Varies based on specific needs
- Support role activities

### 3.2 Multi-Role Support

Users can have multiple roles simultaneously:

**Example:** A nurse who also handles billing could have both **Nurse** and **Billing Manager** roles.

**Switching Between Roles:**
1. Click on your profile icon
2. Select **Switch Role**
3. Choose the role you want to activate
4. The interface will update to show permissions for that role

💡 **Tip:** Your active role determines what you can see and do in the system.

### 3.3 Custom Roles

Administrators can create custom roles:

1. Navigate to **Admin Panel** > **Role Management**
2. Click **Create New Role**
3. Enter role name and description
4. Select permissions from the available options
5. Click **Save Role**

**Permission Categories:**
- **Patients** - View, Create, Edit, Delete
- **Appointments** - View, Create, Edit, Delete, Manage
- **Billing** - View, Create, Edit, Delete, Process, Export
- **CRM** - View, Create, Edit, Delete, Manage
- **EHR** - View, Create, Edit, Delete
- **Reports** - View, Export
- **Admin** - Manage Users, Manage Roles, Manage Settings
- **Telehealth** - View, Create, Manage

---

## 4. Dashboard Overview

### 4.1 Dashboard Components

The dashboard is your central hub for daily activities:

**Stat Cards (Top Row):**
- **Today's Appointments** - Number of appointments scheduled for today
- **Pending Tasks** - Action items requiring attention
- **Total Patients** - Active patients in the system
- **Monthly Revenue** - Revenue for current month

Each stat card shows:
- Current value
- Trend indicator (up/down arrow)
- Percentage change from previous period

**Quick Actions Panel:**
Provides one-click access to common tasks based on your role:

**For Doctors:**
- New Appointment
- Add Patient
- View Schedule
- Create Prescription

**For Receptionists:**
- Schedule Appointment
- Register Patient
- Check-In Patient
- View Waitlist

**For Billing Managers:**
- Create Claim
- Process Payment
- View Pending Claims
- Revenue Report

**Main Content Area:**
- **Upcoming Appointments** - Shows today's schedule
- **Recent Tasks** - Latest task updates
- **Recent Activity** - System activity log
- **Quick Stats** - Visual charts and graphs

### 4.2 Customizing Your Dashboard

**Customize Quick Actions:**
1. Click the **Settings** icon on the dashboard
2. Select **Customize Quick Actions**
3. Drag and drop actions to reorder
4. Select/deselect actions to show/hide
5. Click **Save Changes**

**Dashboard Theme:**
- Toggle between **Light Mode** and **Dark Mode** using the theme icon
- Settings are saved per user

**Language Selection:**
1. Click the **Language** dropdown in the top menu
2. Select from 8 available languages:
   - English (EN)
   - Spanish (ES)
   - French (FR)
   - German (DE)
   - Portuguese (PT)
   - Chinese (ZH)
   - Arabic (AR)
   - Hindi (HI)
3. Interface updates immediately

### 4.3 Understanding Dashboard Metrics

**Today's Appointments:**
- Counts all scheduled appointments for the current day
- Click to view detailed schedule
- Color-coded by status (scheduled, completed, cancelled)

**Pending Tasks:**
- Shows tasks assigned to you with status "Pending" or "In Progress"
- Click to view task details
- Sorted by priority and due date

**Total Patients:**
- Active patients in the system
- Excludes inactive patients
- Click to view patient list

**Monthly Revenue:**
- Total revenue for current month
- Includes all completed payments
- Trend shows comparison to previous month

---

## 5. Patient Management

### 5.1 Patient Registration

**To Register a New Patient:**

1. Navigate to **Patients** > **Add New Patient**
2. Fill in the patient registration form:

**Personal Information:**
- First Name (required)
- Middle Name (optional)
- Last Name (required)
- Date of Birth (required)
- Gender (required): Male, Female, Other
- Medical Record Number (MRN) - Auto-generated or manual entry
- Email Address (required for patient portal)
- Phone Number (required)

**Address Information:**
- Street Address
- City
- State/Province
- ZIP/Postal Code
- Country

**Medical Profile:**
- Height
- Weight
- Blood Type
- **Allergies** - 🆕 ENHANCED IN V1.2
  - Comprehensive allergies field
  - Document medication allergies, food allergies, environmental allergies
  - Include reaction type and severity
  - Critical for medication safety and clinical decision support
- **Past Medical History (PMH)** - 🆕 ENHANCED IN V1.2
  - Document previous medical conditions
  - Surgical history
  - Hospitalizations
  - Chronic conditions
  - Important for comprehensive patient background
- Current Medications
- **Family History** - 🆕 ENHANCED IN V1.2
  - Document hereditary conditions
  - Family medical conditions (cancer, diabetes, heart disease, etc.)
  - Genetic risk factors
  - Helps identify at-risk patients for preventive care

**Insurance Information:**
- Insurance Carrier
- Policy Number
- Group Number
- Insurance Phone Number

**Patient Portal Access:**
- ✅ Enable Patient Portal (checked by default)
- Patient will receive email with portal login instructions

3. Click **Save Patient** to create the record

✅ **Note:** Fields marked with asterisk (*) are required.

### 5.2 Searching for Patients

**Quick Search:**
1. Go to **Patients** module
2. Use the search box at the top
3. Enter patient name, MRN, email, or phone number
4. Results appear as you type

**Advanced Filtering:**
- **Status Filter** - Active, Inactive, All
- **Date Range** - Registration date range
- **Sort Options** - Name, MRN, Date of Birth, Registration Date

### 5.3 Viewing Patient Details

1. Click on a patient name from the patient list
2. Patient detail view shows:

**Patient Overview Tab:**
- Demographics and contact information
- Insurance details
- Patient portal status
- Registration date
- Last visit date

**Medical History Tab:**
- Medical records
- Prescriptions (active and historical)
- Diagnoses
- Allergies
- Vital signs history
- Past medical history

**Appointments Tab:**
- Upcoming appointments
- Past appointments
- Cancelled/no-show appointments
- Quick reschedule option

**Billing Tab:**
- Claims associated with patient
- Payment history
- Outstanding balances
- Insurance information

**Documents Tab:**
- Uploaded medical documents
- Lab results
- Imaging reports
- Consent forms

### 5.4 Updating Patient Information

1. Open the patient record
2. Click **Edit Patient**
3. Update the necessary fields
4. Click **Save Changes**

⚠️ **Warning:** Changes to patient demographics (name, DOB) should be verified carefully as they affect medical records.

### 5.5 Patient Status Management

**Changing Patient Status:**
1. Open patient record
2. Click **Status** dropdown
3. Select **Active** or **Inactive**
4. Confirm the change

**Active Status:** Patient can book appointments and access patient portal
**Inactive Status:** Patient cannot book new appointments but historical data is preserved

### 5.6 Patient Portal Management

**Enabling Portal Access:**
1. Open patient record
2. Check **Enable Patient Portal**
3. Click **Send Portal Invitation**
4. Patient receives email with login instructions

**Disabling Portal Access:**
1. Open patient record
2. Uncheck **Enable Patient Portal**
3. Patient can no longer access portal

**Resetting Portal Password:**
1. Open patient record
2. Click **Reset Portal Password**
3. Patient receives password reset email

### 5.7 Merging Duplicate Patients

If duplicate patient records are created:

1. Navigate to **Patients** > **Merge Patients**
2. Search for the duplicate records
3. Select the records to merge
4. Choose the primary record (data to keep)
5. Review merge preview
6. Click **Merge Patients**
7. Confirm the action

⚠️ **Warning:** Merging cannot be undone. Verify carefully before proceeding.

---

## 6. Appointment Scheduling

### 6.1 Creating a New Appointment

**Quick Appointment Creation:**

1. Navigate to **Practice Management** > **Appointments**
2. Click **New Appointment** or use Quick Action on dashboard
3. Fill in appointment details:

**Appointment Information:**
- **Patient** - Search and select patient (required)
- **Provider** - Select provider/doctor (required)
- **Appointment Type** - Select type from dropdown (required)
- **Date** - Select appointment date (required)
- **Start Time** - Select start time (required)
- **Duration** - Select duration in minutes (required)
- **Reason** - Brief reason for visit (optional)
- **Notes** - Additional notes (optional)

4. Click **Check Availability** to verify no conflicts
5. Click **Schedule Appointment**

✅ **Note:** The system prevents double-booking automatically.

### 6.2 Appointment Types

Common appointment types include:
- **New Patient Visit** - First-time patient consultation
- **Follow-Up Visit** - Return visit for ongoing care
- **Annual Physical** - Routine yearly examination
- **Sick Visit** - Acute illness or injury
- **Telehealth Consultation** - Virtual video visit
- **Lab Work** - Laboratory tests only
- **Procedure** - Minor procedures
- **Custom Types** - Defined by administrators

Each appointment type has:
- Default duration
- Color coding on calendar
- Associated billing codes

### 6.3 Calendar Views

**Switching Calendar Views:**

**Day View:**
- Shows one day's schedule
- Hourly time slots
- All providers or individual provider
- Best for detailed daily planning

**Week View:**
- Shows 7-day schedule
- Multiple providers side-by-side
- Best for weekly planning

**Month View:**
- Shows entire month
- Appointment counts per day
- Best for long-term planning

**List View:**
- Tabular list of appointments
- Sortable and filterable
- Best for searching specific appointments

**Switching Views:**
1. Go to **Practice Management** > **Appointments**
2. Click the view toggle buttons: **Day** | **Week** | **Month** | **List**

### 6.4 Managing Appointments

**Rescheduling an Appointment:**
1. Click on the appointment in calendar or list
2. Click **Reschedule**
3. Select new date and time
4. Verify availability
5. Click **Update Appointment**
6. Patient receives automatic notification

**Cancelling an Appointment:**
1. Click on the appointment
2. Click **Cancel Appointment**
3. Select cancellation reason:
   - Patient cancelled
   - Provider cancelled
   - Weather/emergency
   - Other
4. Add cancellation notes (optional)
5. Click **Confirm Cancellation**
6. Patient receives cancellation notification

**Marking as No-Show:**
1. Click on the appointment
2. Click **Mark as No-Show**
3. Add notes if needed
4. Click **Confirm**

**Checking In a Patient:**
1. Find today's appointment
2. Click **Check-In** button
3. Confirm patient arrival time
4. Update any demographic changes
5. Patient status changes to "Checked In"

### 6.5 Appointment Reminders

**Automatic Reminders:**
AureonCare sends automatic appointment reminders via:
- **Email** - 48 hours before appointment
- **SMS** - 24 hours before appointment (if configured)
- **WhatsApp** - 24 hours before appointment (if integrated)

**Manual Reminder:**
1. Select appointment
2. Click **Send Reminder**
3. Choose method (Email, SMS, WhatsApp)
4. Click **Send**

**Configuring Reminder Preferences:**
1. Go to **Settings** > **Appointment Settings**
2. Set reminder timings
3. Enable/disable reminder methods
4. Save changes

### 6.6 Recurring Appointments

**Creating Recurring Appointments:**
1. Create a new appointment
2. Check **Repeat Appointment**
3. Select recurrence pattern:
   - Daily
   - Weekly (select days of week)
   - Monthly (select day of month)
   - Custom interval
4. Set end date or number of occurrences
5. Click **Schedule All**

**Managing Recurring Series:**
- **Edit Single Occurrence** - Changes only one appointment
- **Edit Series** - Changes all future appointments
- **Delete Single Occurrence** - Removes one appointment
- **Delete Series** - Removes all future appointments

### 6.7 Waitlist Management

**Accessing the Waitlist:**

The waitlist is fully integrated into Practice Management:
1. Go to **Practice Management** module
2. Click the **Waitlist** tab (next to List and Calendar views)
3. View all waitlisted patients in one unified interface

✅ **Note:** Waitlist is now part of Practice Management for unified appointment and waitlist workflow.

**Adding Patient to Waitlist:**

When no appointments are available:
1. Click **Add to Waitlist**
2. Select patient (required)
3. Select provider (optional)
4. Select preferred date range
5. Select preferred time of day
6. Set priority level:
   - **High** - Urgent need
   - **Medium** - Standard priority
   - **Low** - Flexible timing
7. Add appointment type
8. Add reason/notes
9. Click **Add to Waitlist**

**Waitlist View Features:**

**Status Indicators:**
- 🔵 **Active** - Waiting for slot
- 🟡 **Notified** - Patient has been contacted
- 🟢 **Scheduled** - Appointment confirmed
- ⚪ **Cancelled** - Request cancelled
- 🔴 **Expired** - Request expired

**Filter Options:**
- All entries
- Active only
- Notified
- Scheduled
- Cancelled
- Expired

**Priority Badges:**
- High (Red)
- Medium (Yellow)
- Low (Blue)

**Managing Waitlist Entries:**

**View Entry Details:**
- Patient name and contact info
- Preferred date/time range
- Provider preference
- Appointment type
- Reason/notes
- Priority level
- Date added
- Current status

**Notify Next Patient:**
1. When slot becomes available, click **Notify Next Patient**
2. System automatically selects highest-priority active patient
3. Patient receives notification via email/SMS/WhatsApp
4. Entry status changes to "Notified"
5. Wait for patient response

**Confirm Appointment:**
1. When patient confirms, find their waitlist entry
2. Click **Confirm Appointment** button
3. Confirmation modal appears
4. Select appointment date and time
5. Click **Confirm**
6. Entry status changes to "Scheduled"
7. Patient automatically removed from active waitlist
8. Appointment appears in calendar

**Auto-Notification Flow:**
When a slot becomes available:
1. System identifies highest-priority active patient
2. Patient receives notification via email/SMS/WhatsApp
3. Patient can confirm or decline
4. If confirmed, appointment scheduled
5. If declined, next patient is automatically notified

**Manual Waitlist Conversion:**
1. Find patient on waitlist
2. Click **Confirm Appointment**
3. Select available date and time slot
4. Click **Confirm**
5. Patient is removed from active waitlist
6. Appointment created in schedule

💡 **Tip:** Use the integrated Practice Management view to seamlessly switch between scheduling appointments (List/Calendar tabs) and managing the waitlist (Waitlist tab).

### 6.8 Provider Availability

**Viewing Provider Schedules:**
1. Go to **Provider Management** > **Availability**
2. Select provider
3. View weekly schedule
4. See blocked times and time-off

**Blocking Time Slots:**
1. Select provider calendar
2. Click on time slot to block
3. Select reason:
   - Lunch break
   - Meeting
   - Administrative time
   - Other
4. Click **Block Time**

**Time-Off Requests:**
1. Go to **Provider Management** > **Time Off**
2. Click **Request Time Off**
3. Select provider
4. Select date range
5. Select type (Vacation, Sick, Conference, Other)
6. Add notes
7. Click **Submit Request**
8. Admin approves/denies request

---

## 7. Provider Management

### 7.1 Adding a New Provider

1. Navigate to **Provider Management** > **Providers**
2. Click **Add New Provider**
3. Fill in provider information:

**Basic Information:**
- First Name (required)
- Last Name (required)
- Email Address (required)
- Phone Number (required)
- Specialization (required)
- License Number
- NPI Number (National Provider Identifier)

**Contact Details:**
- Office Phone
- Mobile Phone
- Fax Number
- Email

**Professional Information:**
- Medical School
- Residency
- Board Certifications
- Languages Spoken
- Years of Experience

4. Link to user account (if provider logs into system)
5. Click **Save Provider**

### 7.2 Provider Profiles

**Viewing Provider Profile:**
1. Go to **Provider Management** > **Providers**
2. Click on provider name
3. View profile with:
   - Professional credentials
   - Specializations
   - Contact information
   - Associated appointments
   - Patient reviews (if enabled)

**Editing Provider Profile:**
1. Open provider profile
2. Click **Edit Provider**
3. Update information
4. Click **Save Changes**

### 7.3 Provider Scheduling

**Setting Up Provider Schedule:**

1. Go to **Provider Management** > **Availability**
2. Select provider
3. Click **Set Availability**
4. For each day of the week:
   - Check **Available** if provider works that day
   - Set **Start Time** and **End Time**
   - Add break times
   - Set appointment slot duration
5. Click **Save Schedule**

**Example Weekly Schedule:**
```
Monday:    9:00 AM - 5:00 PM (Lunch: 12:00 PM - 1:00 PM)
Tuesday:   9:00 AM - 5:00 PM (Lunch: 12:00 PM - 1:00 PM)
Wednesday: 9:00 AM - 5:00 PM (Lunch: 12:00 PM - 1:00 PM)
Thursday:  9:00 AM - 5:00 PM (Lunch: 12:00 PM - 1:00 PM)
Friday:    9:00 AM - 3:00 PM (No lunch break)
Saturday:  Not Available
Sunday:    Not Available
```

### 7.4 Appointment Type Configuration

**Setting Provider-Specific Appointment Types:**

1. Open provider profile
2. Go to **Appointment Configuration** tab
3. Select which appointment types this provider accepts:
   - ✅ New Patient Visit (60 min)
   - ✅ Follow-Up Visit (30 min)
   - ✅ Telehealth Consultation (30 min)
   - ❌ Lab Work Only
4. Set custom durations if different from defaults
5. Click **Save Configuration**

### 7.5 Provider Time-Off Management

**Viewing Time-Off Calendar:**
1. Go to **Provider Management** > **Time Off**
2. View all providers' time-off on calendar
3. Filter by provider, date range, or type

**Approving Time-Off Requests:**
1. Go to **Time Off Requests** tab
2. Review pending requests
3. Check for scheduling conflicts
4. Click **Approve** or **Deny**
5. Add notes if denying
6. Click **Confirm**

---

## 8. Electronic Health Records (EHR)

### 8.1 Accessing Patient Medical Records

1. Go to **Patients** module
2. Search for and select patient
3. Click on **Medical Records** tab

Or:

1. From an appointment, click **View EHR**
2. Opens patient's complete medical history

### 8.2 Creating a Medical Record

**To Document a Patient Encounter:**

1. Open patient record
2. Go to **Medical Records** tab
3. Click **New Medical Record**
4. Fill in record details:

**Record Header:**
- **Record Type** - Select from:
  - Progress Note
  - Consultation Note
  - Procedure Note
  - Discharge Summary
  - Lab Result
  - Imaging Report
  - Other
- **Record Date** - Date of encounter (required)
- **Title** - Brief description (required)
- **Provider** - Attending provider (required)

**Clinical Documentation:**
- **Chief Complaint** - Reason for visit
- **History of Present Illness** - Detailed history
- **Review of Systems** - Systematic review
- **Physical Examination** - Examination findings
- **Assessment** - Clinical assessment
- **Plan** - Treatment plan
- **Follow-up** - Follow-up instructions

**Medications:**
- Add current medications (structured data)
- Include dosage, frequency, route
- Link to prescriptions

**Attachments:**
- Upload related documents
- Attach lab results
- Attach imaging files
- Supported formats: PDF, JPG, PNG, DOCX

5. Click **Save Record**

### 8.3 Medical Record Templates

**Using Templates:**
1. When creating a medical record, click **Use Template**
2. Select from available templates:
   - Annual Physical Template
   - Sick Visit Template
   - Follow-up Template
   - Specialist Consultation Template
3. Template pre-fills standard sections
4. Customize as needed
5. Save record

💡 **Tip:** Ask your administrator to create custom templates for your practice.

### 8.4 Viewing Medical History

**Patient Medical History Browser:**

1. Open patient EHR
2. View chronological timeline of:
   - All medical records
   - Prescriptions
   - Diagnoses
   - Lab results
   - Procedures
   - Hospitalizations

**Filtering Medical History:**
- By date range
- By record type
- By provider
- By diagnosis

**Exporting Medical History:**
1. Click **Export Records**
2. Select date range
3. Select record types to include
4. Choose format (PDF, FHIR, HL7)
5. Click **Generate Export**

### 8.5 Vital Signs Documentation

**Recording Vital Signs:**

1. Open patient record
2. Go to **Vital Signs** tab
3. Click **Add Vital Signs**
4. Enter measurements:
   - **Blood Pressure** - Systolic/Diastolic (mmHg)
   - **Heart Rate** - Beats per minute
   - **Respiratory Rate** - Breaths per minute
   - **Temperature** - °F or °C
   - **Oxygen Saturation** - SpO2 percentage
   - **Height** - Feet/inches or cm
   - **Weight** - Pounds or kg
   - **BMI** - Automatically calculated
5. Add notes if needed
6. Click **Save Vital Signs**

**Vital Signs Trends:**
- View graphs of vital signs over time
- Identify trends and abnormal values
- Export for analysis

### 8.6 Allergies Management

**Recording Patient Allergies:**

1. Open patient record
2. Go to **Allergies** tab
3. Click **Add Allergy**
4. Enter allergy information:
   - **Allergen** - Name of substance (required)
   - **Type** - Drug, Food, Environmental, Other
   - **Reaction** - Description of reaction (required)
   - **Severity** - Mild, Moderate, Severe, Life-threatening
   - **Onset Date** - When allergy was identified
   - **Status** - Active or Resolved
   - **Notes** - Additional information
5. Click **Save Allergy**

⚠️ **Warning:** Allergy information appears prominently throughout the system and during prescription creation to prevent adverse reactions.

**No Known Allergies:**
- Check **No Known Allergies (NKA)** box if patient has no allergies
- This prevents repeated allergy questions

---

## 9. Prescriptions Management

### 9.1 Creating a Prescription

**To Prescribe Medication:**

1. Open patient record or from current appointment
2. Click **New Prescription**
3. Fill in prescription details:

**Medication Information:**
- **Medication Name** - Start typing, select from database (required)
- **Dosage** - Strength and units (e.g., "500mg") (required)
- **Form** - Tablet, Capsule, Liquid, Injection, etc.
- **Frequency** - How often (e.g., "Twice daily", "Every 6 hours") (required)
- **Route** - Oral, Topical, IV, IM, etc.
- **Duration** - How long to take (e.g., "7 days", "30 days") (required)
- **Quantity** - Total amount to dispense
- **Refills** - Number of refills allowed (0-12)

**Instructions:**
- **Special Instructions** - Patient instructions (e.g., "Take with food")
- **Clinical Notes** - Notes for pharmacy or internal use

**Pharmacy:**
- **Select Pharmacy** - Patient's preferred pharmacy or select from list

4. Click **Check Drug Interactions** (recommended)
5. Review any warnings or alerts
6. Click **Save Prescription**

**Using ePrescribe Modal (Enhanced Workflow):**

The ePrescribe modal provides a guided, step-by-step prescription workflow:

**Step 1: Medication Selection**
1. Click **ePrescribe** button from patient history
2. Search for medication by name
3. Select medication from search results
4. System displays medication details automatically

**Step 2: Prescription Details**
1. Enter dosage strength (e.g., "500mg")
2. Select dosage form (tablet, capsule, liquid, etc.)
3. Enter quantity to dispense
4. Select route of administration
5. Enter frequency (e.g., "twice daily")
6. Add special instructions for patient

**Step 3: Pharmacy Selection**
1. Select patient's preferred pharmacy (auto-populated)
2. Or search for different pharmacy
3. Verify pharmacy accepts e-prescriptions

**Step 4: Review & Submit**
1. Review all prescription details
2. Check for drug interactions
3. Click **Submit Prescription**
4. Prescription sent electronically to pharmacy

**Editing Existing Prescriptions:**

The ePrescribe modal now supports edit mode:

1. Go to **Patient History** > **Prescriptions** tab
2. Find the prescription you want to edit
3. Click **Edit** button (pencil icon)
4. ePrescribe modal opens in edit mode

**Edit Mode Features:**
- **Medication name prefilled** in search box - You can immediately see which medication you're editing
- **All prescription details loaded** - Dosage, frequency, quantity, etc. pre-populated
- **Current medication visible** - Appears in search results as already selected
- **Step navigation enabled** - Can navigate back to any step to make changes
- **Smart context retention** - If you navigate back to Step 1, medication name remains visible

**Benefits of Edit Mode:**
- No need to search for medication again
- Prevents errors from selecting wrong medication
- Faster editing workflow
- Clear context of what you're modifying
- Follows best practices for form editing

💡 **Tip:** When editing prescriptions, the medication name follows this priority: Generic Name > Brand Name > Drug Name for display.

### 9.2 E-Prescribing

**Sending Electronic Prescriptions:**

1. After creating prescription, click **Send to Pharmacy**
2. Verify pharmacy information
3. Click **Send e-Prescription**
4. System transmits prescription electronically via HL7
5. Patient and pharmacy receive notification

✅ **Note:** E-prescribing reduces errors and speeds up pharmacy fulfillment.

### 9.3 Drug Interaction Checking

**Automatic Safety Checks:**

When creating a prescription, the system automatically checks for:
- **Drug-Drug Interactions** - With other active medications
- **Drug-Allergy Interactions** - Against documented allergies
- **Duplicate Therapy** - Similar medications already prescribed
- **Contraindications** - Based on patient conditions

**Warning Levels:**
- 🔴 **Severe** - Contraindicated, do not prescribe
- 🟡 **Moderate** - Use caution, monitor closely
- 🟢 **Minor** - Informational only

**Overriding Warnings:**
1. Review warning details
2. Click **Override Warning**
3. Document reason for override
4. Add monitoring plan
5. Click **Confirm Override**

⚠️ **Warning:** Only override warnings when clinically appropriate and document justification.

### 9.4 Managing Active Prescriptions

**Viewing Active Prescriptions:**

1. Open patient record
2. Go to **Prescriptions** tab
3. View list of all prescriptions:
   - ✅ **Active** - Currently prescribed
   - ⏸️ **Inactive** - Completed or expired
   - 🚫 **Discontinued** - Stopped by provider

**Renewing a Prescription:**
1. Find prescription in patient's active list
2. Click **Renew**
3. Update quantity/refills if needed
4. Click **Send Renewal**

**Discontinuing a Prescription:**
1. Find active prescription
2. Click **Discontinue**
3. Select reason:
   - Completed therapy
   - Changed medication
   - Side effects
   - Patient request
   - Other
4. Add discontinuation notes
5. Click **Confirm**

### 9.5 Prescription History

**Viewing Prescription History:**

1. Open patient record
2. Go to **Prescription History**
3. View complete medication history including:
   - All past prescriptions
   - Dates prescribed
   - Prescribing provider
   - Pharmacy filled
   - Refill history

**Medication Adherence Tracking:**
- View when prescriptions were filled
- Identify missed refills
- Flag non-adherence issues

### 9.6 Prescription Refill Requests

**Processing Patient Refill Requests:**

1. Go to **Prescriptions** > **Refill Requests**
2. View pending refill requests from patient portal
3. For each request:
   - Review patient's current medications
   - Check when last filled
   - Verify refills remaining
4. Click **Approve** or **Deny**
5. If denied, add reason and contact patient

**Auto-Refill Notifications:**
- Patients receive reminders when prescriptions are due for refill
- Patients can request refills through patient portal

---

## 10. Diagnosis Management

### 10.1 Creating a Diagnosis

**To Document a Patient Diagnosis:**

1. Open patient record or from current appointment
2. Click **New Diagnosis**
3. Fill in diagnosis information:

**Diagnosis Details:**
- **ICD Code** - Search for ICD-10 code (required)
  - Start typing condition name
  - Select from suggestions
  - Or enter ICD code directly
- **Diagnosis Name** - Auto-filled from ICD code or enter custom
- **Severity** - Select severity level:
  - Mild
  - Moderate
  - Severe
  - Critical
- **Status** - Current status (required):
  - Active - Ongoing condition
  - Resolved - Condition resolved
  - Chronic - Long-term condition
- **Diagnosed Date** - Date of diagnosis (required)
- **SOAP Notes** - 🆕 NEW IN V1.2: Structured clinical documentation
  - **S (Subjective)** - Patient's description of symptoms, complaints
  - **O (Objective)** - Observable findings, vital signs, test results
  - **A (Assessment)** - Your clinical assessment and diagnosis
  - **P (Plan)** - Treatment plan, medications, follow-up

**Association:**
- **Link to Appointment** - Associate with current appointment
- **Primary Diagnosis** - Check if this is the primary condition
- **Link to Prescription** - Optionally link related prescriptions to this diagnosis

4. Click **Save Diagnosis**

💡 **Tip:** SOAP Notes provide structured clinical documentation that improves care quality, supports medical necessity, and enhances compliance with clinical documentation requirements.

**Example SOAP Note:**
```
S: Patient reports persistent cough for 2 weeks, worse at night.
   Denies fever, chest pain. Non-smoker.

O: Temp 98.6°F, BP 120/80, RR 16, O2 sat 98%
   Lung auscultation: mild wheezing bilateral
   No respiratory distress

A: Acute bronchitis (ICD-10: J20.9)
   Likely viral etiology

P: 1. Albuterol inhaler 2 puffs q4-6h PRN
   2. Increase fluid intake
   3. OTC cough suppressant at bedtime
   4. Follow-up in 1 week if not improving
   5. Return sooner if develops fever, SOB, or chest pain
```

**Linking Prescriptions to Diagnoses:**

AureonCare now supports linking prescriptions directly to diagnoses for better clinical documentation:

**Benefits:**
- Clear association between diagnosis and treatment
- Improved clinical documentation
- Better tracking of treatment efficacy
- Enhanced reporting and analytics
- Supports quality measures and compliance

**How to Link:**
1. When creating or editing a diagnosis
2. Patient field is read-only (automatically set from context)
3. After entering diagnosis information
4. System maintains diagnosis-prescription relationships
5. View linked prescriptions in diagnosis details

**View Linked Prescriptions:**
1. Open patient record
2. Go to **Diagnoses** tab
3. Click on a diagnosis
4. View **Associated Prescriptions** section
5. See all medications prescribed for this diagnosis

### 10.2 ICD Code Search

**Finding the Right ICD Code:**

1. In the ICD Code search field, start typing:
   - Condition name (e.g., "diabetes")
   - Body system (e.g., "respiratory")
   - Symptoms (e.g., "cough")
2. System displays matching ICD-10 codes with descriptions
3. Select the most appropriate code
4. Code details appear including:
   - Full ICD-10 code
   - Complete description
   - Category
   - Subcategories if applicable

💡 **Tip:** Be as specific as possible with ICD codes for accurate billing and documentation.

### 10.3 Managing Patient Diagnoses

**Viewing Patient Diagnoses:**

1. Open patient record
2. Go to **Diagnoses** tab
3. View all diagnoses organized by:
   - Active diagnoses
   - Resolved diagnoses
   - Chronic conditions
   - Historical diagnoses

**Updating Diagnosis Status:**

1. Find diagnosis in patient record
2. Click **Edit Diagnosis**
3. Change status:
   - Active → Resolved (when condition improves)
   - Active → Chronic (for long-term conditions)
4. Update severity if changed
5. Add clinical notes documenting the change
6. Click **Save Changes**

**Linking Diagnoses to Claims:**
- Diagnoses automatically link to billing claims
- Multiple diagnoses can be associated with one claim
- Primary diagnosis appears first on claim forms

### 10.4 Problem List

**Patient Problem List:**

The problem list provides a summary of active conditions:

1. Go to patient's **Problem List** tab
2. View active conditions organized by:
   - Chronic conditions (long-term)
   - Active acute conditions
   - Past medical history
3. Click on any problem for detailed information

**Adding to Problem List:**
- Chronic and active diagnoses automatically appear
- Manually add other health concerns
- Track onset date and status

---

## 11. Telehealth Video Consultations

Found under **Clinical → Telehealth**.

### 11.0 Supported Video Providers

**🆕 UPDATED IN V1.3:** AureonCare connects to four video platforms.

| Provider | Connection | Notes |
|----------|-----------|-------|
| **Zoom** | OAuth | Embedded SDK experience; Marketplace-compliant consent and recording indicators |
| **Google Meet** | OAuth | Meeting links generated on the practice Google account |
| **Microsoft Teams** | OAuth | Meeting links generated via Microsoft Graph |
| **Webex** | OAuth | Meeting links generated on the practice Webex account |

**Connecting a Provider:**

1. Go to **Settings → Telehealth Setup**
2. Choose the provider
3. Click **Connect** and complete the OAuth consent screen
4. The connection is confirmed and tokens refresh automatically
5. Toggle **Enabled** to make the provider available for scheduling

✅ **Note:** More than one provider can be enabled at once. Access tokens refresh in the background; if a connection lapses, Settings → Telehealth Setup shows a reconnect prompt.

**Patient Telehealth Preference:**

Each patient record carries a preferred video platform. When a telehealth appointment is booked, the system uses that preference if the provider is enabled, and falls back to the practice default otherwise. Set it on the patient record under **Preferences**.

### 11.1 Scheduling Telehealth Appointments

**Creating a Telehealth Appointment:**

1. Navigate to **Scheduling → Calendar** and start a new appointment
2. Select **Telehealth Consultation** as appointment type
3. Fill in appointment details (patient, provider, date, time)
4. Confirm or change the video platform — it defaults to the patient's preference
5. Click **Schedule Appointment**
6. System automatically creates the virtual meeting room
7. Patient receives the meeting link by email, and by WhatsApp if they have opted in

### 11.2 Starting a Telehealth Session

**For Providers:**

1. Go to **Telehealth** > **My Sessions**
2. Find upcoming session
3. Click **Start Session** when ready (up to 10 minutes before scheduled time)
4. System opens video room
5. Wait for patient to join

Or from appointment:
1. Open today's appointments
2. Find telehealth appointment
3. Click **Start Video Session**

**Pre-Session Checklist:**
- ✅ Test camera and microphone
- ✅ Ensure good lighting
- ✅ Find quiet, private location
- ✅ Review patient chart before session
- ✅ Have EHR access ready

### 11.3 Patient Joining Telehealth Session

**For Patients (via Patient Portal):**

1. Log into patient portal
2. Go to **My Appointments**
3. Find scheduled telehealth appointment
4. Click **Join Video Session** (button appears 10 minutes before appointment)
5. Allow camera and microphone permissions
6. Wait in virtual waiting room
7. Provider admits you to session

**Meeting Link:**
- Patients also receive unique meeting URL via email
- Can join directly from email link
- No software installation required (browser-based)

### 11.4 During the Video Consultation

**Video Controls:**

**For Providers:**
- 📹 **Video** - Toggle camera on/off
- 🎤 **Microphone** - Mute/unmute audio
- 💬 **Chat** - Text messaging with patient
- 📺 **Screen Share** - Share screen with patient (for showing results, images, etc.)
- 🔴 **Record** - Start/stop session recording (with patient consent)
- 🔚 **End Session** - Terminate video call

**For Patients:**
- 📹 **Video** - Toggle camera on/off
- 🎤 **Microphone** - Mute/unmute audio
- 💬 **Chat** - Send messages to provider
- ❓ **Help** - Get technical support

**Best Practices During Consultation:**
- Look at camera when speaking
- Minimize background noise
- Use headphones for better audio quality
- Have good front lighting
- Keep camera at eye level

### 11.5 Recording Sessions

**Recording Telehealth Sessions:**

1. During session, click **Record** button
2. All participants notified that recording started
3. Click **Stop Recording** when done
4. Recording automatically saved to patient record

⚠️ **Warning:** Always obtain patient consent before recording. Recording notification appears automatically but verbal consent should be documented.

**Accessing Recordings:**
1. Go to patient record > **Telehealth** tab
2. View list of recorded sessions
3. Click **Play** to watch recording
4. Click **Download** to save locally

### 11.6 Post-Session Documentation

**After Telehealth Session:**

1. Click **End Session** when consultation complete
2. System prompts for session summary
3. Document encounter:
   - Session duration (auto-calculated)
   - Chief complaint
   - Clinical findings
   - Assessment and plan
   - Follow-up instructions
4. Create prescriptions if needed
5. Create/update diagnoses
6. Schedule follow-up appointment if needed
7. Click **Complete Session**

Session automatically linked to:
- Patient's medical record
- Appointment record
- Billing/claims (if applicable)

### 11.7 Troubleshooting Telehealth Issues

**Common Issues and Solutions:**

**No Video Appearing:**
- Check camera permissions in browser
- Ensure camera not in use by another application
- Try different browser (Chrome recommended)
- Check camera hardware connection

**No Audio:**
- Check microphone permissions
- Verify microphone selected in settings
- Check system audio settings
- Test with headphones

**Poor Video Quality:**
- Check internet connection speed (minimum 5 Mbps recommended)
- Close other applications using bandwidth
- Turn off video temporarily (audio-only consultation)
- Ask patient to turn off their video

**Cannot Join Session:**
- Verify appointment scheduled as "Telehealth Consultation"
- Check that you're within time window (10 min before to appointment end)
- Clear browser cache and cookies
- Try incognito/private browsing mode

**Technical Support:**
- Click **Help** button during session
- Call clinic tech support
- Use chat feature to communicate issues to provider

---

## 12. Laboratory Orders & Results

### 12.1 Creating Lab Orders

**To Order Laboratory Tests:**

1. Open patient record or from appointment
2. Click **New Lab Order**
3. Fill in order details:

**Order Information:**
- **Ordering Provider** - Auto-filled or select (required)
- **Order Date** - Date ordered (required)
- **Priority** - Routine, Urgent, STAT
- **Diagnosis/Indication** - Reason for test (links to patient diagnosis)

**Lab Facility:**
- **Select Laboratory** - Choose from lab directory
- Or use patient's preferred lab

**Test Selection (Enhanced CPT Code Multiselect):**

AureonCare now features an advanced multiselect dropdown for laboratory tests with CPT codes:

1. Click on **Select Lab Tests** dropdown
2. Search for tests by name or CPT code (80000-89999 range)
3. Select multiple tests at once
4. Common tests available include:
   - **Complete Blood Count (CBC)** - 85025, 85027
   - **Basic Metabolic Panel (BMP)** - 80047, 80048
   - **Comprehensive Metabolic Panel (CMP)** - 80053
   - **Lipid Panel** - 80061
   - **Hemoglobin A1C** - 83036, 83037
   - **Thyroid Function Tests** - 84439, 84443, 84480
   - **Urinalysis** - 81000, 81001, 81002
   - **Liver Function Tests** - 80076
   - **Coagulation Panel** - 85610, 85730
   - **Iron Studies** - 83540, 83550
   - **Vitamin D** - 82306
   - **PSA** - 84153
   - **And 80+ more common tests...**

**Search Features:**
- Type test name (e.g., "glucose", "cholesterol")
- Type CPT code (e.g., "80053", "85025")
- Multiselect - select multiple tests in one order
- Auto-complete suggestions
- CPT code and test name displayed together

**Order Status & Scheduling:**

Select order status to control when tests are performed:

- **One-Time** - Single lab order, perform immediately
- **Recurring** - Repeated tests on schedule
- **Future** - Scheduled for specific future date

**For Recurring Orders:**
1. Select **Recurring** as order status
2. Choose frequency:
   - Daily
   - Weekly
   - Monthly
   - Quarterly
   - Annually
3. Set start date
4. Set end date (optional)

**For Future Orders:**
1. Select **Future** as order status
2. Choose specific date for test performance
3. System schedules order for that date

**Collection Method:**

Specify who collects the specimen:

- **Clinic Collect** - Specimen collected at your clinic, sent to lab
- **Lab Collect** - Patient goes to lab for collection

**Result Recipients:**

Select who receives lab results (multiselect):

- **Ordering Doctor**
- **Primary Care Provider**
- **Specialists**
- **Nursing Staff**
- **Patient** (via patient portal)

**Specimen Information:**
- **Specimen Type** - Blood, Urine, Tissue, etc.
- **Collection Date/Time** - When specimen collected
- **Fasting Status** - Fasting or Non-fasting

**Clinical Notes:**
- Add any special instructions
- Note relevant clinical history
- Specify if comparison needed with previous results

4. Click **Save Lab Order**
5. Click **Send to Lab** to transmit electronically

**Print Lab Orders:**

Generate professional print-ready lab orders:

1. After creating lab order
2. Click **Print** button
3. System generates formatted lab order with:
   - Patient demographics
   - All selected CPT codes and test names
   - Order status and frequency
   - Collection method
   - Result recipients
   - Clinical notes
   - Provider signature line
4. Print or save as PDF

**Viewing Lab Orders in Patient History:**

Lab orders are now integrated into Patient History:

1. Go to **Patient History View**
2. Click **Lab Orders** tab
3. View all lab orders for this patient:
   - Order date
   - Ordered tests (CPT codes)
   - Order status
   - Collection method
   - Results status
4. Click on order to view details
5. Print orders directly from history

💡 **Tip:** Use the CPT code multiselect to order multiple related tests efficiently, such as ordering a complete metabolic panel plus additional specific tests.

### 12.2 Managing Lab Orders

**Viewing Lab Orders:**

1. Go to **Laboratories** > **Lab Orders**
2. View all orders with status:
   - 📋 **Ordered** - Order created, not yet sent
   - 📤 **Sent** - Sent to laboratory
   - 🔬 **In Progress** - Lab processing specimen
   - ✅ **Completed** - Results available
   - ❌ **Cancelled** - Order cancelled

**Filtering Lab Orders:**
- By patient
- By provider
- By date range
- By lab facility
- By status
- By test type

**Tracking Order Status:**
1. Click on lab order
2. View order timeline:
   - Order created
   - Order sent to lab
   - Specimen received by lab
   - Results in progress
   - Results completed
   - Results reviewed by provider

### 12.3 Lab Results Management

**Entering Lab Results:**

**For Lab Staff:**
1. Find lab order
2. Click **Enter Results**
3. For each test, enter:
   - **Result Value** - Numeric value or qualitative result
   - **Units** - mg/dL, mmol/L, etc.
   - **Reference Range** - Normal range for comparison
   - **Flag** - Normal, High, Low, Critical
4. Attach result documents (PDF reports)
5. Click **Save Results**
6. Click **Mark Complete**

**Auto-Notification:**
- Ordering provider automatically notified of results
- Patient notified results are available (via patient portal)

### 12.4 Reviewing Lab Results

**For Providers:**

1. Go to **Laboratories** > **Pending Results**
2. View all results requiring review
3. Click on result to view details
4. Review all test values:
   - Values flagged as abnormal highlighted
   - Compare with previous results
   - View trend graphs

**Result Actions:**
- **Acknowledge** - Mark as reviewed
- **Flag for Follow-up** - Requires action
- **Share with Patient** - Make visible in patient portal
- **Order Additional Tests** - If needed based on results
- **Create Treatment Plan** - Document clinical response

**Critical Results:**
- Critical values highlighted in red
- Immediate notification to provider
- Requires urgent acknowledgment
- Document clinical action taken

### 12.5 Patient Access to Lab Results

**Sharing Results with Patients:**

1. Review lab results
2. Click **Share with Patient**
3. Optionally add provider notes/interpretation
4. Click **Publish to Patient Portal**
5. Patient receives notification

**Patient View (via Patient Portal):**
- Patients can view results released by provider
- Results show:
  - Test name
  - Result value
  - Normal range
  - Provider comments
- Graphs show trends over time

💡 **Tip:** Add patient-friendly notes explaining results before sharing.

### 12.6 Lab Directory Management

**Managing Laboratory Facilities:**

1. Go to **Laboratories** > **Lab Directory**
2. View all contracted labs
3. Click **Add New Lab** to add facility

**Adding New Laboratory:**

1. Click **Add New Laboratory**
2. Fill in laboratory details using the enhanced form with toggle switches:

**Basic Information:**
- **Laboratory Name** (required)
- **Lab Type** - Select type:
  - Reference Laboratory
  - Hospital Laboratory
  - Clinical Laboratory
  - Pathology Laboratory
  - Specialty Laboratory
  - Other
- **CLIA Number** - Clinical Laboratory Improvement Amendments ID

**Address Information:**
- **Street Address** (required)
- **City** (required)
- **State** (required)
- **ZIP Code** (required)
- **Country**

**Contact Information:**
- **Phone Number** (required)
- **Fax Number**
- **Email Address**
- **Website URL**
- **Contact Person** - Main point of contact

**Service Features (Toggle Switches):**

- 🔵 **Accepts Electronic Orders** - Toggle ON if lab accepts e-orders
- 🔵 **Active Status** - Toggle ON to make lab active in system

**Operational Details:**
- **Result Turnaround Time** - Average time for results (e.g., "24-48 hours")
- **Operating Hours** - Hours of operation
- **Supported Test Menu** - Types of tests offered
- **Specialty Services** - Advanced or specialized testing capabilities

**Integration Settings:**
- **Electronic Interface** - HL7/FHIR integration status
- **Result Delivery Method** - Electronic, fax, portal, etc.
- **Priority Handling** - STAT and urgent test capabilities

3. Click **Save Laboratory**

**Lab Facility Information Display:**
- Lab name and location
- Contact information
- Supported test menu
- Result turnaround times
- Electronic ordering capability
- Active status
- Integration status

**Editing Laboratory:**

1. Find laboratory in directory
2. Click **Edit** button
3. Update information using toggle switches
4. Modify contact or service details
5. Click **Update Laboratory**

💡 **Tip:** Use toggle switches to quickly enable/disable laboratory features without having to check/uncheck multiple boxes.

---

## 13. Pharmacy Management

### 13.1 Pharmacy Directory

**Viewing Pharmacy Directory:**

1. Go to **Pharmacies** module
2. View list of all pharmacies in system
3. Search by:
   - Pharmacy name
   - Location/ZIP code
   - Phone number

**Pharmacy Information Includes:**
- Pharmacy name
- Address and location
- Phone and fax numbers
- Hours of operation
- E-prescribing capability
- Services offered

### 13.2 Adding Pharmacies

**To Add New Pharmacy:**

1. Go to **Pharmacies** > **Add Pharmacy**
2. Fill in pharmacy details using the enhanced form with toggle switches:

**Basic Information:**
- **Pharmacy Name** (required)
- **NCPDP ID** - National pharmacy identifier
- **Chain Name** - Pharmacy chain (e.g., CVS, Walgreens)
- **Type** - Select pharmacy type:
  - Community
  - Hospital
  - Mail Order
  - Specialty
  - Long-term Care
  - Other

**Address Information:**
- **Street Address** (required)
- **City** (required)
- **State** (required)
- **ZIP Code** (required)
- **Country**

**Contact Information:**
- **Phone Number** (required)
- **Fax Number**
- **Email Address**
- **Website URL**

**Service Features (Toggle Switches):**

Modern toggle switches replace checkboxes for better UX:

- 🔵 **24-Hour Service** - Toggle ON if pharmacy is open 24/7
- 🔵 **Accepts E-Prescriptions** - Toggle ON if accepts electronic prescriptions
- 🔵 **Delivery Available** - Toggle ON if pharmacy offers delivery service
- 🔵 **Drive-Through** - Toggle ON if pharmacy has drive-through window
- 🔵 **Accepts Insurance** - Toggle ON if pharmacy accepts insurance
- 🔵 **Preferred Network** - Toggle ON if this is a preferred network pharmacy
- 🔵 **Active Status** - Toggle ON to make pharmacy active in system

**Operating Hours:**
- Set hours for each day of the week
- Specify if closed on certain days

**Additional Information:**
- **Notes** - Special instructions or additional information
- **Services** - List of specialized services offered

3. Click **Save Pharmacy**

💡 **Tip:** Toggle switches provide clear visual indication of enabled features - blue toggle means enabled, gray means disabled.

**Editing Existing Pharmacy:**

1. Find pharmacy in directory
2. Click **Edit** button
3. Update information using same form
4. Use toggle switches to enable/disable features
5. Click **Update Pharmacy**

**Toggle Switch Benefits:**
- Clear visual state (ON/OFF)
- More accessible than checkboxes
- Modern, intuitive interface
- Consistent with mobile app design patterns
- Easier to use on touch devices

### 13.3 Patient Preferred Pharmacy

**Setting Patient's Preferred Pharmacy:**

1. Open patient record
2. Go to **Pharmacy** tab
3. Click **Set Preferred Pharmacy**
4. Search for pharmacy by name or location
5. Select pharmacy from list
6. Click **Save Preference**

**Benefits:**
- Auto-selects preferred pharmacy when prescribing
- Streamlines prescription workflow
- Ensures prescriptions go to patient's chosen location

**Changing Preferred Pharmacy:**
1. Open patient record > **Pharmacy** tab
2. Click **Change Pharmacy**
3. Select new preferred pharmacy
4. Confirm change

### 13.4 Prescription Fulfillment

**Tracking Prescription Status:**

1. View patient's prescriptions
2. Status indicators:
   - 📤 **Sent to Pharmacy** - E-prescription transmitted
   - 🔄 **In Progress** - Pharmacy filling prescription
   - ✅ **Filled** - Ready for pickup
   - 📦 **Picked Up** - Patient collected medication
   - ❌ **Cancelled** - Prescription cancelled

**Pharmacy Communication:**
- Pharmacies can send messages through system
- Questions about prescriptions
- Drug availability issues
- Prior authorization needs
- Alternative medication suggestions

---

## 14. Revenue Cycle Management

### 14.1 Creating Claims

**To Create an Insurance Claim:**

1. Navigate to **RCM** > **Claims**
2. Click **New Claim**
3. Fill in claim information:

**Claim Header:**
- **Claim Number** - Auto-generated unique identifier
- **Patient** - Select patient (required)
- **Insurance Payer** - Select insurance company (required)
- **Service Date** - Date of service (required)
- **Provider** - Rendering provider (required)

**Claim Details:**
- **Claim Amount** - Total amount charged (required)
- **Diagnosis Codes** - Add all applicable ICD-10 codes
  - Primary diagnosis (required)
  - Secondary diagnoses (up to 11 more)
- **Procedure Codes** - Add CPT codes for services rendered
  - Code
  - Description
  - Units
  - Charge per unit
  - Total charge

**Additional Information:**
- **Place of Service** - Office, Hospital, etc.
- **Authorization Number** - If prior auth obtained
- **Referral Number** - If applicable
- **Claim Notes** - Additional documentation

4. Click **Save Claim**

### 14.2 Submitting Claims

**Electronic Claim Submission:**

1. Review claim for completeness
2. Click **Validate Claim** to check for errors
3. Fix any validation errors
4. Click **Submit Claim**
5. Select submission method:
   - Electronic (HL7 837)
   - Paper (generate claim form)
6. Confirm submission
7. Claim status changes to "Submitted"

**Claim Validation Checks:**
- Required fields completed
- Valid diagnosis codes
- Valid procedure codes
- Patient insurance active
- No duplicate claims
- Date of service within coverage period

### 14.3 Claim Status Tracking

**Claim Statuses:**

- 📋 **Pending** - Created but not submitted
- 📤 **Submitted** - Sent to insurance payer
- 🔄 **In Review** - Under payer review
- ✅ **Approved** - Claim approved for payment
- ❌ **Denied** - Claim denied by payer
- 💰 **Paid** - Payment received
- 🔁 **Resubmitted** - Corrected and resubmitted after denial

**Tracking Claim Progress:**

1. Go to **RCM** > **Claims**
2. View claims dashboard showing:
   - Pending claims count
   - Submitted claims count
   - Denied claims count
   - Total amount pending
3. Filter by status, date range, payer, or provider
4. Click on claim to view detailed status

### 14.4 Managing Denied Claims

**Processing Claim Denials:**

1. Go to **RCM** > **Denied Claims**
2. Click on denied claim
3. Review denial reason:
   - Invalid diagnosis code
   - Not covered service
   - Missing information
   - Pre-authorization required
   - Duplicate claim
   - Other

**Correcting and Resubmitting:**
1. Click **Edit Claim**
2. Correct the identified issues
3. Add denial response notes
4. Click **Resubmit Claim**
5. Monitor resubmission status

**Appeal Process:**
1. For valid claims denied incorrectly, click **Appeal**
2. Attach supporting documentation
3. Write appeal letter
4. Submit appeal
5. Track appeal status

### 14.5 Insurance Payer Management

**Managing Insurance Payers:**

1. Go to **RCM** > **Insurance Payers**
2. View list of all insurance companies
3. Click **Add Insurance Payer** to add new

**Payer Information:**
- **Payer Name** (required)
- **Payer ID** - Electronic payer ID
- **Address**
- **Phone Number**
- **Website**
- **Claims Submission Method** - Electronic, Paper, or Both
- **Electronic Payer ID**
- **Claims Address**
- **Contact Person**
- **Notes** - Special instructions

**Payer-Specific Settings:**
- Claim submission requirements
- Prior authorization requirements
- Accepted procedure codes
- Fee schedules
- Payment timelines

### 14.6 Payment Processing

**Recording Patient Payments:**

1. Go to **RCM** > **Payments**
2. Click **New Payment**
3. Fill in payment details:

**Payment Information:**
- **Payment Number** - Auto-generated
- **Patient** - Select patient (required)
- **Amount** - Payment amount (required)
- **Payment Date** - Date received (required)
- **Payment Method** (required):
  - Credit Card
  - Debit Card
  - Cash
  - Check
  - Bank Transfer
  - Insurance Payment

**Payment Method Details:**

**For Card Payments:**
- Last 4 digits of card
- Card brand (Visa, MasterCard, etc.)
- Transaction ID

**For Check Payments:**
- Check number
- Bank name

**For Bank Transfers:**
- Transaction reference
- Bank name

**Association:**
- **Link to Claim** - If payment related to claim
- **Payment Type** - Copay, Deductible, Coinsurance, Full Payment
- **Description** - Payment description/notes

4. Click **Save Payment**

**Payment Receipt:**
- Automatically generate receipt
- Print or email to patient
- Receipt includes transaction details

### 14.7 Financial Reporting

**Accessing Financial Reports:**

1. Go to **RCM** > **Reports**
2. Select report type:
   - **Revenue Report** - Total revenue by period
   - **Claims Report** - Claim submission and approval rates
   - **Payment Report** - Payments received
   - **Outstanding Balance Report** - Amounts owed
   - **Payer Analysis** - Performance by insurance company
   - **Provider Productivity** - Revenue by provider

**Generating Reports:**
1. Select report type
2. Choose date range
3. Select filters (provider, payer, etc.)
4. Click **Generate Report**
5. View report on screen
6. Export options:
   - PDF
   - Excel
   - CSV

**Key Metrics:**
- Total revenue
- Claims submitted
- Claims approved
- Denial rate
- Days in A/R (accounts receivable)
- Collection rate
- Payment by method
- Revenue by service type

---

## 15. Healthcare Offerings

### 15.1 About Healthcare Offerings

Healthcare offerings are service packages that practices can create and offer to patients. Examples include:
- Annual wellness packages
- Weight management programs
- Chronic disease management bundles
- Preventive care packages
- Cosmetic procedure packages

### 15.2 Creating Healthcare Offerings

**To Create a New Offering:**

1. Go to **Offerings** module
2. Click **Create New Offering**
3. Fill in offering details:

**Basic Information:**
- **Offering Name** (required)
- **Category** - Wellness, Preventive, Chronic Care, etc.
- **Description** - Detailed description of services included
- **Duration** - Length of program (e.g., "3 months", "1 year")

**Services Included:**
- Click **Add Service**
- Select services from list:
  - Office visits (quantity)
  - Lab tests included
  - Procedures
  - Consultations
  - Other services
- Specify quantity of each service

**Pricing:**
- **Base Price** - Standard package price
- **Promotional Price** - Discounted price (optional)
- **Insurance Pricing** - Different pricing by insurance plan
- **Payment Options** - One-time, Monthly, Quarterly

**Additional Details:**
- **Eligibility Criteria** - Who can enroll
- **Terms and Conditions**
- **Featured Offering** - Display prominently on patient portal
- **Active Status** - Active or Inactive

4. Click **Save Offering**

### 15.3 Managing Offerings

**Viewing All Offerings:**
1. Go to **Offerings** module
2. View all packages with:
   - Offering name
   - Category
   - Price
   - Enrollment count
   - Status

**Editing Offerings:**
1. Click on offering
2. Click **Edit Offering**
3. Update information
4. Click **Save Changes**

**Deactivating Offerings:**
1. Open offering
2. Toggle **Status** to Inactive
3. Existing enrollments continue, but no new enrollments accepted

### 15.4 Patient Enrollment

**Enrolling Patient in Offering:**

1. Open patient record
2. Go to **Offerings** tab
3. Click **Enroll in Offering**
4. Select offering from list
5. Confirm enrollment details:
   - Start date
   - Price/payment plan
   - Insurance coverage (if applicable)
6. Click **Enroll Patient**

**Managing Enrollments:**
- View active enrollments
- Track service utilization
- Monitor completion status
- Process enrollment payments

### 15.5 Offering Analytics

**Tracking Offering Performance:**

1. Go to **Offerings** > **Analytics**
2. View metrics for each offering:
   - Total enrollments
   - Revenue generated
   - Service utilization rates
   - Patient satisfaction ratings
   - Completion rates

**Optimizing Offerings:**
- Identify popular packages
- Adjust pricing based on demand
- Modify services based on utilization
- Create new offerings based on patient needs

---

## 16. Patient Portal

### 16.1 Patient Portal Overview

The Patient Portal is a secure online platform where patients can:
- View and manage appointments
- Access medical records
- View prescriptions
- Complete assigned forms
- Communicate with providers
- Manage personal information
- Browse healthcare offerings

**🆕 UPDATED IN V1.3:** When a patient signs in, the portal *is* their Home workspace — they land directly on it rather than navigating to it. Portal sections appear in the second pane: Appointments, Diagnoses, Prescriptions, Records, and Forms.

**Portal Security (V1.3):**
- Session tokens are hashed at rest and bound to the specific patient
- Repeated failed logins trigger rate limiting and temporary account lockout
- Sessions are held in `sessionStorage` and clear when the browser closes
- Social login tokens are validated server-side before any account is created

### 16.2 Public Booking Links

**🆕 NEW IN V1.3:** Let patients book without an account.

Every practice has a public booking page at:

```
https://<your-domain>/book/<practice-slug>
```

**Setting It Up:**

1. Go to **Settings → Clinic Settings**
2. Find **Public Booking Link**
3. Set the practice slug (the readable name in the URL)
4. Toggle **Enable public booking**
5. Choose which appointment types are bookable publicly
6. Click **Save**

**What Patients See:**

- Available appointment types with prices in the practice's configured currency
- Open slots drawn from live provider availability
- A short form for name, contact details, and reason for visit
- Immediate booking confirmation by email

**What Happens Next:**

Public bookings arrive in the normal appointment queue. If the contact details match an existing patient, the booking attaches to that record; otherwise a provisional patient record is created for staff to complete at check-in.

💡 **Tip:** Share the booking link on your website, in email signatures, and on appointment reminder messages.

⚠️ **Warning:** The booking page is public by design. It exposes appointment types, availability, and prices — nothing else. No patient data is readable from it.

### 16.3 Patient Portal Setup

**Enabling Portal for a Patient:**

1. Open patient record
2. Check **Enable Patient Portal**
3. Click **Send Portal Invitation**
4. Patient receives email with:
   - Portal URL
   - Temporary password or registration link
   - Instructions for first-time login

### 16.4 Patient Portal Features (Patient View)

**After Logging Into Patient Portal:**

#### Dashboard
- Upcoming appointments
- Recent messages from providers
- Prescription refill reminders
- Test results notifications
- Health reminders

#### My Appointments

**Viewing Appointments:**
- See all upcoming appointments
- View past appointment history
- Appointment details:
  - Date and time
  - Provider name
  - Appointment type
  - Location or telehealth link

**Booking Appointments:**
1. Click **Book Appointment**
2. Select provider (or any available)
3. Select appointment type
4. Choose available date and time from calendar
5. Add reason for visit
6. Click **Book Appointment**
7. Receive confirmation email

**Rescheduling Appointments:**
1. Click on appointment
2. Click **Reschedule**
3. Select new date/time
4. Confirm change

**Cancelling Appointments:**
1. Click on appointment
2. Click **Cancel Appointment**
3. Confirm cancellation

⚠️ **Note:** Cancellation policies may apply. Check with your provider.

**Joining Telehealth Appointments:**
1. Find scheduled telehealth appointment
2. Click **Join Video Call** (appears 10 minutes before appointment)
3. Allow camera/microphone permissions
4. Wait for provider to start session

#### My Medical Records

**Viewing Medical Records:**
- View all released medical records
- Records organized by date
- Filter by record type
- Search records

**Record Details Include:**
- Date of visit
- Provider name
- Diagnosis
- Treatment provided
- Prescriptions
- Follow-up instructions

#### My Prescriptions

**Viewing Prescriptions:**
- See all active prescriptions
- View prescription details:
  - Medication name and dosage
  - Instructions
  - Refills remaining
  - Prescribing provider
  - Pharmacy

**Requesting Refills:**
1. Find prescription needing refill
2. Click **Request Refill**
3. Add any notes for provider
4. Click **Submit Request**
5. Provider receives notification
6. Receive notification when approved/denied

#### My Test Results

**Viewing Lab Results:**
- Access released lab results
- View result values and normal ranges
- See provider comments/interpretation
- View result trends over time
- Download results as PDF

#### My Profile

**Managing Personal Information:**
- View and update contact information
- Update address
- Update phone number and email
- Update emergency contact
- Select preferred pharmacy
- Set communication preferences

**Cannot Change:**
- Name (contact office to update)
- Date of birth (contact office to update)
- Medical record number

#### Healthcare Offerings

**Browsing Offerings:**
- View available healthcare packages
- See featured offerings
- Read detailed descriptions
- View pricing
- Check eligibility

**Enrolling in Offerings:**
1. Browse offerings
2. Click **Learn More** on offering
3. Review details
4. Click **Enroll Now**
5. Complete enrollment form
6. Submit for approval

#### Messages (If Enabled)

**Secure Messaging:**
- Send secure messages to care team
- Receive responses from providers
- Attach documents if needed
- View message history

⚠️ **Note:** Do not use messaging for urgent issues. Call clinic or go to emergency room for emergencies.

### 16.5 Patient Portal Best Practices

**For Patients:**
- ✅ Keep contact information up to date
- ✅ Check portal regularly for messages and results
- ✅ Request prescription refills before running out
- ✅ Arrive to appointments on time
- ✅ Use secure messaging for non-urgent questions
- ❌ Don't share your login credentials
- ❌ Don't use portal for medical emergencies

**For Staff:**
- ✅ Release test results promptly
- ✅ Respond to messages within 24-48 hours
- ✅ Encourage patients to use portal
- ✅ Provide portal instructions during registration
- ✅ Keep patient email addresses current

---

## 17. Reports & Analytics

### 17.1 Available Reports

AureonCare offers comprehensive reporting across all modules:

#### Revenue Reports
- Total revenue by period
- Revenue by provider
- Revenue by service type
- Revenue by insurance payer
- Revenue trends and forecasts

#### Appointment Reports
- Appointment volume
- No-show rates
- Cancellation rates
- Provider utilization
- Peak scheduling times
- Average wait times

#### Patient Reports
- New patient registrations
- Active patient counts
- Patient demographics
- Patient retention rates
- Portal usage statistics

#### Clinical Reports
- Diagnosis frequency
- Prescription patterns
- Lab test utilization
- Telehealth session counts
- Clinical quality measures

#### Claims Reports
- Claims submitted
- Claims approved/denied
- Denial reasons analysis
- Days in accounts receivable
- Payer performance
- Clean claim rate

#### Operational Reports
- Staff productivity
- Task completion rates
- System usage statistics
- Waitlist statistics
- Patient satisfaction scores

### 17.2 Generating Reports

**To Generate a Report:**

1. Navigate to **Reports** module
2. Select report category
3. Select specific report type
4. Configure report parameters:

**Common Parameters:**
- **Date Range** - Start and end dates
- **Provider** - All or specific provider
- **Location** - If multi-location practice
- **Insurance Payer** - For financial reports
- **Patient Status** - Active, Inactive, or All
- **Comparison Period** - To compare with previous period

5. Click **Generate Report**
6. Report displays on screen

### 17.3 Report Visualization

**Report Display Options:**

**Charts and Graphs:**
- Bar charts
- Line graphs
- Pie charts
- Trend lines
- Heat maps

**Tables:**
- Sortable columns
- Filterable data
- Expandable rows
- Summary totals

**Dashboards:**
- Multiple metrics in one view
- Interactive widgets
- Drill-down capability
- Real-time updates

### 17.4 Exporting Reports

**Export Options:**

1. After generating report, click **Export**
2. Select format:
   - **PDF** - For printing or sharing
   - **Excel** - For further analysis
   - **CSV** - For data import to other systems
3. Choose to download or email
4. Click **Export**

**Scheduled Reports:**
1. Click **Schedule Report**
2. Set schedule:
   - Daily, Weekly, Monthly, Quarterly
   - Specific day/time
3. Add email recipients
4. Click **Save Schedule**
5. Reports automatically generated and emailed

### 17.5 Report Permissions

**Who Can Access Reports:**

Based on role permissions:
- **Administrators** - All reports
- **Billing Managers** - Financial reports
- **Providers** - Clinical reports, own productivity
- **CRM Managers** - Patient engagement reports
- **Receptionists** - Appointment reports

💡 **Tip:** Contact administrator to request access to additional reports.

### 17.6 Key Performance Indicators (KPIs)

**Monitor These Important Metrics:**

**Financial KPIs:**
- Monthly revenue
- Revenue per patient
- Collection rate
- Days in A/R
- Claim denial rate

**Operational KPIs:**
- Appointment no-show rate
- Patient wait time
- Provider utilization rate
- Patient satisfaction score
- Portal adoption rate

**Clinical KPIs:**
- Patient outcomes
- Quality measure compliance
- Prescription accuracy
- Telehealth adoption
- Preventive care completion rates

---

## 18. Notifications & Tasks

### 18.1 Notifications System

**🆕 UPDATED IN V1.3:** Notifications are now centralised across every module and delivered by email and WhatsApp in addition to in-app alerts.

**Delivery Channels:**

| Channel | Recipients | Opt-in Required |
|---------|-----------|-----------------|
| **In-app** | All users | No |
| **Email** | Patients, providers, admins | No |
| **WhatsApp** | Patients | Yes — patient must opt in |
| **WhatsApp** | Providers, admins | No — sent to the number on record |

✅ **Note:** Notification delivery never blocks the underlying action. If an email or WhatsApp message fails, the failure is logged and the appointment, claim, or order still completes.

**Types of Notifications:**

AureonCare sends automatic notifications for:
- New appointment bookings, including public booking-link bookings
- Appointment reminders
- Appointment cancellations and reschedules
- Waitlist slot availability and booking confirmations
- Telehealth session links and start reminders
- Lab results available
- Prescription refill requests
- Form assignments and submission receipts
- Patient portal messages
- Claim status updates
- Payment receipts and failures
- Inventory low-stock and reorder alerts
- Task assignments
- System alerts

**Patient WhatsApp Opt-In:**

1. Open the patient record
2. Go to **Preferences → Notification Preferences**
3. Toggle **WhatsApp notifications**
4. Confirm the mobile number
5. Click **Save**

Patients can also manage this themselves in the Patient Portal.

**Configuring Notification Delivery:**

Administrators set the sending email account and WhatsApp credentials in **Settings → Integrations**. Admin contact details for system alerts are taken from the organisation settings.

### 18.2 Viewing Notifications

**Accessing Notifications:**

1. Click the **Bell Icon** 🔔 in top menu
2. Notification panel opens showing:
   - Unread notifications (highlighted)
   - Read notifications
   - Notification time
   - Notification type/icon

**Notification Details:**
- Click on notification to view full details
- Related actions available (e.g., "View Appointment", "Reply to Message")

### 18.3 Managing Notifications

**Marking as Read:**
- Click on notification to mark as read
- Or click **Mark as Read** button
- Or click **Mark All as Read**

**Clearing Notifications:**
- Click **Clear** on individual notification
- Or click **Clear All Notifications**

**Notification Preferences:**
1. Go to **Settings** > **Notifications**
2. Configure preferences for each notification type:
   - Email notification - Yes/No
   - SMS notification - Yes/No
   - In-app notification - Yes/No
   - Push notification - Yes/No (if mobile app)
3. Set notification frequency:
   - Immediately
   - Digest (once daily)
   - Off
4. Click **Save Preferences**

### 18.4 Task Management

**What Are Tasks?**

Tasks are action items assigned to users that require completion. Examples:
- Review lab result
- Call patient for follow-up
- Complete prior authorization
- Verify insurance
- Update patient record

### 18.5 Viewing Tasks

**My Tasks Dashboard:**

1. Click **Tasks** in main menu
2. View all your tasks organized by:
   - **Pending** - Not yet started
   - **In Progress** - Currently working on
   - **Completed** - Finished tasks
   - **Cancelled** - Cancelled tasks

**Task Details Include:**
- Task title
- Description
- Priority (High, Medium, Low)
- Due date
- Assigned by (who created the task)
- Status
- Related patient or record

### 18.6 Creating Tasks

**To Create a Task:**

1. Click **New Task**
2. Fill in task details:
   - **Title** - Brief description (required)
   - **Description** - Detailed description
   - **Assign To** - Select user (required)
   - **Priority** - High, Medium, or Low (required)
   - **Due Date** - When task should be completed
   - **Related To** - Link to patient, appointment, claim, etc.
3. Click **Create Task**

**Assigned user receives notification**

### 18.7 Managing Tasks

**Updating Task Status:**
1. Open task
2. Click **Change Status**
3. Select new status:
   - Pending → In Progress (when you start working)
   - In Progress → Completed (when finished)
   - Any status → Cancelled (if no longer needed)
4. Add notes about progress
5. Click **Update**

**Completing Tasks:**
1. Open task
2. Add completion notes
3. Click **Mark Complete**
4. Task moves to completed list
5. Person who assigned task receives notification

**Task Reminders:**
- Receive reminders for tasks approaching due date
- High-priority tasks highlighted in red
- Overdue tasks marked clearly

---

## 19. Administration

### 19.1 User Management

🆕 **UPDATED IN V1.2:** Improved inline form experience and language selection!

**Accessing User Management:**

1. Navigate to **Admin Panel** > **Users** tab
2. View all system users in table format

**Adding New Users:**

1. Click **Add New User** button
2. Full-screen inline form appears (no modal popups)
3. Fill in user information:

**Personal Information:**
   - First Name (required)
   - Last Name (required)
   - Email (required) - Used for login and notifications
   - Phone Number
   - Address
   - Date of Birth

**Professional Information:**
   - License Number (for clinical staff)
   - Specialty (for providers/doctors)
   - NPI Number (for billing providers)
   - DEA Number (for prescribing providers)
   - Credentials (e.g., MD, DO, NP, PA)

**Language Preference** - 🆕 NEW IN V1.2:
   - Select preferred language from dropdown:
     - English
     - Spanish (Español)
     - French (Français)
     - German (Deutsch)
     - Arabic (العربية)
     - Hindi (हिन्दी)
     - Mandarin (中文)
     - Portuguese (Português)
   - **Automatic Language Switching:** When user logs in, interface automatically switches to their preferred language
   - User can change language anytime in their profile settings

**Account Settings:**
   - Temporary Password (user will be prompted to change on first login)
   - Password must meet security requirements:
     - Minimum 8 characters
     - At least one uppercase letter
     - At least one lowercase letter
     - At least one number
     - At least one special character

**Role Assignment:**
3. Assign one or more roles:
   - Administrator - Full system access
   - Doctor - Clinical care provider
   - Nurse - Clinical support staff
   - Receptionist - Front desk and scheduling
   - Billing Manager - Revenue cycle management
   - CRM Manager - Patient engagement and marketing
   - Staff - General staff member
   - Or assign custom roles

**User Status:**
4. Set initial status:
   - **Active** - User can log in immediately
   - **Pending** - Account created but not yet activated
   - **Blocked** - Account suspended (cannot log in)

5. Click **Create User** button
6. User receives welcome email with:
   - Login credentials
   - Link to set password (if temporary password used)
   - Patient portal link
   - Getting started guide

**Inline Form Benefits:**
- Full-screen form for better data entry experience
- No modal popups to manage
- Easier to navigate between fields
- Better mobile and tablet experience
- Form validation in real-time
- Auto-save drafts (prevents data loss)

**Editing Users:**
1. Find user in list
2. Click on user row or **Edit** button
3. Full-screen inline form appears with current user data
4. Update any information
5. Changes are validated in real-time
6. Click **Save Changes**
7. Success message appears
8. User receives email notification of profile changes (if email changed)

**Managing User Roles:**
1. Open user record
2. Go to **Roles** tab
3. Check/uncheck roles
4. Click **Update Roles**

⚠️ **Warning:** Users must have at least one role.

**Deactivating Users:**
1. Open user record
2. Change status to **Blocked**
3. User can no longer log in
4. Historical data preserved

### 19.2 Role Management

**Viewing Roles:**

1. Go to **Admin Panel** > **Roles**
2. View all roles with:
   - Role name
   - Number of users
   - Number of permissions
   - System role indicator

**System Roles (Cannot Be Deleted):**
- Administrator
- Doctor
- Patient
- Nurse
- Receptionist
- Billing Manager
- CRM Manager
- Staff

**Creating Custom Roles:**

🆕 **UPDATED IN V1.2:** Now supports granular permissions across all 14 modules!

1. Click **Create New Role**
2. Enter role name (e.g., "Clinical Coordinator", "Lab Technician")
3. Enter description
4. Select permissions for each module:

**Available Permissions (All 14 Modules):**

**1. Patients Module**
  - View Patients
  - Create Patients
  - Edit Patients
  - Delete Patients

**2. Appointments Module**
  - View Appointments
  - Create Appointments
  - Edit Appointments
  - Delete Appointments

**3. Providers Module**
  - View Providers
  - Create Providers
  - Edit Providers
  - Delete Providers

**4. EHR (Electronic Health Records) Module**
  - View Medical Records
  - Create Medical Records
  - Edit Medical Records
  - Delete Medical Records

**5. Prescriptions Module**
  - View Prescriptions
  - Create Prescriptions
  - Edit Prescriptions
  - Delete Prescriptions

**6. Diagnoses Module**
  - View Diagnoses
  - Create Diagnoses
  - Edit Diagnoses
  - Delete Diagnoses

**7. Lab Orders Module**
  - View Lab Orders
  - Create Lab Orders
  - Edit Lab Orders
  - Delete Lab Orders

**8. Telehealth Module**
  - View Sessions
  - Create Sessions
  - Edit Sessions
  - Delete Sessions

**9. RCM (Revenue Cycle Management) Module**
  - View Claims
  - Create Claims
  - Edit Claims
  - Delete Claims

**10. Pharmacy Module**
  - View Pharmacies
  - Create Pharmacies
  - Edit Pharmacies
  - Delete Pharmacies

**11. Offerings (Healthcare Offerings) Module**
  - View Offerings
  - Create Offerings
  - Edit Offerings
  - Delete Offerings

**12. CRM (Customer Relationship Management) Module**
  - View Campaigns
  - Create Campaigns
  - Edit Campaigns
  - Delete Campaigns

**13. Administration Module**
  - View Users
  - Create Users
  - Edit Users
  - Delete Users

**14. Reports Module**
  - View Reports
  - Create Reports
  - Edit Reports
  - Delete Reports

**Permission Levels:**

Each module supports 4 standard permission levels:
- **View** - Read-only access to view records
- **Create** - Ability to create new records
- **Edit** - Ability to modify existing records
- **Delete** - Ability to remove records

5. Check/uncheck permissions for each module as needed
6. Click **Create Role**

**Example Custom Roles:**

**Lab Coordinator:**
- Lab Orders: View, Create, Edit
- Patients: View
- Providers: View
- Reports: View

**Medical Assistant:**
- Patients: View, Create, Edit
- Appointments: View, Create, Edit
- EHR: View, Create
- Prescriptions: View
- Lab Orders: View, Create

**Billing Specialist:**
- RCM: View, Create, Edit
- Patients: View
- Appointments: View
- Reports: View, Create

**Care Coordinator:**
- Patients: View, Edit
- Appointments: View, Create, Edit
- Telehealth: View, Create
- Offerings: View
- CRM: View, Create, Edit

**Editing Roles:**
1. Click on role
2. Click **Edit Role**
3. Modify permissions
4. Click **Save Changes**

### 19.3 Subscription Plan Management

**Viewing Plans:**

1. Go to **Admin Panel** > **Plans**
2. View all subscription tiers:
   - Free
   - Starter
   - Professional
   - Enterprise

**Plan Features:**

Each plan includes:
- User limits
- Patient limits
- Feature access
- Storage limits
- Support level
- Price (monthly/yearly)

**Assigning Plan to Organization:**

1. Go to **Admin Panel** > **Organization Settings**
2. Click **Change Plan**
3. Select new plan
4. Set start date
5. Set billing cycle (Monthly/Yearly)
6. Click **Assign Plan**

**Managing Plan Features:**
- Enable/disable features per plan
- Set usage limits
- Configure auto-renewal
- View usage statistics

### 19.4 Organization Settings

**Configuring Clinic Information:**

1. Go to **Admin Panel** > **Organization Settings**
2. Update clinic details:
   - **Organization Name**
   - **Address**
   - **Phone Number**
   - **Email**
   - **Website**
   - **Tax ID**
   - **NPI Number**
   - **Logo** (upload)

**Working Hours:**
- Set clinic hours for each day of week
- Set break times
- Set holidays and closures

**Appointment Settings:**
- Default appointment duration
- Booking window (how far in advance patients can book)
- Cancellation policy
- No-show policy
- Reminder settings

**Billing Settings:**
- Default payment methods
- Invoice template
- Late payment fees
- Payment terms

**Communication Settings:**
- Email server configuration
- SMS provider configuration
- WhatsApp integration
- Notification templates

3. Click **Save Settings**

### 19.5 System Monitoring

**System Health:**

1. Go to **Admin Panel** > **System Health**
2. View system metrics:
   - Server uptime
   - Database status
   - API response time
   - Storage usage
   - Active users
   - Recent errors

**Performance Metrics:**
- Monitor system performance
- Track response times
- Identify bottlenecks
- Optimize system resources

**Alerts & Notifications:**
- Configure system alerts
- Set thresholds for warnings
- Email notifications for critical issues
- SMS alerts for emergencies

💡 **Tip:** For detailed audit logging, see [Section 19.7 Audit Logging](#197-audit-logging)

💡 **Tip:** For data archiving and retention, see [Section 19.6 Data Archiving](#196-data-archiving)

### 19.6 Data Archiving

**🆕 NEW IN V1.2:** Comprehensive data archiving system for compliance and performance!

**What is Data Archiving?**

Data archiving moves older, infrequently accessed data to a separate archive database while keeping it searchable and restorable. This helps:
- Improve system performance
- Comply with data retention policies
- Reduce primary database size
- Maintain historical records
- Meet regulatory requirements (HIPAA, SOX, etc.)

**Accessing Data Archiving:**

1. Go to **Admin Panel** > **Data Archiving**
2. View archiving dashboard with:
   - Total archived data size
   - Number of archived records by module
   - Last archive run date/time
   - Archive storage usage
   - Active archiving rules

**Supported Modules for Archiving:**

The system can archive data from **14 modules**:
- **Patients** - Inactive patient records
- **Appointments** - Past appointments
- **Providers** - Inactive providers
- **Medical Records** - Older clinical notes
- **Prescriptions** - Discontinued medications
- **Diagnoses** - Resolved diagnoses
- **Lab Orders** - Completed lab orders
- **Telehealth** - Past video sessions
- **RCM (Claims & Billing)** - Paid/closed claims
- **Pharmacy** - Inactive pharmacies
- **Lab Facilities** - Inactive labs
- **Offerings** - Archived service offerings
- **CRM** - Completed campaigns
- **Audit Logs** - Historical audit records

**Creating Archiving Rules:**

1. Click **Create Archive Rule**
2. Fill in rule details:
   - **Rule Name** - Descriptive name (e.g., "Archive old appointments")
   - **Module** - Select module to archive from dropdown
   - **Age Threshold** - How old data must be (e.g., 2 years)
   - **Time Unit** - Days, Months, or Years
   - **Enabled** - Toggle to activate/deactivate rule
   - **Schedule** - How often to run (Daily, Weekly, Monthly, Manual)
3. Click **Create Rule**

**Example Archiving Rules:**

| Rule Name | Module | Age Threshold | Schedule |
|-----------|---------|---------------|----------|
| Archive Old Appointments | Appointments | 2 years | Monthly |
| Archive Resolved Diagnoses | Diagnoses | 5 years | Quarterly |
| Archive Paid Claims | RCM | 7 years | Monthly |
| Archive Old Audit Logs | Audit Logs | 1 year | Weekly |
| Archive Inactive Patients | Patients | 3 years | Monthly |

**Manual Archiving:**

**Option 1: Run Specific Rule**
1. Go to **Data Archiving** tab
2. Find the rule you want to run
3. Click **Run Now** button
4. System processes archiving immediately
5. View progress and results

**Option 2: Create One-Time Archive**
1. Click **Create Archive** button
2. Select modules to archive
3. Set date range for data to archive
4. Choose deduplication option (recommended)
5. Click **Start Archive**
6. Monitor progress in real-time

**Automatic Scheduled Archiving:**

1. Edit archiving rule
2. Set schedule:
   - **Daily** - Runs every night at 2:00 AM
   - **Weekly** - Runs every Sunday at 2:00 AM
   - **Monthly** - Runs on 1st of month at 2:00 AM
3. Enable the rule
4. System automatically archives matching data
5. Email notification sent to admins after completion

**Deduplication:**

- Prevents archiving duplicate records
- Checks archive database before moving data
- Saves storage space
- Ensures data integrity
- Recommended to always enable

**Browsing Archived Data:**

1. Go to **Data Archiving** > **Browse Archives**
2. Select module (Patients, Appointments, etc.)
3. Search archived records:
   - By name, ID, date range
   - Filter by status, type, etc.
4. View archived record details
5. Option to restore if needed

**Restoring Archived Data:**

1. Find archived record in Browse Archives
2. Click **Restore** button
3. Confirm restoration
4. System moves data back to primary database
5. Record becomes active and fully accessible
6. Original timestamps and data preserved

**Archive Database:**

- Separate PostgreSQL database for archived data
- Same schema as primary database
- Cross-database queries supported
- Independent backup and maintenance
- Secure access with same authentication

**Storage Management:**

**View Storage Usage:**
1. Data Archiving dashboard shows:
   - Archive database size
   - Size per module
   - Growth rate
   - Estimated time to threshold

**Storage Optimization:**
- Set retention policies for archives
- Permanently delete very old archives (with caution!)
- Export archives to external storage
- Compress archived data

**Compliance & Retention:**

**Regulatory Requirements:**
- **HIPAA** - Minimum 6 years retention for medical records
- **SOX** - 7 years for financial records
- **IRS** - 7 years for billing/payment records
- **State Laws** - Varies by state (often 7-10 years)

**Best Practices:**
- Archive completed appointments after 2 years
- Archive resolved diagnoses after 5 years
- Archive paid claims after 7 years
- Archive audit logs after 1 year (keep in archive for 7 years total)
- Never archive active or in-progress records
- Test restoration process quarterly
- Document retention policies
- Review and update rules annually

**Audit Trail:**

Every archive operation is logged:
- Who initiated archive
- What data was archived
- When archiving occurred
- How many records archived
- Any errors or warnings
- Restoration events

**Permissions:**

Only users with **Admin** role can:
- Create/edit archiving rules
- Run manual archives
- Browse archived data
- Restore archived records
- View archiving logs

**Performance Impact:**

- Archiving runs during off-hours (2:00 AM)
- Minimal impact on system performance
- Progress shown in real-time
- Can pause/resume if needed
- Typical speed: 10,000 records per minute

⚠️ **Warning:** Always test archiving on a small dataset first before archiving large volumes of data.

⚠️ **Warning:** Ensure backups are current before running large archive operations.

### 19.7 Audit Logging

**🆕 NEW IN V1.2:** Comprehensive audit logging for all user actions and system events!

**What is Audit Logging?**

Audit logging captures every action performed in the system, creating a complete audit trail for:
- Compliance (HIPAA, SOX, GDPR, etc.)
- Security monitoring
- Troubleshooting
- User accountability
- Legal/regulatory requirements
- Quality assurance

**Accessing Audit Logs:**

1. Go to **Admin Panel** > **Audit Logs**
2. View comprehensive audit log dashboard

**What Gets Logged:**

**User Actions:**
- Login/logout events
- Failed login attempts
- Password changes
- User creation/updates/deletion
- Role assignments

**Data Operations:**
- Patient record create/view/edit/delete
- Appointment scheduling/modifications/cancellations
- Medical record access and changes
- Prescription create/edit/delete
- Diagnosis documentation
- Lab order creation and results viewing
- Claims submission and updates
- Any data modification

**Administrative Actions:**
- Permission changes
- System settings modifications
- User role assignments
- Backup/restore operations
- Archive operations
- System configuration changes

**Security Events:**
- Failed authentication attempts
- Account lockouts
- Permission denied attempts
- Suspicious activity
- IP address changes
- Session timeouts

**Each Audit Log Entry Contains:**

- **Timestamp** - Exact date and time (with timezone)
- **User** - Who performed the action (name, email, ID)
- **Action Type** - What was done (Create, Read, Update, Delete, Login, etc.)
- **Entity Type** - What was affected (Patient, Appointment, User, etc.)
- **Entity ID** - Specific record ID
- **IP Address** - Where action originated
- **User Agent** - Browser/device information
- **Changes** - Before/after values for updates (JSON format)
- **Status** - Success or Failure
- **Error Message** - If action failed

**Viewing Audit Logs:**

**Main Log Table:**
1. Navigate to **Admin Panel** > **Audit Logs**
2. View chronological list of all actions
3. Most recent actions appear first
4. Paginated view (50 records per page)

**Log Details:**
- Click on any log entry to see full details
- View complete change history
- See before/after values for updates
- View related logs (all actions on same entity)

**Filtering Audit Logs:**

Filter logs by multiple criteria:

**By Date Range:**
- Today
- Last 7 days
- Last 30 days
- Last 90 days
- Custom date range

**By User:**
- Select from dropdown of all users
- See all actions by specific user
- Track individual user activity

**By Action Type:**
- Create
- Read/View
- Update/Edit
- Delete
- Login
- Logout
- Failed Login
- Permission Change
- Export

**By Entity Type:**
- Patients
- Appointments
- Providers
- Medical Records
- Prescriptions
- Diagnoses
- Lab Orders
- Claims
- Users
- Roles
- Settings

**By Status:**
- Success
- Failed
- Error

**Combined Filters:**
Example: "Show all failed login attempts by any user in last 7 days"
- Date Range: Last 7 days
- Action Type: Failed Login
- Status: Failed

**Searching Audit Logs:**

Use search box to find specific logs:
- Search by user name or email
- Search by entity ID
- Search by IP address
- Search in change details
- Full-text search across all fields

**Exporting Audit Logs:**

**For Compliance Reporting:**

1. Filter logs as needed
2. Click **Export** button
3. Choose format:
   - **CSV** - For Excel/spreadsheet analysis
   - **PDF** - For printing/documentation
   - **JSON** - For programmatic access
4. Download file
5. File includes all filtered logs with full details

**Use Cases:**

**Compliance Audit:**
- Export all patient record access for HIPAA audit
- Show who viewed specific patient records
- Document all prescription modifications

**Security Investigation:**
- Track failed login attempts
- Identify suspicious access patterns
- Investigate unauthorized access attempts

**Troubleshooting:**
- See what changed before an error occurred
- Track down who made specific changes
- Understand sequence of events

**User Activity Monitoring:**
- Review actions by specific user
- Verify training effectiveness
- Identify unusual patterns

**Audit Log Examples:**

**Example 1 - Patient Record Update:**
```
Timestamp: 2026-01-30 10:15:23 EST
User: Dr. Sarah Johnson (sarah.johnson@clinic.com)
Action: Update
Entity Type: Patient
Entity ID: PAT-12345
IP Address: 192.168.1.100
Status: Success
Changes:
  - Phone: "555-1234" → "555-5678"
  - Address: "123 Old St" → "456 New Ave"
```

**Example 2 - Failed Login:**
```
Timestamp: 2026-01-30 08:30:15 EST
User: john.doe@clinic.com
Action: Failed Login
IP Address: 203.0.113.42
Status: Failed
Error: Invalid password
```

**Example 3 - Prescription Created:**
```
Timestamp: 2026-01-30 14:22:10 EST
User: Dr. Michael Chen (michael.chen@clinic.com)
Action: Create
Entity Type: Prescription
Entity ID: RX-98765
Patient: Jane Smith (MRN: 12345)
Details:
  - Medication: Lisinopril 10mg
  - Quantity: 30 tablets
  - Refills: 3
Status: Success
```

**Audit Log Retention:**

- **Active Database:** Logs kept for 1 year
- **Archive Database:** Logs archived after 1 year (kept for 7 years total)
- **Total Retention:** 7 years (recommended for HIPAA compliance)
- **Automatic Archiving:** Runs monthly via archiving rules

**Permissions:**

**View Audit Logs:**
- Admin role (full access)
- Audit role (read-only access)

**Export Audit Logs:**
- Admin role only
- Audit role only

**Regular users cannot:**
- View audit logs
- Export audit logs
- Delete audit logs
- Modify audit logs

⚠️ **Important:** Audit logs are immutable - they cannot be edited or deleted, ensuring integrity of the audit trail.

**Performance:**

- Logging has minimal performance impact (< 5ms per action)
- Asynchronous logging (doesn't slow down user actions)
- Indexed for fast searching and filtering
- Optimized database queries
- Automatic cleanup of very old logs (>7 years)

**Best Practices:**

✅ Review audit logs regularly (weekly minimum)
✅ Set up alerts for suspicious activity
✅ Export and backup audit logs monthly
✅ Include audit logs in compliance documentation
✅ Train staff on audit trail importance
✅ Investigate all failed login attempts
✅ Document audit review process
✅ Use audit logs for user training
✅ Keep exported logs securely
✅ Follow retention policies strictly

**Troubleshooting Audit Logging:**

**If audit logs aren't appearing:**
1. Check that audit_logs table exists (migration may be needed)
2. Verify database permissions
3. Check system monitoring for errors
4. Contact support if issue persists

**If exports are failing:**
1. Check file permissions
2. Verify sufficient disk space
3. Try smaller date range
4. Check browser download settings

### 19.8 Backup & Restore

**🆕 UPDATED IN V1.2:** Now with OAuth integration for Google Drive and OneDrive!

**Automatic Backups:**

- Daily automatic backups at 2:00 AM
- Incremental backups (only changes since last backup)
- Full backup weekly (Sunday 2:00 AM)
- Retention: 30 daily backups, 12 weekly backups, 12 monthly backups

**Backup Destinations:**

**Local Storage:**
- Stored on backup server
- Encrypted at rest
- Redundant storage (RAID)

**Cloud Storage with OAuth:**

**Google Drive Integration:**
1. Go to **Admin Panel** > **Backup & Restore**
2. Click **Configure Google Drive**
3. Click **Connect to Google Drive**
4. Sign in with Google account (OAuth)
5. Authorize AureonCare to access Google Drive
6. Select backup folder
7. Configure backup schedule
8. Click **Save Configuration**

**OneDrive Integration:**
1. Go to **Admin Panel** > **Backup & Restore**
2. Click **Configure OneDrive**
3. Click **Connect to OneDrive**
4. Sign in with Microsoft account (OAuth)
5. Authorize AureonCare to access OneDrive
6. Select backup folder
7. Configure backup schedule
8. Click **Save Configuration**

**Reconfiguring Cloud Providers:**
1. Go to **Backup & Restore** tab
2. Find configured provider (Google Drive or OneDrive)
3. Click **Reconfigure** button
4. Re-authenticate with OAuth
5. Update settings as needed
6. Click **Save**

**Manual Backup:**

1. Go to **Admin Panel** > **Backup & Restore**
2. Click **Create Backup Now**
3. Select backup type:
   - **Full Backup** - Complete database
   - **Partial Backup** - Selected modules only
4. Choose destination (Local, Google Drive, OneDrive)
5. Click **Start Backup**
6. Monitor progress
7. Receive confirmation when complete

**Backup Monitoring:**

**Backup Status:**
- Last backup date/time
- Backup size
- Success/failure status
- Next scheduled backup

**Backup Verification:**
- Automatic integrity checks
- Verification after each backup
- Alert if backup fails verification

**Restoring from Backup:**

⚠️ **Warning:** Restore operations will overwrite current data. Always create a backup before restoring!

**Full Restore:**
1. Go to **Backup & Restore**
2. View list of available backups
3. Select backup to restore
4. Click **Restore**
5. Confirm action (requires admin password)
6. System performs restore (may take several minutes)
7. Users are logged out during restore
8. System restarts automatically
9. Verify data after restore

**Partial Restore:**
1. Select backup
2. Choose **Partial Restore**
3. Select specific modules to restore
4. Confirm action
5. Monitor progress

**Backup Best Practices:**

✅ Verify backups weekly
✅ Test restore process monthly
✅ Keep backups in multiple locations
✅ Use cloud storage for offsite backup
✅ Monitor backup logs for failures
✅ Document restore procedures
✅ Maintain backup retention policy
✅ Encrypt all backups
✅ Restrict backup access to admins only
✅ Include audit logs in backups

---

## 20. Settings & Preferences

### 20.1 User Profile Settings

**Accessing Your Profile:**

1. Click on **Your Name/Avatar** in top-right corner
2. Select **My Profile**
3. View and edit your information:

**Personal Information:**
- Name
- Email
- Phone number
- Upload profile picture

**Professional Information:**
- License number
- Specialty
- Credentials
- Bio

**Preferences:**
- Language
- Time zone
- Date format
- Time format

4. Click **Save Profile**

### 20.2 Password Management

**Changing Your Password:**

1. Go to **My Profile** > **Security**
2. Click **Change Password**
3. Enter current password
4. Enter new password
5. Confirm new password
6. Click **Update Password**

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### 20.3 Theme Settings

**Changing Theme:**

1. Click **Theme Toggle** icon (sun/moon)
2. Select:
   - **Light Mode** - Light background
   - **Dark Mode** - Dark background
3. Setting saves automatically

💡 **Tip:** Dark mode reduces eye strain in low-light environments.

### 20.4 Language Settings

**Changing Interface Language:**

1. Click **Language** dropdown in top menu
2. Select from available languages:
   - English (EN)
   - Spanish (ES)
   - French (FR)
   - German (DE)
   - Portuguese (PT)
   - Chinese (ZH)
   - Arabic (AR)
   - Hindi (HI)
3. Interface updates immediately

### 20.5 Notification Preferences

**Configuring Notifications:**

1. Go to **Settings** > **Notifications**
2. For each notification type, toggle:
   - ✅ Email notifications
   - ✅ SMS notifications (if configured)
   - ✅ In-app notifications
3. Set notification frequency:
   - Immediately
   - Daily digest
   - Off
4. Click **Save Preferences**

### 20.6 Privacy Settings

**Managing Privacy:**

1. Go to **Settings** > **Privacy**
2. Configure settings:
   - Profile visibility
   - Activity sharing
   - Data export
   - Account deletion request

---

## 21. Troubleshooting & FAQs

### 21.1 Login Issues

**Q: I forgot my password. What should I do?**

A: Click "Forgot Password" on the login screen, enter your email, and follow the reset instructions sent to your email. The reset link is valid for 1 hour.

**Q: I'm not receiving the password reset email.**

A:
- Check your spam/junk folder
- Verify you're using the correct email address
- Wait a few minutes for email delivery
- Contact your administrator if issue persists

**Q: My account is locked. How do I unlock it?**

A: After multiple failed login attempts, accounts are temporarily locked for security. Wait 30 minutes or contact your administrator to unlock immediately.

### 21.2 Appointment Issues

**Q: I can't find available appointment slots.**

A:
- Try selecting a different provider
- Expand your date range
- Check if provider is on time-off
- Consider joining the waitlist

**Q: How do I reschedule an appointment?**

A: Click on the appointment, select "Reschedule," choose a new date/time, and confirm. Both patient and provider receive notification of the change.

**Q: What happens if I'm late to my appointment?**

A: Contact the clinic immediately. Depending on how late, the appointment may need to be rescheduled.

**Q: Can I book appointments for family members?**

A: Each patient needs their own account. Contact the front desk to set up accounts for family members.

### 21.3 Patient Portal Issues

**Q: I can't access the patient portal.**

A:
- Verify you're using the correct URL
- Clear browser cache and cookies
- Try a different browser
- Ensure patient portal is enabled for your account (contact clinic)

**Q: My test results aren't showing up.**

A: Results are released by providers after review. If you were told results are ready but don't see them, contact the clinic.

**Q: How do I request prescription refills?**

A: Go to "My Prescriptions," find the medication, and click "Request Refill." Your provider will review and approve/deny the request.

### 21.4 Telehealth Issues

**Q: My video isn't working during telehealth.**

A:
- Check camera permissions in browser
- Ensure camera isn't being used by another app
- Try refreshing the page
- Use Chrome browser (recommended)

**Q: I can't hear the provider.**

A:
- Check your speaker volume
- Check browser audio permissions
- Ensure correct audio output device selected
- Try using headphones

**Q: The video quality is poor.**

A:
- Check your internet connection (minimum 5 Mbps)
- Close other apps using bandwidth
- Turn off video temporarily (audio-only)
- Move closer to WiFi router

**Q: I was disconnected from the telehealth session.**

A: Click "Join Session" again to rejoin. If problems persist, call the clinic.

### 21.5 Technical Issues

**Q: The system is running slowly.**

A:
- Clear browser cache
- Close unused browser tabs
- Check internet connection
- Try logging out and back in

**Q: I'm seeing an error message.**

A:
- Note the error message
- Try refreshing the page
- Log out and log back in
- Contact support with error details

**Q: My uploaded file won't save.**

A:
- Check file size (maximum 10MB)
- Verify file format is supported
- Ensure stable internet connection
- Try uploading again

### 21.6 Data & Privacy

**Q: How is my data protected?**

A: AureonCare uses encryption, secure authentication, role-based access control, and follows HIPAA compliance standards to protect your health information.

**Q: Who can see my medical records?**

A: Only authorized healthcare providers involved in your care and administrative staff with appropriate permissions can access your records.

**Q: Can I delete my account?**

A: Contact your clinic administrator. Medical records must be retained according to legal requirements, but portal access can be disabled.

**Q: How do I export my health data?**

A: Request a data export from your provider. You can receive records in PDF or FHIR format.

### 21.7 Billing Questions

**Q: Where can I see my bill?**

A: Go to the Patient Portal > Billing section, or contact the billing department.

**Q: My insurance information is wrong.**

A: Contact the front desk to update your insurance information in the system.

**Q: I was charged incorrectly.**

A: Contact the billing department immediately. They can review the claim and make corrections if needed.

**Q: What payment methods are accepted?**

A: Credit card, debit card, cash, check, bank transfer, and insurance (varies by clinic).

### 21.8 Getting Help

**🆕 In-App Help System (NEW IN V1.2):**

**Help Drawer:**
1. Click the **Help icon** (?) in the top header
2. Browse articles by category or search for specific topics
3. Use AI Assistant for interactive help and answers
4. Access comprehensive documentation guides
5. Get contextual help based on your current module

**Documentation Website:**
- Navigate to `/docs` (e.g., `http://localhost:3001/docs`)
- No login required - publicly accessible
- 9 comprehensive guides covering all major features
- Step-by-step instructions with tables and best practices
- Professional styling matching AureonCare theme

**AI Assistant:**
- Ask questions in natural language
- Get instant answers with relevant documentation links
- Context-aware based on current module
- View related articles and guides
- Available 24/7 within the application

**Comprehensive Guides Available:**
- Clinical Notes & SOAP documentation (`/docs/guides/clinical-notes.html`)
- Vital Signs management (`/docs/guides/vitals.html`)
- Telehealth consultations (`/docs/guides/telehealth.html`)
- Claims management (`/docs/guides/claims.html`)
- Payment processing (`/docs/guides/payments.html`)
- Reports & analytics (`/docs/guides/reports.html`)
- User management (`/docs/guides/user-management.html`)
- Practice settings (`/docs/guides/practice-settings.html`)
- Troubleshooting (`/docs/troubleshooting/common-issues.html`)

See **Section 2.7 Help & Documentation System** for complete details on using the help system.

**Technical Support:**

If you need additional assistance beyond the help system:

- Email: support@aureoncare.com
- Phone: [Clinic phone number]
- Live chat: Available during business hours
- Support ticket system via Administration > Support

**For Medical Questions:**
- Contact your provider directly
- Use patient portal messaging (non-urgent)
- Call clinic for urgent issues
- Go to ER for emergencies

**Business Hours:**
- [Insert clinic hours]

⚠️ **For Medical Emergencies:** Call 911 or go to the nearest emergency room. Do not use AureonCare for emergencies.

**When Contacting Support:**

Provide the following information to get faster help:

- Your name and role
- Description of the issue
- Steps you took before the problem occurred
- Error messages (take a screenshot if possible)
- Browser and operating system you're using
- Module/feature you were working with
- Date and time the issue occurred

---

## 22. Best Practices

### 22.1 For All Users

**Security Best Practices:**
- ✅ Use strong, unique passwords
- ✅ Never share login credentials
- ✅ Log out when finished, especially on shared computers
- ✅ Keep contact information up to date
- ✅ Report suspicious activity immediately
- ❌ Don't write down passwords
- ❌ Don't access from public WiFi without VPN
- ❌ Don't leave computer unattended while logged in

**Data Entry Best Practices:**
- ✅ Enter complete, accurate information
- ✅ Double-check patient identifiers
- ✅ Document promptly after encounters
- ✅ Use standard abbreviations
- ✅ Spell-check clinical notes
- ❌ Don't use non-standard abbreviations
- ❌ Don't copy-paste without reviewing
- ❌ Don't leave required fields blank

### 22.2 For Providers

**Clinical Documentation:**
- Document patient encounters same day
- Review and sign all clinical notes
- Check drug interactions before prescribing
- Document allergy checks
- Review previous visits before appointments
- Use templates for efficiency but customize appropriately
- Include assessment and plan in all notes

**Prescription Safety:**
- Always check patient allergies
- Review current medications
- Check for drug interactions
- Verify dosage and frequency
- Include clear patient instructions
- Document indication for prescription
- Review patient's renal/hepatic function when applicable

**Telehealth Best Practices:**
- Test equipment before sessions
- Ensure private, quiet location
- Review patient chart before session
- Document session thoroughly
- Provide clear follow-up instructions
- Obtain consent for recording

### 22.3 For Receptionists

**Patient Registration:**
- Verify patient identity
- Collect complete demographic information
- Verify insurance information with card
- Get photo ID copy
- Enable patient portal for all patients
- Explain portal benefits

**Appointment Scheduling:**
- Confirm patient contact information
- Schedule appropriate appointment type
- Allow adequate time for appointment type
- Check for scheduling conflicts
- Send appointment confirmation
- Document reason for visit

**Check-In Process:**
- Update demographics if changed
- Verify insurance is current
- Collect copayments
- Update vital signs if applicable
- Notify provider of patient arrival

### 22.4 For Billing Staff

**Claims Management:**
- Submit claims promptly (within 24-48 hours)
- Verify all required fields completed
- Use correct diagnosis and procedure codes
- Link appropriate diagnoses to procedures
- Track claim status regularly
- Follow up on pending claims
- Address denials within 30 days

**Payment Processing:**
- Post payments daily
- Reconcile payments with claims
- Issue receipts promptly
- Document payment method accurately
- Follow up on outstanding balances
- Maintain accurate patient ledgers

**Denial Management:**
- Review denials immediately
- Categorize denial reasons
- Correct and resubmit quickly
- Appeal inappropriate denials
- Track denial trends
- Implement process improvements

### 22.5 For Administrators

**User Management:**
- Follow principle of least privilege
- Assign appropriate roles
- Review user access regularly
- Disable accounts for terminated employees immediately
- Conduct regular security training
- Monitor audit logs

**System Maintenance:**
- Perform regular backups
- Test backup restoration
- Monitor system performance
- Update software regularly
- Review security settings
- Plan for disaster recovery

**Compliance:**
- Conduct regular HIPAA compliance reviews
- Maintain business associate agreements
- Document policies and procedures
- Train staff on privacy and security
- Respond to security incidents promptly
- Maintain breach notification procedures

### 22.6 For Patients

**Using Patient Portal:**
- Check portal regularly for messages
- Keep contact information current
- Request refills before running out
- Review test results when released
- Ask questions through messaging (non-urgent)
- Update health information

**Appointment Management:**
- Arrive 15 minutes early for in-person appointments
- Join telehealth sessions on time
- Cancel/reschedule with 24-hour notice
- Bring insurance card and ID
- Prepare questions in advance
- Follow provider instructions

**Communication:**
- Use secure messaging, not email
- Provide detailed information in messages
- Respond to clinic messages promptly
- Call for urgent issues
- Go to ER for emergencies

---

## 23. Glossary

**A**

**Authorization (Prior Authorization):** Approval from insurance company required before certain services or medications are covered.

**B**

**BMI (Body Mass Index):** A measure of body fat based on height and weight.

**C**

**Claim:** A request for payment submitted to insurance company for healthcare services provided.

**Copay (Copayment):** Fixed amount patient pays for healthcare service, with insurance covering the rest.

**CPT Code:** Current Procedural Terminology code used to identify medical procedures and services.

**CRM (Customer Relationship Management):** System for managing patient interactions and relationships.

**D**

**Deductible:** Amount patient must pay before insurance begins to pay.

**Denial:** Insurance company's refusal to pay a claim.

**Diagnosis:** Identification of a disease or condition.

**E**

**EHR (Electronic Health Record):** Digital version of patient's medical chart.

**E-Prescribing:** Electronic transmission of prescription to pharmacy.

**F**

**FHIR (Fast Healthcare Interoperability Resources):** Standard for exchanging healthcare information electronically.

**G**

**H**

**HL7:** Health Level 7 - Standards for healthcare data exchange.

**HIPAA:** Health Insurance Portability and Accountability Act - U.S. law protecting patient privacy.

**I**

**ICD Code:** International Classification of Diseases code used to identify diagnoses.

**Insurance Payer:** Insurance company that pays claims.

**J**

**K**

**L**

**M**

**MRN (Medical Record Number):** Unique identifier assigned to each patient.

**N**

**NPI (National Provider Identifier):** Unique identification number for healthcare providers.

**No-Show:** When patient doesn't arrive for scheduled appointment without cancelling.

**O**

**P**

**Patient Portal:** Secure online website where patients access health information.

**Prior Authorization:** See Authorization.

**Provider:** Healthcare professional (doctor, nurse practitioner, etc.) providing care.

**Q**

**R**

**RBAC (Role-Based Access Control):** Security system that restricts access based on user roles.

**RCM (Revenue Cycle Management):** Process of managing claims, payments, and revenue.

**Refill:** Renewal of prescription for additional supply of medication.

**S**

**STAT:** Medical term meaning immediately/urgently.

**T**

**Telehealth:** Healthcare services provided via video consultation.

**U**

**V**

**Vital Signs:** Clinical measurements including blood pressure, heart rate, temperature, respiratory rate, and oxygen saturation.

**W**

**Waitlist:** List of patients waiting for appointment when no slots available.

**X**

**Y**

**Z**

---

## 24. Form Management

**🆕 NEW IN V1.3** — Found under **Patients → Forms**

Form Management lets you build custom forms, assign them to patients, and track every submission with a full audit trail.

### 24.1 Form Templates

**Creating a Template:**

1. Go to **Patients → Form Templates**
2. Click **+ New Template**
3. Give the template a name, description, and category
4. Add fields from the builder:

| Field Type | Use For |
|------------|---------|
| Text / Text area | Free-text answers |
| Number | Numeric values |
| Date | Dates of birth, onset dates |
| Dropdown | Single choice from a list |
| Checkbox | Multiple selections |
| Radio | Single choice, all options visible |
| Signature | Patient or provider sign-off |
| File upload | Supporting documents |

5. Mark fields **Required** where an answer is mandatory
6. Click **Save Template**

**Template Library:**

AureonCare ships with starter templates for common intake scenarios — new patient registration, medical history, consent, and insurance details. Copy one and adapt it rather than starting from scratch.

**Versioning:**

Editing a published template creates a new version. Submissions stay attached to the version that was live when the patient completed the form, so historical records never change retroactively.

### 24.2 Default Intake Forms

Mark a template as a **default intake form** and it is assigned automatically when a new patient registers.

1. Open the template
2. Toggle **Assign on patient registration**
3. Save

The patient sees the form in their portal on first login. Staff see its status on the patient record.

### 24.3 Assigning Forms Manually

1. Open the patient's record
2. Go to the **Forms** tab
3. Click **Assign Form**
4. Choose the template and a due date
5. Click **Assign**

The patient is notified by email (and WhatsApp, if opted in) that a form is waiting.

### 24.4 Form Submissions

Go to **Patients → Form Submissions** to review completed forms.

**Submission Statuses:**

- 📋 **Assigned** — Sent to the patient, not started
- ✏️ **In Progress** — Patient has begun answering
- ✅ **Submitted** — Completed and awaiting review
- 👁️ **Reviewed** — A staff member has reviewed it
- ❌ **Declined** — Patient declined to complete

**Reviewing a Submission:**

1. Click the submission
2. Read the answers
3. Click **Mark Reviewed**, or **Request Changes** to send it back with a note

### 24.5 Form Audit Trail

**Patients → Form Audit** records every action taken on every form:

- Who created or edited a template, and when
- When a form was assigned and to whom
- Every save the patient made while completing it
- Who reviewed the submission
- Any changes requested

The audit trail is immutable and exportable for compliance reporting.

### 24.6 Best Practices

- ✅ Keep intake forms short — completion rates drop sharply past 20 fields
- ✅ Mark only genuinely mandatory fields as Required
- ✅ Use dropdowns instead of free text where you plan to report on the answers
- ✅ Review submissions within 24 hours of receipt
- ✅ Version templates rather than editing them in place mid-cycle
- ❌ Don't collect data you have no workflow for
- ❌ Don't duplicate fields the patient record already stores

---

## 25. Accounting

**🆕 NEW IN V1.3** — Found under **Operations → Accounting**

The Accounting module provides double-entry bookkeeping for the practice, linked to Revenue Cycle payments and Inventory purchase orders.

### 25.1 Accounting Overview

The overview dashboard shows:

- Cash position across all bank accounts
- Outstanding receivables and payables
- Revenue and expenses for the current period
- Unreconciled transaction count
- Period-over-period comparison

### 25.2 Chart of Accounts

The Chart of Accounts is the list of every account the practice books against.

**Account Types:**

| Type | Normal Balance | Examples |
|------|----------------|----------|
| **Asset** | Debit | Cash, Accounts Receivable, Equipment, Inventory |
| **Liability** | Credit | Accounts Payable, Loans, Accrued Expenses |
| **Equity** | Credit | Owner's Capital, Retained Earnings |
| **Revenue** | Credit | Patient Revenue, Insurance Revenue, Product Sales |
| **Expense** | Debit | Salaries, Rent, Supplies, Utilities |

**Adding an Account:**

1. Go to **Operations → Chart of Accounts**
2. Click **+ New Account**
3. Enter the account number, name, and type
4. Optionally nest it under a parent account
5. Click **Save**

💡 **Tip:** Number accounts in blocks — 1000s for assets, 2000s liabilities, 3000s equity, 4000s revenue, 5000s expenses. Reports group cleanly when you do.

### 25.3 Journal Entries

**Creating an Entry:**

1. Go to **Operations → Journal**
2. Click **+ New Journal Entry**
3. Set the entry date and a description
4. Add lines — each line takes an account, a debit or a credit, and an optional memo
5. Confirm total debits equal total credits
6. Click **Post Entry**

⚠️ **Warning:** An entry will not post unless debits and credits balance exactly.

**Automatic Entries:**

The system posts journal entries for you when:

- A patient or insurance payment is recorded in Revenue Cycle
- An invoice is issued
- A purchase order is received into Inventory
- A refund is processed

Automatic entries are marked with a system flag and link back to the source record.

### 25.4 Accounts Receivable

**Operations → Receivables** tracks money owed to the practice.

- Outstanding patient balances
- Outstanding insurance claims
- Aging buckets: current, 31–60, 61–90, 90+ days
- Drill through to the originating claim or invoice

Receivables reconcile against the A/R figures in Revenue Cycle reporting.

### 25.5 Accounts Payable

**Operations → Payables** tracks money the practice owes.

**Recording a Bill:**

1. Go to **Operations → Payables**
2. Click **+ New Bill**
3. Select the supplier
4. Enter the bill number, date, due date, and amount
5. Assign it to an expense account
6. Click **Save**

**Paying a Bill:**

1. Open the bill
2. Click **Record Payment**
3. Enter the amount, date, and payment method
4. Click **Save** — the journal entry posts automatically

Bills raised from Inventory purchase orders appear here automatically when stock is received.

### 25.6 Bank Reconciliation

1. Go to **Operations → Reconciliation**
2. Select the bank account and statement period
3. Enter the closing balance from your bank statement
4. Tick each transaction that appears on the statement
5. The difference must reach zero
6. Click **Complete Reconciliation**

✅ **Note:** Reconciled transactions lock. Reopen the reconciliation to amend them.

### 25.7 Financial Statements

**Operations → Statements** generates:

| Statement | Shows |
|-----------|-------|
| **Profit & Loss** | Revenue less expenses over a period |
| **Balance Sheet** | Assets, liabilities, and equity at a point in time |
| **Cash Flow** | Cash movement across operating, investing, financing |
| **Trial Balance** | All account balances, proving debits equal credits |
| **General Ledger** | Every transaction, by account |

All statements export to PDF, Excel, and CSV.

### 25.8 Best Practices

- ✅ Reconcile bank accounts monthly, without exception
- ✅ Review the trial balance before closing a period
- ✅ Post journal entries with descriptions a colleague would understand
- ✅ Match payables to purchase orders before paying
- ✅ Run P&L monthly and compare against the prior period
- ❌ Don't edit reconciled transactions without reopening the reconciliation
- ❌ Don't post to a suspense account and forget about it

---

## 26. Inventory Management

**🆕 NEW IN V1.3** — Found under **Operations → Inventory**

Track consumables, medications, and equipment — from purchase order through to consumption.

### 26.1 Inventory Overview

The overview shows:

- Total inventory value
- Items at or below reorder point
- Out-of-stock items
- Open purchase orders
- Recent stock movements
- Expiring stock (where expiry dates are tracked)

### 26.2 Items

**Adding an Item:**

1. Go to **Operations → Items**
2. Click **+ New Item**
3. Enter the item details:

| Field | Description |
|-------|-------------|
| **Item Name** | What the item is called (required) |
| **SKU / Code** | Your internal identifier |
| **Category** | Groups the item for reporting |
| **Unit of Measure** | Each, box, vial, ml, etc. |
| **Unit Cost** | What you pay per unit |
| **Reorder Point** | Stock level that triggers a low-stock alert |
| **Reorder Quantity** | How much to order when restocking |
| **Preferred Supplier** | Default supplier for purchase orders |
| **Track Expiry** | Whether the item carries expiry dates |
| **Storage Location** | Where it is kept |

4. Click **Save Item**

### 26.3 Stock Levels

**Operations → Stock** shows current quantity on hand for every item.

**Recording a Stock Movement:**

1. Go to **Operations → Stock**
2. Find the item
3. Click **Adjust Stock**
4. Choose the movement type:

| Type | Effect | Used When |
|------|--------|-----------|
| **Receipt** | Increase | Stock arrives from a supplier |
| **Consumption** | Decrease | Item used during patient care |
| **Adjustment** | Either | Correcting a count discrepancy |
| **Transfer** | Moves | Shifting stock between locations |
| **Write-off** | Decrease | Damaged, expired, or lost stock |

5. Enter the quantity and a reason
6. Click **Save**

Every movement is timestamped and attributed to the user who recorded it.

**Low-Stock Alerts:**

When stock falls to the reorder point, the system raises a notification to inventory managers by email and WhatsApp. The item is flagged on the overview until stock is replenished.

### 26.4 Purchase Orders

**Raising a Purchase Order:**

1. Go to **Operations → Purchase Orders**
2. Click **+ New Purchase Order**
3. Select the supplier
4. Add line items — item, quantity, and unit cost
5. Review the order total
6. Click **Submit Order**

**Purchase Order Statuses:**

- 📝 **Draft** — Being prepared, not yet sent
- 📤 **Submitted** — Sent to the supplier
- ✅ **Confirmed** — Supplier acknowledged
- 📦 **Partially Received** — Some lines delivered
- ✔️ **Received** — All lines delivered
- ❌ **Cancelled** — Order withdrawn

**Receiving Stock:**

1. Open the purchase order
2. Click **Receive Stock**
3. Enter the quantity received per line — partial receipts are supported
4. Record batch numbers and expiry dates where the item tracks them
5. Click **Confirm Receipt**

Stock levels increase, and a bill is raised in Accounts Payable automatically.

### 26.5 Suppliers

**Operations → Suppliers** holds your vendor list.

**Supplier Record:**
- Supplier name and account number
- Contact person, phone, email
- Address and delivery terms
- Payment terms (e.g. Net 30)
- Items typically supplied
- Notes

Supplier performance — order volume, on-time delivery, average lead time — is visible on the supplier record.

### 26.6 Categories

**Operations → Categories** groups items for reporting and reorder policy. Categories can nest, for example *Consumables → Wound Care → Dressings*.

### 26.7 Best Practices

- ✅ Set realistic reorder points based on actual usage, not guesswork
- ✅ Count physical stock quarterly and reconcile against the system
- ✅ Record consumption at the point of use, not at the end of the week
- ✅ Review expiring stock monthly
- ✅ Match delivery notes against purchase orders before confirming receipt
- ❌ Don't let write-offs accumulate unexplained
- ❌ Don't order outside the purchase order system — the audit trail breaks

---

## 27. Subscription Plans & Licensing

**🆕 NEW IN V1.3** — Found under **Settings → Plans**

### 27.1 How Access is Determined

A module appears for a user only when **both** conditions hold:

1. The module is included in the practice's **subscription tier**
2. The user's **role** permits access to it

If either check fails, the module does not appear in the navigation.

### 27.2 Subscription Tiers

| Module | Practice Essentials | Clinical Pro | Enterprise | On-Premises |
|--------|:---:|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Practice Management | ✅ | ✅ | ✅ | ✅ |
| Provider Management | ✅ | ✅ | ✅ | ✅ |
| EHR | ✅ | ✅ | ✅ | ✅ |
| Patient Portal | ✅ | ✅ | ✅ | ✅ |
| Clinical Services | ✅ | ✅ | ✅ | ✅ |
| Reports | ✅ | ✅ | ✅ | ✅ |
| Form Management | ✅ | ✅ | ✅ | ✅ |
| Accounting | ✅ | ✅ | ✅ | ✅ |
| Inventory | ✅ | ✅ | ✅ | ✅ |
| Administration | ✅ | ✅ | ✅ | ✅ |
| Telehealth | — | ✅ | ✅ | ✅ |
| Revenue Cycle (RCM) | — | ✅ | ✅ | ✅ |
| CRM | — | ✅ | ✅ | ✅ |
| Healthcare Offerings | — | ✅ | ✅ | ✅ |
| Integrations | — | — | ✅ | ✅ |

**Tier Summary:**

- **Practice Essentials** — Core clinical and operational tools for a single practice
- **Clinical Pro** — Adds telehealth, revenue cycle, CRM, and offerings
- **Enterprise** — Adds third-party integrations
- **On-Premises / Customer Cloud** — Enterprise feature set, deployed on infrastructure you control

### 27.3 Viewing Your Plan

1. Go to **Settings → Plans**
2. The current tier, seat limits, and renewal date are shown
3. Usage against each limit is displayed alongside

**Seat Limits:**
- Maximum providers
- Maximum users
- Maximum patient records

⚠️ **Warning:** Reaching a seat limit blocks new records of that type until seats are freed or the plan is upgraded.

### 27.4 Changing Your Plan

1. Go to **Settings → Plans**
2. Click **Change Plan**
3. Select the new tier
4. Review what is gained or lost
5. Confirm

Upgrades take effect immediately. Downgrades take effect at the end of the current billing period, and modules dropped by the new tier become unavailable at that point — the data is retained.

### 27.5 License Keys (On-Premises)

On-premises and customer-cloud deployments are activated with a license key.

**Activating a License:**

1. Go to **Settings → Plans → License**
2. Paste the license key
3. Click **Activate**
4. The tier, seat limits, and validity period are applied

**License Properties:**
- Plan tier
- Maximum providers, users, and patients
- Valid-from and valid-until dates
- Activation status

**Validity:**

The system checks the license on startup and periodically thereafter. An expired license restricts the platform to read-only access until renewed — no data is deleted.

Administrators can generate, activate, and revoke license keys from the same screen where the deployment permits it.

### 27.6 Deployment Options

| Deployment | Description |
|------------|-------------|
| **AureonCare Cloud** | Fully managed, hosted by AureonCare |
| **Customer Cloud** | Deployed into your own cloud account via Docker or Helm |
| **On-Premises** | Deployed on your own servers, license-key activated |

Self-hosted deployments ship with Docker images, Helm charts, CI/CD pipeline templates, and an update agent that applies releases on a schedule you control.

---

## Appendix A: Keyboard Shortcuts

**Global Shortcuts:**
- `Ctrl + /` - Open search
- `Ctrl + K` - Quick navigation
- `Esc` - Close modal/panel
- `Ctrl + S` - Save (when in edit mode)

**Navigation:**
- `Ctrl + 1` - Go to Dashboard
- `Ctrl + 2` - Go to Patients
- `Ctrl + 3` - Go to Appointments
- `Ctrl + 4` - Go to EHR
- `Ctrl + N` - Create new record (context-dependent)

---

## Appendix B: Contact Information

**AureonCare Support:**
- Email: support@aureoncare.com
- Website: https://aureoncare.com
- Documentation: https://docs.aureoncare.com

**Emergency Support:**
- For medical emergencies: Call 911
- For urgent clinic matters: [Insert clinic phone]

**Technical Support Hours:**
- Monday - Friday: 8 AM - 6 PM
- Saturday: 9 AM - 5 PM
- Sunday: Closed

---

## Appendix C: System Limits

**File Uploads:**
- Maximum file size: 10 MB per file
- Supported formats: PDF, JPG, PNG, DOCX, XLSX
- Maximum files per record: 20

**Data Limits:**
- Patient records: Per subscription plan
- Users: Per subscription plan
- Appointments per day: Unlimited
- Prescriptions per patient: Unlimited
- Medical records per patient: Unlimited

**Session Limits:**
- Session timeout: 4 hours of inactivity
- Patient portal session: 24 hours
- Maximum concurrent sessions per user: 3

---

## Document Version History

**Version 1.3** - August 2026 - Major Update with:
- Three-pane application shell (workspace groups → modules → content)
- Accounting module: chart of accounts, journal, receivables, payables, reconciliation, statements
- Inventory module: items, stock, purchase orders, suppliers, categories
- Form Management: templates, automated intake, submissions, audit trail
- Telehealth expanded to Zoom, Google Meet, Microsoft Teams, and Webex
- Per-patient telehealth platform preference
- Public booking links for patient self-scheduling
- Centralised email and WhatsApp notifications across all modules
- Stripe payment integration with webhook synchronisation
- Subscription tiers (Essentials, Clinical Pro, Enterprise, On-Premises) and license keys
- Rebuilt Reports module with a custom report builder
- Security hardening: JWT authentication, portal rate limiting and lockout, hashed session tokens
- Patient Portal as the patient Home workspace, with assigned forms and dated record uploads
- FHIR tracking and calendar sync restored
- Docker, Helm, and CI/CD deployment tooling

**Version 1.2** - January-February 2026 - Major Update with:
- Universal Search across all 14 modules
- Comprehensive Data Archiving System
- Complete Audit Logging for compliance
- Cloud Backup Integration (OAuth for Google Drive & OneDrive)
- SOAP Notes in Diagnosis Management
- Enhanced Patient Registration (Allergies, PMH, Family History)
- Expanded Roles & Permissions for all 14 modules
- User Management improvements (Language selection, inline forms)
- Themed Modals and Confirmations
- **Comprehensive Help & Documentation System** with 9 detailed guides
- In-app Help Drawer with Browse, Search, and AI Assistant tabs
- Publicly accessible documentation website
- Context-aware AI-powered help assistant

**Version 1.1** - December 2025 - Updated with:
- Waitlist management integration into Practice Management
- Advanced lab order system with CPT multiselect
- Enhanced ePrescribe modal with edit mode
- Diagnosis-prescription linking
- Modern UI improvements (toggle switches)
- Enhanced pharmacy and laboratory management

**Version 1.0** - December 2025 - Initial Release

---

**END OF USER MANUAL**

---

*This manual is subject to updates. Please check for the latest version regularly.*

*AureonCare - Empowering Healthcare Practices with Modern Technology*
