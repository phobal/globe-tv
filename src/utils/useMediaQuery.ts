import { useEffect, useState } from 'react';

function readMatch(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(query).matches;
}

/**
 * Reactively tracks whether the given media query matches the current viewport.
 * Returns `false` during SSR and on environments without `window.matchMedia`.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => readMatch(query));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(media.matches);
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handler);
      return () => media.removeEventListener('change', handler);
    }
    media.addListener(handler);
    return () => media.removeListener(handler);
  }, [query]);

  return matches;
}
