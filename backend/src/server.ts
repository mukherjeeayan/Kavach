import 'dotenv/config';
import http from 'http';
import app from './app';
import logger from './utils/logger';
import { Server } from 'socket.io';
import { ruleEvents } from './utils/socketHub';
// Ensure DB is connected/initialized
import pool from './config/database';

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

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? allowedOrigins : '*',
    methods: ['GET', 'POST'],
  }
});

io.on('connection', (socket) => {
  logger.info(`New client connected: ${socket.id}`);

  // The dashboard subscribes to a child's room to receive rule changes
  // in real time (no polling).
  socket.on('subscribe:child', (childId: string) => {
    if (typeof childId === 'string' && childId.length > 0) {
      socket.join(`child:${childId}`);
      logger.info(`Client ${socket.id} subscribed to child ${childId}`);
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
