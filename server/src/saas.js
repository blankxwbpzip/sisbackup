/**
 * SaaS Subscription Model (Fase 4)
 *
 * Subscription tiers untuk Siscloud:
 * - FREE: 5GB storage, 1 user, basic sync
 * - BASIC: 50GB, up to 10 users, scheduled sync
 * - PREMIUM: 500GB, unlimited users, versioning, priority support
 * - ENTERPRISE: Custom, LDAP, dedicated support, SLA
 */

const { db } = require('./db');

// ─── Subscription Plans Table ─────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS subscription_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    plan_key TEXT NOT NULL UNIQUE,
    price_per_month INTEGER NOT NULL DEFAULT 0,
    price_per_year INTEGER NOT NULL DEFAULT 0,
    storage_gb INTEGER NOT NULL DEFAULT 5,
    max_users INTEGER NOT NULL DEFAULT 1,
    max_sources INTEGER NOT NULL DEFAULT 2,
    features TEXT NOT NULL DEFAULT '{}',
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL UNIQUE,
    plan_key TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'active',
    started_at TEXT NOT NULL,
    expires_at TEXT,
    auto_renew INTEGER NOT NULL DEFAULT 1,
    payment_method TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// ─── Default Plans ────────────────────────────────────────

const DEFAULT_PLANS = [
  {
    name: 'Free',
    planKey: 'free',
    pricePerMonth: 0,
    pricePerYear: 0,
    storageGb: 5,
    maxUsers: 1,
    maxSources: 2,
    features: JSON.stringify({
      syncTypes: ['local_server'],
      versioning: false,
      retentionDays: 7,
      support: 'community',
      ldap: false,
      cloudSync: false,
    }),
    sortOrder: 0,
  },
  {
    name: 'Basic',
    planKey: 'basic',
    pricePerMonth: 50000,
    pricePerYear: 500000,
    storageGb: 50,
    maxUsers: 10,
    maxSources: 5,
    features: JSON.stringify({
      syncTypes: ['local_server', 'google_drive', 'onedrive'],
      versioning: true,
      retentionDays: 30,
      support: 'email',
      ldap: false,
      cloudSync: true,
    }),
    sortOrder: 1,
  },
  {
    name: 'Premium',
    planKey: 'premium',
    pricePerMonth: 200000,
    pricePerYear: 2000000,
    storageGb: 500,
    maxUsers: 0, // unlimited
    maxSources: 0, // unlimited
    features: JSON.stringify({
      syncTypes: ['local_server', 'google_drive', 'onedrive', 'siscloud'],
      versioning: true,
      retentionDays: 365,
      support: 'priority',
      ldap: true,
      cloudSync: true,
    }),
    sortOrder: 2,
  },
  {
    name: 'Enterprise',
    planKey: 'enterprise',
    pricePerMonth: 0, // custom pricing
    pricePerYear: 0,
    storageGb: 0, // custom
    maxUsers: 0,
    maxSources: 0,
    features: JSON.stringify({
      syncTypes: ['local_server', 'google_drive', 'onedrive', 'siscloud', 'custom'],
      versioning: true,
      retentionDays: 0, // unlimited
      support: 'dedicated',
      ldap: true,
      cloudSync: true,
      sla: true,
    }),
    sortOrder: 3,
  },
];

// ─── Seed Plans ───────────────────────────────────────────

function seedPlans() {
  const now = new Date().toISOString();
  for (const plan of DEFAULT_PLANS) {
    const existing = db.prepare('SELECT id FROM subscription_plans WHERE plan_key = ?').get(plan.planKey);
    if (!existing) {
      db.prepare(`
        INSERT INTO subscription_plans (id, name, plan_key, price_per_month, price_per_year,
          storage_gb, max_users, max_sources, features, is_active, sort_order, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        require('uuid').v4(), plan.name, plan.planKey,
        plan.pricePerMonth, plan.pricePerYear,
        plan.storageGb, plan.maxUsers, plan.maxSources,
        plan.features, plan.sortOrder, now
      );
    }
  }
}

// ─── Get Plans ────────────────────────────────────────────

function getPlans() {
  return db.prepare(
    'SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY sort_order ASC'
  ).all().map(p => ({
    ...p,
    features: JSON.parse(p.features),
  }));
}

function getPlan(planKey) {
  const plan = db.prepare(
    'SELECT * FROM subscription_plans WHERE plan_key = ? AND is_active = 1'
  ).get(planKey);
  if (!plan) return null;
  return { ...plan, features: JSON.parse(plan.features) };
}

// ─── User Limits Check ────────────────────────────────────

function checkUserLimit(tenantId) {
  const sub = db.prepare(
    'SELECT * FROM subscriptions WHERE tenant_id = ? AND status = ?'
  ).get(tenantId, 'active');

  if (!sub) {
    // Default to free plan limits
    return { plan: 'free', allowed: true, maxUsers: 1 };
  }

  const plan = getPlan(sub.plan_key);
  if (!plan) return { plan: 'free', allowed: false, reason: 'Plan not found' };

  if (plan.maxUsers === 0) return { plan: sub.plan_key, allowed: true, maxUsers: Infinity };

  const currentUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get().count;
  return {
    plan: sub.plan_key,
    allowed: currentUsers < plan.maxUsers,
    currentUsers,
    maxUsers: plan.maxUsers,
    remaining: plan.maxUsers - currentUsers,
  };
}

function checkStorageLimit(tenantId) {
  const sub = db.prepare(
    'SELECT * FROM subscriptions WHERE tenant_id = ? AND status = ?'
  ).get(tenantId, 'active');

  const plan = sub ? getPlan(sub.plan_key) : getPlan('free');
  if (!plan || plan.storageGb === 0) return { allowed: true, storageGb: Infinity };

  const usedBytes = db.prepare('SELECT COALESCE(SUM(used_bytes), 0) as total FROM users').get().total;
  const usedGb = usedBytes / (1024 ** 3);

  return {
    allowed: usedGb < plan.storageGb,
    usedGb,
    limitGb: plan.storageGb,
    remainingGb: plan.storageGb - usedGb,
    usagePercent: Math.round((usedGb / plan.storageGb) * 100),
  };
}

// ─── Feature Access Check ─────────────────────────────────

function hasFeature(tenantId, feature) {
  const sub = db.prepare(
    'SELECT * FROM subscriptions WHERE tenant_id = ? AND status = ?'
  ).get(tenantId, 'active');

  const plan = sub ? getPlan(sub.plan_key) : getPlan('free');
  if (!plan) return false;

  return plan.features[feature] === true;
}

// ─── Subscription Management ──────────────────────────────

function createSubscription(tenantId, planKey) {
  const plan = getPlan(planKey);
  if (!plan) throw new Error(`Invalid plan: ${planKey}`);

  const now = new Date().toISOString();
  const { v4: uuid } = require('uuid');

  const existing = db.prepare('SELECT id FROM subscriptions WHERE tenant_id = ?').get(tenantId);
  if (existing) {
    db.prepare(`
      UPDATE subscriptions
      SET plan_key = ?, status = 'active', started_at = ?, updated_at = ?
      WHERE tenant_id = ?
    `).run(planKey, now, now, tenantId);
    return existing.id;
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO subscriptions (id, tenant_id, plan_key, status, started_at, created_at, updated_at)
    VALUES (?, ?, ?, 'active', ?, ?, ?)
  `).run(id, tenantId, planKey, now, now, now);

  return id;
}

function cancelSubscription(tenantId) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE subscriptions SET status = 'cancelled', updated_at = ?
    WHERE tenant_id = ? AND status = 'active'
  `).run(now, tenantId);
}

function getSubscriptionStatus(tenantId) {
  const sub = db.prepare(
    'SELECT * FROM subscriptions WHERE tenant_id = ? AND status = ?'
  ).get(tenantId, 'active');

  if (!sub) return { plan: 'free', status: 'active' };

  const plan = getPlan(sub.plan_key);
  const storage = checkStorageLimit(tenantId);
  const users = checkUserLimit(tenantId);

  return {
    plan: sub.plan_key,
    planName: plan?.name || 'Free',
    status: sub.status,
    startedAt: sub.started_at,
    expiresAt: sub.expires_at,
    autoRenew: sub.auto_renew === 1,
    usage: {
      storage,
      users,
    },
    features: plan?.features || {},
  };
}

module.exports = {
  seedPlans,
  getPlans,
  getPlan,
  checkUserLimit,
  checkStorageLimit,
  hasFeature,
  createSubscription,
  cancelSubscription,
  getSubscriptionStatus,
};
