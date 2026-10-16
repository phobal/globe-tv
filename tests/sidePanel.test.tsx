import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SidePanel } from '../src/sidepanel/SidePanel';
import type { CatalogIndex, PopularChannel } from '../src/data/types';

const index: CatalogIndex = {
  version: 'test', upstreamCommit: 'test', channels: [],
  countries: [{ code: 'uk', nameZh: '英国', nameEn: 'United Kingdom', channelCount: 1 }],
};
const channel: PopularChannel = {
  id: 'popular-BBCNews-uk', tvgId: 'BBCNews.uk', name: 'BBC News', countryCode: 'uk',
  languages: ['eng'], geoBlocked: false, category: '新闻', rank: 1,
  sources: [{ kind: 'hls', url: 'https://example.test/live.m3u8', order: 0 }],
};

afterEach(cleanup);

function props(overrides = {}) {
  return {
    index, countries: index.countries, channels: [], loading: false, favorites: [], popular: false,
    onPickCountry: vi.fn(), onPickPopular: vi.fn(), onPlay: vi.fn(), onToggleFavorite: vi.fn(), onRetry: vi.fn(),
    ...overrides,
  };
}

describe('热门频道侧栏', () => {
  it('从国家列表进入热门频道', async () => {
    const onPickPopular = vi.fn();
    render(<SidePanel {...props({ onPickPopular })} />);
    await userEvent.click(screen.getByRole('button', { name: /全球热门频道/ }));
    expect(onPickPopular).toHaveBeenCalledOnce();
  });

  it('显示热门频道排名、分类和国家', () => {
    render(<SidePanel {...props({ popular: true, channels: [channel] })} />);
    expect(screen.getByRole('heading', { name: '全球热门频道' })).toBeTruthy();
    expect(screen.getByText('新闻 · 英国')).toBeTruthy();
    expect(screen.getByText('01')).toBeTruthy();
  });

  it('热门频道按榜单排名展示', () => {
    const second = { ...channel, id: 'popular-ABCNews-us', name: 'ABC News', countryCode: 'us', rank: 2 };
    render(<SidePanel {...props({ popular: true, channels: [second, channel] })} />);
    const buttons = screen.getAllByRole('button').filter(item => /News/.test(item.textContent ?? ''));
    expect(buttons.map(item => item.textContent)).toEqual([
      expect.stringContaining('01BBC News'),
      expect.stringContaining('02ABC News'),
    ]);
  });
});
