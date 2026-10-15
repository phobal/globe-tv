export interface CaptionLanguage {
  speechTag: string;
  translationTag: string;
}

export interface CaptionTranslator {
  translate(text: string): Promise<string>;
  destroy(): void;
}

export interface CapturedAudio {
  audioTrack: MediaStreamTrack;
  onEnded(callback: () => void): void;
  stop(): void;
}

export interface RecognitionCallbacks {
  onFinal(text: string): void;
  onError(message: string): void;
  onEnd(): void;
}

export interface CaptionAdapter {
  supported(): string | null;
  prepare(sourceLanguage: string, onProgress: (fraction: number) => void): Promise<CaptionTranslator>;
  localRecognitionAvailable(language: string): Promise<boolean>;
  capture(): Promise<CapturedAudio>;
  recognize(track: MediaStreamTrack, language: string, local: boolean, callbacks: RecognitionCallbacks): { stop(): void };
}

interface TranslatorApi {
  availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
  create(options: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (monitor: EventTarget) => void;
  }): Promise<CaptionTranslator>;
}

interface RecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface RecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  processLocally?: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<RecognitionResultLike> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(track: MediaStreamTrack): void;
  abort(): void;
}

interface RecognitionApi {
  new (): RecognitionLike;
  available?: (options: { langs: string[]; processLocally: boolean }) => Promise<string>;
}

function translatorApi(): TranslatorApi | undefined {
  return (globalThis as typeof globalThis & { Translator?: TranslatorApi }).Translator;
}

function recognitionApi(): RecognitionApi | undefined {
  const browser = globalThis as typeof globalThis & { SpeechRecognition?: RecognitionApi; webkitSpeechRecognition?: RecognitionApi };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}

export const browserCaptionAdapter: CaptionAdapter = {
  supported() {
    if (!globalThis.isSecureContext) return '实时字幕需要 HTTPS 或 localhost。';
    const ua = navigator.userAgent;
    const chrome = ua.match(/Chrome\/(\d+)/);
    if (!chrome || /Edg\/|OPR\/|Android|iPhone|iPad/i.test(ua)) return '首版仅支持电脑 Chrome。';
    if (Number(chrome[1]) < 138) return '请将电脑 Chrome 更新到 138 或更新版本。';
    if (!navigator.mediaDevices?.getDisplayMedia) return '当前浏览器无法共享标签页音频。';
    if (!recognitionApi()) return '当前浏览器没有可用的语音识别接口。';
    if (!translatorApi()) return '当前 Chrome 没有本地翻译接口。';
    return null;
  },

  prepare(sourceLanguage, onProgress) {
    const api = translatorApi();
    if (!api) return Promise.reject(new Error('当前 Chrome 没有本地翻译接口。'));
    // create() is called before yielding so Chrome receives the user's click activation.
    return api.create({
      sourceLanguage,
      targetLanguage: 'zh',
      monitor(monitor) {
        monitor.addEventListener('downloadprogress', event => {
          const fraction = (event as Event & { loaded?: number }).loaded;
          if (typeof fraction === 'number') onProgress(fraction);
        });
      },
    });
  },

  async localRecognitionAvailable(language) {
    const api = recognitionApi();
    if (!api?.available) return false;
    try {
      return await api.available({ langs: [language], processLocally: true }) === 'available';
    } catch {
      return false;
    }
  },

  async capture() {
    // getDisplayMedia() is invoked before the first await to retain user activation.
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
    } as DisplayMediaStreamOptions);
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
      stream.getTracks().forEach(track => track.stop());
      throw new Error('没有收到标签页音频。请重新选择“此标签页”并开启“共享标签页音频”。');
    }
    return {
      audioTrack,
      onEnded(callback: () => void) { audioTrack.addEventListener('ended', callback, { once: true }); },
      stop() { stream.getTracks().forEach(track => track.stop()); },
    };
  },

  recognize(track, language, local, callbacks) {
    const Constructor = recognitionApi();
    if (!Constructor) throw new Error('当前浏览器没有可用的语音识别接口。');
    const recognition = new Constructor();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    if (local) recognition.processLocally = true;
    let stopped = false;
    recognition.onresult = event => {
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        const text = result[0]?.transcript.trim();
        if (result.isFinal && text) callbacks.onFinal(text);
      }
    };
    recognition.onerror = event => {
      if (!stopped && event.error !== 'no-speech' && event.error !== 'aborted') {
        callbacks.onError(`语音识别中断：${event.error}`);
      }
    };
    recognition.onend = () => { if (!stopped) callbacks.onEnd(); };
    recognition.start(track);
    return {
      stop() {
        if (stopped) return;
        stopped = true;
        recognition.abort();
      },
    };
  },
};
