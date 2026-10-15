import { useCallback, useEffect, useState } from 'react';
import { loadCountry, loadIndex } from '../data/catalog';
import type { CatalogIndex, Channel } from '../data/types';
import { parseDeepLink, linkTo } from '../routing/deepLinks';
import { readPreferences, savePreferences, markRecentlyPlayed } from '../preferences/storage';
import { guessUserCountry } from '../data/geo';
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
    if (deep.invalid) {
      setMessage('链接参数无效，已返回首页。'); return;
    }
    let chosen: string | undefined;
    if (deep.country) {
      if (index.countries.some(item => item.code === deep.country)) chosen = deep.country;
      else setMessage('链接参数无效，已返回首页。');
    } else if (!countryCode) {
      const fromHistory = readPreferences().countryCode;
      if (fromHistory && index.countries.some(item => item.code === fromHistory)) {
        chosen = fromHistory;
      } else {
        const guess = guessUserCountry();
        if (guess && index.countries.some(item => item.code === guess)) chosen = guess;
      }
    }
    if (chosen) {
      setSideOpen(true);
      setCountryCode(chosen);
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
    if (code && !index?.countries.some(item => item.code === code)) return;
    setCountryCode(code);
    setMissingId(undefined);
    setFeaturedId(undefined);
    if (code) setPreferences(current => ({ ...current, countryCode: code }));
    history.replaceState({}, '', code ? linkTo(code) : location.pathname);
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
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN?.trim();
  const canGlobe = Boolean(mapboxToken) && !globeFailed;

  return (
    <div className="flex min-h-dvh flex-col bg-[radial-gradient(circle_at_25%_25%,#142a44_0%,#08111f_58%,#03080f_100%)] font-sans text-ink lg:h-dvh lg:overflow-hidden">
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
        <div className="flex items-center justify-between gap-3 bg-[#1a3a4a] px-4 py-2 text-sm text-[#b6e0ee] lg:px-8" role="status">
          {message}
          <button className="rounded-md border border-[#6da3ba] px-3 py-1" onClick={() => setMessage('')}>关闭</button>
        </div>
      )}

      {indexError ? (
        <main className="grid flex-1 place-content-center gap-3 p-6 text-center" role="alert">
          <h1>频道数据加载失败</h1>
          <p className="text-muted">{indexError}</p>
          <button className="justify-self-center rounded-lg border border-line bg-raised px-4 py-2" onClick={() => { setIndexError(''); refreshIndex(); }}>重试</button>
        </main>
      ) : !index ? (
        <main className="grid flex-1 place-content-center" role="status">正在加载地球电视…</main>
      ) : (
        <main className={`grid min-w-0 flex-1 gap-4 px-3 py-3 sm:px-5 lg:min-h-0 lg:px-8 lg:py-5 ${sideOpen ? 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.85fr)]' : 'grid-cols-1'}`}>
          <section className="relative flex h-[min(48dvh,440px)] min-h-[350px] min-w-0 flex-col overflow-hidden rounded-2xl border border-[#1f3650] bg-[radial-gradient(circle_at_50%_35%,#163757_0%,#0c2138_55%,#07172a_100%)] lg:h-full lg:min-h-0">
            <div className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-6">
              <div>
                <small className="text-[11px] tracking-[0.18em] text-cyan">探索世界 · 实时直播</small>
                <h1 className="mt-2 text-[clamp(20px,3vw,32px)] leading-tight font-semibold">{country ? country.nameZh : '从世界的某个角落开始'}</h1>
              </div>
            </div>
            {canGlobe ? (
              <Globe
                token={mapboxToken!}
                countries={index.countries}
                selectedCode={countryCode}
                onSelect={(code) => { selectCountry(code); setSideOpen(true); }}
                onFailure={() => setGlobeFailed(true)}
              />
            ) : (
              <div className="grid flex-1 place-content-center p-5 text-center text-muted">
                <p>地图暂不可用，可使用频道列表继续选台。</p>
              </div>
            )}
            <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 px-4 pb-4 text-[11px] text-[#8fa3b6] sm:px-6">
              <span>拖动旋转地球 · 点击国家查看频道</span>
              <span>{index.countries.length} 个国家和地区 · {index.channels.length} 个频道</span>
            </div>
          </section>
          {sideOpen && (
            <aside className="flex h-[65dvh] min-h-[400px] min-w-0 flex-col overflow-hidden rounded-2xl border border-[#1f3650] bg-[#0d1b2ae8] lg:h-full lg:min-h-0" aria-label="国家与频道列表">
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
          onPlaying={onPlaying}
          onClose={closePlayer}
        />
      )}

      <footer className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-[#1a2f44] px-4 py-3 text-[10px] text-[#8ea3b6] sm:px-5 lg:px-8">
        <span>频道数据：Famelack · MIT 授权</span>
        <span>播放取决于直播源及当前网络</span>
      </footer>
    </div>
  );
}
