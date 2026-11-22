# Pre-Authorization Feature Setup Guide

This guide will help you set up the Pre-Authorization (Prior Authorization) feature in your local development environment.

## Prerequisites

- PostgreSQL installed and running
- Node.js installed
- Database connection configured in `backend/.env`

## Quick Setup (Recommended)

### Option 1: Using NPM Script

From the project root directory, run:

```bash
npm run migrate:preauth
```

This will automatically:
1. Create the `insurance_payers` table (if not exists)
2. Add `insurance_payer_id` column to `patients` table
3. Create the `preapprovals` table with all required fields
4. Add `preapproval_id` column to `claims` table

### Option 2: Using Batch File (Windows)

Double-click `run-preapprovals-migration.bat` in the project root directory.

### Option 3: Manual Node.js Execution

```bash
cd backend
node scripts/run-preapprovals-migration.js
```

## Verify Installation

After running the migration, verify the tables were created:

```sql
-- Connect to your aureoncare database using psql or pgAdmin
\dt

-- Check preapprovals table structure
\d preapprovals

-- Check insurance_payers table
\d insurance_payers
```

You should see:
- `preapprovals` table with 24 columns
- `insurance_payers` table
- `patients` table with `insurance_payer_id` column
- `claims` table with `preapproval_id` column

## Troubleshooting

### Error: "relation already exists"

This is normal - it means the tables are already created. The migration script will skip existing tables.

### Error: "database 'aureoncare' does not exist"

Create the database first:

```sql
CREATE DATABASE aureoncare;
```

Then run the migration again.

### Error: "password authentication failed"

Check your `backend/.env` file and ensure:
- `DB_HOST` is set correctly (usually `localhost`)
- `DB_PORT` is correct (usually `5432`)
- `DB_USER` is correct (usually `postgres`)
- `DB_PASSWORD` matches your PostgreSQL password
- `DB_NAME` is set to `aureoncare`

Example `.env` configuration:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=aureoncare
DB_USER=postgres
DB_PASSWORD=your_password_here
```

### Error: "role 'postgres' does not exist"

If you're using a different PostgreSQL user, update `DB_USER` in your `.env` file.

## What Gets Created

### 1. insurance_payers Table
Stores insurance payer information with 11 pre-populated major payers including:
- Medicare
- Medicaid
- Blue Cross Blue Shield
- UnitedHealthcare
- And more...

### 2. preapprovals Table (Pre-Authorizations)
Fields include:
- UUID primary key
- Pre-authorization number (auto-generated)
- Patient reference
- Insurance payer reference
- Service details (dates, costs)
- Diagnosis and procedure codes
- Authorization status tracking
- Clearinghouse integration fields
- Clinical notes and supporting documents

### 3. Database Relationships
- `patients.insurance_payer_id` → `insurance_payers.id`
- `preapprovals.patient_id` → `patients.id`
- `preapprovals.insurance_payer_id` → `insurance_payers.id`
- `claims.preapproval_id` → `preapprovals.id`

## Using the Feature

After successful migration:

1. **Start the Backend Server**
   ```bash
   npm start
   ```

2. **Start the Frontend**
   ```bash
   cd frontend
   npm start
   ```

3. **Access RCM Module**
   - Navigate to Revenue Cycle Management
   - You'll see the "Pre-Authorizations" tab
   - Click "Request Pre-Authorization" to create a new pre-auth request

4. **Link to Claims**
   - When creating a claim, you can select a pre-authorization
   - The claim will be linked and tracked together

## API Endpoints

The following endpoints are now available:

- `GET /api/preapprovals` - List all pre-authorizations
- `GET /api/preapprovals/:id` - Get specific pre-authorization
- `POST /api/preapprovals` - Create new pre-authorization
- `PUT /api/preapprovals/:id` - Update pre-authorization
- `DELETE /api/preapprovals/:id` - Delete pre-authorization
- `GET /api/preapprovals/check-clearinghouse/status` - Check clearinghouse integration

## Need Help?

If you encounter any issues:

1. Check the console output from the migration script
2. Review the PostgreSQL logs
3. Verify your database connection settings
4. Ensure PostgreSQL is running

For additional support, check the main project documentation or contact the development team.
