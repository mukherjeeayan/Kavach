# Kavach (SafeGuard) — Parent User Guide

## What is Kavach?

Kavach is a parental control platform that helps you protect your child's digital life. It consists of three parts:

1. **Android App** — installed on your child's device, enforces the rules you set
2. **Web Dashboard** — where you manage settings, view activity, and respond to requests
3. **Backend Server** — syncs data between your dashboard and your child's device

## Getting Started

### Step 1: Create Your Account

1. Open the web dashboard at your deployment URL
2. Click **Create Account**
3. Enter your name, email, and a strong password (8+ characters)
4. Optionally add your child's name and birth date
5. Click **Sign Up**

You are now logged in and ready to set up your child's device.

### Step 2: Install on Your Child's Device

1. On your child's Android phone, install the Kavach app
2. Open the app and tap **Pair with Parent**
3. Enter your email address and the 6-digit PIN shown on your dashboard
4. Grant the requested permissions when prompted:
   - **Location** — to track your child's whereabouts
   - **Usage Access** — to monitor screen time and app usage
   - **Device Admin** — to enforce app blocks and screen locks
   - **Background Location** — for continuous location tracking

### Step 3: Set Up Rules

Once paired, return to your web dashboard. You'll see your child's name in the top selector.

## Features

### Screen Time Management

- **Daily Limit** — Set a maximum number of screen time minutes per day
- **Usage Charts** — View daily and weekly screen time breakdowns by app
- **Limit Alerts** — Receive notifications when your child exceeds their limit

**To set a daily limit:**
1. Select your child from the top of the dashboard
2. Find the **Screen Time** section
3. Enter a limit in minutes (e.g., 120 for 2 hours)
4. Click **Save**

### App Blocking

Block specific apps to prevent distractions during study hours or bedtime.

**To block an app:**
1. Select your child
2. Go to **Blocked Apps** section
3. Click **+ Block App**
4. Enter the app's package name (e.g., `com.instagram.android`)
5. Optionally set a daily usage limit for this app
6. Click **Block**

**How it works:** The blocked app icon is hidden from the launcher on your child's device. If they try to open it another way, it won't launch.

### Unblock Requests

When your child wants access to a blocked app, they can submit a request from their device.

**To review a request:**
1. You'll see a notification badge on **Unblock Requests**
2. Review the app name and your child's reason
3. Click **Approve** to unblock, or **Reject** to keep it blocked

### Scheduled Locks

Lock the device during specific hours (e.g., bedtime, homework time).

**To create a lock window:**
1. Go to **Scheduled Locks**
2. Click **+ Add Lock**
3. Choose the day of week (or every day)
4. Set start and end times
5. Click **Save Lock**

During a lock window, only the launcher and settings are accessible.

### Contact Rules

Control who can call or message your child.

**To add a contact rule:**
1. Go to **Contacts**
2. Click **+ Add Contact**
3. Enter the phone number and name
4. Choose **Allow** (always let this number through) or **Block** (reject calls)
5. Click **Save Contact**

### Location Tracking

View your child's current location and location history.

- **Current Location** — shows the most recent GPS ping per device
- **Location History** — shows a timeline of locations with a map view
- Click **Open in Google Maps** for turn-by-turn directions

### Alerts

The dashboard shows important alerts including:

- **Stranger Call** — unknown number called your child
- **Screen Time Limit Reached** — daily limit exceeded
- **Per-App Limit Reached** — individual app limit exceeded
- **Tamper Alert** — device security may have been compromised

## Managing Your Account

### Change Password

1. Go to **Settings** (gear icon in the header)
2. Click **Change** next to Password
3. Enter your current and new password
4. Click **Update Password**

### Set Parent PIN

The parent PIN is used to unlock the device when it's locked.

1. Go to **Settings**
2. Click **Set PIN** or **Change PIN**
3. Enter a 4-6 digit PIN
4. This PIN is also used to pair new devices

### Forgot Password

1. On the login page, click **Forgot password?**
2. Enter your email address
3. Check your email for a password reset link
4. Click the link and set a new password

## Dark Mode

The dashboard supports dark mode. Click the moon/sun icon in the header to toggle.

## Mobile Access

The dashboard is fully responsive. You can manage your child's settings from your phone's browser — hamburger menu for navigation on small screens.

## FAQ

**Q: What permissions does the child app need?**
A: Location (for GPS tracking), Usage Access (for screen time), Device Admin (for app blocking), and Background Location (for continuous tracking).

**Q: Can my child uninstall the app?**
A: With Device Admin enabled, the app cannot be uninstalled without your PIN.

**Q: Does the app work offline?**
A: Rules are cached on the device. Location pings and screen time data sync when connectivity is restored.

**Q: How do I add another child?**
A: Click **+ Add Child** in the Children section, or install the app on another device and pair it with your account.

**Q: Can I manage multiple devices per child?**
A: Yes. Each device is registered separately, but rules (locks, contacts, app blocks) apply to all devices for that child.
