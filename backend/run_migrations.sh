#!/bin/bash

# MedFlow Database Migrations Runner
# This script applies all pending migrations to the database

set -e  # Exit on error

DB_NAME="medflow"
DB_USER="medflow_user"
MIGRATIONS_DIR="./migrations"

echo "========================================"
echo "MedFlow Database Migrations"
echo "========================================"
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql command not found"
    echo "Please install PostgreSQL client tools"
    exit 1
fi

# Check if migrations directory exists
if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "❌ Error: Migrations directory not found: $MIGRATIONS_DIR"
    exit 1
fi

echo "📊 Database: $DB_NAME"
echo "👤 User: $DB_USER"
echo ""

# Run each migration file in order
for migration in "$MIGRATIONS_DIR"/*.sql; do
    if [ -f "$migration" ]; then
        echo "▶ Running migration: $(basename "$migration")"
        psql -d "$DB_NAME" -U "$DB_USER" -f "$migration"
        if [ $? -eq 0 ]; then
            echo "✅ Success: $(basename "$migration")"
        else
            echo "❌ Failed: $(basename "$migration")"
            exit 1
        fi
        echo ""
    fi
done

echo "========================================"
echo "✅ All migrations completed successfully!"
echo "========================================"
