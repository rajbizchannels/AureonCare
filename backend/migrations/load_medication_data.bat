@echo off
REM =====================================================
REM Load Comprehensive Medication Data (Windows)
REM =====================================================

echo ========================================
echo AureonCare Medication Data Loader
echo ========================================
echo.

REM Database configuration (set these if different)
if "%DB_NAME%"=="" set DB_NAME=aureoncare_db
if "%DB_USER%"=="" set DB_USER=postgres
if "%DB_HOST%"=="" set DB_HOST=localhost
if "%DB_PORT%"=="" set DB_PORT=5432

echo Checking database connection...
psql -U %DB_USER% -h %DB_HOST% -p %DB_PORT% -d %DB_NAME% -c "SELECT 1;" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Cannot connect to database
    echo Please check your database configuration:
    echo   DB_NAME: %DB_NAME%
    echo   DB_USER: %DB_USER%
    echo   DB_HOST: %DB_HOST%
    echo   DB_PORT: %DB_PORT%
    echo.
    echo You can set these via environment variables or edit this script
    pause
    exit /b 1
)

echo [OK] Database connection successful
echo.

echo Checking if medications table exists...
psql -U %DB_USER% -h %DB_HOST% -p %DB_PORT% -d %DB_NAME% -c "SELECT 1 FROM medications LIMIT 1;" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Medications table not found
    echo Please run migration 015 first:
    echo   psql -U %DB_USER% -d %DB_NAME% -f backend\migrations\015_add_eprescribing_pharmacy_network.sql
    pause
    exit /b 1
)

echo [OK] Medications table found
echo.

echo Current medications will be counted...
for /f %%i in ('psql -U %DB_USER% -h %DB_HOST% -p %DB_PORT% -d %DB_NAME% -t -c "SELECT COUNT(*) FROM medications WHERE is_active = true;"') do set CURRENT_COUNT=%%i
echo Current active medications: %CURRENT_COUNT%
echo.

echo This will add 45+ comprehensive medications to your database.
echo Existing medications will not be affected (ON CONFLICT DO NOTHING).
echo.
set /p CONFIRM="Do you want to continue? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo Cancelled by user
    pause
    exit /b 0
)

echo.
echo Loading medication data...
psql -U %DB_USER% -h %DB_HOST% -p %DB_PORT% -d %DB_NAME% -f "%~dp0015_medications_sample_data.sql" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Failed to load medication data
    echo Check the error messages above for details
    pause
    exit /b 1
)

echo [OK] Medication data loaded successfully
echo.

echo Counting new medications...
for /f %%i in ('psql -U %DB_USER% -h %DB_HOST% -p %DB_PORT% -d %DB_NAME% -t -c "SELECT COUNT(*) FROM medications WHERE is_active = true;"') do set NEW_COUNT=%%i
set /a ADDED_COUNT=%NEW_COUNT%-%CURRENT_COUNT%

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Summary:
echo   Previous count: %CURRENT_COUNT%
echo   Current count:  %NEW_COUNT%
echo   Added:          %ADDED_COUNT% medications
echo.

echo Drug classes available:
psql -U %DB_USER% -h %DB_HOST% -p %DB_PORT% -d %DB_NAME% -c "SELECT drug_class, COUNT(*) as count FROM medications WHERE is_active = true GROUP BY drug_class ORDER BY drug_class;"

echo.
echo Test the search with these medications:
echo   - lisinopril (ACE Inhibitor)
echo   - metformin (Diabetes)
echo   - amoxicillin (Antibiotic)
echo   - ibuprofen (Pain)
echo   - omeprazole (GI)
echo.
echo Tip: Open ePrescribe modal in the app and search for any of these medications
echo.
pause
