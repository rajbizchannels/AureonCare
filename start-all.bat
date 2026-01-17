@echo off
echo ================================
echo Starting AureonCare Complete System
echo ================================
echo.

REM Start PostgreSQL if not running
net start postgresql-x64-15 2>nul
if %errorlevel%==0 (
    echo PostgreSQL started
) else (
    echo PostgreSQL already running
)

REM Start Redis if not running
net start Redis 2>nul
if %errorlevel%==0 (
    echo Redis started
) else (
    echo Redis already running or using Memurai
)

REM Start Memurai if not running
net start Memurai 2>nul

echo.
echo Starting Backend Server...
start "AureonCare Backend" cmd /k "cd D:\AureonCare\backend && node server.js"

echo Waiting 5 seconds for backend to start...
timeout /t 5 /nobreak >nul

echo Starting Frontend...
start "AureonCare Frontend" cmd /k "cd D:\AureonCare\frontend && npm start"

echo.
echo ================================
echo AureonCare is starting...
echo Backend: http://localhost:3000
echo Frontend: http://localhost:3001
echo ================================
echo.
echo Press any key to open browser...
pause >nul

start http://localhost:3000

echo.
echo Both windows will open in separate command prompts
echo Close this window when done
pause