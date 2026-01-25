import { useEffect, useRef, useState } from 'react';
import { Camera, Users, Copy, Check } from 'lucide-react';
import RAPIER from '@dimforge/rapier3d-compat';
import PoolGameEngine from './pool_engine';

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

export default PoolGame;
