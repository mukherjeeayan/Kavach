import 'dotenv/config';
import http from 'http';
import app from './app';
import logger from './utils/logger';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { ruleEvents } from './utils/socketHub';
import { startScheduler, stopScheduler } from './jobs/scheduler';
import { contentScanner } from './utils/contentScanner';
import { startTelemetryWorker } from './workers/telemetryWorker';
import { initSentry } from './config/sentry';
import { attachRedisAdapter, disconnectRedisAdapter } from './config/socketRedisAdapter';
// Ensure DB is connected/initialized
import pool from './config/database';

// Initialize Sentry before anything else
initSentry();

// Fail fast: never boot with unset JWT secrets — every request would
// 500 or, worse, tokens would be unverifiable.
if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
  logger.error('JWT_SECRET / JWT_REFRESH_SECRET are not set. Refusing to start.');
  process.exit(1);
}

const PORT = process.env.PORT || 3000;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const server = http.createServer(app);

// WebSocket connection rate limiting (prevents thundering herd)
const connectionRateMap = new Map<string, number[]>();

// Daily retention purges (location/screen-time/audit logs, refresh tokens)
startScheduler();

// Pre-load keyword scanner for O(n+m) content moderation.
// Runs in background so server startup is not blocked.
contentScanner.refresh().catch((err) => {
  logger.warn('Content scanner initial load failed (will retry):', err);
});

// Start Redis Streams telemetry worker for async GPS persistence.
// Consumes from stream:telemetry:location and batch-inserts into PostgreSQL.
startTelemetryWorker();

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    methods: ['GET', 'POST'],
  }
});

// Attach Redis adapter for multi-instance broadcast (degrades gracefully)
attachRedisAdapter(io);

// Every socket must authenticate during the handshake with a valid,
// unscoped parent access token. Unauthenticated clients are rejected
// before any event handler is registered.
io.use((socket, next) => {
  // Rate limit WebSocket connections per IP (10 connections per minute)
  // to prevent thundering herd after server restarts.
  const clientIp = socket.handshake.address;
  const now = Date.now();
  const windowMs = 60_000; // 1 minute
  const maxConnections = 10;

  if (!connectionRateMap.has(clientIp)) {
    connectionRateMap.set(clientIp, []);
  }
  const timestamps = connectionRateMap.get(clientIp)!;

  // Remove timestamps outside the window
  while (timestamps.length > 0 && timestamps[0] < now - windowMs) {
    timestamps.shift();
  }

  if (timestamps.length >= maxConnections) {
    logger.warn(`WebSocket rate limit exceeded for ${clientIp}`);
    return next(new Error('Rate limit exceeded'));
  }
  timestamps.push(now);

  const authHeader = socket.handshake.auth?.token as string | undefined;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new Error('Unauthorized: no token provided'));
  }
  const token = authHeader.slice('Bearer '.length);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!, {
      algorithms: ['HS256'],
    }) as { userId?: string; role?: string; scope?: string };
    if (!decoded.userId || decoded.role !== 'parent' || decoded.scope) {
      return next(new Error('Unauthorized: invalid token'));
    }
    socket.data.userId = decoded.userId;
    next();
  } catch {
    next(new Error('Unauthorized: invalid or expired token'));
  }
});

io.on('connection', (socket) => {
  logger.info(`New client connected: ${socket.id}`);

  // The dashboard subscribes to a child's room to receive rule changes
  // in real time (no polling). Subscription is authorized: the
  // authenticated parent must own the child.
  socket.on('subscribe:child', async (childId: string) => {
    if (typeof childId !== 'string' || childId.length === 0) return;
    try {
      const result = await pool.query(
        `SELECT 1 FROM children WHERE id = $1 AND parent_id = $2`,
        [childId, socket.data.userId]
      );
      if ((result.rowCount ?? 0) === 0) {
        logger.warn(
          `Socket ${socket.id} denied subscription to child ${childId}`
        );
        return;
      }
      socket.join(`child:${childId}`);
      logger.info(`Client ${socket.id} subscribed to child ${childId}`);
    } catch (err) {
      logger.error(`Socket subscribe failed for ${socket.id}: ${err}`);
    }
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Broadcast rule changes (block/unblock/request/approve/reject) to the
// subscribed dashboard clients of the affected child.
ruleEvents.on('rule:changed', (childId: string) => {
  io.to(`child:${childId}`).emit('rule:changed', { childId });
});

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Shutting down server gracefully...');
  stopScheduler();
  await disconnectRedisAdapter();
  // Force-exit fallback so keep-alive connections can't hang shutdown
  const forceExit = setTimeout(() => {
    logger.warn('Forcing exit after 10s shutdown timeout');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async () => {
    logger.info('HTTP server closed.');
    await pool.end();
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

server.listen(PORT, () => {
  logger.info(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
process.on('unhandledRejection', (reason, promise) => { logger.error('Unhandled Rejection at:', promise, 'reason:', reason); process.exit(1); });
