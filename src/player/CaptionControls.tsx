import { useEffect, useState } from 'react';
import { Captions, X } from 'lucide-react';
import type { CaptionLanguage } from './captions/browser';
import type { CaptionSnapshot } from './captions/session';

const languages = [
  { label: '英语', speechTag: 'en-US', translationTag: 'en' },
  { label: '日语', speechTag: 'ja-JP', translationTag: 'ja' },
  { label: '韩语', speechTag: 'ko-KR', translationTag: 'ko' },
  { label: '法语', speechTag: 'fr-FR', translationTag: 'fr' },
  { label: '德语', speechTag: 'de-DE', translationTag: 'de' },
  { label: '西班牙语', speechTag: 'es-ES', translationTag: 'es' },
  { label: '泰国语', speechTag: 'th-TH', translationTag: 'th' },
  { label: '俄语', speechTag: 'ru-RU', translationTag: 'ru' },
  { label: '意大利语', speechTag: 'it-IT', translationTag: 'it' },
  { label: '葡萄牙语', speechTag: 'pt-PT', translationTag: 'pt' },
  { label: '阿拉伯语', speechTag: 'ar-SA', translationTag: 'ar' },
  { label: '印地语', speechTag: 'hi-IN', translationTag: 'hi' },
  { label: '越南语', speechTag: 'vi-VN', translationTag: 'vi' },
  { label: '印尼语', speechTag: 'id-ID', translationTag: 'id' },
] as const;

interface Props {
  snapshot: CaptionSnapshot;
  unsupported: string | null;
  onPrepare: (language: CaptionLanguage) => void;
  onStart: (allowOnline: boolean) => void;
  onStop: () => void;
  hasSourceMenu?: boolean;
  sourceMenuOpen?: boolean;
  /**
   * Captions rely on browser-only APIs that don't work on touch devices.
   * When `true` the control renders nothing instead of taking up screen real estate.
   */
  isMobile?: boolean;
}

export function CaptionControls({ snapshot, unsupported, onPrepare, onStart, onStop, hasSourceMenu = false, sourceMenuOpen = false, isMobile = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<string>('en-US');
  const active = snapshot.phase === 'active' || snapshot.phase === 'paused' || snapshot.phase === 'capturing';
  const chosen = languages.find(language => language.speechTag === selected) ?? languages[0];

  useEffect(() => {
    if (sourceMenuOpen) setExpanded(false);
  }, [sourceMenuOpen]);

  if (isMobile) return null;

  return (
    <div className={`absolute bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 sm:bottom-16 ${hasSourceMenu ? 'right-16 sm:right-16' : 'right-3 sm:right-4'}`}>
      {expanded && (
        <div className="absolute right-0 bottom-12 w-[min(21rem,calc(100vw-2rem))] rounded-xl border border-white/20 bg-[#10263af5] p-4 text-sm text-white shadow-2xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <strong>实时中文字幕</strong>
            <button type="button" className="grid size-8 place-items-center rounded-lg hover:bg-white/10" aria-label="收起字幕设置" onClick={() => setExpanded(false)}><X size={18} /></button>
          </div>
          {unsupported ? (
            <p className="text-white/80">{unsupported}</p>
          ) : (
            <>
              <label className="mb-2 block text-white/85" htmlFor="caption-language">频道原语种</label>
              <select id="caption-language" className="mb-3 min-h-10 w-full rounded-lg border border-white/25 bg-[#0a1a2a] px-3 text-white" value={selected} disabled={snapshot.phase !== 'idle' && snapshot.phase !== 'error'} onChange={event => setSelected(event.target.value)}>
                {languages.map(language => <option key={language.speechTag} value={language.speechTag}>{language.label}</option>)}
              </select>
              <p className="mb-3 text-xs leading-5 text-white/70">字幕在你的浏览器中生成。开始时请授权共享"此标签页"及音频；站点不保存音频或字幕。</p>
              {snapshot.message && <p className="mb-3 text-xs leading-5 text-cyan" role="status">{snapshot.message}</p>}
              {snapshot.phase === 'preparing' && <progress className="mb-3 w-full" max={1} value={snapshot.progress < 1 ? snapshot.progress : undefined} aria-label="模型准备进度" />}
              {(snapshot.phase === 'idle' || snapshot.phase === 'error') && (
                <button type="button" className="min-h-10 w-full rounded-lg bg-cyan px-3 font-semibold text-[#102334]" onClick={() => onPrepare({ speechTag: chosen.speechTag, translationTag: chosen.translationTag })}>准备本地翻译</button>
              )}
              {snapshot.phase === 'ready' && (
                <button type="button" className="min-h-10 w-full rounded-lg bg-cyan px-3 font-semibold text-[#102334]" onClick={() => onStart(false)}>共享此标签页音频</button>
              )}
              {snapshot.phase === 'needs-consent' && (
                <button type="button" className="min-h-10 w-full rounded-lg bg-cyan px-3 font-semibold text-[#102334]" onClick={() => onStart(true)}>允许 Chrome 在线识别并共享音频</button>
              )}
              {active && (
                <button type="button" className="min-h-10 w-full rounded-lg border border-white/30 px-3 font-semibold text-white" onClick={onStop}>关闭字幕并停止共享</button>
              )}
            </>
          )}
          <a className="mt-3 block text-xs text-cyan underline underline-offset-2" href="https://support.google.com/chrome/answer/10538231" target="_blank" rel="noreferrer">了解 Chrome 自带实时翻译</a>
        </div>
      )}
      <button
        type="button"
        className={`flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm shadow-lg hover:bg-[#173353] ${active ? 'bg-cyan text-[#102334]' : 'bg-[#07172aeb] text-white'}`}
        onClick={() => setExpanded(value => !value)}
        aria-label="中文字幕"
        aria-expanded={expanded}
      ><Captions size={18} aria-hidden="true" /><span>中文字幕</span></button>
    </div>
  );
}
