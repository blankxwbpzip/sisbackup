const {
  getGoogleAuthUrl, getMicrosoftAuthUrl,
  exchangeGoogleCode, exchangeMicrosoftCode,
  refreshGoogleToken, refreshMicrosoftToken,
  storeToken, getToken, deleteToken,
  buildGDriveRcloneConfig, buildOneDriveRcloneConfig,
  getGoogleUserInfo, getMicrosoftUserInfo,
} = require('../oauth');

async function oauthRoutes(fastify, opts) {
  // All OAuth routes require auth
  fastify.addHook('preHandler', fastify.authenticate);

  // ─── Google Drive ────────────────────────────────────────

  // Step 1: Get Google OAuth URL
  fastify.get('/api/oauth/google/url', async (request) => {
    const state = Buffer.from(JSON.stringify({
      userId: request.user.id,
      t: Date.now(),
    })).toString('base64');

    return {
      url: getGoogleAuthUrl(state),
      state,
    };
  });

  // Step 2: Exchange auth code for tokens
  fastify.post('/api/oauth/google/callback', async (request, reply) => {
    const { code } = request.body || {};
    if (!code) return reply.status(400).send({ error: 'Authorization code required' });

    try {
      const tokens = await exchangeGoogleCode(code);
      const userInfo = await getGoogleUserInfo(tokens.accessToken);

      storeToken(
        request.user.id, 'google',
        tokens.accessToken, tokens.refreshToken,
        tokens.expiry, userInfo.email, tokens.scope
      );

      // Build rclone config
      const rcloneConfig = buildGDriveRcloneConfig(
        tokens.accessToken, tokens.refreshToken
      );

      return {
        success: true,
        email: userInfo.email,
        name: userInfo.name,
        rcloneConfig,
      };
    } catch (err) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Check Google connection status
  fastify.get('/api/oauth/google/status', async (request) => {
    const token = getToken(request.user.id, 'google');
    if (!token) return { connected: false };

    // Check if token needs refresh
    const isExpired = token.expiry && new Date(token.expiry) <= new Date();
    return {
      connected: true,
      email: token.email,
      needsRefresh: isExpired,
    };
  });

  // Refresh Google token
  fastify.post('/api/oauth/google/refresh', async (request, reply) => {
    const token = getToken(request.user.id, 'google');
    if (!token || !token.refreshToken) {
      return reply.status(400).send({ error: 'No refresh token available. Re-authorize required.' });
    }

    try {
      const refreshed = await refreshGoogleToken(token.refreshToken);
      storeToken(
        request.user.id, 'google',
        refreshed.accessToken, token.refreshToken,
        refreshed.expiry, token.email, token.scope
      );
      return { success: true };
    } catch (err) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Disconnect Google
  fastify.delete('/api/oauth/google', async () => {
    deleteToken(request.user.id, 'google');
    return { success: true };
  });

  // ─── Microsoft OneDrive ──────────────────────────────────

  // Step 1: Get Microsoft OAuth URL
  fastify.get('/api/oauth/microsoft/url', async (request) => {
    const state = Buffer.from(JSON.stringify({
      userId: request.user.id,
      t: Date.now(),
    })).toString('base64');

    return {
      url: getMicrosoftAuthUrl(state),
      state,
    };
  });

  // Step 2: Exchange auth code for tokens
  fastify.post('/api/oauth/microsoft/callback', async (request, reply) => {
    const { code } = request.body || {};
    if (!code) return reply.status(400).send({ error: 'Authorization code required' });

    try {
      const tokens = await exchangeMicrosoftCode(code);
      const userInfo = await getMicrosoftUserInfo(tokens.accessToken);

      storeToken(
        request.user.id, 'microsoft',
        tokens.accessToken, tokens.refreshToken,
        tokens.expiry, userInfo.email, tokens.scope
      );

      const rcloneConfig = buildOneDriveRcloneConfig(
        tokens.accessToken, tokens.refreshToken
      );

      return {
        success: true,
        email: userInfo.email,
        name: userInfo.name,
        rcloneConfig,
      };
    } catch (err) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Check Microsoft connection status
  fastify.get('/api/oauth/microsoft/status', async (request) => {
    const token = getToken(request.user.id, 'microsoft');
    if (!token) return { connected: false };

    const isExpired = token.expiry && new Date(token.expiry) <= new Date();
    return {
      connected: true,
      email: token.email,
      needsRefresh: isExpired,
    };
  });

  // Refresh Microsoft token
  fastify.post('/api/oauth/microsoft/refresh', async (request, reply) => {
    const token = getToken(request.user.id, 'microsoft');
    if (!token || !token.refreshToken) {
      return reply.status(400).send({ error: 'No refresh token. Re-authorize required.' });
    }

    try {
      const refreshed = await refreshMicrosoftToken(token.refreshToken);
      storeToken(
        request.user.id, 'microsoft',
        refreshed.accessToken, token.refreshToken,
        refreshed.expiry, token.email, token.scope
      );
      return { success: true };
    } catch (err) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Disconnect Microsoft
  fastify.delete('/api/oauth/microsoft', async (request) => {
    deleteToken(request.user.id, 'microsoft');
    return { success: true };
  });

  // ─── Get all OAuth connections ───────────────────────────

  fastify.get('/api/oauth/connections', async (request) => {
    const googleToken = getToken(request.user.id, 'google');
    const microsoftToken = getToken(request.user.id, 'microsoft');

    return {
      google: googleToken ? {
        connected: true,
        email: googleToken.email,
        needsRefresh: googleToken.expiry && new Date(googleToken.expiry) <= new Date(),
      } : { connected: false },
      microsoft: microsoftToken ? {
        connected: true,
        email: microsoftToken.email,
        needsRefresh: microsoftToken.expiry && new Date(microsoftToken.expiry) <= new Date(),
      } : { connected: false },
    };
  });
}

module.exports = oauthRoutes;
