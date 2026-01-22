@echo off
:: UniversalPOS - Open POS in Kiosk Mode
:: This script opens the POS application in fullscreen mode

:: Wait for server to be ready (in case of fresh boot)
timeout /t 8 /nobreak > nul

:: Check if server is running (try up to 30 seconds)
set ATTEMPTS=0
:check_server
set /a ATTEMPTS+=1
if %ATTEMPTS% gtr 10 (
    echo Server not responding after 30 seconds.
    echo Please check if the UniversalPOS-Backend service is running.
    pause
    exit /b 1
)
curl -s http://localhost:5000 > nul 2>&1
if %errorlevel% neq 0 (
    timeout /t 3 /nobreak > nul
    goto check_server
)

:: Open in Chrome kiosk mode (fullscreen, no address bar)
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --disable-infobars --disable-session-crashed-bubble --no-first-run http://localhost:5000
    goto end
)

:: Fallback to Edge kiosk mode
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk --disable-infobars --no-first-run http://localhost:5000
    goto end
)

:: Fallback to default browser
start http://localhost:5000

:end
