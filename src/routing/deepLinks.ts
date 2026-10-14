export interface DeepLink { country?: string; channel?: string; invalid: boolean }

export function parseDeepLink(search: string): DeepLink {
  const params = new URLSearchParams(search);
  const country = params.get('country');
  const channel = params.get('channel');
  if (!country && !channel) return { invalid: false };
  if (!country || !/^[a-z]{2}$/i.test(country) || (channel && !/^[\w-]{1,64}$/.test(channel))) {
    return { invalid: true };
  }
  return { country: country.toLowerCase(), channel: channel ?? undefined, invalid: false };
}

export function linkTo(country: string, channel?: string): string {
  const params = new URLSearchParams({ country });
  if (channel) params.set('channel', channel);
  return `${location.pathname}?${params}`;
}
