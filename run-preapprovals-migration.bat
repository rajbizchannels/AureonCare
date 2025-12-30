@echo off
echo.
echo ========================================
echo Running Pre-Authorization Migrations
echo ========================================
echo.

cd backend
node scripts/run-preapprovals-migration.js

echo.
echo Press any key to exit...
pause > nul
