const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'sisbackup-dev-secret-change-in-production';
const JWT_EXPIRY = '24h';
const BCRYPT_ROUNDS = 12;

// ─── Password helpers ──────────────────────────────────────

async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// ─── Token helpers ─────────────────────────────────────────

function generateToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      type: 'refresh',
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// ─── Fastify auth plugin ───────────────────────────────────

async function authPlugin(fastify, opts) {
  fastify.decorate('authenticate', async function (request, reply) {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing or invalid token' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
      return reply.status(401).send({ error: 'Token expired or invalid' });
    }

    const { getUserById } = require('./db');
    const user = getUserById(decoded.sub);
    if (!user) {
      return reply.status(401).send({ error: 'User not found' });
    }
    if (!user.is_active) {
      return reply.status(403).send({ error: 'Account suspended' });
    }

    request.user = user;
  });

  fastify.decorate('requireAdmin', async function (request, reply) {
    if (!request.user || request.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Admin access required' });
    }
  });
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  generateRefreshToken,
  verifyToken,
  authPlugin,
  JWT_SECRET,
};
