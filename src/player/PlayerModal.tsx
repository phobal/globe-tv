import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import type { Channel, CountrySummary } from '../data/types';
import { beginSession, cancelSource, chooseSource, nextSource, type SourceState } from './sourceMachine';

const initial: SourceState = { session: 0, phase: 'idle', sourceIndex: 0, sourceCount: 0, cancelled: false };

interface Props {
  open: boolean;
  channel: Channel;
  country?: CountrySummary;
  options: Channel[];
  onPlaying: (id: string) => void;
  onClose: () => void;
  onSwitch: (channel: Channel) => void;
}

export function PlayerModal({ open, channel, country, options, onPlaying, onClose, onSwitch }: Props) {
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
  const otherChannels = options.filter(item => item.id !== channel.id);

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-panel" role="dialog" aria-modal="true" aria-label="播放器" onClick={event => event.stopPropagation()}>
        <header className="modal-head">
          <div>
            <small>{country?.nameZh ?? channel.countryCode}</small>
            <h2>{channel.name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭播放器">×</button>
        </header>
        <div className="modal-body">
          <div className="video-box">
            <video ref={video} playsInline controls={false} />
            {state.phase !== 'playing' && (
              <div className="video-overlay" role="status">
                {state.phase === 'failed' ? (
                  <>
                    <strong>所有来源均无法播放</strong>
                    <p>可能是源失效、跨域或地区限制。</p>
                    <div className="video-actions">
                      <button onClick={() => setState(current => beginSession(current, sourceCount))}>重试</button>
                      <button onClick={onClose}>关闭</button>
                    </div>
                  </>
                ) : state.phase === 'idle' ? (
                  <>
                    已取消尝试
                    <button onClick={() => setState(current => beginSession(current, sourceCount))}>重新尝试</button>
                  </>
                ) : needsGesture ? (
                  <>
                    浏览器要求手动开始播放
                    <button onClick={() => video.current?.play().catch(() => {})}>点击播放</button>
                  </>
                ) : (
                  <>
                    正在尝试来源 {state.sourceIndex + 1} / {sourceCount}…
                    <button onClick={() => setState(cancelSource)}>取消尝试</button>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="player-controls">
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
            <div className="source-options">
              <span>备用源</span>
              {channel.sources.map((source, index) => (
                <button
                  key={`${source.url}-${index}`}
                  type="button"
                  className={index === state.sourceIndex ? 'active' : ''}
                  onClick={() => setState(current => chooseSource(current, index))}
                >来源 {index + 1}</button>
              ))}
            </div>
          )}
          {channel.geoBlocked && <p className="notice">此频道可能受地区限制</p>}
          {otherChannels.length > 0 && (
            <section className="quick-switch">
              <h3>本台其他频道</h3>
              <ul>
                {otherChannels.map(item => (
                  <li key={item.id}>
                    <button type="button" onClick={() => onSwitch(item)}>
                      <span className="qs-init">{item.name.slice(0, 1)}</span>
                      <span><strong>{item.name}</strong><small>{item.sources.length} 个来源</small></span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
