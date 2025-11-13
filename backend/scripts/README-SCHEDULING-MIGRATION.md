# Scheduling System Migration

## Problem
The Provider Management View is failing with error: "Unexpected token '<', '<!DOCTYPE'... is not valid JSON"

## Cause
The scheduling system tables (doctor_availability, appointment_type_config, provider_booking_config, etc.) don't exist in the database.

## Solution

### Option 1: Run the complete reset-and-seed script (RECOMMENDED)
This will reset your database and apply all migrations including the scheduling migration:

```bash
cd backend
node scripts/reset-and-seed.js
```

### Option 2: Run the scheduling migration directly with psql

If you just want to add the scheduling tables without resetting existing data:

```bash
cd backend
psql -U [DB_USER] -h [DB_HOST] -d [DB_NAME] -f migrations/017_create_scheduling_system.sql
```

Replace `[DB_USER]`, `[DB_HOST]`, and `[DB_NAME]` with your actual database credentials from .env file.

Example:
```bash
psql -U postgres -h localhost -d medflow -f migrations/017_create_scheduling_system.sql
```

### Option 3: Run the migration with the provided script

```bash
cd backend
node scripts/run-scheduling-migration.js
```

Note: This requires `pg` and `dotenv` npm packages to be installed.

## What This Migration Creates

The migration creates these tables:
- `doctor_availability` - Doctor's working hours by day of week
- `doctor_time_off` - Vacation days and time-off periods
- `appointment_type_config` - Configurable appointment types with duration and pricing
- `provider_booking_config` - Provider-specific booking settings and public booking URL
- `appointment_reminders` - Email/SMS reminder tracking

## Verification

After running the migration, you can verify it worked by checking if the tables exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'doctor_availability',
  'doctor_time_off',
  'appointment_type_config',
  'provider_booking_config',
  'appointment_reminders'
)
ORDER BY table_name;
```

You should see all 5 tables listed.

## After Migration

Once the migration is complete, the Provider Management View should load correctly and allow you to:
- Configure provider availability schedules
- Set up appointment types
- Create public booking pages
- Manage time-off periods
