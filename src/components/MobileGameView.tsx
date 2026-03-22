import { type Ref, type RefObject, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Copy, Check } from 'lucide-react';
import type PoolGameEngine from '../pool_engine';
import GameOverOverlay from './GameOverOverlay';
import PauseOverlay from './PauseOverlay';

type MobileGameViewProps = {
  canvasRef: Ref<HTMLCanvasElement>;
  canvasWidth: number;
  canvasHeight: number;
  displayWidth: number;
  displayHeight: number;
  connectionState: string;
  roomCode: string;
  copied: boolean;
  onCopyRoomCode: () => void;
  shotPowerPercent: number;
  shotSliderActive: boolean;
  onShotSliderPointerDown: (e: ReactPointerEvent<HTMLInputElement>) => void;
  onShotSliderChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onShotSliderPointerUp: (e: ReactPointerEvent<HTMLInputElement>) => void;
  onShotSliderPointerCancel: (e: ReactPointerEvent<HTMLInputElement>) => void;
  gameOver: { winner: number; reason: string } | null;
  gameMode: string | null;
  gameRef: RefObject<PoolGameEngine | null>;
  onPlayAgain: () => void;
  onBackToMenu: () => void;
  paused: boolean;
  onResume: () => void;
};

const MobileGameView = ({
  canvasRef,
  canvasWidth,
  canvasHeight,
  displayWidth,
  displayHeight,
  connectionState,
  roomCode,
  copied,
  onCopyRoomCode,
  shotPowerPercent,
  onShotSliderPointerDown,
  onShotSliderChange,
  onShotSliderPointerUp,
  onShotSliderPointerCancel,
  gameOver,
  gameMode,
  gameRef,
  onPlayAgain,
  onBackToMenu,
  paused,
  onResume
}: MobileGameViewProps) => {
  return (
    <div style={{
      width: '100%',
      height: '100dvh',
      background: 'hsl(25, 15%, 8%)'
    }}>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: `${displayWidth}px`,
            height: `${displayHeight}px`,
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
              onClick={onCopyRoomCode}
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
          padding: '0.55rem 0.5rem'
        }}>
          <div style={{ color: '#f9fafb', fontSize: '0.72rem' }}>{shotPowerPercent}%</div>
          <input
            type="range"
            min={0}
            max={100}
            value={shotPowerPercent}
            onChange={onShotSliderChange}
            onPointerDown={onShotSliderPointerDown}
            onPointerUp={onShotSliderPointerUp}
            onPointerCancel={onShotSliderPointerCancel}
            className="mobile-power-slider"
            style={{
              WebkitAppearance: 'slider-vertical',
              writingMode: 'vertical-lr',
              width: '3rem',
              height: '55vh',
              accentColor: 'hsl(45, 80%, 65%)',
              touchAction: 'none'
            }}
          />
          <div style={{ color: '#f9fafb', fontSize: '0.72rem', fontWeight: 600 }}>SHOOT</div>
        </div>

        {paused && !gameOver && (
          <PauseOverlay
            onResume={onResume}
            onExitGame={() => { onResume(); onBackToMenu(); }}
            compact
          />
        )}

        {gameOver && (
          <GameOverOverlay
            gameOver={gameOver}
            gameMode={gameMode}
            gameRef={gameRef}
            onPlayAgain={onPlayAgain}
            onBackToMenu={onBackToMenu}
            compact
          />
        )}
      </div>
    </div>
  );
};

export default MobileGameView;
