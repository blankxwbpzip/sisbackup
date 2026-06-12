/**
 * API client for Sisbackup App Server
 */

const API_BASE = window.location.origin;

let authToken = localStorage.getItem('sisbackup_token');

export function setToken(token) {
  authToken = token;
  if (token) localStorage.setItem('sisbackup_token', token);
  else localStorage.removeItem('sisbackup_token');
}

export function getToken() {
  return authToken;
}

async function request(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    setToken(null);
    window.location.href = '/login';
    throw new Error('Authentication required');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ─── Auth ─────────────────────────────────────────────────

export async function checkSetupStatus() {
  const res = await fetch(`${API_BASE}/api/auth/status`);
  return res.json();
}

export async function setupServer(username, password, displayName) {
  const res = await fetch(`${API_BASE}/api/auth/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, displayName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Setup failed');
  return data;
}

export async function login(username, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  setToken(data.token);
  return data;
}

export function logout() {
  setToken(null);
  window.location.href = '/login';
}

export async function getProfile() {
  return request('/api/auth/me');
}

export async function changePassword(currentPassword, newPassword) {
  return request('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

// ─── Users ────────────────────────────────────────────────

export async function getUsers() {
  return request('/api/users');
}

export async function createUser(userData) {
  return request('/api/users', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
}

export async function updateUserQuota(id, quotaBytes) {
  return request(`/api/users/${id}/quota`, {
    method: 'PATCH',
    body: JSON.stringify({ quotaBytes }),
  });
}

export async function updateUserStatus(id, isActive) {
  return request(`/api/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export async function resetUserPassword(id, newPassword) {
  return request(`/api/users/${id}/reset-password`, {
    method: 'PATCH',
    body: JSON.stringify({ newPassword }),
  });
}

export async function deleteUser(id) {
  return request(`/api/users/${id}`, { method: 'DELETE' });
}

export async function importUsers(users) {
  return request('/api/users/import', {
    method: 'POST',
    body: JSON.stringify({ users }),
  });
}

// ─── Config ───────────────────────────────────────────────

export async function getConfig() {
  return request('/api/config');
}

export async function updateConfig(updates) {
  return request('/api/config', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

// ─── Stats ────────────────────────────────────────────────

export async function getStats() {
  return request('/api/stats');
}

export async function getMyStats() {
  return request('/api/stats/my');
}

// ─── Sync ─────────────────────────────────────────────────

export async function getSyncSources() {
  return request('/api/sync/sources');
}

export async function getSyncDestinations() {
  return request('/api/sync/destinations');
}

export async function getSyncLogs(limit = 50) {
  return request(`/api/sync/logs?limit=${limit}`);
}

// ─── Health ───────────────────────────────────────────────

export async function getHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  return res.json();
}
