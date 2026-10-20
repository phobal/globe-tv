import { describe, expect, it } from 'vitest';
import { linkToCollection, parseDeepLink } from '../src/routing/deepLinks';

describe('直达链接', () => {
  it('解析合法国家和频道', () => expect(parseDeepLink('?country=CN&channel=a_123')).toEqual({ country: 'cn', channel: 'a_123', invalid: false }));
  it('拒绝非法 ID', () => {
    expect(parseDeepLink('?country=cn&channel=%3Cscript%3E').invalid).toBe(true);
  });
  it('解析热门频道集合链接', () => {
    expect(parseDeepLink('?collection=popular&channel=popular-BBCNews-uk')).toEqual({ collection: 'popular', channel: 'popular-BBCNews-uk', invalid: false });
    expect(parseDeepLink('?collection=other').invalid).toBe(true);
    expect(linkToCollection('popular', 'popular-BBCNews-uk')).toContain('collection=popular&channel=popular-BBCNews-uk');
  });
});

it('解析分类链接和独立频道链接以兼容迁移', () => {
  expect(parseDeepLink('?category=sports&channel=abc')).toEqual({ category: 'sports', channel: 'abc', invalid: false });
  expect(parseDeepLink('?channel=abc')).toEqual({ channel: 'abc', invalid: false });
  expect(parseDeepLink('?category=bad').invalid).toBe(true);
});
