const KEY = 'globe-tv:preferences:v1';
export interface Preferences {
  favorites: string[];
  recent: string[];
  countryCode?: string;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

export function readPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { favorites: [], recent: [] };
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') throw new Error('bad preferences');
    const value = data as Record<string, unknown>;
    if (!isStringArray(value.favorites) || !isStringArray(value.recent)) {
      throw new Error('bad preferences');
    }
    const countryCode = typeof value.countryCode === 'string' ? value.countryCode : undefined;
    return {
      favorites: value.favorites,
      recent: value.recent.slice(0, 30),
      countryCode,
    };
  } catch {
    localStorage.removeItem(KEY);
    return { favorites: [], recent: [] };
  }
}

export function savePreferences(value: Preferences): void {
  try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

export function markRecentlyPlayed(value: Preferences, id: string): Preferences {
  return { ...value, recent: [id, ...value.recent.filter(item => item !== id)].slice(0, 30) };
}
