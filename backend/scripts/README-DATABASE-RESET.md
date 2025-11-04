# Database Reset and Seed Guide

This guide explains how to reset the MedFlow database and populate it with fresh, compatible test data.

## Files

### Option 1: Simple Schema Version (Try This First!)
- `reset-and-seed-simple.sql` - Minimal data, works with any schema
- `run-reset-simple.js` - Runner for simple version
- **Use this if you get "column does not exist" errors**

### Option 2: Using DELETE (Works with standard permissions)
- `reset-and-seed-delete.sql` - Full test data using DELETE statements
- `run-reset-and-seed-delete.js` - Runner for DELETE version

### Option 3: Using TRUNCATE (Requires TRUNCATE permission)
- `reset-and-seed.sql` - Full test data using TRUNCATE statements
- `run-reset-and-seed.js` - Runner for TRUNCATE version

### Utilities
- `inspect-schema.js` - Inspect your actual database schema
- `grant-permissions.sql` - Grant permissions (requires admin access)

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

### ⭐ Quick Start (Recommended)

If you're getting schema errors, start with the simple version:

```bash
cd backend
node scripts/run-reset-simple.js
```

This creates minimal test data that works with any schema version.

---

### Option 1: Simple Schema (Try This First!)

**Use this if you get "column does not exist" errors**

```bash
cd backend
node scripts/run-reset-simple.js
```

**What it does:**
- ✅ Works with basic or enhanced schema
- ✅ Creates 3 users, 3 patients, 2 appointments
- ✅ Minimal data, maximum compatibility
- ✅ Uses ON CONFLICT DO NOTHING for safety

---

### Option 2: Full Data with DELETE

Once the simple version works, try the full data version:

```bash
cd backend
node scripts/run-reset-and-seed-delete.js
```

**What it does:**
- ✅ Complete test dataset (5 patients, 5 appointments, etc.)
- ✅ Works with standard permissions
- ✅ Uses DELETE statements

---

### Option 3: Inspect Your Schema

If you're unsure what schema you have:

```bash
cd backend
node scripts/inspect-schema.js
```

This shows all tables and columns in your database.

---

### Option 4: Grant Permissions (Advanced)

If you have admin access and want to use TRUNCATE:

```bash
psql -h localhost -U postgres -d medflow -f backend/scripts/grant-permissions.sql
```

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

### Error: column "user_id" of relation "tasks" does not exist
**Solution:** Your database has an older schema. Use the simple version:
```bash
node scripts/run-reset-simple.js
```

This version works with any schema and doesn't assume specific columns exist.

---

### Error: Permission denied for table [tablename]
**Solution:** Use the simple or DELETE version:
```bash
node scripts/run-reset-simple.js
```

Or grant permissions (requires database admin access):
```bash
psql -h localhost -U postgres -d medflow -f scripts/grant-permissions.sql
```

---

### Error: Cannot connect to database
- Make sure PostgreSQL is running: `sudo service postgresql status` (Linux) or check Services (Windows)
- Check your `.env` file has correct credentials
- Verify database exists: `psql -l | grep medflow`

---

### Error: Module not found
- Run `npm install` in the backend directory

---

### Error: Tables don't exist
- Run migrations first: `node scripts/migrate-enhanced.js`
- Then run the reset script

---

### Which version should I use?

| Version | Pros | Cons | When to Use |
|---------|------|------|-------------|
| **SIMPLE** | ✅ Works with any schema<br>✅ No permission issues<br>✅ Minimal data | ⚠️ Less test data | **Start here** - Works everywhere |
| **DELETE** | ✅ Full test data<br>✅ Standard permissions | ⚠️ Requires matching schema | Use after simple version works |
| **TRUNCATE** | ✅ Fastest<br>✅ Resets sequences | ❌ Requires TRUNCATE permission<br>❌ Requires matching schema | Advanced users only |

---

### How to check your schema

```bash
node scripts/inspect-schema.js
```

This will show all your tables and columns.

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
