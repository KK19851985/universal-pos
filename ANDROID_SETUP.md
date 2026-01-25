# UniversalPOS - Android & Tablet Setup Guide

## Overview

UniversalPOS is a **Progressive Web App (PWA)** that works like a native Android app when installed. No app store needed - just add to home screen!

---

## Method 1: Install as App (Recommended)

### Step 1: Connect to Same Network
Make sure your Android device is on the **same WiFi network** as the computer running UniversalPOS.

### Step 2: Find Server IP Address
On the Windows computer running UniversalPOS:
1. Open Command Prompt
2. Type `ipconfig` and press Enter
3. Look for **IPv4 Address** (e.g., `192.168.1.100`)

### Step 3: Open in Chrome
1. Open **Google Chrome** on your Android device
2. Navigate to: `http://[SERVER-IP]:5000`
   - Example: `http://192.168.1.100:5000`
3. The POS should load

### Step 4: Install the App
1. Tap the **three dots (⋮)** menu in Chrome
2. Tap **"Add to Home Screen"** or **"Install app"**
3. Tap **"Install"** or **"Add"**
4. The app icon will appear on your home screen!

### Step 5: Launch & Use
- Tap the **UniversalPOS** icon on your home screen
- It opens in fullscreen - just like a real app!
- Works offline for basic functions

---

## Method 2: Use in Browser (Quick Access)

Just bookmark `http://[SERVER-IP]:5000` in Chrome for quick access without installing.

---

## Recommended Android Settings

### For Best Experience:
1. **Screen Rotation**: Enable auto-rotate or lock to landscape for tablets
2. **Screen Timeout**: Set to "Never" while using POS (Settings → Display → Screen timeout)
3. **Keep Screen On**: In Developer Options, enable "Stay awake while charging"

### Chrome Settings:
1. Go to Chrome → Settings → Site settings
2. Allow the POS site to:
   - Store data
   - Send notifications (optional)
   - Access camera (for future QR scanning)

---

## Network Requirements

### Basic Setup:
- Windows computer and Android device on **same WiFi network**
- Server running on Windows computer (port 5000)

### For Remote Access (Outside Your Network):
Contact your IT support to:
1. Set up port forwarding on your router
2. Or use a VPN solution
3. Or deploy to a cloud server

---

## Troubleshooting

### "Site can't be reached"
1. Check WiFi connection on Android device
2. Verify the IP address is correct
3. Make sure server is running on Windows (`http://localhost:5000` should work on Windows)
4. Check Windows Firewall allows port 5000

### To Allow Through Windows Firewall:
1. Open Windows Firewall (Control Panel → Windows Defender Firewall)
2. Click "Allow an app or feature through Windows Defender Firewall"
3. Click "Change settings" → "Allow another app..."
4. Add Node.js or allow port 5000

### App Won't Install
- Make sure you're using **Google Chrome** (not Samsung Internet or other browsers)
- The site must be served over HTTP or HTTPS
- Try clearing Chrome cache and reload

### App Looks Wrong
- Clear app cache: Settings → Apps → UniversalPOS → Storage → Clear Cache
- Uninstall and reinstall from Chrome

---

## Multiple Devices

You can install UniversalPOS on **multiple Android tablets/phones**:
- All devices connect to the same Windows server
- All see the same data in real-time
- Perfect for: front counter, kitchen display, manager tablet, etc.

---

## Quick Reference

| What | How |
|------|-----|
| Server URL | `http://[YOUR-IP]:5000` |
| Default Login | `admin` / `admin123` |
| Install App | Chrome → Menu → Add to Home Screen |
| Works Offline | Yes (limited features) |
| Multiple Devices | Yes, unlimited |

---

## For IT Administrators

### Making the Server Accessible:

**Option A: Allow Through Firewall (Recommended)**
```powershell
# Run as Administrator in PowerShell
netsh advfirewall firewall add rule name="UniversalPOS" dir=in action=allow protocol=tcp localport=5000
```

**Option B: Static IP for Server**
Set a static IP for the Windows server so the address never changes.

**Option C: Use Hostname**
If your network has DNS, clients can connect via hostname:
`http://posserver:5000`

---

## Support

For questions or issues, contact your POS administrator.
