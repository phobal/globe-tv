import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import type { Channel, CountrySummary } from '../data/types';
import { beginSession, cancelSource, chooseSource, nextSource, type SourceState } from './sourceMachine';

const initial: SourceState = { session: 0, phase: 'idle', sourceIndex: 0, sourceCount: 0, cancelled: false };

interface Props {
  open: boolean;
  channel: Channel;
  country?: CountrySummary;
  onPlaying: (id: string) => void;
  onClose: () => void;
}

export function PlayerModal({ open, channel, country, onPlaying, onClose }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<SourceState>(initial);
  const [needsGesture, setNeedsGesture] = useState(false);
  const activeSession = useRef(0);
  const onPlayingRef = useRef(onPlaying);
  onPlayingRef.current = onPlaying;

  useEffect(() => {
    setNeedsGesture(false);
    setState(previous => beginSession(previous, channel.sources.length));
  }, [channel.id]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    const element = video.current;
    const source = channel.sources[state.sourceIndex];
    if (!element || !source || state.cancelled || state.phase === 'failed' || state.phase === 'idle') return;
    const session = state.session;
    activeSession.current = session;
    let hls: Hls | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    const fail = () => {
      if (closed || activeSession.current !== session) return;
      setState(current => nextSource(current, session));
    };
    const playing = () => {
      if (closed || activeSession.current !== session) return;
      if (timer) clearTimeout(timer);
      setNeedsGesture(false);
      setState(current => current.session === session ? { ...current, phase: 'playing' } : current);
      onPlayingRef.current(channel.id);
    };
    const play = () => {
      element.play().catch(error => {
        if (closed || activeSession.current !== session) return;
        if (error?.name === 'NotAllowedError') {
          if (timer) clearTimeout(timer);
          setNeedsGesture(true);
          setState(current => current.session === session ? { ...current, phase: 'awaiting-gesture' } : current);
        } else fail();
      });
    };
    element.addEventListener('playing', playing);
    element.addEventListener('error', fail);
    element.pause();
    element.removeAttribute('src');
    element.load();
    timer = setTimeout(fail, 15000);
    if (element.canPlayType('application/vnd.apple.mpegurl')) {
      element.src = source.url;
      play();
    } else if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) fail(); });
      hls.on(Hls.Events.MANIFEST_PARSED, play);
      hls.loadSource(source.url);
      hls.attachMedia(element);
    } else fail();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      element.removeEventListener('playing', playing);
      element.removeEventListener('error', fail);
      hls?.destroy();
      element.pause();
      element.removeAttribute('src');
      element.load();
    };
  }, [open, channel.id, state.session, state.sourceIndex, state.phase === 'failed', state.cancelled]);

  if (!open) return null;

  const sourceCount = channel.sources.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#03080fcc] sm:p-4" onClick={onClose}>
      <div className="flex h-dvh w-full min-w-0 flex-col overflow-hidden bg-[#0c1e30] text-ink shadow-2xl sm:h-auto sm:max-h-[90dvh] sm:max-w-[960px] sm:rounded-2xl sm:border sm:border-line" role="dialog" aria-modal="true" aria-label="播放器" onClick={event => event.stopPropagation()}>
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#1f3650] px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <small className="text-xs tracking-widest text-cyan">{country?.nameZh ?? channel.countryCode}</small>
            <h2 className="mt-1 truncate text-lg font-semibold sm:text-xl">{channel.name}</h2>
          </div>
          <button className="grid size-11 shrink-0 place-items-center rounded-lg border border-line bg-raised text-2xl" type="button" onClick={onClose} aria-label="关闭播放器">×</button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
          <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl border border-[#1f3650] bg-black">
            <video className="block h-full w-full object-contain" ref={video} playsInline controls={false} />
            {state.phase !== 'playing' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/65 p-3 text-center text-xs sm:gap-3 sm:p-5 sm:text-sm" role="status">
                {state.phase === 'failed' ? (
                  <>
                    <strong className="text-sm sm:text-base">所有来源均无法播放</strong>
                    <p>可能是源失效、跨域或地区限制。</p>
                    <div className="flex gap-2">
                      <button className="rounded-lg bg-cyan px-4 py-2 font-semibold text-[#102334]" onClick={() => setState(current => beginSession(current, sourceCount))}>重试</button>
                      <button className="rounded-lg border border-line bg-raised px-4 py-2" onClick={onClose}>关闭</button>
                    </div>
                  </>
                ) : state.phase === 'idle' ? (
                  <>
                    已取消尝试
                    <button className="rounded-lg bg-cyan px-4 py-2 font-semibold text-[#102334]" onClick={() => setState(current => beginSession(current, sourceCount))}>重新尝试</button>
                  </>
                ) : needsGesture ? (
                  <>
                    浏览器要求手动开始播放
                    <button className="rounded-lg bg-cyan px-4 py-2 font-semibold text-[#102334]" onClick={() => video.current?.play().catch(() => {})}>点击播放</button>
                  </>
                ) : (
                  <>
                    正在尝试来源 {state.sourceIndex + 1} / {sourceCount}…
                    <button className="rounded-lg bg-cyan px-4 py-2 font-semibold text-[#102334]" onClick={() => setState(cancelSource)}>取消尝试</button>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 [&_button]:min-h-11 [&_button]:rounded-lg [&_button]:border [&_button]:border-line [&_button]:bg-raised [&_button]:px-3 [&_button]:py-2 [&_button]:text-sm hover:[&_button]:bg-[#173353]">
            <button onClick={() => {
              const element = video.current;
              if (!element) return;
              if (element.paused) element.play().catch(() => setNeedsGesture(true));
              else element.pause();
            }}>播放 / 暂停</button>
            <button onClick={() => { const el = video.current; if (el) el.muted = !el.muted; }}>静音切换</button>
            <button onClick={() => video.current?.requestFullscreen?.()}>全屏</button>
            {'pictureInPictureEnabled' in document && document.pictureInPictureEnabled && (
              <button onClick={() => video.current?.requestPictureInPicture?.()}>画中画</button>
            )}
          </div>
          {sourceCount > 1 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted [&_button]:min-h-10 [&_button]:rounded-lg [&_button]:border [&_button]:border-line [&_button]:bg-raised [&_button]:px-3 [&_button]:py-2">
              <span>备用源</span>
              {channel.sources.map((source, index) => (
                <button
                  key={`${source.url}-${index}`}
                  type="button"
                  className={index === state.sourceIndex ? 'border-cyan! text-cyan!' : ''}
                  onClick={() => setState(current => chooseSource(current, index))}
                >来源 {index + 1}</button>
              ))}
            </div>
          )}
          {channel.geoBlocked && <p className="rounded-lg border border-[#2c5e75] bg-[#1a3a4a] px-3 py-2 text-sm text-[#b6e0ee]">此频道可能受地区限制</p>}
        </div>
      </div>
    </div>
  );
}
