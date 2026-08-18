import 'dotenv/config';
import http from 'http';
import app from './app';
import logger from './utils/logger';
import { Server } from 'socket.io';
// Ensure DB and Redis are connected/initialized
import pool from './config/database';
import redisClient from './config/redis';

// Fail fast: never boot with an unset JWT secret — every request
// would 500 or, worse, tokens would be unverifiable.
if (!process.env.JWT_SECRET) {
  logger.error('JWT_SECRET is not set. Refusing to start.');
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
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
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
    await redisClient.quit();
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

server.listen(PORT, () => {
  logger.info(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
