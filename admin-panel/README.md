# Kavach Admin Panel

A React-based admin dashboard for managing the Kavach parental control platform.

## Features

- **Dashboard** — System stats (total users, children, devices, active subscriptions)
- **User Management** — View and manage parent accounts, subscription tiers, admin roles
- **Feature Flags** — Toggle features globally (location, geofencing, predictions, self-harm, etc.)

## Tech Stack

- React 18 + TypeScript
- Vite (build tool)
- React Router (routing)
- Axios (HTTP client, httpOnly cookie auth)
- Tailwind CSS (styling)

## Setup

```bash
cd admin-panel
npm install
npm run dev
```

The admin panel runs at `http://localhost:5174` and proxies API requests to the backend at `http://localhost:3000`.

## Authentication

Admin panel uses httpOnly cookies for session management (no localStorage/sessionStorage). Only users with the `admin` role can access admin routes.

## Build

```bash
npm run build    # Production build
npm run preview  # Preview production build
```
