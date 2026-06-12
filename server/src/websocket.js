/**
 * WebSocket handler for real-time monitoring
 * Clients connect to receive live sync status updates
 */

const { verifyToken } = require('./auth');

const clients = new Map(); // userId -> Set<WebSocket>

function setupWebSocket(fastify) {
  fastify.get('/ws', { websocket: true }, (socket, request) => {
    let userId = null;

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'auth') {
          const decoded = verifyToken(msg.token);
          if (!decoded) {
            socket.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
            socket.close();
            return;
          }
          userId = decoded.sub;

          if (!clients.has(userId)) {
            clients.set(userId, new Set());
          }
          clients.get(userId).add(socket);

          socket.send(JSON.stringify({ type: 'connected', userId }));
        } else if (msg.type === 'sync-progress') {
          // Client reports sync progress — broadcast to admin clients
          broadcastAdmins({
            type: 'sync-update',
            userId,
            ...msg.data,
            timestamp: new Date().toISOString(),
          });
        } else if (msg.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
      } catch (e) {
        socket.send(JSON.stringify({ type: 'error', message: e.message }));
      }
    });

    socket.on('close', () => {
      if (userId && clients.has(userId)) {
        const userSockets = clients.get(userId);
        userSockets.delete(socket);
        if (userSockets.size === 0) {
          clients.delete(userId);
        }
      }
    });

    socket.on('error', () => {
      // Swallow — cleanup handled in close
    });
  });
}

function broadcastAdmins(data) {
  const { db, getUserById } = require('./db');
  // For now, broadcast to ALL connected clients
  // In production, filter to admin users only
  for (const [userId, sockets] of clients.entries()) {
    for (const socket of sockets) {
      try {
        socket.send(JSON.stringify(data));
      } catch {
        // Socket may be dead — cleanup
      }
    }
  }
}

function broadcastToUser(userId, data) {
  const userSockets = clients.get(userId);
  if (!userSockets) return;
  for (const socket of userSockets) {
    try {
      socket.send(JSON.stringify(data));
    } catch {
      // Dead socket
    }
  }
}

function getConnectedClients() {
  return {
    totalConnections: [...clients.values()].reduce((sum, s) => sum + s.size, 0),
    uniqueUsers: clients.size,
  };
}

module.exports = {
  setupWebSocket,
  broadcastAdmins,
  broadcastToUser,
  getConnectedClients,
};
