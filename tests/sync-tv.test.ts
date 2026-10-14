import { describe, expect, it } from 'vitest';
// The sync module runs directly in Node and has no TypeScript build step.
// @ts-expect-error JavaScript module has no declaration file.
import { buildCatalog, normalizeChannel } from '../scripts/sync-core.mjs';

const stream = (id: string, streams: string[], country = 'cn') => ({
  nanoid: id, name: `Channel ${id}`, country, languages: ['zho'], isGeoBlocked: false,
  sources: { streams },
});
const metadata = { CN: { country: 'China' }, US: { country: 'United States' } };

describe('频道同步', () => {
  it('保留 HLS、源顺序并去掉重复地址', () => {
    const channel = normalizeChannel(stream('one', ['https://a.test/a.m3u8', 'https://a.test/a.m3u8', 'https://b.test/b.m3u8']), 'cn');
    expect(channel?.sources).toEqual([
      { kind: 'hls', url: 'https://a.test/a.m3u8', order: 0 },
      { kind: 'hls', url: 'https://b.test/b.m3u8', order: 2 },
    ]);
  });
  it('过滤仅 YouTube、无效字段、重复频道 ID，重算国家数', () => {
    const files = new Map([
      ['cn', [stream('one', ['https://a.test/a.m3u8']), { ...stream('yt', []), sources: { youtube: ['https://youtube.test/id'] } }, stream('one', ['https://b.test/b.m3u8']), { name: 'bad' }]],
      ['us', []],
    ]);
    const result = buildCatalog(metadata, files, { cn: '中国' });
    expect(result.index.countries.find((c: { code: string; channelCount: number }) => c.code === 'cn')?.channelCount).toBe(1);
    expect(result.index.countries.find((c: { code: string; channelCount: number }) => c.code === 'us')?.channelCount).toBe(0);
    expect(result.index.countries.find((c: { code: string; nameZh: string }) => c.code === 'cn')?.nameZh).toBe('中国');
    expect(result.rejected).toHaveLength(3);
  });
  it('拒绝损坏的国家文件与空索引，避免发布空数据', () => {
    expect(() => buildCatalog(metadata, new Map([['cn', {}]]))).toThrow('国家文件格式错误');
    expect(() => buildCatalog(metadata, new Map([['cn', []], ['us', []]]))).toThrow('索引为空');
  });
});
