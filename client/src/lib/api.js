/**
 * API client for Sisbackup App Server
 * Handles login, sync config, and status reporting
 */

let authToken = null;
let serverUrl = null;

export function setToken(token) {
  authToken = token;
  if (token) localStorage.setItem('sisbackup_token', token);
  else localStorage.removeItem('sisbackup_token');
}

export function getToken() {
  if (!authToken) authToken = localStorage.getItem('sisbackup_token');
  return authToken;
}

export function setServerUrl(url) {
  serverUrl = url;
  if (url) localStorage.setItem('sisbackup_server', url);
  else localStorage.removeItem('sisbackup_server');
}

export function getServerUrl() {
  if (!serverUrl) serverUrl = localStorage.getItem('sisbackup_server');
  return serverUrl;
}

async function request(url, options = {}) {
  const base = getServerUrl();
  if (!base) throw new Error('Server URL not configured');

  const headers = {
    'Content-Type': 'application/json',
    'X-Client-Id': getClientId(),
    ...options.headers,
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(`${base}${url}`, { ...options, headers });

  if (res.status === 401) {
    setToken(null);
    throw new Error('Authentication required');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ─── Client ID ────────────────────────────────────────────

function getClientId() {
  let id = localStorage.getItem('sisbackup_client_id');
  if (!id) {
    id = 'client-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
    localStorage.setItem('sisbackup_client_id', id);
  }
  return id;
}

// ─── Auth ─────────────────────────────────────────────────

export async function login(username, password) {
  const data = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(data.token);
  return data;
}

export function logout() {
  setToken(null);
}

export async function getProfile() {
  return request('/api/auth/me');
}

// ─── Sync Sources ─────────────────────────────────────────

export async function getSyncSources() {
  return request('/api/sync/sources');
}

export async function addSyncSource(source) {
  return request('/api/sync/sources', {
    method: 'POST',
    body: JSON.stringify(source),
  });
}

export async function updateSyncSource(id, updates) {
  return request(`/api/sync/sources/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteSyncSource(id) {
  return request(`/api/sync/sources/${id}`, { method: 'DELETE' });
}

// ─── Sync Destinations ────────────────────────────────────

export async function getSyncDestinations() {
  return request('/api/sync/destinations');
}

export async function addSyncDestination(dest) {
  return request('/api/sync/destinations', {
    method: 'POST',
    body: JSON.stringify(dest),
  });
}

export async function deleteSyncDestination(id) {
  return request(`/api/sync/destinations/${id}`, { method: 'DELETE' });
}

export async function toggleSyncDestination(id) {
  return request(`/api/sync/destinations/${id}/toggle`, { method: 'PATCH' });
}

// ─── Sync Logs ────────────────────────────────────────────

export async function createSyncLog(log) {
  return request('/api/sync/logs', {
    method: 'POST',
    body: JSON.stringify(log),
  });
}

export async function getSyncLogs(limit = 50) {
  return request(`/api/sync/logs?limit=${limit}`);
}

// ─── Stats ────────────────────────────────────────────────

export async function getMyStats() {
  return request('/api/stats/my');
}

// ─── OAuth (Fase 2) ───────────────────────────────────────

export async function getOAuthConnections() {
  return request('/api/oauth/connections');
}

export async function getOAuthUrl(provider) {
  return request(`/api/oauth/${provider}/url`);
}

export async function oauthCallback(provider, code) {
  return request(`/api/oauth/${provider}/callback`, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function disconnectOAuth(provider) {
  return request(`/api/oauth/${provider}`, { method: 'DELETE' });
}

export async function refreshOAuthToken(provider) {
  return request(`/api/oauth/${provider}/refresh`, { method: 'POST' });
}
