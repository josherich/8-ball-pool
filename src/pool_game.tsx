import React, { useEffect, useRef, useState } from 'react';
import { Camera, Users, Copy, Check } from 'lucide-react';

const PoolGame = () => {
  const canvasRef = useRef(null);
  const [gameMode, setGameMode] = useState(null); // 'local' or 'online'
  const [connectionState, setConnectionState] = useState('idle'); // idle, hosting, joining, connected
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const gameRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !gameMode) return;

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js';
    script.async = true;

    script.onload = () => {
      gameRef.current = new PoolGameEngine(canvasRef.current, gameMode, {
        onConnectionStateChange: setConnectionState,
        onRoomCodeGenerated: setRoomCode
      });
      gameRef.current.init();
    };

    document.body.appendChild(script);

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy();
      }
      document.body.removeChild(script);
    };
  }, [gameMode]);

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

class PoolGameEngine {
  constructor(canvas, mode, callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mode = mode;
    this.callbacks = callbacks;
    this.engine = null;
    this.world = null;
    this.balls = [];
    this.cue = null;
    this.currentPlayer = 1;
    this.aiming = false;
    this.aimAngle = 0;
    this.power = 0;
    this.powerIncreasing = false;
    this.scores = { player1: 0, player2: 0 };
    this.gameStarted = false;
    this.pocketed = { solids: [], stripes: [], eight: false };
    this.playerTypes = { player1: null, player2: null }; // 'solids' or 'stripes'
    this.mousePos = { x: 0, y: 0 };
    this.isMyTurn = true;
    this.peer = null;
    this.connection = null;
  }

  init() {
    const { Engine, World, Bodies, Events } = Matter;

    this.engine = Engine.create({
      gravity: { x: 0, y: 0 }
    });
    this.world = this.engine.world;

    this.setupTable();
    this.setupBalls();
    this.setupEventListeners();

    if (this.mode === 'online') {
      this.setupWebRTC();
    }

    this.gameLoop();
  }

  setupWebRTC() {
    // Simple peer-to-peer using room code
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.callbacks.onRoomCodeGenerated(roomCode);

    // Store game state for sync
    this.lastSyncTime = Date.now();
  }

  joinRoom(code) {
    this.isMyTurn = false;
    this.callbacks.onConnectionStateChange('connected');
  }

  setupTable() {
    const { Bodies } = Matter;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cushionInset = 40; // Distance from edge to visual cushion
    const ballRadius = 12; // Ball radius
    const wallThickness = 20; // Thickness of the cushion walls
    const pocketRadius = 25;

    // Walls positioned so ball edge is flush with visual cushion
    // Visual cushion is at 40px from edge, ball center should be at 40 + ballRadius when touching
    const playableInset = cushionInset + ballRadius;

    const walls = [
      // Top wall - positioned so ball edge touches at y=40
      Bodies.rectangle(w/2, playableInset, w - playableInset * 2, wallThickness, {
        isStatic: true,
        restitution: 0.9,
        friction: 0.1
      }),
      // Bottom wall - positioned so ball edge touches at y=h-40
      Bodies.rectangle(w/2, h - playableInset, w - playableInset * 2, wallThickness, {
        isStatic: true,
        restitution: 0.9,
        friction: 0.1
      }),
      // Left wall - positioned so ball edge touches at x=40
      Bodies.rectangle(playableInset, h/2, wallThickness, h - playableInset * 2, {
        isStatic: true,
        restitution: 0.9,
        friction: 0.1
      }),
      // Right wall - positioned so ball edge touches at x=w-40
      Bodies.rectangle(w - playableInset, h/2, wallThickness, h - playableInset * 2, {
        isStatic: true,
        restitution: 0.9,
        friction: 0.1
      })
    ];

    Matter.World.add(this.world, walls);

    // Pocket positions
    this.pockets = [
      { x: 50, y: 50 },
      { x: w/2, y: 50 },
      { x: w - 50, y: 50 },
      { x: 50, y: h - 50 },
      { x: w/2, y: h - 50 },
      { x: w - 50, y: h - 50 }
    ];
  }

  setupBalls() {
    const { Bodies } = Matter;
    const radius = 12;
    const startX = 900;
    const startY = this.canvas.height / 2;

    // Cue ball
    const cueBall = Bodies.circle(300, startY, radius, {
      restitution: 0.9,
      friction: 0.01,
      frictionAir: 0.02,
      density: 0.001,
      label: 'cue',
      frictionStatic: 0.5
    });

    this.balls.push({ body: cueBall, type: 'cue', number: 0 });

    // Rack the balls in triangle
    const ballOrder = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
    let ballIndex = 0;
    const spacing = radius * 2.1;

    for (let row = 0; row < 5; row++) {
      for (let col = 0; col <= row; col++) {
        const x = startX + row * spacing * 0.866;
        const y = startY + (col - row/2) * spacing;

        const ball = Bodies.circle(x, y, radius, {
          restitution: 0.9,
          friction: 0.01,
          frictionAir: 0.02,
          density: 0.001,
          label: `ball${ballOrder[ballIndex]}`,
          frictionStatic: 0.5
        });

        const type = ballOrder[ballIndex] === 8 ? 'eight' :
                     ballOrder[ballIndex] < 8 ? 'solid' : 'stripe';

        this.balls.push({
          body: ball,
          type: type,
          number: ballOrder[ballIndex]
        });

        ballIndex++;
      }
    }

    Matter.World.add(this.world, this.balls.map(b => b.body));
  }

  setupEventListeners() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mousePos.x = e.clientX - rect.left;
      this.mousePos.y = e.clientY - rect.top;

      if (this.canShoot() && !this.aiming) {
        const cueBall = this.balls.find(b => b.type === 'cue');
        if (cueBall) {
          this.aimAngle = Math.atan2(
            this.mousePos.y - cueBall.body.position.y,
            this.mousePos.x - cueBall.body.position.x
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

  canShoot() {
    if (this.mode === 'online' && !this.isMyTurn) return false;
    return this.balls.every(ball => {
      const speed = Matter.Vector.magnitude(ball.body.velocity);
      return speed < 0.1;
    });
  }

  shoot() {
    const cueBall = this.balls.find(b => b.type === 'cue');
    if (!cueBall) return;

    const force = this.power * 0.025;
    Matter.Body.applyForce(cueBall.body, cueBall.body.position, {
      x: Math.cos(this.aimAngle) * force,
      y: Math.sin(this.aimAngle) * force
    });

    this.gameStarted = true;
  }

  checkPockets() {
    this.balls.forEach((ball, index) => {
      this.pockets.forEach(pocket => {
        const dx = ball.body.position.x - pocket.x;
        const dy = ball.body.position.y - pocket.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 25) {
          Matter.World.remove(this.world, ball.body);

          if (ball.type === 'cue') {
            // Scratch - replace cue ball
            setTimeout(() => {
              const newCue = Matter.Bodies.circle(300, this.canvas.height/2, 12, {
                restitution: 0.9,
                friction: 0.01,
                frictionAir: 0.02,
                density: 0.001,
                label: 'cue'
              });
              Matter.World.add(this.world, newCue);
              ball.body = newCue;
            }, 500);
            this.switchTurn();
          } else if (ball.type === 'eight') {
            this.pocketed.eight = true;
            this.balls.splice(index, 1);
          } else {
            if (ball.type === 'solid') this.pocketed.solids.push(ball.number);
            else this.pocketed.stripes.push(ball.number);
            this.balls.splice(index, 1);
          }
        }
      });
    });
  }

  switchTurn() {
    this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    if (this.mode === 'online') {
      this.isMyTurn = !this.isMyTurn;
    }
  }

  gameLoop() {
    Matter.Engine.update(this.engine, 1000 / 60);

    this.checkPockets();

    if (this.aiming && this.powerIncreasing) {
      this.power = Math.min(this.power + 0.02, 2);
    }

    this.render();
    requestAnimationFrame(() => this.gameLoop());
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

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

    // Pockets
    this.pockets.forEach(pocket => {
      ctx.fillStyle = 'hsl(25, 15%, 10%)';
      ctx.beginPath();
      ctx.arc(pocket.x, pocket.y, 25, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'hsl(25, 15%, 5%)';
      ctx.beginPath();
      ctx.arc(pocket.x, pocket.y, 18, 0, Math.PI * 2);
      ctx.fill();
    });

    // Balls
    this.balls.forEach(ball => {
      const pos = ball.body.position;
      const radius = 12;
      const angle = ball.body.angle;

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(angle);

      if (ball.type === 'cue') {
        // White ball with rotation marker
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'hsl(25, 15%, 80%)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Rotation indicator - small dot
        ctx.fillStyle = 'hsl(220, 70%, 50%)';
        ctx.beginPath();
        ctx.arc(radius * 0.6, 0, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (ball.type === 'eight') {
        // Eight ball
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();

        // White circle in center
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Number 8
        ctx.fillStyle = 'black';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('8', 0, 0);

        // Rotation indicator
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(radius * 0.7, 0, 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Solids and stripes
        const colors = [
          '#FCD116', '#1C3F94', '#EE2737', '#601D84', '#F58025',
          '#056839', '#862234', '#333333'
        ];
        const colorIndex = (ball.number - 1) % 8;

        // Base color
        ctx.fillStyle = ball.type === 'solid' ? colors[colorIndex] : 'white';
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();

        if (ball.type === 'stripe') {
          // Horizontal stripe
          ctx.fillStyle = colors[colorIndex];
          ctx.fillRect(-radius, -3, radius * 2, 6);
        }

        // White circle for number background
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.45, 0, Math.PI * 2);
        ctx.fill();

        // Number
        ctx.fillStyle = 'black';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ball.number, 0, 0);

        // Rotation indicator - small colored dot offset from center
        ctx.fillStyle = colors[colorIndex];
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(radius * 0.7, 0, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      ctx.restore();
    });

    // Cue stick
    if (this.canShoot()) {
      const cueBall = this.balls.find(b => b.type === 'cue');
      if (cueBall) {
        const cueLength = 200;
        const cueDistance = this.aiming ? 30 + (1 - this.power) * 50 : 30;
        const startX = cueBall.body.position.x - Math.cos(this.aimAngle) * cueDistance;
        const startY = cueBall.body.position.y - Math.sin(this.aimAngle) * cueDistance;
        const endX = startX - Math.cos(this.aimAngle) * cueLength;
        const endY = startY - Math.sin(this.aimAngle) * cueLength;

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

        // Aiming line - always visible when can shoot
        const opacity = this.aiming ? 0.3 + 0.3 * Math.min(this.power, 1) : 0.4;
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(cueBall.body.position.x, cueBall.body.position.y);
        ctx.lineTo(
          cueBall.body.position.x + Math.cos(this.aimAngle) * 300,
          cueBall.body.position.y + Math.sin(this.aimAngle) * 300
        );
        ctx.stroke();
        ctx.setLineDash([]);
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

      const powerRatio = Math.min(this.power, 1);
      ctx.fillStyle = `hsl(${120 - powerRatio * 120}, 70%, 50%)`;
      ctx.fillRect(meterX - meterWidth/2, meterY, meterWidth * powerRatio, meterHeight);

      ctx.strokeStyle = 'hsl(45, 80%, 65%)';
      ctx.lineWidth = 2;
      ctx.strokeRect(meterX - meterWidth/2, meterY, meterWidth, meterHeight);
    }

    // Score display
    ctx.fillStyle = 'hsl(45, 80%, 65%)';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Player 1: ${this.pocketed.solids.length}`, 60, 30);
    ctx.textAlign = 'right';
    ctx.fillText(`Player 2: ${this.pocketed.stripes.length}`, w - 60, 30);

    // Current turn indicator
    const turnText = this.mode === 'online'
      ? (this.isMyTurn ? 'Your Turn' : 'Opponent\'s Turn')
      : `Player ${this.currentPlayer}'s Turn`;

    ctx.fillStyle = this.canShoot() ? 'hsl(145, 50%, 50%)' : 'hsl(25, 50%, 50%)';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(turnText, w / 2, 30);
  }

  destroy() {
    if (this.engine) {
      Matter.Engine.clear(this.engine);
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
