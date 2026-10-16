import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (event: MediaQueryListEvent) => void;

interface FakeMediaQueryList {
  matches: boolean;
  media: string;
  onchange: ((event: MediaQueryListEvent) => void) | null;
  addEventListener: (type: 'change', listener: Listener) => void;
  removeEventListener: (type: 'change', listener: Listener) => void;
  addListener: (listener: Listener) => void;
  removeListener: (listener: Listener) => void;
  dispatchEvent: (event: MediaQueryListEvent) => boolean;
}

let mediaState: Record<string, boolean> = {};
let listeners: Record<string, Set<Listener>> = {};

function createMatchMedia(query: string): FakeMediaQueryList {
  const stateKey = query;
  const list: FakeMediaQueryList = {
    get matches() { return mediaState[stateKey] ?? false; },
    media: query,
    onchange: null,
    addEventListener: (_type, listener) => {
      const set = listeners[stateKey] ?? new Set();
      set.add(listener);
      listeners[stateKey] = set;
    },
    removeEventListener: (_type, listener) => {
      listeners[stateKey]?.delete(listener);
    },
    addListener: (listener) => list.addEventListener('change', listener),
    removeListener: (listener) => list.removeEventListener('change', listener),
    dispatchEvent: (event) => {
      list.matches = event.matches;
      (listeners[stateKey] ?? new Set()).forEach(listener => listener(event));
      return true;
    },
  };
  return list;
}

beforeEach(() => {
  mediaState = { '(prefers-color-scheme: dark)': false };
  listeners = {};
  vi.stubGlobal('matchMedia', (query: string) => createMatchMedia(query));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function loadTheme() {
  return import('../src/preferences/theme');
}

describe('主题解析与应用', () => {
  it('显式明亮偏好解析为 light', async () => {
    const { resolveThemeMode } = await loadTheme();
    expect(resolveThemeMode('light')).toBe('light');
  });

  it('显式暗黑偏好解析为 dark', async () => {
    const { resolveThemeMode } = await loadTheme();
    expect(resolveThemeMode('dark')).toBe('dark');
  });

  it('跟随系统：浏览器暗黑时解析为 dark', async () => {
    mediaState['(prefers-color-scheme: dark)'] = true;
    const { resolveThemeMode } = await loadTheme();
    expect(resolveThemeMode('auto')).toBe('dark');
  });

  it('跟随系统：浏览器明亮时解析为 light', async () => {
    mediaState['(prefers-color-scheme: dark)'] = false;
    const { resolveThemeMode } = await loadTheme();
    expect(resolveThemeMode('auto')).toBe('light');
  });

  it('applyTheme 写入 data-theme 与 theme-color meta', async () => {
    document.documentElement.removeAttribute('data-theme');
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.content = '#000000';
    document.head.appendChild(meta);
    const { applyTheme } = await loadTheme();
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(meta.content.toLowerCase()).toBe('#f6f8fb');
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(meta.content.toLowerCase()).toBe('#08111f');
  });

  it('applyTheme 跟随系统时根据浏览器偏好解析', async () => {
    mediaState['(prefers-color-scheme: dark)'] = true;
    document.documentElement.removeAttribute('data-theme');
    const { applyTheme } = await loadTheme();
    applyTheme('auto');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('从 localStorage 读取已保存的主题偏好', async () => {
    localStorage.setItem(
      'globe-tv:preferences:v1',
      JSON.stringify({ favorites: [], recent: [], theme: 'light' }),
    );
    const { readStoredThemePreference } = await loadTheme();
    expect(readStoredThemePreference()).toBe('light');
  });

  it('localStorage 损坏时返回 undefined', async () => {
    localStorage.setItem('globe-tv:preferences:v1', '{not-json');
    const { readStoredThemePreference } = await loadTheme();
    expect(readStoredThemePreference()).toBeUndefined();
  });

  it('非法主题值返回 undefined', async () => {
    localStorage.setItem(
      'globe-tv:preferences:v1',
      JSON.stringify({ favorites: [], recent: [], theme: 'pink' }),
    );
    const { readStoredThemePreference } = await loadTheme();
    expect(readStoredThemePreference()).toBeUndefined();
  });
});
