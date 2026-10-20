import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ListVideo, Maximize2, Play, RotateCcw, Star, X } from 'lucide-react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import type { Channel } from '../data/types';
import { beginSession, chooseSource, nextSource, type SourceState } from './sourceMachine';
import { getSwipeDirection, type Direction } from './channelNavigation';
import { CaptionControls } from './CaptionControls';
import { browserCaptionAdapter } from './captions/browser';
import { CaptionSession, type CaptionSnapshot } from './captions/session';
import { attachLiveSubtitleTrack, type SubtitlePlayer } from './captions/liveSubtitleTrack';
import { useMediaQuery } from '../utils/useMediaQuery';
import { usePlayerChrome } from './usePlayerChrome';
import { resolvePlaybackUrl } from './playbackSource';

const initial: SourceState = { session: 0, phase: 'idle', sourceIndex: 0, sourceCount: 0, cancelled: false };
const initialCaptions: CaptionSnapshot = { phase: 'idle', text: '', message: '', progress: 0 };

interface Props {
  open: boolean;
  expanded?: boolean;
  channel: Channel;
  categoryName?: string;
  onboardingRequired?: boolean;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  onOnboardingComplete?: () => void;
  onBrowse?: () => void;
  onNavigate: (direction: Direction) => void;
  onPlaying: (id: string) => void;
  onClose: () => void;
}

const interactiveSelector = 'button, a, input, select, textarea, [role="button"], .vjs-control-bar, .vjs-menu, .vjs-big-play-button, .vjs-modal-dialog';
/**
 * How long to wait for an HLS source to reach the `playing` event before giving up
 * and trying the next source. The timer is reset on every `progress` / `loadstart`
 * event so a slow CDN never trips this while fragments are still flowing in — only
 * a stream that has gone silent for the full window is considered dead.
 */
const SOURCE_LOAD_TIMEOUT_MS = 30_000;

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(interactiveSelector));
}

export function PlayerModal({ open, expanded = true, channel, categoryName, onboardingRequired = false, favorite = false, onToggleFavorite, onOnboardingComplete, onBrowse, onNavigate, onPlaying, onClose }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const onboarding = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const player = useRef<ReturnType<typeof videojs> | null>(null);
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);
  /**
   * Tracks whether the most recent touch sequence already toggled the UI overlay.
   * Used to skip the synthetic `click` that some browsers fire after `touchend`,
   * which would otherwise double-toggle. Reset on every `touchstart`.
   */
  const tapHandledRef = useRef(false);
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
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const onboardingHandled = useRef(false);
  const [state, setState] = useState<SourceState>(initial);
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  const [playerPaused, setPlayerPaused] = useState(false);
  const isMobile = useMediaQuery('(max-width: 639px) and (pointer: coarse)');
  const immersive = expanded && isMobile;
  const chrome = usePlayerChrome({ playing: state.phase === 'playing' && !playerPaused, expanded, autoHide: isMobile, blocking: state.phase !== 'playing' || sourceMenuOpen || onboardingVisible, channelId: channel.id });
  const chromeVisibleRef = useRef(chrome.visible);
  const onboardingVisibleRef = useRef(onboardingVisible);
  chromeVisibleRef.current = chrome.visible;
  onboardingVisibleRef.current = onboardingVisible;
  const [captions, setCaptions] = useState<CaptionSnapshot>(initialCaptions);
  onPlayingRef.current = onPlaying;
  if (!captionSession.current) {
    captionSession.current = new CaptionSession(browserCaptionAdapter, snapshot => {
      if (mounted.current) setCaptions(snapshot);
      if (snapshot.text) subtitleTrack.current?.show(snapshot.text);
      else subtitleTrack.current?.clear();
    });
  }

  useEffect(() => {
    if (!open || !immersive || !onboardingRequired || onboardingHandled.current) return;
    onboardingHandled.current = true;
    setOnboardingVisible(true);
  }, [open, immersive, onboardingRequired]);

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
    if (!open || !immersive) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open, immersive]);

  useEffect(() => {
    if (!open || !immersive) return;
    restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const backgrounds = [document.querySelector('.app-header'), document.querySelector('.app-footer'), document.querySelector('.watch-queue'), document.querySelector('.app-notice')].filter((node): node is HTMLElement => node instanceof HTMLElement);
    const previousInert = backgrounds.map(node => node.inert);
    backgrounds.forEach(node => { node.inert = true; });
    const focusables = () => {
      const root = onboardingVisibleRef.current ? onboarding.current : stage.current;
      return [...(root?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), video-js [tabindex="0"]') ?? [])].filter(node => !node.closest('[inert]') && node.getAttribute('aria-hidden') !== 'true');
    };
    const focusInitial = () => {
      const candidates = focusables();
      (onboardingVisibleRef.current ? onboarding.current?.querySelector<HTMLElement>('button') : candidates[0])?.focus();
      // Programmatic initial focus must not pin the controls open. A real focus
      // move inside the player is tracked by the subsequent focus events.
      chrome.blur();
    };
    const frame = requestAnimationFrame(focusInitial);
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const candidates = focusables();
      if (!chromeVisibleRef.current) {
        event.preventDefault();
        chrome.reveal();
        requestAnimationFrame(() => focusables()[0]?.focus());
        return;
      }
      if (!candidates.length) return;
      const first = candidates[0], last = candidates[candidates.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', trap);
      backgrounds.forEach((node, index) => { node.inert = previousInert[index]; });
      restoreFocus.current?.focus();
    };
  }, [open, immersive, channel.id, chrome.blur, chrome.reveal]);

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
    const paused = () => { captionSession.current?.pause(); setPlayerPaused(true); };
    const resumed = () => setPlayerPaused(false);
    instance.on('pause', paused);
    instance.on('play', resumed);
    player.current = instance;
    setState(previous => beginSession(previous, channel.sources.length));
    setPlayerPaused(false);
    setSourceMenuOpen(false);
    return () => {
      instance.off('pause', paused);
      instance.off('play', resumed);
      subtitleTrack.current?.dispose();
      subtitleTrack.current = null;
      player.current = null;
      instance.dispose();
    };
  }, [open, channel.id]);

  useEffect(() => {
    if (!open || !immersive) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, immersive, onClose]);

  useEffect(() => {
    const instance = player.current;
    const source = channel.sources[state.sourceIndex];
    if (!open || !instance || !source || state.cancelled || state.phase === 'failed' || state.phase === 'idle') return;
    const session = state.session;
    const sourceIndex = state.sourceIndex;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let failureStarted = false;
    let hasPlayed = false;
    const fail = () => {
      if (stopped || failureStarted) return;
      failureStarted = true;
      setState(current => nextSource(current, session));
      setPlayerPaused(false);
    };
    const playing = () => {
      if (stopped || failureStarted) return;
      hasPlayed = true;
      if (timer) clearTimeout(timer);
      timer = undefined;
      setState(current => current.session === session && current.sourceIndex === sourceIndex ? { ...current, phase: 'playing' } : current);
      userActivatedRef.current = true;
      onPlayingRef.current(channel.id);
      captionSession.current?.resume();
    };
    // Re-arms the fail timer every time the stream is actively making progress so a
    // slow CDN never trips the failure path mid-buffering — only a stream that has
    // gone silent for SOURCE_LOAD_TIMEOUT_MS is considered dead.
    const scheduleTimeout = (afterPlaybackStall = false) => {
      if (stopped || failureStarted || (hasPlayed && !afterPlaybackStall)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(fail, SOURCE_LOAD_TIMEOUT_MS);
    };
    const error = () => {
      // HLS may report a late error while buffered media is still advancing.
      // Waiting/stalled events still start a timeout if playback actually stops.
      if (hasPlayed && !instance.paused() && instance.readyState() >= 2) return;
      fail();
    };
    const stalled = () => scheduleTimeout(true);
    instance.on('error', error);
    instance.on('playing', playing);
    instance.on('loadstart', scheduleTimeout);
    instance.on('progress', scheduleTimeout);
    instance.on('waiting', stalled);
    instance.on('stalled', stalled);
    instance.ready(() => {
      if (stopped) return;
      instance.error(null);
      instance.src({ src: resolvePlaybackUrl(source.url, { proxy: import.meta.env.VITE_HLS_PROXY }), type: 'application/x-mpegURL' });
      scheduleTimeout();
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
      instance.off('error', error);
      instance.off('playing', playing);
      instance.off('loadstart', scheduleTimeout);
      instance.off('progress', scheduleTimeout);
      instance.off('waiting', stalled);
      instance.off('stalled', stalled);
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
    tapHandledRef.current = false;
    if (onboardingVisible || !window.matchMedia('(max-width: 639px) and (pointer: coarse)').matches
      || event.touches.length !== 1 || isInteractiveTarget(event.target)) return;
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  };

  const onTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (onboardingVisible) { tapHandledRef.current = false; return; }
    if (isInteractiveTarget(event.target)) {
      tapHandledRef.current = false;
      return;
    }
    if (start && event.changedTouches.length === 1) {
      const touch = event.changedTouches[0];
      const direction = getSwipeDirection(start, { x: touch.clientX, y: touch.clientY, time: Date.now() });
      if (direction) {
        captionSession.current?.invalidate();
        onNavigate(direction);
        tapHandledRef.current = true; // a stray synthetic click after a swipe should not toggle UI
        return;
      }
    }
    // Touch reveals and restarts the controls timer; it never pauses playback.
    tapHandledRef.current = true;
    chrome.reveal();
  };

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
  const chromeClass = `transition-opacity duration-300 ${chrome.visible ? 'opacity-100' : 'pointer-events-none opacity-0'}`;

  return (
    <div className={immersive ? "fixed inset-0 z-50 flex items-center justify-center bg-black/90 sm:p-4" : expanded ? "relative h-full w-full" : "player-engine"} onClick={immersive ? onClose : undefined}>
      {!expanded && <div className="player-engine-host" ref={host} aria-hidden />}
      {expanded && <div
        ref={stage}
        className={immersive ? "relative h-dvh w-full overflow-hidden bg-black text-white shadow-2xl" : "relative aspect-video w-full overflow-hidden rounded-xl border border-line bg-transparent text-white"}
        role={immersive ? "dialog" : undefined}
        aria-modal={immersive || undefined}
        aria-label={`播放器：${channel.name}`}
        onClick={event => { event.stopPropagation(); const wasTouchHandled = tapHandledRef.current; tapHandledRef.current = false; if (wasTouchHandled) return; if (!isInteractiveTarget(event.target)) chrome.reveal(); }}
        onFocusCapture={chrome.focus}
        onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) chrome.blur(); }}
        onTouchStartCapture={onTouchStart}
        onTouchMoveCapture={event => { if (event.touches.length !== 1) touchStart.current = null; }}
        onTouchEndCapture={onTouchEnd}
        onTouchCancelCapture={() => { touchStart.current = null; tapHandledRef.current = false; }}
      >
        {/* Video.js mounts here. Kept inside the stage so every chrome layer
            positions against the same box instead of a separate sibling. */}
        <div className="absolute inset-0" ref={host} aria-hidden />

        <div inert={!chrome.visible} className={`pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 bg-gradient-to-b from-black/85 to-transparent px-4 pt-[max(16px,env(safe-area-inset-top))] pb-10 sm:px-5 sm:pt-4 ${chromeClass}`}>
          <div className="min-w-0">
            <p className="text-[11px] tracking-wider text-cyan">{categoryName ?? (channel.countryCode || '频道播放')}</p>
            <h2 className="truncate text-base font-semibold sm:text-lg">{channel.name}</h2>
            {channel.geoBlocked && <p className="text-xs text-white/70">可能受地区限制</p>}
          </div>
          <div className="pointer-events-auto flex shrink-0 gap-2">
            {onBrowse && <button type="button" className="grid size-11 place-items-center rounded-full bg-black/55 text-white" onClick={onBrowse} aria-label="选台"><ListVideo size={20} aria-hidden="true" /></button>}
            <button type="button" className="grid size-11 place-items-center rounded-full bg-black/55 text-white hover:bg-black/80" onClick={onClose} aria-label="返回"><X size={22} aria-hidden="true" /></button>
          </div>
        </div>

        {immersive && onboardingVisible && (
          <div ref={onboarding} className="absolute inset-0 z-40 grid place-items-center bg-[#06121bea] px-8 text-center" role="dialog" aria-modal="true" aria-labelledby="swipe-guide-title">
            <div><div className="text-4xl text-cyan" aria-hidden="true">↕</div><h2 id="swipe-guide-title" className="mt-5 text-xl font-semibold">上下滑动，切换频道</h2><p className="mt-2 text-sm text-white/75">只在{categoryName ?? '当前分类'}中切换</p><p className="mt-2 text-sm text-white/75">轻触画面，显示播放操作</p><button type="button" className="mt-7 min-h-11 rounded-full bg-cyan px-7 font-semibold text-[#102334]" onClick={() => { setOnboardingVisible(false); onOnboardingComplete?.(); chrome.reveal(); }}>开始观看</button></div>
          </div>
        )}

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

        <div className={`${chromeClass} ${expanded ? '' : 'hidden'}`} inert={!chrome.visible}>
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

          {onToggleFavorite && <button type="button" className="absolute top-20 right-4 z-20 grid size-10 place-items-center rounded-full bg-[#07172aeb] text-white" aria-label={favorite ? '取消收藏' : '收藏'} aria-pressed={favorite} onClick={onToggleFavorite}><Star size={18} fill={favorite ? 'currentColor' : 'none'} aria-hidden="true" /></button>}
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
      </div>}
    </div>
  );
}
