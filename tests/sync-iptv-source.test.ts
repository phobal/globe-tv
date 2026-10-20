import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
// sync-iptv-source.mjs 直接在 Node 里运行, 没有 TypeScript 构建步骤.
// @ts-expect-error JavaScript module has no declaration file.
import { buildCategoryCatalog, parseM3uEntries, resolveGroup, syncIptvSource } from '../scripts/sync-iptv-source.mjs';

const CN = '\u{1F1E8}\u{1F1F3}';
const JP = '\u{1F1EF}\u{1F1F5}';
const KR = '\u{1F1F0}\u{1F1F7}';
const FILM = '\u{1F39E}\uFE0F';

describe('parseM3uEntries', () => {
  it('解析 tvg-logo / group-title / name 与紧跟的 url', () => {
    const text = [
      '#EXTM3U',
      '#EXTINF:-1 tvg-logo="https://epg.112114.xyz/logo/CCTV1.png" group-title="' + CN + '央卫视直播[1]",CCTV1',
      'http://222.223.41.27:8888/hls/1/index.m3u8',
    ].join('\n');
    expect(parseM3uEntries(text)).toEqual([
      {
        groupTitle: CN + '央卫视直播[1]',
        name: 'CCTV1',
        logo: 'https://epg.112114.xyz/logo/CCTV1.png',
        url: 'http://222.223.41.27:8888/hls/1/index.m3u8',
      },
    ]);
  });

  it('跳过非 m3u8 链接与缺失 group-title 的条目', () => {
    const text = [
      '#EXTM3U',
      '#EXTINF:-1 group-title="' + CN + '央卫视直播[1]",CCTV2',
      'http://222.223.41.27:8888/hls/2/index.mp4',
      '#EXTINF:-1 group-title="",无名',
      'http://example.com/no.m3u8',
      '#EXTINF:-1 tvg-logo="" group-title="' + CN + '央卫视直播[2]",CCTV3',
      'http://222.223.41.27:8888/hls/3/index.m3u8',
    ].join('\n');
    expect(parseM3uEntries(text)).toEqual([
      {
        groupTitle: CN + '央卫视直播[2]',
        name: 'CCTV3',
        logo: '',
        url: 'http://222.223.41.27:8888/hls/3/index.m3u8',
      },
    ]);
  });
});

describe('resolveGroup', () => {
  it('从 group-title 中归一化掉尾部 [...] 修饰', () => {
    const a = resolveGroup(CN + '央卫视直播[1]');
    const b = resolveGroup(CN + '央卫视直播[2]');
    const c = resolveGroup(CN + '央卫视直播[兜底]');
    expect(a.slug).toBe('china-central-and-satellite-tv');
    expect(b.slug).toBe(a.slug);
    expect(c.slug).toBe(a.slug);
  });

  it('从国旗 emoji 推断 ISO 国家代码', () => {
    expect(resolveGroup(JP + '日本直播[需日本ip]').countryCode).toBe('jp');
    expect(resolveGroup(KR + '韩国直播').countryCode).toBe('kr');
    expect(resolveGroup(CN + '央卫视直播[1]').countryCode).toBe('cn');
  });

  it('非国旗 emoji 时不输出 countryCode', () => {
    expect(resolveGroup(FILM + '电影直播').countryCode).toBe('');
  });
});

describe('buildCategoryCatalog', () => {
  it('将同前缀多备份分组合并到同一个分类, 同名频道聚合 sources', () => {
    const entries = [
      { groupTitle: CN + '央卫视直播[1]', name: 'CCTV1', logo: '', url: 'http://a.test/1.m3u8' },
      { groupTitle: CN + '央卫视直播[2]', name: 'CCTV1', logo: '', url: 'http://b.test/1.m3u8' },
      { groupTitle: CN + '央卫视直播[1]', name: 'CCTV2', logo: '', url: 'http://a.test/2.m3u8' },
      { groupTitle: FILM + '电影直播', name: '动作电影', logo: '', url: 'http://m.test/1.m3u8' },
      { groupTitle: FILM + '电影直播', name: '动作电影', logo: '', url: 'http://m.test/2.m3u8' },
    ];
    const categories: ReturnType<typeof buildCategoryCatalog> = buildCategoryCatalog(entries);
    expect(categories).toHaveLength(2);
    const china = categories.find((c: { slug: string }) => c.slug === 'china-central-and-satellite-tv');
    expect(china).toBeDefined();
    const cctv1 = china.channels.find((c: { name: string }) => c.name === 'CCTV1');
    expect(cctv1?.sources).toEqual([
      { kind: 'hls', url: 'http://a.test/1.m3u8', order: 0 },
      { kind: 'hls', url: 'http://b.test/1.m3u8', order: 1 },
    ]);
    const movies = categories.find((c: { slug: string }) => c.slug === 'movies-live');
    const action = movies?.channels.find((c: { name: string }) => c.name === '动作电影');
    expect(action?.sources).toHaveLength(2);
  });

  it('字段命名顺序与 cctv.json 一致 (id, name, countryCode, languages, group, sources...)', () => {
    const [channel] = buildCategoryCatalog([
      { groupTitle: CN + '央卫视直播[1]', name: 'CCTV1', logo: '', url: 'http://a.test/1.m3u8' },
    ])[0].channels;
    expect(Object.keys(channel)).toEqual(
      expect.arrayContaining(['id', 'name', 'countryCode', 'languages', 'group', 'sources']),
    );
    expect(channel.id).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(channel.group).toBe('China Central & Satellite TV');
    expect(channel.countryCode).toBe('cn');
    expect(channel.languages).toEqual(['Chinese']);
  });
});

describe('syncIptvSource', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;
  const tmpDir = process.cwd() + '/fixtures/iptv-source-sync';
  const cachePath = tmpDir + '/index.m3u';
  const reportPath = tmpDir + '/category-report.json';

  beforeEach(async () => {
    const fs = await import('node:fs/promises');
    await fs.rm(tmpDir, { recursive: true, force: true });
    await fs.mkdir(tmpDir, { recursive: true });
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('远程拉取成功时写入 m3u 与 category/* 并产生 category-report.json', async () => {
    const m3u = [
      '#EXTM3U',
      '#EXTINF:-1 tvg-logo="" group-title="' + CN + '央卫视直播[1]",CCTV1',
      'http://a.test/1.m3u8',
      '#EXTINF:-1 tvg-logo="" group-title="' + FILM + '电影直播",动作电影',
      'http://m.test/1.m3u8',
    ].join('\n');
    fetchMock.mockResolvedValueOnce(new Response(m3u, { status: 200 }));
    const result = await syncIptvSource({ outputDir: tmpDir, cachePath, reportPath });
    expect(result.source).toBe('remote');
    expect(result.entryCount).toBe(2);
    expect(result.categoryCount).toBe(2);
    expect(result.channelCount).toBe(2);
    const fs = await import('node:fs/promises');
    const cache = await fs.readFile(cachePath, 'utf8');
    expect(cache).toBe(m3u);
    const china = JSON.parse(await fs.readFile(tmpDir + '/category/china-central-and-satellite-tv.json', 'utf8'));
    expect(china).toHaveLength(1);
    expect(china[0].name).toBe('CCTV1');
    const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
    expect(report.categoryCount).toBe(2);
  });

  it('远程失败时回落到本地缓存', async () => {
    const fs = await import('node:fs/promises');
    const cachedM3u = [
      '#EXTM3U',
      '#EXTINF:-1 tvg-logo="" group-title="' + CN + '央卫视直播[1]",CCTV1',
      'http://a.test/1.m3u8',
    ].join('\n');
    await fs.writeFile(cachePath, cachedM3u);
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const result = await syncIptvSource({ outputDir: tmpDir, cachePath, reportPath });
    expect(result.source).toBe('cache');
    expect(result.channelCount).toBe(1);
  });
});