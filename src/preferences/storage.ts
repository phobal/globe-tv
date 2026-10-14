const KEY = 'globe-tv:preferences:v1';
export interface Preferences { favorites: string[]; recent: string[] }

export function readPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { favorites: [], recent: [] };
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') throw new Error('bad preferences');
    const value = data as Record<string, unknown>;
    if (!Array.isArray(value.favorites) || !Array.isArray(value.recent) ||
      !value.favorites.every(item => typeof item === 'string') ||
      !value.recent.every(item => typeof item === 'string')) throw new Error('bad preferences');
    return { favorites: value.favorites, recent: value.recent.slice(0, 30) };
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
