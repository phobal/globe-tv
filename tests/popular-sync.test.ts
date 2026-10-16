import { describe, expect, it } from 'vitest';
// The sync module runs directly in Node and has no TypeScript build step.
// @ts-expect-error JavaScript module has no declaration file.
import { buildPopularCatalog, parseM3u } from '../scripts/popular-core.mjs';

describe('热门频道同步', () => {
  it('解析 M3U 条目并从 tvg-id 推导国家代码', () => {
    const entries = parseM3u(`#EXTM3U\n#EXTINF:-1 tvg-id="BBCNews.uk@Europe",BBC News Europe (720p)\nhttps://example.com/live.m3u8\n`);
    expect(entries).toEqual([{
      tvgId: 'BBCNews.uk@Europe',
      channelId: 'BBCNews.uk',
      name: 'BBC News Europe',
      countryCode: 'uk',
      url: 'https://example.com/live.m3u8',
      geoBlocked: false,
      quality: 720,
    }]);
  });

  it('合并同一频道的来源并按探测结果排序', () => {
    const entries = [
      ...parseM3u(`#EXTM3U\n#EXTINF:-1 tvg-id="NHKWorldJapan.jp@SD",NHK World-Japan (720p)\nhttps://slow.test/live.m3u8\n`),
      ...parseM3u(`#EXTM3U\n#EXTINF:-1 tvg-id="NHKWorldJapan.jp@HD",NHK World-Japan HD (1080p)\nhttps://fast.test/live.m3u8\n`),
    ];
    const probes = new Map([
      ['https://slow.test/live.m3u8', { successes: 2, attempts: 2, latencyMs: 900 }],
      ['https://fast.test/live.m3u8', { successes: 3, attempts: 3, latencyMs: 250 }],
    ]);
    const result = buildPopularCatalog(entries, [{ id: 'NHKWorldJapan.jp', name: 'NHK World-Japan', category: '新闻' }], probes, {
      expectedCount: 1,
      checkedAt: '2026-10-16T00:00:00.000Z',
      upstreamCommit: 'abc123',
    });
    expect(result.channels[0]).toMatchObject({
      id: 'popular-NHKWorldJapan-jp', rank: 1, countryCode: 'jp', category: '新闻',
      sources: [
        { kind: 'hls', url: 'https://fast.test/live.m3u8', order: 0 },
        { kind: 'hls', url: 'https://slow.test/live.m3u8', order: 1 },
      ],
    });
  });

  it('可限制地区或语言变体，避免合并同名频道的错误版本', () => {
    const entries = [
      ...parseM3u(`#EXTM3U\n#EXTINF:-1 tvg-id="BBCNews.uk@Europe",BBC News Europe (720p)\nhttps://europe.test/live.m3u8\n`),
      ...parseM3u(`#EXTM3U\n#EXTINF:-1 tvg-id="BBCNews.uk@Africa",BBC News Africa (720p)\nhttps://africa.test/live.m3u8\n`),
    ];
    const probes = new Map([
      ['https://europe.test/live.m3u8', { successes: 2, attempts: 2, latencyMs: 300 }],
      ['https://africa.test/live.m3u8', { successes: 2, attempts: 2, latencyMs: 200 }],
    ]);
    const result = buildPopularCatalog(entries, [{
      id: 'BBCNews.uk', name: 'BBC News', category: '新闻', variants: ['BBCNews.uk@Europe'],
    }], probes, { expectedCount: 1, checkedAt: 'now', upstreamCommit: 'abc' });
    expect(result.channels[0].sources).toEqual([{ kind: 'hls', url: 'https://europe.test/live.m3u8', order: 0 }]);
  });

  it('连续成功率相同时优先选择指定的官方域名', () => {
    const entries = [
      ...parseM3u(`#EXTM3U\n#EXTINF:-1 tvg-id="DW.de@English",DW English (1080p)\nhttps://relay.test/live.m3u8\n`),
      ...parseM3u(`#EXTM3U\n#EXTINF:-1 tvg-id="DW.de@English",DW English (1080p)\nhttps://dw.com/live.m3u8\n`),
    ];
    const probes = new Map([
      ['https://relay.test/live.m3u8', { successes: 2, attempts: 2, latencyMs: 100 }],
      ['https://dw.com/live.m3u8', { successes: 2, attempts: 2, latencyMs: 500 }],
    ]);
    const result = buildPopularCatalog(entries, [{
      id: 'DW.de', name: 'DW English', category: '新闻', preferredHosts: ['dw.com'],
    }], probes, { expectedCount: 1, checkedAt: 'now', upstreamCommit: 'abc' });
    expect(result.channels[0].sources[0].url).toBe('https://dw.com/live.m3u8');
  });

  it('排除地区限制和未通过检测的源，并拒绝频道数量不足', () => {
    const entries = [
      ...parseM3u(`#EXTM3U\n#EXTINF:-1 tvg-id="France24English.fr@SD",France 24 English (720p) [Geo-blocked]\nhttps://blocked.test/live.m3u8\n`),
      ...parseM3u(`#EXTM3U\n#EXTINF:-1 tvg-id="France24English.fr@HD",France 24 English (1080p)\nhttps://dead.test/live.m3u8\n`),
    ];
    expect(() => buildPopularCatalog(entries, [{ id: 'France24English.fr', name: 'France 24 English', category: '新闻' }], new Map(), {
      expectedCount: 1, checkedAt: 'now', upstreamCommit: 'abc',
    })).toThrow('热门频道数量不足');
  });
});
