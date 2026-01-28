# Database Migration Instructions

## Fix: relation "payments" does not exist

To fix the error `relation "payments" does not exist`, you need to run the payments table migration.

### Option 1: Run Migration via Node.js (Recommended for Windows)

1. Open a terminal/command prompt in the `backend` directory:
   ```cmd
   cd backend
   ```

2. Make sure your `.env` file has the correct database credentials:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=aureoncare
   DB_USER=aureoncare_user
   DB_PASSWORD=your_password_here
   ```

3. Run the migration script:
   ```cmd
   node run-migration.js
   ```

4. You should see output like:
   ```
   ========================================
   AureonCare Database Migrations
   ========================================
   📊 Database: aureoncare
   👤 User: aureoncare_user
   🖥️  Host: localhost:5432

   ✅ Database connection successful

   ▶ Running migration: 004_create_payments_table.sql
   ✅ Success: 004_create_payments_table.sql

   ========================================
   ✅ Migration completed successfully!
   ========================================
   ```

### Option 2: Run Migration via psql (Linux/Mac or if you have psql in PATH)

1. Open a terminal in the `backend` directory:
   ```bash
   cd backend
   ```

2. Run the migration using psql:
   ```bash
   psql -d aureoncare -U aureoncare_user -f migrations/004_create_payments_table.sql
   ```

3. Enter your database password when prompted.

### Option 3: Run All Migrations via Script

For Linux/Mac users, you can run all migrations:

```bash
cd backend
chmod +x run_migrations.sh
./run_migrations.sh
```

## What the Migration Does

The migration creates the `payments` table with the following structure:

- **id**: Primary key
- **payment_number**: Unique payment identifier
- **patient_id**: Foreign key to patients table
- **claim_id**: Foreign key to claims table (optional)
- **amount**: Payment amount
- **payment_method**: Type of payment (credit_card, debit_card, paypal, etc.)
- **payment_status**: Status (pending, processing, completed, failed, refunded)
- **transaction_id**: External payment gateway transaction ID
- **card_last_four**: Last 4 digits of card
- **card_brand**: Card brand (Visa, Mastercard, etc.)
- **payment_date**: When payment was made
- **description**: Payment description
- **notes**: Additional notes
- **created_at**: Timestamp when record was created
- **updated_at**: Timestamp when record was last updated

The migration also creates indexes for better query performance on:
- patient_id
- claim_id
- payment_status

## Verify Migration Success

After running the migration, you can verify it worked by:

1. Starting the backend server:
   ```cmd
   cd backend
   npm start
   ```

2. The error about "payments" relation should be gone.

3. You can now use the "Process Payment" button in the RCM module.

## Troubleshooting

### Error: "psql: command not found"
- Install PostgreSQL client tools
- Or use the Node.js migration script (Option 1) which doesn't require psql

### Error: "password authentication failed"
- Check your `.env` file has the correct DB_PASSWORD
- Verify the database user exists and has the correct permissions

### Error: "database does not exist"
- Create the database first:
  ```sql
  CREATE DATABASE aureoncare;
  ```
- Or check that DB_NAME in `.env` matches your actual database name

### Migration Already Applied
- If you see an error that the table already exists, the migration has already been run
- You can safely ignore this error

## Additional Notes

- The migration is idempotent - it uses `IF NOT EXISTS` clauses
- Running it multiple times won't cause errors or duplicate data
- All migrations are located in `backend/migrations/`
- The migration file is: `004_create_payments_table.sql`
