const { getAllConfig, setConfig, getConfig } = require('../db');

async function configRoutes(fastify, opts) {
  // All routes require auth + admin
  fastify.addHook('preHandler', fastify.authenticate);

  // Get all config
  fastify.get('/api/config', async (request, reply) => {
    await fastify.requireAdmin(request, reply);
    if (reply.sent) return;

    const rows = getAllConfig();
    const config = {};
    for (const row of rows) {
      config[row.key] = row.value;
    }
    return config;
  });

  // Update config
  fastify.patch('/api/config', async (request, reply) => {
    await fastify.requireAdmin(request, reply);
    if (reply.sent) return;

    const updates = request.body || {};
    const allowedKeys = ['storage_path', 'default_quota', 'retention_days', 'cloud_enabled', 'siscloud_url', 'siscloud_school_id'];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedKeys.includes(key)) {
        setConfig(key, String(value));
      }
    }

    return { success: true };
  });

  // Get a single config value
  fastify.get('/api/config/:key', async (request, reply) => {
    await fastify.requireAdmin(request, reply);
    if (reply.sent) return;

    const value = getConfig(request.params.key);
    if (value === null) {
      return reply.status(404).send({ error: 'Config key not found' });
    }
    return { key: request.params.key, value };
  });
}

module.exports = configRoutes;
