import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../src/app/App';
import { loadDiscovery, loadDiscoveryChannel } from '../src/data/discovery';
vi.mock('../src/data/discovery', () => ({ loadDiscovery: vi.fn(), loadDiscoveryChannel: vi.fn() }));
vi.mock('../src/preferences/useTheme', () => ({ useThemeEffect: () => ({ mode: 'light' }) }));
vi.mock('../src/player/PlayerModal', () => ({ PlayerModal: (props: { channel: { name: string }; onClose: () => void }) => <div data-testid="player"><span>{props.channel.name}</span><button onClick={props.onClose}>退出</button></div> }));
const index = { version: '1', categories: [{ id: 'central', name: '央视卫视', channelCount: 1 }, { id: 'sports', name: '体育', channelCount: 1 }], groups: [], channels: [{ id: 'one', name: '综合台', countryCode: 'cn', languages: ['Chinese'], groupSlug: 'cctv', groupName: '央视', categoryIds: ['central'], primaryCategory: 'central', contentType: 'live' }, { id: 'two', name: '体育台', countryCode: '', languages: ['Chinese'], groupSlug: 'sport', groupName: '体育', categoryIds: ['sports'], primaryCategory: 'sports', contentType: 'live' }] };
const playable = { id: 'one', name: '综合台', countryCode: 'cn', languages: ['Chinese'], group: '央视', geoBlocked: false, sources: [{ kind: 'hls' as const, url: 'https://example.test/live.m3u8', order: 0 as const }] };
beforeEach(() => { localStorage.clear(); vi.mocked(loadDiscovery).mockResolvedValue(index as never); vi.mocked(loadDiscoveryChannel).mockResolvedValue(playable); });
afterEach(cleanup);
describe('个人频道应用', () => {
  it('打开首页不会自动启动频道', async () => { render(<App />); await screen.findByRole('heading', { name: '我的频道.' }); expect(loadDiscoveryChannel).not.toHaveBeenCalled(); });
  it('播放器保持挂载，并且返回用户开始播放前的页面', async () => { render(<App />); await screen.findByRole('heading', { name: '我的频道.' }); fireEvent.click(screen.getByRole('button', { name: '发现频道' })); fireEvent.click(await screen.findByRole('button', { name: '播放 综合台' })); await screen.findByTestId('player'); expect(screen.getByRole('heading', { name: '央视卫视' })).toBeTruthy(); fireEvent.click(screen.getByRole('button', { name: '退出' })); await waitFor(() => expect(screen.getByRole('heading', { name: '发现频道.' })).toBeTruthy()); expect(screen.getByTestId('player')).toBeTruthy(); });
});
