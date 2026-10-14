import { describe, expect, it } from 'vitest';
import { parseDeepLink } from '../src/routing/deepLinks';

describe('直达链接', () => {
  it('解析合法国家和频道', () => expect(parseDeepLink('?country=CN&channel=a_123')).toEqual({ country: 'cn', channel: 'a_123', invalid: false }));
  it('拒绝缺失国家或非法 ID', () => {
    expect(parseDeepLink('?channel=abc').invalid).toBe(true);
    expect(parseDeepLink('?country=cn&channel=%3Cscript%3E').invalid).toBe(true);
  });
});
