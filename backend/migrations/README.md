# AureonCare Database Migrations

This directory contains SQL migration scripts to update the database schema.

## Quick Start

From the `backend` directory, run:

```bash
./run_migrations.sh
```

Or manually run each migration:

```bash
cd backend
psql -d aureoncare -U aureoncare_user -f migrations/001_update_users_table.sql
psql -d aureoncare -U aureoncare_user -f migrations/002_update_tasks_table.sql
```

## Migrations

### 001_update_users_table.sql
- Drops and recreates the `users` table with the correct schema
- Adds columns: name, role, practice, avatar, email, phone, license, specialty, preferences
- Inserts sample users (admin, doctor, staff)
- Creates indexes for performance

### 002_update_tasks_table.sql
- Adds `description` column to tasks table if it doesn't exist
- Inserts sample tasks for testing
- Creates indexes for performance

## What This Fixes

The original schema had an incomplete users table structure. This migration:
1. ✅ Fixes the "column 'name' does not exist" error
2. ✅ Ensures all required columns exist
3. ✅ Adds sample data for testing
4. ✅ Creates indexes for better query performance

## After Running Migrations

Start the backend server:
```bash
cd backend
npm start
```

The application should now work correctly with all features:
- ✅ User management
- ✅ Tasks management
- ✅ Dynamic user profiles
- ✅ Role-based permissions
