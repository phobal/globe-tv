import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserCaptionAdapter } from '../src/player/captions/browser';

afterEach(() => vi.unstubAllGlobals());

describe('browser caption adapter', () => {
  it('installs a downloadable local speech pack before using recognition', async () => {
    const available = vi.fn(async () => 'downloadable');
    const install = vi.fn(async () => true);
    vi.stubGlobal('SpeechRecognition', class {
      static available = available;
      static install = install;
    });

    expect(await browserCaptionAdapter.prepareLocalRecognition('ja-JP')).toBe(true);
    expect(available).toHaveBeenCalledWith({ langs: ['ja-JP'], processLocally: true });
    expect(install).toHaveBeenCalledWith({ langs: ['ja-JP'], processLocally: true });
  });

  it('leaves unavailable local speech recognition for explicit online consent', async () => {
    const install = vi.fn(async () => true);
    vi.stubGlobal('SpeechRecognition', class {
      static available = vi.fn(async () => 'unavailable');
      static install = install;
    });

    expect(await browserCaptionAdapter.prepareLocalRecognition('fr-FR')).toBe(false);
    expect(install).not.toHaveBeenCalled();
  });

  it('explains a rejected Chinese translation pair in actionable Chinese', async () => {
    vi.stubGlobal('Translator', {
      create: vi.fn(async () => { throw new DOMException('Unable to create translator', 'NotSupportedError'); }),
    });
    await expect(browserCaptionAdapter.prepare('en', vi.fn())).rejects.toThrow('Chrome 设置');
  });

  it('explains when tab capture cannot start because the page is not focused', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: { getDisplayMedia: vi.fn(async () => { throw new DOMException('Invalid state', 'InvalidStateError'); }) },
    });
    await expect(browserCaptionAdapter.capture()).rejects.toThrow('前台');
  });

  it('forwards non-final recognition text for early subtitles', () => {
    let instance: { onresult?: (event: unknown) => void } | undefined;
    vi.stubGlobal('SpeechRecognition', class {
      onresult?: (event: unknown) => void;
      constructor() { instance = this; }
      start() {}
      abort() {}
    });
    const onInterim = vi.fn();
    browserCaptionAdapter.recognize({ readyState: 'live' } as MediaStreamTrack, 'en-US', false, {
      onFinal: vi.fn(), onInterim, onError: vi.fn(), onEnd: vi.fn(),
    });
    instance?.onresult?.({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: 'live news from Berlin' } }] });
    expect(onInterim).toHaveBeenCalledWith('live news from Berlin');
  });
});
