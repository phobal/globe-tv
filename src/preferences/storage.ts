const KEY = 'globe-tv:preferences:v1';
export type ThemePreference = 'auto' | 'light' | 'dark';
export const THEME_VALUES: readonly ThemePreference[] = ['auto', 'light', 'dark'] as const;

export interface Preferences {
  favorites: string[];
  recent: string[];
  countryCode?: string;
  theme: ThemePreference;
  onboardingVersion?: number;
  lastCategories?: Record<string, string>;
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
      ...(typeof value.onboardingVersion === 'number' && Number.isInteger(value.onboardingVersion) && value.onboardingVersion >= 0 ? { onboardingVersion: value.onboardingVersion } : {}),
      ...(value.lastCategories && typeof value.lastCategories === 'object' && !Array.isArray(value.lastCategories) ? { lastCategories: Object.fromEntries(Object.entries(value.lastCategories).filter(([id, category]) => /^[\w-]{1,64}$/.test(id) && typeof category === 'string' && ['central', 'local', 'sports', 'entertainment', 'kids', 'overseas', 'more'].includes(category))) } : {}),
    };
  } catch {
    try { localStorage.removeItem(KEY); } catch { /* Storage can be blocked. */ }
    return defaultPreferences();
  }
}

export function savePreferences(value: Preferences): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(value)); return true; } catch { return false; }
}

export function markRecentlyPlayed(value: Preferences, id: string): Preferences {
  return { ...value, recent: [id, ...value.recent.filter(item => item !== id)].slice(0, 30) };
}
