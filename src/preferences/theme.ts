import type { ThemePreference } from './storage';

export type ThemeMode = 'light' | 'dark';

export const THEME_COLOR: Record<ThemeMode, string> = {
  light: '#f6f8fb',
  dark: '#08111f',
};

export const THEME_STORAGE_KEY = 'globe-tv:preferences:v1';

const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)';

export function resolveThemeMode(preference: ThemePreference): ThemeMode {
  if (preference === 'light' || preference === 'dark') return preference;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia(COLOR_SCHEME_QUERY).matches ? 'dark' : 'light';
  }
  return 'dark';
}

export function readStoredThemePreference(): ThemePreference | undefined {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return undefined;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return undefined;
    const value = (data as Record<string, unknown>).theme;
    return value === 'auto' || value === 'light' || value === 'dark' ? value : undefined;
  } catch {
    return undefined;
  }
}

export function applyThemeMode(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', mode);
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = THEME_COLOR[mode];
}

export function applyTheme(preference: ThemePreference): ThemeMode {
  const mode = resolveThemeMode(preference);
  applyThemeMode(mode);
  return mode;
}
