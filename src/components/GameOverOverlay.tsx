import type { RefObject } from 'react';
import type PoolGameEngine from '../pool_engine';

type GameOverOverlayProps = {
  gameOver: { winner: number; reason: string };
  gameMode: string | null;
  gameRef: RefObject<PoolGameEngine | null>;
  onPlayAgain: () => void;
  onBackToMenu: () => void;
  compact?: boolean;
};

const GameOverOverlay = ({
  gameOver,
  gameMode,
  gameRef,
  onPlayAgain,
  onBackToMenu,
  compact = false
}: GameOverOverlayProps) => {
  const titleSize = compact ? '2rem' : '3rem';
  const subtitleSize = compact ? '1.2rem' : '1.5rem';
  const reasonSize = '1rem';
  const marginBottom = compact ? '1.1rem' : '1.2rem';

  return (
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
      borderRadius: compact ? undefined : '0.5rem'
    }}>
      <div style={{ textAlign: 'center', padding: '1rem' }}>
        <h2 style={{
          fontSize: titleSize,
          fontWeight: 'bold',
          color: 'hsl(45, 80%, 65%)',
          marginBottom: '0.5rem'
        }}>
          Game Over
        </h2>
        <p style={{
          fontSize: subtitleSize,
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
          fontSize: reasonSize,
          color: '#9ca3af',
          marginBottom
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
            onClick={onPlayAgain}
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
            onClick={onBackToMenu}
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
  );
};

export default GameOverOverlay;
