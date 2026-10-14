import { describe, expect, it } from 'vitest';
import { stickyCountries, LABEL_CHANNEL_THRESHOLD } from '../src/globe/labelDedup';

const countries = [
  { code: 'cn', nameZh: '中国', nameEn: 'China', channelCount: 10 },
  { code: 'tv', nameZh: '图瓦卢', nameEn: 'Tuvalu', channelCount: 0 },
  { code: 'jp', nameZh: '日本', nameEn: 'Japan', channelCount: 4 },
  { code: 'us', nameZh: '美国', nameEn: 'United States', channelCount: 6 },
];

describe('stickyCountries', () => {
  it('keeps only the countries whose channel count meets the threshold', () => {
    const codes = stickyCountries(countries as any, LABEL_CHANNEL_THRESHOLD);
    expect(codes.has('cn')).toBe(true);
    expect(codes.has('us')).toBe(true);
    expect(codes.has('jp')).toBe(false);
    expect(codes.has('tv')).toBe(false);
  });

  it('respects a custom threshold', () => {
    const codes = stickyCountries(countries as any, 4);
    expect(codes.has('jp')).toBe(true);
    expect(codes.has('tv')).toBe(false);
  });
});
