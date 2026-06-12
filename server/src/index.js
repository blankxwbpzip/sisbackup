const Fastify = require('fastify');
const path = require('path');
const fs = require('fs-extra');

const { initialize } = require('./db');
const { authPlugin } = require('./auth');
const { setupWebSocket } = require('./websocket');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const syncRoutes = require('./routes/sync');
const configRoutes = require('./routes/config');
const statsRoutes = require('./routes/stats');
const oauthRoutes = require('./routes/oauth');
const rcloneConfigRoutes = require('./routes/rclone');

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    },
    bodyLimit: 100 * 1024 * 1024, // 100MB max upload
  });

  // ─── Plugins ──────────────────────────────────────────
  await fastify.register(require('@fastify/cors'), {
    origin: true, // Allow all origins in LAN
    credentials: true,
  });

  await fastify.register(require('@fastify/websocket'));
  await fastify.register(require('@fastify/multipart'), {
    limits: { fileSize: 100 * 1024 * 1024 },
  });

  // ─── Auth plugin ──────────────────────────────────────
  await fastify.register(authPlugin);

  // ─── API Routes ───────────────────────────────────────
  await fastify.register(authRoutes);
  await fastify.register(userRoutes);
  await fastify.register(syncRoutes);
  await fastify.register(configRoutes);
  await fastify.register(statsRoutes);
  await fastify.register(oauthRoutes);
  await fastify.register(rcloneConfigRoutes);

  // ─── Health check ─────────────────────────────────────
  fastify.get('/api/health', async () => {
    const { getConnectedClients } = require('./websocket');
    return {
      status: 'ok',
      uptime: process.uptime(),
      version: '2.0.0',
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      connections: getConnectedClients(),
    };
  });

  // ─── Serve static web UI ──────────────────────────────
  const webDist = path.join(__dirname, '..', 'web', 'dist');
  if (fs.existsSync(webDist)) {
    await fastify.register(require('@fastify/static'), {
      root: webDist,
      prefix: '/',
    });

    // SPA fallback
    fastify.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.status(404).send({ error: 'Not found' });
      }
      // Only serve index.html for non-API routes if the file exists
      const indexPath = path.join(webDist, 'index.html');
      if (fs.existsSync(indexPath)) {
        return reply.type('text/html').send(fs.readFileSync(indexPath, 'utf8'));
      }
      return reply.status(404).send({ error: 'Not found' });
    });
  }

  // ─── WebSocket ────────────────────────────────────────
  setupWebSocket(fastify);

  // ─── Graceful shutdown ────────────────────────────────
  const shutdown = async (signal) => {
    fastify.log.info(`Received ${signal}, shutting down...`);
    await fastify.close();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return fastify;
}

async function start() {
  // Initialize database
  initialize();

  const fastify = await buildServer();

  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('  📦 Sisbackup App Server v2.0');
    console.log(`  🌐 API:       http://${HOST}:${PORT}`);
    console.log(`  🔌 WebSocket: ws://${HOST}:${PORT}/ws`);
    console.log(`  💾 Database:  ${path.resolve(process.env.DB_PATH || path.join(__dirname, '..', 'data', 'sisbackup.db'))}`);
    console.log('═══════════════════════════════════════════════');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
