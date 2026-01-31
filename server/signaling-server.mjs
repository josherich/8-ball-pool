import { WebSocketServer } from 'ws';

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

/**
 * Room-based WebRTC signaling server for 8-ball pool multiplayer.
 * 
 * Protocol:
 * Client -> Server:
 *   { type: 'join', room: 'ABC123' }
 *   { type: 'leave' }
 *   { type: 'signal', room: 'ABC123', data: <SimplePeer signal payload> }
 * 
 * Server -> Client:
 *   { type: 'room-joined', room: 'ABC123', isHost: true|false, peerCount: number }
 *   { type: 'peer-joined', peerCount: number }
 *   { type: 'peer-left', peerCount: number }
 *   { type: 'signal', data: ... }
 *   { type: 'error', message: string }
 *   { type: 'room-full' }
 */

const wss = new WebSocketServer({ port: PORT });

/** @type {Map<string, Set<import('ws').WebSocket>>} */
const rooms = new Map();

/** @type {Map<import('ws').WebSocket, string>} */
const clientRooms = new Map();

const MAX_ROOM_SIZE = 2; // Pool is 2 players

function safeSend(ws, obj) {
  if (ws.readyState !== ws.OPEN) return;
  try {
    ws.send(JSON.stringify(obj));
  } catch (err) {
    console.error('[signaling] Send error:', err.message);
  }
}

function broadcastToRoom(room, obj, exceptWs = null) {
  const peers = rooms.get(room);
  if (!peers) return;
  for (const ws of peers) {
    if (ws === exceptWs) continue;
    safeSend(ws, obj);
  }
}

function leaveCurrentRoom(ws) {
  const room = clientRooms.get(ws);
  if (!room) return;

  const peers = rooms.get(room);
  if (peers) {
    peers.delete(ws);
    if (peers.size === 0) {
      rooms.delete(room);
      console.log(`[signaling] Room ${room} destroyed (empty)`);
    } else {
      broadcastToRoom(room, { type: 'peer-left', peerCount: peers.size });
      console.log(`[signaling] Peer left room ${room}, ${peers.size} remaining`);
    }
  }
  clientRooms.delete(ws);
}

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[signaling] New connection from ${clientIp}`);

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (buf) => {
    let msg;
    try {
      msg = JSON.parse(buf.toString());
    } catch {
      safeSend(ws, { type: 'error', message: 'Invalid JSON' });
      return;
    }

    if (!msg || typeof msg.type !== 'string') {
      safeSend(ws, { type: 'error', message: 'Missing message type' });
      return;
    }

    // Handle join
    if (msg.type === 'join') {
      const room = (msg.room || '').toString().trim().toUpperCase();
      if (!room || room.length < 4 || room.length > 10) {
        safeSend(ws, { type: 'error', message: 'Invalid room code' });
        return;
      }

      // Leave any existing room first
      leaveCurrentRoom(ws);

      // Check room capacity
      if (!rooms.has(room)) {
        rooms.set(room, new Set());
      }

      const peers = rooms.get(room);
      if (peers.size >= MAX_ROOM_SIZE) {
        safeSend(ws, { type: 'room-full' });
        return;
      }

      // Join room
      const isHost = peers.size === 0;
      peers.add(ws);
      clientRooms.set(ws, room);

      console.log(`[signaling] Client joined room ${room} as ${isHost ? 'host' : 'guest'}, ${peers.size} total`);

      // Notify the joining client
      safeSend(ws, { 
        type: 'room-joined', 
        room, 
        isHost,
        peerCount: peers.size 
      });

      // Notify other peers (if any) that someone joined
      if (!isHost) {
        broadcastToRoom(room, { type: 'peer-joined', peerCount: peers.size }, ws);
      }

      return;
    }

    // Handle explicit leave
    if (msg.type === 'leave') {
      leaveCurrentRoom(ws);
      safeSend(ws, { type: 'left' });
      return;
    }

    // Handle WebRTC signal relay
    if (msg.type === 'signal') {
      const room = clientRooms.get(ws);
      if (!room) {
        safeSend(ws, { type: 'error', message: 'Not in a room' });
        return;
      }

      if (msg.data == null) {
        safeSend(ws, { type: 'error', message: 'Missing signal data' });
        return;
      }

      // Relay signal to all other peers in the room
      broadcastToRoom(room, { type: 'signal', data: msg.data }, ws);
      return;
    }

    // Unknown message type
    safeSend(ws, { type: 'error', message: `Unknown message type: ${msg.type}` });
  });

  ws.on('close', () => {
    console.log(`[signaling] Connection closed from ${clientIp}`);
    leaveCurrentRoom(ws);
  });

  ws.on('error', (err) => {
    console.error(`[signaling] WebSocket error:`, err.message);
    leaveCurrentRoom(ws);
  });
});

// Heartbeat to detect stale connections
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      console.log('[signaling] Terminating stale connection');
      leaveCurrentRoom(ws);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

console.log(`[signaling] WebSocket signaling server running on ws://localhost:${PORT}`);
console.log(`[signaling] Max room size: ${MAX_ROOM_SIZE} players`);
