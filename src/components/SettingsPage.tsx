import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { type GameSettings, type TableTheme, TABLE_THEMES } from '../settings';

type SettingsPageProps = {
  settings: GameSettings;
  onSave: (settings: GameSettings) => void;
  onBack: () => void;
};

const THEME_ORDER: TableTheme[] = ['green', 'blue', 'red', 'purple'];

const SettingsPage = ({ settings, onSave, onBack }: SettingsPageProps) => {
  const [local, setLocal] = useState<GameSettings>({ ...settings });

  const update = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    const next = { ...local, [key]: value };
    setLocal(next);
    onSave(next);
  };

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      background: local.tableTheme ? TABLE_THEMES[local.tableTheme].background : 'hsl(25, 15%, 8%)',
      padding: '1rem',
      boxSizing: 'border-box',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '30rem',
        paddingTop: '1rem',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '2rem',
        }}>
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '2.5rem',
              height: '2.5rem',
              borderRadius: '0.5rem',
              background: 'rgba(255,255,255,0.08)',
              color: 'hsl(45, 80%, 65%)',
              flexShrink: 0,
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 'bold',
            color: 'hsl(45, 80%, 65%)',
            margin: 0,
          }}>
            Settings
          </h1>
        </div>

        {/* Sound Effects Volume */}
        <Section label="Sound Effects Volume">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '1.25rem', userSelect: 'none' }}>
              {local.sfxVolume === 0 ? '🔇' : local.sfxVolume < 0.5 ? '🔉' : '🔊'}
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={local.sfxVolume}
              onChange={(e) => update('sfxVolume', Number(e.target.value))}
              style={sliderStyle}
            />
            <span style={{ color: '#9ca3af', minWidth: '2.5rem', textAlign: 'right', fontSize: '0.875rem' }}>
              {Math.round(local.sfxVolume * 100)}%
            </span>
          </div>
        </Section>

        {/* Table Theme */}
        <Section label="Table & Environment Theme">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '0.75rem',
          }}>
            {THEME_ORDER.map((themeKey) => {
              const theme = TABLE_THEMES[themeKey];
              const selected = local.tableTheme === themeKey;
              return (
                <button
                  key={themeKey}
                  onClick={() => update('tableTheme', themeKey)}
                  style={{
                    borderRadius: '0.625rem',
                    overflow: 'hidden',
                    border: selected
                      ? '2px solid hsl(45, 80%, 65%)'
                      : '2px solid rgba(255,255,255,0.1)',
                    background: 'transparent',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                    padding: 0,
                  }}
                >
                  {/* Mini table preview */}
                  <div style={{
                    background: theme.background,
                    padding: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <div style={{
                      width: '100%',
                      aspectRatio: '1.7 / 1',
                      background: theme.felt,
                      borderRadius: '0.25rem',
                      border: `2px solid ${theme.feltBorder}`,
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {/* Pocket dots */}
                      {[
                        { top: '6%', left: '4%' }, { top: '6%', left: '50%', transform: 'translateX(-50%)' }, { top: '6%', right: '4%' },
                        { bottom: '6%', left: '4%' }, { bottom: '6%', left: '50%', transform: 'translateX(-50%)' }, { bottom: '6%', right: '4%' },
                      ].map((pos, i) => (
                        <div key={i} style={{
                          position: 'absolute',
                          width: '10%',
                          aspectRatio: '1',
                          background: theme.pocketBg,
                          borderRadius: '50%',
                          border: `1px solid ${theme.pocketShadow}`,
                          ...pos,
                        }} />
                      ))}
                    </div>
                  </div>
                  {/* Label */}
                  <div style={{
                    background: theme.background,
                    padding: '0.35rem 0.5rem',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.25rem',
                  }}>
                    <span style={{ color: selected ? 'hsl(45, 80%, 65%)' : '#d1d5db', fontSize: '0.8rem', fontWeight: selected ? 600 : 400 }}>
                      {theme.name}
                    </span>
                    {selected && (
                      <span style={{ color: 'hsl(45, 80%, 65%)', fontSize: '0.75rem' }}>✓</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </Section>

        {/* Aiming Line Length */}
        <Section label="Aiming Line Length">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: '#9ca3af', fontSize: '0.75rem', minWidth: '2.5rem' }}>Short</span>
            <input
              type="range"
              min={100}
              max={500}
              step={10}
              value={local.aimLineLength}
              onChange={(e) => update('aimLineLength', Number(e.target.value))}
              style={sliderStyle}
            />
            <span style={{ color: '#9ca3af', fontSize: '0.75rem', minWidth: '2.5rem', textAlign: 'right' }}>Long</span>
          </div>
          {/* Visual preview of line length */}
          <div style={{
            marginTop: '0.75rem',
            height: '2px',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '1px',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '2px',
              width: `${((local.aimLineLength - 100) / 400) * 100}%`,
              background: 'rgba(255, 255, 255, 0.5)',
              borderRadius: '1px',
              transition: 'width 0.1s',
            }} />
          </div>
          <div style={{ textAlign: 'right', color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            {local.aimLineLength}px
          </div>
        </Section>
      </div>
    </div>
  );
};

const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{
    marginBottom: '1.75rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '0.75rem',
    padding: '1rem',
  }}>
    <h2 style={{
      fontSize: '0.8rem',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: '#6b7280',
      marginBottom: '0.875rem',
      margin: '0 0 0.875rem 0',
    }}>
      {label}
    </h2>
    {children}
  </div>
);

const sliderStyle: React.CSSProperties = {
  flex: 1,
  WebkitAppearance: 'none',
  appearance: 'none',
  height: '4px',
  borderRadius: '2px',
  background: 'rgba(255,255,255,0.15)',
  outline: 'none',
  cursor: 'pointer',
  accentColor: 'hsl(45, 80%, 65%)',
};

export default SettingsPage;
