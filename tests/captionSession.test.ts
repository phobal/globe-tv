import { describe, expect, it, vi } from 'vitest';
import { CaptionSession } from '../src/player/captions/session';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function fixture(local = true) {
  let onFinal: ((text: string) => void) | undefined;
  let onInterim: ((text: string) => void) | undefined;
  let onEnded: (() => void) | undefined;
  let translate = vi.fn(async (text: string) => `中文：${text}`);
  const stopCapture = vi.fn();
  const stopRecognition = vi.fn();
  const destroyTranslator = vi.fn();
  const snapshots: Array<{ phase: string; text: string }> = [];
  const adapter = {
    supported: () => null,
    prepare: vi.fn(async () => ({ translate: (text: string) => translate(text), destroy: destroyTranslator })),
    prepareLocalRecognition: vi.fn(async () => local),
    capture: vi.fn(async () => ({ audioTrack: { readyState: 'live' } as MediaStreamTrack, stop: stopCapture, onEnded: (callback: () => void) => { onEnded = callback; } })),
    recognize: vi.fn((_track: MediaStreamTrack, _language: string, _local: boolean, callbacks: { onFinal: (text: string) => void; onInterim: (text: string) => void }) => {
      onFinal = callbacks.onFinal;
      onInterim = callbacks.onInterim;
      return { stop: stopRecognition };
    }),
  };
  const session = new CaptionSession(adapter, snapshot => snapshots.push({ phase: snapshot.phase, text: snapshot.text }));
  return { session, adapter, snapshots, stopCapture, stopRecognition, destroyTranslator, emitFinal: (text: string) => onFinal?.(text), emitInterim: (text: string) => onInterim?.(text), endCapture: () => onEnded?.(), setTranslate: (value: typeof translate) => { translate = value; }, translatedCalls: () => translate.mock.calls.length };
}

describe('CaptionSession', () => {
  it('translates final phrases in arrival order', async () => {
    const f = fixture();
    await f.session.prepare({ speechTag: 'en-US', translationTag: 'en' });
    await f.session.start(false);
    f.emitFinal('hello');
    f.emitFinal('world');
    await vi.waitFor(() => expect(f.snapshots.at(-1)?.text).toBe('中文：world'));
    expect(f.snapshots.map(value => value.text)).toContain('中文：hello');
  });

  it('shows a throttled interim caption before a long utterance is finalized', async () => {
    const f = fixture();
    await f.session.prepare({ speechTag: 'en-US', translationTag: 'en' });
    await f.session.start(false);
    f.emitInterim('butcher supporters have come from all over');
    await vi.waitFor(() => expect(f.session.current.text).toContain('中文：butcher supporters'));
    f.emitInterim('butcher supporters have come from all over the country');
    await Promise.resolve();
    expect(f.translatedCalls()).toBe(1);
    f.emitFinal('butcher supporters have come from all over the country');
    await vi.waitFor(() => expect(f.session.current.text).toContain('the country'));
  });

  it('discards a translation that finishes after a source change', async () => {
    const f = fixture();
    const pending = deferred<string>();
    f.setTranslate(vi.fn(async () => pending.promise));
    await f.session.prepare({ speechTag: 'en-US', translationTag: 'en' });
    await f.session.start(false);
    f.emitFinal('old source');
    await Promise.resolve();
    f.session.invalidate();
    pending.resolve('过期字幕');
    await Promise.resolve();
    await Promise.resolve();
    expect(f.snapshots.at(-1)?.text).toBe('');
  });

  it('pauses recognition without releasing tab audio and releases everything on stop', async () => {
    const f = fixture();
    await f.session.prepare({ speechTag: 'en-US', translationTag: 'en' });
    await f.session.start(false);
    f.session.pause();
    expect(f.stopRecognition).toHaveBeenCalledOnce();
    expect(f.stopCapture).not.toHaveBeenCalled();
    f.session.stop();
    expect(f.stopCapture).toHaveBeenCalledOnce();
    expect(f.destroyTranslator).toHaveBeenCalledOnce();
  });

  it('requires consent for browser-managed recognition when local recognition is unavailable', async () => {
    const f = fixture(false);
    await f.session.prepare({ speechTag: 'en-US', translationTag: 'en' });
    expect(f.snapshots.at(-1)?.phase).toBe('needs-consent');
    await f.session.start(true);
    expect(f.adapter.recognize).toHaveBeenCalledWith(expect.anything(), 'en-US', false, expect.anything());
  });

  it('reports when the user stops sharing the captured tab', async () => {
    const f = fixture();
    await f.session.prepare({ speechTag: 'en-US', translationTag: 'en' });
    await f.session.start(false);
    f.endCapture();
    expect(f.snapshots.at(-1)?.phase).toBe('error');
    expect(f.snapshots.at(-1)?.text).toBe('');
  });

  it('reports stopped sharing after a channel change', async () => {
    const f = fixture();
    await f.session.prepare({ speechTag: 'en-US', translationTag: 'en' });
    await f.session.start(false);
    f.session.invalidate();
    f.endCapture();
    expect(f.snapshots.at(-1)?.phase).toBe('error');
  });

  it('shows synchronous translator setup errors instead of leaving preparation pending', async () => {
    const f = fixture();
    f.adapter.prepare.mockImplementationOnce(() => { throw new Error('语言对不可用'); });
    await f.session.prepare({ speechTag: 'en-US', translationTag: 'en' });
    expect(f.snapshots.at(-1)?.phase).toBe('error');
    expect(f.session.current.message).toBe('语言对不可用');
  });
});
