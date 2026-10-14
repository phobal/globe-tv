import { useCallback, useEffect, useState } from 'react';
import { loadCountry, loadIndex } from '../data/catalog';
import type { CatalogIndex, Channel } from '../data/types';
import { parseDeepLink, linkTo } from '../routing/deepLinks';
import { readPreferences, savePreferences, markRecentlyPlayed } from '../preferences/storage';
import { Globe } from '../globe/Globe';
import { SidePanel } from '../sidepanel/SidePanel';
import { PlayerModal } from '../player/PlayerModal';
import { Header } from '../header/Header';

export function App() {
  const [index, setIndex] = useState<CatalogIndex>();
  const [indexError, setIndexError] = useState('');
  const [countryCode, setCountryCode] = useState<string>();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [countryError, setCountryError] = useState('');
  const [countryRetry, setCountryRetry] = useState(0);
  const [loadingCountry, setLoadingCountry] = useState(false);
  const [playing, setPlaying] = useState<Channel>();
  const [playerOpen, setPlayerOpen] = useState(false);
  const [missingId, setMissingId] = useState<string>();
  const [featuredId, setFeaturedId] = useState<string>();
  const [message, setMessage] = useState('');
  const [globeFailed, setGlobeFailed] = useState(false);
  const [sideOpen, setSideOpen] = useState(true);
  const [preferences, setPreferences] = useState(readPreferences);
  const country = index?.countries.find(item => item.code === countryCode);
  const playingCountry = index?.countries.find(item => item.code === playing?.countryCode);

  const refreshIndex = useCallback(() => {
    loadIndex().then(setIndex).catch(error => setIndexError(String(error)));
  }, []);
  useEffect(refreshIndex, [refreshIndex]);

  useEffect(() => {
    if (!index) return;
    const deep = parseDeepLink(location.search);
    if (deep.invalid || (deep.country && !index.countries.some(item => item.code === deep.country))) {
      setMessage('链接参数无效，已返回首页。'); return;
    }
    if (deep.country) {
      setSideOpen(true);
      setCountryCode(deep.country);
      if (deep.channel) { setMissingId(deep.channel); setFeaturedId(deep.channel); }
    }
  }, [index]);

  useEffect(() => {
    if (!countryCode) { setChannels([]); return; }
    let live = true;
    setLoadingCountry(true); setCountryError(''); setChannels([]);
    loadCountry(countryCode)
      .then(data => { if (live) { setChannels(data); setLoadingCountry(false); } })
      .catch(error => { if (live) { setCountryError(String(error)); setLoadingCountry(false); } });
    return () => { live = false; };
  }, [countryCode, countryRetry]);

  useEffect(() => {
    if (missingId && channels.some(item => item.id === missingId)) setMissingId(undefined);
  }, [channels, missingId]);

  useEffect(() => { savePreferences(preferences); }, [preferences]);

  const selectCountry = (code: string) => {
    if (!index?.countries.some(item => item.code === code)) return;
    setCountryCode(code);
    setMissingId(undefined);
    setFeaturedId(undefined);
    history.replaceState({}, '', linkTo(code));
  };

  const play = (channel: Channel) => {
    setPlaying(channel);
    setMissingId(undefined);
    setFeaturedId(undefined);
    setPlayerOpen(true);
    history.replaceState({}, '', linkTo(channel.countryCode, channel.id));
  };

  const closePlayer = () => {
    setPlayerOpen(false);
  };

  const switchChannel = (channel: Channel) => {
    if (channel.countryCode !== countryCode) setCountryCode(channel.countryCode);
    setPlaying(channel);
    setFeaturedId(channel.id);
    setMissingId(undefined);
  };

  const selectChannel = async (code: string, id: string) => {
    selectCountry(code);
    try {
      const data = await loadCountry(code);
      const channel = data.find(item => item.id === id);
      if (channel) play(channel); else setMissingId(id);
    } catch {
      setMessage('频道加载失败，请重试。');
    }
  };

  const toggleFavorite = (id: string) => setPreferences(current => ({
    ...current,
    favorites: current.favorites.includes(id)
      ? current.favorites.filter(item => item !== id)
      : [...current.favorites, id],
  }));
  const removeSaved = (id: string) => setPreferences(current => ({
    favorites: current.favorites.filter(item => item !== id),
    recent: current.recent.filter(item => item !== id),
  }));
  const onPlaying = (id: string) => setPreferences(current => markRecentlyPlayed(current, id));
  const canGlobe = !globeFailed && typeof WebGLRenderingContext !== 'undefined';

  return (
    <div className={`app ${playerOpen ? 'is-playing' : ''}`}>
      {index && (
        <Header
          sideOpen={sideOpen}
          onToggleSide={() => setSideOpen(value => !value)}
          playing={playing}
          onOpenPlayer={() => setPlayerOpen(true)}
          onClosePlayer={closePlayer}
          index={index}
          preferences={preferences}
          onPickCountry={selectCountry}
          onSelectChannel={selectChannel}
          onRemoveSaved={removeSaved}
        />
      )}

      {message && (
        <div className="app-message" role="status">
          {message}
          <button onClick={() => setMessage('')}>关闭</button>
        </div>
      )}

      {indexError ? (
        <main className="fatal" role="alert">
          <h1>频道数据加载失败</h1>
          <p>{indexError}</p>
          <button onClick={() => { setIndexError(''); refreshIndex(); }}>重试</button>
        </main>
      ) : !index ? (
        <main className="fatal" role="status">正在加载地球电视…</main>
      ) : (
        <main className={`workspace ${sideOpen ? 'with-side' : 'no-side'}`}>
          <section className="explore">
            <div className="explore-heading">
              <div>
                <small>探索世界 · 实时直播</small>
                <h1>{country ? country.nameZh : '从世界的某个角落开始'}</h1>
              </div>
            </div>
            {canGlobe ? (
              <Globe
                countries={index.countries}
                selectedCode={countryCode}
                onSelect={(code) => { selectCountry(code); setSideOpen(true); }}
                onFailure={() => setGlobeFailed(true)}
              />
            ) : (
              <div className="globe-fallback">
                <p>此设备无法显示 3D 地球，可使用右侧面板继续选台。</p>
              </div>
            )}
            <div className="explore-foot">
              <span>拖动旋转地球 · 点击国家查看频道</span>
              <span>{index.countries.length} 个国家和地区 · {index.channels.length} 个频道</span>
            </div>
          </section>
          {sideOpen && (
            <aside className="sidepanel" aria-label="国家与频道列表">
              <SidePanel
                index={index}
                countries={index.countries}
                countryCode={countryCode}
                channels={channels}
                loading={loadingCountry}
                error={countryError}
                favorites={preferences.favorites}
                featuredId={featuredId}
                missingId={missingId}
                onPickCountry={selectCountry}
                onPlay={play}
                onToggleFavorite={toggleFavorite}
                onRetry={() => setCountryRetry(value => value + 1)}
              />
            </aside>
          )}
        </main>
      )}

      {playing && (
        <PlayerModal
          open={playerOpen}
          channel={playing}
          country={playingCountry}
          options={channels}
          onPlaying={onPlaying}
          onClose={closePlayer}
          onSwitch={switchChannel}
        />
      )}

      <footer>
        <span>频道数据：Famelack · MIT 授权</span>
        <span>播放取决于直播源及当前网络</span>
      </footer>
    </div>
  );
}
