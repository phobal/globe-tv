import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import type { Channel, CountrySummary } from '../data/types';
import { beginSession, cancelSource, chooseSource, nextSource, type SourceState } from './sourceMachine';

const initial: SourceState = { session: 0, phase: 'idle', sourceIndex: 0, sourceCount: 0, cancelled: false };

export function Player({ channel, country, onPlaying, onClose }: { channel?: Channel; country?: CountrySummary; onPlaying: (id: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<SourceState>(initial);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [needsGesture, setNeedsGesture] = useState(false);
  const activeSession = useRef(0);
  const onPlayingRef = useRef(onPlaying);
  onPlayingRef.current = onPlaying;

  useEffect(() => { if (video.current) video.current.volume = volume; }, [volume]);

  useEffect(() => {
    setNeedsGesture(false);
    setState(previous => beginSession(previous, channel?.sources.length ?? 0));
  }, [channel?.id]);

  useEffect(() => {
    const element = video.current;
    const source = channel?.sources[state.sourceIndex];
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
  }, [channel?.id, state.session, state.sourceIndex, state.phase === 'failed', state.cancelled]);

  if (!channel) return <section className="player empty" aria-label="播放器"><div className="player-placeholder"><span>◉</span><h2>选择一个频道开始观看</h2><p>直播源将由浏览器直接连接。点击频道后才会播放。</p></div></section>;
  const sourceCount = channel.sources.length;
  return <section className="player" aria-label="播放器">
    <div className="player-heading"><div><small>正在观看 · {country?.nameZh ?? channel.countryCode}</small><h2>{channel.name}</h2></div><button type="button" onClick={onClose} aria-label="关闭播放器">×</button></div>
    <div className="video-box"><video ref={video} playsInline controls={false} muted={muted} />
      {state.phase !== 'playing' && <div className="video-overlay" role="status">
        {state.phase === 'failed' ? <>所有来源均无法播放。可能是源失效、跨域或地区限制。<button onClick={() => setState(current => beginSession(current, sourceCount))}>重试</button><button onClick={onClose}>换台</button></> :
         state.phase === 'idle' ? <>已取消尝试<button onClick={() => setState(current => beginSession(current, sourceCount))}>重新尝试</button></> :
         needsGesture ? <>浏览器要求手动开始播放<button onClick={() => video.current?.play().catch(() => {})}>点击播放</button></> :
         <>正在尝试来源 {state.sourceIndex + 1} / {sourceCount}…<button onClick={() => setState(cancelSource)}>取消尝试</button></>}
      </div>}
    </div>
    <div className="player-controls">
      <button onClick={() => { const element = video.current; if (!element) return; if (element.paused) element.play().catch(() => setNeedsGesture(true)); else element.pause(); }}>播放 / 暂停</button>
      <button onClick={() => setMuted(value => !value)}>{muted ? '取消静音' : '静音'}</button>
      <label>音量 <input type="range" min="0" max="1" step="0.05" value={volume} onChange={event => setVolume(Number(event.target.value))} /></label>
      <button onClick={() => video.current?.requestFullscreen?.()}>全屏</button>
      {'pictureInPictureEnabled' in document && document.pictureInPictureEnabled && <button onClick={() => video.current?.requestPictureInPicture?.()}>画中画</button>}
    </div>
    {sourceCount > 1 && <div className="source-options"><span>备用源</span>{channel.sources.map((source, index) => <button key={`${source.url}-${index}`} className={index === state.sourceIndex ? 'active' : ''} onClick={() => setState(current => chooseSource(current, index))}>来源 {index + 1}</button>)}</div>}
    {channel.geoBlocked && <p className="notice">此频道可能受地区限制</p>}
  </section>;
}
