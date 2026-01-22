@echo off
:: UniversalPOS - Restart Backend Service
:: RUN THIS AS ADMINISTRATOR after code updates

echo ============================================
echo Restarting UniversalPOS Backend Service
echo ============================================
echo.

:: Check for admin privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: This script must be run as Administrator!
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

echo Stopping service...
net stop "UniversalPOS-Backend"

echo Waiting 2 seconds...
timeout /t 2 /nobreak > nul

echo Starting service...
net start "UniversalPOS-Backend"

echo.
echo Verifying server is responding...
timeout /t 3 /nobreak > nul
curl -s http://localhost:5000/api/categories > nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo SUCCESS: Server is running and responding!
) else (
    echo.
    echo WARNING: Server may still be starting. Wait a few seconds and try again.
)

echo.
pause
