const { v4: uuid } = require('uuid');
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUserQuota,
  updateUserStatus,
  updateUserPassword,
  deleteUser,
  getUserByUsername,
} = require('../db');
const { hashPassword } = require('../auth');

async function userRoutes(fastify, opts) {
  // All routes require auth + admin
  fastify.addHook('preHandler', fastify.authenticate);

  // List all users
  fastify.get('/api/users', async (request, reply) => {
    await fastify.requireAdmin(request, reply);
    if (reply.sent) return;
    return getAllUsers();
  });

  // Get single user
  fastify.get('/api/users/:id', async (request, reply) => {
    await fastify.requireAdmin(request, reply);
    if (reply.sent) return;

    const user = getUserById(request.params.id);
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }
    return {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      quotaBytes: user.quota_bytes,
      usedBytes: user.used_bytes,
      isActive: user.is_active,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  });

  // Create user
  fastify.post('/api/users', async (request, reply) => {
    await fastify.requireAdmin(request, reply);
    if (reply.sent) return;

    const { username, password, displayName, role, quotaBytes } = request.body || {};
    if (!username || !password || !displayName) {
      return reply.status(400).send({ error: 'Username, password, and display name required' });
    }

    const existing = getUserByUsername(username);
    if (existing) {
      return reply.status(409).send({ error: 'Username already exists' });
    }

    const passwordHash = await hashPassword(password);
    const result = createUser({ username, passwordHash, displayName, role, quotaBytes });

    const user = getUserById(result.lastInsertRowid || getUserByUsername(username)?.id);
    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
        quotaBytes: user.quota_bytes,
      },
    };
  });

  // Update user quota
  fastify.patch('/api/users/:id/quota', async (request, reply) => {
    await fastify.requireAdmin(request, reply);
    if (reply.sent) return;

    const { quotaBytes } = request.body || {};
    if (quotaBytes === undefined || quotaBytes < 0) {
      return reply.status(400).send({ error: 'Valid quotaBytes required' });
    }

    const user = getUserById(request.params.id);
    if (!user) return reply.status(404).send({ error: 'User not found' });

    updateUserQuota(request.params.id, quotaBytes);
    return { success: true };
  });

  // Update user active status
  fastify.patch('/api/users/:id/status', async (request, reply) => {
    await fastify.requireAdmin(request, reply);
    if (reply.sent) return;

    const { isActive } = request.body || {};
    const user = getUserById(request.params.id);
    if (!user) return reply.status(404).send({ error: 'User not found' });

    updateUserStatus(request.params.id, isActive);
    return { success: true };
  });

  // Reset user password
  fastify.patch('/api/users/:id/reset-password', async (request, reply) => {
    await fastify.requireAdmin(request, reply);
    if (reply.sent) return;

    const { newPassword } = request.body || {};
    if (!newPassword || newPassword.length < 6) {
      return reply.status(400).send({ error: 'Password must be at least 6 characters' });
    }

    const user = getUserById(request.params.id);
    if (!user) return reply.status(404).send({ error: 'User not found' });

    const newHash = await hashPassword(newPassword);
    updateUserPassword(request.params.id, newHash);
    return { success: true };
  });

  // Delete user
  fastify.delete('/api/users/:id', async (request, reply) => {
    await fastify.requireAdmin(request, reply);
    if (reply.sent) return;

    const user = getUserById(request.params.id);
    if (!user) return reply.status(404).send({ error: 'User not found' });
    if (user.role === 'admin') {
      return reply.status(403).send({ error: 'Cannot delete admin user' });
    }

    deleteUser(request.params.id);
    return { success: true };
  });

  // Bulk import users via CSV
  fastify.post('/api/users/import', async (request, reply) => {
    await fastify.requireAdmin(request, reply);
    if (reply.sent) return;

    const { users: importUsers } = request.body || {};
    if (!importUsers || !Array.isArray(importUsers) || importUsers.length === 0) {
      return reply.status(400).send({ error: 'Array of users required' });
    }

    const results = { created: 0, skipped: 0, errors: [] };
    for (const u of importUsers) {
      try {
        if (!u.username || !u.password || !u.displayName) {
          results.errors.push({ username: u.username || 'N/A', error: 'Missing fields' });
          results.skipped++;
          continue;
        }
        const existing = getUserByUsername(u.username);
        if (existing) {
          results.errors.push({ username: u.username, error: 'Already exists' });
          results.skipped++;
          continue;
        }
        const passwordHash = await hashPassword(u.password);
        createUser({
          username: u.username,
          passwordHash,
          displayName: u.displayName,
          role: u.role || 'user',
          quotaBytes: u.quotaBytes || undefined,
        });
        results.created++;
      } catch (e) {
        results.errors.push({ username: u.username || 'N/A', error: e.message });
        results.skipped++;
      }
    }
    return results;
  });
}

module.exports = userRoutes;
