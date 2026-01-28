# Fix for Patient Address Edit Error

## Problem
When editing patient profiles, you may encounter this error:
```
Error updating patient: error: invalid input syntax for type json
detail: 'Token "Elm" is invalid.'
```

This occurs because the `patients.address` column was created as JSONB type (by migrate.js), but the frontend sends plain text strings when editing patient addresses.

## Solution

There are two parts to the fix:

### Part 1: Temporary Frontend Fix (Already Applied)
The frontend has been updated to skip the address field when updating patients. This prevents the error but means address updates won't save until the migration is run.

Location: `frontend/src/components/modals/ViewEditModal.js` (lines 176-182)

### Part 2: Permanent Database Fix (Migration Required)

Run the migration to convert the address column from JSONB to TEXT:

#### Option A: Using the run-migration script
```bash
cd backend
node run-migration.js
```

#### Option B: Using the dedicated fix script
```bash
cd backend
node scripts/fix-address-column.js
```

#### Option C: Manual SQL execution
Connect to your database and run:
```sql
-- Convert existing JSON addresses to plain text
UPDATE patients
SET address = CASE
  WHEN address::text LIKE '{%' THEN
    CONCAT_WS(', ',
      NULLIF(address->>'street', ''),
      NULLIF(address->>'city', ''),
      NULLIF(CONCAT(address->>'state', ' ', address->>'zip'), ' ')
    )
  ELSE
    address::text
END
WHERE address IS NOT NULL;

-- Change column type from JSONB to TEXT
ALTER TABLE patients
ALTER COLUMN address TYPE TEXT USING address::text;
```

## After Running the Migration

Once the migration completes successfully:

1. Address edits will work properly in the patient edit form
2. You can remove the temporary fix from ViewEditModal.js if desired (lines 176-182)
3. All existing addresses will be preserved as plain text strings

## Files Changed

- `backend/migrations/016_fix_patients_address_column.sql` - Migration SQL
- `backend/scripts/fix-address-column.js` - Standalone migration runner
- `backend/run-migration.js` - Updated to run the address fix migration
- `frontend/src/components/modals/ViewEditModal.js` - Temporary fix to prevent error
- `backend/FIX_ADDRESS_ERROR.md` - This documentation

## Root Cause

The issue stems from two different database schemas:
- `schema.sql` defines address as TEXT
- `migrate.js` creates address as JSONB

The frontend was designed to work with TEXT addresses (simple string input), but the database was likely initialized using migrate.js which created JSONB columns.
