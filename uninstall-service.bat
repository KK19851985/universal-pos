@echo off
:: ============================================
:: UniversalPOS Service Uninstaller
:: Run this script as Administrator
:: ============================================

echo.
echo ========================================
echo  UniversalPOS Service Uninstaller
echo ========================================
echo.

:: Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script requires Administrator privileges.
    echo Please right-click and select "Run as administrator"
    pause
    exit /b 1
)

set SCRIPT_DIR=%~dp0
set NSSM_PATH=%SCRIPT_DIR%tools\nssm.exe

if not exist "%NSSM_PATH%" (
    echo ERROR: NSSM not found at %NSSM_PATH%
    pause
    exit /b 1
)

:: Stop the service
echo Stopping UniversalPOS service...
"%NSSM_PATH%" stop UniversalPOS

timeout /t 3 >nul

:: Remove the service
echo Removing UniversalPOS service...
"%NSSM_PATH%" remove UniversalPOS confirm

if %errorLevel% eq 0 (
    echo.
    echo Service uninstalled successfully!
    echo.
) else (
    echo.
    echo WARNING: Service may not have been fully removed
    echo.
)

pause
