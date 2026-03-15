# AureonCare – Zoom App Release Notes

**App Name:** AureonCare
**Version:** 1.0.0
**Release Date:** March 15, 2026
**Submission Type:** New App – Marketplace Review
**Category:** Healthcare / Telehealth

---

## Overview

AureonCare is an enterprise-grade, HIPAA-ready Healthcare Practice Management System designed for medical practices, multi-specialty clinics, and telehealth providers. The Zoom integration enables providers and patients to conduct secure, scheduled video consultations directly from within the AureonCare platform — eliminating the need to switch between applications.

---

## What This App Does

AureonCare uses the **Zoom Meeting SDK (v5.1.2)** to embed and launch video consultations within the telehealth module of the platform. The integration allows:

- **Providers** (physicians, nurses, specialists) to start a Zoom meeting for a scheduled telehealth appointment with a single click.
- **Patients** to join their telehealth visit through the patient portal without needing a Zoom account.
- **Automatic meeting creation** tied to appointment records, eliminating manual meeting setup.
- **Session recording** (with patient consent) for clinical documentation purposes.
- **Secure meeting links** generated per appointment and delivered via notification to both provider and patient.

---

## Zoom SDK / API Usage

| Feature | Zoom Capability Used |
|---|---|
| Launch video consultation | Zoom Meeting SDK – embedded client |
| Create meetings for appointments | Zoom REST API – Create Meeting (`POST /users/{userId}/meetings`) |
| Fetch meeting details | Zoom REST API – Get Meeting (`GET /meetings/{meetingId}`) |
| Delete / cancel meetings | Zoom REST API – Delete Meeting (`DELETE /meetings/{meetingId}`) |
| Meeting join URL delivery | Zoom Meeting join URL embedded in appointment notifications |
| Session recording | Zoom Cloud Recording (opt-in, provider-initiated) |

**OAuth Scopes Requested:**
- `meeting:write` – to create and manage meetings on behalf of authenticated providers
- `meeting:read` – to retrieve meeting details for appointment records
- `recording:read` – to access cloud recordings when consent is provided
- `user:read` – to associate Zoom accounts with provider profiles

---

## Key Features of AureonCare

### Telehealth Module
- Schedule and launch Zoom-powered video visits from the appointment calendar
- Patients receive a secure join link via email/SMS notification
- No Zoom account required for patients
- Supports one-on-one and multi-participant consultations (e.g., care team + patient)
- Consultation notes can be added directly to the patient's EHR during or after the visit

### Appointment Management
- Smart scheduling with conflict detection across providers
- Calendar views (day, week, month)
- Automated appointment reminders with embedded Zoom join links

### Patient Portal
- Patients can see upcoming telehealth appointments and join via a single click
- No separate Zoom login needed — guests join through the Zoom SDK embedded experience

### Electronic Health Records (EHR) Integration
- Telehealth visit automatically linked to the patient's EHR record
- Prescriptions, diagnoses, and treatment plans can be issued post-consultation

### Security & Compliance
- HIPAA-ready architecture with end-to-end encryption
- All meeting data is handled in compliance with HIPAA Business Associate Agreement (BAA) requirements
- Role-based access control — only authorized providers can initiate meetings
- Audit logs capture all telehealth session events

---

## Data Handling & Privacy

- **No patient data is stored on Zoom servers** beyond what is inherent to the Zoom platform during a live session.
- Meeting metadata (meeting ID, join URL, duration) is stored in AureonCare's HIPAA-compliant PostgreSQL database.
- Cloud recordings (if enabled) are stored under the provider's Zoom account with access restricted to authorized clinical staff.
- AureonCare does not sell, share, or use patient data for advertising or analytics outside the clinical workflow.
- Users can revoke Zoom OAuth access at any time from their AureonCare account settings.

---

## Test Credentials for Reviewer

To test the Zoom integration during review, use the following sandbox credentials:

| Role | Email | Password |
|---|---|---|
| Provider (Admin) | `admin@aureoncare.com` | `Admin@123` |
| Provider (Physician) | `dr.smith@aureoncare.com` | `Doctor@123` |
| Patient | `patient@aureoncare.com` | `Patient@123` |

**Test Flow:**
1. Log in as Provider → navigate to **Telehealth** → create or open an appointment.
2. Click **"Start Video Consultation"** — this triggers the Zoom Meeting SDK to launch the session.
3. In a separate browser/session, log in as Patient → open **Patient Portal** → click **"Join Telehealth Visit"**.
4. Both parties connect via the embedded Zoom experience within AureonCare.

---

## Changes in This Release (v1.0.0)

This is the initial Zoom Marketplace submission. Features included:

- **Zoom Meeting SDK v5.1.2** embedded telehealth consultation experience
- OAuth 2.0 flow for provider Zoom account linking
- Automatic meeting creation on appointment scheduling
- Secure join link delivery via notification system
- Cloud recording support (provider-initiated, consent-gated)
- Meeting lifecycle management (create, update, cancel) synced with appointment records
- HIPAA-compliant data handling for all Zoom session metadata
- Full audit logging of telehealth session events
- Support for 8 languages in the telehealth UI (EN, ES, FR, DE, PT, ZH, AR, HI)
- Dark mode support in the embedded Zoom experience wrapper

---

## Support & Contact

**Developer:** AureonCare Team
**Support Email:** support@aureoncare.com
**Privacy Policy:** https://aureoncare.com/privacy
**Terms of Service:** https://aureoncare.com/terms
**Documentation:** https://aureoncare.com/docs/telehealth

---

*AureonCare is committed to delivering a secure, reliable, and compliant telehealth experience. We welcome any questions from the Zoom review team during the evaluation process.*
