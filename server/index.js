/**
 * Polytopia WebSocket Game Server
 * 
 * Handles: room lifecycle, connection management, typed JSON protocol,
 * heartbeat/ping-pong, graceful disconnect cleanup.
 * 
 * State authority and turn management are deferred to add-game-state-delta-sync.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { randomBytes } from 'crypto';

// ── Configuration ──────────────────────────────────────────────────────────

const PORT = process.env.WS_PORT || 3002;
const HEARTBEAT_INTERVAL_MS = 15_000;
const PONG_TIMEOUT_MS = 10_000;
const MAX_ROOM_SIZE = 8;

// ── Room store ─────────────────────────────────────────────────────────────

/** @type {Map<string, {code: string, hostId: string, clients: Map<string, WebSocket>, createdAt: number}>} */
const rooms = new Map();

// ── Helpers ────────────────────────────────────────────────────────────────

function generateRoomCode() {
  return randomBytes(4)
    .toString('base64')
    .replace(/[+/=]/g, '')
    .substring(0, 6)
    .toUpperCase()
    .padEnd(6, 'X');
}

function send(ws, action, data = {}) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ action, ...data }));
  }
}

function broadcast(room, action, data = {}, excludeWs = null) {
  const message = JSON.stringify({ action, ...data });
  for (const [, client] of room.clients) {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function getRoomSummary(room) {
  return {
    roomCode: room.code,
    hostId: room.hostId,
    memberCount: room.clients.size,
    members: [...room.clients.keys()],
  };
}

function cleanupClient(ws) {
  // Remove from room
  const roomCode = ws._roomCode;
  const clientId = ws._clientId;

  if (roomCode && rooms.has(roomCode)) {
    const room = rooms.get(roomCode);
    room.clients.delete(clientId);

    if (room.clients.size === 0) {
      rooms.delete(roomCode);
    } else {
      // Reassign host if host left
      if (room.hostId === clientId) {
        room.hostId = room.clients.keys().next().value;
      }
      broadcast(room, 'ROOM_UPDATE', { room: getRoomSummary(room) });
    }
  }

  // Clear heartbeat timer
  if (ws._pongTimeout) {
    clearTimeout(ws._pongTimeout);
    ws._pongTimeout = null;
  }

  ws._roomCode = null;
  ws._clientId = null;
}

// ── Heartbeat ──────────────────────────────────────────────────────────────

function heartbeat(ws) {
  ws._isAlive = false;
  ws.ping();

  // Set pong timeout
  if (ws._pongTimeout) clearTimeout(ws._pongTimeout);
  ws._pongTimeout = setTimeout(() => {
    console.log(`[ws] Client ${ws._clientId} pong timeout — terminating`);
    ws.terminate();
  }, PONG_TIMEOUT_MS);
}

// ── Server setup ───────────────────────────────────────────────────────────

const wss = new WebSocketServer({ port: PORT });

console.log(`[ws] Server listening on ws://0.0.0.0:${PORT}`);

wss.on('connection', (ws, req) => {
  const clientId = randomBytes(8).toString('hex');
  ws._clientId = clientId;
  ws._roomCode = null;
  ws._pongTimeout = null;
  ws._isAlive = true;

  const clientIp = req.socket.remoteAddress || 'unknown';
  console.log(`[ws] Client connected: ${clientId} (${clientIp})`);

  // Send welcome
  send(ws, 'CONNECTED', { clientId });

  // Handle messages
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      send(ws, 'ERROR', { message: 'Invalid message format — expected JSON' });
      return;
    }

    const { action, ...data } = msg;

    // ── PONG ──
    if (action === 'PONG') {
      ws._isAlive = true;
      if (ws._pongTimeout) {
        clearTimeout(ws._pongTimeout);
        ws._pongTimeout = null;
      }
      return;
    }

    // ── CREATE_ROOM ──
    if (action === 'CREATE_ROOM') {
      if (ws._roomCode) {
        send(ws, 'ERROR', { message: 'Already in a room. Leave first.' });
        return;
      }

      let roomCode = generateRoomCode();
      // Avoid collisions (extremely unlikely but be safe)
      while (rooms.has(roomCode)) {
        roomCode = generateRoomCode();
      }

      const room = {
        code: roomCode,
        hostId: clientId,
        clients: new Map([[clientId, ws]]),
        createdAt: Date.now(),
      };

      rooms.set(roomCode, room);
      ws._roomCode = roomCode;

      console.log(`[ws] Room created: ${roomCode} by ${clientId}`);
      send(ws, 'ROOM_CREATED', { room: getRoomSummary(room) });
      return;
    }

    // ── JOIN ──
    if (action === 'JOIN') {
      const { roomCode } = data;

      if (!roomCode || typeof roomCode !== 'string') {
        send(ws, 'ERROR', { message: 'Missing or invalid roomCode' });
        return;
      }

      const code = roomCode.toUpperCase().trim();
      const room = rooms.get(code);

      if (!room) {
        send(ws, 'ERROR', { message: 'Room not found' });
        return;
      }

      if (room.clients.has(clientId)) {
        // Already in this room — idempotent
        send(ws, 'ROOM_JOINED', { room: getRoomSummary(room) });
        return;
      }

      if (room.clients.size >= MAX_ROOM_SIZE) {
        send(ws, 'ERROR', { message: `Room is full (max ${MAX_ROOM_SIZE})` });
        return;
      }

      // Leave current room if in one
      if (ws._roomCode) {
        cleanupClient(ws);
      }

      room.clients.set(clientId, ws);
      ws._roomCode = code;

      console.log(`[ws] ${clientId} joined room ${code} (${room.clients.size}/${MAX_ROOM_SIZE})`);

      send(ws, 'ROOM_JOINED', { room: getRoomSummary(room) });
      broadcast(room, 'ROOM_UPDATE', { room: getRoomSummary(room) }, ws);
      return;
    }

    // ── LEAVE ──
    if (action === 'LEAVE') {
      if (!ws._roomCode) {
        send(ws, 'ERROR', { message: 'Not in a room' });
        return;
      }

      const roomCode = ws._roomCode;
      cleanupClient(ws);
      console.log(`[ws] ${clientId} left room ${roomCode}`);
      send(ws, 'ROOM_LEFT', { roomCode });
      return;
    }

    // ── MESSAGE (chat) ──
    if (action === 'MESSAGE') {
      const { text } = data;
      if (!text || typeof text !== 'string' || text.length > 500) {
        send(ws, 'ERROR', { message: 'Message text must be 1-500 characters' });
        return;
      }
      if (!ws._roomCode) {
        send(ws, 'ERROR', { message: 'Not in a room' });
        return;
      }

      const room = rooms.get(ws._roomCode);
      broadcast(room, 'CHAT_MESSAGE', {
        from: clientId,
        text: text.substring(0, 500),
        timestamp: Date.now(),
      });
      return;
    }

    // ── Unknown action ──
    send(ws, 'ERROR', { message: `Unknown action: ${action}` });
  });

  // Handle pong responses
  ws.on('pong', () => {
    ws._isAlive = true;
    if (ws._pongTimeout) {
      clearTimeout(ws._pongTimeout);
      ws._pongTimeout = null;
    }
  });

  // Handle close
  ws.on('close', (code, reason) => {
    console.log(`[ws] Client disconnected: ${clientId} (code=${code}, reason=${reason || 'none'})`);
    cleanupClient(ws);
  });

  // Handle errors
  ws.on('error', (err) => {
    console.error(`[ws] Client ${clientId} error:`, err.message);
  });
});

// ── Heartbeat interval ─────────────────────────────────────────────────────

const heartbeatTimer = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws._isAlive === false) {
      console.log(`[ws] Client ${ws._clientId} heartbeat timeout — terminating`);
      ws.terminate();
      return;
    }
    heartbeat(ws);
  });
}, HEARTBEAT_INTERVAL_MS);

wss.on('close', () => {
  clearInterval(heartbeatTimer);
});

// ── Graceful shutdown ──────────────────────────────────────────────────────

process.on('SIGINT', () => {
  console.log('[ws] Shutting down...');
  wss.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[ws] Shutting down...');
  wss.close();
  process.exit(0);
});
