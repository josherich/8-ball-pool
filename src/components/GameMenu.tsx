import { useState } from 'react';
import { Camera, Users, Settings } from 'lucide-react';

type GameMenuProps = {
  isMobileDevice: boolean;
  onStartLocal: () => void;
  onHost: () => void;
  onJoin: (code: string) => void;
  onOpenSettings: () => void;
};

const GameMenu = ({ isMobileDevice, onStartLocal, onHost, onJoin, onOpenSettings }: GameMenuProps) => {
  const [inputCode, setInputCode] = useState('');

  const handleJoin = () => {
    if (!inputCode.trim()) return;
    onJoin(inputCode.trim());
  };

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'hsl(25, 15%, 8%)',
      padding: '1rem',
      position: 'relative',
      boxSizing: 'border-box',
    }}>
      {/* Settings button - top right */}
      <button
        onClick={onOpenSettings}
        title="Settings"
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: isMobileDevice ? '2.75rem' : '2.5rem',
          height: isMobileDevice ? '2.75rem' : '2.5rem',
          borderRadius: '0.5rem',
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: 'hsl(45, 80%, 65%)',
          cursor: 'pointer',
        }}
      >
        <Settings size={isMobileDevice ? 22 : 20} />
      </button>

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
            onClick={onStartLocal}
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
            onClick={onHost}
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
};

export default GameMenu;
