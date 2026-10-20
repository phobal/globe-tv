import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePlayerChrome } from '../src/player/usePlayerChrome';
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe('播放器操作层', () => {
  it('播放 3 秒后隐藏，轻触重新显示并重新计时', () => {
    vi.useFakeTimers(); const { result } = renderHook(() => usePlayerChrome({ playing: true, expanded: true }));
    expect(result.current.visible).toBe(true);
    act(() => vi.advanceTimersByTime(3000)); expect(result.current.visible).toBe(false);
    act(() => result.current.reveal()); expect(result.current.visible).toBe(true);
    act(() => vi.advanceTimersByTime(3000)); expect(result.current.visible).toBe(false);
  });
  it('电脑播放器控件不自动隐藏', () => {
    vi.useFakeTimers(); const { result } = renderHook(() => usePlayerChrome({ playing: true, expanded: true, autoHide: false }));
    act(() => vi.advanceTimersByTime(6000)); expect(result.current.visible).toBe(true);
  });
  it('暂停、阻塞 UI 或焦点保持可见', () => {
    vi.useFakeTimers(); const { result, rerender } = renderHook((props: { playing: boolean; blocking?: boolean }) => usePlayerChrome({ playing: props.playing, expanded: true, blocking: props.blocking }), { initialProps: { playing: false } as { playing: boolean; blocking?: boolean } });
    act(() => vi.advanceTimersByTime(8000)); expect(result.current.visible).toBe(true);
    rerender({ playing: true, blocking: true }); act(() => vi.advanceTimersByTime(8000)); expect(result.current.visible).toBe(true);
    rerender({ playing: true, blocking: false }); act(() => result.current.reveal()); act(() => result.current.focus()); act(() => vi.advanceTimersByTime(8000)); expect(result.current.visible).toBe(true);
  });
});
