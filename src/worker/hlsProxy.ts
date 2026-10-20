import { proxyUrl } from '../proxy/url.ts';
export { proxyUrl } from '../proxy/url.ts';

export interface HlsProxyOptions {
  allowedOrigins: readonly string[];
  fetcher?: (request: Request) => Promise<Response>;
}

const MAX_REDIRECTS = 4;
const PASSTHROUGH_HEADERS = [
  'accept-ranges',
  'cache-control',
  'content-length',
  'content-range',
  'content-type',
  'etag',
  'expires',
  'last-modified',
];

function isAllowedUrl(value: string, allowedOrigins: ReadonlySet<string>): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password || !allowedOrigins.has(url.origin.toLowerCase())) return null;
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) return null;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(hostname)) return null;
    if (/^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(hostname)) return null;
    if (/^(?:192\.0\.0\.|192\.0\.2\.|198\.18\.|198\.19\.|198\.51\.100\.|203\.0\.113\.)/.test(hostname)) return null;
    if (hostname.includes(':') && /^(?:::1|::|fc|fd|fe80:|::ffff:(?:0:)?(?:127\.|10\.|192\.168\.|169\.254\.))/i.test(hostname)) return null;
    const private172 = hostname.match(/^172\.(\d+)\./);
    if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return null;
    return url;
  } catch {
    return null;
  }
}

function workerFetchUrl(url: URL): URL {
  const match = url.hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return url;
  const alias = new URL(url);
  alias.hostname = `${match.slice(1).join('-')}.sslip.io`;
  return alias;
}

function rewriteResource(uri: string, manifestUrl: string): string {
  if (!uri || /^(data|skd):/i.test(uri)) return uri;
  try {
    return proxyUrl(new URL(uri, manifestUrl).toString());
  } catch {
    return uri;
  }
}

export function rewriteHlsManifest(manifest: string, manifestUrl: string): string {
  return manifest.split(/\r?\n/).map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (trimmed.startsWith('#')) {
      return line.replace(/URI=(['"])(.*?)\1/g, (_match, quote: string, uri: string) => `URI=${quote}${rewriteResource(uri, manifestUrl)}${quote}`);
    }
    return rewriteResource(trimmed, manifestUrl);
  }).join('\n');
}

function addCorsHeaders(headers: Headers, origin: string): Headers {
  headers.set('access-control-allow-origin', origin);
  headers.set('access-control-allow-methods', 'GET, HEAD, OPTIONS');
  headers.set('access-control-allow-headers', 'Accept, Range, If-Range');
  headers.set('access-control-expose-headers', 'Accept-Ranges, Content-Length, Content-Range, Content-Type, ETag');
  headers.append('vary', 'Origin');
  return headers;
}

function responseHeaders(upstream: Response, origin: string): Headers {
  const headers = new Headers();
  for (const name of PASSTHROUGH_HEADERS) {
    const value = upstream.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  return addCorsHeaders(headers, origin);
}

export function createHlsProxyHandler({ allowedOrigins, fetcher = fetch }: HlsProxyOptions) {
  const originSet = new Set(allowedOrigins.map(origin => origin.toLowerCase()));

  return async function handleProxyRequest(request: Request): Promise<Response> {
    const pageUrl = new URL(request.url);
    const origin = request.headers.get('origin');
    if (origin && origin !== pageUrl.origin) return new Response('Origin not allowed', { status: 403 });

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: addCorsHeaders(new Headers(), pageUrl.origin) });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });

    const targetValue = pageUrl.searchParams.get('url');
    if (!targetValue) return new Response('Missing url parameter', { status: 400 });
    let target = isAllowedUrl(targetValue, originSet);
    if (!target) return new Response('Upstream host not allowed', { status: 403 });

    const headers = new Headers();
    for (const name of ['accept', 'range', 'if-range', 'if-none-match', 'if-modified-since']) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }

    let upstream: Response;
    for (let redirects = 0; ; redirects++) {
      const fetchTarget = workerFetchUrl(target);
      try {
        upstream = await fetcher(new Request(fetchTarget, { method: request.method, headers, redirect: 'manual' }));
      } catch {
        return new Response('Upstream request failed', { status: 502 });
      }
      if (![301, 302, 303, 307, 308].includes(upstream.status)) break;
      const location = upstream.headers.get('location');
      if (!location || redirects >= MAX_REDIRECTS) return new Response('Upstream redirect limit exceeded', { status: 502 });
      const redirectTarget = new URL(location, fetchTarget);
      if (fetchTarget.hostname !== target.hostname && redirectTarget.hostname === fetchTarget.hostname) {
        redirectTarget.hostname = target.hostname;
      }
      target = isAllowedUrl(redirectTarget.toString(), originSet);
      if (!target) return new Response('Redirect host not allowed', { status: 403 });
    }

    const headersOut = responseHeaders(upstream, pageUrl.origin);
    const contentType = upstream.headers.get('content-type') ?? '';
    const isManifest = /\.m3u8$/i.test(target.pathname) || /mpegurl/i.test(contentType);
    if (isManifest && request.method === 'GET' && upstream.ok) {
      headersOut.set('content-type', 'application/vnd.apple.mpegurl; charset=utf-8');
      headersOut.set('cache-control', 'no-store');
      headersOut.delete('content-length');
      headersOut.delete('content-range');
      headersOut.delete('accept-ranges');
      return new Response(rewriteHlsManifest(await upstream.text(), target.toString()), {
        status: upstream.status,
        headers: headersOut,
      });
    }

    return new Response(request.method === 'HEAD' ? null : upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: headersOut,
    });
  };
}
