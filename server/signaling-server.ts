import { WebSocketServer, WebSocket } from 'ws';

interface Room {
  host: WebSocket;
  guest: WebSocket | null;
  hostId: string;
  guestId: string | null;
}

interface SignalMessage {
  type: 'create-room' | 'join-room' | 'signal' | 'room-created' | 'room-joined' | 'error' | 'peer-connected';
  roomCode?: string;
  signal?: any;
  clientId?: string;
  error?: string;
}

export class SignalingServer {
  private wss: WebSocketServer;
  private rooms: Map<string, Room> = new Map();
  private clients: Map<WebSocket, string> = new Map();
  private ready: Promise<void>;

  constructor(port: number = 8080) {
    this.ready = new Promise((resolve) => {
      this.wss = new WebSocketServer({ port }, () => {
        console.log(`Signaling server running on port ${port}`);
        resolve();
      });
    });
    this.setupServer();
  }

  async waitForReady() {
    return this.ready;
  }

  private setupServer() {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('New client connected');

      ws.on('message', (data: string) => {
        try {
          const message: SignalMessage = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('Error parsing message:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        console.log('Client disconnected');
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  private handleMessage(ws: WebSocket, message: SignalMessage) {
    switch (message.type) {
      case 'create-room':
        this.handleCreateRoom(ws);
        break;
      case 'join-room':
        if (message.roomCode) {
          this.handleJoinRoom(ws, message.roomCode);
        } else {
          this.sendError(ws, 'Room code is required');
        }
        break;
      case 'signal':
        if (message.roomCode && message.signal) {
          this.handleSignal(ws, message.roomCode, message.signal);
        } else {
          this.sendError(ws, 'Room code and signal data are required');
        }
        break;
      default:
        this.sendError(ws, 'Unknown message type');
    }
  }

  private handleCreateRoom(ws: WebSocket) {
    const roomCode = this.generateRoomCode();
    const clientId = this.generateClientId();

    this.rooms.set(roomCode, {
      host: ws,
      guest: null,
      hostId: clientId,
      guestId: null
    });

    this.clients.set(ws, roomCode);

    this.send(ws, {
      type: 'room-created',
      roomCode,
      clientId
    });

    console.log(`Room created: ${roomCode}`);
  }

  private handleJoinRoom(ws: WebSocket, roomCode: string) {
    const room = this.rooms.get(roomCode);

    if (!room) {
      this.sendError(ws, 'Room not found');
      return;
    }

    if (room.guest) {
      this.sendError(ws, 'Room is full');
      return;
    }

    const clientId = this.generateClientId();
    room.guest = ws;
    room.guestId = clientId;
    this.clients.set(ws, roomCode);

    this.send(ws, {
      type: 'room-joined',
      roomCode,
      clientId
    });

    // Notify host that a guest has joined
    this.send(room.host, {
      type: 'peer-connected',
      clientId: room.guestId
    });

    console.log(`Guest joined room: ${roomCode}`);
  }

  private handleSignal(ws: WebSocket, roomCode: string, signal: any) {
    const room = this.rooms.get(roomCode);

    if (!room) {
      this.sendError(ws, 'Room not found');
      return;
    }

    // Forward signal to the other peer
    const otherPeer = ws === room.host ? room.guest : room.host;

    if (otherPeer && otherPeer.readyState === WebSocket.OPEN) {
      this.send(otherPeer, {
        type: 'signal',
        signal
      });
    }
  }

  private handleDisconnect(ws: WebSocket) {
    const roomCode = this.clients.get(ws);

    if (roomCode) {
      const room = this.rooms.get(roomCode);

      if (room) {
        // Notify the other peer
        const otherPeer = ws === room.host ? room.guest : room.host;
        if (otherPeer && otherPeer.readyState === WebSocket.OPEN) {
          this.sendError(otherPeer, 'Peer disconnected');
          otherPeer.close();
        }

        // Clean up the room
        this.rooms.delete(roomCode);
        console.log(`Room deleted: ${roomCode}`);
      }

      this.clients.delete(ws);
    }
  }

  private send(ws: WebSocket, message: SignalMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, error: string) {
    this.send(ws, { type: 'error', error });
  }

  private generateRoomCode(): string {
    let code: string;
    do {
      code = Math.random().toString(36).substring(2, 8).toUpperCase();
    } while (this.rooms.has(code));
    return code;
  }

  private generateClientId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  public close() {
    this.wss.close();
  }

  public getServer() {
    return this.wss;
  }
}

// Run the server if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  new SignalingServer(8080);
}
