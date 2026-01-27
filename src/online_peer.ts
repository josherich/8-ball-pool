import SimplePeer from 'simple-peer';

export type OnlinePeerEvents = {
  onConnected: () => void;
  onDisconnected: (reason?: string) => void;
  onData: (data: any) => void;
};

export type OnlinePeerConfig = {
  roomCode: string;
  isHost: boolean;
  signalingUrl: string;
  events: OnlinePeerEvents;
};

export class OnlinePeer {
  private roomCode: string;
  private isHost: boolean;
  private signalingUrl: string;
  private events: OnlinePeerEvents;

  private ws: WebSocket | null = null;
  private peer: SimplePeer.Instance | null = null;
  private connected = false;

  constructor(cfg: OnlinePeerConfig) {
    this.roomCode = cfg.roomCode;
    this.isHost = cfg.isHost;
    this.signalingUrl = cfg.signalingUrl;
    this.events = cfg.events;
  }

  start() {
    this.ws = new WebSocket(this.signalingUrl);

    this.ws.addEventListener('open', () => {
      this.ws?.send(JSON.stringify({ type: 'join', room: this.roomCode }));
      // Host creates the peer immediately as initiator.
      if (this.isHost) this.ensurePeer(true);
    });

    this.ws.addEventListener('message', (ev) => {
      let msg: any;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }

      if (msg?.type === 'peer-joined') {
        // Joiner creates peer when host is present.
        if (!this.isHost) this.ensurePeer(false);
        return;
      }

      if (msg?.type === 'peer-left') {
        this.events.onDisconnected('peer-left');
        this.teardownPeer();
        return;
      }

      if (msg?.type === 'signal') {
        this.ensurePeer(this.isHost);
        try {
          this.peer?.signal(msg.data);
        } catch {
          // Ignore malformed/stale signals
        }
      }
    });

    this.ws.addEventListener('close', () => {
      this.events.onDisconnected('signaling-closed');
      this.teardownPeer();
    });

    this.ws.addEventListener('error', () => {
      this.events.onDisconnected('signaling-error');
      this.teardownPeer();
    });
  }

  send(obj: any) {
    if (!this.peer || !this.connected) return;
    try {
      this.peer.send(JSON.stringify(obj));
    } catch {
      // ignore
    }
  }

  destroy() {
    this.teardownPeer();
    try {
      this.ws?.close();
    } catch {
      // ignore
    }
    this.ws = null;
  }

  private ensurePeer(initiator: boolean) {
    if (this.peer) return;

    this.peer = new SimplePeer({ initiator, trickle: true });

    this.peer.on('signal', (data: SimplePeer.SignalData) => {
      this.ws?.send(JSON.stringify({ type: 'signal', room: this.roomCode, data }));
    });

    this.peer.on('connect', () => {
      this.connected = true;
      this.events.onConnected();
    });

    this.peer.on('close', () => {
      this.connected = false;
      this.events.onDisconnected('peer-closed');
      this.teardownPeer();
    });

    this.peer.on('error', () => {
      this.connected = false;
      this.events.onDisconnected('peer-error');
      this.teardownPeer();
    });

    this.peer.on('data', (buf: Uint8Array) => {
      let msg: any;
      try {
        msg = JSON.parse(new TextDecoder().decode(buf));
      } catch {
        return;
      }
      this.events.onData(msg);
    });
  }

  private teardownPeer() {
    try {
      this.peer?.destroy();
    } catch {
      // ignore
    }
    this.peer = null;
    this.connected = false;
  }
}
