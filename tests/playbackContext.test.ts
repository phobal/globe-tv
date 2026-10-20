import { describe, expect, it } from 'vitest';
import { resolvePlaybackContext } from '../src/player/playbackContext';
const channels = [
  { id: 'a', name: '乙', primaryCategory: 'central', categoryIds: ['central', 'sports'] },
  { id: 'b', name: '甲', primaryCategory: 'sports', categoryIds: ['sports'] },
  { id: 'c', name: '乙', primaryCategory: 'central', categoryIds: ['central'] },
];
describe('播放分类上下文', () => {
  it('恢复有效分类并且队列只含该分类', () => {
    expect(resolvePlaybackContext(channels, 'a', 'sports')).toEqual({ categoryId: 'sports', channelIds: ['b', 'a'] });
  });
  it('非法或已失效分类回退到主分类', () => {
    expect(resolvePlaybackContext(channels, 'a', 'kids')).toEqual({ categoryId: 'central', channelIds: ['a', 'c'] });
    expect(resolvePlaybackContext(channels, 'missing')).toBeUndefined();
  });
});
