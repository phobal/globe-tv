import { describe, expect, it, vi } from 'vitest';
import { createHlsProxyHandler, proxyUrl, rewriteHlsManifest } from '../src/worker/hlsProxy';

describe('HLS proxy', () => {
  it('rewrites relative and absolute playlist resources through the same proxy', () => {
    const manifest = [
      '#EXTM3U',
      '#EXT-X-KEY:METHOD=AES-128,URI="keys/live.key?token=a%2Fb"',
      '#EXT-X-MAP:URI="https://cdn.example.test/live/init.mp4?sig=1"',
      '#EXTINF:4.0,',
      'segments/001.ts?sig=2',
      '#EXT-X-ENDLIST',
    ].join('\n');

    const result = rewriteHlsManifest(manifest, 'https://origin.example.test/path/index.m3u8?session=abc');

    expect(result).toContain(`URI="${proxyUrl('https://origin.example.test/path/keys/live.key?token=a%2Fb')}"`);
    expect(result).toContain(`URI="${proxyUrl('https://cdn.example.test/live/init.mp4?sig=1')}"`);
    expect(result).toContain(proxyUrl('https://origin.example.test/path/segments/001.ts?sig=2'));
  });

  it('rejects URLs outside the configured origin allowlist before fetching', async () => {
    const fetcher = vi.fn();
    const handler = createHlsProxyHandler({ allowedOrigins: ['https://origin.example.test'], fetcher });

    const response = await handler(new Request(`https://tv.example.test/proxy?url=${encodeURIComponent('https://attacker.test/secret')}`));

    expect(response.status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not allow arbitrary ports on an otherwise approved host', async () => {
    const fetcher = vi.fn(async () => new Response('unexpectedly proxied'));
    const handler = createHlsProxyHandler({ allowedOrigins: ['https://origin.example.test'], fetcher });

    const response = await handler(new Request(`https://tv.example.test/proxy?url=${encodeURIComponent('https://origin.example.test:8443/admin')}`));

    expect(response.status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('blocks loopback and private network origins even when configured', async () => {
    const fetcher = vi.fn();
    const handler = createHlsProxyHandler({ allowedOrigins: ['http://127.0.0.1', 'http://192.168.1.2'], fetcher });
    const loopback = await handler(new Request(`https://tv.example.test/proxy?url=${encodeURIComponent('http://127.0.0.1/admin')}`));
    const privateNetwork = await handler(new Request(`https://tv.example.test/proxy?url=${encodeURIComponent('http://192.168.1.2/admin')}`));

    expect(loopback.status).toBe(403);
    expect(privateNetwork.status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rewrites a fetched HLS manifest and adds same-origin CORS headers', async () => {
    const fetcher = vi.fn(async () => new Response('#EXTM3U\nseg.ts', {
      headers: { 'Content-Type': 'application/vnd.apple.mpegurl', 'Content-Length': '14', 'Accept-Ranges': 'bytes' },
    }));
    const handler = createHlsProxyHandler({ allowedOrigins: ['https://origin.example.test'], fetcher });
    const upstream = 'https://origin.example.test/live/index.m3u8';

    const response = await handler(new Request(`https://tv.example.test/proxy?url=${encodeURIComponent(upstream)}`));

    expect(response.status).toBe(200);
    expect(await response.text()).toContain(proxyUrl('https://origin.example.test/live/seg.ts'));
    expect(response.headers.get('access-control-allow-origin')).toBe('https://tv.example.test');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-length')).toBeNull();
    expect(response.headers.get('accept-ranges')).toBeNull();
  });

  it('fetches IP-based HLS sources through a hostname while preserving the source URL in playlists', async () => {
    const fetcher = vi.fn(async (_request: Request) => new Response('#EXTM3U\nseg.ts', {
      headers: { 'Content-Type': 'application/vnd.apple.mpegurl' },
    }));
    const handler = createHlsProxyHandler({ allowedOrigins: ['http://61.138.99.166:10089'], fetcher });
    const upstream = 'http://61.138.99.166:10089/hls/85/index.m3u8';

    const response = await handler(new Request(`https://tv.example.test/proxy?url=${encodeURIComponent(upstream)}`));

    const fetchedRequest = fetcher.mock.calls[0]![0];
    expect(new URL(fetchedRequest.url).hostname).toBe('61-138-99-166.sslip.io');
    expect(new URL(fetchedRequest.url).port).toBe('10089');
    expect(await response.text()).toContain(proxyUrl('http://61.138.99.166:10089/hls/85/seg.ts'));
  });

  it('keeps IP-based redirects within the allowlist and resolves playlist paths from the original origin', async () => {
    const fetcher = vi.fn(async (request: Request) => {
      if (new URL(request.url).pathname.endsWith('/index.m3u8')) return new Response(null, { status: 302, headers: { Location: '/hls/85/redirected.m3u8' } });
      return new Response('#EXTM3U\nseg.ts', { headers: { 'Content-Type': 'application/vnd.apple.mpegurl' } });
    });
    const handler = createHlsProxyHandler({ allowedOrigins: ['http://61.138.99.166:10089'], fetcher });
    const upstream = 'http://61.138.99.166:10089/hls/85/index.m3u8';

    const response = await handler(new Request(`https://tv.example.test/proxy?url=${encodeURIComponent(upstream)}`));

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1]![0].url).toBe('http://61-138-99-166.sslip.io:10089/hls/85/redirected.m3u8');
    expect(await response.text()).toContain(proxyUrl('http://61.138.99.166:10089/hls/85/seg.ts'));
  });

  it('forwards byte ranges and preserves partial content responses', async () => {
    const fetcher = vi.fn(async (_request: Request) => new Response('bytes', {
      status: 206,
      headers: { 'Content-Type': 'video/mp2t', 'Content-Range': 'bytes 0-4/10', 'Accept-Ranges': 'bytes' },
    }));
    const handler = createHlsProxyHandler({ allowedOrigins: ['https://origin.example.test'], fetcher });
    const upstream = 'https://origin.example.test/live/seg.ts';

    const response = await handler(new Request(`https://tv.example.test/proxy?url=${encodeURIComponent(upstream)}`, {
      headers: { Range: 'bytes=0-4' },
    }));

    expect(fetcher.mock.calls[0][0].headers.get('range')).toBe('bytes=0-4');
    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 0-4/10');
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(await response.text()).toBe('bytes');
  });

  it('does not follow redirects to hosts outside the allowlist', async () => {
    const fetcher = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { Location: 'http://127.0.0.1/admin' },
    }));
    const handler = createHlsProxyHandler({ allowedOrigins: ['https://origin.example.test'], fetcher });

    const response = await handler(new Request(`https://tv.example.test/proxy?url=${encodeURIComponent('https://origin.example.test/live/index.m3u8')}`));

    expect(response.status).toBe(403);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('allows same-origin HLS preflight but rejects cross-origin browser use', async () => {
    const handler = createHlsProxyHandler({ allowedOrigins: ['https://origin.example.test'], fetcher: vi.fn() });

    const preflight = await handler(new Request('https://tv.example.test/proxy', {
      method: 'OPTIONS',
      headers: { Origin: 'https://tv.example.test' },
    }));
    const crossOrigin = await handler(new Request(`https://tv.example.test/proxy?url=${encodeURIComponent('https://origin.example.test/live/index.m3u8')}`, {
      headers: { Origin: 'https://other.example.test' },
    }));

    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe('https://tv.example.test');
    expect(crossOrigin.status).toBe(403);
  });
});
