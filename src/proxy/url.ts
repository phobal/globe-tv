export function proxyUrl(upstreamUrl: string): string {
  return `/proxy?url=${encodeURIComponent(upstreamUrl)}`;
}
