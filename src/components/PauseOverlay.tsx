type PauseOverlayProps = {
  onResume: () => void;
  onExitGame: () => void;
  compact?: boolean;
};

const PauseOverlay = ({ onResume, onExitGame, compact = false }: PauseOverlayProps) => {
  const titleSize = compact ? '2rem' : '3rem';
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
          marginBottom
        }}>
          Game Paused
        </h2>
        <div style={{
          display: 'flex',
          gap: '0.6rem',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={onResume}
            style={{
              padding: '0.75rem 1.4rem',
              borderRadius: '0.5rem',
              fontWeight: '600',
              fontSize: '1.05rem',
              background: 'hsl(145, 50%, 28%)',
              color: 'white',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={onExitGame}
            style={{
              padding: '0.75rem 1.4rem',
              borderRadius: '0.5rem',
              fontWeight: '600',
              fontSize: '1.05rem',
              background: 'hsl(0, 50%, 40%)',
              color: 'white',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Exit Game
          </button>
        </div>
      </div>
    </div>
  );
};

export default PauseOverlay;
