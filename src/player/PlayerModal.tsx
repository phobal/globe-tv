import { useEffect, useRef, useState } from 'react';
import { Check, ListVideo, Play, RotateCcw, X } from 'lucide-react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import type { Channel, CountrySummary } from '../data/types';
import { beginSession, chooseSource, nextSource, type SourceState } from './sourceMachine';

const initial: SourceState = { session: 0, phase: 'idle', sourceIndex: 0, sourceCount: 0, cancelled: false };

interface Props {
  open: boolean;
  channel: Channel;
  country?: CountrySummary;
  onPlaying: (id: string) => void;
  onClose: () => void;
}

export function PlayerModal({ open, channel, country, onPlaying, onClose }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<ReturnType<typeof videojs> | null>(null);
  const onPlayingRef = useRef(onPlaying);
  const [state, setState] = useState<SourceState>(initial);
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  onPlayingRef.current = onPlaying;

  useEffect(() => {
    if (!open || !host.current) return;
    const element = document.createElement('video-js');
    element.setAttribute('playsinline', '');
    element.classList.add('text-sm!');
    host.current.appendChild(element);
    const instance = videojs(element, {
      controls: true,
      autoplay: false,
      preload: 'auto',
      liveui: true,
      responsive: true,
      fluid: false,
      fill: true,
      bigPlayButton: true,
      controlBar: {
        playToggle: true,
        volumePanel: { inline: false },
        pictureInPictureToggle: true,
        fullscreenToggle: true,
      },
    });
    instance.getChild('ControlBar')?.el().classList.add('h-[calc(3rem+env(safe-area-inset-bottom))]!', 'bg-[#07172aeb]!', 'pb-[env(safe-area-inset-bottom)]!');
    player.current = instance;
    setState(previous => beginSession(previous, channel.sources.length));
    setSourceMenuOpen(false);
    return () => {
      player.current = null;
      instance.dispose();
    };
  }, [open, channel.id]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    const instance = player.current;
    const source = channel.sources[state.sourceIndex];
    if (!open || !instance || !source || state.cancelled || state.phase === 'failed' || state.phase === 'idle') return;
    const session = state.session;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const fail = () => {
      if (stopped) return;
      setState(current => nextSource(current, session));
    };
    const playing = () => {
      if (stopped) return;
      if (timer) clearTimeout(timer);
      setState(current => current.session === session ? { ...current, phase: 'playing' } : current);
      onPlayingRef.current(channel.id);
    };
    instance.on('error', fail);
    instance.on('playing', playing);
    instance.ready(() => {
      if (stopped) return;
      instance.error(null);
      instance.src({ src: source.url, type: 'application/x-mpegURL' });
      timer = setTimeout(fail, 15_000);
      Promise.resolve(instance.play()).catch(error => {
        if (stopped) return;
        if (error?.name === 'NotAllowedError') {
          if (timer) clearTimeout(timer);
          setState(current => current.session === session ? { ...current, phase: 'awaiting-gesture' } : current);
        } else fail();
      });
    });
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      instance.off('error', fail);
      instance.off('playing', playing);
    };
  }, [open, channel.id, state.session, state.sourceIndex, state.phase === 'failed', state.cancelled]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 sm:p-4" onClick={onClose}>
      <div
        className="relative h-dvh w-full overflow-hidden bg-black text-white shadow-2xl sm:aspect-video sm:h-auto sm:max-w-[960px] sm:rounded-2xl sm:border sm:border-line"
        role="dialog"
        aria-modal="true"
        aria-label={`播放器：${channel.name}`}
        onClick={event => event.stopPropagation()}
      >
        <div
          className="absolute inset-0"
          ref={host}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 bg-gradient-to-b from-black/85 to-transparent px-4 pt-[max(16px,env(safe-area-inset-top))] pb-10 sm:px-5 sm:pt-4">
          <div className="min-w-0">
            <p className="text-[11px] tracking-wider text-cyan">{country?.nameZh ?? channel.countryCode}</p>
            <h2 className="truncate text-base font-semibold sm:text-lg">{channel.name}</h2>
            {channel.geoBlocked && <p className="text-xs text-white/70">可能受地区限制</p>}
          </div>
          <button
            type="button"
            className="pointer-events-auto grid size-11 shrink-0 place-items-center rounded-full bg-black/55 text-white hover:bg-black/80"
            onClick={onClose}
            aria-label="关闭播放器"
          ><X size={22} aria-hidden="true" /></button>
        </div>

        {state.phase === 'failed' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center">
            <p className="text-sm text-white/80">所有直播源均无法播放</p>
            <button
              type="button"
              className="flex min-h-11 items-center gap-2 rounded-full bg-cyan px-5 font-semibold text-[#102334]"
              onClick={() => setState(current => beginSession(current, channel.sources.length))}
            ><RotateCcw size={18} aria-hidden="true" />重试</button>
          </div>
        )}

        {state.phase === 'awaiting-gesture' && (
          <button
            type="button"
            className="absolute top-1/2 left-1/2 z-10 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-cyan text-[#102334] shadow-xl"
            onClick={() => player.current?.play()?.catch(() => {})}
            aria-label="开始播放"
          ><Play size={28} fill="currentColor" aria-hidden="true" /></button>
        )}

        {channel.sources.length > 1 && state.phase !== 'failed' && (
          <div className="absolute right-3 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 sm:right-4 sm:bottom-16">
            {sourceMenuOpen && (
              <div className="absolute right-0 bottom-12 max-h-56 w-40 overflow-y-auto rounded-xl border border-white/20 bg-[#10263a] p-1.5 shadow-2xl" role="group" aria-label="选择直播源">
                {channel.sources.map((source, index) => (
                  <button
                    key={`${source.url}-${index}`}
                    type="button"
                    className={`flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-left text-sm hover:bg-white/10 ${index === state.sourceIndex ? 'text-cyan' : 'text-white'}`}
                    onClick={() => { setState(current => chooseSource(current, index)); setSourceMenuOpen(false); }}
                    aria-current={index === state.sourceIndex ? 'true' : undefined}
                  >来源 {index + 1}{index === state.sourceIndex && <Check size={14} aria-hidden="true" />}</button>
                ))}
              </div>
            )}
            <button
              type="button"
              className="grid size-10 place-items-center rounded-full bg-[#07172aeb] text-white shadow-lg hover:bg-[#173353]"
              onClick={() => setSourceMenuOpen(value => !value)}
              aria-label={`切换直播源，当前来源 ${state.sourceIndex + 1}`}
              aria-expanded={sourceMenuOpen}
            ><ListVideo size={20} aria-hidden="true" /></button>
          </div>
        )}
      </div>
    </div>
  );
}
