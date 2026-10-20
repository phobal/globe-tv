import { proxyUrl } from '../proxy/url';

export function resolvePlaybackUrl(sourceUrl: string, options: { proxy?: string }): string {
  return options.proxy !== 'false' ? proxyUrl(sourceUrl) : sourceUrl;
}