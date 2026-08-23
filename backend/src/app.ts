import 'dotenv/config';
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import swaggerUi from 'swagger-ui-express';
import { errorHandler } from './middleware/errorHandler';
import { standardLimiter } from './middleware/rateLimiter';
import { requestLogger } from './middleware/requestLogger';

// Shared origin config (used by both Express and Socket.IO in server.ts)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === 'production' && ALLOWED_ORIGINS.length === 0) {
  throw new Error('ALLOWED_ORIGINS must be set in production (comma-separated). Refusing to start with open CORS.');
}

const app: Application = express();

// Security Middleware
app.use(helmet());
// With credentials:true the origin can never be '*' — echo the request
// origin in development, and require an explicit allowlist in production.
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? ALLOWED_ORIGINS : true,
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
        jwt.verify(authHeader.slice(7), process.env.JWT_SECRET!);
        next();
      } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
    });
  }
  
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, {
    customSiteTitle: 'SafeGuard API Docs',
  }));
  app.get('/api/docs.json', (_req, res) => res.json(openapiSpec));
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

// Global Error Handler (must be last)
app.use(errorHandler);

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    data: {},
    error: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
    request_id: req.headers['x-request-id'] || 'unknown',
  });
});

export default app;
