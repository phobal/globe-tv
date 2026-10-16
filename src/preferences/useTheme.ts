import { useEffect, useState } from 'react';
import type { ThemePreference } from './storage';
import { applyTheme, resolveThemeMode, type ThemeMode } from './theme';

export interface ThemeState {
  mode: ThemeMode;
}

const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)';

export function useThemeEffect(preference: ThemePreference): ThemeState {
  const [mode, setMode] = useState<ThemeMode>(() => resolveThemeMode(preference));

  useEffect(() => {
    const next = applyTheme(preference);
    setMode(next);
  }, [preference]);

  useEffect(() => {
    if (preference !== 'auto' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(COLOR_SCHEME_QUERY);
    const handler = () => {
      const next: ThemeMode = media.matches ? 'dark' : 'light';
      setMode(next);
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', next);
      }
    };
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handler);
      return () => media.removeEventListener('change', handler);
    }
    media.addListener(handler);
    return () => media.removeListener(handler);
  }, [preference]);

  return { mode };
}
