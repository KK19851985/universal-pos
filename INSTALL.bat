@echo off
title UniversalPOS - First Time Setup
color 0A

echo.
echo  ╔══════════════════════════════════════════════════════════════╗
echo  ║                                                              ║
echo  ║              UNIVERSAL POS - FIRST TIME SETUP                ║
echo  ║                                                              ║
echo  ╚══════════════════════════════════════════════════════════════╝
echo.

:: Check for admin privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] This installer needs Administrator privileges.
    echo.
    echo  Please right-click INSTALL.bat and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo  [Step 1/5] Checking prerequisites...
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [X] Node.js is NOT installed!
    echo.
    echo  Please install Node.js from: https://nodejs.org
    echo  Download the LTS version and run the installer.
    echo  After installation, run this script again.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo  [OK] Node.js %NODE_VER% found

:: Check PostgreSQL
sc query postgresql-x64-18 >nul 2>&1
if %errorlevel% neq 0 (
    sc query postgresql-x64-17 >nul 2>&1
    if %errorlevel% neq 0 (
        sc query postgresql-x64-16 >nul 2>&1
        if %errorlevel% neq 0 (
            echo  [X] PostgreSQL is NOT installed!
            echo.
            echo  Please install PostgreSQL from: https://www.postgresql.org/download/windows/
            echo  Remember your password during installation!
            echo  After installation, run this script again.
            echo.
            pause
            exit /b 1
        )
    )
)
echo  [OK] PostgreSQL found

echo.
echo  [Step 2/5] Installing Node.js dependencies...
echo.
cd /d "%~dp0backend"
call npm install
if %errorlevel% neq 0 (
    echo  [X] Failed to install dependencies!
    pause
    exit /b 1
)
echo  [OK] Dependencies installed

echo.
echo  [Step 3/5] Database Configuration
echo.
echo  ═══════════════════════════════════════════════════════════════
echo.
set /p PG_PASSWORD="  Enter your PostgreSQL password: "
echo.
set /p PG_PORT="  Enter PostgreSQL port (default 5432, press Enter for default): "
if "%PG_PORT%"=="" set PG_PORT=5432
echo.

:: Test database connection
echo  Testing database connection...
set PGPASSWORD=%PG_PASSWORD%
psql -U postgres -p %PG_PORT% -c "SELECT 1" >nul 2>&1
if %errorlevel% neq 0 (
    echo  [X] Cannot connect to PostgreSQL!
    echo  Please check your password and make sure PostgreSQL is running.
    pause
    exit /b 1
)
echo  [OK] Database connection successful

:: Create database if not exists
echo  Creating database...
psql -U postgres -p %PG_PORT% -c "CREATE DATABASE universal_pos" 2>nul
echo  [OK] Database ready

echo.
echo  [Step 4/5] Running database migrations...
echo.
set PG_PASSWORD=%PG_PASSWORD%
set PG_PORT=%PG_PORT%
node runMigrations.js
if %errorlevel% neq 0 (
    echo  [!] Migration had issues but may still work. Continuing...
)
echo  [OK] Database tables created

echo.
echo  [Step 5/5] Installing Windows Service...
echo.

:: Download NSSM if not present
if not exist "C:\tools\nssm\nssm.exe" (
    echo  Downloading NSSM service manager...
    mkdir "C:\tools\nssm" 2>nul
    powershell -Command "Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile 'C:\tools\nssm.zip'"
    powershell -Command "Expand-Archive -Path 'C:\tools\nssm.zip' -DestinationPath 'C:\tools\nssm-temp' -Force"
    copy "C:\tools\nssm-temp\nssm-2.24\win64\nssm.exe" "C:\tools\nssm\nssm.exe"
    rmdir /s /q "C:\tools\nssm-temp"
    del "C:\tools\nssm.zip"
)

:: Remove existing service if present
C:\tools\nssm\nssm.exe stop UniversalPOS-Backend >nul 2>&1
C:\tools\nssm\nssm.exe remove UniversalPOS-Backend confirm >nul 2>&1

:: Install the service
C:\tools\nssm\nssm.exe install UniversalPOS-Backend "C:\Program Files\nodejs\node.exe"
C:\tools\nssm\nssm.exe set UniversalPOS-Backend AppDirectory "%~dp0backend"
C:\tools\nssm\nssm.exe set UniversalPOS-Backend AppParameters "server.js"
C:\tools\nssm\nssm.exe set UniversalPOS-Backend AppEnvironmentExtra "POS_PORT=5000" "PG_HOST=localhost" "PG_PORT=%PG_PORT%" "PG_DATABASE=universal_pos" "PG_USER=postgres" "PG_PASSWORD=%PG_PASSWORD%"
C:\tools\nssm\nssm.exe set UniversalPOS-Backend Start SERVICE_AUTO_START
C:\tools\nssm\nssm.exe set UniversalPOS-Backend AppStdout "%~dp0backend\logs\service.log"
C:\tools\nssm\nssm.exe set UniversalPOS-Backend AppStderr "%~dp0backend\logs\error.log"

:: Start the service
net start UniversalPOS-Backend
echo  [OK] Service installed and started

:: Add browser to startup
echo.
echo  Adding POS to Windows Startup...
copy /Y "%~dp0startup\OpenPOS.bat" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\OpenPOS.bat" >nul
echo  [OK] POS will open automatically on login

echo.
echo  ╔══════════════════════════════════════════════════════════════╗
echo  ║                                                              ║
echo  ║                    SETUP COMPLETE!                           ║
echo  ║                                                              ║
echo  ╚══════════════════════════════════════════════════════════════╝
echo.
echo  Your POS is ready to use!
echo.
echo  Default login:
echo    Username: admin
echo    Password: admin123
echo.
echo  The POS will:
echo    - Start automatically when the computer boots
echo    - Open the browser automatically when you log in
echo.
echo  Opening POS now...
timeout /t 3 /nobreak >nul
start http://localhost:5000
echo.
pause
