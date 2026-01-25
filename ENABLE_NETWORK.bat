@echo off
title UniversalPOS - Enable Network Access
color 0B

echo.
echo  ╔══════════════════════════════════════════════════════════════╗
echo  ║                                                              ║
echo  ║       ENABLE NETWORK ACCESS FOR ANDROID DEVICES              ║
echo  ║                                                              ║
echo  ╚══════════════════════════════════════════════════════════════╝
echo.

:: Check for admin privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] This script must be run as Administrator!
    echo.
    echo  Right-click this file and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo  This script will:
echo    1. Allow UniversalPOS through Windows Firewall
echo    2. Display your computer's IP address for Android devices
echo.
echo  ══════════════════════════════════════════════════════════════
echo.

:: Add firewall rules
echo  [1/2] Configuring Windows Firewall...
echo.

:: Remove old rules if they exist
netsh advfirewall firewall delete rule name="UniversalPOS Server" >nul 2>&1
netsh advfirewall firewall delete rule name="UniversalPOS Port 5000" >nul 2>&1

:: Add new rules
netsh advfirewall firewall add rule name="UniversalPOS Port 5000" dir=in action=allow protocol=tcp localport=5000 >nul
if %errorlevel% equ 0 (
    echo  [OK] Firewall rule added for port 5000
) else (
    echo  [WARNING] Could not add firewall rule - you may need to do this manually
)

echo.
echo  [2/2] Finding your network IP address...
echo.

:: Get IP addresses
echo  ══════════════════════════════════════════════════════════════
echo.
echo  YOUR COMPUTER'S IP ADDRESS:
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    echo     %%a
)
echo.
echo  ══════════════════════════════════════════════════════════════
echo.
echo  TO CONNECT FROM ANDROID:
echo.
echo    1. Connect your Android device to the same WiFi network
echo    2. Open Google Chrome on Android
echo    3. Type: http://[IP ADDRESS]:5000
echo       Example: http://192.168.1.100:5000
echo    4. Tap Chrome menu (3 dots) ^> "Add to Home Screen"
echo.
echo  ══════════════════════════════════════════════════════════════
echo.
echo  [DONE] Network access is now enabled!
echo.
pause
