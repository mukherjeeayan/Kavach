# Kavach — Parent User Guide

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

### Step 2: Set Your Parent PIN

Before pairing a device, set a 4-6 digit PIN:

1. Go to **Settings** (gear icon in the header)
2. Click **Set PIN**
3. Enter a 4-6 digit PIN and confirm

This PIN is used to unlock the device and approve sensitive actions.

### Step 3: Install on Your Child's Device

1. On your child's Android phone, install the Kavach app
2. Open the app and tap **Get Started**
3. Follow the onboarding steps:
   - **Sign in** with your email and password
   - **Select or create a child profile**
   - **Grant permissions** when prompted:
     - **Location** — to track your child's whereabouts
     - **Usage Access** — to monitor screen time and app usage
     - **Device Admin** — to enforce app blocks and screen locks
     - **Background Location** — for continuous location tracking
4. The device is now registered and protected

### Step 4: Set Up Rules

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
2. Scroll to **Blocked Apps** section
3. Enter the app's package name (e.g., `com.instagram.android`)
4. Optionally add a reason (shown to the child)
5. Click **Block**

**How it works:** Blocked apps are killed within ~1 second on the child's device. The enforcement works offline — rules are cached locally.

### Unblock Requests

When your child wants access to a blocked app, they can submit a request from their device.

**To review a request:**
1. You'll see pending requests in the **Unblock Requests** section
2. Review the app name and your child's reason
3. Click **Approve** to unblock, or **Reject** to keep it blocked

The child receives a notification about your decision immediately.

### Scheduled Locks

Lock the device during specific hours (e.g., bedtime, homework time).

**To create a lock window:**
1. Go to **Scheduled Locks**
2. Click **+ Add Lock**
3. Choose the day of week (or every day)
4. Set start and end times (24-hour format, e.g., 22:00 to 07:00)
5. Click **Save Lock**

During a lock window, only the launcher and settings are accessible. The child receives a warning 10 minutes before a lock window starts.

### Contact Rules

Control who can call or message your child.

**To add a contact rule:**
1. Go to **Contacts**
2. Click **+ Add Contact**
3. Enter the phone number and name
4. Choose **Allow** (always let this number through) or **Block** (reject calls)
5. Click **Save Contact**

Blocked calls are silently rejected on the child's device.

### Location Tracking

View your child's current location and location history.

- **Current Location** — shows the most recent GPS ping per device
- **Location History** — shows a timeline of locations with timestamps
- Click **Open in Google Maps** for turn-by-turn directions
- If Mapbox is configured, an embedded map shows all recent positions

### Geofencing

Set up safe zones (geofences) and get alerts when your child enters or leaves them.

- Create geofences with a name, location (lat/lng), and radius
- Choose to receive alerts on **entry**, **exit**, or both
- View all geofences on a map

### Communication Monitoring

Monitor SMS and call logs with cyberbullying detection.

- View recent calls and messages
- Cyberbullying keywords trigger alerts
- Stranger calls are flagged automatically

### URL Filtering

Block inappropriate websites automatically.

- Add URL filter rules with patterns (e.g., `*.gambling.com`)
- Choose to **block** or **allow** matched URLs
- Rules sync to the child's device in real time

### Mood Tracking

Kids can log how they're feeling each day using emoji check-ins.

- View mood history on a calendar or chart
- Spot patterns over time
- Low mood entries can trigger parent alerts

### Rewards

A points-based system for good behavior.

- Parents set up a reward catalog (e.g., "30 min extra screen time" = 50 points)
- Children earn points for completing goals
- Points can be redeemed for rewards

### Self-Harm Detection

Keyword-based critical alert system.

- Monitors typed text for self-harm keywords
- Triggers immediate critical alerts to parents
- Alerts appear on the dashboard with priority flagging

### Voice Commands

Control features hands-free using voice commands.

- "Show location" — opens the location view
- "Block app [name]" — blocks a specific app
- "Set screen time [minutes]" — updates the daily limit

### Behavior Predictions

AI-powered insights into digital habits.

- Predicts potential issues based on usage patterns
- Generates risk scores for different behaviors
- Provides actionable recommendations

### Keyword Alerts

Real-time notifications for flagged content.

- Set up custom keywords to monitor
- Get notified when keywords appear in messages or typed text
- Manage false positives from the alerts dashboard

### Weekly AI Reports

Comprehensive weekly summaries with AI-generated insights.

- Screen time breakdown by app and category
- Communication summary
- Mood and wellness trends
- Actionable recommendations

### Emergency SOS

One-touch emergency alert with location sharing.

- Child taps the SOS button in their app
- Parent receives instant notification with the child's location
- SOS events are logged and can be acknowledged/resolved

### Device Health Monitoring

Monitor the child's device status.

- Battery level, storage, and network status
- Security status (root detection, USB debugging)
- Tamper alerts when device security is compromised

### Multi-Guardian

Share monitoring with co-guardians.

- Invite another parent/guardian by email
- Co-guardians get the same monitoring permissions
- Manage guardians from the child's settings

### Integrations

Connect third-party services.

- Supported integration types with sync status
- Create, update, and delete integrations
- Manual sync trigger available

### Admin Panel

User management and feature flags (admin role only).

- View system statistics (total users, devices, subscriptions)
- Manage user accounts and subscription tiers
- Toggle features globally via feature flags

## Managing Your Account

### Change Password

1. Go to **Settings** (gear icon in the header)
2. Click **Change** next to Password
3. Enter your current and new password
4. Click **Update Password**

### Set Parent PIN

The parent PIN is used to unlock the device when it's locked and to access management sections.

1. Go to **Settings**
2. Click **Set PIN** or **Change PIN**
3. Enter a 4-6 digit PIN
4. This PIN is also used to pair new devices

### Forgot Password

1. On the login page, click **Forgot password?**
2. Enter your email address
3. Check your email for a password reset link
4. Click the link and set a new password

### Log Out

Click your name in the header and select **Sign Out**. On mobile, use the hamburger menu.

## Dark Mode

The dashboard supports dark mode. Click the moon/sun icon in the header to toggle. Your preference is saved locally.

## Mobile Access

The dashboard is fully responsive. You can manage your child's settings from your phone's browser — hamburger menu for navigation on small screens.

## Troubleshooting

**The child's app says "Not protected":**
- Device Admin may have been deactivated. Re-enable it in Android Settings > Security > Device Admin Apps.

**Rules aren't being enforced:**
- Check that the child's device has an internet connection. Rules sync automatically, but first-time setup requires connectivity.
- Ensure Usage Access permission is granted (Settings > Apps > Special Access > Usage Access).

**Location shows "No locations recorded":**
- Background Location permission may not be granted. Check Android Settings > Apps > Kavach > Permissions > Location > Allow all the time.

**Screen time data seems inaccurate:**
- The app records foreground usage only. Time in background or with screen off is not counted.

**I can't log in:**
- Try the **Forgot password?** link. If that doesn't work, contact your system administrator.

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

**Q: Is my child's data private?**
A: All data is encrypted in transit (HTTPS) and at rest. Location data is only visible to you (the parent). The app complies with India's Digital Personal Data Protection (DPDP) Act — parental consent is required and audited.

**Q: What happens if the device is rooted or tampered with?**
A: Kavach detects root/debugger threats and automatically locks the device, notifies the server, and applies maximum restrictions. You'll receive a tamper alert on your dashboard.

**Q: How do I share management of a child with another parent?**
A: Go to **Guardians** (in the child's section) and enter the other parent's email. They must already have a Kavach account. They'll get co-parent access with the same permissions.
