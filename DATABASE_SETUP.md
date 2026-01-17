# Database Setup Guide

## Quick Start

Your database is currently empty. Run the initialization script to set up all tables and test data.

### For Windows:
```cmd
cd D:\AureonCare
backend\scripts\init-database.bat
```

### For Linux/Mac:
```bash
cd /home/user/AureonCare
./backend/scripts/init-database.sh
```

## What the Script Does

1. **Drops existing schema** - Cleans up any old tables
2. **Enables UUID extension** - Required for the new schema
3. **Applies base schema** - Creates all core tables (users, patients, appointments, etc.)
4. **Runs migrations** - Applies scheduling system and schema updates
5. **Seeds test data** - Populates database with sample data

## Prerequisites

### 1. PostgreSQL Running

Make sure PostgreSQL is installed and running:

**Windows:**
```cmd
# Check if running
pg_ctl status

# Start PostgreSQL (if not running)
pg_ctl start -D "C:\Program Files\PostgreSQL\15\data"
```

**Linux/Mac:**
```bash
# Check if running
sudo systemctl status postgresql

# Start PostgreSQL (if not running)
sudo systemctl start postgresql
```

### 2. Database Created

Create the AureonCare database if it doesn't exist:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE aureoncare;

# Exit
\q
```

### 3. Environment Variable Set

Create a `.env` file in the backend directory:

**backend/.env:**
```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/aureoncare
PORT=3001
NODE_ENV=development
JWT_SECRET=your-secret-key-here
```

Replace:
- `postgres` with your PostgreSQL username
- `your_password` with your PostgreSQL password
- `aureoncare` with your database name (if different)

## Test the Setup

After running the initialization script:

1. **Start the backend:**
```bash
cd backend
npm start
```

2. **Check the logs** - You should see:
```
✓ Database connected successfully
Server running on port 3001
```

3. **Test API endpoints:**
```bash
# Get all patients
curl http://localhost:3001/api/patients

# Get all appointments
curl http://localhost:3001/api/appointments
```

## Test Credentials

After initialization, you can log in with:

### Admin Portal:
- Email: `admin@aureoncare.com`
- Password: (check seed-test-data.sql for default password)

### Patient Portal:
Test patient accounts:
- `john.doe@example.com`
- `jane.smith@example.com`
- `bob.wilson@example.com`
- `alice.brown@example.com`

(All patient passwords are set in the seed script)

## Schema Overview

The new schema includes:

### Core Tables:
- **users** - All system users (UUID primary key)
- **patients** - Patient records (patient.id = user.id)
- **providers** - Healthcare providers (INTEGER primary key)
- **appointments** - Patient appointments
- **claims** - Insurance claims
- **tasks** - Task management
- **notifications** - System notifications

### Scheduling Tables (from migration 017):
- **doctor_availability** - Provider working hours
- **doctor_time_off** - Vacations and exceptions
- **appointment_type_config** - Appointment types (e.g., consultation, follow-up)
- **provider_booking_config** - Booking settings per provider
- **recurring_appointments** - Recurring appointment series
- **appointment_waitlist** - Waitlist for fully booked slots
- **appointment_reminders** - Scheduled reminders
- **booking_analytics** - Booking funnel metrics

## Key Schema Changes

### patient.id = user.id
In the new schema, patients don't have a separate `user_id` column. Instead:
- `patients.id` directly references `users.id`
- This eliminates the "Not Provided" bug
- Patient IS a user (inheritance model)

See `SCHEMA_REFACTORING_GUIDE.md` for complete details.

## Troubleshooting

### Error: "relation does not exist"
- **Solution:** Run the init script - your tables haven't been created yet

### Error: "permission denied"
- **Solution:** Check your DATABASE_URL credentials
- Make sure the PostgreSQL user has CREATE permissions

### Error: "database does not exist"
- **Solution:** Create the database first:
  ```bash
  psql -U postgres -c "CREATE DATABASE aureoncare;"
  ```

### Error: "could not connect to server"
- **Solution:** Start PostgreSQL:
  - Windows: Start "PostgreSQL" service from Services
  - Linux: `sudo systemctl start postgresql`
  - Mac: `brew services start postgresql`

### Script says "command not found: psql"
- **Solution:** Add PostgreSQL to your PATH
  - Windows: Add `C:\Program Files\PostgreSQL\15\bin` to PATH
  - Linux/Mac: Install PostgreSQL client tools

## Manual Setup (Alternative)

If the script doesn't work, you can run commands manually:

```bash
# 1. Drop and recreate schema
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 2. Enable UUID
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"

# 3. Apply schema
psql $DATABASE_URL -f backend/schema.sql

# 4. Run migrations
psql $DATABASE_URL -f backend/migrations/017_create_scheduling_system.sql
psql $DATABASE_URL -f backend/migrations/023_merge_patient_id_with_user_id.sql

# 5. Seed data
psql $DATABASE_URL -f backend/scripts/seed-test-data.sql
```

## Next Steps

After successful setup:

1. ✅ Database initialized
2. ✅ Tables created
3. ✅ Test data loaded
4. 🚀 Start backend: `cd backend && npm start`
5. 🌐 Start frontend: `cd frontend && npm start`
6. 🎉 Access application: `http://localhost:3000`

For more information, see:
- `SCHEMA_REFACTORING_GUIDE.md` - Schema design details
- `backend/scripts/README-SCHEDULING-MIGRATION.md` - Scheduling system docs
- `backend/scripts/diagnose-patient-portal.js` - Diagnostic tool
