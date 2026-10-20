import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlayerModal } from '../src/player/PlayerModal';

vi.mock('video.js', () => {
  const player = {
    on: vi.fn(), off: vi.fn(), dispose: vi.fn(), error: vi.fn(),
    src: vi.fn(), play: vi.fn(() => Promise.resolve()), pause: vi.fn(),
    paused: vi.fn(() => true), readyState: vi.fn(() => 4),
    currentTime: vi.fn(() => 0), duration: vi.fn(() => 0),
    ready: vi.fn((fn: () => void) => fn()),
    requestFullscreen: vi.fn(() => Promise.resolve()),
    getChild: vi.fn(() => ({ el: () => ({ classList: { add: vi.fn() } }) })),
  };
  const videojs = vi.fn(() => player);
  return { default: videojs };
});

const channel = {
  id: 'c1', name: '测试频道', countryCode: 'CN', geoBlocked: false,
  category: 'china-central-and-satellite-tv', group: 'main',
  sources: [{ url: 'http://example.test/live.m3u8' }],
};

const noop = () => {};
const renderPlayer = () => render(
  <PlayerModal
    open
    expanded={true}
    channel={channel as never}
    onClose={noop}
    onNavigate={noop}
    onPlaying={noop}
  />,
);

afterEach(cleanup);

describe('播放器布局', () => {
  it('把 video.js 挂载点放进覆盖层内部，使两者共享同一盒子', () => {
    renderPlayer();

    const stage = screen.getByLabelText('播放器：测试频道');
    const videoHost = stage.querySelector('video-js');

    expect(videoHost).not.toBeNull();
    // Regression guard: as siblings, the opaque stage covered the video.
    expect(stage.contains(videoHost!)).toBe(true);
  });

  it('展开时覆盖层不铺不透明黑底', () => {
    renderPlayer();

    const stage = screen.getByLabelText('播放器：测试频道');
    expect(stage.className).toContain('bg-transparent');
    expect(stage.className).not.toMatch(/(^|\s)bg-black(\s|$)/);
  });
});