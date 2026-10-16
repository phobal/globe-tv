import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CaptionControls } from '../src/player/CaptionControls';
import type { CaptionSnapshot } from '../src/player/captions/session';

const idle: CaptionSnapshot = { phase: 'idle', text: '', message: '', progress: 0 };
afterEach(cleanup);

describe('CaptionControls', () => {
  it('requires an explicit click before online speech recognition starts', async () => {
    const start = vi.fn();
    const user = userEvent.setup();
    render(<CaptionControls snapshot={{ ...idle, phase: 'needs-consent' }} unsupported={null} onPrepare={vi.fn()} onStart={start} onStop={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '中文字幕' }));
    await user.click(screen.getByRole('button', { name: /允许 Chrome 在线识别并共享音频/ }));
    expect(start).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('explains unsupported browsers and links to Chrome live translation', async () => {
    const prepare = vi.fn();
    const user = userEvent.setup();
    render(<CaptionControls snapshot={idle} unsupported="首版仅支持电脑 Chrome。" onPrepare={prepare} onStart={vi.fn()} onStop={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '中文字幕' }));
    expect(screen.getByText('首版仅支持电脑 Chrome。')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Chrome 自带实时翻译/ }).getAttribute('href')).toContain('support.google.com/chrome');
    expect(prepare).not.toHaveBeenCalled();
  });

  it('passes the selected speech and translation language to preparation', async () => {
    const prepare = vi.fn();
    const user = userEvent.setup();
    render(<CaptionControls snapshot={idle} unsupported={null} onPrepare={prepare} onStart={vi.fn()} onStop={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '中文字幕' }));
    await user.selectOptions(screen.getByLabelText('频道原语种'), 'ja-JP');
    await user.click(screen.getByRole('button', { name: '准备本地翻译' }));
    expect(prepare).toHaveBeenCalledExactlyOnceWith({ speechTag: 'ja-JP', translationTag: 'ja' });
  });

  it('locks the original language after the prepared model is chosen', async () => {
    const user = userEvent.setup();
    render(<CaptionControls snapshot={{ ...idle, phase: 'ready' }} unsupported={null} onPrepare={vi.fn()} onStart={vi.fn()} onStop={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '中文字幕' }));
    expect(screen.getByLabelText('频道原语种').hasAttribute('disabled')).toBe(true);
  });

  it('closes the settings panel when the source menu opens', async () => {
    const user = userEvent.setup();
    const props = { snapshot: idle, unsupported: null, onPrepare: vi.fn(), onStart: vi.fn(), onStop: vi.fn() };
    const view = render(<CaptionControls {...props} sourceMenuOpen={false} />);
    await user.click(screen.getByRole('button', { name: '中文字幕' }));
    expect(screen.getByText('实时中文字幕')).toBeTruthy();
    view.rerender(<CaptionControls {...props} sourceMenuOpen />);
    expect(screen.queryByText('实时中文字幕')).toBeNull();
  });
});
