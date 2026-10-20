import { proxyUrl } from '../proxy/url';

export function resolvePlaybackUrl(sourceUrl: string, options: { production: boolean; proxy?: string }): string {
  return options.production && options.proxy !== 'false' ? proxyUrl(sourceUrl) : sourceUrl;
}
