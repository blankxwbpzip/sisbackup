const { hashPassword, verifyPassword, generateToken, generateRefreshToken } = require('../auth');
const { getUserByUsername, createUser, getUserById, updateUserPassword } = require('../db');

async function authRoutes(fastify, opts) {
  // Login
  fastify.post('/api/auth/login', async (request, reply) => {
    const { username, password } = request.body || {};

    if (!username || !password) {
      return reply.status(400).send({ error: 'Username and password required' });
    }

    const user = getUserByUsername(username);
    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }
    if (!user.is_active) {
      return reply.status(403).send({ error: 'Account suspended' });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
        quotaBytes: user.quota_bytes,
        usedBytes: user.used_bytes,
      },
    };
  });

  // Register (admin creates users, but can also be used for initial setup)
  fastify.post('/api/auth/register', { preHandler: [fastify.authenticate] }, async (request, reply) => {
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
    createUser({ username, passwordHash, displayName, role, quotaBytes });

    return { success: true, message: 'User created' };
  });

  // Setup - create initial admin (only if no users exist)
  fastify.post('/api/auth/setup', async (request, reply) => {
    const { getAllUsers } = require('../db');
    const users = getAllUsers();

    if (users.length > 0) {
      // Check if there's a setup-in-progress token
      const authHeader = request.headers.authorization;
      if (!authHeader) {
        return reply.status(403).send({ error: 'System already set up. Admin login required.' });
      }
      // Allow if valid admin token
      try {
        const { verifyToken } = require('../auth');
        const decoded = verifyToken(authHeader.substring(7));
        if (!decoded || decoded.role !== 'admin') {
          return reply.status(403).send({ error: 'System already set up. Admin login required.' });
        }
      } catch {
        return reply.status(403).send({ error: 'System already set up. Admin login required.' });
      }
    }

    const { username, password, displayName } = request.body || {};
    if (!username || !password || !displayName) {
      return reply.status(400).send({ error: 'Username, password, and display name required' });
    }

    const existing = getUserByUsername(username);
    if (existing) {
      return reply.status(409).send({ error: 'Username already exists' });
    }

    const passwordHash = await hashPassword(password);
    createUser({
      username,
      passwordHash,
      displayName,
      role: 'admin',
      quotaBytes: 0, // admin doesn't need quota
    });

    const user = getUserByUsername(username);
    const token = generateToken(user);

    return {
      success: true,
      message: 'Server setup complete',
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
      },
    };
  });

  // Check setup status (no auth needed)
  fastify.get('/api/auth/status', async () => {
    const { getAllUsers } = require('../db');
    const users = getAllUsers();
    return { needsSetup: users.length === 0 };
  });

  // Refresh token
  fastify.post('/api/auth/refresh', async (request, reply) => {
    const { refreshToken } = request.body || {};
    if (!refreshToken) {
      return reply.status(400).send({ error: 'Refresh token required' });
    }

    const { verifyToken } = require('../auth');
    const decoded = verifyToken(refreshToken);
    if (!decoded || decoded.type !== 'refresh') {
      return reply.status(401).send({ error: 'Invalid refresh token' });
    }

    const user = getUserById(decoded.sub);
    if (!user || !user.is_active) {
      return reply.status(401).send({ error: 'User not found or inactive' });
    }

    const token = generateToken(user);
    const newRefreshToken = generateRefreshToken(user);
    return { token, refreshToken: newRefreshToken };
  });

  // Change password
  fastify.post('/api/auth/change-password', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { currentPassword, newPassword } = request.body || {};
    if (!currentPassword || !newPassword) {
      return reply.status(400).send({ error: 'Current and new password required' });
    }
    if (newPassword.length < 6) {
      return reply.status(400).send({ error: 'Password must be at least 6 characters' });
    }

    const valid = await verifyPassword(currentPassword, request.user.password_hash);
    if (!valid) {
      return reply.status(401).send({ error: 'Current password is incorrect' });
    }

    const newHash = await hashPassword(newPassword);
    updateUserPassword(request.user.id, newHash);
    return { success: true };
  });

  // Get current user profile
  fastify.get('/api/auth/me', { preHandler: [fastify.authenticate] }, async (request) => {
    return {
      id: request.user.id,
      username: request.user.username,
      displayName: request.user.display_name,
      role: request.user.role,
      quotaBytes: request.user.quota_bytes,
      usedBytes: request.user.used_bytes,
    };
  });
}

module.exports = authRoutes;
