import { WebSocketServer } from 'ws';

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

/**
 * Minimal room-based signaling server.
 *
 * Protocol:
 * - client -> server: { type: 'join', room: 'ABC123' }
 * - client -> server: { type: 'signal', room: 'ABC123', data: <simple-peer signal payload> }
 * - server -> client: { type: 'peer-joined' }
 * - server -> client: { type: 'signal', data: ... }
 * - server -> client: { type: 'peer-left' }
 */

const wss = new WebSocketServer({ port: PORT });

/** @type {Map<string, Set<import('ws').WebSocket>>} */
const rooms = new Map();

function safeSend(ws, obj) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(obj));
}

function broadcastExcept(room, exceptWs, obj) {
  const peers = rooms.get(room);
  if (!peers) return;
  for (const ws of peers) {
    if (ws === exceptWs) continue;
    safeSend(ws, obj);
  }
}

wss.on('connection', (ws) => {
  ws._room = null;

  ws.on('message', (buf) => {
    let msg;
    try {
      msg = JSON.parse(buf.toString());
    } catch {
      return;
    }

    if (msg?.type === 'join' && typeof msg.room === 'string') {
      const room = msg.room.trim().toUpperCase();
      if (!room) return;

      ws._room = room;
      if (!rooms.has(room)) rooms.set(room, new Set());

      const peers = rooms.get(room);
      peers.add(ws);

      // Notify existing peers that someone joined.
      broadcastExcept(room, ws, { type: 'peer-joined' });

      // Notify joiner if they're second+ peer (useful for initiator logic).
      if (peers.size >= 2) {
        safeSend(ws, { type: 'peer-joined' });
      }

      return;
    }

    if (msg?.type === 'signal' && ws._room && msg.data != null) {
      broadcastExcept(ws._room, ws, { type: 'signal', data: msg.data });
      return;
    }
  });

  ws.on('close', () => {
    const room = ws._room;
    if (!room) return;

    const peers = rooms.get(room);
    if (!peers) return;

    peers.delete(ws);
    if (peers.size === 0) rooms.delete(room);

    broadcastExcept(room, ws, { type: 'peer-left' });
  });
});

console.log(`[signaling] WebSocket signaling server running on ws://localhost:${PORT}`);
