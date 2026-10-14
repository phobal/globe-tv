import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowsePanel } from '../src/drawer/BrowsePanel';

afterEach(() => cleanup());

const index = {
  version: 'v1',
  upstreamCommit: 'x',
  countries: [
    { code: 'cn', nameZh: '中国', nameEn: 'China', channelCount: 8 },
    { code: 'jp', nameZh: '日本', nameEn: 'Japan', channelCount: 4 },
    { code: 'tv', nameZh: '图瓦卢', nameEn: 'Tuvalu', channelCount: 0 },
  ],
  channels: [
    { id: 'c1', name: 'CCTV-1', countryCode: 'cn' },
    { id: 'c2', name: 'NHK', countryCode: 'jp' },
  ],
} as any;

const baseProps = {
  open: true,
  index,
  channels: [] as any[],
  loading: false,
  favorites: [] as string[],
  onClose: () => {},
  onPickCountry: () => {},
  onPlay: () => {},
  onToggleFavorite: () => {},
  onRetry: () => {},
};

describe('BrowsePanel', () => {
  it('shows the country list grouped by region', () => {
    render(<BrowsePanel {...baseProps} />);
    expect(screen.getByText('亚洲')).toBeTruthy();
    expect(screen.getByRole('button', { name: /中国/ })).toBeTruthy();
  });

  it('invokes onPickCountry when a country is clicked', () => {
    const onPick = vi.fn();
    render(<BrowsePanel {...baseProps} onPickCountry={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: /中国/ }));
    expect(onPick).toHaveBeenCalledWith('cn');
  });

  it('shows recommendation when the chosen country has no channels', () => {
    render(
      <BrowsePanel
        {...baseProps}
        countryCode="tv"
      />
    );
    expect(screen.getByText(/试试其他国家/)).toBeTruthy();
    expect(screen.getAllByText('中国').length).toBeGreaterThanOrEqual(1);
  });

  it('filters countries by the search input', () => {
    render(<BrowsePanel {...baseProps} />);
    const input = document.querySelector<HTMLInputElement>('input[aria-label="搜索国家"]')!;
    fireEvent.change(input, { target: { value: '日本' } });
    expect(screen.queryByText('中国')).toBeNull();
    expect(screen.getByText('日本')).toBeTruthy();
  });
});
