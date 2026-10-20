import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hlsProxyDevMiddleware } from '../src/worker/devProxyMiddleware';
import { proxyUrl } from '../src/proxy/url';

const MANIFEST = ['#EXTM3U', '#EXTINF:4.0,', 'segments/001.ts?sig=2', '#EXT-X-ENDLIST'].join('\n');

type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

let dev: Server;
let devOrigin: string;
// A real entry from public/data/proxy-origins.json, so the allowlist check
// exercises the same code path production uses. A loopback stub server would
// be rejected by the handler's private-network guard.
let allowedOrigin: string;
let allowedManifestUrl: string;

/** Registers the plugin's middleware and returns it standalone. */
function registerMiddleware(fetcher?: (request: Request) => Promise<Response>): Middleware {
  const plugin = hlsProxyDevMiddleware(fetcher ? { fetcher } : {});
  let registered: Middleware | undefined;
  const configureServer = plugin.configureServer as (server: unknown) => void;
  configureServer.call(null, {
    middlewares: { use: (handler: Middleware) => void (registered = handler) },
  });
  if (!registered) throw new Error('configureServer did not register a middleware');
  return registered;
}

function serve(middleware: Middleware): Promise<{ server: Server; origin: string }> {
  const server = createServer((req, res) => {
    middleware(req, res, () => res.writeHead(404, { 'content-type': 'text/html' }).end('<!doctype html>'));
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}` });
    });
  });
}

beforeEach(async () => {
  const origins: string[] = JSON.parse(await readFile('public/data/proxy-origins.json', 'utf8'));
  allowedOrigin = origins[0];
  allowedManifestUrl = `${allowedOrigin}/hls/68/index.m3u8`;
});

afterEach(async () => {
  await new Promise<void>(resolve => dev.close(() => resolve()));
});

async function start(fetcher?: (request: Request) => Promise<Response>): Promise<void> {
  const started = await serve(registerMiddleware(fetcher));
  dev = started.server;
  devOrigin = started.origin;
}

describe('Vite dev proxy middleware', () => {
  it('answers the proxy route instead of the SPA fallback', async () => {
    const fetcher = vi.fn(async () => new Response(MANIFEST, {
      headers: { 'content-type': 'application/vnd.apple.mpegurl' },
    }));
    await start(fetcher);

    const response = await fetch(`${devOrigin}/proxy?url=${encodeURIComponent(allowedManifestUrl)}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('mpegurl');
    expect(response.headers.get('access-control-allow-origin')).toBe(devOrigin);
    expect(await response.text()).not.toContain('<!doctype html>');
    expect(fetcher).toHaveBeenCalled();
  });

  it('rewrites manifest segments back through the proxy route', async () => {
    await start(async () => new Response(MANIFEST, {
      headers: { 'content-type': 'application/vnd.apple.mpegurl' },
    }));

    const body = await (await fetch(`${devOrigin}/proxy?url=${encodeURIComponent(allowedManifestUrl)}`)).text();

    expect(body).toContain(proxyUrl(`${allowedOrigin}/hls/68/segments/001.ts?sig=2`));
  });

  it('passes non-proxy paths through to the normal handler', async () => {
    await start();

    const response = await fetch(`${devOrigin}/`);

    expect(response.status).toBe(404);
    expect(await response.text()).toContain('<!doctype html>');
  });

  it('rejects upstream hosts outside the generated allowlist', async () => {
    await start();

    const response = await fetch(`${devOrigin}/proxy?url=${encodeURIComponent('http://attacker.example.test/secret')}`);

    expect(response.status).toBe(403);
  });

  it('rejects loopback upstreams the way production does', async () => {
    await start();

    const response = await fetch(`${devOrigin}/proxy?url=${encodeURIComponent('http://127.0.0.1:8080/admin')}`);

    expect(response.status).toBe(403);
  });
});