import { beforeEach, describe, expect, it, vi } from 'vitest';
import { markRecentlyPlayed, readPreferences, savePreferences } from '../src/preferences/storage';

beforeEach(() => localStorage.clear());
describe('浏览器个人数据', () => {
  it('收藏和历史可持久化，损坏数据可回退', () => {
    savePreferences({ favorites: ['one'], recent: ['two'], theme: 'auto' });
    expect(readPreferences()).toEqual({ favorites: ['one'], recent: ['two'], theme: 'auto' });
    localStorage.setItem('globe-tv:preferences:v1', '{broken');
    expect(readPreferences()).toEqual({ favorites: [], recent: [], theme: 'auto' });
  });

  it('成功播放才记录，重复频道移到最前并保持上限', () => {
    const initial = { favorites: [], recent: Array.from({ length: 30 }, (_, i) => String(i)), theme: 'auto' as const };
    const updated = markRecentlyPlayed(initial, '10');
    expect(updated.recent[0]).toBe('10');
    expect(updated.recent).toHaveLength(30);
    expect(updated.recent.filter(id => id === '10')).toHaveLength(1);
    expect(updated.theme).toBe('auto');
  });

  it('迁移旧版偏好，缺失主题字段时使用 auto', () => {
    localStorage.setItem(
      'globe-tv:preferences:v1',
      JSON.stringify({ favorites: ['a'], recent: ['b'], countryCode: 'cn' }),
    );
    expect(readPreferences()).toEqual({
      favorites: ['a'],
      recent: ['b'],
      countryCode: 'cn',
      theme: 'auto',
    });
  });

  it('拒绝非法主题值，回退到 auto', () => {
    localStorage.setItem(
      'globe-tv:preferences:v1',
      JSON.stringify({ favorites: [], recent: [], theme: 'midnight' }),
    );
    expect(readPreferences().theme).toBe('auto');
  });

  it('接受并保留合法的明亮/暗黑主题', () => {
    savePreferences({ favorites: [], recent: [], theme: 'light' });
    expect(readPreferences().theme).toBe('light');
    savePreferences({ favorites: [], recent: [], theme: 'dark' });
    expect(readPreferences().theme).toBe('dark');
    savePreferences({ favorites: [], recent: [], theme: 'auto' });
    expect(readPreferences().theme).toBe('auto');
  });
});

describe('个人频道台偏好', () => {
  it('保存引导状态和各频道上次分类', () => {
    savePreferences({ favorites: ['one'], recent: ['one'], theme: 'dark', onboardingVersion: 1, lastCategories: { one: 'sports' } });
    expect(readPreferences()).toMatchObject({ onboardingVersion: 1, lastCategories: { one: 'sports' } });
  });
  it('读取失败且无法清理存储时仍返回默认值', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    try { expect(readPreferences()).toEqual({ favorites: [], recent: [], theme: 'auto' }); }
    finally { get.mockRestore(); remove.mockRestore(); }
  });
});
