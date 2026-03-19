export type TableTheme = 'green' | 'blue' | 'red' | 'purple';

export type GameSettings = {
  sfxVolume: number;       // 0–1
  tableTheme: TableTheme;
  aimLineLength: number;   // pixels, 100–500
};

export const DEFAULT_SETTINGS: GameSettings = {
  sfxVolume: 0.8,
  tableTheme: 'green',
  aimLineLength: 300,
};

export type ThemeColors = {
  name: string;
  felt: string;
  feltBorder: string;
  background: string;
  pocketShadow: string;
  pocketBg: string;
};

export const TABLE_THEMES: Record<TableTheme, ThemeColors> = {
  green: {
    name: 'Classic Green',
    felt: 'hsl(145, 50%, 28%)',
    feltBorder: 'hsl(145, 50%, 35%)',
    background: 'hsl(25, 15%, 8%)',
    pocketShadow: 'hsl(25, 35%, 15%)',
    pocketBg: 'hsl(25, 15%, 8%)',
  },
  blue: {
    name: 'Ocean Blue',
    felt: 'hsl(210, 55%, 28%)',
    feltBorder: 'hsl(210, 55%, 36%)',
    background: 'hsl(215, 25%, 7%)',
    pocketShadow: 'hsl(215, 35%, 12%)',
    pocketBg: 'hsl(215, 25%, 7%)',
  },
  red: {
    name: 'Ruby Red',
    felt: 'hsl(0, 45%, 26%)',
    feltBorder: 'hsl(0, 45%, 34%)',
    background: 'hsl(10, 15%, 7%)',
    pocketShadow: 'hsl(10, 35%, 12%)',
    pocketBg: 'hsl(10, 15%, 7%)',
  },
  purple: {
    name: 'Royal Purple',
    felt: 'hsl(270, 38%, 25%)',
    feltBorder: 'hsl(270, 38%, 33%)',
    background: 'hsl(270, 15%, 7%)',
    pocketShadow: 'hsl(270, 30%, 12%)',
    pocketBg: 'hsl(270, 15%, 7%)',
  },
};

const STORAGE_KEY = 'pool_settings';

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      sfxVolume:
        typeof parsed.sfxVolume === 'number'
          ? Math.max(0, Math.min(1, parsed.sfxVolume))
          : DEFAULT_SETTINGS.sfxVolume,
      tableTheme: (['green', 'blue', 'red', 'purple'] as TableTheme[]).includes(parsed.tableTheme)
        ? parsed.tableTheme
        : DEFAULT_SETTINGS.tableTheme,
      aimLineLength:
        typeof parsed.aimLineLength === 'number'
          ? Math.max(100, Math.min(500, parsed.aimLineLength))
          : DEFAULT_SETTINGS.aimLineLength,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}
