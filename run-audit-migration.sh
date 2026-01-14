#!/bin/bash
# Check if PostgreSQL is running
if ! pg_isready -U aureoncare_app -d aureoncare 2>/dev/null; then
    echo "PostgreSQL is not running or not accessible."
    echo "Please start PostgreSQL and ensure the database 'aureoncare' exists."
    echo ""
    echo "To run the migration manually:"
    echo "  psql -U aureoncare_app -d aureoncare -f backend/migrations/040_create_audit_logs_table.sql"
    exit 1
fi

# Run the migration
echo "Running audit logs migration..."
psql -U aureoncare_app -d aureoncare -f backend/migrations/040_create_audit_logs_table.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    echo "The audit_logs table has been created."
else
    echo "❌ Migration failed. Please check the error messages above."
    exit 1
fi
