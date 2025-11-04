# Database Reset and Seed Guide

This guide explains how to reset the MedFlow database and populate it with fresh, compatible test data.

## Files

### Option 1: Using DELETE (Recommended - Works with standard permissions)
- `reset-and-seed-delete.sql` - SQL script using DELETE statements (requires only DELETE permission)
- `run-reset-and-seed-delete.js` - Node.js script to execute the DELETE version

### Option 2: Using TRUNCATE (Requires TRUNCATE permission)
- `reset-and-seed.sql` - SQL script using TRUNCATE statements (requires TRUNCATE permission)
- `run-reset-and-seed.js` - Node.js script to execute the TRUNCATE version

### Permission Management
- `grant-permissions.sql` - Grant all necessary permissions to database user (run once as admin)

## Prerequisites

1. **PostgreSQL Database Running**
   - Ensure your PostgreSQL database is running on `localhost:5432`
   - Or update connection settings in `.env` file

2. **Environment Variables**
   - Make sure `backend/.env` file exists with database credentials:
     ```
     DB_HOST=localhost
     DB_PORT=5432
     DB_NAME=medflow
     DB_USER=medflow_user
     DB_PASSWORD=your_password_here
     ```

3. **Node.js Dependencies**
   - Run `npm install` in the backend directory if not already done

## How to Run

### Option 1: Using DELETE (Recommended - Works without special permissions)

This method uses DELETE statements which work with standard database permissions.

```bash
cd backend
node scripts/run-reset-and-seed-delete.js
```

Or using psql:
```bash
cd backend/scripts
psql -h localhost -U medflow_user -d medflow -f reset-and-seed-delete.sql
```

### Option 2: Using TRUNCATE (Requires TRUNCATE permission)

This method is faster but requires TRUNCATE privilege. If you get permission errors, use Option 1 instead.

```bash
cd backend
node scripts/run-reset-and-seed.js
```

Or using psql:
```bash
cd backend/scripts
psql -h localhost -U medflow_user -d medflow -f reset-and-seed.sql
```

### Option 3: Grant Permissions First (One-time setup)

If you prefer to use TRUNCATE and have database admin access, run this once:

```bash
# Run as database administrator/superuser
psql -h localhost -U postgres -d medflow -f scripts/grant-permissions.sql
```

After granting permissions, you can use either Option 1 or Option 2.

## What Gets Reset

The script will **remove all data** from these tables:
- users (staff accounts)
- patients
- appointments
- medical_records
- prescriptions
- diagnosis
- claims
- payments
- tasks
- notifications
- telehealth_sessions
- fhir_resources
- patient_portal_sessions
- social_auth
- practices

**Note:** The table structure/schema is preserved. Only data is removed.

## Test Data Inserted

### Practices
- **Central Medical Group** (San Francisco, CA) - Enterprise tier
- **Riverside Family Practice** (Portland, OR) - Professional tier

### Users (Healthcare Staff)
All staff use password: `password123`

| Name | Email | Role | Specialty |
|------|-------|------|-----------|
| Sarah Chen | sarah.chen@medflow.com | admin | Family Medicine |
| James Wilson | james.wilson@medflow.com | doctor | Internal Medicine |
| Emily Rodriguez | emily.rodriguez@medflow.com | doctor | Pediatrics |
| Michael Brown | michael.brown@medflow.com | nurse | Registered Nurse |
| Lisa Anderson | lisa.anderson@medflow.com | reception | - |

### Patients (with Portal Access)
All patients use password: `password123`

| Name | Email | MRN | DOB | Portal Enabled |
|------|-------|-----|-----|----------------|
| John Smith | john.smith@email.com | MRN-001001 | 1985-03-15 | ✅ Yes |
| Maria Garcia | maria.garcia@email.com | MRN-001002 | 1990-07-22 | ✅ Yes |
| Robert Johnson | robert.johnson@email.com | MRN-001003 | 1975-11-30 | ✅ Yes |
| Emily Davis | parent.davis@email.com | MRN-002001 | 2015-05-10 | ✅ Yes |
| David Lee | david.lee@email.com | MRN-001004 | 1988-02-14 | ✅ Yes |

### Other Data
- **5 Appointments** (3 scheduled, 2 completed)
- **3 Medical Records**
- **4 Prescriptions**
- **4 Diagnoses**
- **3 Claims**
- **3 Payments**
- **4 Tasks**
- **4 Notifications**

## Test Credentials

### Patient Portal Testing
You can login to the patient portal with any of these accounts:
- **Email:** `john.smith@email.com` | **Password:** `password123`
- **Email:** `maria.garcia@email.com` | **Password:** `password123`
- **Email:** `robert.johnson@email.com` | **Password:** `password123`

### Admin/Staff Testing
- **Email:** `sarah.chen@medflow.com` | **Password:** `password123`
- **Email:** `james.wilson@medflow.com` | **Password:** `password123`

## Verification

After running the reset script, you should see output like:

```
========================================
DATABASE RESET AND SEED COMPLETED
========================================

Data Summary:
  Practices: 2
  Users (Staff): 5
  Patients: 5
  Appointments: 5
  Medical Records: 3
  Prescriptions: 4
  Diagnoses: 4
  Claims: 3
  Payments: 3
  Tasks: 4
  Notifications: 4
```

## Troubleshooting

### Error: Permission denied for table [tablename]
**Solution:** Use the DELETE version instead of TRUNCATE:
```bash
node scripts/run-reset-and-seed-delete.js
```

Or grant permissions (requires database admin access):
```bash
psql -h localhost -U postgres -d medflow -f scripts/grant-permissions.sql
```

### Error: Cannot connect to database
- Make sure PostgreSQL is running: `sudo service postgresql status` (Linux) or check Services (Windows)
- Check your `.env` file has correct credentials
- Verify database exists: `psql -l | grep medflow`

### Error: Module not found
- Run `npm install` in the backend directory

### Error: Tables don't exist
- Run migrations first: `node scripts/migrate-enhanced.js`
- Then run the reset script

### Which version should I use?

| Version | Pros | Cons | When to Use |
|---------|------|------|-------------|
| **DELETE** | ✅ Works with standard permissions<br>✅ No admin access needed | ⚠️ Slightly slower | **Recommended** - Use when you get permission errors |
| **TRUNCATE** | ✅ Faster<br>✅ Resets auto-increment sequences | ❌ Requires TRUNCATE permission | Use after granting permissions |

## Safety Notes

⚠️ **WARNING:** This script will **DELETE ALL DATA** in your database!

- Only run this in development environments
- Do NOT run in production
- Always backup your data first if you need to preserve anything

## Next Steps

After resetting the database:

1. **Start the backend server:**
   ```bash
   npm start
   ```

2. **Test patient portal login:**
   - Navigate to the patient portal
   - Login with: `john.smith@email.com` / `password123`
   - Try creating an appointment
   - Verify it appears in the appointments list

3. **Test staff login:**
   - Login with: `sarah.chen@medflow.com` / `password123`
   - Verify all modules work correctly

## Support

If you encounter any issues, check:
1. Database is running
2. Environment variables are set correctly
3. Migrations have been run (`migrate-enhanced.js`)
4. All npm dependencies are installed
