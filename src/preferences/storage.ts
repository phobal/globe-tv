const KEY = 'globe-tv:preferences:v1';
export type ThemePreference = 'auto' | 'light' | 'dark';
export const THEME_VALUES: readonly ThemePreference[] = ['auto', 'light', 'dark'] as const;

export interface Preferences {
  favorites: string[];
  recent: string[];
  countryCode?: string;
  theme: ThemePreference;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_VALUES as readonly string[]).includes(value);
}

function defaultPreferences(): Preferences {
  return { favorites: [], recent: [], theme: 'auto' };
}

export function readPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultPreferences();
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') throw new Error('bad preferences');
    const value = data as Record<string, unknown>;
    if (!isStringArray(value.favorites) || !isStringArray(value.recent)) {
      throw new Error('bad preferences');
    }
    const countryCode = typeof value.countryCode === 'string' ? value.countryCode : undefined;
    const theme: ThemePreference = isThemePreference(value.theme) ? value.theme : 'auto';
    return {
      favorites: value.favorites,
      recent: value.recent.slice(0, 30),
      countryCode,
      theme,
    };
  } catch {
    localStorage.removeItem(KEY);
    return defaultPreferences();
  }
}

export function savePreferences(value: Preferences): void {
  try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

export function markRecentlyPlayed(value: Preferences, id: string): Preferences {
  return { ...value, recent: [id, ...value.recent.filter(item => item !== id)].slice(0, 30) };
}
