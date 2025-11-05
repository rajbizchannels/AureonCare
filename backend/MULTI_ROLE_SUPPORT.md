# Multi-Role Support for Users

## Overview

Users in MedFlow can have multiple roles simultaneously. For example, a doctor (provider) can also be a patient at the same facility. This document explains the design decision and implementation.

## The Problem

Previously, when a user's role changed:
- **Patient → Doctor**: The system deleted the patient record
- **Doctor → Patient**: The system deleted the provider record

This caused several issues:

1. **Foreign Key Violations**: Patient records linked to FHIR resources (medical records) couldn't be deleted
2. **Data Loss**: Historical medical data and appointments were lost
3. **Referential Integrity**: Breaking links between patients, appointments, and medical records
4. **Real-world Incompatibility**: Doctors can also be patients

### Error Example

```
Error: update or delete on table "patients" violates foreign key constraint
"fhir_resources_patient_id_fkey" on table "fhir_resources"
Detail: Key (id)=(20000000-0000-0000-0000-000000000003) is still referenced
from table "fhir_resources".
```

## The Solution

**Users can now have multiple roles simultaneously.**

When a user's role changes:
- Changing to 'doctor' → Adds user to `providers` table (keeps patient record if exists)
- Changing to 'patient' → Adds user to `patients` table (keeps provider record if exists)
- **No records are deleted** when roles change

### Benefits

1. ✅ **Preserves Medical Records**: FHIR resources remain linked to patients
2. ✅ **Maintains History**: All appointments and medical data retained
3. ✅ **Real-world Compatibility**: Doctors can also receive treatment as patients
4. ✅ **No Foreign Key Violations**: References remain valid
5. ✅ **Audit Trail**: Complete history of user's interactions in the system

## Implementation Details

### Code Changes

**File:** `backend/routes/users.js`

**Lines 209-213** (previously deleted patients):
```javascript
// NOTE: We do NOT remove from patients table
// A user can be both a doctor (provider) and a patient
// Medical records (FHIR resources) must be preserved
// This prevents foreign key constraint violations
```

**Lines 262-266** (previously deleted providers):
```javascript
// NOTE: We do NOT remove from providers table
// A user can have multiple roles (e.g., a doctor who becomes a patient)
// Provider records should be preserved for historical appointment data
// This maintains referential integrity with appointments and other records
```

### Database Schema

**Migration:** `013_support_multiple_user_roles.sql`

Adds indexes for efficient queries:
- `idx_patients_user_id` - Link patients to users
- `idx_patients_email` - Find patients by email
- `idx_providers_user_id` - Link providers to users
- `idx_providers_email` - Find providers by email

## Usage Examples

### Example 1: Doctor Who Is Also a Patient

Dr. Sarah Chen works at Central Hospital and also receives treatment there.

```javascript
// User record
{
  id: 1,
  first_name: "Sarah",
  last_name: "Chen",
  role: "doctor",  // Current primary role
  email: "sarah.chen@hospital.com"
}

// Provider record (because role is 'doctor')
{
  id: UUID,
  user_id: 1,
  first_name: "Sarah",
  last_name: "Chen",
  specialization: "Cardiology"
}

// Patient record (she also receives treatment)
{
  id: UUID,
  user_id: 1,
  first_name: "Sarah",
  last_name: "Chen",
  mrn: "MRN-1001"
}
```

### Example 2: Patient Who Becomes a Doctor

Medical student completes residency and joins as staff:

**Before:**
```javascript
// User with 'patient' role
// Has patient record with MRN and medical history
// Has FHIR resources (lab results, prescriptions)
```

**After changing role to 'doctor':**
```javascript
// User role is now 'doctor'
// Patient record PRESERVED (with all medical history)
// FHIR resources still linked correctly
// NEW provider record created
// Can now see patients AND has their own medical records
```

## Querying Users by Role

### Find all providers
```sql
SELECT u.*, p.*
FROM users u
JOIN providers p ON u.id = p.user_id
WHERE u.role = 'doctor';
```

### Find all patients
```sql
SELECT u.*, pat.*
FROM users u
JOIN patients pat ON u.id = pat.user_id
WHERE u.role = 'patient';
```

### Find users with both roles
```sql
SELECT u.id, u.first_name, u.last_name, u.role,
       CASE WHEN p.id IS NOT NULL THEN TRUE ELSE FALSE END as is_provider,
       CASE WHEN pat.id IS NOT NULL THEN TRUE ELSE FALSE END as is_patient
FROM users u
LEFT JOIN providers p ON u.id = p.user_id
LEFT JOIN patients pat ON u.id = pat.user_id
WHERE p.id IS NOT NULL AND pat.id IS NOT NULL;
```

## Foreign Key Constraints

### Current Constraints

**FHIR Resources:**
```sql
ALTER TABLE fhir_resources
ADD CONSTRAINT fhir_resources_patient_id_fkey
FOREIGN KEY (patient_id) REFERENCES patients(id);
```

This constraint is **critical** - it prevents deletion of patient records that have medical data.

### Why We Don't Use CASCADE

We **do not** use `ON DELETE CASCADE` because:
- Medical records must be preserved by law (HIPAA, patient rights)
- Deleting patient records would delete their entire medical history
- Audit trails require historical data retention
- Patient safety requires access to historical records

## Admin Panel Behavior

When changing a user's role in the Admin Panel:

1. **Patient → Doctor:**
   - User's role field updates to 'doctor'
   - Provider record created (if doesn't exist)
   - Patient record **remains intact**
   - User can access provider features
   - Medical records preserved

2. **Doctor → Patient:**
   - User's role field updates to 'patient'
   - Patient record created with new MRN (if doesn't exist)
   - Provider record **remains intact**
   - Historical appointments preserved
   - Can still be referenced in past appointments

3. **Staff → Doctor:**
   - User's role field updates to 'doctor'
   - Provider record created
   - No patient or provider records deleted

## Migration Guide

### Applying the Migration

```bash
cd backend
psql -h localhost -U medflow_user -d medflow -f migrations/013_support_multiple_user_roles.sql
```

### Expected Output

```
NOTICE:  FHIR resources foreign key exists - patient records should NEVER be deleted
NOTICE:  Role changes now preserve patient and provider records
```

## Testing

### Test Case 1: Patient with FHIR Resources

1. Create a patient user
2. Add FHIR resources (lab results, prescriptions)
3. Change role to 'doctor' in Admin Panel
4. ✅ Should succeed without errors
5. ✅ Patient record still exists
6. ✅ FHIR resources still linked
7. ✅ Provider record created

### Test Case 2: Doctor with Appointments

1. Create a doctor user
2. Schedule appointments with patients
3. Change role to 'patient' in Admin Panel
4. ✅ Should succeed without errors
5. ✅ Provider record still exists
6. ✅ Appointments still reference the provider
7. ✅ Patient record created

## Backward Compatibility

This change is **fully backward compatible**:
- Existing code that reads from patients/providers tables unchanged
- Queries work the same way
- Foreign keys remain valid
- No data migration needed
- Only behavior change: records are preserved instead of deleted

## Future Considerations

### Option 1: Add Role Status Field

Could add a `status` field to track active/inactive roles:

```sql
ALTER TABLE patients ADD COLUMN status VARCHAR(20) DEFAULT 'active';
ALTER TABLE providers ADD COLUMN status VARCHAR(20) DEFAULT 'active';
```

### Option 2: Role History Table

Track role changes over time:

```sql
CREATE TABLE user_role_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  old_role VARCHAR(50),
  new_role VARCHAR(50),
  changed_at TIMESTAMP DEFAULT NOW(),
  changed_by INTEGER REFERENCES users(id)
);
```

### Option 3: Many-to-Many Roles

Allow explicit multiple roles per user:

```sql
CREATE TABLE user_roles (
  user_id INTEGER REFERENCES users(id),
  role VARCHAR(50),
  active BOOLEAN DEFAULT TRUE,
  PRIMARY KEY (user_id, role)
);
```

## Summary

**Key Takeaway:** Patient and provider records are now preserved when roles change, preventing data loss and foreign key violations while maintaining medical record integrity.

**Files Changed:**
- `routes/users.js` - Removed DELETE statements
- `migrations/013_support_multiple_user_roles.sql` - Added indexes and documentation
- `MULTI_ROLE_SUPPORT.md` - This documentation

**Impact:**
- ✅ Fixes foreign key constraint violations
- ✅ Preserves medical records and history
- ✅ Supports real-world scenarios
- ✅ Maintains referential integrity
- ✅ No breaking changes to existing code
