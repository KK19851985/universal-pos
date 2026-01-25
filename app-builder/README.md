# UniversalPOS - App Builder

This folder contains tools to build standalone apps for Android and Windows.

---

## 📱 Android APK

### Option 1: PWABuilder (Easiest - Recommended)

1. **Host your POS publicly** (even temporarily)
   - Use ngrok: `ngrok http 5000`
   - Or deploy to a cloud server

2. **Go to PWABuilder.com**
   - Enter your public URL
   - Click "Build My PWA"
   - Choose Android
   - Download the APK

3. **Install on Android**
   - Transfer APK to device
   - Enable "Install from unknown sources" in Settings
   - Tap the APK to install

### Option 2: Bubblewrap (For Developers)

```bash
# Install Bubblewrap globally
npm install -g @anthropic/bubblewrap-cli

# Generate Android project
bubblewrap init --manifest=https://your-server/manifest.json

# Build the APK
bubblewrap build
```

### Option 3: Use the WebView App Template

For local network use, we've included a pre-built APK template.
Edit `android/twa-manifest.json` with your server IP before building.

---

## 🖥️ Windows Desktop App (.exe)

### Quick Build:

1. **Run the build script:**
   ```
   Double-click: BUILD_WINDOWS.bat
   ```

2. **Output:**
   - `dist/UniversalPOS-Portable.exe` (single file, ~70MB)

3. **Deploy:**
   - Copy the .exe to customer's computer
   - Run it (no installation needed)
   - Requires server to be running!

### Manual Build:

```bash
cd app-builder
npm install
npm run build:windows
```

---

## ⚙️ How the Apps Work

Both Android and Windows apps are **client wrappers** that connect to your POS server:

```
┌─────────────────────┐      ┌─────────────────────┐
│  Android/Windows    │      │   Windows Server    │
│       App           │ ───► │   (Node.js + DB)    │
│  (WebView/Electron) │      │   Port 5000         │
└─────────────────────┘      └─────────────────────┘
```

**Important:** The POS server must be running for apps to work!

---

## 🔧 Configuration

### Change Server URL:

**Windows (Electron):** Edit `electron-main.js`:
```javascript
const SERVER_URL = 'http://192.168.1.100:5000';  // Your server IP
```

**Android:** Edit `android/twa-manifest.json`:
```json
"host": "192.168.1.100:5000"
```

---

## 📋 Requirements

### For Building Windows App:
- Node.js 18+ 
- Windows 10/11

### For Building Android APK:
- Java JDK 11+
- Android SDK (or use PWABuilder online)

---

## 🚀 Quick Start for Customer Deployment

1. **Windows Desktop:**
   - Build once: `BUILD_WINDOWS.bat`
   - Give customer: `UniversalPOS-Portable.exe`

2. **Android Tablets:**
   - Use PWABuilder.com for easy APK generation
   - Or have them "Add to Home Screen" from Chrome (PWA)

3. **Both require:**
   - Server running on Windows PC
   - All devices on same network
