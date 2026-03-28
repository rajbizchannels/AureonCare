 AureonCare – Zoom App Release Notes

Version: 1.0.0 | Date: March 15, 2026 | Category: Healthcare / Telehealth

 What It Does
AureonCare is a HIPAA-ready Healthcare Practice Management System. The Zoom integration enables providers and patients to launch secure telehealth video consultations directly from the platform — no separate Zoom account required for patients.

 Zoom Integration
- Zoom Meeting SDK v5.1.2 embedded in the Telehealth module
- Meetings auto-created when a telehealth appointment is scheduled
- Secure join links delivered to patients via in-app notifications
- Cloud recording support (provider-initiated, consent-gated)
- OAuth 2.0 for provider account linking

Scopes: `meeting:write`, `meeting:read`, `recording:read`, `user:read`

Test Flow: Log in as Provider → Telehealth → open appointment → click "Start Video Consultation". In a separate session, log in as Patient → Patient Portal → click "Join Telehealth Visit".

 Privacy & Compliance
- HIPAA-compliant architecture; no patient data sold or shared
- Meeting metadata stored in AureonCare's encrypted database
- Users can revoke Zoom OAuth access at any time

 Support
Email: info@aureoncare.tech
Privacy Policy: https://aureoncare.tech/privacy-policy
Terms of Service: https://aureoncare.tech/terms-of-service
Documentation: https://aureoncare.tech/docs/guides/zoom-integration.html
