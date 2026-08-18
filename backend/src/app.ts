import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'crypto';
import { errorHandler } from './middleware/errorHandler';
import { standardLimiter } from './middleware/rateLimiter';

const app: Application = express();

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? process.env.ALLOWED_ORIGINS?.split(',') : '*',
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: { status: 'OK' },
    error: null,
    timestamp: new Date().toISOString(),
    request_id: req.headers['x-request-id'],
  });
});

// ── Feature Routes ────────────────────────────────────────────────
import appBlockingRoutes from './routes/appBlocking.routes';
app.use('/api/v1/children/:childId/apps', appBlockingRoutes);

// Global Error Handler (must be last)
app.use(errorHandler);

export default app;
