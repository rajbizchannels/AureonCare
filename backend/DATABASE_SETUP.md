# MedFlow Database Setup Guide

## Overview
This document describes the database setup process and fixes applied to resolve schema and connectivity issues.

## Database Configuration

### Connection Details
- **Database:** medflow
- **User:** medflow_user
- **Host:** localhost
- **Port:** 5432

Connection details are stored in `/backend/.env`

## Initial Setup Steps Completed

### 1. Database and User Creation
```sql
CREATE DATABASE medflow;
CREATE USER medflow_user WITH PASSWORD 'MedFlow2024SecurePass!';
GRANT ALL PRIVILEGES ON DATABASE medflow TO medflow_user;
GRANT ALL ON SCHEMA public TO medflow_user;
```

### 2. Schema Initialization
Applied `schema.sql` which creates all base tables:
- patients
- providers
- appointments
- claims
- notifications
- tasks
- users

### 3. Migrations Applied

#### Migration 008: Add user_id to providers/patients
- Adds `user_id` column to providers table with foreign key to users
- Adds `user_id` column to patients table with foreign key to users
- Adds unique email constraints
- Creates indexes for performance

**File:** `migrations/008_add_user_id_to_providers_patients.sql`

#### Migration 010: Add status to users
- Adds `status` column to users table (values: pending, active, suspended)
- Sets default to 'active'
- Updates existing users to active status
- Creates index on status column

**File:** `migrations/010_add_status_to_users.sql`

## Backend Server Configuration

### Redis Configuration
Redis has been made optional to simplify development setup. The server will start without Redis and log a warning message.

To enable Redis in production:
1. Uncomment the Redis client initialization code in `server.js`
2. Ensure Redis is running on localhost:6379
3. Set `REDIS_PASSWORD` in `.env` if authentication is required

### Server Startup
```bash
cd /home/user/MedFlow/backend
node server.js
```

Server will listen on port 3000 by default.

## API Endpoints Verified

### Test Endpoint
```bash
curl http://localhost:3000/api/test
```

### Providers Endpoint
```bash
curl http://localhost:3000/api/providers
```

## Database Schema Verification

Check providers table schema:
```bash
PGPASSWORD='MedFlow2024SecurePass!' psql -h localhost -U medflow_user -d medflow -c "\d providers"
```

Check users table schema:
```bash
PGPASSWORD='MedFlow2024SecurePass!' psql -h localhost -U medflow_user -d medflow -c "\d users"
```

## Foreign Key Relationships

### Current Foreign Keys in appointments table:
- `patient_id` → patients(id) ON DELETE CASCADE
- `provider_id` → providers(id) ON DELETE SET NULL

### Current Foreign Keys in providers table:
- `user_id` → users(id) ON DELETE CASCADE

### Current Foreign Keys in patients table:
- `user_id` → users(id) ON DELETE CASCADE

## Issues Fixed

1. **Database didn't exist** - Created medflow database
2. **User didn't exist** - Created medflow_user with proper permissions
3. **user_id columns missing** - Added via migration 008
4. **status column missing** - Added via migration 010
5. **Redis blocking startup** - Made Redis optional
6. **Foreign key on appointments** - Already correct in schema.sql

## Next Steps

For new deployments:
1. Create database and user (see step 1 above)
2. Run `psql -d medflow -U medflow_user -f schema.sql`
3. Run all migrations in order from `migrations/` directory
4. Configure `.env` file with database credentials
5. Start server with `node server.js`

## Troubleshooting

### Connection refused
- Ensure PostgreSQL is running: `service postgresql status`
- Check pg_hba.conf for authentication method
- Verify credentials in `.env` file

### Column does not exist errors
- Run all migrations in order
- Check `information_schema.columns` for table structure

### Redis errors (non-critical)
- Redis is optional for development
- Server will continue without Redis
- Enable Redis in production for session caching
