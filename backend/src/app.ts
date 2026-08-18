import 'dotenv/config';
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'crypto';
import { errorHandler } from './middleware/errorHandler';
import { standardLimiter } from './middleware/rateLimiter';
import logger from './utils/logger';

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  throw new Error('ALLOWED_ORIGINS must be set in production (comma-separated). Refusing to start with open CORS.');
}

const app: Application = express();

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? allowedOrigins : '*',
  credentials: true,
}));

// Body Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global Rate Limiting
app.use(standardLimiter);

// Setup Request ID
app.use((req, res, next) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || crypto.randomUUID();
  next();
});

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
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/children/:childId/apps', appBlockingRoutes);
app.use('/api/v1/children', childrenRoutes);
app.use('/api/v1/children', screentimeRoutes);
app.use('/api/v1/children', locksRoutes);
app.use('/api/v1/children', locationRoutes);
app.use('/api/v1/children', contactsRoutes);
app.use('/api/v1/devices', deviceAlertRoutes);
app.use('/api/v1/devices', deviceRoutes);
app.use('/api/v1/devices', screentimeDeviceRoutes);
app.use('/api/v1/devices', locationDeviceRoutes);

// Global Error Handler (must be last)
app.use(errorHandler);

export default app;
