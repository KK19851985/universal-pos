@echo off
title UniversalPOS - Build Android APK
color 0B

echo.
echo  ╔══════════════════════════════════════════════════════════════╗
echo  ║                                                              ║
echo  ║         BUILD ANDROID APK                                    ║
echo  ║                                                              ║
echo  ╚══════════════════════════════════════════════════════════════╝
echo.

echo  For Android APK, you have three options:
echo.
echo  ══════════════════════════════════════════════════════════════
echo.
echo  OPTION 1: PWABuilder (Easiest - No coding needed)
echo  ─────────────────────────────────────────────────────────────
echo    1. Temporarily make your server public using ngrok:
echo       ngrok http 5000
echo    2. Go to https://www.pwabuilder.com
echo    3. Enter your ngrok URL (e.g., https://abc123.ngrok.io)
echo    4. Click "Build My PWA" -^> Android -^> Download APK
echo    5. Transfer APK to Android device and install
echo.
echo  ══════════════════════════════════════════════════════════════
echo.
echo  OPTION 2: Use Chrome "Add to Home Screen" (No APK needed)
echo  ─────────────────────────────────────────────────────────────
echo    1. On Android, open Chrome
echo    2. Go to http://[YOUR-SERVER-IP]:5000
echo    3. Tap menu -^> "Add to Home Screen"
echo    4. Works exactly like an app!
echo.
echo  ══════════════════════════════════════════════════════════════
echo.
echo  OPTION 3: Bubblewrap CLI (For developers)
echo  ─────────────────────────────────────────────────────────────
echo    Prerequisites: Node.js, Java JDK 11+, Android SDK
echo.
echo    npm install -g @anthropic/bubblewrap-cli
echo    bubblewrap init --manifest=http://your-server/manifest.json
echo    bubblewrap build
echo.
echo  ══════════════════════════════════════════════════════════════
echo.
echo  RECOMMENDATION: Use Option 2 (Add to Home Screen) for local
echo  network deployments. It's the simplest and works great!
echo.
pause
