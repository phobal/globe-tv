import type { CaptionAdapter, CaptionLanguage, CaptionTranslator, CapturedAudio } from './browser';

export type CaptionPhase = 'idle' | 'preparing' | 'ready' | 'needs-consent' | 'capturing' | 'active' | 'paused' | 'error';

export interface CaptionSnapshot {
  phase: CaptionPhase;
  text: string;
  message: string;
  progress: number;
}

const initial: CaptionSnapshot = { phase: 'idle', text: '', message: '', progress: 0 };

export class CaptionSession {
  private snapshot: CaptionSnapshot = initial;
  private generation = 0;
  private language: CaptionLanguage | null = null;
  private translator: CaptionTranslator | null = null;
  private capture: CapturedAudio | null = null;
  private recognizer: { stop(): void } | null = null;
  private local = false;
  private queue: Promise<void> = Promise.resolve();
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private adapter: CaptionAdapter, private onChange: (snapshot: CaptionSnapshot) => void) {}

  get current(): CaptionSnapshot { return this.snapshot; }

  private update(changes: Partial<CaptionSnapshot>) {
    this.snapshot = { ...this.snapshot, ...changes };
    this.onChange(this.snapshot);
  }

  async prepare(language: CaptionLanguage): Promise<void> {
    this.stop();
    const reason = this.adapter.supported();
    if (reason) { this.update({ phase: 'error', message: reason }); return; }
    const generation = this.generation;
    this.language = language;
    this.update({ phase: 'preparing', text: '', message: '正在准备本地翻译模型…', progress: 0 });
    // Call immediately from the click handler; Translator.create requires user activation.
    const pending = this.adapter.prepare(language.translationTag, progress => {
      if (generation === this.generation) this.update({ progress, message: `正在下载翻译模型：${Math.round(progress * 100)}%` });
    });
    try {
      const translator = await pending;
      if (generation !== this.generation) { translator.destroy(); return; }
      this.translator = translator;
      this.local = await this.adapter.localRecognitionAvailable(language.speechTag);
      if (generation !== this.generation) return;
      this.update({
        phase: this.local ? 'ready' : 'needs-consent',
        message: this.local ? '已准备好。下一步共享此标签页音频。' : '本机语音识别不可用；可选择让 Chrome 的语音服务处理音频。',
        progress: 1,
      });
    } catch (error) {
      if (generation === this.generation) this.update({ phase: 'error', message: error instanceof Error ? error.message : '翻译模型准备失败。' });
    }
  }

  async start(allowOnline: boolean): Promise<void> {
    if (!this.translator || !this.language) return;
    if (!this.local && !allowOnline) {
      this.update({ phase: 'needs-consent' });
      return;
    }
    const generation = ++this.generation;
    this.update({ phase: 'capturing', text: '', message: '请选择“此标签页”并共享标签页音频。' });
    // Call immediately from the click handler; getDisplayMedia requires user activation.
    const pending = this.adapter.capture();
    try {
      const capture = await pending;
      if (generation !== this.generation) { capture.stop(); return; }
      this.capture?.stop();
      this.capture = capture;
      capture.onEnded(() => {
        if (this.capture === capture) this.fail('标签页音频共享已停止。');
      });
      this.startRecognizer();
    } catch (error) {
      if (generation === this.generation) this.update({ phase: 'error', message: error instanceof Error ? error.message : '无法获取标签页音频。' });
    }
  }

  private startRecognizer() {
    if (!this.capture || !this.language || this.capture.audioTrack.readyState !== 'live') {
      this.fail('标签页音频轨道已经结束。');
      return;
    }
    const generation = this.generation;
    try {
      this.recognizer = this.adapter.recognize(this.capture.audioTrack, this.language.speechTag, this.local, {
        onFinal: text => this.translateFinal(text, generation),
        onError: message => { if (generation === this.generation) this.fail(message); },
        onEnd: () => {
          if (generation !== this.generation || this.snapshot.phase !== 'active') return;
          this.recognizer = null;
          this.restartTimer = setTimeout(() => {
            this.restartTimer = null;
            if (generation === this.generation && this.snapshot.phase === 'active') this.startRecognizer();
          }, 500);
        },
      });
      this.update({ phase: 'active', message: '正在听取频道语音…' });
    } catch (error) {
      this.fail(error instanceof Error ? error.message : '语音识别启动失败。');
    }
  }

  private translateFinal(text: string, generation: number) {
    const translator = this.translator;
    if (!translator || generation !== this.generation) return;
    this.queue = this.queue.catch(() => {}).then(async () => {
      const translated = await translator.translate(text);
      if (generation === this.generation && this.snapshot.phase === 'active' && translated.trim()) {
        this.update({ text: translated.trim(), message: '' });
      }
    }).catch(error => {
      if (generation === this.generation) this.update({ message: error instanceof Error ? error.message : '字幕翻译失败。' });
    });
  }

  invalidate() {
    if (!this.capture) return;
    this.generation++;
    this.queue = Promise.resolve();
    this.stopRecognizer();
    this.update({ phase: 'paused', text: '', message: '等待新频道播放…' });
  }

  pause() {
    if (this.snapshot.phase !== 'active') return;
    this.invalidate();
    this.update({ message: '播放已暂停。' });
  }

  resume() {
    if (this.snapshot.phase !== 'paused' || !this.capture) return;
    this.generation++;
    this.startRecognizer();
  }

  private stopRecognizer() {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = null;
    this.recognizer?.stop();
    this.recognizer = null;
  }

  private fail(message: string) {
    this.generation++;
    this.stopRecognizer();
    this.capture?.stop();
    this.capture = null;
    this.update({ phase: 'error', text: '', message });
  }

  stop() {
    this.generation++;
    this.stopRecognizer();
    this.capture?.stop();
    this.capture = null;
    this.translator?.destroy();
    this.translator = null;
    this.language = null;
    this.queue = Promise.resolve();
    this.update({ ...initial });
  }
}
