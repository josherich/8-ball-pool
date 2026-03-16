import SimplePeer from 'simple-peer';
import type { GameMessage } from '../pool_sync';

export type ConnectionCallbacks = {
  onConnectionStateChange: (state: string) => void;
  onRoomCodeGenerated: (code: string) => void;
  onGameMessage: (message: GameMessage) => void;
};

export class NetworkManager {
  private peer: SimplePeer.Instance | null = null;
  private ws: WebSocket | null = null;
  private callbacks: ConnectionCallbacks;
  roomCode: string | null = null;
  clientId: string | null = null;
  isHost = true;

  constructor(callbacks: ConnectionCallbacks) {
    this.callbacks = callbacks;
  }

  get isConnected(): boolean {
    return this.peer !== null && this.peer.connected;
  }

  setupAsHost() {
    this.isHost = true;
    const SIGNALING_SERVER = 'ws://localhost:8080';
    this.ws = new WebSocket(SIGNALING_SERVER);

    this.ws.onopen = () => {
      console.log('Connected to signaling server');
      this.ws!.send(JSON.stringify({ type: 'create-room' }));
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleSignalingMessage(message);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.callbacks.onConnectionStateChange('error');
    };

    this.ws.onclose = () => {
      console.log('Disconnected from signaling server');
    };
  }

  joinRoom(code: string) {
    this.isHost = false;
    this.callbacks.onConnectionStateChange('joining');

    const SIGNALING_SERVER = 'ws://localhost:8080';
    this.ws = new WebSocket(SIGNALING_SERVER);

    this.ws.onopen = () => {
      console.log('Connected to signaling server');
      this.ws!.send(JSON.stringify({ type: 'join-room', roomCode: code }));
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleSignalingMessage(message);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.callbacks.onConnectionStateChange('error');
    };

    this.ws.onclose = () => {
      console.log('Disconnected from signaling server');
    };
  }

  private handleSignalingMessage(message: any) {
    switch (message.type) {
      case 'room-created':
        this.roomCode = message.roomCode;
        this.clientId = message.clientId;
        this.callbacks.onRoomCodeGenerated(message.roomCode);
        console.log('Room created:', message.roomCode);
        this.initializePeerConnection(true);
        break;

      case 'room-joined':
        this.roomCode = message.roomCode;
        this.clientId = message.clientId;
        console.log('Joined room:', message.roomCode);
        this.callbacks.onConnectionStateChange('connected');
        this.initializePeerConnection(false);
        break;

      case 'peer-connected':
        console.log('Peer connected to room');
        break;

      case 'signal':
        if (this.peer && message.signal) {
          this.peer.signal(message.signal);
        }
        break;

      case 'error':
        console.error('Signaling error:', message.error);
        this.callbacks.onConnectionStateChange('error');
        break;
    }
  }

  private initializePeerConnection(isHost: boolean) {
    this.peer = new SimplePeer({
      initiator: !isHost,
      trickle: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    this.peer.on('signal', (data) => {
      console.log('Sending signal data');
      if (this.ws && this.roomCode) {
        this.ws.send(JSON.stringify({
          type: 'signal',
          roomCode: this.roomCode,
          signal: data
        }));
      }
    });

    this.peer.on('connect', () => {
      console.log('WebRTC connection established!');
      this.callbacks.onConnectionStateChange('connected');
    });

    this.peer.on('data', (data) => {
      const message = JSON.parse(data.toString());
      this.callbacks.onGameMessage(message);
    });

    this.peer.on('error', (err) => {
      console.error('Peer connection error:', err);
      this.callbacks.onConnectionStateChange('error');
    });

    this.peer.on('close', () => {
      console.log('Peer connection closed');
      this.callbacks.onConnectionStateChange('idle');
    });
  }

  send(message: GameMessage) {
    if (this.peer && this.peer.connected) {
      this.peer.send(JSON.stringify(message));
    }
  }

  destroy() {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
