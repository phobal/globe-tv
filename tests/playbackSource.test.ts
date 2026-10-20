import { describe, expect, it } from 'vitest';
import { resolvePlaybackUrl } from '../src/player/playbackSource';

describe('playback source URL', () => {
  it('uses the same-origin proxy by default', () => {
    expect(resolvePlaybackUrl('http://61.138.99.166:10089/hls/68/index.m3u8', {}))
      .toBe('/proxy?url=http%3A%2F%2F61.138.99.166%3A10089%2Fhls%2F68%2Findex.m3u8');
  });

  it('uses the proxy during Vite development too', () => {
    expect(resolvePlaybackUrl('https://origin.example.test/live.m3u8', { proxy: undefined }))
      .toBe('/proxy?url=https%3A%2F%2Forigin.example.test%2Flive.m3u8');
  });

  it('can opt out for static hosts without a Worker proxy route', () => {
    expect(resolvePlaybackUrl('https://origin.example.test/live.m3u8', { proxy: 'false' }))
      .toBe('https://origin.example.test/live.m3u8');
  });
});