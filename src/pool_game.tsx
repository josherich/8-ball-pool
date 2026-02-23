import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent
} from 'react';
import { Camera, Users, Copy, Check, RotateCw, ChevronLeft, ChevronRight } from 'lucide-react';
import RAPIER from '@dimforge/rapier3d-compat';
import PoolGameEngine from './pool_engine';

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 700;

const getViewport = () => {
  if (typeof window === 'undefined') {
    return { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };
  }
  return { width: window.innerWidth, height: window.innerHeight };
};

const PoolGame = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameMode, setGameMode] = useState<string | null>(null); // 'local' or 'online'
  const [connectionState, setConnectionState] = useState('idle'); // idle, hosting, joining, connected
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [rapierLoaded, setRapierLoaded] = useState(false);
  const [gameOver, setGameOver] = useState<{ winner: number; reason: string } | null>(null);
  const [viewport, setViewport] = useState(getViewport);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [shotPowerPercent, setShotPowerPercent] = useState(0);
  const [shotSliderActive, setShotSliderActive] = useState(false);
  const gameRef = useRef<PoolGameEngine | null>(null);
  const joinCodeRef = useRef<string | null>(null);
  const aimHoldIntervalRef = useRef<number | null>(null);

  // Initialize Rapier WASM
  useEffect(() => {
    RAPIER.init().then(() => {
      setRapierLoaded(true);
    });
  }, []);

  useEffect(() => {
    const updateViewport = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setViewport({ width, height });
      const touchCapable = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
      setIsMobileDevice(touchCapable && Math.min(width, height) <= 1366);
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => {
      window.removeEventListener('resize', updateViewport);
    };
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !gameMode || !rapierLoaded) return;

    gameRef.current = new PoolGameEngine(canvasRef.current, gameMode, RAPIER, {
      onConnectionStateChange: setConnectionState,
      onRoomCodeGenerated: setRoomCode,
      joinCode: joinCodeRef.current,
      onGameOver: setGameOver,
      mobileTouchControlsEnabled: isMobileDevice
    });
    gameRef.current.init();

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy();
      }
    };
  }, [gameMode, rapierLoaded, isMobileDevice]);

  const stopAimHold = () => {
    if (aimHoldIntervalRef.current !== null) {
      window.clearInterval(aimHoldIntervalRef.current);
      aimHoldIntervalRef.current = null;
    }
  };

  const cancelShotSlider = () => {
    if (!shotSliderActive) return;
    gameRef.current?.cancelPowerShot();
    setShotSliderActive(false);
    setShotPowerPercent(0);
  };

  useEffect(() => {
    return () => {
      stopAimHold();
    };
  }, []);

  const isLandscape = viewport.width >= viewport.height;
  const mobileGameplay = Boolean(gameMode) && isMobileDevice;
  const mobileLandscapeGameplay = mobileGameplay && isLandscape;
  const showRotatePrompt = mobileGameplay && !isLandscape;

  useEffect(() => {
    if (mobileLandscapeGameplay) return;
    stopAimHold();
    cancelShotSlider();
  }, [mobileLandscapeGameplay, shotSliderActive]);

  const aspectRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
  const desktopAvailableWidth = Math.max(280, viewport.width - 24);
  const desktopAvailableHeight = Math.max(200, viewport.height - 220);
  let canvasDisplayWidth = Math.min(CANVAS_WIDTH, desktopAvailableWidth);
  let canvasDisplayHeight = canvasDisplayWidth / aspectRatio;
  if (canvasDisplayHeight > desktopAvailableHeight) {
    canvasDisplayHeight = desktopAvailableHeight;
    canvasDisplayWidth = canvasDisplayHeight * aspectRatio;
  }
  let mobileCanvasDisplayWidth = viewport.width;
  let mobileCanvasDisplayHeight = mobileCanvasDisplayWidth / aspectRatio;
  if (mobileCanvasDisplayHeight > viewport.height) {
    mobileCanvasDisplayHeight = viewport.height;
    mobileCanvasDisplayWidth = mobileCanvasDisplayHeight * aspectRatio;
  }

  const handleHost = () => {
    setGameMode('online');
    setConnectionState('hosting');
  };

  const handleJoin = () => {
    if (!inputCode.trim()) return;
    joinCodeRef.current = inputCode.trim();
    setGameMode('online');
    setConnectionState('joining');
  };

  const handlePlayAgain = () => {
    setGameOver(null);
    const currentMode = gameMode;
    setGameMode(null);
    joinCodeRef.current = null;
    setTimeout(() => {
      setGameMode(currentMode);
      if (currentMode === 'online') {
        setConnectionState('hosting');
      }
    }, 0);
  };

  const handleBackToMenu = () => {
    stopAimHold();
    gameRef.current?.cancelPowerShot();
    setGameOver(null);
    setGameMode(null);
    setConnectionState('idle');
    setRoomCode('');
    setInputCode('');
    setShotPowerPercent(0);
    setShotSliderActive(false);
    joinCodeRef.current = null;
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAimHoldStart = (direction: -1 | 1) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    stopAimHold();
    gameRef.current?.adjustAim(direction * 0.1);
    aimHoldIntervalRef.current = window.setInterval(() => {
      gameRef.current?.adjustAim(direction * 0.05);
    }, 32);
  };

  const handleAimHoldEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    stopAimHold();
  };

  const handleShotSliderPointerDown = (event: ReactPointerEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const initialPercent = Number(event.currentTarget.value);
    const started = gameRef.current?.beginTouchPowerControl() ?? false;
    if (!started) return;
    setShotSliderActive(true);
    setShotPowerPercent(initialPercent);
    gameRef.current?.setTouchPowerRatio(initialPercent / 100);
  };

  const handleShotSliderChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextPercent = Number(event.target.value);
    setShotPowerPercent(nextPercent);
    if (!shotSliderActive) return;
    gameRef.current?.setTouchPowerRatio(nextPercent / 100);
  };

  const handleShotSliderPointerUp = (event: ReactPointerEvent<HTMLInputElement>) => {
    event.preventDefault();
    if (!shotSliderActive) return;
    const finalPercent = Number(event.currentTarget.value);
    gameRef.current?.setTouchPowerRatio(finalPercent / 100);
    gameRef.current?.shootFromTouchControl();
    setShotSliderActive(false);
    setShotPowerPercent(0);
  };

  const handleShotSliderPointerCancel = (event: ReactPointerEvent<HTMLInputElement>) => {
    event.preventDefault();
    cancelShotSlider();
  };

  if (!gameMode) {
    return (
      <div style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'hsl(25, 15%, 8%)',
        padding: '1rem'
      }}>
        <div style={{ textAlign: 'center', width: '100%', maxWidth: '28rem' }}>
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎱</div>
            <h1 style={{
              fontSize: isMobileDevice ? '2.2rem' : '3rem',
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
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
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

  if (showRotatePrompt) {
    return (
      <div style={{
        width: '100%',
        height: '100dvh',
        background: 'hsl(25, 15%, 8%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}>
        <div style={{
          maxWidth: '22rem',
          textAlign: 'center',
          color: '#e5e7eb',
          background: 'hsl(25, 25%, 13%)',
          border: '1px solid hsl(25, 30%, 24%)',
          borderRadius: '0.75rem',
          padding: '1.25rem'
        }}>
          <RotateCw size={30} style={{ marginBottom: '0.5rem', color: 'hsl(45, 80%, 65%)' }} />
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'hsl(45, 80%, 65%)' }}>
            Rotate to Landscape
          </h2>
          <p style={{ color: '#d1d5db' }}>
            Landscape is required for full-screen mobile play with touch aim and shot controls.
          </p>
        </div>
      </div>
    );
  }

  if (mobileLandscapeGameplay) {
    return (
      <div style={{
        width: '100%',
        height: '100dvh',
        background: 'hsl(25, 15%, 8%)'
      }}>
        <div style={{
          position: 'relative',
          width: '100%',
          height: '100%'
        }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: `${mobileCanvasDisplayWidth}px`,
              height: `${mobileCanvasDisplayHeight}px`,
              display: 'block',
              border: 'none',
              borderRadius: 0,
              touchAction: 'none'
            }}
          />

          {connectionState === 'hosting' && roomCode && (
            <div style={{
              position: 'absolute',
              top: '0.6rem',
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '0.4rem 0.6rem',
              borderRadius: '0.4rem',
              background: 'rgba(20, 20, 20, 0.55)',
              color: '#e5e7eb',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}>
              <span style={{ fontSize: '0.85rem' }}>Room</span>
              <code style={{ color: 'hsl(45, 80%, 65%)', fontWeight: 700 }}>{roomCode}</code>
              <button
                onClick={copyRoomCode}
                style={{
                  padding: '0.25rem',
                  borderRadius: '0.25rem',
                  color: 'hsl(45, 80%, 65%)',
                  background: 'transparent'
                }}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>
          )}

          {connectionState === 'joining' && (
            <div style={{
              position: 'absolute',
              top: '0.6rem',
              right: '0.8rem',
              padding: '0.35rem 0.6rem',
              borderRadius: '0.35rem',
              background: 'rgba(20, 20, 20, 0.5)',
              color: '#d1d5db',
              fontSize: '0.8rem'
            }}>
              Connecting...
            </div>
          )}

          <div style={{
            position: 'absolute',
            left: '0.5rem',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.55rem',
            background: 'rgba(20, 20, 20, 0.42)',
            borderRadius: '0.6rem',
            padding: '0.55rem 0.35rem'
          }}>
            <div style={{ color: '#f9fafb', fontSize: '0.72rem', fontWeight: 600 }}>SHOOT</div>
            <input
              type="range"
              min={0}
              max={100}
              value={shotPowerPercent}
              onChange={handleShotSliderChange}
              onPointerDown={handleShotSliderPointerDown}
              onPointerUp={handleShotSliderPointerUp}
              onPointerCancel={handleShotSliderPointerCancel}
              style={{
                WebkitAppearance: 'slider-vertical',
                writingMode: 'vertical-lr',
                direction: 'rtl',
                width: '2.6rem',
                height: '48vh',
                accentColor: 'hsl(45, 80%, 65%)',
                touchAction: 'none'
              }}
            />
            <div style={{ color: '#f9fafb', fontSize: '0.72rem' }}>{shotPowerPercent}%</div>
          </div>

          <div style={{
            position: 'absolute',
            right: '0.5rem',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <button
              onPointerDown={handleAimHoldStart(-1)}
              onPointerUp={handleAimHoldEnd}
              onPointerLeave={handleAimHoldEnd}
              onPointerCancel={handleAimHoldEnd}
              style={{
                width: '4.3rem',
                height: '3.1rem',
                borderRadius: '0.55rem',
                background: 'rgba(20, 20, 20, 0.58)',
                color: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.2rem',
                fontWeight: 700,
                touchAction: 'none'
              }}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onPointerDown={handleAimHoldStart(1)}
              onPointerUp={handleAimHoldEnd}
              onPointerLeave={handleAimHoldEnd}
              onPointerCancel={handleAimHoldEnd}
              style={{
                width: '4.3rem',
                height: '3.1rem',
                borderRadius: '0.55rem',
                background: 'rgba(20, 20, 20, 0.58)',
                color: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.2rem',
                fontWeight: 700,
                touchAction: 'none'
              }}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {gameOver && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.75)'
            }}>
              <div style={{ textAlign: 'center', padding: '1rem' }}>
                <h2 style={{
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  color: 'hsl(45, 80%, 65%)',
                  marginBottom: '0.5rem'
                }}>
                  Game Over
                </h2>
                <p style={{
                  fontSize: '1.2rem',
                  color: 'white',
                  marginBottom: '0.5rem'
                }}>
                  {gameMode === 'online'
                    ? (gameOver.winner === (gameRef.current?.isHost ? 1 : 2)
                      ? 'You Win!'
                      : 'You Lose!')
                    : `Player ${gameOver.winner} Wins!`}
                </p>
                <p style={{
                  fontSize: '1rem',
                  color: '#9ca3af',
                  marginBottom: '1.1rem'
                }}>
                  {gameOver.reason}
                </p>
                <div style={{
                  display: 'flex',
                  gap: '0.6rem',
                  justifyContent: 'center',
                  flexWrap: 'wrap'
                }}>
                  <button
                    onClick={handlePlayAgain}
                    style={{
                      padding: '0.75rem 1.4rem',
                      borderRadius: '0.5rem',
                      fontWeight: '600',
                      fontSize: '1.05rem',
                      background: 'hsl(145, 50%, 28%)',
                      color: 'white',
                      border: 'none'
                    }}
                  >
                    Play Again
                  </button>
                  <button
                    onClick={handleBackToMenu}
                    style={{
                      padding: '0.75rem 1.4rem',
                      borderRadius: '0.5rem',
                      fontWeight: '600',
                      fontSize: '1.05rem',
                      background: 'hsl(25, 45%, 35%)',
                      color: 'white',
                      border: 'none'
                    }}
                  >
                    Main Menu
                  </button>
                </div>
              </div>
            </div>
          )}
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
      gap: '0.75rem',
      padding: '0.75rem',
      background: 'hsl(25, 15%, 8%)'
    }}>
      {connectionState === 'hosting' && roomCode && (
        <div style={{
          padding: '0.75rem 1rem',
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
        <div style={{ color: '#d1d5db' }}>
          Connecting to game...
        </div>
      )}

      {connectionState === 'connected' && (
        <div style={{
          padding: '0.5rem 1rem',
          borderRadius: '0.25rem',
          background: 'hsl(145, 50%, 28%)',
          color: 'white'
        }}>
          Connected! Game ready to start
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          style={{
            width: `${canvasDisplayWidth}px`,
            height: `${canvasDisplayHeight}px`,
            borderRadius: '0.5rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            border: '8px solid hsl(25, 35%, 25%)',
            display: 'block'
          }}
        />

        {gameOver && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.75)',
            borderRadius: '0.5rem'
          }}>
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <h2 style={{
                fontSize: '3rem',
                fontWeight: 'bold',
                color: 'hsl(45, 80%, 65%)',
                marginBottom: '0.5rem'
              }}>
                Game Over
              </h2>
              <p style={{
                fontSize: '1.5rem',
                color: 'white',
                marginBottom: '0.5rem'
              }}>
                {gameMode === 'online'
                  ? (gameOver.winner === (gameRef.current?.isHost ? 1 : 2)
                    ? 'You Win!'
                    : 'You Lose!')
                  : `Player ${gameOver.winner} Wins!`}
              </p>
              <p style={{
                fontSize: '1rem',
                color: '#9ca3af',
                marginBottom: '1.2rem'
              }}>
                {gameOver.reason}
              </p>
              <div style={{
                display: 'flex',
                gap: '0.6rem',
                justifyContent: 'center',
                flexWrap: 'wrap'
              }}>
                <button
                  onClick={handlePlayAgain}
                  style={{
                    padding: '0.75rem 1.4rem',
                    borderRadius: '0.5rem',
                    fontWeight: '600',
                    fontSize: '1.05rem',
                    background: 'hsl(145, 50%, 28%)',
                    color: 'white',
                    border: 'none'
                  }}
                >
                  Play Again
                </button>
                <button
                  onClick={handleBackToMenu}
                  style={{
                    padding: '0.75rem 1.4rem',
                    borderRadius: '0.5rem',
                    fontWeight: '600',
                    fontSize: '1.05rem',
                    background: 'hsl(25, 45%, 35%)',
                    color: 'white',
                    border: 'none'
                  }}
                >
                  Main Menu
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{
        color: '#9ca3af',
        fontSize: '0.875rem'
      }}>
        {gameMode === 'local' ? 'Local 2-Player Mode' : 'Online Multiplayer Mode'}
      </div>
    </div>
  );
};

export default PoolGame;
