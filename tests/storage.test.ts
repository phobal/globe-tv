import { beforeEach, describe, expect, it } from 'vitest';
import { markRecentlyPlayed, readPreferences, savePreferences } from '../src/preferences/storage';

beforeEach(() => localStorage.clear());
describe('浏览器个人数据', () => {
  it('收藏和历史可持久化，损坏数据可回退', () => {
    savePreferences({ favorites: ['one'], recent: ['two'] });
    expect(readPreferences()).toEqual({ favorites: ['one'], recent: ['two'] });
    localStorage.setItem('globe-tv:preferences:v1', '{broken');
    expect(readPreferences()).toEqual({ favorites: [], recent: [] });
  });
  it('成功播放才记录，重复频道移到最前并保持上限', () => {
    const initial = { favorites: [], recent: Array.from({ length: 30 }, (_, i) => String(i)) };
    const updated = markRecentlyPlayed(initial, '10');
    expect(updated.recent[0]).toBe('10');
    expect(updated.recent).toHaveLength(30);
    expect(updated.recent.filter(id => id === '10')).toHaveLength(1);
  });
});
