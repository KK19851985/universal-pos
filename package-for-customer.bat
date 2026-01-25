@echo off
title UniversalPOS - Build Customer Package
color 0B

echo.
echo  ╔══════════════════════════════════════════════════════════════╗
echo  ║                                                              ║
echo  ║           BUILD CUSTOMER DELIVERY PACKAGE                    ║
echo  ║                                                              ║
echo  ╚══════════════════════════════════════════════════════════════╝
echo.

set PACKAGE_DIR=%~dp0..\UniversalPOS-Customer-Package
set SOURCE_DIR=%~dp0

:: Clean previous build
if exist "%PACKAGE_DIR%" (
    echo Removing old package...
    rmdir /s /q "%PACKAGE_DIR%"
)

echo Creating package folder...
mkdir "%PACKAGE_DIR%"

echo.
echo Copying required files...
echo.

:: Core files
echo   [+] INSTALL.bat
copy "%SOURCE_DIR%INSTALL.bat" "%PACKAGE_DIR%\" >nul

echo   [+] README.txt
copy "%SOURCE_DIR%CUSTOMER_README.md" "%PACKAGE_DIR%\README.txt" >nul

echo   [+] restart-server.bat
copy "%SOURCE_DIR%restart-server.bat" "%PACKAGE_DIR%\" >nul

echo   [+] ANDROID_SETUP.md
copy "%SOURCE_DIR%ANDROID_SETUP.md" "%PACKAGE_DIR%\ANDROID_SETUP.txt" >nul

echo   [+] ENABLE_NETWORK.bat
copy "%SOURCE_DIR%ENABLE_NETWORK.bat" "%PACKAGE_DIR%\" >nul

:: Windows Desktop App (if built)
if exist "%SOURCE_DIR%app-builder\dist\UniversalPOS-Portable.exe" (
    echo   [+] UniversalPOS-Portable.exe
    copy "%SOURCE_DIR%app-builder\dist\UniversalPOS-Portable.exe" "%PACKAGE_DIR%\" >nul
)

:: Backend folder
echo   [+] backend\
mkdir "%PACKAGE_DIR%\backend"
mkdir "%PACKAGE_DIR%\backend\logs"
mkdir "%PACKAGE_DIR%\backend\migrations"

copy "%SOURCE_DIR%backend\server.js" "%PACKAGE_DIR%\backend\" >nul
copy "%SOURCE_DIR%backend\db.js" "%PACKAGE_DIR%\backend\" >nul
copy "%SOURCE_DIR%backend\package.json" "%PACKAGE_DIR%\backend\" >nul
copy "%SOURCE_DIR%backend\runMigrations.js" "%PACKAGE_DIR%\backend\" >nul
xcopy "%SOURCE_DIR%backend\migrations\*" "%PACKAGE_DIR%\backend\migrations\" /s /q >nul

:: Public folder (frontend)
echo   [+] public\
xcopy "%SOURCE_DIR%public\*" "%PACKAGE_DIR%\public\" /s /e /q >nul

:: Startup folder
echo   [+] startup\
mkdir "%PACKAGE_DIR%\startup"
copy "%SOURCE_DIR%startup\OpenPOS.bat" "%PACKAGE_DIR%\startup\" >nul

:: Create uninstaller
echo   [+] UNINSTALL.bat
(
echo @echo off
echo title UniversalPOS - Uninstaller
echo color 0C
echo.
echo echo  ========================================
echo echo    UniversalPOS Uninstaller
echo echo  ========================================
echo echo.
echo net session ^>nul 2^>^&1
echo if %%errorlevel%% neq 0 ^(
echo     echo ERROR: Please run as Administrator!
echo     echo Right-click this file and select "Run as administrator"
echo     pause
echo     exit /b 1
echo ^)
echo.
echo echo Stopping service...
echo net stop "UniversalPOS-Backend" 2^>nul
echo.
echo echo Removing service...
echo if exist "C:\tools\nssm\nssm.exe" ^(
echo     C:\tools\nssm\nssm.exe remove UniversalPOS-Backend confirm 2^>nul
echo ^)
echo.
echo echo Removing startup shortcut...
echo del "%%APPDATA%%\Microsoft\Windows\Start Menu\Programs\Startup\OpenPOS.bat" 2^>nul
echo.
echo echo  ========================================
echo echo    UniversalPOS has been uninstalled.
echo echo  ========================================
echo echo.
echo echo NOTE: You may manually delete:
echo echo   - This folder ^(UniversalPOS files^)
echo echo   - PostgreSQL database "universal_pos"
echo echo.
echo pause
) > "%PACKAGE_DIR%\UNINSTALL.bat"

echo.
echo  ══════════════════════════════════════════════════════════════
echo.
echo  ✓ Package created at:
echo    %PACKAGE_DIR%
echo.
echo  ══════════════════════════════════════════════════════════════
echo.
echo  PACKAGE CONTENTS:
echo.
echo    INSTALL.bat               - Customer runs this FIRST (as admin)
echo    README.txt                - Simple instructions
echo    ANDROID_SETUP.txt         - How to use on Android tablets/phones
echo    ENABLE_NETWORK.bat        - Allow connections from other devices
echo    UniversalPOS-Portable.exe - Windows desktop app (if built)
echo    restart-server.bat        - Use after code updates
echo    UNINSTALL.bat             - Remove POS completely
echo.
echo    backend\                  - Server code + database migrations
echo    public\                   - Web frontend (HTML/CSS/JS)
echo    startup\                  - Auto-start on Windows boot
echo.
echo  ══════════════════════════════════════════════════════════════
echo.
echo  DELIVERY INSTRUCTIONS:
echo.
echo    1. ZIP the "UniversalPOS-Customer-Package" folder
echo    2. Send the ZIP to customer
echo    3. Tell them:
echo       "Extract ZIP anywhere, right-click INSTALL.bat, Run as admin"
echo.
echo  ══════════════════════════════════════════════════════════════
echo.
pause

:: Open the folder
explorer "%PACKAGE_DIR%"
