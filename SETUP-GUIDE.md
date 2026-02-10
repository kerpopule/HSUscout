# Smoky Scout Pro - Setup Guide

Quick guide for FRC Team 8778 to test and deploy your scouting app.

---

## 🖥️ Section 1: Testing on Your Laptop

### What You're Running

The app has two parts that both need to be running:
- **Frontend** (the website) - runs on port 3000
- **Backend** (the data server) - runs on port 3001

### Getting Started

1. **Open two terminal windows** and navigate to the project folder in both:
   ```bash
   cd /path/to/HSUscout
   ```

2. **Terminal 1 - Start the backend:**
   ```bash
   npm run dev:server
   ```
   You should see: `Server running on port 3001`

3. **Terminal 2 - Start the frontend:**
   ```bash
   npm run dev
   ```
   You should see: `Local: http://localhost:3000`

4. **Open your browser** and go to:
   ```
   http://localhost:3000
   ```

### Testing Checklist

**✅ Connection Check**
- Look for a **GREEN wifi icon** in the header
- Green = connected to server, ready to scout
- Red = offline mode (data saves locally)

**✅ Pit Scouting**
1. Click any team number
2. Click "Add Pit Data"
3. Fill out the form (drivetrain type, robot dimensions, etc.)
4. Click "Save"
5. **Test sync:** Open a second browser tab to `http://localhost:3000`
6. The pit data should appear in both tabs within 5 seconds

**✅ Match Scouting**
1. Click a team number
2. Click "Log Match"
3. Fill out the phases (Auto, Teleop, Endgame)
4. Click "Submit"
5. A **QR code popup** should appear (this is for backup - you can dismiss it)

**✅ QR Code Scanning**
1. Click the **"Scan" tab** in the bottom navigation
2. If you have a webcam, click "Start Scanner"
3. Point it at a QR code from a previous match submission
   - Tip: Screenshot a QR code on your phone to test this
4. The match data should auto-import

**✅ Offline Mode**
1. **Stop the backend:** Go to Terminal 1 and press `Ctrl+C`
2. The wifi icon turns **RED**
3. Try entering match data - it should still work
4. **Restart the backend:** `npm run dev:server` in Terminal 1
5. Icon turns green, and your offline data syncs automatically
6. Check that the "pending sync" counter goes to 0

**✅ Strategy Lab**
1. Click the **"Strategy" tab** at the bottom
2. Pick 3 teams for the blue alliance
3. Pick 3 teams for the red alliance
4. Stats appear automatically from your scouting data

**✅ Export Data**
1. Click the **"Export" button** in the header
2. A CSV file should download with all your scouting data

### Stopping Everything

Press **Ctrl+C** in both terminal windows to stop the servers.

### Starting Fresh

Want to clear all test data and start over?

```bash
rm data/scout.db
```

Then restart both servers. You'll have an empty database.

---

## 🤖 Section 2: Raspberry Pi Deployment

### What You Need

- **Raspberry Pi 3B+ or newer** (must have built-in WiFi)
- **microSD card** (16GB or larger) with Raspberry Pi OS installed
- **Way to connect initially:** monitor + keyboard, OR SSH over ethernet
- **Internet connection** (just once during setup - not needed at competitions)

### Initial Setup

**1. Flash the SD Card**
- Use [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
- Install "Raspberry Pi OS (32-bit)" or "(64-bit)"
- **Optional:** Enable SSH in advanced settings for headless setup

**2. Boot the Pi**
- Insert SD card and power on
- Connect to a monitor, or SSH from your laptop:
  ```bash
  ssh pi@raspberrypi.local
  ```
  Default password: `raspberry` (change this later!)

**3. Connect to Internet**
- Use ethernet cable, OR
- Connect to WiFi temporarily (you only need this once)

**4. Clone the Project**
```bash
git clone https://github.com/kerpopule/HSUscout.git
cd HSUscout
```

**5. Run the Setup Script**
```bash
sudo bash pi/setup.sh
```

This will:
- Install Node.js
- Install WiFi hotspot software (hostapd)
- Install DHCP server (dnsmasq)
- Install nginx for captive portal
- Build the app
- Configure everything to start automatically on boot

**Takes about 5-10 minutes.** Grab a snack.

**6. Reboot**
```bash
sudo reboot
```

### After Reboot - You're Done! 🎉

The Pi now:
- **Creates a WiFi network** called `SmokyScout`
- **Password:** `frc8778scout`
- **Auto-starts the app** on boot
- **No internet needed** at competitions

### Using It at Competitions

**For Students:**
1. Power on the Pi (wait ~30 seconds for boot)
2. Connect your phone to WiFi network: `SmokyScout`
3. Password: `frc8778scout`
4. The app should **auto-open** (captive portal)
5. If it doesn't, open a browser and go to: `http://192.168.4.1:3001`
6. Start scouting!

**How Data Syncs:**
- All phones sync to one database on the Pi
- Walk out of WiFi range? Data saves on your phone
- Walk back in range? Auto-syncs when reconnected
- QR codes after each match are a backup - lead scout can scan them later

### Backing Up Data

The database file is at: `~/HSUscout/data/scout.db`

**Option 1: USB Drive**
```bash
cp ~/HSUscout/data/scout.db /media/usb/scout-backup.db
```

**Option 2: Export CSV**
- Click "Export" button in the app
- Downloads all data as CSV

**Option 3: Copy over network**
- Connect Pi to ethernet
- Use SCP, SFTP, or file browser

### Troubleshooting

**App won't load?**
```bash
sudo systemctl status smoky-scout
```
If it's not running:
```bash
sudo systemctl restart smoky-scout
```

**WiFi network not showing up?**
```bash
sudo systemctl status hostapd
```
Restart it:
```bash
sudo systemctl restart hostapd
```

**Need to see error logs?**
```bash
journalctl -u smoky-scout -f
```
Press `Ctrl+C` to stop viewing logs.

**Want to start with a fresh database?**
```bash
rm ~/HSUscout/data/scout.db
sudo systemctl restart smoky-scout
```

**Something really broken?**
Re-run the setup script:
```bash
cd ~/HSUscout
sudo bash pi/setup.sh
sudo reboot
```

---

## Quick Reference

### Local Testing Commands
```bash
# Terminal 1
npm run dev:server

# Terminal 2
npm run dev

# Browser
http://localhost:3000
```

### Pi Commands
```bash
# View app status
sudo systemctl status smoky-scout

# Restart app
sudo systemctl restart smoky-scout

# View logs
journalctl -u smoky-scout -f

# Backup database
cp ~/HSUscout/data/scout.db /path/to/backup/
```

### WiFi Network
- **Name:** SmokyScout
- **Password:** frc8778scout
- **App URL:** http://192.168.4.1:3001

---

Good luck scouting! 🚀
