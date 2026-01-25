@echo off
title UniversalPOS - Build Windows Desktop App
color 0B

echo.
echo  ╔══════════════════════════════════════════════════════════════╗
echo  ║                                                              ║
echo  ║         BUILD WINDOWS DESKTOP APP (.EXE)                     ║
echo  ║                                                              ║
echo  ╚══════════════════════════════════════════════════════════════╝
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is not installed!
    echo  Please install from: https://nodejs.org
    pause
    exit /b 1
)

cd /d "%~dp0"

echo  [1/3] Installing dependencies...
call npm install --silent
if %errorlevel% neq 0 (
    echo  [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo  [2/3] Building Windows application...
call npm run build:windows
if %errorlevel% neq 0 (
    echo  [ERROR] Build failed
    pause
    exit /b 1
)

echo.
echo  [3/3] Build complete!
echo.
echo  ══════════════════════════════════════════════════════════════
echo.
echo  ✓ Your Windows app is ready at:
echo    %~dp0dist\UniversalPOS-Portable.exe
echo.
echo  ══════════════════════════════════════════════════════════════
echo.
echo  USAGE:
echo    1. Copy UniversalPOS-Portable.exe to customer's computer
echo    2. Make sure the POS server is running first
echo    3. Double-click the .exe to launch the POS app
echo.
echo  NOTE: The server must be running for the app to work!
echo.
pause

:: Open dist folder
explorer "%~dp0dist"
