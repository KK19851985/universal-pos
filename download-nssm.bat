@echo off
:: Download NSSM for service management
echo Downloading NSSM...

set SCRIPT_DIR=%~dp0
set TOOLS_DIR=%SCRIPT_DIR%tools

if not exist "%TOOLS_DIR%" mkdir "%TOOLS_DIR%"

powershell -Command "Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile '%TEMP%\nssm.zip' -UseBasicParsing"
powershell -Command "Expand-Archive -Path '%TEMP%\nssm.zip' -DestinationPath '%TOOLS_DIR%' -Force"
copy /Y "%TOOLS_DIR%\nssm-2.24\win64\nssm.exe" "%TOOLS_DIR%\nssm.exe"

if exist "%TOOLS_DIR%\nssm.exe" (
    echo SUCCESS: NSSM downloaded to %TOOLS_DIR%\nssm.exe
) else (
    echo ERROR: Failed to download NSSM
)
pause
