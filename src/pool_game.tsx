import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent
} from 'react';
import { Copy, Check, RotateCw } from 'lucide-react';
import RAPIER from '@dimforge/rapier3d-compat';
import PoolGameEngine from './pool_engine';
import GameMenu from './components/GameMenu';
import GameOverOverlay from './components/GameOverOverlay';
import MobileGameView from './components/MobileGameView';

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
  const [gameMode, setGameMode] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState('idle');
  const [roomCode, setRoomCode] = useState('');
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

  useEffect(() => {
    RAPIER.init().then(() => { setRapierLoaded(true); });
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
    return () => { window.removeEventListener('resize', updateViewport); };
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

    return () => { gameRef.current?.destroy(); };
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

  useEffect(() => { return () => { stopAimHold(); }; }, []);

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

  const handleJoin = (code: string) => {
    joinCodeRef.current = code;
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
      if (currentMode === 'online') setConnectionState('hosting');
    }, 0);
  };

  const handleBackToMenu = () => {
    stopAimHold();
    gameRef.current?.cancelPowerShot();
    setGameOver(null);
    setGameMode(null);
    setConnectionState('idle');
    setRoomCode('');
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

  // --- Render Branches ---

  if (!gameMode) {
    return (
      <GameMenu
        isMobileDevice={isMobileDevice}
        onStartLocal={() => setGameMode('local')}
        onHost={handleHost}
        onJoin={handleJoin}
      />
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
      <MobileGameView
        canvasRef={canvasRef}
        canvasWidth={CANVAS_WIDTH}
        canvasHeight={CANVAS_HEIGHT}
        displayWidth={mobileCanvasDisplayWidth}
        displayHeight={mobileCanvasDisplayHeight}
        connectionState={connectionState}
        roomCode={roomCode}
        copied={copied}
        onCopyRoomCode={copyRoomCode}
        shotPowerPercent={shotPowerPercent}
        shotSliderActive={shotSliderActive}
        onShotSliderPointerDown={handleShotSliderPointerDown}
        onShotSliderChange={handleShotSliderChange}
        onShotSliderPointerUp={handleShotSliderPointerUp}
        onShotSliderPointerCancel={handleShotSliderPointerCancel}
        onAimHoldStart={handleAimHoldStart}
        onAimHoldEnd={handleAimHoldEnd}
        gameOver={gameOver}
        gameMode={gameMode}
        gameRef={gameRef}
        onPlayAgain={handlePlayAgain}
        onBackToMenu={handleBackToMenu}
      />
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
        <div style={{ color: '#d1d5db' }}>Connecting to game...</div>
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
          <GameOverOverlay
            gameOver={gameOver}
            gameMode={gameMode}
            gameRef={gameRef}
            onPlayAgain={handlePlayAgain}
            onBackToMenu={handleBackToMenu}
          />
        )}
      </div>

      <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
        {gameMode === 'local' ? 'Local 2-Player Mode' : 'Online Multiplayer Mode'}
      </div>
    </div>
  );
};

export default PoolGame;
