export interface DeepLink { country?: string; category?: string; collection?: 'popular'; channel?: string; invalid: boolean }

export function parseDeepLink(search: string): DeepLink {
  const params = new URLSearchParams(search);
  const country = params.get('country');
  const category = params.get('category');
  const collection = params.get('collection');
  const channel = params.get('channel');
  if (!country && !collection && !channel && !category) return { invalid: false };
  if (category) {
    if (country || collection || !['central', 'local', 'sports', 'entertainment', 'kids', 'overseas', 'more'].includes(category) || (channel && !/^[\w-]{1,64}$/.test(channel))) return { invalid: true };
    return { category, channel: channel ?? undefined, invalid: false };
  }
  if (!country && !collection && channel && /^[\w-]{1,64}$/.test(channel)) return { channel, invalid: false };
  if (collection) {
    if (collection !== 'popular' || country || (channel && !/^[\w-]{1,64}$/.test(channel))) return { invalid: true };
    return { collection, channel: channel ?? undefined, invalid: false };
  }
  if (!country || !/^[a-z]{2}$/i.test(country) || (channel && !/^[\w-]{1,64}$/.test(channel))) {
    return { invalid: true };
  }
  return { country: country.toLowerCase(), channel: channel ?? undefined, invalid: false };
}

export function linkToCollection(collection: 'popular', channel?: string): string {
  const params = new URLSearchParams({ collection });
  if (channel) params.set('channel', channel);
  return `${location.pathname}?${params}`;
}

export function linkTo(country: string, channel?: string): string {
  const params = new URLSearchParams({ country });
  if (channel) params.set('channel', channel);
  return `${location.pathname}?${params}`;
}

export function linkToCategory(category: string, channel?: string): string {
  const params = new URLSearchParams({ category });
  if (channel) params.set('channel', channel);
  return `${location.pathname}?${params}`;
}
