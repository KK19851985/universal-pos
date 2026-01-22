# UniversalPOS - Customer Installation Guide

## Quick Start (For Customers)

### What You Need First
1. **Windows 10 or 11** (64-bit)
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

## What Happens Automatically

After installation, every time you turn on your computer:

1. **Windows boots** → PostgreSQL starts automatically
2. **PostgreSQL ready** → UniversalPOS server starts automatically  
3. **You log in** → Browser opens with the POS in fullscreen

You don't need to do anything - just turn on the computer and log in!

---

## Troubleshooting

### POS doesn't open after login
- Check if the server is running: Open browser and go to `http://localhost:5000`
- If not working, right-click `restart-server.bat` → Run as administrator

### Forgot admin password
- Contact support to reset your password

### Database connection error
- Make sure PostgreSQL is running (check Services)
- Verify your password is correct

---

## Support

For technical support, contact: [Your contact info here]
