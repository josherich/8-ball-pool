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
  type Pocketed,
  type PocketedThisShot
} from './pool_physics';
import { allBallsStopped, canShoot, evaluateTurnSwitch } from './pool_rules';

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
  peer: any;
  connection: any;
  animationId: number | null;
  pockets: Pocket[];
  shotInProgress: boolean;
  pocketedThisShot: PocketedThisShot;

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
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.callbacks.onRoomCodeGenerated(roomCode);
  }

  joinRoom(_code: string) {
    this.isMyTurn = false;
    this.callbacks.onConnectionStateChange('connected');
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
    return canShoot({
      mode: this.mode,
      isMyTurn: this.isMyTurn,
      balls: this.balls
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
    checkPockets({
      world: this.world,
      canvas: this.canvas,
      balls: this.balls,
      pockets: this.pockets,
      pocketed: this.pocketed,
      pocketedThisShot: this.pocketedThisShot,
      RAPIER: this.RAPIER
    });
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

  gameLoop() {
    if (!this.world) return;

    // Step the physics simulation
    this.world.step();

    this.checkPockets();

    // Check if shot has ended (all balls stopped)
    if (this.shotInProgress && allBallsStopped(this.balls)) {
      const result = evaluateTurnSwitch({
        currentPlayer: this.currentPlayer,
        mode: this.mode,
        isMyTurn: this.isMyTurn,
        playerTypes: this.playerTypes,
        pocketedThisShot: this.pocketedThisShot
      });
      this.playerTypes = result.playerTypes;
      this.currentPlayer = result.currentPlayer;
      this.isMyTurn = result.isMyTurn;
      this.shotInProgress = false;
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

        const cueLength = 400;
        const cueDistance = this.aiming ? 30 + (1 - this.power) * 50 : 30;
        const startX = ballPixelX - Math.cos(this.aimAngle) * cueDistance;
        const startY = ballPixelY - Math.sin(this.aimAngle) * cueDistance;
        const endX = startX - Math.cos(this.aimAngle) * cueLength;
        const endY = startY - Math.sin(this.aimAngle) * cueLength;
        const cueAngle = Math.atan2(endY - startY, endX - startX);

        const tipLength = 6;
        const ferruleLength = 10;
        const shaftLength = cueLength * 0.62;
        const buttLength = cueLength - tipLength - ferruleLength - shaftLength;
        const shaftStart = tipLength + ferruleLength;
        const buttStart = shaftStart + shaftLength;

        // Cue stick shadow
        const shadowOffsetX = 4;
        const shadowOffsetY = 5;
        ctx.save();
        ctx.translate(startX + shadowOffsetX, startY + shadowOffsetY);
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

        // Tip (near ball)
        drawSegment(0, tipLength, 7, '#1f2937');
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
        ctx.fill();

        // Ferrule
        drawSegment(tipLength, tipLength + ferruleLength, 7.4, '#e5e7eb');

        // Shaft
        const shaftGradient = ctx.createLinearGradient(shaftStart, 0, shaftStart + shaftLength, 0);
        shaftGradient.addColorStop(0, 'hsl(35, 45%, 78%)');
        shaftGradient.addColorStop(0.45, 'hsl(30, 42%, 62%)');
        shaftGradient.addColorStop(1, 'hsl(25, 38%, 45%)');
        drawSegment(shaftStart, shaftStart + shaftLength, 7.8, shaftGradient);

        // Butt with wrap
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

        // Butt cap
        ctx.fillStyle = 'hsl(12, 35%, 14%)';
        ctx.beginPath();
        ctx.arc(cueLength, 0, 5.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

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
    point: { x: number; y: number; z: number },
    q: { w: number; x: number; y: number; z: number }
  ): { x: number; y: number; z: number } {
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
    quaternion: { w: number; x: number; y: number; z: number }
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
    quaternion: { w: number; x: number; y: number; z: number }
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

export default PoolGameEngine;
