import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Home } from '../src/library/Home';
import { Discover } from '../src/library/Discover';
import type { DiscoveryCatalog } from '../src/data/types';
afterEach(cleanup);
const channels = [
  { id: 'one', name: '综合台', countryCode: 'cn', languages: ['Chinese'], groupSlug: 'cctv', groupName: '央视', categoryIds: ['central'], primaryCategory: 'central', contentType: 'live' },
  { id: 'two', name: '体育台', countryCode: '', languages: ['Chinese'], groupSlug: 'sports', groupName: '体育源', categoryIds: ['sports'], primaryCategory: 'sports', contentType: 'live' },
] satisfies DiscoveryCatalog['channels'];
const catalog: DiscoveryCatalog = { version: 'test', categories: [{ id: 'central', name: '央视卫视', channelCount: 1 }, { id: 'sports', name: '体育', channelCount: 1 }], groups: [{ slug: 'cctv', name: '央视' }, { slug: 'sports', name: '体育源' }], channels };
describe('个人频道台页面', () => {
  it('首页不自动播放，继续观看需要主动点击', () => {
    const play = vi.fn();
    render(<Home catalog={catalog} preferences={{ favorites: ['one'], recent: ['one'], theme: 'auto' }} onPlay={play} onDiscover={vi.fn()} onToggleFavorite={vi.fn()} onReorder={vi.fn()} />);
    expect(play).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /继续观看/ }));
    expect(play).toHaveBeenCalledWith('one');
  });
  it('允许移除已下线收藏，并用明确按钮调整顺序', () => {
    const toggle = vi.fn(), reorder = vi.fn();
    render(<Home catalog={catalog} preferences={{ favorites: ['gone', 'one', 'two'], recent: [], theme: 'auto' }} onPlay={vi.fn()} onDiscover={vi.fn()} onToggleFavorite={toggle} onReorder={reorder} />);
    fireEvent.click(screen.getByRole('button', { name: '调整顺序' }));
    fireEvent.click(screen.getByRole('button', { name: '移除已下线频道 gone' }));
    expect(toggle).toHaveBeenCalledWith('gone');
    fireEvent.click(screen.getByRole('button', { name: '向前移动 体育台' }));
    expect(reorder).toHaveBeenCalledWith(['gone', 'two', 'one']);
  });
  it('全局搜索跨分类，来源筛选可清除', () => {
    render(<Discover catalog={catalog} favorites={[]} category="central" onCategory={vi.fn()} query="体育" onQuery={vi.fn()} group="" onGroup={vi.fn()} country="" onCountry={vi.fn()} language="" onLanguage={vi.fn()} onPlay={vi.fn()} onToggleFavorite={vi.fn()} />);
    expect(screen.getByRole('button', { name: '播放 体育台' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '播放 综合台' })).toBeNull();
  });
});
