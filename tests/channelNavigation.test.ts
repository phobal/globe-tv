import { describe, expect, it } from 'vitest';
import type { Channel } from '../src/data/types';
import { adjacentChannel, getSwipeDirection, orderedChannels } from '../src/player/channelNavigation';

const channel = (id: string, name: string): Channel => ({
  id, name, countryCode: 'cn', languages: [], geoBlocked: false, sources: [],
});

describe('移动端切台手势', () => {
  it('上滑下一台，下滑上一台', () => {
    expect(getSwipeDirection({ x: 10, y: 180, time: 0 }, { x: 15, y: 70, time: 250 })).toBe('next');
    expect(getSwipeDirection({ x: 10, y: 70, time: 0 }, { x: 15, y: 180, time: 250 })).toBe('previous');
  });

  it('忽略短距离、横向和过慢的拖动', () => {
    expect(getSwipeDirection({ x: 0, y: 100, time: 0 }, { x: 0, y: 65, time: 200 })).toBeNull();
    expect(getSwipeDirection({ x: 0, y: 100, time: 0 }, { x: 100, y: 20, time: 200 })).toBeNull();
    expect(getSwipeDirection({ x: 0, y: 100, time: 0 }, { x: 0, y: 0, time: 1200 })).toBeNull();
  });
});

describe('当前国家频道顺序', () => {
  const channels = orderedChannels([channel('z', 'Zebra'), channel('a', 'Alpha'), channel('m', 'Music')]);

  it('与频道列表默认名称顺序一致', () => {
    expect(channels.map(item => item.id)).toEqual(['a', 'm', 'z']);
  });

  it('按方向找相邻频道，首尾不循环', () => {
    expect(adjacentChannel(channels, 'm', 'next')?.id).toBe('z');
    expect(adjacentChannel(channels, 'm', 'previous')?.id).toBe('a');
    expect(adjacentChannel(channels, 'z', 'next')).toBeUndefined();
    expect(adjacentChannel(channels, 'a', 'previous')).toBeUndefined();
    expect(adjacentChannel(channels, 'missing', 'next')).toBeUndefined();
  });

  it('热门频道按榜单排名切换', () => {
    const rankedInput: Array<Channel & { rank: number }> = [
      { ...channel('second', 'ABC'), rank: 2 },
      { ...channel('first', 'BBC'), rank: 1 },
    ];
    const ranked = orderedChannels(rankedInput);
    expect(ranked.map(item => item.id)).toEqual(['first', 'second']);
  });
});
