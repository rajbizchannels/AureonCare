@echo off
REM Database Initialization Script for AureonCare (Windows)
REM This script sets up a fresh database with the new schema

echo ==========================================
echo AureonCare Database Initialization
echo ==========================================
echo.

REM Check if DATABASE_URL is set
if "%DATABASE_URL%"=="" (
    echo ERROR: DATABASE_URL environment variable is not set
    echo.
    echo Please set it in your .env file or set it:
    echo   set DATABASE_URL=postgresql://user:password@localhost:5432/aureoncare
    exit /b 1
)

echo DATABASE_URL is set
echo.

set /p CONFIRM="This will DROP all existing data and recreate the database. Continue? (y/N): "
if /i not "%CONFIRM%"=="y" (
    echo Cancelled.
    exit /b 0
)

echo.
echo Step 1: Dropping existing schema...
psql "%DATABASE_URL%" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;" || (
    echo Failed to drop schema. Make sure PostgreSQL is running and DATABASE_URL is correct.
    exit /b 1
)
echo Schema dropped and recreated

echo.
echo Step 2: Enabling UUID extension...
psql "%DATABASE_URL%" -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" || (
    echo Failed to enable UUID extension
    exit /b 1
)
echo UUID extension enabled

echo.
echo Step 3: Applying base schema...
psql "%DATABASE_URL%" -f backend\schema.sql || (
    echo Failed to apply schema
    exit /b 1
)
echo Base schema applied

echo.
echo Step 4: Running migrations...
if exist backend\migrations (
    if exist backend\migrations\017_create_scheduling_system.sql (
        echo   Applying 017_create_scheduling_system.sql...
        psql "%DATABASE_URL%" -f backend\migrations\017_create_scheduling_system.sql
    )
    if exist backend\migrations\023_merge_patient_id_with_user_id.sql (
        echo   Applying 023_merge_patient_id_with_user_id.sql...
        psql "%DATABASE_URL%" -f backend\migrations\023_merge_patient_id_with_user_id.sql
    )
    echo Migrations completed
) else (
    echo No migrations directory found, skipping...
)

echo.
echo Step 5: Seeding test data...
if exist backend\scripts\seed-test-data.sql (
    psql "%DATABASE_URL%" -f backend\scripts\seed-test-data.sql || (
        echo Failed to seed data
        exit /b 1
    )
    echo Test data seeded
) else (
    echo No seed file found, skipping...
)

echo.
echo ==========================================
echo Database initialization complete!
echo ==========================================
echo.
echo Test credentials:
echo   Admin: admin@aureoncare.com / password
echo   Patient Portal:
echo     - john.doe@example.com
echo     - jane.smith@example.com
echo     - bob.wilson@example.com
echo     - alice.brown@example.com
echo.
echo You can now start the backend server:
echo   cd backend ^&^& npm start
echo.
