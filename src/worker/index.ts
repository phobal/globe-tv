import { createHlsProxyHandler } from './hlsProxy';

interface WorkerEnvironment {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

let allowedOriginsPromise: Promise<string[]> | undefined;

async function loadAllowedOrigins(request: Request, env: WorkerEnvironment): Promise<string[]> {
  allowedOriginsPromise ??= env.ASSETS.fetch(new Request(new URL('/data/proxy-origins.json', request.url)))
    .then(async response => {
      if (!response.ok) throw new Error(`代理来源列表加载失败：${response.status}`);
      const hosts: unknown = await response.json();
      if (!Array.isArray(hosts) || hosts.some(origin => typeof origin !== 'string')) throw new Error('代理来源列表格式无效');
      return hosts as string[];
    })
    .catch(error => {
      allowedOriginsPromise = undefined;
      throw error;
    });
  return allowedOriginsPromise;
}

export default {
  async fetch(request: Request, env: WorkerEnvironment): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/proxy') return env.ASSETS.fetch(request);

    try {
      const allowedOrigins = await loadAllowedOrigins(request, env);
      return await createHlsProxyHandler({ allowedOrigins })(request);
    } catch {
      return new Response('Proxy configuration unavailable', { status: 503 });
    }
  },
};
