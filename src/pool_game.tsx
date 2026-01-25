import { useEffect, useRef, useState } from 'react';
import { Camera, Users, Copy, Check } from 'lucide-react';
import RAPIER from '@dimforge/rapier3d-compat';

const PoolGame = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameMode, setGameMode] = useState<string | null>(null); // 'local' or 'online'
  const [connectionState, setConnectionState] = useState('idle'); // idle, hosting, joining, connected
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [rapierLoaded, setRapierLoaded] = useState(false);
  const gameRef = useRef<PoolGameEngine | null>(null);

  // Initialize Rapier WASM
  useEffect(() => {
    RAPIER.init().then(() => {
      setRapierLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !gameMode || !rapierLoaded) return;

    gameRef.current = new PoolGameEngine(canvasRef.current, gameMode, RAPIER, {
      onConnectionStateChange: setConnectionState,
      onRoomCodeGenerated: setRoomCode
    });
    gameRef.current.init();

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy();
      }
    };
  }, [gameMode, rapierLoaded]);

  const handleHost = () => {
    setGameMode('online');
    setConnectionState('hosting');
  };

  const handleJoin = () => {
    if (!inputCode.trim()) return;
    setGameMode('online');
    setConnectionState('joining');
    setTimeout(() => {
      if (gameRef.current) {
        gameRef.current.joinRoom(inputCode);
      }
    }, 100);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!gameMode) {
    return (
      <div style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'hsl(25, 15%, 8%)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎱</div>
            <h1 style={{
              fontSize: '3rem',
              fontWeight: 'bold',
              marginBottom: '0.5rem',
              color: 'hsl(45, 80%, 65%)'
            }}>
              8-Ball Pool
            </h1>
            <p style={{ color: '#9ca3af' }}>Premium billiards experience</p>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            maxWidth: '28rem',
            margin: '0 auto'
          }}>
            <button
              onClick={() => setGameMode('local')}
              style={{
                width: '100%',
                padding: '1rem 1.5rem',
                borderRadius: '0.5rem',
                fontWeight: '600',
                fontSize: '1.125rem',
                background: 'hsl(145, 50%, 28%)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <Users size={24} />
              Local 2-Player
            </button>

            <button
              onClick={handleHost}
              style={{
                width: '100%',
                padding: '1rem 1.5rem',
                borderRadius: '0.5rem',
                fontWeight: '600',
                fontSize: '1.125rem',
                background: 'hsl(25, 45%, 35%)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <Camera size={24} />
              Host Online Game
            </button>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Enter room code"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  background: '#1f2937',
                  color: 'white',
                  border: '1px solid #374151'
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
              />
              <button
                onClick={handleJoin}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.5rem',
                  fontWeight: '600',
                  background: 'hsl(45, 80%, 65%)',
                  color: 'hsl(25, 15%, 8%)'
                }}
              >
                Join
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      background: 'hsl(25, 15%, 8%)'
    }}>
      {connectionState === 'hosting' && roomCode && (
        <div style={{
          marginBottom: '1rem',
          padding: '1rem',
          borderRadius: '0.5rem',
          background: 'hsl(25, 45%, 20%)'
        }}>
          <p style={{ color: '#d1d5db', marginBottom: '0.5rem' }}>
            Share this code with your opponent:
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <code style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              padding: '0.5rem 1rem',
              borderRadius: '0.25rem',
              background: 'hsl(25, 15%, 15%)',
              color: 'hsl(45, 80%, 65%)'
            }}>
              {roomCode}
            </code>
            <button
              onClick={copyRoomCode}
              style={{
                padding: '0.5rem',
                borderRadius: '0.25rem',
                color: 'hsl(45, 80%, 65%)',
                background: 'transparent'
              }}
            >
              {copied ? <Check size={20} /> : <Copy size={20} />}
            </button>
          </div>
        </div>
      )}

      {connectionState === 'joining' && (
        <div style={{ marginBottom: '1rem', color: '#d1d5db' }}>
          Connecting to game...
        </div>
      )}

      {connectionState === 'connected' && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.5rem 1rem',
          borderRadius: '0.25rem',
          background: 'hsl(145, 50%, 28%)',
          color: 'white'
        }}>
          Connected! Game ready to start
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={1200}
        height={700}
        style={{
          borderRadius: '0.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          border: '8px solid hsl(25, 35%, 25%)'
        }}
      />

      <div style={{
        marginTop: '1rem',
        color: '#9ca3af',
        fontSize: '0.875rem'
      }}>
        {gameMode === 'local' ? 'Local 2-Player Mode' : 'Online Multiplayer Mode'}
      </div>
    </div>
  );
};

// Physics properties for realistic pool ball behavior
const BALL_MASS = 0.17;        // kg (standard pool ball is ~170g)
const BALL_RESTITUTION = 0.92; // Bounciness of ball-to-ball collisions
const BALL_FRICTION = 0.2;     // Surface friction between balls
const CUSHION_RESTITUTION = 0.75; // Cushion bounce factor
const CUSHION_FRICTION = 0.15;    // Cushion surface friction
const ROLLING_FRICTION = 0.01;    // Felt resistance (simulated)
const LINEAR_DAMPING = 0.5;       // Simulates rolling resistance on felt
const ANGULAR_DAMPING = 0.5;      // Simulates rotational friction on felt
const MAX_SHOT_POWER = 3;         // Maximum shot power (affects impulse strength)

// Canvas to physics scale (pixels per physics unit)
const SCALE = 5;

class PoolGameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  mode: string;
  RAPIER: typeof RAPIER;
  callbacks: any;
  world: RAPIER.World | null;
  balls: Array<{body: RAPIER.RigidBody, collider: RAPIER.Collider, type: string, number: number}>;
  cushionBodies: RAPIER.RigidBody[];
  currentPlayer: number;
  aiming: boolean;
  aimAngle: number;
  power: number;
  powerIncreasing: boolean;
  scores: {player1: number, player2: number};
  gameStarted: boolean;
  pocketed: {solids: number[], stripes: number[], eight: boolean};
  playerTypes: {player1: string | null, player2: string | null};
  mousePos: {x: number, y: number};
  isMyTurn: boolean;
  peer: any;
  connection: any;
  animationId: number | null;
  pockets: Array<{x: number, y: number, radius: number}>;
  shotInProgress: boolean;
  pocketedThisShot: {solids: number[], stripes: number[], cueBall: boolean};

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
    this.connection = null;
    this.animationId = null;
    this.pockets = [];
    this.shotInProgress = false;
    this.pocketedThisShot = { solids: [], stripes: [], cueBall: false };
  }

  init() {
    // Create physics world with no gravity (pool table is horizontal)
    this.world = new this.RAPIER.World({ x: 0.0, y: 0.0, z: 0.0 });

    this.setupTable();
    this.setupBalls();
    this.setupEventListeners();

    if (this.mode === 'online') {
      this.setupWebRTC();
    }

    this.gameLoop();
  }

  setupWebRTC() {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.callbacks.onRoomCodeGenerated(roomCode);
  }

  joinRoom(_code: string) {
    this.isMyTurn = false;
    this.callbacks.onConnectionStateChange('connected');
  }

  setupTable() {
    if (!this.world) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    const cushionInset = 40; // Distance from edge to visual cushion (pixels)
    const ballRadius = 12;   // Ball radius in pixels
    const cushionThickness = 15; // Cushion thickness in pixels
    const pocketRadius = 25; // Corner pocket radius in pixels
    const sidePocketRadius = 22; // Side pocket radius in pixels
    const cornerPocketGap = 45; // Gap in cushion for corner pockets (pixels)
    const sidePocketGap = 40;   // Gap for side pockets (pixels)

    // Pocket positions (in pixels for rendering)
    this.pockets = [
      { x: cushionInset, y: cushionInset, radius: pocketRadius },                    // Top-left
      { x: w / 2, y: cushionInset - 5, radius: sidePocketRadius },                   // Top-middle
      { x: w - cushionInset, y: cushionInset, radius: pocketRadius },                // Top-right
      { x: cushionInset, y: h - cushionInset, radius: pocketRadius },                // Bottom-left
      { x: w / 2, y: h - cushionInset + 5, radius: sidePocketRadius },               // Bottom-middle
      { x: w - cushionInset, y: h - cushionInset, radius: pocketRadius }             // Bottom-right
    ];

    // Create cushion walls using Rapier 3D
    // In our 3D setup: X = left-right, Y = up (height), Z = top-bottom (depth into screen)
    // We'll simulate a top-down view, so balls roll on the X-Z plane at Y=BALL_RADIUS

    // Physics coordinates: Convert from pixels
    // Left edge at x=0, right edge at x=w/SCALE
    // Top edge at z=0, bottom edge at z=h/SCALE
    const physW = w / SCALE;
    const physH = h / SCALE;
    const physCushionInset = cushionInset / SCALE;
    const physCushionThickness = cushionThickness / SCALE;
    const physCornerGap = cornerPocketGap / SCALE;
    const physSideGap = sidePocketGap / SCALE;
    const physBallRadius = ballRadius / SCALE;
    const cushionHeight = physBallRadius * 2.5; // Cushions are taller than balls

    // Helper to create a cushion cuboid
    const createCushion = (x: number, y: number, z: number, hx: number, hy: number, hz: number) => {
      const bodyDesc = this.RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
      const body = this.world!.createRigidBody(bodyDesc);
      const colliderDesc = this.RAPIER.ColliderDesc.cuboid(hx, hy, hz)
        .setRestitution(CUSHION_RESTITUTION)
        .setFriction(CUSHION_FRICTION);
      this.world!.createCollider(colliderDesc, body);
      this.cushionBodies.push(body);
    };

    // Cushion Y position (bottom of cushion at table level)
    const cushionY = cushionHeight / 2;

    // Top cushions (along Z = physCushionInset, extending in X direction)
    // Left segment of top cushion (from left corner pocket to center pocket)
    // Offset by ball radius so the edge of the ball collides with the visual cushion edge
    const topZ = physCushionInset + physBallRadius;
    const topLeftStart = physCushionInset + physCornerGap;
    const topLeftEnd = physW / 2 - physSideGap;
    const topLeftLength = topLeftEnd - topLeftStart;
    if (topLeftLength > 0) {
      createCushion(
        topLeftStart + topLeftLength / 2,
        cushionY,
        topZ,
        topLeftLength / 2,
        cushionHeight / 2,
        physCushionThickness / 2
      );
    }

    // Right segment of top cushion
    const topRightStart = physW / 2 + physSideGap;
    const topRightEnd = physW - physCushionInset - physCornerGap;
    const topRightLength = topRightEnd - topRightStart;
    if (topRightLength > 0) {
      createCushion(
        topRightStart + topRightLength / 2,
        cushionY,
        topZ,
        topRightLength / 2,
        cushionHeight / 2,
        physCushionThickness / 2
      );
    }

    // Bottom cushions (along Z = physH - physCushionInset)
    // Offset by ball radius so the edge of the ball collides with the visual cushion edge
    const bottomZ = physH - physCushionInset - physBallRadius;
    const bottomLeftStart = physCushionInset + physCornerGap;
    const bottomLeftEnd = physW / 2 - physSideGap;
    const bottomLeftLength = bottomLeftEnd - bottomLeftStart;
    if (bottomLeftLength > 0) {
      createCushion(
        bottomLeftStart + bottomLeftLength / 2,
        cushionY,
        bottomZ,
        bottomLeftLength / 2,
        cushionHeight / 2,
        physCushionThickness / 2
      );
    }

    const bottomRightStart = physW / 2 + physSideGap;
    const bottomRightEnd = physW - physCushionInset - physCornerGap;
    const bottomRightLength = bottomRightEnd - bottomRightStart;
    if (bottomRightLength > 0) {
      createCushion(
        bottomRightStart + bottomRightLength / 2,
        cushionY,
        bottomZ,
        bottomRightLength / 2,
        cushionHeight / 2,
        physCushionThickness / 2
      );
    }

    // Left cushion (along X = physCushionInset, extending in Z direction)
    // Offset by ball radius so the edge of the ball collides with the visual cushion edge
    const leftX = physCushionInset + physBallRadius;
    const leftStart = physCushionInset + physCornerGap;
    const leftEnd = physH - physCushionInset - physCornerGap;
    const leftLength = leftEnd - leftStart;
    if (leftLength > 0) {
      createCushion(
        leftX,
        cushionY,
        leftStart + leftLength / 2,
        physCushionThickness / 2,
        cushionHeight / 2,
        leftLength / 2
      );
    }

    // Right cushion
    // Offset by ball radius so the edge of the ball collides with the visual cushion edge
    const rightX = physW - physCushionInset - physBallRadius;
    const rightStart = physCushionInset + physCornerGap;
    const rightEnd = physH - physCushionInset - physCornerGap;
    const rightLength = rightEnd - rightStart;
    if (rightLength > 0) {
      createCushion(
        rightX,
        cushionY,
        rightStart + rightLength / 2,
        physCushionThickness / 2,
        cushionHeight / 2,
        rightLength / 2
      );
    }
  }

  setupBalls() {
    if (!this.world) return;

    const pixelRadius = 12;
    const physRadius = pixelRadius / SCALE;
    const h = this.canvas.height;

    // Cue ball position in pixels, then convert to physics
    const cuePixelX = 300;
    const cuePixelY = h / 2;
    const cuePhysX = cuePixelX / SCALE;
    const cuePhysZ = cuePixelY / SCALE;

    // Create a ball helper function
    const createBall = (physX: number, physZ: number, type: string, number: number) => {
      // Ball center at Y = physRadius (sitting on table surface at Y=0)
      const bodyDesc = this.RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(physX, physRadius, physZ)
        .setLinearDamping(LINEAR_DAMPING)
        .setAngularDamping(ANGULAR_DAMPING)
        .setCcdEnabled(true); // Enable CCD for fast-moving balls

      const body = this.world!.createRigidBody(bodyDesc);

      const colliderDesc = this.RAPIER.ColliderDesc.ball(physRadius)
        .setRestitution(BALL_RESTITUTION)
        .setFriction(BALL_FRICTION)
        .setMass(BALL_MASS);

      const collider = this.world!.createCollider(colliderDesc, body);

      this.balls.push({ body, collider, type, number });
    };

    // Create cue ball
    createBall(cuePhysX, cuePhysZ, 'cue', 0);

    // Rack position (foot spot is typically 3/4 down the table length)
    const rackPixelX = 900;
    const rackPixelY = h / 2;
    const rackPhysX = rackPixelX / SCALE;
    const rackPhysZ = rackPixelY / SCALE;

    // Rack the balls in triangle formation
    // Standard 8-ball rack: 8-ball in center, one solid and one stripe in back corners
    const ballOrder = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
    let ballIndex = 0;
    const spacing = physRadius * 2.05; // Slightly more than diameter for tight rack

    for (let row = 0; row < 5; row++) {
      for (let col = 0; col <= row; col++) {
        // Triangle points toward cue ball (negative X direction)
        const x = rackPhysX + row * spacing * 0.866; // cos(30°) ≈ 0.866
        const z = rackPhysZ + (col - row / 2) * spacing;

        const ballNum = ballOrder[ballIndex];
        const type = ballNum === 8 ? 'eight' :
                     ballNum < 8 ? 'solid' : 'stripe';

        createBall(x, z, type, ballNum);
        ballIndex++;
      }
    }
  }

  setupEventListeners() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mousePos.x = e.clientX - rect.left;
      this.mousePos.y = e.clientY - rect.top;

      if (this.canShoot() && !this.aiming) {
        const cueBall = this.balls.find(b => b.type === 'cue');
        if (cueBall) {
          // Get ball position in pixel coordinates
          const ballPos = cueBall.body.translation();
          const ballPixelX = ballPos.x * SCALE;
          const ballPixelY = ballPos.z * SCALE; // Z is our "Y" in 2D view

          this.aimAngle = Math.atan2(
            this.mousePos.y - ballPixelY,
            this.mousePos.x - ballPixelX
          );
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

  canShoot(): boolean {
    if (this.mode === 'online' && !this.isMyTurn) return false;

    // Check if all balls have stopped moving
    return this.balls.every(ball => {
      const linvel = ball.body.linvel();
      const angvel = ball.body.angvel();
      const linearSpeed = Math.sqrt(linvel.x * linvel.x + linvel.y * linvel.y + linvel.z * linvel.z);
      const angularSpeed = Math.sqrt(angvel.x * angvel.x + angvel.y * angvel.y + angvel.z * angvel.z);
      return linearSpeed < 0.05 && angularSpeed < 0.1;
    });
  }

  shoot() {
    const cueBall = this.balls.find(b => b.type === 'cue');
    if (!cueBall) return;

    // Start tracking this shot
    this.shotInProgress = true;
    this.pocketedThisShot = { solids: [], stripes: [], cueBall: false };

    // Apply impulse in the direction of the aim
    const impulseStrength = this.power * 8; // Adjust multiplier for feel

    // In 3D: X is horizontal, Z is the "depth" (our 2D Y)
    const impulseX = Math.cos(this.aimAngle) * impulseStrength;
    const impulseZ = Math.sin(this.aimAngle) * impulseStrength;

    // Apply impulse at the ball's center (no spin for now)
    cueBall.body.applyImpulse({ x: impulseX, y: 0, z: impulseZ }, true);

    // Optional: Add some backspin/topspin based on where cue hits ball
    // For realistic rotation, we can apply torque impulse
    // This simulates the cue tip hitting slightly above/below center
    const spinFactor = 0.3;
    cueBall.body.applyTorqueImpulse({
      x: -impulseZ * spinFactor, // Rotation around X affects Z motion
      y: 0,
      z: impulseX * spinFactor   // Rotation around Z affects X motion
    }, true);

    this.gameStarted = true;
  }

  checkPockets() {
    if (!this.world) return;

    const pixelRadius = 12;
    const h = this.canvas.height;

    // Check if ball has fallen into a pocket
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];
      const pos = ball.body.translation();

      // Convert physics position to pixel position
      const pixelX = pos.x * SCALE;
      const pixelZ = pos.z * SCALE;

      // Check proximity to pockets
      let isInPocket = false;
      for (const pocket of this.pockets) {
        const dx = pixelX - pocket.x;
        const dz = pixelZ - pocket.y;
        const dist = Math.sqrt(dx * dx + dz * dz);
        // Ball is pocketed if its center is within pocket radius
        if (dist < pocket.radius) {
          isInPocket = true;
          break;
        }
      }

      // Fallback: If ball is outside table bounds, consider it pocketed
      // This catches fast-moving balls that might skip past pocket detection
      const w = this.canvas.width;
      const cushionInset = 40;
      if (pixelX < cushionInset - pixelRadius || pixelX > w - cushionInset + pixelRadius ||
          pixelZ < cushionInset - pixelRadius || pixelZ > h - cushionInset + pixelRadius) {
        isInPocket = true;
      }

      if (isInPocket) {
        // Remove ball from physics world
        this.world.removeRigidBody(ball.body);

        if (ball.type === 'cue') {
          // Scratch - replace cue ball
          const resetPixelX = 300;
          const resetPixelZ = h / 2;
          const resetPhysX = resetPixelX / SCALE;
          const resetPhysZ = resetPixelZ / SCALE;
          const physRadius = pixelRadius / SCALE;

          // Create new cue ball
          const bodyDesc = this.RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(resetPhysX, physRadius, resetPhysZ)
            .setLinearDamping(LINEAR_DAMPING)
            .setAngularDamping(ANGULAR_DAMPING)
            .setCcdEnabled(true);

          const newBody = this.world.createRigidBody(bodyDesc);

          const colliderDesc = this.RAPIER.ColliderDesc.ball(physRadius)
            .setRestitution(BALL_RESTITUTION)
            .setFriction(BALL_FRICTION)
            .setMass(BALL_MASS);

          const newCollider = this.world.createCollider(colliderDesc, newBody);

          // Update the ball reference
          this.balls[i] = { body: newBody, collider: newCollider, type: 'cue', number: 0 };

          // Track that cue ball was scratched this shot
          this.pocketedThisShot.cueBall = true;
        } else if (ball.type === 'eight') {
          this.pocketed.eight = true;
          this.balls.splice(i, 1);
        } else {
          if (ball.type === 'solid') {
            this.pocketed.solids.push(ball.number);
            this.pocketedThisShot.solids.push(ball.number);
          } else {
            this.pocketed.stripes.push(ball.number);
            this.pocketedThisShot.stripes.push(ball.number);
          }
          this.balls.splice(i, 1);
        }
      }
    }

    // Apply rolling friction (simulating felt resistance)
    // This keeps balls on the table and slows them down naturally
    this.applyRollingFriction();
  }

  applyRollingFriction() {
    const frictionCoeff = ROLLING_FRICTION;
    const pixelRadius = 12;
    const physRadius = pixelRadius / SCALE;

    for (const ball of this.balls) {
      const linvel = ball.body.linvel();
      const speed = Math.sqrt(linvel.x * linvel.x + linvel.z * linvel.z);

      if (speed > 0.01) {
        // Apply friction force opposite to velocity
        const frictionForce = frictionCoeff * BALL_MASS * 9.81; // F = μ * m * g
        const deceleration = frictionForce / BALL_MASS;

        // Reduce velocity slightly each frame
        const newSpeed = Math.max(0, speed - deceleration * (1/60));
        const factor = speed > 0 ? newSpeed / speed : 0;

        ball.body.setLinvel({
          x: linvel.x * factor,
          y: linvel.y,
          z: linvel.z * factor
        }, true);

        // Also apply rolling: angular velocity should match linear velocity
        // For a rolling ball: ω = v / r
        if (speed > 0.05) {
          const targetAngVelX = -linvel.z / physRadius; // Rotation around X from Z motion
          const targetAngVelZ = linvel.x / physRadius;  // Rotation around Z from X motion

          const currentAngVel = ball.body.angvel();
          // Blend toward proper rolling (gradual correction)
          const blend = 0.1;
          ball.body.setAngvel({
            x: currentAngVel.x * (1 - blend) + targetAngVelX * blend,
            y: currentAngVel.y * 0.95, // Damp vertical spin
            z: currentAngVel.z * (1 - blend) + targetAngVelZ * blend
          }, true);
        }
      } else {
        // Stop very slow balls completely
        ball.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        ball.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }

      // Keep balls on the table (Y should be at ball radius)
      const pos = ball.body.translation();
      if (Math.abs(pos.y - physRadius) > 0.01) {
        ball.body.setTranslation({ x: pos.x, y: physRadius, z: pos.z }, true);
        const linv = ball.body.linvel();
        ball.body.setLinvel({ x: linv.x, y: 0, z: linv.z }, true);
      }
    }
  }

  // Find the first target ball that will be hit by the cue ball along the aim line
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

    // Check each ball (except cue ball)
    for (const ball of this.balls) {
      if (ball.type === 'cue') continue;

      const pos = ball.body.translation();
      const targetX = pos.x * SCALE;
      const targetY = pos.z * SCALE;

      // Vector from cue ball to target ball
      const toTargetX = targetX - cueBallX;
      const toTargetY = targetY - cueBallY;

      // Project target ball position onto aim line
      const projDist = toTargetX * dirX + toTargetY * dirY;

      // Skip if ball is behind the cue ball
      if (projDist <= 0) continue;

      // Find closest point on aim line to target ball center
      const closestPointX = cueBallX + dirX * projDist;
      const closestPointY = cueBallY + dirY * projDist;

      // Distance from aim line to target ball center
      const perpDistX = targetX - closestPointX;
      const perpDistY = targetY - closestPointY;
      const perpDist = Math.sqrt(perpDistX * perpDistX + perpDistY * perpDistY);

      // Collision occurs if perpendicular distance < 2 * radius (two balls touching)
      const collisionDist = ballRadius * 2;

      if (perpDist < collisionDist) {
        // Calculate how far back from closest point the collision actually occurs
        // Using Pythagorean theorem: the cue ball center is at distance d along line
        // where d^2 + perpDist^2 = collisionDist^2
        const backDist = Math.sqrt(collisionDist * collisionDist - perpDist * perpDist);
        const actualDist = projDist - backDist;

        if (actualDist > ballRadius && actualDist < closestDist) {
          closestDist = actualDist;
          closestBall = { x: targetX, y: targetY };
        }
      }
    }

    if (closestBall) {
      // Calculate the exact impact point (where cue ball center will be)
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

  switchTurn() {
    this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    if (this.mode === 'online') {
      this.isMyTurn = !this.isMyTurn;
    }
  }

  gameLoop() {
    if (!this.world) return;

    // Step the physics simulation
    this.world.step();

    this.checkPockets();

    // Check if shot has ended (all balls stopped)
    if (this.shotInProgress && this.allBallsStopped()) {
      this.evaluateTurnSwitch();
      this.shotInProgress = false;
    }

    if (this.aiming && this.powerIncreasing) {
      this.power = Math.min(this.power + 0.02, MAX_SHOT_POWER);
    }

    this.render();
    this.animationId = requestAnimationFrame(() => this.gameLoop());
  }

  allBallsStopped(): boolean {
    return this.balls.every(ball => {
      const linvel = ball.body.linvel();
      const angvel = ball.body.angvel();
      const linearSpeed = Math.sqrt(linvel.x * linvel.x + linvel.z * linvel.z);
      const angularSpeed = Math.sqrt(angvel.x * angvel.x + angvel.y * angvel.y + angvel.z * angvel.z);
      return linearSpeed < 0.05 && angularSpeed < 0.1;
    });
  }

  evaluateTurnSwitch() {
    // If cue ball was scratched, always switch turn
    if (this.pocketedThisShot.cueBall) {
      this.switchTurn();
      return;
    }

    // Determine current player's ball type
    const currentPlayerType = this.currentPlayer === 1
      ? this.playerTypes.player1
      : this.playerTypes.player2;

    // If types haven't been assigned yet
    if (!currentPlayerType) {
      // If player pocketed any ball, they get that type and keep their turn
      if (this.pocketedThisShot.solids.length > 0) {
        if (this.currentPlayer === 1) {
          this.playerTypes.player1 = 'solid';
          this.playerTypes.player2 = 'stripe';
        } else {
          this.playerTypes.player2 = 'solid';
          this.playerTypes.player1 = 'stripe';
        }
        return; // Keep turn
      } else if (this.pocketedThisShot.stripes.length > 0) {
        if (this.currentPlayer === 1) {
          this.playerTypes.player1 = 'stripe';
          this.playerTypes.player2 = 'solid';
        } else {
          this.playerTypes.player2 = 'stripe';
          this.playerTypes.player1 = 'solid';
        }
        return; // Keep turn
      }
      // Didn't pocket anything, switch turn
      this.switchTurn();
      return;
    }

    // Check if player pocketed their assigned ball type
    const pocketedOwn = currentPlayerType === 'solid'
      ? this.pocketedThisShot.solids.length > 0
      : this.pocketedThisShot.stripes.length > 0;

    if (!pocketedOwn) {
      this.switchTurn();
    }
    // If they pocketed their own ball type, they keep their turn
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const radius = 12;

    // Background
    ctx.fillStyle = 'hsl(25, 15%, 8%)';
    ctx.fillRect(0, 0, w, h);

    // Table felt
    ctx.fillStyle = 'hsl(145, 50%, 28%)';
    ctx.fillRect(40, 40, w - 80, h - 80);

    // Table markings
    ctx.strokeStyle = 'hsl(145, 50%, 35%)';
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 60, w - 120, h - 120);

    // Pockets with proper openings
    this.pockets.forEach((pocket, index) => {
      // Outer pocket rim (dark wood)
      ctx.fillStyle = 'hsl(25, 35%, 15%)';
      ctx.beginPath();
      ctx.arc(pocket.x, pocket.y, pocket.radius + 6, 0, Math.PI * 2);
      ctx.fill();

      // Pocket opening shadow ring
      ctx.fillStyle = 'hsl(25, 15%, 8%)';
      ctx.beginPath();
      ctx.arc(pocket.x, pocket.y, pocket.radius + 2, 0, Math.PI * 2);
      ctx.fill();

      // Main pocket hole (deep black)
      const gradient = ctx.createRadialGradient(
        pocket.x, pocket.y, 0,
        pocket.x, pocket.y, pocket.radius
      );
      gradient.addColorStop(0, 'hsl(0, 0%, 2%)');
      gradient.addColorStop(0.7, 'hsl(0, 0%, 5%)');
      gradient.addColorStop(1, 'hsl(0, 0%, 10%)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(pocket.x, pocket.y, pocket.radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner pocket depth effect
      ctx.fillStyle = 'hsl(0, 0%, 0%)';
      ctx.beginPath();
      ctx.arc(pocket.x, pocket.y, pocket.radius * 0.7, 0, Math.PI * 2);
      ctx.fill();

      // Pocket opening highlights (leather/rubber edge)
      ctx.strokeStyle = 'hsl(25, 25%, 20%)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      // Draw partial arc for 3D effect based on pocket position
      // Corner pockets (0, 2, 3, 5) get diagonal openings
      // Side pockets (1, 4) get horizontal openings
      if (index === 0) { // Top-left corner
        ctx.arc(pocket.x, pocket.y, pocket.radius - 1, Math.PI * 0.25, Math.PI * 1.25);
      } else if (index === 2) { // Top-right corner
        ctx.arc(pocket.x, pocket.y, pocket.radius - 1, Math.PI * -0.25, Math.PI * 0.75);
      } else if (index === 3) { // Bottom-left corner
        ctx.arc(pocket.x, pocket.y, pocket.radius - 1, Math.PI * 0.75, Math.PI * 1.75);
      } else if (index === 5) { // Bottom-right corner
        ctx.arc(pocket.x, pocket.y, pocket.radius - 1, Math.PI * 1.25, Math.PI * 2.25);
      } else if (index === 1) { // Top-middle
        ctx.arc(pocket.x, pocket.y, pocket.radius - 1, Math.PI * 0.1, Math.PI * 0.9);
      } else if (index === 4) { // Bottom-middle
        ctx.arc(pocket.x, pocket.y, pocket.radius - 1, Math.PI * 1.1, Math.PI * 1.9);
      }
      ctx.stroke();

      // Subtle inner highlight for depth
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pocket.x - 2, pocket.y - 2, pocket.radius * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Ball shadows (drawn first, below all balls)
    this.balls.forEach(ball => {
      const pos = ball.body.translation();
      const pixelX = pos.x * SCALE;
      const pixelY = pos.z * SCALE;

      // Shadow offset (light from above, slightly behind)
      const shadowOffsetX = 3;
      const shadowOffsetY = 4;

      // Draw elliptical shadow
      ctx.save();
      ctx.translate(pixelX + shadowOffsetX, pixelY + shadowOffsetY);
      ctx.scale(1, 0.6); // Flatten to ellipse
      const shadowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 1.1);
      shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0.48)');
      shadowGradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.35)');
      shadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = shadowGradient;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Balls
    this.balls.forEach(ball => {
      const pos = ball.body.translation();
      const rot = ball.body.rotation(); // Quaternion

      // Convert 3D position to 2D pixel coordinates
      const pixelX = pos.x * SCALE;
      const pixelY = pos.z * SCALE; // Z becomes Y in 2D view

      this.renderBall3D(ctx, pixelX, pixelY, radius, ball.type, ball.number, rot);
    });

    // Cue stick
    if (this.canShoot()) {
      const cueBall = this.balls.find(b => b.type === 'cue');
      if (cueBall) {
        const pos = cueBall.body.translation();
        const ballPixelX = pos.x * SCALE;
        const ballPixelY = pos.z * SCALE;

        const cueLength = 200;
        const cueDistance = this.aiming ? 30 + (1 - this.power) * 50 : 30;
        const startX = ballPixelX - Math.cos(this.aimAngle) * cueDistance;
        const startY = ballPixelY - Math.sin(this.aimAngle) * cueDistance;
        const endX = startX - Math.cos(this.aimAngle) * cueLength;
        const endY = startY - Math.sin(this.aimAngle) * cueLength;

        // Cue stick shadow
        const shadowOffsetX = 4;
        const shadowOffsetY = 5;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(startX + shadowOffsetX, startY + shadowOffsetY);
        ctx.lineTo(endX + shadowOffsetX, endY + shadowOffsetY);
        ctx.stroke();

        // Cue stick gradient
        const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
        gradient.addColorStop(0, 'hsl(25, 45%, 65%)');
        gradient.addColorStop(0.7, 'hsl(25, 45%, 45%)');
        gradient.addColorStop(1, 'hsl(25, 45%, 25%)');

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Find the first target ball that will be hit
        const targetBallInfo = this.findTargetBall(ballPixelX, ballPixelY, this.aimAngle, radius);

        // Aiming line - always visible when can shoot
        const opacity = this.aiming ? 0.3 + 0.3 * Math.min(this.power / MAX_SHOT_POWER, 1) : 0.4;
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(ballPixelX, ballPixelY);

        if (targetBallInfo) {
          // Draw line to impact point (where cue ball center will be at collision)
          ctx.lineTo(targetBallInfo.impactX, targetBallInfo.impactY);
          ctx.stroke();

          // Draw ghost ball at impact point (shows where cue ball will be when hitting)
          ctx.setLineDash([]);
          ctx.strokeStyle = `rgba(255, 255, 255, ${opacity + 0.2})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(targetBallInfo.impactX, targetBallInfo.impactY, radius, 0, Math.PI * 2);
          ctx.stroke();

          // Draw predicted path of target ball after collision
          const targetDirX = targetBallInfo.targetBallX - targetBallInfo.impactX;
          const targetDirY = targetBallInfo.targetBallY - targetBallInfo.impactY;
          const targetDirLen = Math.sqrt(targetDirX * targetDirX + targetDirY * targetDirY);

          if (targetDirLen > 0.1) {
            const normX = targetDirX / targetDirLen;
            const normY = targetDirY / targetDirLen;

            // Draw target ball predicted path
            ctx.strokeStyle = `rgba(255, 200, 100, ${opacity + 0.1})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(targetBallInfo.targetBallX, targetBallInfo.targetBallY);
            ctx.lineTo(
              targetBallInfo.targetBallX + normX * 150,
              targetBallInfo.targetBallY + normY * 150
            );
            ctx.stroke();
          }
          ctx.setLineDash([]);
        } else {
          // No target ball - draw full aiming line
          ctx.lineTo(
            ballPixelX + Math.cos(this.aimAngle) * 300,
            ballPixelY + Math.sin(this.aimAngle) * 300
          );
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

    // Ball display and turn indicator
    this.renderBallDisplay(ctx, w, h);

    // Current turn indicator
    const turnText = this.mode === 'online'
      ? (this.isMyTurn ? 'Your Turn' : 'Opponent\'s Turn')
      : `Player ${this.currentPlayer}'s Turn`;

    ctx.fillStyle = this.canShoot() ? 'hsl(145, 50%, 50%)' : 'hsl(25, 50%, 50%)';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(turnText, w / 2 - 120, 30);
  }

  // Render the ball display showing solids on left, 8-ball in center, stripes on right
  renderBallDisplay(ctx: CanvasRenderingContext2D, canvasWidth: number, _canvasHeight: number) {
    const displayY = 20; // Y position for ball display
    const ballRadius = 10; // Smaller balls for display
    const ballSpacing = 24; // Space between ball centers

    // Colors for balls 1-7 (solids) and 9-15 (stripes use same colors)
    const colors = [
      '#FCD116', '#1C3F94', '#EE2737', '#601D84', '#F58025',
      '#056839', '#862234', '#333333'
    ];

    // Render solids (1-7) on top left
    const solidsStartX = 90;
    for (let i = 1; i <= 7; i++) {
      const x = solidsStartX + (i - 1) * ballSpacing;
      const isPocketed = this.pocketed.solids.includes(i);
      this.renderDisplayBall(ctx, x, displayY, ballRadius, 'solid', i, colors[(i - 1) % 8], isPocketed);
    }

    // Render 8-ball in the middle
    const eightBallX = canvasWidth / 2 + 50;
    this.renderDisplayBall(ctx, eightBallX, displayY, ballRadius, 'eight', 8, '#333333', this.pocketed.eight);

    // Render stripes (9-15) on top right
    const stripesEndX = canvasWidth - 90;
    for (let i = 9; i <= 15; i++) {
      const x = stripesEndX - (15 - i) * ballSpacing;
      const isPocketed = this.pocketed.stripes.includes(i);
      this.renderDisplayBall(ctx, x, displayY, ballRadius, 'stripe', i, colors[(i - 9) % 8], isPocketed);
    }
  }

  // Render a single ball in the display (simplified 2D version)
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

    // Apply gray filter for pocketed balls
    if (isPocketed) {
      ctx.globalAlpha = 0.35;
    }

    if (ballType === 'eight') {
      // Eight ball - black with white circle and number
      ctx.fillStyle = isPocketed ? '#555555' : 'black';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      // White circle with number
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
      // Solid ball
      ctx.fillStyle = isPocketed ? '#666666' : color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      // White circle with number
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
      // Stripe ball - white with colored stripe
      ctx.fillStyle = isPocketed ? '#888888' : 'white';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw stripe as a band across the middle
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.clip();

      ctx.fillStyle = isPocketed ? '#666666' : color;
      ctx.fillRect(x - radius, y - radius * 0.4, radius * 2, radius * 0.8);
      ctx.restore();

      // White circle with number
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

    // Add subtle border
    ctx.strokeStyle = isPocketed ? 'rgba(100, 100, 100, 0.5)' : 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  // Rotate a 3D point by a quaternion
  rotatePointByQuaternion(
    point: { x: number, y: number, z: number },
    q: { w: number, x: number, y: number, z: number }
  ): { x: number, y: number, z: number } {
    // Quaternion rotation: q * p * q^(-1)
    // Use conjugate (negate x,y,z) to correct rotation direction
    const px = point.x, py = point.y, pz = point.z;
    const qw = q.w, qx = -q.x, qy = -q.y, qz = -q.z;

    // Calculate q * p (treating p as quaternion with w=0)
    const tx = 2 * (qy * pz - qz * py);
    const ty = 2 * (qz * px - qx * pz);
    const tz = 2 * (qx * py - qy * px);

    return {
      x: px + qw * tx + (qy * tz - qz * ty),
      y: py + qw * ty + (qz * tx - qx * tz),
      z: pz + qw * tz + (qx * ty - qy * tx)
    };
  }

  // Render a ball with proper 3D rotation projected to 2D
  renderBall3D(
    ctx: CanvasRenderingContext2D,
    pixelX: number,
    pixelY: number,
    radius: number,
    ballType: string,
    ballNumber: number,
    quaternion: { w: number, x: number, y: number, z: number }
  ) {
    const colors = [
      '#FCD116', '#1C3F94', '#EE2737', '#601D84', '#F58025',
      '#056839', '#862234', '#333333'
    ];

    ctx.save();
    ctx.translate(pixelX, pixelY);

    if (ballType === 'cue') {
      // White cue ball with 3D rotation indicator
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'hsl(25, 15%, 80%)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 3D rotation indicator - blue dot on sphere surface
      const dotPos3D = this.rotatePointByQuaternion({ x: 0, y: 1, z: 0 }, quaternion);
      // Project to 2D (viewing from above, Y is up toward camera)
      // Only show if dot is on visible hemisphere (y > 0 means facing up/camera)
      if (dotPos3D.y > 0) {
        // Project x,z to screen, scale by how much it's on the visible side
        const projX = dotPos3D.x * radius * 0.7;
        const projY = dotPos3D.z * radius * 0.7;
        const dotSize = 2 + dotPos3D.y * 1.5; // Larger when more directly facing camera
        ctx.fillStyle = `rgba(30, 100, 200, ${0.4 + dotPos3D.y * 0.6})`;
        ctx.beginPath();
        ctx.arc(projX, projY, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (ballType === 'eight') {
      // Eight ball - black with white circle and number
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();

      // The number circle is on the ball surface - render it in 3D
      // Place the number circle at a specific point that rotates with the ball
      const circlePos3D = this.rotatePointByQuaternion({ x: 0, y: 1, z: 0 }, quaternion);

      if (circlePos3D.y > -0.2) { // Show when somewhat visible
        const projX = circlePos3D.x * radius * 0.6;
        const projY = circlePos3D.z * radius * 0.6;
        const circleScale = Math.max(0, circlePos3D.y * 0.5 + 0.5);
        const circleRadius = radius * 0.5 * circleScale;

        if (circleRadius > 2) {
          // White circle
          ctx.fillStyle = 'white';
          ctx.beginPath();
          ctx.arc(projX, projY, circleRadius, 0, Math.PI * 2);
          ctx.fill();

          // Number 8
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
      // Solid or stripe ball
      const colorIndex = (ballNumber - 1) % 8;
      const ballColor = colors[colorIndex];

      if (ballType === 'solid') {
        // Solid ball - entirely colored
        ctx.fillStyle = ballColor;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Stripe ball - white base with colored stripe band
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw the stripe as a 3D band around the ball's equator
        // The stripe is a band in the XZ plane (Y near 0) in ball-local space
        this.renderStripe3D(ctx, radius, ballColor, quaternion);
      }

      // Number circle (on ball surface, rotates with ball)
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

  // Render the stripe band on a stripe ball with 3D rotation
  renderStripe3D(
    ctx: CanvasRenderingContext2D,
    radius: number,
    color: string,
    quaternion: { w: number, x: number, y: number, z: number }
  ) {
    // The stripe is a band around the equator of the ball
    // We'll render it by drawing multiple small segments
    ctx.fillStyle = color;

    const stripeHalfWidth = 0.35; // How wide the stripe is (in terms of Y from -0.35 to 0.35)
    const segments = 32;

    for (let i = 0; i < segments; i++) {
      const angle1 = (i / segments) * Math.PI * 2;
      const angle2 = ((i + 1) / segments) * Math.PI * 2;

      // Points on the stripe edges (top and bottom of stripe band)
      const points3D = [
        { x: Math.cos(angle1), y: stripeHalfWidth, z: Math.sin(angle1) },
        { x: Math.cos(angle2), y: stripeHalfWidth, z: Math.sin(angle2) },
        { x: Math.cos(angle2), y: -stripeHalfWidth, z: Math.sin(angle2) },
        { x: Math.cos(angle1), y: -stripeHalfWidth, z: Math.sin(angle1) }
      ];

      // Normalize and rotate each point
      const rotatedPoints = points3D.map(p => {
        const len = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
        const normalized = { x: p.x / len, y: p.y / len, z: p.z / len };
        return this.rotatePointByQuaternion(normalized, quaternion);
      });

      // Check if this segment is visible (average Y > some threshold)
      const avgY = (rotatedPoints[0].y + rotatedPoints[1].y + rotatedPoints[2].y + rotatedPoints[3].y) / 4;
      if (avgY < -0.1) continue; // Skip back-facing segments

      // Project to 2D
      const projected = rotatedPoints.map(p => ({
        x: p.x * radius * 0.95,
        y: p.z * radius * 0.95
      }));

      // Draw the quad
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
    if (this.connection) {
      this.connection.close();
    }
    if (this.peer) {
      this.peer.destroy();
    }
  }
}

export default PoolGame;
