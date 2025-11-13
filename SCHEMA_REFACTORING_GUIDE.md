# Schema Refactoring Guide: Patient-User ID Merge

## Overview

This document explains the major schema refactoring that merges `patient.id` with `user.id`, eliminating the redundant `user_id` column from the patients table.

## Design Change

### Before (Old Schema)
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  ...
);

CREATE TABLE patients (
  id SERIAL PRIMARY KEY,       -- Separate patient ID
  user_id INTEGER REFERENCES users(id),  -- Reference to user
  first_name VARCHAR(100),
  ...
);
```

**Problem**: Each patient had TWO IDs:
- Their own `patient.id`
- A reference to `user.id` via `user_id`

This caused confusion and the "Not Provided" bug in patient portals because data could be split across two records.

### After (New Schema)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  ...
);

CREATE TABLE patients (
  id UUID PRIMARY KEY REFERENCES users(id),  -- patient.id IS user.id
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  mrn VARCHAR(50) UNIQUE NOT NULL,
  ...
);
```

**Solution**: Each patient has ONE ID:
- `patient.id` directly references `users.id`
- No separate `user_id` column
- Patient IS a user (inheritance relationship)

## Benefits

1. **Simpler Data Model**: One ID per patient instead of two
2. **Clearer Relationship**: Patient IS a user (not patient HAS a user)
3. **Better Data Integrity**: CASCADE deletes work naturally
4. **Fixes "Not Provided" Bug**: Patient data comes directly from user record
5. **Easier Queries**: No need to join on user_id

## Migration Process

### Files Changed

1. **backend/migrations/023_merge_patient_id_with_user_id.sql**
   - Automated migration script
   - Maps old patient IDs to user IDs
   - Updates all foreign key references
   - Removes user_id column

2. **backend/schema.sql**
   - Updated base schema
   - Users table now defined first
   - patients.id references users(id)
   - All patient_id fields now UUID

3. **backend/scripts/seed-test-data.sql**
   - Updated test data
   - Patient IDs now use user IDs (b0000000...)
   - Removed user_id from inserts

### How to Apply

#### Option 1: Fresh Database (Recommended for Development)
```bash
# Drop and recreate database
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Run base schema
psql $DATABASE_URL -f backend/schema.sql

# Run all migrations
psql $DATABASE_URL -f backend/migrations/021_convert_users_to_uuid.sql
psql $DATABASE_URL -f backend/migrations/022_convert_patients_providers_to_uuid.sql
psql $DATABASE_URL -f backend/migrations/023_merge_patient_id_with_user_id.sql

# Seed test data
psql $DATABASE_URL -f backend/scripts/seed-test-data.sql
```

#### Option 2: Migrate Existing Database
```bash
# Backup first!
pg_dump $DATABASE_URL > backup.sql

# Run migration
psql $DATABASE_URL -f backend/migrations/023_merge_patient_id_with_user_id.sql
```

**⚠️ WARNING**: Migration 023 will modify existing data. Back up your database first!

## Data Impact

### What the Migration Does

1. **Creates mapping table**: Maps old patient IDs to user IDs
2. **Updates foreign keys**:
   - appointments.patient_id
   - claims.patient_id
   - prescriptions.patient_id
   - payments.patient_id
   - diagnosis.patient_id
   - medical_records.patient_id
   - All scheduling tables (recurring_appointments, appointment_waitlist, etc.)
   - Portal tables (patient_portal_sessions, social_auth, etc.)

3. **Removes old ID**: Drops patients.id column
4. **Renames user_id**: Renames patients.user_id to patients.id
5. **Re-establishes constraints**: Adds foreign key constraints back

### Example Data Transformation

**Before:**
```sql
users:    id=123, first_name='John', last_name='Doe'
patients: id=456, user_id=123, first_name='John', last_name='Doe'
appointments: patient_id=456  -- References old patient ID
```

**After:**
```sql
users:    id=123, first_name='John', last_name='Doe'
patients: id=123, first_name='John', last_name='Doe'  -- id=user.id, no user_id
appointments: patient_id=123  -- References user ID
```

## Frontend Impact

### API Responses

Patient data returned from API will now have:
- `id`: Same as user ID (UUID)
- No `user_id` field
- All other patient fields remain the same

### Example API Response

**Before:**
```json
{
  "id": "20000000-0000-0000-0000-000000000001",
  "user_id": "b0000000-0000-0000-0000-000000000001",
  "first_name": "John",
  "last_name": "Doe",
  "mrn": "MRN-001"
}
```

**After:**
```json
{
  "id": "b0000000-0000-0000-0000-000000000001",
  "first_name": "John",
  "last_name": "Doe",
  "mrn": "MRN-001"
}
```

### Code Changes Needed

Most frontend code should work without changes, but check for:

1. **Any code that uses `user_id`** - should now use `id`
2. **Patient lookup by user** - now just use patient.id directly
3. **Queries joining patients and users** - relationship is now 1:1 via id

## Testing

### Verify Migration Success

```sql
-- Check patients have valid user references
SELECT COUNT(*) FROM patients p
INNER JOIN users u ON p.id = u.id;

-- Should match total patients
SELECT COUNT(*) FROM patients;

-- Check appointments reference valid patients
SELECT COUNT(*) FROM appointments a
LEFT JOIN patients p ON a.patient_id = p.id
WHERE p.id IS NULL;
-- Should return 0

-- Verify no user_id column exists
SELECT column_name FROM information_schema.columns
WHERE table_name = 'patients' AND column_name = 'user_id';
-- Should return no rows
```

### Run Diagnostic Script

```bash
node backend/scripts/diagnose-patient-portal.js
```

This will verify:
- Patient table structure is correct
- All patients have first_name and last_name
- Portal-enabled patients exist
- Foreign key relationships are intact

## Rollback (If Needed)

If migration fails or causes issues:

```bash
# Restore from backup
psql $DATABASE_URL < backup.sql
```

## Support

For issues or questions:
1. Check diagnostic output: `node backend/scripts/diagnose-patient-portal.js`
2. Review migration logs in PostgreSQL
3. Consult this guide for expected behavior

---

**Last Updated**: 2025-11-13
**Migration Version**: 023
**Status**: ✅ Complete
