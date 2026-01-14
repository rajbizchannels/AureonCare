# How to Run Migration 032 - Add Insurance Payer to Patients

## The Error
```
error: column "insurance_payer_id" does not exist
```

This error occurs because the migration file was created but never executed on your database.

## Quick Fix - Choose ONE method below:

### Method 1: Using psql (Recommended)

1. Open Command Prompt or PowerShell
2. Navigate to the migrations directory:
   ```bash
   cd D:\AureonCare\backend\migrations
   ```

3. Run the migration using psql:
   ```bash
   psql -U postgres -d aureoncare -f RUN_032_INSURANCE_PAYER.sql
   ```

4. Enter your database password when prompted: `AureonCare2024!`

### Method 2: Using pgAdmin

1. Open pgAdmin
2. Connect to your PostgreSQL server
3. Select the `aureoncare` database
4. Click on **Tools** → **Query Tool**
5. Open the file: `D:\AureonCare\backend\migrations\RUN_032_INSURANCE_PAYER.sql`
6. Click the **Execute** button (or press F5)
7. You should see: "Migration 032 completed successfully!"

### Method 3: Using DBeaver or Other Database Client

1. Open your database client
2. Connect to the `aureoncare` database
3. Open SQL editor
4. Load and execute: `D:\AureonCare\backend\migrations\RUN_032_INSURANCE_PAYER.sql`
5. Verify the output shows success

### Method 4: Using Node.js Script

1. Make sure PostgreSQL is running
2. Open Command Prompt in the backend directory:
   ```bash
   cd D:\AureonCare\backend
   ```

3. Run the migration script:
   ```bash
   node scripts/run-single-migration.js 032_add_insurance_payer_to_patients.sql
   ```

## Verification

After running the migration, verify it worked by running this SQL query:

```sql
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'patients'
  AND column_name = 'insurance_payer_id';
```

You should see:
```
column_name          | data_type | is_nullable
insurance_payer_id   | uuid      | YES
```

## What This Migration Does

1. ✅ Adds `insurance_payer_id` column to the `patients` table (UUID type)
2. ✅ Creates a foreign key constraint to the `insurance_payers` table
3. ✅ Creates an index for better query performance
4. ✅ Adds documentation comment to the column

## After Running the Migration

1. Restart your backend server if it's running
2. Try updating a patient again - the error should be gone
3. You can now select an insurance payer when editing patient profiles

## Troubleshooting

**If you see "relation 'insurance_payers' does not exist":**
- You need to run migration 031 first: `031_create_insurance_payers.sql`
- Run: `psql -U postgres -d aureoncare -f 031_create_insurance_payers.sql`
- Then run migration 032 again

**If PostgreSQL is not in your PATH:**
- Find your PostgreSQL installation (usually `C:\Program Files\PostgreSQL\16\bin\`)
- Use the full path: `"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d aureoncare -f RUN_032_INSURANCE_PAYER.sql`

**If you can't remember your database password:**
- Check your `.env` file: `D:\AureonCare\backend\.env`
- Look for `DB_PASSWORD=AureonCare2024!`
