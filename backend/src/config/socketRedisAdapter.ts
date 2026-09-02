// socketRedisAdapter.ts
// Attaches the Socket.IO Redis adapter for horizontal scaling.
// When Redis is configured, socket events are broadcast across all backend
// instances. When Redis is unavailable, falls back to single-instance mode
// (events only reach the connected instance).
//
// Uses @socket.io/redis-adapter which wraps ioredis pub/sub under the hood.
// Each backend instance creates two Redis connections (pub + sub) dedicated
// to Socket.IO; these are separate from the rate-limiter and telemetry
// stream clients.

import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import logger from '../utils/logger';

let pubClient: Redis | null = null;
let subClient: Redis | null = null;

/**
 * Attempt to attach the Redis adapter to the Socket.IO server.
 * Silently degrades to in-memory adapter when Redis is not configured
 * or unreachable — the server never fails to start because of Redis.
 */
export function attachRedisAdapter(io: SocketIOServer): void {
  const url = process.env.REDIS_URL;
  if (!url || url.trim() === '' || url === 'undefined') {
    logger.info('Redis not configured — using in-memory Socket.IO adapter (single-instance mode)');
    return;
  }

  try {
    pubClient = new Redis(url, {
      lazyConnect: true,
      enableReadyCheck: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => (times > 3 ? null : 200),
    });

    subClient = pubClient.duplicate();

    Promise.all([pubClient.connect(), subClient.connect()])
      .then(() => {
        io.adapter(createAdapter(pubClient!, subClient!));
        logger.info('Socket.IO Redis adapter connected — multi-instance broadcast enabled');
      })
      .catch((err) => {
        logger.warn('Socket.IO Redis adapter failed to connect, falling back to in-memory:', err?.message);
        cleanup();
      });

    pubClient.on('error', (err) => {
      logger.warn('Socket.IO Redis pub client error:', err?.message);
    });

    subClient.on('error', (err) => {
      logger.warn('Socket.IO Redis sub client error:', err?.message);
    });
  } catch (err) {
    logger.warn('Socket.IO Redis adapter initialization failed, using in-memory:', err);
    cleanup();
  }
}

/** Close Redis connections used by the Socket.IO adapter. */
export function disconnectRedisAdapter(): Promise<void> {
  const closePub = pubClient?.quit().catch(() => {});
  const closeSub = subClient?.quit().catch(() => {});
  return Promise.all([closePub, closeSub]).then(() => cleanup());
}

function cleanup(): void {
  pubClient = null;
  subClient = null;
}
