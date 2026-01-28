@echo off
REM Run Database Migrations on Windows
REM This script applies all SQL migration files in the migrations directory

echo ============================================
echo Running AureonCare Database Migrations
echo ============================================
echo.

REM Check if psql is available
where psql >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: PostgreSQL command-line tools (psql) not found.
    echo Please install PostgreSQL and add it to your PATH.
    echo Alternatively, use: npm run migrate
    pause
    exit /b 1
)

REM Load environment variables from .env file if it exists
if exist .env (
    echo Loading environment variables from .env...
    for /f "delims=" %%x in (.env) do (set "%%x")
)

REM Set default values if not provided
if "%DB_USER%"=="" set DB_USER=postgres
if "%DB_HOST%"=="" set DB_HOST=localhost
if "%DB_NAME%"=="" set DB_NAME=aureoncare
if "%DB_PORT%"=="" set DB_PORT=5432

echo.
echo Database Configuration:
echo   Host: %DB_HOST%:%DB_PORT%
echo   Database: %DB_NAME%
echo   User: %DB_USER%
echo.

REM Run each migration file in order
echo Running migration files...
echo.

for %%f in (migrations\*.sql) do (
    echo Applying: %%~nxf
    psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f "%%f"
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: Failed to apply %%~nxf
        echo You may need to enter the database password.
        pause
        exit /b 1
    )
    echo ✓ Successfully applied %%~nxf
    echo.
)

echo ============================================
echo All migrations completed successfully!
echo ============================================
pause
