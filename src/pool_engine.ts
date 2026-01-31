import type RAPIER from '@dimforge/rapier3d-compat';
import {
  MAX_SHOT_POWER,
  SCALE,
  createWorld,
  setupTable,
  setupBalls,
  checkPockets,
  type Ball,
  type Pocket,
  type PocketedEvent,
  type Pocketed,
  type PocketedThisShot
} from './pool_physics';
import { allBallsStopped, canShoot, evaluateTurnSwitch } from './pool_rules';
import { OnlinePeer, type PeerMessage } from './online_peer';

type PocketingAnimation = PocketedEvent & {
  startTime: number;
  duration: number;
};

// Serialized ball state for network sync
type BallState = {
  type: string;
  number: number;
  t: { x: number; y: number; z: number };
  lv: { x: number; y: number; z: number };
  av: { x: number; y: number; z: number };
  r: { w: number; x: number; y: number; z: number };
};

// Full game state for sync
type GameState = {
  balls: BallState[];
  currentPlayer: number;
  playerTypes: { player1: string | null; player2: string | null };
  pocketed: Pocketed;
  shotInProgress: boolean;
};

class PoolGameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  mode: string;
  RAPIER: typeof RAPIER;
  callbacks: any;
  world: RAPIER.World | null;
  balls: Ball[];
  cushionBodies: RAPIER.RigidBody[];
  currentPlayer: number;
  aiming: boolean;
  aimAngle: number;
  power: number;
  powerIncreasing: boolean;
  scores: { player1: number; player2: number };
  gameStarted: boolean;
  pocketed: Pocketed;
  playerTypes: { player1: string | null; player2: string | null };
  mousePos: { x: number; y: number };
  isMyTurn: boolean;
  peer: OnlinePeer | null;
  animationId: number | null;
  pockets: Pocket[];
  shotInProgress: boolean;
  pocketedThisShot: PocketedThisShot;
  pocketingAnimations: PocketingAnimation[];
  
  // Online-specific state
  private isHost: boolean = false;
  private roomCode: string | null = null;
  private syncFrameCounter: number = 0;
  private lastSyncedState: string = '';
  private connectionStatus: string = 'idle';

  constructor(canvas: HTMLCanvasElement, mode: string, rapier: typeof RAPIER, callbacks: any) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.mode = mode;
    this.RAPIER = rapier;
    this.callbacks = callbacks;
    this.world = null;
    this.balls = [];
    this.cushionBodies = [];
    this.currentPlayer = 1;
    this.aiming = false;
    this.aimAngle = 0;
    this.power = 0;
    this.powerIncreasing = false;
    this.scores = { player1: 0, player2: 0 };
    this.gameStarted = false;
    this.pocketed = { solids: [], stripes: [], eight: false };
    this.playerTypes = { player1: null, player2: null };
    this.mousePos = { x: 0, y: 0 };
    this.isMyTurn = true;
    this.peer = null;
    this.animationId = null;
    this.pockets = [];
    this.shotInProgress = false;
    this.pocketedThisShot = { solids: [], stripes: [], cueBall: false };
    this.pocketingAnimations = [];
  }

  init() {
    this.world = createWorld(this.RAPIER);

    if (!this.world) return;
    const { pockets, cushionBodies } = setupTable({
      canvas: this.canvas,
      world: this.world,
      RAPIER: this.RAPIER
    });
    this.pockets = pockets;
    this.cushionBodies = cushionBodies;
    this.balls = setupBalls({ canvas: this.canvas, world: this.world, RAPIER: this.RAPIER });
    this.setupEventListeners();

    if (this.mode === 'online') {
      this.setupWebRTC();
    }

    this.gameLoop();
  }

  setupWebRTC() {
    const signalingUrl = (import.meta as any).env?.VITE_SIGNALING_URL || 'ws://localhost:8080';

    this.peer = new OnlinePeer({
      signalingUrl,
      events: {
        onConnected: () => this.handlePeerConnected(),
        onDisconnected: (reason) => this.handlePeerDisconnected(reason),
        onMessage: (msg) => this.handlePeerMessage(msg),
        onError: (error) => this.handlePeerError(error),
        onRoomJoined: (info) => this.handleRoomJoined(info),
        onPeerCountChanged: (count) => this.handlePeerCountChanged(count)
      }
    });

    // Create a room (host mode)
    this.roomCode = this.peer.createRoom();
    this.isHost = true;
    this.isMyTurn = true; // Host goes first
    this.currentPlayer = 1;
    this.callbacks.onRoomCodeGenerated(this.roomCode);
    this.connectionStatus = 'hosting';
  }

  joinRoom(code: string) {
    if (!this.peer) {
      const signalingUrl = (import.meta as any).env?.VITE_SIGNALING_URL || 'ws://localhost:8080';
      
      this.peer = new OnlinePeer({
        signalingUrl,
        events: {
          onConnected: () => this.handlePeerConnected(),
          onDisconnected: (reason) => this.handlePeerDisconnected(reason),
          onMessage: (msg) => this.handlePeerMessage(msg),
          onError: (error) => this.handlePeerError(error),
          onRoomJoined: (info) => this.handleRoomJoined(info),
          onPeerCountChanged: (count) => this.handlePeerCountChanged(count)
        }
      });
    }

    this.roomCode = code.toUpperCase();
    this.isHost = false;
    this.isMyTurn = false; // Guest waits for host
    this.currentPlayer = 1;
    this.connectionStatus = 'joining';
    this.peer.joinRoom(code);
  }

  private handleRoomJoined(info: { room: string; isHost: boolean; peerCount: number }) {
    this.roomCode = info.room;
    this.isHost = info.isHost;
    this.isMyTurn = info.isHost; // Host plays first
    this.connectionStatus = info.isHost ? 'hosting' : 'joining';
    
    if (info.isHost) {
      this.callbacks.onRoomCodeGenerated(info.room);
    }
  }

  private handlePeerConnected() {
    this.connectionStatus = 'connected';
    this.callbacks.onConnectionStateChange('connected');
    
    // Host sends initial game state to sync
    if (this.isHost) {
      this.sendFullState();
    }
  }

  private handlePeerDisconnected(reason: string) {
    this.connectionStatus = 'disconnected';
    this.callbacks.onConnectionStateChange('idle');
    console.log('[Pool] Peer disconnected:', reason);
  }

  private handlePeerError(error: string) {
    console.error('[Pool] Peer error:', error);
    this.callbacks.onConnectionStateChange('error');
  }

  private handlePeerCountChanged(count: number) {
    console.log('[Pool] Room peer count:', count);
  }

  private handlePeerMessage(msg: PeerMessage) {
    switch (msg.type) {
      case 'shot':
        this.handleRemoteShot(msg.data);
        break;
      case 'state-full':
        this.applyFullState(msg.data);
        break;
      case 'state-delta':
        this.applyDeltaState(msg.data);
        break;
      case 'turn-change':
        this.handleRemoteTurnChange(msg.data);
        break;
      case 'game-event':
        this.handleRemoteGameEvent(msg.data);
        break;
    }
  }

  private handleRemoteShot(data: { angle: number; power: number }) {
    if (typeof data.angle !== 'number' || typeof data.power !== 'number') return;
    
    // Apply the shot locally
    this.aimAngle = data.angle;
    this.power = data.power;
    this.doShot(true); // true = remote shot
  }

  private handleRemoteTurnChange(data: { currentPlayer: number; isHostTurn: boolean }) {
    this.currentPlayer = data.currentPlayer;
    // isMyTurn is opposite for guest vs host
    this.isMyTurn = this.isHost ? data.isHostTurn : !data.isHostTurn;
  }

  private handleRemoteGameEvent(data: any) {
    if (data.type === 'pocketed') {
      this.pocketed = data.pocketed;
      this.playerTypes = data.playerTypes;
    }
  }

  // Get serialized ball state
  private getBallState(ball: Ball): BallState {
    const t = ball.body.translation();
    const lv = ball.body.linvel();
    const av = ball.body.angvel();
    const r = ball.body.rotation();
    return {
      type: ball.type,
      number: ball.number,
      t: { x: t.x, y: t.y, z: t.z },
      lv: { x: lv.x, y: lv.y, z: lv.z },
      av: { x: av.x, y: av.y, z: av.z },
      r: { w: r.w, x: r.x, y: r.y, z: r.z }
    };
  }

  // Get full game state
  private getFullState(): GameState {
    return {
      balls: this.balls.map(b => this.getBallState(b)),
      currentPlayer: this.currentPlayer,
      playerTypes: { ...this.playerTypes },
      pocketed: { ...this.pocketed, solids: [...this.pocketed.solids], stripes: [...this.pocketed.stripes] },
      shotInProgress: this.shotInProgress
    };
  }

  // Send full state to peer
  private sendFullState() {
    if (!this.peer || this.connectionStatus !== 'connected') return;
    this.peer.send({ type: 'state-full', data: this.getFullState() });
  }

  // Send delta (ball positions only) during motion
  private sendDeltaState() {
    if (!this.peer || this.connectionStatus !== 'connected') return;
    
    const balls = this.balls.map(b => this.getBallState(b));
    const stateStr = JSON.stringify(balls);
    
    // Only send if state changed
    if (stateStr === this.lastSyncedState) return;
    this.lastSyncedState = stateStr;
    
    this.peer.send({ type: 'state-delta', data: balls });
  }

  // Apply full state from peer
  private applyFullState(state: GameState) {
    if (!state || !this.world) return;
    
    this.currentPlayer = state.currentPlayer;
    this.playerTypes = state.playerTypes;
    this.pocketed = state.pocketed;
    this.shotInProgress = state.shotInProgress;
    
    // Update turn based on host/guest role
    this.isMyTurn = this.isHost 
      ? (state.currentPlayer === 1)
      : (state.currentPlayer === 2);
    
    // Apply ball states
    this.applyBallStates(state.balls);
  }

  // Apply delta state (ball positions only)
  private applyDeltaState(balls: BallState[]) {
    if (!balls || !this.world) return;
    this.applyBallStates(balls);
  }

  // Apply ball states from network
  private applyBallStates(states: BallState[]) {
    for (const incoming of states) {
      const ball = this.balls.find(b => {
        if (b.type !== incoming.type) return false;
        if (b.number !== incoming.number) return false;
        return true;
      });
      
      if (!ball) continue;

      try {
        ball.body.setTranslation(incoming.t, true);
        ball.body.setLinvel(incoming.lv, true);
        ball.body.setAngvel(incoming.av, true);
        ball.body.setRotation(incoming.r, true);
      } catch (err) {
        console.warn('[Pool] Failed to apply ball state:', err);
      }
    }
  }

  // Broadcast turn change
  private broadcastTurnChange() {
    if (!this.peer || this.connectionStatus !== 'connected') return;
    
    this.peer.send({
      type: 'turn-change',
      data: {
        currentPlayer: this.currentPlayer,
        isHostTurn: this.currentPlayer === 1
      }
    });
  }

  // Broadcast game events (pocketing, etc.)
  private broadcastGameEvent(event: any) {
    if (!this.peer || this.connectionStatus !== 'connected') return;
    this.peer.send({ type: 'game-event', data: event });
  }

  setupEventListeners() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mousePos.x = e.clientX - rect.left;
      this.mousePos.y = e.clientY - rect.top;

      if (this.canShoot() && !this.aiming) {
        const cueBall = this.balls.find(b => b.type === 'cue');
        if (cueBall) {
          const ballPos = cueBall.body.translation();
          const ballPixelX = ballPos.x * SCALE;
          const ballPixelY = ballPos.z * SCALE;

          const targetAngle = Math.atan2(
            this.mousePos.y - ballPixelY,
            this.mousePos.x - ballPixelX
          );
          const distance = Math.hypot(
            this.mousePos.x - ballPixelX,
            this.mousePos.y - ballPixelY
          );
          const smoothness = this.getAimSmoothing(distance);
          this.aimAngle = this.interpolateAngle(this.aimAngle, targetAngle, smoothness);
        }
      }
    });

    this.canvas.addEventListener('mousedown', () => {
      if (this.canShoot()) {
        this.aiming = true;
        this.power = 0;
        this.powerIncreasing = true;
      }
    });

    this.canvas.addEventListener('mouseup', () => {
      if (this.aiming && this.canShoot()) {
        this.shoot();
        this.aiming = false;
        this.powerIncreasing = false;
      }
    });
  }

  getAimSmoothing(distance: number): number {
    const nearDistance = 60;
    const farDistance = 360;
    const maxBlend = 0.6;
    const minBlend = 0.12;
    const t = Math.min(Math.max((distance - nearDistance) / (farDistance - nearDistance), 0), 1);
    return maxBlend - t * (maxBlend - minBlend);
  }

  interpolateAngle(current: number, target: number, blend: number): number {
    const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
    return current + delta * blend;
  }

  canShoot(): boolean {
    return canShoot({
      mode: this.mode,
      isMyTurn: this.isMyTurn,
      balls: this.balls
    });
  }

  shoot() {
    const angle = this.aimAngle;
    const power = this.power;

    this.doShot(false); // false = local shot

    // Send shot to peer
    if (this.mode === 'online' && this.peer && this.connectionStatus === 'connected') {
      this.peer.send({ type: 'shot', data: { angle, power } });
    }
  }

  doShot(isRemote: boolean) {
    // For local shots, check canShoot; for remote shots, allow regardless
    if (!isRemote && !this.canShoot()) return;

    const cueBall = this.balls.find(b => b.type === 'cue');
    if (!cueBall) return;

    this.shotInProgress = true;
    this.pocketedThisShot = { solids: [], stripes: [], cueBall: false };

    const impulseStrength = this.power * 8;
    const impulseX = Math.cos(this.aimAngle) * impulseStrength;
    const impulseZ = Math.sin(this.aimAngle) * impulseStrength;

    cueBall.body.applyImpulse({ x: impulseX, y: 0, z: impulseZ }, true);

    const spinFactor = 0.3;
    cueBall.body.applyTorqueImpulse({
      x: -impulseZ * spinFactor,
      y: 0,
      z: impulseX * spinFactor
    }, true);

    this.gameStarted = true;
  }

  checkPockets() {
    if (!this.world) return;
    const pocketedEvents = checkPockets({
      world: this.world,
      canvas: this.canvas,
      balls: this.balls,
      pockets: this.pockets,
      pocketed: this.pocketed,
      pocketedThisShot: this.pocketedThisShot,
      RAPIER: this.RAPIER
    });

    const now = performance.now();
    pocketedEvents.forEach((event) => {
      this.pocketingAnimations.push({
        ...event,
        startTime: now,
        duration: 250
      });
    });

    // Broadcast pocketing events
    if (pocketedEvents.length > 0 && this.mode === 'online') {
      this.broadcastGameEvent({
        type: 'pocketed',
        pocketed: this.pocketed,
        playerTypes: this.playerTypes
      });
    }
  }

  findTargetBall(
    cueBallX: number,
    cueBallY: number,
    aimAngle: number,
    ballRadius: number
  ): { impactX: number; impactY: number; targetBallX: number; targetBallY: number } | null {
    const dirX = Math.cos(aimAngle);
    const dirY = Math.sin(aimAngle);

    let closestDist = Infinity;
    let closestBall: { x: number; y: number } | null = null;

    for (const ball of this.balls) {
      if (ball.type === 'cue') continue;

      const pos = ball.body.translation();
      const targetX = pos.x * SCALE;
      const targetY = pos.z * SCALE;

      const toTargetX = targetX - cueBallX;
      const toTargetY = targetY - cueBallY;
      const projDist = toTargetX * dirX + toTargetY * dirY;

      if (projDist <= 0) continue;

      const closestPointX = cueBallX + dirX * projDist;
      const closestPointY = cueBallY + dirY * projDist;
      const perpDistX = targetX - closestPointX;
      const perpDistY = targetY - closestPointY;
      const perpDist = Math.sqrt(perpDistX * perpDistX + perpDistY * perpDistY);
      const collisionDist = ballRadius * 2;

      if (perpDist < collisionDist) {
        const backDist = Math.sqrt(collisionDist * collisionDist - perpDist * perpDist);
        const actualDist = projDist - backDist;

        if (actualDist > ballRadius && actualDist < closestDist) {
          closestDist = actualDist;
          closestBall = { x: targetX, y: targetY };
        }
      }
    }

    if (closestBall) {
      const impactX = cueBallX + dirX * closestDist;
      const impactY = cueBallY + dirY * closestDist;

      return {
        impactX,
        impactY,
        targetBallX: closestBall.x,
        targetBallY: closestBall.y
      };
    }

    return null;
  }

  gameLoop() {
    if (!this.world) return;

    this.world.step();
    this.checkPockets();

    // Check if shot has ended
    if (this.shotInProgress && allBallsStopped(this.balls)) {
      const result = evaluateTurnSwitch({
        currentPlayer: this.currentPlayer,
        mode: this.mode,
        isMyTurn: this.isMyTurn,
        playerTypes: this.playerTypes,
        pocketedThisShot: this.pocketedThisShot
      });
      
      const turnChanged = result.currentPlayer !== this.currentPlayer;
      
      this.playerTypes = result.playerTypes;
      this.currentPlayer = result.currentPlayer;
      this.isMyTurn = result.isMyTurn;
      this.shotInProgress = false;

      // Sync state after shot completes
      if (this.mode === 'online') {
        this.sendFullState();
        if (turnChanged) {
          this.broadcastTurnChange();
        }
      }
    }

    // Send delta updates during ball motion (throttled)
    if (this.mode === 'online' && this.shotInProgress) {
      this.syncFrameCounter++;
      // Send updates every 3 frames (~20Hz at 60fps)
      if (this.syncFrameCounter % 3 === 0) {
        this.sendDeltaState();
      }
    }

    if (this.aiming && this.powerIncreasing) {
      this.power = Math.min(this.power + 0.02, MAX_SHOT_POWER);
    }

    this.render();
    this.animationId = requestAnimationFrame(() => this.gameLoop());
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const radius = 12;
    const now = performance.now();

    // Background
    ctx.fillStyle = 'hsl(25, 15%, 8%)';
    ctx.fillRect(0, 0, w, h);

    // Table felt
    ctx.fillStyle = 'hsl(145, 50%, 28%)';
    ctx.fillRect(40, 40, w - 80, h - 80);

    // Cushion shadows
    const cushionInset = 40;
    const cushionInnerInset = 60;
    const cushionShadowDepth = 10;
    const sideCushionShadowDepth = 3;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cushionInset, cushionInset, w - cushionInset * 2, h - cushionInset * 2);
    ctx.clip();

    const topShadow = ctx.createLinearGradient(0, cushionInnerInset, 0, cushionInnerInset + cushionShadowDepth);
    topShadow.addColorStop(0, 'rgba(0, 0, 0, 0.32)');
    topShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = topShadow;
    ctx.fillRect(cushionInnerInset, cushionInnerInset, w - cushionInnerInset * 2, cushionShadowDepth);

    const sideShadow = ctx.createLinearGradient(0, cushionInnerInset, 0, cushionInnerInset + cushionShadowDepth * 16);
    sideShadow.addColorStop(0, 'rgba(0, 0, 0, 0.32)');
    sideShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = sideShadow;
    ctx.fillRect(cushionInnerInset, cushionInnerInset, sideCushionShadowDepth, h - cushionInnerInset * 2);
    ctx.fillRect(w - cushionInnerInset - sideCushionShadowDepth, cushionInnerInset, sideCushionShadowDepth, h - cushionInnerInset * 2);

    const bottomShadow = ctx.createLinearGradient(0, h - cushionInnerInset - cushionShadowDepth, 0, h - cushionInnerInset);
    bottomShadow.addColorStop(0, 'rgba(0, 0, 0, 0)');
    bottomShadow.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
    ctx.fillStyle = bottomShadow;
    ctx.fillRect(cushionInnerInset, h - cushionInnerInset - cushionShadowDepth, w - cushionInnerInset * 2, cushionShadowDepth);

    ctx.restore();

    // Table markings
    ctx.strokeStyle = 'hsl(145, 50%, 35%)';
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 60, w - 120, h - 120);

    // Pockets
    this.pockets.forEach((pocket, index) => {
      ctx.fillStyle = 'hsl(25, 35%, 15%)';
      ctx.beginPath();
      ctx.arc(pocket.x, pocket.y, pocket.radius + 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'hsl(25, 15%, 8%)';
      ctx.beginPath();
      ctx.arc(pocket.x, pocket.y, pocket.radius + 2, 0, Math.PI * 2);
      ctx.fill();

      const gradient = ctx.createRadialGradient(pocket.x, pocket.y, 0, pocket.x, pocket.y, pocket.radius);
      gradient.addColorStop(0, 'hsl(0, 0%, 2%)');
      gradient.addColorStop(0.7, 'hsl(0, 0%, 5%)');
      gradient.addColorStop(1, 'hsl(0, 0%, 10%)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(pocket.x, pocket.y, pocket.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'hsl(0, 0%, 0%)';
      ctx.beginPath();
      ctx.arc(pocket.x, pocket.y, pocket.radius * 0.7, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'hsl(25, 25%, 20%)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (index === 0) ctx.arc(pocket.x, pocket.y, pocket.radius - 1, Math.PI * 0.25, Math.PI * 1.25);
      else if (index === 2) ctx.arc(pocket.x, pocket.y, pocket.radius - 1, Math.PI * -0.25, Math.PI * 0.75);
      else if (index === 3) ctx.arc(pocket.x, pocket.y, pocket.radius - 1, Math.PI * 0.75, Math.PI * 1.75);
      else if (index === 5) ctx.arc(pocket.x, pocket.y, pocket.radius - 1, Math.PI * 1.25, Math.PI * 2.25);
      else if (index === 1) ctx.arc(pocket.x, pocket.y, pocket.radius - 1, Math.PI * 0.1, Math.PI * 0.9);
      else if (index === 4) ctx.arc(pocket.x, pocket.y, pocket.radius - 1, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pocket.x - 2, pocket.y - 2, pocket.radius * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Ball shadows
    this.balls.forEach(ball => {
      const pos = ball.body.translation();
      const pixelX = pos.x * SCALE;
      const pixelY = pos.z * SCALE;

      ctx.save();
      ctx.translate(pixelX + 3, pixelY + 4);
      ctx.scale(1, 0.6);
      const shadowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 1.1);
      shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0.79)');
      shadowGradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.54)');
      shadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
      ctx.fillStyle = shadowGradient;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Balls
    this.balls.forEach(ball => {
      const pos = ball.body.translation();
      const rot = ball.body.rotation();
      const pixelX = pos.x * SCALE;
      const pixelY = pos.z * SCALE;
      this.renderBall3D(ctx, pixelX, pixelY, radius, ball.type, ball.number, rot);
    });

    // Pocketing animations
    if (this.pocketingAnimations.length > 0) {
      this.pocketingAnimations = this.pocketingAnimations.filter((anim) => {
        const elapsed = now - anim.startTime;
        if (elapsed >= anim.duration) return false;

        const t = Math.min(elapsed / anim.duration, 1);
        const ease = t * t;
        const drawX = anim.startX + (anim.pocketX - anim.startX) * ease;
        const drawY = anim.startY + (anim.pocketY - anim.startY) * ease;
        const scale = 1 - 0.75 * ease;
        const alpha = 1 - 0.85 * ease;

        ctx.save();
        ctx.globalAlpha = 0.45 * (1 - ease);
        ctx.translate(drawX + 2, drawY + 3);
        ctx.scale(1, 0.6);
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.05 * scale, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = alpha;
        this.renderBall3D(ctx, drawX, drawY, radius * scale, anim.type, anim.number, anim.rotation);
        ctx.restore();

        return true;
      });
    }

    // Cue stick
    if (this.canShoot()) {
      const cueBall = this.balls.find(b => b.type === 'cue');
      if (cueBall) {
        const pos = cueBall.body.translation();
        const ballPixelX = pos.x * SCALE;
        const ballPixelY = pos.z * SCALE;

        const cueLength = 400;
        const powerRatio = Math.min(this.power / MAX_SHOT_POWER, 1);
        const cueDistance = this.aiming ? 30 + powerRatio * 50 : 30;
        const startX = ballPixelX - Math.cos(this.aimAngle) * cueDistance;
        const startY = ballPixelY - Math.sin(this.aimAngle) * cueDistance;
        const endX = startX - Math.cos(this.aimAngle) * cueLength;
        const endY = startY - Math.sin(this.aimAngle) * cueLength;
        const cueAngle = Math.atan2(endY - startY, endX - startX);

        const tipLength = 6;
        const ferruleLength = 10;
        const shaftLength = cueLength * 0.62;
        const shaftStart = tipLength + ferruleLength;
        const buttStart = shaftStart + shaftLength;

        // Cue shadow
        ctx.save();
        ctx.translate(startX + 4, startY + 5);
        ctx.rotate(cueAngle);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(cueLength, 0);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.translate(startX, startY);
        ctx.rotate(cueAngle);

        const drawSegment = (x0: number, x1: number, width: number, style: CanvasRenderingContext2D['strokeStyle']) => {
          ctx.strokeStyle = style;
          ctx.lineWidth = width;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x0, 0);
          ctx.lineTo(x1, 0);
          ctx.stroke();
        };

        drawSegment(0, tipLength, 7, '#1f2937');
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
        ctx.fill();

        drawSegment(tipLength, tipLength + ferruleLength, 7.4, '#e5e7eb');

        const shaftGradient = ctx.createLinearGradient(shaftStart, 0, shaftStart + shaftLength, 0);
        shaftGradient.addColorStop(0, 'hsl(35, 45%, 78%)');
        shaftGradient.addColorStop(0.45, 'hsl(30, 42%, 62%)');
        shaftGradient.addColorStop(1, 'hsl(25, 38%, 45%)');
        drawSegment(shaftStart, shaftStart + shaftLength, 7.8, shaftGradient);

        const buttGradient = ctx.createLinearGradient(buttStart, 0, cueLength, 0);
        buttGradient.addColorStop(0, 'hsl(20, 45%, 35%)');
        buttGradient.addColorStop(0.6, 'hsl(18, 40%, 28%)');
        buttGradient.addColorStop(1, 'hsl(12, 35%, 18%)');
        drawSegment(buttStart, cueLength, 10, buttGradient);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(buttStart + 8, 0);
        ctx.lineTo(buttStart + 28, 0);
        ctx.stroke();

        ctx.fillStyle = 'hsl(12, 35%, 14%)';
        ctx.beginPath();
        ctx.arc(cueLength, 0, 5.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Aiming line
        const targetBallInfo = this.findTargetBall(ballPixelX, ballPixelY, this.aimAngle, radius);
        const opacity = this.aiming ? 0.3 + 0.3 * Math.min(this.power / MAX_SHOT_POWER, 1) : 0.4;
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(ballPixelX, ballPixelY);

        if (targetBallInfo) {
          ctx.lineTo(targetBallInfo.impactX, targetBallInfo.impactY);
          ctx.stroke();

          ctx.setLineDash([]);
          ctx.strokeStyle = `rgba(255, 255, 255, ${opacity + 0.2})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(targetBallInfo.impactX, targetBallInfo.impactY, radius, 0, Math.PI * 2);
          ctx.stroke();

          const targetDirX = targetBallInfo.targetBallX - targetBallInfo.impactX;
          const targetDirY = targetBallInfo.targetBallY - targetBallInfo.impactY;
          const targetDirLen = Math.sqrt(targetDirX * targetDirX + targetDirY * targetDirY);

          if (targetDirLen > 0.1) {
            const normX = targetDirX / targetDirLen;
            const normY = targetDirY / targetDirLen;

            ctx.strokeStyle = `rgba(255, 200, 100, ${opacity + 0.1})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(targetBallInfo.targetBallX, targetBallInfo.targetBallY);
            ctx.lineTo(targetBallInfo.targetBallX + normX * 150, targetBallInfo.targetBallY + normY * 150);
            ctx.stroke();
          }
          ctx.setLineDash([]);
        } else {
          ctx.lineTo(ballPixelX + Math.cos(this.aimAngle) * 300, ballPixelY + Math.sin(this.aimAngle) * 300);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // Power meter
    if (this.aiming) {
      const meterX = w / 2;
      const meterY = h - 60;
      const meterWidth = 200;
      const meterHeight = 20;

      ctx.fillStyle = 'hsl(25, 15%, 15%)';
      ctx.fillRect(meterX - meterWidth/2, meterY, meterWidth, meterHeight);

      const powerRatio = Math.min(this.power / MAX_SHOT_POWER, 1);
      ctx.fillStyle = `hsl(${120 - powerRatio * 120}, 70%, 50%)`;
      ctx.fillRect(meterX - meterWidth/2, meterY, meterWidth * powerRatio, meterHeight);

      ctx.strokeStyle = 'hsl(45, 80%, 65%)';
      ctx.lineWidth = 2;
      ctx.strokeRect(meterX - meterWidth/2, meterY, meterWidth, meterHeight);
    }

    // Ball display
    this.renderBallDisplay(ctx, w, h);

    // Turn indicator
    const turnText = this.mode === 'online'
      ? (this.isMyTurn ? 'Your Turn' : 'Opponent\'s Turn')
      : `Player ${this.currentPlayer}'s Turn`;

    ctx.fillStyle = this.canShoot() ? 'hsl(145, 50%, 50%)' : 'hsl(25, 50%, 50%)';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(turnText, w / 2 - 120, 30);

    // Connection status indicator (online mode)
    if (this.mode === 'online') {
      const statusColor = this.connectionStatus === 'connected' ? 'hsl(145, 60%, 45%)' :
                         this.connectionStatus === 'hosting' || this.connectionStatus === 'joining' ? 'hsl(45, 80%, 55%)' :
                         'hsl(0, 60%, 50%)';
      ctx.fillStyle = statusColor;
      ctx.beginPath();
      ctx.arc(w - 30, 30, 8, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = 'white';
      ctx.font = '12px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(this.connectionStatus, w - 45, 35);
    }
  }

  renderBallDisplay(ctx: CanvasRenderingContext2D, canvasWidth: number, _canvasHeight: number) {
    const displayY = 20;
    const ballRadius = 10;
    const ballSpacing = 24;

    const colors = ['#FCD116', '#1C3F94', '#EE2737', '#601D84', '#F58025', '#056839', '#862234', '#333333'];

    const solidsStartX = 90;
    for (let i = 1; i <= 7; i++) {
      const x = solidsStartX + (i - 1) * ballSpacing;
      const isPocketed = this.pocketed.solids.includes(i);
      this.renderDisplayBall(ctx, x, displayY, ballRadius, 'solid', i, colors[(i - 1) % 8], isPocketed);
    }

    const eightBallX = canvasWidth / 2 + 50;
    this.renderDisplayBall(ctx, eightBallX, displayY, ballRadius, 'eight', 8, '#333333', this.pocketed.eight);

    const stripesEndX = canvasWidth - 90;
    for (let i = 9; i <= 15; i++) {
      const x = stripesEndX - (15 - i) * ballSpacing;
      const isPocketed = this.pocketed.stripes.includes(i);
      this.renderDisplayBall(ctx, x, displayY, ballRadius, 'stripe', i, colors[(i - 9) % 8], isPocketed);
    }
  }

  renderDisplayBall(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    ballType: string,
    ballNumber: number,
    color: string,
    isPocketed: boolean
  ) {
    ctx.save();

    if (isPocketed) {
      ctx.globalAlpha = 0.35;
    }

    if (ballType === 'eight') {
      ctx.fillStyle = isPocketed ? '#555555' : 'black';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isPocketed ? '#999999' : 'white';
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.55, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isPocketed ? '#555555' : 'black';
      ctx.font = `bold ${Math.round(radius * 0.8)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('8', x, y);
    } else if (ballType === 'solid') {
      ctx.fillStyle = isPocketed ? '#666666' : color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isPocketed ? '#999999' : 'white';
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isPocketed ? '#555555' : 'black';
      ctx.font = `bold ${Math.round(radius * 0.7)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(ballNumber), x, y);
    } else if (ballType === 'stripe') {
      ctx.fillStyle = isPocketed ? '#888888' : 'white';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.clip();

      ctx.fillStyle = isPocketed ? '#666666' : color;
      ctx.fillRect(x - radius, y - radius * 0.4, radius * 2, radius * 0.8);
      ctx.restore();

      ctx.fillStyle = isPocketed ? '#999999' : 'white';
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isPocketed ? '#555555' : 'black';
      ctx.font = `bold ${Math.round(radius * 0.7)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(ballNumber), x, y);
    }

    ctx.strokeStyle = isPocketed ? 'rgba(100, 100, 100, 0.5)' : 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  rotatePointByQuaternion(
    point: { x: number; y: number; z: number },
    q: { w: number; x: number; y: number; z: number }
  ): { x: number; y: number; z: number } {
    const px = point.x, py = point.y, pz = point.z;
    const qw = q.w, qx = -q.x, qy = -q.y, qz = -q.z;

    const tx = 2 * (qy * pz - qz * py);
    const ty = 2 * (qz * px - qx * pz);
    const tz = 2 * (qx * py - qy * px);

    return {
      x: px + qw * tx + (qy * tz - qz * ty),
      y: py + qw * ty + (qz * tx - qx * tz),
      z: pz + qw * tz + (qx * ty - qy * tx)
    };
  }

  renderBall3D(
    ctx: CanvasRenderingContext2D,
    pixelX: number,
    pixelY: number,
    radius: number,
    ballType: string,
    ballNumber: number,
    quaternion: { w: number; x: number; y: number; z: number }
  ) {
    const colors = ['#FCD116', '#1C3F94', '#EE2737', '#601D84', '#F58025', '#056839', '#862234', '#333333'];

    ctx.save();
    ctx.translate(pixelX, pixelY);

    if (ballType === 'cue') {
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'hsl(25, 15%, 80%)';
      ctx.lineWidth = 1;
      ctx.stroke();

      const dotPos3D = this.rotatePointByQuaternion({ x: 0, y: 1, z: 0 }, quaternion);
      if (dotPos3D.y > 0) {
        const projX = dotPos3D.x * radius * 0.7;
        const projY = dotPos3D.z * radius * 0.7;
        const dotSize = 2 + dotPos3D.y * 1.5;
        ctx.fillStyle = `rgba(30, 100, 200, ${0.4 + dotPos3D.y * 0.6})`;
        ctx.beginPath();
        ctx.arc(projX, projY, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (ballType === 'eight') {
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();

      const circlePos3D = this.rotatePointByQuaternion({ x: 0, y: 1, z: 0 }, quaternion);

      if (circlePos3D.y > -0.2) {
        const projX = circlePos3D.x * radius * 0.6;
        const projY = circlePos3D.z * radius * 0.6;
        const circleScale = Math.max(0, circlePos3D.y * 0.5 + 0.5);
        const circleRadius = radius * 0.5 * circleScale;

        if (circleRadius > 2) {
          ctx.fillStyle = 'white';
          ctx.beginPath();
          ctx.arc(projX, projY, circleRadius, 0, Math.PI * 2);
          ctx.fill();

          if (circleScale > 0.4) {
            ctx.fillStyle = 'black';
            ctx.font = `bold ${Math.round(10 * circleScale)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('8', projX, projY);
          }
        }
      }
    } else {
      const colorIndex = (ballNumber - 1) % 8;
      const ballColor = colors[colorIndex];

      if (ballType === 'solid') {
        ctx.fillStyle = ballColor;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();

        this.renderStripe3D(ctx, radius, ballColor, quaternion);
      }

      const circlePos3D = this.rotatePointByQuaternion({ x: 0, y: 1, z: 0 }, quaternion);

      if (circlePos3D.y > -0.2) {
        const projX = circlePos3D.x * radius * 0.55;
        const projY = circlePos3D.z * radius * 0.55;
        const circleScale = Math.max(0, circlePos3D.y * 0.5 + 0.5);
        const circleRadius = radius * 0.45 * circleScale;

        if (circleRadius > 2) {
          ctx.fillStyle = 'white';
          ctx.beginPath();
          ctx.arc(projX, projY, circleRadius, 0, Math.PI * 2);
          ctx.fill();

          if (circleScale > 0.35) {
            ctx.fillStyle = 'black';
            ctx.font = `bold ${Math.round(9 * circleScale)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(ballNumber), projX, projY);
          }
        }
      }
    }

    ctx.restore();
  }

  renderStripe3D(
    ctx: CanvasRenderingContext2D,
    radius: number,
    color: string,
    quaternion: { w: number; x: number; y: number; z: number }
  ) {
    ctx.fillStyle = color;

    const stripeHalfWidth = 0.35;
    const segments = 32;

    for (let i = 0; i < segments; i++) {
      const angle1 = (i / segments) * Math.PI * 2;
      const angle2 = ((i + 1) / segments) * Math.PI * 2;

      const points3D = [
        { x: Math.cos(angle1), y: stripeHalfWidth, z: Math.sin(angle1) },
        { x: Math.cos(angle2), y: stripeHalfWidth, z: Math.sin(angle2) },
        { x: Math.cos(angle2), y: -stripeHalfWidth, z: Math.sin(angle2) },
        { x: Math.cos(angle1), y: -stripeHalfWidth, z: Math.sin(angle1) }
      ];

      const rotatedPoints = points3D.map(p => {
        const len = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
        const normalized = { x: p.x / len, y: p.y / len, z: p.z / len };
        return this.rotatePointByQuaternion(normalized, quaternion);
      });

      const avgY = (rotatedPoints[0].y + rotatedPoints[1].y + rotatedPoints[2].y + rotatedPoints[3].y) / 4;
      if (avgY < -0.1) continue;

      const projected = rotatedPoints.map(p => ({
        x: p.x * radius * 0.95,
        y: p.z * radius * 0.95
      }));

      ctx.beginPath();
      ctx.moveTo(projected[0].x, projected[0].y);
      ctx.lineTo(projected[1].x, projected[1].y);
      ctx.lineTo(projected[2].x, projected[2].y);
      ctx.lineTo(projected[3].x, projected[3].y);
      ctx.closePath();
      ctx.fill();
    }
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.world) {
      this.world.free();
      this.world = null;
    }
    if (this.peer) {
      this.peer.disconnect();
      this.peer = null;
    }
  }
}

export default PoolGameEngine;
