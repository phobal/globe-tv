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
  onInterim(text: string): void;
  onError(message: string): void;
  onEnd(): void;
}

export interface CaptionAdapter {
  supported(): string | null;
  prepare(sourceLanguage: string, onProgress: (fraction: number) => void): Promise<CaptionTranslator>;
  prepareLocalRecognition(language: string): Promise<boolean>;
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
  install?: (options: { langs: string[]; processLocally: boolean }) => Promise<boolean>;
}

function translatorApi(): TranslatorApi | undefined {
  return (globalThis as typeof globalThis & { Translator?: TranslatorApi }).Translator;
}

function recognitionApi(): RecognitionApi | undefined {
  const browser = globalThis as typeof globalThis & { SpeechRecognition?: RecognitionApi; webkitSpeechRecognition?: RecognitionApi };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}

function translatorError(error: unknown): Error {
  if (error && typeof error === 'object' && 'name' in error && error.name === 'NotSupportedError') {
    return new Error('当前语言对无法创建。请确认 Chrome 设置 > 语言中已添加中文（简体）；若已添加，请稍后重试。');
  }
  return error instanceof Error ? error : new Error('翻译模型准备失败，请稍后重试。');
}

function captureError(error: unknown): Error {
  if (error && typeof error === 'object' && 'name' in error) {
    if (error.name === 'InvalidStateError') return new Error('无法开始共享：请保持播放器标签页在前台，然后重试。');
    if (error.name === 'NotAllowedError') return new Error('已取消标签页共享。请重试并选择“此标签页”及共享音频。');
  }
  return error instanceof Error ? error : new Error('无法获取标签页音频，请重试。');
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
    try {
      return api.create({
        sourceLanguage,
        targetLanguage: 'zh',
        monitor(monitor) {
          monitor.addEventListener('downloadprogress', event => {
            const fraction = (event as Event & { loaded?: number }).loaded;
            if (typeof fraction === 'number') onProgress(fraction);
          });
        },
      }).catch(error => { throw translatorError(error); });
    } catch (error) {
      return Promise.reject(translatorError(error));
    }
  },

  async prepareLocalRecognition(language) {
    const api = recognitionApi();
    if (!api?.available) return false;
    try {
      const options = { langs: [language], processLocally: true };
      const availability = await api.available(options);
      if (availability === 'available') return true;
      if (availability === 'downloadable' || availability === 'downloading') {
        return await api.install?.(options) === true;
      }
      return false;
    } catch {
      return false;
    }
  },

  async capture() {
    // getDisplayMedia() is invoked before the first await to retain user activation.
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
        preferCurrentTab: true,
        selfBrowserSurface: 'include',
      } as DisplayMediaStreamOptions);
    } catch (error) {
      throw captureError(error);
    }
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
      const interim: string[] = [];
      for (let index = 0; index < event.results.length; index++) {
        const result = event.results[index];
        if (!result.isFinal && result[0]?.transcript.trim()) interim.push(result[0].transcript.trim());
      }
      if (interim.length) callbacks.onInterim(interim.join(' '));
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
