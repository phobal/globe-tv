import type { CountrySummary } from '../data/types';

export const LABEL_CHANNEL_THRESHOLD = 5;

export function stickyCountries(countries: CountrySummary[], threshold: number): Set<string> {
  return new Set(
    countries
      .filter(item => item.channelCount >= threshold)
      .map(item => item.code)
  );
}
