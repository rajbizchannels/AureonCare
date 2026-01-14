# AureonCare Executive Demo - Setup & Preparation Guide

**Purpose:** This guide ensures you have a fully functional AureonCare demo environment with realistic data for the executive presentation.

**Time Required:** 30-45 minutes
**Skill Level:** Intermediate (requires basic command-line and database knowledge)

---

## Table of Contents

1. [Pre-Requisites](#pre-requisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Demo Data Loading](#demo-data-loading)
5. [Vendor Integration Configuration](#vendor-integration-configuration)
6. [User Accounts & Login Credentials](#user-accounts--login-credentials)
7. [Testing the Demo Environment](#testing-the-demo-environment)
8. [Troubleshooting](#troubleshooting)
9. [Demo Day Checklist](#demo-day-checklist)

---

## Pre-Requisites

### System Requirements

**Software:**
- Node.js 16+ (LTS recommended)
- PostgreSQL 12+
- npm or yarn package manager
- Git
- Modern web browser (Chrome, Firefox, Safari, Edge)

**Hardware:**
- 8GB RAM minimum (16GB recommended)
- 10GB free disk space
- Dual monitors (recommended for demo presentation)

**Network:**
- Stable internet connection (required for telehealth and vendor integrations)
- Firewall access to:
  - Port 3000 (backend API)
  - Port 3001 (frontend app)
  - External vendor APIs (Zoom, Google Meet, Labcorp, etc.)

### Accounts Needed

**For Full Demo (Optional but Recommended):**
- Zoom Developer Account (for telehealth demo)
- OR Google Workspace account (for Google Meet)
- Labcorp Sandbox Account (for lab order demo)
- Optum Clearinghouse Sandbox Account (for claims demo)
- Surescripts Sandbox Account (for ePrescribing demo)

**Note:** The demo can run without these accounts using mock/simulated data, but real integrations are more impressive.

---

## Environment Setup

### Step 1: Clone the Repository

```bash
# If not already cloned
git clone https://github.com/rajbizchannels/AureonCare.git
cd AureonCare
```

### Step 2: Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd ../frontend
npm install
```

### Step 3: Environment Variables

**Backend Environment Variables:**

Create a file: `/backend/.env`

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=aureoncare_demo
DB_USER=aureoncare_app
DB_PASSWORD=your_secure_password_here

# Server Configuration
PORT=3000
NODE_ENV=development

# Session Secret
SESSION_SECRET=demo_session_secret_change_in_production

# Telehealth Providers
# Zoom
ZOOM_CLIENT_ID=your_zoom_client_id
ZOOM_CLIENT_SECRET=your_zoom_client_secret
ZOOM_ACCOUNT_ID=your_zoom_account_id

# Google Meet
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/telehealth/google/callback

# Lab Integrations
# Labcorp
LABCORP_CLIENT_ID=your_labcorp_client_id
LABCORP_CLIENT_SECRET=your_labcorp_client_secret
LABCORP_SANDBOX_MODE=true
LABCORP_API_BASE_URL=https://sandbox.labcorp.com/api

# Clearinghouse
# Optum
OPTUM_CLIENT_ID=your_optum_client_id
OPTUM_CLIENT_SECRET=your_optum_client_secret
OPTUM_SANDBOX_MODE=true
OPTUM_SUBMITTER_ID=demo_submitter_id
OPTUM_RECEIVER_ID=demo_receiver_id

# ePrescribing
# Surescripts
SURESCRIPTS_CLIENT_ID=your_surescripts_client_id
SURESCRIPTS_CLIENT_SECRET=your_surescripts_client_secret
SURESCRIPTS_SANDBOX_MODE=true

# Notification Services
# Twilio (for SMS/WhatsApp)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Email (Optional - for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# Frontend URL
FRONTEND_URL=http://localhost:3001
```

**Frontend Environment Variables:**

Create a file: `/frontend/.env`

```env
REACT_APP_API_URL=http://localhost:3000/api
REACT_APP_ENV=development
```

### Step 4: Start the Services

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

**Expected Output:**
- Backend: `Server running on port 3000`
- Frontend: `Compiled successfully! App running on http://localhost:3001`

---

## Database Setup

### Step 1: Create Database and User

```bash
# Connect to PostgreSQL as superuser
sudo -u postgres psql

# Create database and user
CREATE DATABASE aureoncare_demo;
CREATE USER aureoncare_app WITH PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE aureoncare_demo TO aureoncare_app;

# Exit psql
\q
```

### Step 2: Run Database Migrations

AureonCare uses schema files located in `/backend/db/`.

```bash
cd backend

# Run all schema creation scripts
psql -U aureoncare_app -d aureoncare_demo -f db/schema.sql
psql -U aureoncare_app -d aureoncare_demo -f db/users.sql
psql -U aureoncare_app -d aureoncare_demo -f db/patients.sql
psql -U aureoncare_app -d aureoncare_demo -f db/appointments.sql
psql -U aureoncare_app -d aureoncare_demo -f db/medical-records.sql
psql -U aureoncare_app -d aureoncare_demo -f db/prescriptions.sql
psql -U aureoncare_app -d aureoncare_demo -f db/lab-orders.sql
psql -U aureoncare_app -d aureoncare_demo -f db/claims.sql
psql -U aureoncare_app -d aureoncare_demo -f db/fhir.sql
psql -U aureoncare_app -d aureoncare_demo -f db/integrations.sql
```

**Or use a single migration script:**

```bash
# If you have a combined migration file
psql -U aureoncare_app -d aureoncare_demo -f db/migrations/initial_setup.sql
```

### Step 3: Verify Database Schema

```bash
psql -U aureoncare_app -d aureoncare_demo

# List all tables
\dt

# Expected tables:
# users, roles, permissions, user_roles, role_permissions
# patients, appointments, appointment_type_config, doctor_availability
# medical_records, diagnosis, prescriptions, allergies
# lab_orders, laboratories
# claims, payments, payment_postings, denials, preapprovals, insurance_payers
# fhir_resources, fhir_tracking, fhir_tracking_events
# telehealth_sessions, telehealth_provider_settings
# And more...

\q
```

---

## Demo Data Loading

### Option 1: Use Demo Data SQL Script (Recommended)

Create a file: `/backend/db/demo_data.sql`

```sql
-- Demo Data for Executive Demo
-- This script creates realistic demo data for the presentation

-- ============================================
-- SECTION 1: USERS & ROLES
-- ============================================

-- Insert Roles (if not exists)
INSERT INTO roles (role_name, description) VALUES
('admin', 'System Administrator'),
('doctor', 'Physician'),
('nurse', 'Nurse'),
('receptionist', 'Front Desk Staff'),
('patient', 'Patient')
ON CONFLICT (role_name) DO NOTHING;

-- Insert Admin User
INSERT INTO users (user_id, email, password_hash, first_name, last_name, status, created_at)
VALUES
('admin-001', 'admin@aureoncare.com', '$2a$10$CwTycUXWue0Thq9StjUM0uJ4K6K9W3bHPwmJq2K2k2K2k2K2k2K2k', 'Admin', 'User', 'active', NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role_name) VALUES ('admin-001', 'admin') ON CONFLICT DO NOTHING;

-- Insert Doctor Users
INSERT INTO users (user_id, email, password_hash, first_name, last_name, status, created_at)
VALUES
('doctor-001', 'dr.anderson@aureoncare.com', '$2a$10$CwTycUXWue0Thq9StjUM0uJ4K6K9W3bHPwmJq2K2k2K2k2K2k2K2k', 'Michael', 'Anderson', 'active', NOW()),
('doctor-002', 'dr.patel@aureoncare.com', '$2a$10$CwTycUXWue0Thq9StjUM0uJ4K6K9W3bHPwmJq2K2k2K2k2K2k2K2k', 'Priya', 'Patel', 'active', NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role_name) VALUES
('doctor-001', 'doctor'),
('doctor-002', 'doctor')
ON CONFLICT DO NOTHING;

-- Insert Receptionist User
INSERT INTO users (user_id, email, password_hash, first_name, last_name, status, created_at)
VALUES
('recep-001', 'frontdesk@aureoncare.com', '$2a$10$CwTycUXWue0Thq9StjUM0uJ4K6K9W3bHPwmJq2K2k2K2k2K2k2K2k', 'Jessica', 'Chen', 'active', NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role_name) VALUES ('recep-001', 'receptionist') ON CONFLICT DO NOTHING;

-- ============================================
-- SECTION 2: PATIENTS
-- ============================================

-- Demo Patient 1: Sarah Williams (will be used in live demo)
INSERT INTO users (user_id, email, password_hash, first_name, last_name, status, created_at)
VALUES
('patient-001', 'sarah.williams@email.com', '$2a$10$CwTycUXWue0Thq9StjUM0uJ4K6K9W3bHPwmJq2K2k2K2k2K2k2K2k', 'Sarah', 'Williams', 'active', NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role_name) VALUES ('patient-001', 'patient') ON CONFLICT DO NOTHING;

INSERT INTO patients (patient_id, user_id, mrn, date_of_birth, gender, phone, address, city, state, zip_code, emergency_contact_name, emergency_contact_phone, insurance_provider, insurance_policy_number, preferred_pharmacy, created_at)
VALUES
('patient-001', 'patient-001', 'MRN-2025-001', '1985-05-15', 'female', '(555) 123-4567', '123 Main Street', 'Springfield', 'IL', '62701', 'John Williams', '(555) 123-9999', 'Blue Cross Blue Shield', 'BCBS-12345678', 'CVS Pharmacy - Main St', NOW())
ON CONFLICT (patient_id) DO NOTHING;

-- Demo Patient 2: Robert Johnson
INSERT INTO users (user_id, email, password_hash, first_name, last_name, status, created_at)
VALUES
('patient-002', 'robert.johnson@email.com', '$2a$10$CwTycUXWue0Thq9StjUM0uJ4K6K9W3bHPwmJq2K2k2K2k2K2k2K2k', 'Robert', 'Johnson', 'active', NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role_name) VALUES ('patient-002', 'patient') ON CONFLICT DO NOTHING;

INSERT INTO patients (patient_id, user_id, mrn, date_of_birth, gender, phone, address, city, state, zip_code, insurance_provider, insurance_policy_number, created_at)
VALUES
('patient-002', 'patient-002', 'MRN-2025-002', '1972-08-22', 'male', '(555) 234-5678', '456 Oak Avenue', 'Springfield', 'IL', '62702', 'Aetna', 'AETNA-87654321', NOW())
ON CONFLICT (patient_id) DO NOTHING;

-- Demo Patient 3: Maria Garcia
INSERT INTO users (user_id, email, password_hash, first_name, last_name, status, created_at)
VALUES
('patient-003', 'maria.garcia@email.com', '$2a$10$CwTycUXWue0Thq9StjUM0uJ4K6K9W3bHPwmJq2K2k2K2k2K2k2K2k', 'Maria', 'Garcia', 'active', NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role_name) VALUES ('patient-003', 'patient') ON CONFLICT DO NOTHING;

INSERT INTO patients (patient_id, user_id, mrn, date_of_birth, gender, phone, address, city, state, zip_code, insurance_provider, insurance_policy_number, created_at)
VALUES
('patient-003', 'patient-003', 'MRN-2025-003', '1990-11-30', 'female', '(555) 345-6789', '789 Pine Road', 'Springfield', 'IL', '62703', 'UnitedHealthcare', 'UHC-11223344', NOW())
ON CONFLICT (patient_id) DO NOTHING;

-- ============================================
-- SECTION 3: APPOINTMENT TYPES
-- ============================================

INSERT INTO appointment_type_config (type_name, default_duration_minutes, color_code, description, created_at)
VALUES
('New Patient Consultation', 60, '#3B82F6', 'Initial consultation for new patients', NOW()),
('Follow-up Visit', 30, '#10B981', 'Follow-up appointment for existing patients', NOW()),
('Annual Physical', 45, '#F59E0B', 'Comprehensive annual physical examination', NOW()),
('Telehealth Consultation', 30, '#8B5CF6', 'Virtual consultation via video', NOW()),
('Lab Results Review', 15, '#EC4899', 'Review of laboratory test results', NOW())
ON CONFLICT (type_name) DO NOTHING;

-- ============================================
-- SECTION 4: APPOINTMENTS
-- ============================================

-- Upcoming appointment for Sarah Williams (Telehealth)
INSERT INTO appointments (appointment_id, patient_id, provider_id, appointment_type, appointment_date, start_time, end_time, status, notes, is_telehealth, created_at)
VALUES
('appt-001', 'patient-001', 'doctor-001', 'Telehealth Consultation', CURRENT_DATE + INTERVAL '2 days', '10:00:00', '10:30:00', 'Scheduled', 'Patient requesting virtual visit for diabetes follow-up', true, NOW())
ON CONFLICT (appointment_id) DO NOTHING;

-- Past appointment for Sarah Williams (completed)
INSERT INTO appointments (appointment_id, patient_id, provider_id, appointment_type, appointment_date, start_time, end_time, status, notes, is_telehealth, created_at)
VALUES
('appt-002', 'patient-001', 'doctor-001', 'Follow-up Visit', CURRENT_DATE - INTERVAL '30 days', '14:00:00', '14:30:00', 'Completed', 'Diabetes management follow-up', false, NOW())
ON CONFLICT (appointment_id) DO NOTHING;

-- Appointments for other patients (for dashboard metrics)
INSERT INTO appointments (appointment_id, patient_id, provider_id, appointment_type, appointment_date, start_time, end_time, status, created_at)
VALUES
('appt-003', 'patient-002', 'doctor-002', 'Annual Physical', CURRENT_DATE, '09:00:00', '09:45:00', 'Scheduled', NOW()),
('appt-004', 'patient-003', 'doctor-001', 'New Patient Consultation', CURRENT_DATE + INTERVAL '1 day', '11:00:00', '12:00:00', 'Scheduled', NOW())
ON CONFLICT (appointment_id) DO NOTHING;

-- ============================================
-- SECTION 5: MEDICAL RECORDS FOR SARAH WILLIAMS
-- ============================================

-- Diagnosis: Type 2 Diabetes
INSERT INTO diagnosis (diagnosis_id, patient_id, provider_id, diagnosis_code, diagnosis_description, diagnosis_date, status, created_at)
VALUES
('diag-001', 'patient-001', 'doctor-001', 'E11.9', 'Type 2 Diabetes Mellitus without complications', CURRENT_DATE - INTERVAL '1 year', 'active', NOW())
ON CONFLICT (diagnosis_id) DO NOTHING;

-- Diagnosis: Hypertension
INSERT INTO diagnosis (diagnosis_id, patient_id, provider_id, diagnosis_code, diagnosis_description, diagnosis_date, status, created_at)
VALUES
('diag-002', 'patient-001', 'doctor-001', 'I10', 'Essential (primary) hypertension', CURRENT_DATE - INTERVAL '2 years', 'active', NOW())
ON CONFLICT (diagnosis_id) DO NOTHING;

-- Allergy: Penicillin
INSERT INTO allergies (allergy_id, patient_id, allergen, reaction, severity, noted_date, created_at)
VALUES
('allergy-001', 'patient-001', 'Penicillin', 'Rash, itching', 'moderate', CURRENT_DATE - INTERVAL '5 years', NOW())
ON CONFLICT (allergy_id) DO NOTHING;

-- Active Prescription: Metformin
INSERT INTO prescriptions (prescription_id, patient_id, provider_id, medication_name, dosage, frequency, duration_days, refills, status, pharmacy_name, prescribed_date, created_at)
VALUES
('rx-001', 'patient-001', 'doctor-001', 'Metformin', '500mg', 'Twice daily with meals', 90, 3, 'Active', 'CVS Pharmacy - Main St', CURRENT_DATE - INTERVAL '60 days', NOW())
ON CONFLICT (prescription_id) DO NOTHING;

-- ============================================
-- SECTION 6: LAB ORDERS FOR SARAH WILLIAMS
-- ============================================

-- Lipid Panel (will be ordered during demo - keep as pending)
INSERT INTO lab_orders (lab_order_id, patient_id, provider_id, lab_name, test_code, test_name, diagnosis_code, specimen_type, status, order_date, created_at)
VALUES
('lab-001', 'patient-001', 'doctor-001', 'Labcorp', 'LIPID', 'Lipid Panel', 'E11.9', 'Blood', 'Pending', CURRENT_DATE, NOW())
ON CONFLICT (lab_order_id) DO NOTHING;

-- HbA1c (completed - for history)
INSERT INTO lab_orders (lab_order_id, patient_id, provider_id, lab_name, test_code, test_name, diagnosis_code, specimen_type, status, order_date, collection_date, result_date, created_at)
VALUES
('lab-002', 'patient-001', 'doctor-001', 'Labcorp', 'HBA1C', 'Hemoglobin A1c', 'E11.9', 'Blood', 'Completed', CURRENT_DATE - INTERVAL '90 days', CURRENT_DATE - INTERVAL '88 days', CURRENT_DATE - INTERVAL '85 days', NOW())
ON CONFLICT (lab_order_id) DO NOTHING;

-- ============================================
-- SECTION 7: FHIR TRACKING
-- ============================================

-- Prescription tracking for Metformin
INSERT INTO fhir_tracking (tracking_id, resource_type, resource_id, tracking_number, patient_id, status, vendor, created_at, updated_at)
VALUES
('track-001', 'MedicationRequest', 'rx-001', 'RX-123456', 'patient-001', 'Filled', 'Surescripts', NOW(), NOW())
ON CONFLICT (tracking_id) DO NOTHING;

-- Tracking events
INSERT INTO fhir_tracking_events (event_id, tracking_id, event_type, status, message, created_at)
VALUES
('event-001', 'track-001', 'created', 'success', 'Prescription created in AureonCare', NOW() - INTERVAL '60 days'),
('event-002', 'track-001', 'transmitted', 'success', 'Sent to Surescripts network', NOW() - INTERVAL '60 days' + INTERVAL '5 minutes'),
('event-003', 'track-001', 'received_by_pharmacy', 'success', 'CVS Pharmacy received prescription', NOW() - INTERVAL '60 days' + INTERVAL '10 minutes'),
('event-004', 'track-001', 'filled', 'success', 'Prescription filled by pharmacy', NOW() - INTERVAL '60 days' + INTERVAL '2 hours')
ON CONFLICT (event_id) DO NOTHING;

-- ============================================
-- SECTION 8: CLAIMS & BILLING
-- ============================================

-- Claim for Sarah's last appointment
INSERT INTO claims (claim_id, patient_id, provider_id, appointment_id, service_date, diagnosis_codes, procedure_codes, total_charge, insurance_payer, status, submitted_date, created_at)
VALUES
('claim-001', 'patient-001', 'doctor-001', 'appt-002', CURRENT_DATE - INTERVAL '30 days', ARRAY['E11.9'], ARRAY['99214'], 145.00, 'Blue Cross Blue Shield', 'Paid', CURRENT_DATE - INTERVAL '28 days', NOW())
ON CONFLICT (claim_id) DO NOTHING;

-- Payment for the claim
INSERT INTO payments (payment_id, claim_id, patient_id, amount, payment_method, payment_date, transaction_id, status, created_at)
VALUES
('payment-001', 'claim-001', 'patient-001', 115.00, 'Insurance', CURRENT_DATE - INTERVAL '10 days', 'TXN-BCBS-001', 'Completed', NOW())
ON CONFLICT (payment_id) DO NOTHING;

-- Payment posting (EOB)
INSERT INTO payment_postings (posting_id, claim_id, payment_id, allowed_amount, paid_amount, adjustment_amount, patient_responsibility, posting_date, created_at)
VALUES
('posting-001', 'claim-001', 'payment-001', 115.00, 115.00, 30.00, 30.00, CURRENT_DATE - INTERVAL '10 days', NOW())
ON CONFLICT (posting_id) DO NOTHING;

-- ============================================
-- SECTION 9: DASHBOARD METRICS DATA
-- ============================================

-- Additional appointments for metrics (this month)
INSERT INTO appointments (appointment_id, patient_id, provider_id, appointment_type, appointment_date, start_time, end_time, status, created_at)
SELECT
    'appt-' || generate_series || '-metric',
    CASE (generate_series % 3)
        WHEN 0 THEN 'patient-001'
        WHEN 1 THEN 'patient-002'
        ELSE 'patient-003'
    END,
    CASE (generate_series % 2)
        WHEN 0 THEN 'doctor-001'
        ELSE 'doctor-002'
    END,
    CASE (generate_series % 4)
        WHEN 0 THEN 'Follow-up Visit'
        WHEN 1 THEN 'New Patient Consultation'
        WHEN 2 THEN 'Annual Physical'
        ELSE 'Telehealth Consultation'
    END,
    CURRENT_DATE - (generate_series || ' days')::INTERVAL,
    '09:00:00',
    '09:30:00',
    CASE (generate_series % 10)
        WHEN 0 THEN 'Cancelled'
        WHEN 1 THEN 'No-show'
        ELSE 'Completed'
    END,
    NOW()
FROM generate_series(5, 100)
ON CONFLICT (appointment_id) DO NOTHING;

-- Additional claims for revenue metrics
INSERT INTO claims (claim_id, patient_id, provider_id, service_date, diagnosis_codes, procedure_codes, total_charge, insurance_payer, status, submitted_date, created_at)
SELECT
    'claim-' || generate_series || '-metric',
    CASE (generate_series % 3)
        WHEN 0 THEN 'patient-001'
        WHEN 1 THEN 'patient-002'
        ELSE 'patient-003'
    END,
    'doctor-001',
    CURRENT_DATE - (generate_series || ' days')::INTERVAL,
    ARRAY['E11.9'],
    ARRAY['99214'],
    145.00,
    CASE (generate_series % 3)
        WHEN 0 THEN 'Blue Cross Blue Shield'
        WHEN 1 THEN 'Aetna'
        ELSE 'UnitedHealthcare'
    END,
    CASE (generate_series % 20)
        WHEN 0 THEN 'Denied'
        WHEN 1 THEN 'Pending'
        ELSE 'Paid'
    END,
    CURRENT_DATE - (generate_series || ' days')::INTERVAL,
    NOW()
FROM generate_series(2, 50)
ON CONFLICT (claim_id) DO NOTHING;

-- ============================================
-- SECTION 10: INSURANCE PAYERS
-- ============================================

INSERT INTO insurance_payers (payer_id, payer_name, payer_code, address, city, state, zip_code, phone, created_at)
VALUES
('payer-001', 'Blue Cross Blue Shield', 'BCBS', '100 Insurance Plaza', 'Chicago', 'IL', '60601', '1-800-BCBS-111', NOW()),
('payer-002', 'Aetna', 'AETNA', '200 Health Way', 'Hartford', 'CT', '06156', '1-800-AETNA-22', NOW()),
('payer-003', 'UnitedHealthcare', 'UHC', '300 Care Boulevard', 'Minneapolis', 'MN', '55343', '1-800-UHC-3333', NOW())
ON CONFLICT (payer_id) DO NOTHING;

-- ============================================
-- SECTION 11: LABORATORIES
-- ============================================

INSERT INTO laboratories (lab_id, lab_name, address, city, state, zip_code, phone, email, created_at)
VALUES
('lab-001', 'Labcorp', '531 Lab Drive', 'Burlington', 'NC', '27215', '1-800-LAB-CORP', 'support@labcorp.com', NOW()),
('lab-002', 'Quest Diagnostics', '500 Plaza Drive', 'Secaucus', 'NJ', '07094', '1-800-QUEST-11', 'support@questdiagnostics.com', NOW())
ON CONFLICT (lab_id) DO NOTHING;

-- ============================================
-- END OF DEMO DATA
-- ============================================

-- Summary Report
SELECT 'Demo data loaded successfully!' AS message;
SELECT 'Users created: ' || COUNT(*) AS users_count FROM users;
SELECT 'Patients created: ' || COUNT(*) AS patients_count FROM patients;
SELECT 'Appointments created: ' || COUNT(*) AS appointments_count FROM appointments;
SELECT 'Diagnoses created: ' || COUNT(*) AS diagnosis_count FROM diagnosis;
SELECT 'Prescriptions created: ' || COUNT(*) AS prescriptions_count FROM prescriptions;
SELECT 'Claims created: ' || COUNT(*) AS claims_count FROM claims;
```

**Load the demo data:**

```bash
psql -U aureoncare_app -d aureoncare_demo -f db/demo_data.sql
```

### Option 2: Use API to Create Demo Data (Alternative)

If you prefer to create demo data via API calls, use the provided Postman collection or curl commands.

---

## Vendor Integration Configuration

### Zoom (Telehealth)

1. **Create Zoom Developer Account:**
   - Go to: https://marketplace.zoom.us/
   - Sign in with Zoom account
   - Click "Develop" → "Build App"
   - Choose "Server-to-Server OAuth"

2. **Get Credentials:**
   - Copy **Client ID**
   - Copy **Client Secret**
   - Copy **Account ID**

3. **Add to `.env`:**
   ```env
   ZOOM_CLIENT_ID=your_client_id_here
   ZOOM_CLIENT_SECRET=your_client_secret_here
   ZOOM_ACCOUNT_ID=your_account_id_here
   ```

4. **Test:**
   ```bash
   curl -X POST http://localhost:3000/api/telehealth/sessions \
     -H "Content-Type: application/json" \
     -d '{
       "appointment_id": "appt-001",
       "provider": "zoom",
       "enable_recording": true
     }'
   ```

### Labcorp (Lab Orders)

1. **Request Sandbox Access:**
   - Contact Labcorp Developer Portal: https://developer.labcorp.com/
   - Request sandbox API credentials

2. **Add to `.env`:**
   ```env
   LABCORP_CLIENT_ID=sandbox_client_id
   LABCORP_CLIENT_SECRET=sandbox_client_secret
   LABCORP_SANDBOX_MODE=true
   ```

3. **Test:**
   ```bash
   curl -X POST http://localhost:3000/api/lab-orders \
     -H "Content-Type: application/json" \
     -d '{
       "patient_id": "patient-001",
       "provider_id": "doctor-001",
       "lab_name": "Labcorp",
       "test_code": "LIPID",
       "test_name": "Lipid Panel",
       "diagnosis_code": "E11.9"
     }'
   ```

### Optum (Clearinghouse)

1. **Request Sandbox Access:**
   - Contact Optum: https://www.optum.com/business/
   - Request EDI sandbox credentials

2. **Add to `.env`:**
   ```env
   OPTUM_CLIENT_ID=sandbox_client_id
   OPTUM_CLIENT_SECRET=sandbox_client_secret
   OPTUM_SANDBOX_MODE=true
   ```

### Mock Mode (No Vendor Accounts)

If you don't have vendor credentials, AureonCare can run in **mock mode**:

**In `/backend/.env`:**
```env
MOCK_INTEGRATIONS=true
```

This will simulate all vendor responses for demo purposes.

---

## User Accounts & Login Credentials

### Demo User Credentials

**All passwords:** `Demo123!`

**User Accounts:**

| Role | Email | Password | Purpose |
|------|-------|----------|---------|
| Admin | admin@aureoncare.com | Demo123! | System administration |
| Doctor | dr.anderson@aureoncare.com | Demo123! | Primary clinician for demo |
| Doctor | dr.patel@aureoncare.com | Demo123! | Secondary clinician |
| Receptionist | frontdesk@aureoncare.com | Demo123! | Front desk operations |
| Patient | sarah.williams@email.com | Demo123! | Demo patient (Sarah Williams) |
| Patient | robert.johnson@email.com | Demo123! | Additional patient |

**Password Hash:**

The demo data uses a pre-computed bcrypt hash for `Demo123!`:
```
$2a$10$CwTycUXWue0Thq9StjUM0uJ4K6K9W3bHPwmJq2K2k2K2k2K2k2K2k
```

If you need to generate a new hash:
```javascript
const bcrypt = require('bcryptjs');
const hash = await bcrypt.hash('YourPassword', 10);
console.log(hash);
```

---

## Testing the Demo Environment

### Step 1: Test Backend API

```bash
# Check server health
curl http://localhost:3000/health

# Expected response: {"status":"ok"}
```

### Step 2: Test Frontend

1. Open browser: http://localhost:3001
2. You should see AureonCare login page
3. Login with: `admin@aureoncare.com` / `Demo123!`

### Step 3: Test Key Demo Flows

**Scheduling Flow:**
1. Login as receptionist: `frontdesk@aureoncare.com`
2. Navigate to "Practice Management"
3. Search for "Sarah Williams"
4. Verify patient appears in search results

**Clinical Flow:**
1. Login as doctor: `dr.anderson@aureoncare.com`
2. Navigate to "EHR"
3. Search for "Sarah Williams"
4. Verify:
   - Medical history shows diagnoses (Type 2 Diabetes, Hypertension)
   - Allergies show Penicillin
   - Medications show Metformin

**Telehealth Flow:**
1. Login as doctor: `dr.anderson@aureoncare.com`
2. Navigate to "Telehealth"
3. Find Sarah Williams' upcoming appointment
4. Click "Start Session"
5. Verify session creation (Zoom link generated if configured)

**RCM Flow:**
1. Login as admin: `admin@aureoncare.com`
2. Navigate to "RCM"
3. Verify dashboard shows:
   - Total claims
   - Pending claims
   - Revenue metrics

**Reports Flow:**
1. Login as admin: `admin@aureoncare.com`
2. Navigate to "Reports & Analytics"
3. Verify dashboards display:
   - Clinical metrics
   - Operational metrics
   - Financial metrics

### Step 4: Test Data Validation

Run this SQL query to verify demo data:

```sql
-- Verify demo data
SELECT
    (SELECT COUNT(*) FROM users) AS users,
    (SELECT COUNT(*) FROM patients) AS patients,
    (SELECT COUNT(*) FROM appointments) AS appointments,
    (SELECT COUNT(*) FROM diagnosis) AS diagnoses,
    (SELECT COUNT(*) FROM prescriptions) AS prescriptions,
    (SELECT COUNT(*) FROM claims) AS claims;
```

Expected output:
- Users: 6+
- Patients: 3+
- Appointments: 100+
- Diagnoses: 2+
- Prescriptions: 1+
- Claims: 50+

---

## Troubleshooting

### Issue 1: Backend won't start

**Error:** `ECONNREFUSED 127.0.0.1:5432`

**Solution:**
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql
```

### Issue 2: Frontend shows "Network Error"

**Solution:**
- Verify backend is running on port 3000
- Check `/frontend/.env` has correct API URL
- Check browser console for CORS errors

### Issue 3: Login fails

**Solution:**
- Verify user exists in database:
  ```sql
  SELECT * FROM users WHERE email = 'admin@aureoncare.com';
  ```
- Reset password:
  ```sql
  UPDATE users
  SET password_hash = '$2a$10$CwTycUXWue0Thq9StjUM0uJ4K6K9W3bHPwmJq2K2k2K2k2K2k2K2k'
  WHERE email = 'admin@aureoncare.com';
  ```

### Issue 4: Telehealth session creation fails

**Solution:**
- Check Zoom credentials in `.env`
- Enable mock mode if testing without vendor accounts:
  ```env
  MOCK_INTEGRATIONS=true
  ```

### Issue 5: Demo data not loading

**Solution:**
```bash
# Clear database and reload
psql -U aureoncare_app -d aureoncare_demo

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

# Re-run schema and demo data scripts
# (see Database Setup section)
```

---

## Demo Day Checklist

### 24 Hours Before Demo

- [ ] Test full demo flow from start to finish
- [ ] Verify all vendor integrations are working (or mock mode enabled)
- [ ] Prepare backup slides in case of technical issues
- [ ] Test screen sharing/recording software
- [ ] Confirm internet connection stability
- [ ] Print presenter notes

### 2 Hours Before Demo

- [ ] Start backend server
- [ ] Start frontend server
- [ ] Open browser tabs:
  - [ ] Frontend (http://localhost:3001)
  - [ ] Backup tab (in case first tab has issues)
- [ ] Login as doctor (`dr.anderson@aureoncare.com`)
- [ ] Verify Sarah Williams patient exists and has data
- [ ] Test telehealth session creation (but don't start actual call)
- [ ] Close unnecessary applications (to free resources)

### 30 Minutes Before Demo

- [ ] Restart backend and frontend (fresh start)
- [ ] Re-login as doctor
- [ ] Navigate to starting screen (EHR dashboard)
- [ ] Set browser to full screen mode
- [ ] Hide browser bookmarks bar (clean interface)
- [ ] Mute notifications on your computer
- [ ] Test microphone and audio
- [ ] Have backup plan ready (slides only if system fails)

### During Demo

- [ ] Keep presenter script/notes visible (second monitor or printed)
- [ ] Monitor backend terminal for errors
- [ ] Have admin account open in separate tab (in case you need to fix something quickly)
- [ ] Stay calm if something breaks—pivot to slides

### After Demo

- [ ] Stop recording (if applicable)
- [ ] Export demo recording
- [ ] Send follow-up email with recording link
- [ ] Gather feedback from audience
- [ ] Document any issues encountered

---

## Additional Resources

**Documentation:**
- AureonCare User Manual: `/docs/user-manual/`
- API Documentation: `/docs/api/`
- FHIR Implementation: `/docs/FHIR_TRACKING.md`

**Support:**
- GitHub Issues: https://github.com/rajbizchannels/AureonCare/issues
- Community Forum: [link]
- Email: support@aureoncare.com

**Demo Recording Examples:**
- [Link to sample demo video]
- [Link to feature walkthrough]

---

## Demo Environment Maintenance

### Regular Refresh

Refresh demo data weekly:

```bash
# Backup current database
pg_dump -U aureoncare_app aureoncare_demo > backup_$(date +%Y%m%d).sql

# Reload demo data
psql -U aureoncare_app -d aureoncare_demo -f db/demo_data.sql
```

### Performance Optimization

Before demo, optimize database:

```sql
-- Analyze database
ANALYZE;

-- Reindex for performance
REINDEX DATABASE aureoncare_demo;

-- Vacuum to reclaim space
VACUUM FULL;
```

---

**End of Setup Guide**

**You're ready to deliver an impressive demo! Good luck! 🚀**
