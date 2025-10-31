# MedFlow Database Migration Guide

## Overview
This guide will help you apply the necessary database migrations to:
1. Add medical attributes to patients table (height, weight, blood_type, etc.)
2. Remove "name" field dependency and use first_name/last_name
3. Link users and patients tables properly
4. Fix appointment booking foreign key constraints

## Prerequisites
- PostgreSQL installed and running
- Database credentials configured in `backend/.env`
- Backup your database before proceeding

## Migration Steps

### Step 1: Backup Your Database
```bash
# Windows (PowerShell/CMD)
pg_dump -h localhost -U medflow_user -d medflow > backup_$(date +%Y%m%d).sql

# Or use pgAdmin to create a backup
```

### Step 2: Run Migrations in Order

**IMPORTANT**: Your database uses **UUID** primary keys. Use the `_uuid.sql` versions of the migration files.

#### Option A: Using psql command line
```bash
# Navigate to backend directory
cd backend

# Run UUID-compatible migrations in order
psql -h localhost -U medflow_user -d medflow -f migrations/005_create_prescriptions_diagnosis_tables_uuid.sql
psql -h localhost -U medflow_user -d medflow -f migrations/006_remove_name_add_medical_attributes_uuid.sql
psql -h localhost -U medflow_user -d medflow -f migrations/007_link_users_patients_uuid.sql
```

#### Option B: Using pgAdmin (RECOMMENDED)
1. Open pgAdmin
2. Connect to your medflow database
3. Open Query Tool (Tools → Query Tool or F4)
4. **Run these UUID migration files in this exact order**:
   - `005_create_prescriptions_diagnosis_tables_uuid.sql`
   - `006_remove_name_add_medical_attributes_uuid.sql`
   - `007_link_users_patients_uuid.sql`
5. For each file:
   - Open the migration SQL file from `backend/migrations/` in a text editor
   - Copy all the contents
   - Paste into pgAdmin Query Tool
   - Click Execute (F5 or play button ▶)
   - Verify you see "Query returned successfully" with no errors
   - Check the Messages tab for confirmation messages
   - Proceed to the next migration file only after success

### Step 3: Verify Migrations

Run this query in pgAdmin or psql to verify:
```sql
-- Check if medical attributes exist in patients table
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'patients'
  AND column_name IN ('height', 'weight', 'blood_type', 'allergies', 'past_history', 'family_history', 'current_medications');

-- Check if user_id link exists
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'patients'
  AND column_name = 'user_id';

-- Check if first_name and last_name exist in users table
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('first_name', 'last_name');

-- Check if prescriptions and diagnosis tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('prescriptions', 'diagnosis');

-- Verify patient records are linked to users
SELECT COUNT(*) as linked_patients
FROM patients p
INNER JOIN users u ON p.user_id = u.id
WHERE u.role = 'patient';
```

Expected results:
- 7 medical attribute columns in patients table
- user_id column exists in patients table
- first_name and last_name exist in users table
- prescriptions and diagnosis tables exist
- At least 1 linked patient record (if you have patient users)

### Step 4: Restart Backend Server
```bash
# Stop the backend server (Ctrl+C if running)
# Start it again
cd MedFlow
npm start

# Or if using separate backend start
cd backend
node server.js
```

## Troubleshooting

### Error: "column already exists"
This means the migration was partially run before. It's safe - the migration uses `ADD COLUMN IF NOT EXISTS` so it won't cause issues.

### Error: "relation does not exist"
Make sure you're running migrations in the correct order (002 → 005 → 006 → 007).

### Error: "psql command not found"
Use pgAdmin (Option B) or install PostgreSQL command-line tools.

### Error: "permission denied"
Make sure your database user (medflow_user) has sufficient privileges:
```sql
GRANT ALL PRIVILEGES ON DATABASE medflow TO medflow_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO medflow_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO medflow_user;
```

## What Changed

### Database Schema Changes
1. **patients table**: Added 7 medical attribute columns
2. **patients table**: Added user_id foreign key to link with users
3. **users table**: Made first_name and last_name NOT NULL
4. **prescriptions table**: Created (links to patients, providers, appointments)
5. **diagnosis table**: Created (links to patients, providers, appointments)
6. **appointments table**: Added start_time, end_time, duration_minutes, appointment_type columns

### Backend Changes
1. **appointments route**: Now accepts user_id and looks up patient_id automatically
2. **All routes**: Now use first_name/last_name instead of name
3. **Auto-creation**: Patient records are automatically created when a user with role='patient' is created

### Frontend Changes
1. **PatientPortalView**: Now sends user_id when booking appointments
2. **All components**: Display first_name + last_name instead of name field
3. **Error handling**: Better error messages for appointment booking failures

## Post-Migration Checklist

- [ ] All migrations ran successfully
- [ ] Backend server starts without errors
- [ ] Can log in as admin user
- [ ] Can log in as patient user
- [ ] Patient can view their profile
- [ ] Patient can edit their medical information (height, weight, etc.)
- [ ] Patient can book an appointment without foreign key errors
- [ ] Patient can view prescriptions (if any exist)

## Rollback (Emergency Only)

If you need to rollback:
```bash
# Restore from backup
psql -h localhost -U medflow_user -d medflow < backup_YYYYMMDD.sql
```

## Support

If you encounter issues not covered here:
1. Check the backend console for error messages
2. Check the browser console for frontend errors
3. Verify database connection settings in `backend/.env`
4. Ensure PostgreSQL is running

## Next Steps

After successful migration:
1. Test all patient portal features
2. Test appointment booking
3. Update patient profiles with medical information
4. Set up doctor accounts with prescriptions permissions (future feature)
