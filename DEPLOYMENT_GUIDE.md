# Kavach - Parental Control Application
## Deployment Guide for Non-Technical Users

---

## 📱 What is Kavach?

**Kavach** is a parental control application designed to help parents monitor and manage their children's digital safety. It combines location tracking, app blocking, geofencing, SOS emergency features, and communication monitoring into a single platform.

Think of it as a "digital safety net" that helps parents:
- **Track location** - See where their children are in real-time
- **Block apps** - Prevent access to inappropriate applications
- **Set geofences** - Get alerts when children leave safe areas
- **Emergency SOS** - Quick emergency signaling with location
- **Monitor communications** - SMS and call log monitoring (with permissions)

The application has role-based access:
- **Parent role** - Full access to dashboard, can manage all children, configure settings, view reports
- **Child role** - Limited access, can view own data only

The application has three main parts:
1. **Android App** - Installed on the child's device
2. **Backend Server** - Processes data, manages authentication, stores records
3. **Web Dashboard** - Parents view and control everything from a browser

---

## 🚀 Deployment Overview

The deployment process sets up all three parts so they work together. This guide walks you through it step by step.

**Estimated time: 10-15 minutes**
**Technical knowledge needed: None** (the wizard handles everything)

---

## 🧙‍♂️ The Deployment Wizard

You can launch the deployment wizard by opening `deploy/index.html` in any web browser (Chrome, Firefox, Edge, Safari).

### Wizard Steps

#### **Step 1: Environment & Mode**
You'll be asked to choose one of three modes:

| Mode | When to Use |
|------|-------------|
| **Development** | First-time setup, testing, learning. Uses localhost. |
| **Production** | Live deployment with your own domain name. For real use. |
| **Local** | Testing with Docker or local server. For advanced users. |

> **Tip:** Start with **Development** mode if this is your first time. You can switch later.

If you choose **Production**, you'll enter your frontend domain (e.g., `app.yourcompany.com`).

#### **Step 2: Backend Configuration**
The backend is the "brain" of the application. The wizard will:

1. **Generate secure JWT secrets** - These are 64-character passwords that protect user accounts. They're created automatically and you should save them.
2. **Set up database connection** - Configures connection to PostgreSQL (a database system).
3. **Configure rate limiting** - Protects the server from too many requests (helps prevent attacks).
4. **Set CORS origins** - Tells which websites are allowed to talk to the backend.

**You'll see:**
- A Redis URL prompt (optional - can leave empty for now)
- An allowed origins field (automatically filled based on your mode)
- Information about what's being generated

#### **Step 3: Frontend Configuration**
The frontend is what you'll see in your browser (the web dashboard). The wizard will:

1. **Set the API URL** - Where the frontend connects to the backend.
2. **Set Socket.io URL** - For realtime updates (like instant rule changes).
3. **Configure Mapbox token** - For location maps (optional, gets from mapbox.com).

**You'll see:**
- Backend API base URL (automatically set based on your mode)
- Socket.io URL (automatically set)
- Mapbox public token field (optional - get from mapbox.com if you want maps)
**Client-side validation:** Forms are generated with yup-based validation for login, registration, and block app inputs. All fields have real-time error feedback, proper format validation (email, package name pattern, password strength, birth date YYYY-MM-DD), and submit buttons are automatically disabled for invalid input.

#### **Step 4: Android Configuration**
The Android app is what gets installed on devices. The wizard will:

1. **Set build mode** - Debug (for testing) or Release (for production use).
2. **Set API base URL** - The production API endpoint the app will use.
3. **Configure certificate pinning** - Security feature to prevent fake servers (release only).
4. **Firebase/FCM settings** - For push notifications (optional).

**You'll see:**
- API base URL for the Android app
- Certificate SHA-256 pins (security - get from your production server if doing release)
- Firebase enable flag (yes/no for push notifications)

#### **Step 5: Summary & Generated Files**
This is the final step. You'll see:

1. **Generated .env files** - Configuration files for backend and frontend (auto-generated, no copying needed!).
2. **Android BuildConfig** - Configuration for the Android app.
3. **Security checklist** - Items to verify everything is set up correctly.

**You'll also see:**
- **Role-based access control** - The dashboard is protected based on user role (parent/child).
- **Route guards** - Dashboard and settings pages require parent role authentication.

---

## 📋 What Gets Generated

### **Backend .env File**
Placed in: `kavach/backend/.env`

This file tells the backend server:
- What port to run on
- Database connection details (PostgreSQL)
- JWT secrets (64-char random strings)
- Rate limiting settings
- CORS allowed origins
- Redis optional configuration

**Key values you should know:**
- `PORT=3000` - Server listens on port 3000
- `NODE_ENV=development` or `production`
- `DB_HOST=localhost` - Database location
- `DB_USER=postgres` - Database username
- `DB_NAME=kavach` - Database name
- `JWT_SECRET` and `JWT_REFRESH_SECRET` - **Keep these secret!** (like master keys)
- `ALLOWED_ORIGINS` - Which websites can connect

### **Frontend .env File**
Placed in: `kavach/frontend/.env`

This file tells the web dashboard:
- Backend API URL (where it sends requests)
- Socket.io URL (for realtime features)
- Mapbox token (for location maps, optional)

**Key values:**
- `VITE_API_BASE_URL` - Backend API endpoint
- `VITE_SOCKET_URL` - Realtime connection URL
- `VITE_MAPBOX_TOKEN` - Mapbox public token (from mapbox.com)

### **Android BuildConfig**
Generated file placed in: `app/obj/BuildConfig.cs`

This configures the Android app with:
- `API_BASE_URL` - The production API endpoint
- `FCM_ENABLED` - Whether push notifications are on
- `CERT_PINNING_ENABLED` - Security feature
- `CERT_PINS` - Certificate SHA-256 hashes

---

## 🐳 Database Setup

The application uses **PostgreSQL** - a robust database system. Here's what you need to know:

### **Default Credentials (from the setup)**
- **Username:** `postgres`
- **Password:** `password`
- **Database Name:** `kavach`

### **Options:**

#### **Option A: Docker (Easiest)**
1. Ensure Docker is running on your computer
2. Run: `docker-compose up -d` in the `kavach/backend` directory
3. PostgreSQL starts automatically with the default credentials above
4. The wizard will detect it's running

#### **Option B: Local PostgreSQL**
1. Install PostgreSQL on your computer (download from postgresql.org)
2. During installation, set password to `password`
3. Create a database named `kavach`
4. Start the PostgreSQL service

#### **Option C: Cloud PostgreSQL**
- You can use a cloud PostgreSQL service (like ElephantSQL, Supabase, etc.)
- Update the `DB_HOST` in the generated `.env` file with your cloud connection string
- Keep `DB_NAME=kavach`, `DB_USER=postgres`, and update the password/host

---

## 🔐 Security Essentials

### **JWT Secrets (Very Important)**
The deployment wizard generates two 64-character secrets:
- `JWT_SECRET` - Protects access tokens
- `JWT_REFRESH_SECRET` - Protects refresh tokens

**Rules:**
- ✅ **DO** save these values somewhere secure (password manager, encrypted note)
- ✅ **DO** keep them confidential (don't share via email, chat, etc.)
- ✅ **DO** not commit them to version control (GitHub, GitLab, etc.)
- ❌ **DON'T** share them with anyone
- ❌ **DON'T** post them in public forums

If you ever suspect they've been exposed, you can regenerate them by running the wizard again.

### **CORS (Cross-Origin Resource Sharing)**
The `ALLOWED_ORIGINS` field tells the backend which websites are allowed to communicate with it.

- **Development:** `http://localhost:5173` (your web browser development server)
- **Production:** Should be your actual domain(s), e.g., `https://app.yourcompany.com,http://app.yourcompany.com`
- **Local:** `http://localhost:5173,http://10.0.2.2:5173` (for Android emulator)

### **Role-Based Access Control (RBAC)**
The web dashboard uses role-based access control to restrict features:

- **Parent role** - Full access to dashboard, can manage all children, configure settings, view reports, access all features
- **Child role** - Limited access, can view own data only (profile, simple settings)

The dashboard automatically redirects users based on their role:
- Parents see the full dashboard with all features
- Children see a restricted view with limited functionality

This ensures that children cannot access parent-only features like managing other children, configuring advanced settings, or viewing comprehensive reports.

**Why RBAC matters:** Prevents children from accessing parent configuration areas, provides appropriate UI for each user type, and enforces the parent-child relationship model of the application.

### **Mapbox Token (Optional for Maps)**
If you want location maps in the dashboard:

1. Go to [mapbox.com](https://www.mapbox.com) and create a free account
2. Create a new public token
3. In the Mapbox dashboard, **restrict the token by domain** to your production domain only
4. Enter the token in the wizard's Mapbox field

**Important:** The Mapbox token is **not** baked into the frontend bundle. It's served at runtime from the backend API. This keeps your Mapbox account secure.

### **Certificate Pinning (Android Release Only)**
For production Android apps, certificate pinning prevents man-in-the-middle attacks.

- The wizard will ask for SHA-256 certificate pins
- These must match your production server's certificate
- If you're just testing with development, you can leave this empty
- For release to app stores, you need the actual pins from your production server

### **Firebase/FCM (Push Notifications Optional)**
If you enable Firebase:

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a project
2. Add an Android app to your project
3. Download `google-services.json` file
4. Place it in the `kavach/app/` directory
5. The wizard will detect it and configure the app for push notifications

---

## 🛠️ Running the Application

### **Backend**
After deployment, in your terminal (command prompt):

```bash
cd kavach/backend
npm install          # First time only
npm run db:migrate   # Run database migrations
npm run dev          # Start development server
# OR
npm run build        # Create production build
```

**The server will start at:** `http://localhost:3000`

### **Frontend (Web Dashboard)**
```bash
cd kavach/frontend
npm install          # First time only
npm run dev          # Start development server (vite)
# OR
npm run build        # Production build
npm run preview      # Preview production build
```

**The dashboard will be at:** `http://localhost:5173`

### **Android App**
```bash
# Open in Android Studio
# Then: Build -> Build Bundles / APK(s) -> Build Bundle(s)
```

---

## 📊 Deployment Checklist

### **After Running the Wizard:**

#### **Backend ✅**
- [ ] .env file generated and placed in `kavach/backend/`
- [ ] JWT secrets saved securely
- [ ] PostgreSQL running with correct credentials
- [ ] `npm install` completed
- [ ] Database migrations run: `npm run db:migrate`
- [ ] Server starts without errors: `npm run dev`
- [ ] CORS origins set correctly for your mode

#### **Frontend ✅**
- [ ] .env file generated and placed in `kavach/frontend/`
- [ ] API URL points to your backend
- [ ] Socket.io URL configured
- [ ] Mapbox token added (optional, for maps)
- [ ] `npm install` completed
- [ ] `npm run dev` starts the dashboard
- [ ] Page loads without console errors

#### **Android ✅**
- [ ] BuildConfig.cs generated in `app/obj/`
- [ ] API_BASE_URL set correctly
- [ ] FCM_ENABLED matches your choice
- [ ] Certificate pins set (release only)
- [ ] `google-services.json` in `app/` (if Firebase enabled)
- [ ] Android Studio opens and builds successfully
- [ ] App installs on device/emulator

#### **Security ✅**
- [ ] JWT secrets saved and not shared
- [ ] ALLOWED_ORIGINS set to your production domain(s)
- [ ] Mapbox token restricted by domain in Mapbox dashboard (if used)
- [ ] HTTPS configured at reverse proxy level (production)
- [ ] Role-based access control working (parent/child roles)
- [ ] No secrets committed to version control

---

## 🆘 Troubleshooting

### **Common Issues:**

#### **"PostgreSQL connection failed"**
- Ensure PostgreSQL is running
- Check the default credentials: user=`postgres`, password=`password`, db=`kavach`
- If using Docker: `docker-compose up -d` in backend directory
- If using local: Ensure PostgreSQL service is started

#### **"Module not found" errors**
- Run `npm install` in the respective directory (backend or frontend)
- Make sure you're in the right directory

#### **"Map not showing"**
- Ensure you have a valid Mapbox token
- In Mapbox dashboard, restrict token by domain to your production domain
- Check browser console for Mapbox-related errors

#### **"Socket.io not connecting"**
- Ensure both backend (`npm run dev`) and frontend (`npm run dev`) are running
- Check that no firewall is blocking WebSocket connections (port 3000 typically)

#### **"Android build fails"**
- Ensure Android Studio is updated (Ladybugbee 2024.1.1 or newer recommended)
- Ensure `google-services.json` is in `kavach/app/` if Firebase enabled
- Check that certificate pins match your production server

#### **"Permission errors on Android"**
- Ensure runtime permissions are granted (location, SMS, call logs)
- Check AndroidManifest.xml permissions
- For background location, ensure `ACCESS_BACKGROUND_LOCATION` is granted

#### **"Role-based access not working"**
- Ensure the user is logged in and has a valid token
- Check that the user's role is set correctly in the auth response
- Parents should have `role: 'parent'` and children should have `role: 'child'`

---

## 📞 Need More Help?

### **Resources:**
- **GitHub Repository:** Check for issues and contributions
- **Documentation:** This guide covers most deployment scenarios
- **Community:** Look for Kavach community forums or discussion groups

### **Typical Support Questions:**
1. "I lost my JWT secrets - can I regenerate?"
   - Yes! Just run the deployment wizard again and it will generate new ones.

2. "Can I change the database password after deployment?"
   - Yes, update the `DB_PASSWORD` in `kavach/backend/.env` and restart the server.

3. "How do I update the Mapbox token?"
   - Get a new token from mapbox.com, restrict by domain, update `VITE_MAPBOX_TOKEN` in `kavach/frontend/.env`.

4. "Can I switch from development to production mode?"
   - Yes, run the wizard again and select Production mode, entering your production domain.

5. "What if I need to add more allowed origins?"
   - Edit the `ALLOWED_ORIGINS` value in `kavach/backend/.env` manually, or re-run the wizard.

6. "How does role-based access work?"
   - The dashboard checks the user's role from the auth response. Parents see full dashboard, children see restricted view. This is enforced via route guards in the React application.

---

## 📦 Version Information

This deployment guide corresponds to **Kavach v1.0** with the following components:
- **Backend:** Node.js + Express, PostgreSQL database
- **Frontend:** React + Vite, Axios for API calls
- **Android:** Kotlin + Jetpack Compose, Hilt for dependency injection
- **Database:** PostgreSQL 16+
- **Security:** JWT (HS256), Bcrypt (rounds=12), Certificate Pinning (release), Role-Based Access Control (parent/child)

---

## 🎉 Congratulations!

You've successfully deployed Kavach! 

The application is now ready for use:
- **Web Dashboard:** Access at your configured URL with role-based access
- **Android App:** Installed on devices (if configured)
- **Backend:** Running and processing requests

**Next steps:**
1. Log into the web dashboard with your admin credentials (set up during first run)
2. Configure your children's profiles
3. Set up geofences, app blocks, and SOS features
4. Test the SOS functionality
5. Invite other parents/guardians if needed

**Thank you for using Kavach to help keep children safe online!** 🛡️

---
*Document generated by Kavach Deployment Wizard*
*For the latest version, check the GitHub repository*