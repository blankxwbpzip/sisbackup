/**
 * OAuth handler for Google Drive & Microsoft OneDrive
 *
 * Flow:
 * 1. Client requests OAuth URL → Server returns auth URL
 * 2. User authorizes in browser → Redirect to localhost callback (Tauri)
 * 3. Client sends auth code to server → Server exchanges for tokens
 * 4. Server stores encrypted tokens → Returns success
 * 5. Client uses rclone with stored config
 */

const crypto = require('crypto');
const { getConfig, setConfig } = require('./db');

// ─── Encryption for token storage ─────────────────────────

const ENCRYPTION_KEY = (() => {
  const existing = getConfig('encryption_key');
  if (existing) return Buffer.from(existing, 'hex');
  const key = crypto.randomBytes(32);
  setConfig('encryption_key', key.toString('hex'));
  return key;
})();

const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText) {
  const parts = encryptedText.split(':');
  if (parts.length !== 2) return null;
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ─── Token store in DB ────────────────────────────────────

const { db } = require('./db');

// Ensure oauth_tokens table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS oauth_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,  -- 'google' | 'microsoft'
    access_token_enc TEXT NOT NULL,
    refresh_token_enc TEXT,
    token_expiry TEXT,
    provider_email TEXT,
    scope TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, provider)
  );
`);

function storeToken(userId, provider, accessToken, refreshToken, expiry, email, scope) {
  const now = new Date().toISOString();
  const { v4: uuid } = require('uuid');
  const id = uuid();

  db.prepare(`
    INSERT INTO oauth_tokens (id, user_id, provider, access_token_enc, refresh_token_enc, token_expiry, provider_email, scope, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, provider) DO UPDATE SET
      access_token_enc = excluded.access_token_enc,
      refresh_token_enc = excluded.refresh_token_enc,
      token_expiry = excluded.token_expiry,
      provider_email = excluded.provider_email,
      scope = excluded.scope,
      updated_at = excluded.updated_at
  `).run(id, userId, provider, encrypt(accessToken), refreshToken ? encrypt(refreshToken) : null,
    expiry || null, email || null, scope || null, now, now);
}

function getToken(userId, provider) {
  const row = db.prepare(
    'SELECT * FROM oauth_tokens WHERE user_id = ? AND provider = ?'
  ).get(userId, provider);
  if (!row) return null;

  return {
    accessToken: decrypt(row.access_token_enc),
    refreshToken: row.refresh_token_enc ? decrypt(row.refresh_token_enc) : null,
    expiry: row.token_expiry,
    email: row.provider_email,
    scope: row.scope,
  };
}

function deleteToken(userId, provider) {
  db.prepare('DELETE FROM oauth_tokens WHERE user_id = ? AND provider = ?')
    .run(userId, provider);
}

// ─── OAuth URL builders ───────────────────────────────────

// Google OAuth
function getGoogleAuthUrl(state) {
  const clientId = getConfig('google_client_id') || process.env.GOOGLE_CLIENT_ID || '';
  const redirectUri = getConfig('google_redirect_uri') || process.env.GOOGLE_REDIRECT_URI ||
    'http://localhost:1420/oauth/callback';

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive.file',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Microsoft OneDrive OAuth
function getMicrosoftAuthUrl(state) {
  const clientId = getConfig('microsoft_client_id') || process.env.MICROSOFT_CLIENT_ID || '';
  const redirectUri = getConfig('microsoft_redirect_uri') || process.env.MICROSOFT_REDIRECT_URI ||
    'http://localhost:1420/oauth/callback';

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'Files.ReadWrite.All offline_access',
    response_mode: 'query',
    state,
  });

  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

// ─── Token exchange ───────────────────────────────────────

async function exchangeGoogleCode(code) {
  const clientId = getConfig('google_client_id') || process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = getConfig('google_client_secret') || process.env.GOOGLE_CLIENT_SECRET || '';
  const redirectUri = getConfig('google_redirect_uri') || process.env.GOOGLE_REDIRECT_URI ||
    'http://localhost:1420/oauth/callback';

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token exchange failed: ${err}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiry: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null,
    scope: data.scope,
  };
}

async function refreshGoogleToken(refreshToken) {
  const clientId = getConfig('google_client_id') || process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = getConfig('google_client_secret') || process.env.GOOGLE_CLIENT_SECRET || '';

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });

  if (!res.ok) throw new Error('Google token refresh failed');

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiry: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null,
  };
}

async function exchangeMicrosoftCode(code) {
  const clientId = getConfig('microsoft_client_id') || process.env.MICROSOFT_CLIENT_ID || '';
  const clientSecret = getConfig('microsoft_client_secret') || process.env.MICROSOFT_CLIENT_SECRET || '';
  const redirectUri = getConfig('microsoft_redirect_uri') || process.env.MICROSOFT_REDIRECT_URI ||
    'http://localhost:1420/oauth/callback';

  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Microsoft token exchange failed: ${err}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiry: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null,
    scope: data.scope,
  };
}

async function refreshMicrosoftToken(refreshToken) {
  const clientId = getConfig('microsoft_client_id') || process.env.MICROSOFT_CLIENT_ID || '';
  const clientSecret = getConfig('microsoft_client_secret') || process.env.MICROSOFT_CLIENT_SECRET || '';

  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });

  if (!res.ok) throw new Error('Microsoft token refresh failed');

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiry: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null,
  };
}

// ─── rclone config builders ───────────────────────────────

function buildGDriveRcloneConfig(accessToken, refreshToken, folder = 'Sisbackup') {
  // rclone remote config for Google Drive
  // The tokens are used by rclone directly
  return {
    type: 'drive',
    scope: 'drive.file',
    token: JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expiry: new Date(Date.now() + 3600 * 1000).toISOString(),
    }),
    root_folder_id: '',
    team_drive: '',
  };
}

function buildOneDriveRcloneConfig(accessToken, refreshToken, folder = 'Sisbackup') {
  return {
    type: 'onedrive',
    token: JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expiry: new Date(Date.now() + 3600 * 1000).toISOString(),
    }),
    drive_id: '',
    drive_type: 'personal',
  };
}

// ─── Get user info from provider ──────────────────────────

async function getGoogleUserInfo(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to get Google user info');
  const data = await res.json();
  return { email: data.email, name: data.name, picture: data.picture };
}

async function getMicrosoftUserInfo(accessToken) {
  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to get Microsoft user info');
  const data = await res.json();
  return {
    email: data.mail || data.userPrincipalName,
    name: data.displayName,
  };
}

module.exports = {
  encrypt,
  decrypt,
  storeToken,
  getToken,
  deleteToken,
  getGoogleAuthUrl,
  getMicrosoftAuthUrl,
  exchangeGoogleCode,
  refreshGoogleToken,
  exchangeMicrosoftCode,
  refreshMicrosoftToken,
  buildGDriveRcloneConfig,
  buildOneDriveRcloneConfig,
  getGoogleUserInfo,
  getMicrosoftUserInfo,
};
