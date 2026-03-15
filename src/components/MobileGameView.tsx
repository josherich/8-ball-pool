import { type Ref, type RefObject, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Copy, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import type PoolGameEngine from '../pool_engine';
import GameOverOverlay from './GameOverOverlay';

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
  onAimHoldStart: (direction: -1 | 1) => (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onAimHoldEnd: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  gameOver: { winner: number; reason: string } | null;
  gameMode: string | null;
  gameRef: RefObject<PoolGameEngine | null>;
  onPlayAgain: () => void;
  onBackToMenu: () => void;
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
  onAimHoldStart,
  onAimHoldEnd,
  gameOver,
  gameMode,
  gameRef,
  onPlayAgain,
  onBackToMenu
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
          padding: '0.55rem 0.35rem'
        }}>
          <div style={{ color: '#f9fafb', fontSize: '0.72rem', fontWeight: 600 }}>SHOOT</div>
          <input
            type="range"
            min={0}
            max={100}
            value={shotPowerPercent}
            onChange={onShotSliderChange}
            onPointerDown={onShotSliderPointerDown}
            onPointerUp={onShotSliderPointerUp}
            onPointerCancel={onShotSliderPointerCancel}
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
          {([-1, 1] as const).map(dir => (
            <button
              key={dir}
              onPointerDown={onAimHoldStart(dir)}
              onPointerUp={onAimHoldEnd}
              onPointerLeave={onAimHoldEnd}
              onPointerCancel={onAimHoldEnd}
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
              {dir === -1 ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
            </button>
          ))}
        </div>

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
