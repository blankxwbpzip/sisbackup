/**
 * Siscloud Authentication
 *
 * Two auth methods:
 * 1. API Key — for App Server → Siscloud sync
 * 2. JWT Session — for web portal users (admin/guru login)
 */
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'siscloud-dev-secret-change-in-production';
const JWT_EXPIRY = '24h';

// ─── API Key Auth ─────────────────────────────────────────

export async function validateApiKey(apiKey) {
  const crypto = require('crypto');
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  const key = await prisma.apiKey.findFirst({
    where: { keyHash, isActive: true },
    include: { school: true },
  });

  if (key) {
    await prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });
  }

  return key;
}

export async function generateApiKey(schoolId, name) {
  const crypto = require('crypto');
  const rawKey = `sc_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  await prisma.apiKey.create({
    data: { schoolId, keyHash, name },
  });

  return rawKey; // Only returned once!
}

// ─── JWT Session Auth ─────────────────────────────────────

export function generateToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      schoolId: user.schoolId,
      role: user.role || 'user',
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// ─── Web Portal Auth ──────────────────────────────────────

export async function authenticatePortal(username, password) {
  // Find user across all schools
  const user = await prisma.schoolUser.findFirst({
    where: { username },
    include: { school: true },
  });

  if (!user || !user.school.isActive) return null;

  // For web portal, password is stored in a separate auth table
  // (School users are synced from App Server; web auth is managed separately)
  const auth = await prisma.portalAuth.findUnique({
    where: { schoolUserId: user.id },
  });

  if (!auth) return null;

  const valid = await bcrypt.compare(password, auth.passwordHash);
  if (!valid) return null;

  return {
    ...user,
    token: generateToken(user),
  };
}

// ─── Rate Limiting ────────────────────────────────────────

const rateLimitStore = new Map();

export function checkRateLimit(key, maxRequests = 100, windowMs = 60000) {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now - record.windowStart > windowMs) {
    rateLimitStore.set(key, { windowStart: now, count: 1 });
    return true;
  }

  if (record.count >= maxRequests) return false;
  record.count++;
  return true;
}
