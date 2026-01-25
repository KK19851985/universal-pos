# UniversalPOS - Customer Installation Guide

## Quick Start (For Customers)

### What You Need First
1. **Windows 10 or 11** (64-bit) - This is your POS server
2. **Node.js** - Download from https://nodejs.org (choose LTS version)
3. **PostgreSQL** - Download from https://www.postgresql.org/download/windows/
   - During PostgreSQL installation, remember the password you set!
   - Default port is 5432

### Installation Steps

1. **Install Prerequisites**
   - Install Node.js (just click Next through the installer)
   - Install PostgreSQL (remember your password!)

2. **Run the Installer**
   - Right-click on `INSTALL.bat`
   - Select **"Run as administrator"**
   - Enter your PostgreSQL password when asked
   - Wait for setup to complete

3. **Done!** 
   - The POS will open automatically
   - Login with: `admin` / `admin123`

---

## 📱 Using on Android Tablets/Phones

UniversalPOS works on **any Android device** as an installable app!

### Quick Setup:
1. Connect your Android device to the **same WiFi** as the Windows computer
2. Open **Google Chrome** on Android
3. Go to: `http://[COMPUTER-IP]:5000` (find IP using `ipconfig` on Windows)
4. Tap **Chrome menu (⋮)** → **"Add to Home Screen"**
5. Tap the new **UniversalPOS** icon - it works like a native app!

📖 **See `ANDROID_SETUP.md` for detailed instructions**

---

## What Happens Automatically

After installation, every time you turn on your computer:

1. **Windows boots** → PostgreSQL starts automatically
2. **PostgreSQL ready** → UniversalPOS server starts automatically  
3. **You log in** → Browser opens with the POS in fullscreen

You don't need to do anything - just turn on the computer and log in!

---

## 🖥️ Windows Desktop App

If included, you can also use `UniversalPOS-Portable.exe`:
- Double-click to run (no installation needed)
- Opens in its own window (not in browser)
- Requires server to be running first

---

## Multiple Devices

You can use UniversalPOS on multiple devices at once:
- **Windows computer** - Main server + POS terminal
- **Android tablets** - Additional POS terminals, kitchen display
- **Android phones** - Manager access, order taking

All devices see the same real-time data!

---

## Troubleshooting

### POS doesn't open after login
- Check if the server is running: Open browser and go to `http://localhost:5000`
- If not working, right-click `restart-server.bat` → Run as administrator

### Android device can't connect
- Make sure both devices are on the same WiFi network
- Check Windows Firewall allows port 5000
- Verify the IP address is correct

### Forgot admin password
- Contact support to reset your password

### Database connection error
- Make sure PostgreSQL is running (check Services)
- Verify your password is correct

---

## Support

For technical support, contact: [Your contact info here]

