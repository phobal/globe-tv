import { describe, expect, it } from 'vitest';
import { loadPopular, searchCatalog } from '../src/data/catalog';
import type { CatalogIndex } from '../src/data/types';

const index: CatalogIndex = { version: 'test', upstreamCommit: 'test', countries: [{ code: 'cn', nameZh: '中国', nameEn: 'China', channelCount: 1 }], channels: [{ id: 'one', name: 'CGTN English', countryCode: 'cn' }] };
describe('目录搜索', () => {
  it('搜索中英文国家及频道且忽略大小写空格', () => {
    expect(searchCatalog(index, ' china ').countries).toHaveLength(1);
    expect(searchCatalog(index, '中国').countries).toHaveLength(1);
    expect(searchCatalog(index, '  cgtn  english ').channels).toHaveLength(1);
  });
  it('从独立文件加载热门频道目录', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request) => {
      expect(String(url)).toContain('data/popular.json');
      return new Response(JSON.stringify({ version: 'now', upstreamCommit: 'abc', channels: [] }), { status: 200 });
    }) as typeof fetch;
    await expect(loadPopular()).resolves.toMatchObject({ upstreamCommit: 'abc', channels: [] });
    globalThis.fetch = originalFetch;
  });
});
