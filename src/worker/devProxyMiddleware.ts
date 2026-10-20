import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { createHlsProxyHandler } from './hlsProxy.ts';

const PROXY_PATH = '/proxy';
const ORIGINS_FILE = 'public/data/proxy-origins.json';

let allowedOriginsPromise: Promise<string[]> | undefined;

// Mirrors the Worker loader in ./index.ts so local dev rejects the same inputs
// and surfaces the same failure mode.
async function loadAllowedOrigins(): Promise<string[]> {
  allowedOriginsPromise ??= readFile(ORIGINS_FILE, 'utf8')
    .then(contents => {
      const hosts: unknown = JSON.parse(contents);
      if (!Array.isArray(hosts) || hosts.some(origin => typeof origin !== 'string')) throw new Error('代理来源列表格式无效');
      return hosts as string[];
    })
    .catch(error => {
      allowedOriginsPromise = undefined;
      throw error;
    });
  return allowedOriginsPromise;
}

export function toWebRequest(req: IncomingMessage, origin: string): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  return new Request(new URL(req.url ?? '/', origin), {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    // Node's fetch cannot follow redirects on its own here; the handler
    // inspects them itself to re-validate every hop against the allowlist.
    redirect: 'manual',
    duplex: hasBody ? 'half' : undefined,
  } as RequestInit);
}

export async function sendWebResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  res.statusMessage = response.statusText;
  response.headers.forEach((value, name) => res.setHeader(name, value));
  if (!response.body) {
    res.end();
    return;
  }
  // Buffer rather than stream: HLS manifests and segments are small, and this
  // avoids leaking a ReadableStream backpressure mismatch into Vite's server.
  res.end(Buffer.from(await response.arrayBuffer()));
}

export interface HlsProxyDevMiddlewareOptions {
  /** Overrides the upstream fetch. Only used by tests. */
  fetcher?: (request: Request) => Promise<Response>;
}

export function hlsProxyDevMiddleware(options: HlsProxyDevMiddlewareOptions = {}): Plugin {
  return {
    name: 'hls-proxy-dev-middleware',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const origin = `http://${req.headers.host ?? 'localhost'}`;
        const { pathname } = new URL(req.url ?? '/', origin);
        if (pathname !== PROXY_PATH) {
          next();
          return;
        }

        void (async () => {
          try {
            const allowedOrigins = await loadAllowedOrigins();
            const handler = createHlsProxyHandler({ allowedOrigins, fetcher: options.fetcher });
            await sendWebResponse(res, await handler(toWebRequest(req, origin)));
          } catch {
            // Same status and body the Worker returns when its allowlist is
            // unavailable, so a missing local file is not mistaken for success.
            if (!res.headersSent) {
              res.statusCode = 503;
              res.end('Proxy configuration unavailable');
            }
          }
        })();
      });
    },
  };
}