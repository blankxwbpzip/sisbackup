const {
  saveRemoteConfig, getUserRemotes, deleteRemoteConfig,
  toggleRemote, generateRcloneConf, writeRcloneConfFile,
} = require('../rclone-config');

async function rcloneRoutes(fastify, opts) {
  // All routes require auth
  fastify.addHook('preHandler', fastify.authenticate);

  // List user's remotes
  fastify.get('/api/rclone/remotes', async (request) => {
    return getUserRemotes(request.user.id);
  });

  // Generate rclone config text
  fastify.get('/api/rclone/config', async (request) => {
    const conf = generateRcloneConf(request.user.id);
    return {
      config: conf,
      remotes: getUserRemotes(request.user.id),
      filePath: writeRcloneConfFile(request.user.id),
    };
  });

  // Download rclone.conf file
  fastify.get('/api/rclone/config/download', async (request, reply) => {
    const filePath = writeRcloneConfFile(request.user.id);
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ error: 'Config file not found' });
    }
    return reply.type('application/octet-stream').send(fs.readFileSync(filePath));
  });

  // Add remote config
  fastify.post('/api/rclone/remotes', async (request, reply) => {
    const { remoteName, remoteType, remoteConfig } = request.body || {};
    if (!remoteName || !remoteType || !remoteConfig) {
      return reply.status(400).send({ error: 'remoteName, remoteType, and remoteConfig required' });
    }

    saveRemoteConfig(request.user.id, remoteName, remoteType, remoteConfig);
    return { success: true };
  });

  // Delete remote
  fastify.delete('/api/rclone/remotes/:name', async (request, reply) => {
    deleteRemoteConfig(request.user.id, request.params.name);
    return { success: true };
  });

  // Toggle remote
  fastify.patch('/api/rclone/remotes/:name/toggle', async (request, reply) => {
    const ok = toggleRemote(request.user.id, request.params.name);
    if (!ok) return reply.status(404).send({ error: 'Remote not found' });
    return { success: true };
  });
}

module.exports = rcloneRoutes;
