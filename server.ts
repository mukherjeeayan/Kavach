import 'dotenv/config';
import http from 'http';
import path from 'path';
import fs from 'fs';
import express from 'express';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { createServer as createViteServer } from 'vite';

// Ensure default fallback secrets for dev environment
process.env.JWT_SECRET = process.env.JWT_SECRET || 'kavach_super_secret_jwt_key_for_dev_32chars_min';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'kavach_super_secret_refresh_jwt_key_for_dev_32chars_min';
process.env.ADMIN_ACCESS_KEY = process.env.ADMIN_ACCESS_KEY || 'kavach_admin_secret_key_1234567890';
if (!process.env.DB_DRIVER && !process.env.DATABASE_URL && !process.env.DB_PASSWORD) {
  process.env.DB_DRIVER = 'pg-mem';
}

import app from './backend/src/app';
import logger from './backend/src/utils/logger';
import pool from './backend/src/config/database';
import { ruleEvents } from './backend/src/utils/socketHub';
import { startScheduler, stopScheduler } from './backend/src/jobs/scheduler';
import { contentScanner } from './backend/src/utils/contentScanner';
import { startTelemetryWorker } from './backend/src/workers/telemetryWorker';
import { initializeDatabase } from './backend/src/config/initDb';

const PORT = 3000;
const expressApp = ((app as any).default || app) as express.Application;
const log = ((logger as any).default || logger) as typeof logger;

async function startServer() {
  // 1. Initialize database schema & demo seed data
  await initializeDatabase();

  // 2. Start workers & background schedulers
  startScheduler();

  contentScanner.refresh().catch((err) => {
    log.warn('Content scanner initial load skipped: ' + err.message);
  });

  startTelemetryWorker();

  // 3. Create HTTP server from Express app
  const server = http.createServer(expressApp);

  // 4. Setup Socket.IO
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  const connectionRateMap = new Map<string, number[]>();

  io.use((socket, next) => {
    const clientIp = socket.handshake.address;
    const now = Date.now();
    const windowMs = 60_000;
    const maxConnections = 30;

    if (!connectionRateMap.has(clientIp)) {
      connectionRateMap.set(clientIp, []);
    }
    const timestamps = connectionRateMap.get(clientIp)!;
    while (timestamps.length > 0 && timestamps[0] < now - windowMs) {
      timestamps.shift();
    }
    if (timestamps.length >= maxConnections) {
      return next(new Error('Rate limit exceeded'));
    }
    timestamps.push(now);

    const authHeader = (socket.handshake.auth?.token || socket.handshake.headers?.authorization) as string | undefined;
    if (!authHeader) {
      return next();
    }
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!, {
        algorithms: ['HS256'],
      }) as { userId?: string; role?: string; scope?: string };
      socket.data.userId = decoded.userId;
      next();
    } catch {
      next();
    }
  });

  io.on('connection', (socket) => {
    socket.on('subscribe:child', async (childId: string) => {
      if (typeof childId !== 'string' || childId.length === 0) return;
      socket.join(`child:${childId}`);
    });
  });

  ruleEvents.on('rule:changed', (childId: string) => {
    io.to(`child:${childId}`).emit('rule:changed', { childId });
  });

  // 5. Mount Vite middleware in development or serve static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      root: path.resolve(process.cwd(), 'frontend'),
    });
    expressApp.use(vite.middlewares);

    expressApp.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/socket.io')) {
        return next();
      }
      try {
        const indexPath = path.resolve(process.cwd(), 'frontend/index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(process.cwd(), 'frontend/dist');
    expressApp.use(express.static(distPath));
    expressApp.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 6. Graceful shutdown handlers
  const gracefulShutdown = async () => {
    log.info('Shutting down server gracefully...');
    stopScheduler();
    const forceExit = setTimeout(() => {
      process.exit(1);
    }, 5000);
    forceExit.unref();

    server.close(async () => {
      try {
        await pool.end();
      } catch {}
      process.exit(0);
    });
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  // 7. Start listening on PORT 3000
  server.listen(PORT, '0.0.0.0', () => {
    log.info(`Kavach server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
