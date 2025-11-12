# Database Scripts

This directory contains scripts for managing the MedFlow database.

## 🚀 Quick Start - Reset Database with Test Data

To completely reset your database and load test data:

```bash
# From the project root directory
npm run reset-db
```

This single command will:
1. ✅ Apply database migrations to fix schema issues
2. 🗑️ Delete all existing data
3. 🌱 Seed the database with test data
4. ✅ Verify data integrity

## 📋 Available Scripts

### `reset-and-seed.js` (RECOMMENDED)
**Purpose:** Complete database reset and seed with test data

**Usage:**
```bash
npm run reset-db
# or
node backend/scripts/reset-and-seed.js
```

**What it does:**
- Runs critical migrations (including fixing provider foreign key)
- Deletes all data in correct order (respecting foreign keys)
- Seeds test data with proper relationships
- Verifies data integrity
- Shows summary of created records

### `reset-database.sql`
**Purpose:** SQL script to delete all data

**Usage:**
```bash
psql -U postgres -d medflow -f backend/scripts/reset-database.sql
```

**What it does:**
- Deletes all data in reverse dependency order
- Respects foreign key constraints
- Shows count of remaining rows (should be 0)

**⚠️ Warning:** This permanently deletes all data!

### `seed-test-data.sql`
**Purpose:** SQL script to insert test data

**Usage:**
```bash
psql -U postgres -d medflow -f backend/scripts/seed-test-data.sql
```

**What it does:**
- Creates users (admin, doctors, patients, staff)
- Creates providers (references users correctly)
- Creates patients (references users)
- Creates appointments (references providers table, NOT users)
- Creates prescriptions, claims, payments, tasks
- Creates doctor availability schedules
- Verifies all foreign key relationships

## 🔑 Test Credentials

After seeding, you can log in with these accounts:

**Password for all accounts:** `password123`

### Admin
- Email: `admin@medflow.com`
- Role: Administrator

### Doctors
- Email: `dr.smith@medflow.com` (Family Medicine)
- Email: `dr.johnson@medflow.com` (Cardiology)
- Email: `dr.williams@medflow.com` (Pediatrics)

### Patients
- Email: `john.doe@example.com`
- Email: `jane.smith@example.com`
- Email: `bob.wilson@example.com`
- Email: `alice.brown@example.com`

### Staff
- Email: `staff@medflow.com`

## 📊 Test Data Summary

The seed script creates:

| Table | Records |
|-------|---------|
| Users | 9 (1 admin, 3 doctors, 4 patients, 1 staff) |
| Providers | 3 |
| Patients | 4 |
| Appointments | 6 (2 today, 2 tomorrow, 2 past) |
| Prescriptions | 3 |
| Tasks | 3 |
| Claims | 3 |
| Payments | 1 |
| Pharmacies | 3 |
| Doctor Availability | 12 slots |

## 🔧 Important Notes

### Provider Foreign Key Fix

The `reset-and-seed.js` script automatically applies migration `009_fix_appointments_provider_fkey.sql` which fixes a critical issue:

**Problem:** The `appointments.provider_id` foreign key was pointing to `users` table
**Solution:** Migration updates it to point to `providers` table

This prevents the error:
```
Key (provider_id)=(00000000-0000-0000-0000-000000000001) is not present in table "users"
```

### UUID Format

All IDs follow this pattern for easy identification:
- Admin users: `a0000000-0000-0000-0000-000000000001`
- Doctor users: `d0000000-0000-0000-0000-000000000001-3`
- Patient users: `p0000000-0000-0000-0000-000000000001-4`
- Providers: `10000000-0000-0000-0000-000000000001-3`
- Patients: `20000000-0000-0000-0000-000000000001-4`
- Staff users: `s0000000-0000-0000-0000-000000000001`

### Data Relationships

The seed data creates proper relationships:
- Each doctor user has a corresponding provider record
- Each patient user has a corresponding patient record
- Appointments reference `providers.id` (not `users.id`)
- All foreign keys are validated

## 🐛 Troubleshooting

### Error: "relation does not exist"
**Solution:** Run migrations first:
```bash
cd backend
./run_migrations.sh
```

### Error: "foreign key constraint violation"
**Solution:** This should not happen with `reset-and-seed.js`. If it does:
1. Check that migration 009 was applied
2. Verify provider_id values match providers table

### Error: "database connection failed"
**Solution:** Check your `.env` file:
```env
DB_USER=postgres
DB_HOST=localhost
DB_NAME=medflow
DB_PASSWORD=postgres
DB_PORT=5432
```

### Want to keep some data?
If you only want to add test data without deleting:
```bash
psql -U postgres -d medflow -f backend/scripts/seed-test-data.sql
```
**Warning:** This may cause duplicate key errors if data already exists.

## 📝 Manual Database Operations

### Connect to Database
```bash
psql -U postgres -d medflow
```

### View All Tables
```sql
\dt
```

### Check Record Counts
```sql
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL SELECT 'providers', COUNT(*) FROM providers
UNION ALL SELECT 'appointments', COUNT(*) FROM appointments;
```

### Verify Provider References
```sql
SELECT
    a.id,
    p.first_name || ' ' || p.last_name as patient,
    pr.first_name || ' ' || pr.last_name as provider,
    a.status
FROM appointments a
JOIN patients p ON a.patient_id = p.id
LEFT JOIN providers pr ON a.provider_id = pr.id;
```

## 🚨 Production Warning

**NEVER run these scripts on a production database!**

These scripts are designed for development and testing only. They will:
- Delete ALL existing data
- Reset ALL sequences
- Overwrite ALL records

For production:
- Use proper backup/restore procedures
- Use database migrations only
- Never seed test data
