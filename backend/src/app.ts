import 'dotenv/config';
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import swaggerUi from 'swagger-ui-express';
import { errorHandler } from './middleware/errorHandler';
import { standardLimiter } from './middleware/rateLimiter';
import { requestLogger } from './middleware/requestLogger';
import { validateEnv } from './config/validateEnv';

// ── Central config validation (fail-fast at startup) ──────────────────
validateEnv();

// Shared origin config (used by both Express and Socket.IO in server.ts)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === 'production' && ALLOWED_ORIGINS.length === 0) {
  throw new Error('ALLOWED_ORIGINS must be set in production (comma-separated). Refusing to start with open CORS.');
}

const app: Application = express();

// Trust proxy for rate limiting behind reverse proxies
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://api.mapbox.com", "https://*.tile.openstreetmap.org"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));
app.use(compression());
// With credentials:true the origin can never be '*' — echo the request
// origin in development, and require an explicit allowlist in production.
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? ALLOWED_ORIGINS : (origin, callback) => {
    // Allow requests with no origin (curl, mobile apps, server-to-server)
    if (!origin) return callback(null, true);
    // In development, allow localhost on any port
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// httpOnly session cookies (web dashboard); mobile uses Bearer tokens.
app.use(cookieParser());

// Body Parsing (100KB limit)
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Global Rate Limiting
app.use(standardLimiter);

// Setup Request ID
app.use((req, res, next) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || crypto.randomUUID();
  next();
});

// Request logging (method, path, status, duration)
app.use(requestLogger);

// Health check endpoint — verifies real DB connectivity so
// load balancers / k8s probes don't report healthy while broken.
app.get('/health', async (req, res) => {
  try {
    const pool = (await import('./config/database')).default;
    await pool.query('SELECT 1');
    res.status(200).json({
      success: true,
      data: { status: 'OK', database: 'connected' },
      error: null,
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'],
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      data: { status: 'DEGRADED', database: 'unreachable' },
      error: 'Database unreachable',
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'],
    });
  }
});

// ── OpenAPI / Swagger UI ──────────────────────────────────────────
try {
  const specPath = path.resolve(__dirname, '..', 'openapi.yaml');
  const specFile = fs.readFileSync(specPath, 'utf8');
  const openapiSpec = YAML.parse(specFile);
  
  // Protect Swagger UI in production
  if (process.env.NODE_ENV === 'production') {
    app.use('/api/docs', (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required for API docs' });
      }
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET!) as { role?: string };
        if (decoded.role !== 'parent') {
          return res.status(403).json({ error: 'Access denied' });
        }
        next();
      } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
    });
  }
  
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, {
    customSiteTitle: 'Kavach API Docs',
  }));
  app.get('/api/docs.json', (_req, res) => res.json(openapiSpec));

  // Cache headers for API documentation assets
  app.use('/api/docs', (req, res, next) => {
    if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    next();
  });
} catch {
  // Silently skip if spec missing (dev convenience, not a hard dep)
}

// ── Feature Routes ────────────────────────────────────────────────
import authRoutes from './modules/auth/auth.routes';
import appBlockingRoutes from './modules/appblocking/appBlocking.routes';
import deviceAlertRoutes from './modules/devices/deviceAlert.routes';
import childrenRoutes from './modules/children/children.routes';
import deviceRoutes from './modules/devices/device.routes';
import screentimeRoutes from './modules/screentime/screentime.routes';
import screentimeDeviceRoutes from './modules/screentime/screentimeDevice.routes';
import locksRoutes from './modules/locks/locks.routes';
import locationRoutes from './modules/location/location.routes';
import locationDeviceRoutes from './modules/location/locationDevice.routes';
import contactsRoutes from './modules/contacts/contacts.routes';
import consentRoutes from './modules/consent/parentalConsent.routes';
import geoRoutes from './modules/geo/geo.routes';
// ── Phase 2 Feature Routes ───────────────────────────────────────
import urlFilterRoutes from './modules/urlfilter/urlFilter.routes';
import { deviceHealthDeviceRouter, deviceHealthParentRouter } from './modules/devicehealth/deviceHealth.routes';
import { sosDeviceRouter, sosParentRouter } from './modules/sos/sos.routes';
import { communicationDeviceRouter, communicationParentRouter } from './modules/communication/communication.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import keywordDictRoutes from './modules/communication/keywordDict.routes';
// ── Phase 3 Feature Routes ───────────────────────────────────────
import geofenceRoutes from './modules/geo/geofence.routes';
import { geofenceDeviceRouter } from './modules/geo/geofenceDevice.routes';
import { moodDeviceRouter, moodParentRouter } from './modules/mood/mood.routes';
import { rewardCatalogRouter, rewardParentRouter, rewardChildRouter } from './modules/rewards/reward.routes';
import { predictionParentRouter } from './modules/predictions/prediction.routes';
import { securityDeviceRouter, securityParentRouter } from './modules/security/security.routes';
import selfHarmRoutes from './modules/selfharm/selfHarm.routes';
import { voiceCommandDeviceRouter, voiceCommandParentRouter } from './modules/voicecommands/voiceCommand.routes';
import integrationRoutes from './modules/integrations/integration.routes';
// ── New feature routes ───────────────────────────────────────────
import communicationLogRoutes from './modules/communication-log/communication-log.routes';
import dailyLocationSummaryRoutes from './modules/location/daily-location-summary.routes';
import statisticsRoutes from './modules/statistics/statistics.routes';
// ── Settings, Notifications, Reports, Alerts Routes ─────────────
import settingsRoutes from './modules/settings/settings.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import reportsRoutes from './modules/reports/reports.routes';
import alertsRoutes from './modules/alerts/alerts.routes';

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/children/:childId/apps', appBlockingRoutes);
app.use('/api/v1/children', childrenRoutes);
app.use('/api/v1/children', screentimeRoutes);
app.use('/api/v1/children', locksRoutes);
app.use('/api/v1/children', locationRoutes);
app.use('/api/v1/children', contactsRoutes);
app.use('/api/v1/children', consentRoutes);
app.use('/api/v1/devices', deviceAlertRoutes);
app.use('/api/v1/devices', deviceRoutes);
app.use('/api/v1/devices', screentimeDeviceRoutes);
app.use('/api/v1/devices', locationDeviceRoutes);
app.use('/api/v1/geo', geoRoutes);
// Phase 2
app.use('/api/v1/children', urlFilterRoutes);
app.use('/api/v1/children', deviceHealthParentRouter);
app.use('/api/v1/children', sosParentRouter);
app.use('/api/v1/children', communicationParentRouter);
app.use('/api/v1/children', analyticsRoutes);
app.use('/api/v1/devices', deviceHealthDeviceRouter);
app.use('/api/v1/devices', sosDeviceRouter);
app.use('/api/v1/devices', communicationDeviceRouter);
app.use('/api/v1/devices', geofenceDeviceRouter);
app.use('/api/v1/keywords', keywordDictRoutes);
// Phase 3
app.use('/api/v1/children', geofenceRoutes);
app.use('/api/v1/children', moodParentRouter);
app.use('/api/v1/children', rewardParentRouter);
app.use('/api/v1/children', rewardChildRouter);
app.use('/api/v1/children', predictionParentRouter);
app.use('/api/v1/children', securityParentRouter);
app.use('/api/v1/devices', moodDeviceRouter);
app.use('/api/v1/devices', securityDeviceRouter);
app.use('/api/v1/rewards', rewardCatalogRouter);
// Phase 4
app.use('/api/v1/children', selfHarmRoutes);
app.use('/api/v1/devices', voiceCommandDeviceRouter);
app.use('/api/v1/children', voiceCommandParentRouter);
app.use('/api/v1/integrations', integrationRoutes);
// New feature routes
app.use('/api/v1/children', communicationLogRoutes);
app.use('/api/v1/children', dailyLocationSummaryRoutes);
app.use('/api/v1/children', statisticsRoutes);
// Settings, Notifications, Reports, Alerts
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/children', alertsRoutes);


// Global Error Handler (must be last)
app.use(errorHandler);

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    data: {},
    error: process.env.NODE_ENV === 'production' 
      ? 'Route not found' 
      : `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
    request_id: req.headers['x-request-id'] || 'unknown',
  });
});

export default app;
