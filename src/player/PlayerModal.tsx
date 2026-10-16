import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ListVideo, Maximize2, Play, RotateCcw, X } from 'lucide-react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import type { Channel, CountrySummary } from '../data/types';
import { beginSession, chooseSource, nextSource, type SourceState } from './sourceMachine';
import { getSwipeDirection, type Direction } from './channelNavigation';
import { CaptionControls } from './CaptionControls';
import { browserCaptionAdapter } from './captions/browser';
import { CaptionSession, type CaptionSnapshot } from './captions/session';
import { attachLiveSubtitleTrack, type SubtitlePlayer } from './captions/liveSubtitleTrack';
import { useMediaQuery } from '../utils/useMediaQuery';

const initial: SourceState = { session: 0, phase: 'idle', sourceIndex: 0, sourceCount: 0, cancelled: false };
const initialCaptions: CaptionSnapshot = { phase: 'idle', text: '', message: '', progress: 0 };

interface Props {
  open: boolean;
  channel: Channel;
  country?: CountrySummary;
  channelPosition?: { current: number; total: number };
  onNavigate: (direction: Direction) => void;
  onPlaying: (id: string) => void;
  onClose: () => void;
}

const interactiveSelector = 'button, a, input, select, textarea, [role="button"], .vjs-control-bar, .vjs-menu, .vjs-big-play-button, .vjs-modal-dialog';
const AUTO_HIDE_MS = 3500;

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(interactiveSelector));
}

export function PlayerModal({ open, channel, country, channelPosition, onNavigate, onPlaying, onClose }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<ReturnType<typeof videojs> | null>(null);
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const onPlayingRef = useRef(onPlaying);
  const captionSession = useRef<CaptionSession | null>(null);
  const subtitleTrack = useRef<ReturnType<typeof attachLiveSubtitleTrack> | null>(null);
  const mounted = useRef(true);
  /**
   * Becomes `true` once the user has activated playback (tapped the awaiting-gesture
   * button or a source has started playing). Once true, channel/source switches that
   * hit `NotAllowedError` fall through to the next source instead of showing the
   * awaiting-gesture button again — otherwise swiping through channels gets stuck
   * on a play button after every switch.
   */
  const userActivatedRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<SourceState>(initial);
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  const [captions, setCaptions] = useState<CaptionSnapshot>(initialCaptions);
  const [uiVisible, setUiVisible] = useState(true);
  const isMobile = useMediaQuery('(max-width: 639px) and (pointer: coarse)');
  onPlayingRef.current = onPlaying;
  if (!captionSession.current) {
    captionSession.current = new CaptionSession(browserCaptionAdapter, snapshot => {
      if (mounted.current) setCaptions(snapshot);
      if (snapshot.text) subtitleTrack.current?.show(snapshot.text);
      else subtitleTrack.current?.clear();
    });
  }

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  // Reset UI visibility when the channel or source changes so the new context is briefly visible.
  useEffect(() => {
    setUiVisible(true);
  }, [channel.id, state.sourceIndex]);

  // Auto-hide the page-level UI when the video is actually playing.
  // Stays visible in loading/failed/awaiting-gesture so the user can still act.
  useEffect(() => {
    if (!uiVisible || state.phase !== 'playing') {
      clearHideTimer();
      return;
    }
    hideTimerRef.current = setTimeout(() => setUiVisible(false), AUTO_HIDE_MS);
    return clearHideTimer;
  }, [uiVisible, state.phase, clearHideTimer]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      captionSession.current?.stop();
      subtitleTrack.current?.dispose();
      subtitleTrack.current = null;
    };
  }, []);

  useEffect(() => {
    if (!open) captionSession.current?.stop();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

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
    const paused = () => captionSession.current?.pause();
    instance.on('pause', paused);
    player.current = instance;
    setState(previous => beginSession(previous, channel.sources.length));
    setSourceMenuOpen(false);
    return () => {
      instance.off('pause', paused);
      subtitleTrack.current?.dispose();
      subtitleTrack.current = null;
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
      userActivatedRef.current = true;
      onPlayingRef.current(channel.id);
      captionSession.current?.resume();
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
          if (userActivatedRef.current) {
            // Already activated: skip awaiting-gesture and try the next source
            // so swipe-to-switch never gets stuck on a play button.
            fail();
          } else {
            setState(current => current.session === session ? { ...current, phase: 'awaiting-gesture' } : current);
          }
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

  useEffect(() => {
    captionSession.current?.invalidate();
  }, [channel.id, state.sourceIndex]);

  useEffect(() => {
    if (state.phase === 'failed') captionSession.current?.stop();
  }, [state.phase]);

  useEffect(() => {
    const instance = player.current;
    const enabled = captions.phase === 'ready' || captions.phase === 'needs-consent' || captions.phase === 'capturing' || captions.phase === 'active' || captions.phase === 'paused';
    if (!instance || !enabled) {
      subtitleTrack.current?.dispose();
      subtitleTrack.current = null;
      return;
    }
    if (!subtitleTrack.current) subtitleTrack.current = attachLiveSubtitleTrack(instance as unknown as SubtitlePlayer<VTTCue>);
    if (captions.text) subtitleTrack.current.show(captions.text);
    else subtitleTrack.current.clear();
  }, [captions.phase, captions.text, channel.id]);

  const onTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStart.current = null;
    if (!channelPosition || channelPosition.total < 2
      || !window.matchMedia('(max-width: 639px) and (pointer: coarse)').matches
      || event.touches.length !== 1 || isInteractiveTarget(event.target)) return;
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  };

  const onTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || event.changedTouches.length !== 1 || isInteractiveTarget(event.target)) return;
    const touch = event.changedTouches[0];
    const direction = getSwipeDirection(start, { x: touch.clientX, y: touch.clientY, time: Date.now() });
    if (direction) {
      captionSession.current?.invalidate();
      onNavigate(direction);
    }
  };

  const toggleUi = useCallback(() => {
    if (uiVisible) {
      setUiVisible(false);
      clearHideTimer();
    } else {
      setUiVisible(true);
      clearHideTimer();
    }
  }, [uiVisible, clearHideTimer]);

  const enterLandscapeFullscreen = useCallback(async () => {
    const instance = player.current;
    if (!instance) return;
    try {
      await instance.requestFullscreen();
    } catch {
      /* fullscreen may fail inside cross-origin frames; the orientation lock below can still help. */
    }
    const orientation = (screen as Screen & { orientation?: { lock?: (orientation: 'landscape' | 'portrait' | 'any') => Promise<void> } }).orientation;
    if (orientation && typeof orientation.lock === 'function') {
      try { await orientation.lock('landscape'); } catch { /* user agent may reject the lock; that's fine. */ }
    }
  }, []);

  if (!open) return null;

  const showSourceMenu = channel.sources.length > 1 && state.phase !== 'failed';
  const chromeClass = `transition-opacity duration-300 ${uiVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 sm:p-4" onClick={onClose}>
      <div
        className="relative h-dvh w-full overflow-hidden bg-black text-white shadow-2xl sm:aspect-video sm:h-auto sm:max-w-[960px] sm:rounded-2xl sm:border sm:border-line"
        role="dialog"
        aria-modal="true"
        aria-label={`播放器：${channel.name}`}
        onClick={event => { event.stopPropagation(); if (!isInteractiveTarget(event.target)) toggleUi(); }}
        onTouchStartCapture={onTouchStart}
        onTouchMoveCapture={event => { if (event.touches.length !== 1) touchStart.current = null; }}
        onTouchEndCapture={onTouchEnd}
        onTouchCancelCapture={() => { touchStart.current = null; }}
      >
        <div
          className="absolute inset-0"
          ref={host}
        />

        <div className={`pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 bg-gradient-to-b from-black/85 to-transparent px-4 pt-[max(16px,env(safe-area-inset-top))] pb-10 sm:px-5 sm:pt-4 ${chromeClass}`}>
          <div className="min-w-0">
            <p className="text-[11px] tracking-wider text-cyan">{country?.nameZh ?? channel.countryCode}</p>
            <h2 className="truncate text-base font-semibold sm:text-lg">{channel.name}</h2>
            {channel.geoBlocked && <p className="text-xs text-white/70">可能受地区限制</p>}
          </div>
          <button
            type="button"
            className={`grid size-11 shrink-0 place-items-center rounded-full bg-black/55 text-white hover:bg-black/80 ${uiVisible ? 'pointer-events-auto' : 'pointer-events-none'}`}
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
              onClick={() => { userActivatedRef.current = true; setState(current => beginSession(current, channel.sources.length)); }}
            ><RotateCcw size={18} aria-hidden="true" />重试</button>
          </div>
        )}

        {state.phase === 'awaiting-gesture' && (
          <button
            type="button"
            className="absolute top-1/2 left-1/2 z-10 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-cyan text-[#102334] shadow-xl"
            onClick={() => { userActivatedRef.current = true; player.current?.play()?.catch(() => {}); }}
            aria-label="开始播放"
          ><Play size={28} fill="currentColor" aria-hidden="true" /></button>
        )}

        <div className={chromeClass}>
          {channelPosition && channelPosition.total > 1 && (
            <div className="pointer-events-none absolute bottom-[calc(4rem+env(safe-area-inset-bottom))] left-3 z-20 rounded-xl bg-[#07172acc] px-3 py-2 text-xs text-white/80 sm:hidden" role="status">
              <span className="font-medium text-white">{channelPosition.current} / {channelPosition.total}</span>
              <span className="ml-2">上下滑动切换频道</span>
            </div>
          )}

          <CaptionControls
            snapshot={captions}
            unsupported={browserCaptionAdapter.supported()}
            onPrepare={language => { void captionSession.current?.prepare(language); }}
            onStart={allowOnline => { void captionSession.current?.start(allowOnline); }}
            onStop={() => captionSession.current?.stop()}
            hasSourceMenu={showSourceMenu}
            sourceMenuOpen={sourceMenuOpen}
            isMobile={isMobile}
          />

          {isMobile && (
            <button
              type="button"
              className={`absolute bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 grid size-10 place-items-center rounded-full bg-[#07172aeb] text-white shadow-lg hover:bg-[#173353] ${showSourceMenu ? 'right-16' : 'right-3'}`}
              onClick={enterLandscapeFullscreen}
              aria-label="横屏全屏播放"
              title="横屏全屏播放"
            ><Maximize2 size={20} aria-hidden="true" /></button>
          )}

          {showSourceMenu && (
            <div className="absolute right-3 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 sm:right-4 sm:bottom-16">
              {sourceMenuOpen && (
                <div className="absolute right-0 bottom-12 max-h-56 w-40 overflow-y-auto rounded-xl border border-white/20 bg-[#10263a] p-1.5 shadow-2xl" role="group" aria-label="选择直播源">
                  {channel.sources.map((source, index) => (
                    <button
                      key={`${source.url}-${index}`}
                      type="button"
                      className={`flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-left text-sm hover:bg-white/10 ${index === state.sourceIndex ? 'text-cyan' : 'text-white'}`}
                      onClick={() => { captionSession.current?.invalidate(); setState(current => chooseSource(current, index)); setSourceMenuOpen(false); }}
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
    </div>
  );
}
