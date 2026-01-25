@echo off
:: ============================================
:: UniversalPOS SQLite Service Installer
:: This script installs the POS as a Windows service using NSSM
:: Run this script as Administrator
:: ============================================

echo.
echo ========================================
echo  UniversalPOS Service Installer
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

:: Get the directory of this script
set SCRIPT_DIR=%~dp0
set BACKEND_DIR=%SCRIPT_DIR%backend
set NSSM_PATH=%SCRIPT_DIR%tools\nssm.exe

:: Check if NSSM exists
if not exist "%NSSM_PATH%" (
    echo ERROR: NSSM not found at %NSSM_PATH%
    echo Please run: download-nssm.bat first
    pause
    exit /b 1
)

:: Check if Node.js is installed
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    pause
    exit /b 1
)

:: Get Node.js path
for /f "tokens=*" %%i in ('where node') do set NODE_PATH=%%i

echo Found Node.js at: %NODE_PATH%
echo Backend directory: %BACKEND_DIR%
echo.

:: Stop existing service if running
echo Stopping existing service (if any)...
"%NSSM_PATH%" stop UniversalPOS >nul 2>&1
timeout /t 2 >nul

:: Remove existing service
echo Removing existing service (if any)...
"%NSSM_PATH%" remove UniversalPOS confirm >nul 2>&1

:: Install the new service
echo Installing UniversalPOS service...
"%NSSM_PATH%" install UniversalPOS "%NODE_PATH%" "%BACKEND_DIR%\server.js"

if %errorLevel% neq 0 (
    echo ERROR: Failed to install service
    pause
    exit /b 1
)

:: Configure the service
echo Configuring service...

:: Set the application directory
"%NSSM_PATH%" set UniversalPOS AppDirectory "%BACKEND_DIR%"

:: Set display name and description
"%NSSM_PATH%" set UniversalPOS DisplayName "Universal POS Server"
"%NSSM_PATH%" set UniversalPOS Description "Universal Point of Sale system - SQLite backend server"

:: Set to start automatically
"%NSSM_PATH%" set UniversalPOS Start SERVICE_AUTO_START

:: Configure logging
"%NSSM_PATH%" set UniversalPOS AppStdout "%BACKEND_DIR%\logs\service.log"
"%NSSM_PATH%" set UniversalPOS AppStderr "%BACKEND_DIR%\logs\service-error.log"
"%NSSM_PATH%" set UniversalPOS AppRotateFiles 1
"%NSSM_PATH%" set UniversalPOS AppRotateBytes 1048576

:: Set environment variables
"%NSSM_PATH%" set UniversalPOS AppEnvironmentExtra "JWT_SECRET=pos_secret_key_change_in_production"
"%NSSM_PATH%" set UniversalPOS AppEnvironmentExtra+ "NODE_ENV=production"

:: Create logs directory if it doesn't exist
if not exist "%BACKEND_DIR%\logs" mkdir "%BACKEND_DIR%\logs"

:: Start the service
echo Starting UniversalPOS service...
"%NSSM_PATH%" start UniversalPOS

if %errorLevel% neq 0 (
    echo WARNING: Service may not have started properly
    echo Check logs at: %BACKEND_DIR%\logs\service.log
) else (
    echo.
    echo ========================================
    echo  SUCCESS! UniversalPOS is now running
    echo ========================================
    echo.
    echo The service is configured to:
    echo  - Start automatically when Windows boots
    echo  - Restart automatically if it crashes
    echo  - Log to: %BACKEND_DIR%\logs\
    echo.
    echo Access the POS at: http://localhost:5000
    echo Default login: admin / admin123
    echo.
)

pause
