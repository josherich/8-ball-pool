import SimplePeer from 'simple-peer';

export type MessageType = 
  | 'shot'           // Shot taken: { angle, power }
  | 'state-full'     // Full game state sync
  | 'state-delta'    // Incremental ball position update (during motion)
  | 'turn-change'    // Turn switched to other player
  | 'game-event'     // Pocketed balls, scratches, etc.
  | 'ping'           // Latency measurement
  | 'pong';          // Latency response

export type PeerMessage = {
  type: MessageType;
  seq?: number;       // Sequence number for ordering
  ts?: number;        // Timestamp
  data?: any;
};

export type OnlinePeerEvents = {
  onConnected: () => void;
  onDisconnected: (reason: string) => void;
  onMessage: (msg: PeerMessage) => void;
  onError: (error: string) => void;
  onRoomJoined: (info: { room: string; isHost: boolean; peerCount: number }) => void;
  onPeerCountChanged: (count: number) => void;
};

export type OnlinePeerConfig = {
  signalingUrl: string;
  events: OnlinePeerEvents;
};

type ConnectionState = 'disconnected' | 'connecting' | 'signaling' | 'waiting' | 'connected';

export class OnlinePeer {
  private signalingUrl: string;
  private events: OnlinePeerEvents;

  private ws: WebSocket | null = null;
  private peer: SimplePeer.Instance | null = null;
  private state: ConnectionState = 'disconnected';
  private room: string | null = null;
  private isHost = false;
  private messageSeq = 0;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private latency = 0;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(cfg: OnlinePeerConfig) {
    this.signalingUrl = cfg.signalingUrl;
    this.events = cfg.events;
  }

  get connectionState(): ConnectionState {
    return this.state;
  }

  get currentRoom(): string | null {
    return this.room;
  }

  get isHosting(): boolean {
    return this.isHost;
  }

  get currentLatency(): number {
    return this.latency;
  }

  /**
   * Connect to signaling server
   */
  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    this.state = 'connecting';
    
    try {
      this.ws = new WebSocket(this.signalingUrl);
    } catch (err) {
      this.events.onError(`Failed to connect: ${(err as Error).message}`);
      this.state = 'disconnected';
      return;
    }

    this.ws.addEventListener('open', () => {
      this.state = 'signaling';
      this.reconnectAttempts = 0;
    });

    this.ws.addEventListener('message', (ev) => {
      this.handleSignalingMessage(ev.data);
    });

    this.ws.addEventListener('close', () => {
      this.handleSignalingClose();
    });

    this.ws.addEventListener('error', () => {
      this.events.onError('Signaling connection error');
    });
  }

  /**
   * Create a new room (host)
   */
  createRoom(): string {
    const code = this.generateRoomCode();
    this.joinRoom(code);
    return code;
  }

  /**
   * Join an existing room
   */
  joinRoom(code: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Connect first, then join
      this.connect();
      const waitForOpen = () => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.sendToSignaling({ type: 'join', room: code.toUpperCase() });
        } else {
          setTimeout(waitForOpen, 100);
        }
      };
      waitForOpen();
      return;
    }

    this.sendToSignaling({ type: 'join', room: code.toUpperCase() });
  }

  /**
   * Leave current room
   */
  leaveRoom(): void {
    this.sendToSignaling({ type: 'leave' });
    this.teardownPeer('left room');
    this.room = null;
    this.isHost = false;
    this.state = 'signaling';
  }

  /**
   * Send a message to the connected peer
   */
  send(msg: Omit<PeerMessage, 'seq' | 'ts'>): void {
    if (!this.peer || this.state !== 'connected') return;

    const fullMsg: PeerMessage = {
      ...msg,
      seq: ++this.messageSeq,
      ts: Date.now()
    };

    try {
      this.peer.send(JSON.stringify(fullMsg));
    } catch (err) {
      console.warn('[OnlinePeer] Send failed:', (err as Error).message);
    }
  }

  /**
   * Disconnect from everything
   */
  disconnect(): void {
    this.stopPingInterval();
    this.clearReconnectTimeout();
    this.teardownPeer('disconnected');
    
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    this.state = 'disconnected';
    this.room = null;
    this.isHost = false;
  }

  // --- Private methods ---

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private sendToSignaling(msg: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify(msg));
    } catch {}
  }

  private handleSignalingMessage(data: string): void {
    let msg: any;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'room-joined':
        this.room = msg.room;
        this.isHost = msg.isHost;
        this.state = 'waiting';
        this.events.onRoomJoined({ 
          room: msg.room, 
          isHost: msg.isHost, 
          peerCount: msg.peerCount 
        });
        
        // If host, create peer as initiator immediately
        if (this.isHost) {
          this.createPeer(true);
        }
        break;

      case 'peer-joined':
        this.events.onPeerCountChanged(msg.peerCount);
        // Guest creates peer when host is present
        if (!this.isHost && !this.peer) {
          this.createPeer(false);
        }
        break;

      case 'peer-left':
        this.events.onPeerCountChanged(msg.peerCount);
        this.teardownPeer('peer left');
        this.state = 'waiting';
        this.events.onDisconnected('peer-left');
        break;

      case 'signal':
        if (msg.data) {
          // Ensure peer exists
          if (!this.peer) {
            this.createPeer(this.isHost);
          }
          try {
            this.peer?.signal(msg.data);
          } catch (err) {
            console.warn('[OnlinePeer] Signal error:', (err as Error).message);
          }
        }
        break;

      case 'room-full':
        this.events.onError('Room is full (max 2 players)');
        this.state = 'signaling';
        break;

      case 'error':
        this.events.onError(msg.message || 'Unknown error');
        break;

      case 'left':
        this.state = 'signaling';
        break;
    }
  }

  private handleSignalingClose(): void {
    const wasConnected = this.state === 'connected';
    
    if (wasConnected) {
      // Try to reconnect
      this.attemptReconnect();
    } else {
      this.state = 'disconnected';
      this.events.onDisconnected('signaling-closed');
    }
  }

  private createPeer(initiator: boolean): void {
    if (this.peer) return;

    this.peer = new SimplePeer({ 
      initiator, 
      trickle: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    this.peer.on('signal', (data: SimplePeer.SignalData) => {
      this.sendToSignaling({ type: 'signal', data });
    });

    this.peer.on('connect', () => {
      this.state = 'connected';
      this.events.onConnected();
      this.startPingInterval();
    });

    this.peer.on('close', () => {
      this.teardownPeer('peer closed');
      if (this.state === 'connected') {
        this.state = 'waiting';
        this.events.onDisconnected('peer-closed');
      }
    });

    this.peer.on('error', (err) => {
      console.error('[OnlinePeer] Peer error:', err.message);
      this.teardownPeer('peer error');
      if (this.state === 'connected') {
        this.events.onDisconnected('peer-error');
      }
    });

    this.peer.on('data', (buf: Uint8Array) => {
      this.handlePeerData(buf);
    });
  }

  private handlePeerData(buf: Uint8Array): void {
    let msg: PeerMessage;
    try {
      msg = JSON.parse(new TextDecoder().decode(buf));
    } catch {
      return;
    }

    // Handle ping/pong internally
    if (msg.type === 'ping') {
      this.send({ type: 'pong', data: msg.ts });
      return;
    }

    if (msg.type === 'pong' && msg.data) {
      this.latency = Date.now() - msg.data;
      return;
    }

    this.events.onMessage(msg);
  }

  private teardownPeer(_reason: string): void {
    this.stopPingInterval();
    
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {}
      this.peer = null;
    }
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping', data: Date.now() });
    }, 5000);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.state = 'disconnected';
      this.events.onDisconnected('max-reconnect-attempts');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);

    this.reconnectTimeout = setTimeout(() => {
      if (this.room) {
        this.connect();
        this.joinRoom(this.room);
      }
    }, delay);
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}
