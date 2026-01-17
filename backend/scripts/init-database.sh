#!/bin/bash
# Database Initialization Script for AureonCare
# This script sets up a fresh database with the new schema

set -e  # Exit on error

echo "=========================================="
echo "AureonCare Database Initialization"
echo "=========================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo ""
    echo "Please set it in your .env file or export it:"
    echo "  export DATABASE_URL='postgresql://user:password@localhost:5432/aureoncare'"
    exit 1
fi

echo "✓ DATABASE_URL is set"
echo ""

# Confirm with user
read -p "⚠️  This will DROP all existing data and recreate the database. Continue? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Step 1: Dropping existing schema..."
psql "$DATABASE_URL" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;" || {
    echo "❌ Failed to drop schema. Make sure PostgreSQL is running and DATABASE_URL is correct."
    exit 1
}
echo "✓ Schema dropped and recreated"

echo ""
echo "Step 2: Enabling UUID extension..."
psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" || {
    echo "❌ Failed to enable UUID extension"
    exit 1
}
echo "✓ UUID extension enabled"

echo ""
echo "Step 3: Applying base schema..."
psql "$DATABASE_URL" -f backend/schema.sql || {
    echo "❌ Failed to apply schema"
    exit 1
}
echo "✓ Base schema applied"

echo ""
echo "Step 4: Running migrations..."

# Check if migrations directory exists
if [ -d "backend/migrations" ]; then
    # Apply specific migrations in order (if they exist)
    MIGRATIONS=(
        "017_create_scheduling_system.sql"
        "023_merge_patient_id_with_user_id.sql"
    )

    for migration in "${MIGRATIONS[@]}"; do
        if [ -f "backend/migrations/$migration" ]; then
            echo "  Applying $migration..."
            psql "$DATABASE_URL" -f "backend/migrations/$migration" || {
                echo "  ⚠️  Warning: Migration $migration failed (may be already applied)"
            }
        fi
    done
    echo "✓ Migrations completed"
else
    echo "⚠️  No migrations directory found, skipping..."
fi

echo ""
echo "Step 5: Seeding test data..."
if [ -f "backend/scripts/seed-test-data.sql" ]; then
    psql "$DATABASE_URL" -f backend/scripts/seed-test-data.sql || {
        echo "❌ Failed to seed data"
        exit 1
    }
    echo "✓ Test data seeded"
else
    echo "⚠️  No seed file found, skipping..."
fi

echo ""
echo "=========================================="
echo "✅ Database initialization complete!"
echo "=========================================="
echo ""
echo "Test credentials:"
echo "  Admin: admin@aureoncare.com / password"
echo "  Patient Portal:"
echo "    - john.doe@example.com"
echo "    - jane.smith@example.com"
echo "    - bob.wilson@example.com"
echo "    - alice.brown@example.com"
echo ""
echo "You can now start the backend server:"
echo "  cd backend && npm start"
echo ""
