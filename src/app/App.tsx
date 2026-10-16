import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadCountry, loadIndex, loadPopular } from '../data/catalog';
import type { CatalogIndex, Channel, PopularChannel } from '../data/types';
import { parseDeepLink, linkTo, linkToCollection } from '../routing/deepLinks';
import { readPreferences, savePreferences, markRecentlyPlayed, type ThemePreference } from '../preferences/storage';
import { useThemeEffect } from '../preferences/useTheme';
import { guessUserCountry } from '../data/geo';
import { Globe } from '../globe/Globe';
import { SidePanel } from '../sidepanel/SidePanel';
import { PlayerModal } from '../player/PlayerModal';
import { adjacentChannel, orderedChannels, type Direction } from '../player/channelNavigation';
import { Header } from '../header/Header';

export function App() {
  const [index, setIndex] = useState<CatalogIndex>();
  const [indexError, setIndexError] = useState('');
  const [countryCode, setCountryCode] = useState<string>();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [popularChannels, setPopularChannels] = useState<PopularChannel[]>([]);
  const [popularMode, setPopularMode] = useState(false);
  const [playingPopular, setPlayingPopular] = useState(false);
  const [countryError, setCountryError] = useState('');
  const [countryRetry, setCountryRetry] = useState(0);
  const [loadingCountry, setLoadingCountry] = useState(false);
  const [playing, setPlaying] = useState<Channel>();
  const [playerOpen, setPlayerOpen] = useState(false);
  const [missingId, setMissingId] = useState<string>();
  const [featuredId, setFeaturedId] = useState<string>();
  const [message, setMessage] = useState('');
  const [globeFailed, setGlobeFailed] = useState(false);
  const [preferences, setPreferences] = useState(readPreferences);
  const theme = useThemeEffect(preferences.theme);
  const country = index?.countries.find(item => item.code === countryCode);
  const playingCountry = index?.countries.find(item => item.code === playing?.countryCode);
  const playerChannels = useMemo(() => playingPopular
    ? orderedChannels(popularChannels)
    : playing?.countryCode === countryCode ? orderedChannels(channels) : [],
  [channels, countryCode, playing?.countryCode, playingPopular, popularChannels]);
  const playerChannelIndex = playerChannels.findIndex(item => item.id === playing?.id);

  const refreshIndex = useCallback(() => {
    loadIndex().then(setIndex).catch(error => setIndexError(String(error)));
  }, []);
  useEffect(refreshIndex, [refreshIndex]);
  useEffect(() => {
    loadPopular().then(data => setPopularChannels(data.channels)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!index) return;
    const deep = parseDeepLink(location.search);
    if (deep.invalid) {
      setMessage('链接参数无效，已返回首页。'); return;
    }
    if (deep.collection === 'popular') {
      setPopularMode(true);
      setCountryCode(undefined);
      if (deep.channel) { setMissingId(deep.channel); setFeaturedId(deep.channel); }
      return;
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
      setCountryCode(chosen);
      if (deep.channel) { setMissingId(deep.channel); setFeaturedId(deep.channel); }
    }
  }, [index]);

  useEffect(() => {
    if (popularMode) {
      let live = true;
      setLoadingCountry(true); setCountryError(''); setChannels([]);
      loadPopular()
        .then(data => { if (live) { setPopularChannels(data.channels); setChannels(data.channels); setLoadingCountry(false); } })
        .catch(error => { if (live) { setCountryError(String(error)); setLoadingCountry(false); } });
      return () => { live = false; };
    }
    if (!countryCode) { setChannels([]); return; }
    let live = true;
    setLoadingCountry(true); setCountryError(''); setChannels([]);
    loadCountry(countryCode)
      .then(data => { if (live) { setChannels(data); setLoadingCountry(false); } })
      .catch(error => { if (live) { setCountryError(String(error)); setLoadingCountry(false); } });
    return () => { live = false; };
  }, [countryCode, countryRetry, popularMode]);

  useEffect(() => {
    if (missingId && channels.some(item => item.id === missingId)) setMissingId(undefined);
  }, [channels, missingId]);

  useEffect(() => { savePreferences(preferences); }, [preferences]);

  const selectCountry = (code: string) => {
    if (code && !index?.countries.some(item => item.code === code)) return;
    setCountryCode(code);
    setPopularMode(false);
    setMissingId(undefined);
    setFeaturedId(undefined);
    if (code) setPreferences(current => ({ ...current, countryCode: code }));
    history.replaceState({}, '', code ? linkTo(code) : location.pathname);
  };

  const backToCountries = () => {
    setCountryCode(undefined);
    setPopularMode(false);
    setMissingId(undefined);
    setFeaturedId(undefined);
    history.replaceState({}, '', location.pathname);
  };

  const selectPopular = () => {
    setCountryCode(undefined);
    setPopularMode(true);
    setMissingId(undefined);
    setFeaturedId(undefined);
    history.replaceState({}, '', linkToCollection('popular'));
  };

  const play = (channel: Channel) => {
    setPlaying(channel);
    setPlayingPopular(popularMode);
    setMissingId(undefined);
    setFeaturedId(undefined);
    setPlayerOpen(true);
    history.replaceState({}, '', popularMode ? linkToCollection('popular', channel.id) : linkTo(channel.countryCode, channel.id));
  };

  const closePlayer = () => {
    setPlayerOpen(false);
  };

  const navigatePlayer = (direction: Direction) => {
    if (!playing) return;
    const next = adjacentChannel(playerChannels, playing.id, direction);
    if (next) play(next);
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

  const selectPopularChannel = async (id: string) => {
    setCountryCode(undefined);
    setPopularMode(true);
    try {
      const data = await loadPopular();
      setPopularChannels(data.channels);
      const channel = data.channels.find(item => item.id === id);
      if (channel) {
        setPlaying(channel);
        setPlayingPopular(true);
        setMissingId(undefined);
        setFeaturedId(undefined);
        setPlayerOpen(true);
        history.replaceState({}, '', linkToCollection('popular', channel.id));
      } else setMissingId(id);
    } catch {
      setMessage('热门频道加载失败，请重试。');
    }
  };

  const toggleFavorite = (id: string) => setPreferences(current => ({
    ...current,
    favorites: current.favorites.includes(id)
      ? current.favorites.filter(item => item !== id)
      : [...current.favorites, id],
  }));
  const removeSaved = (id: string) => setPreferences(current => ({
    ...current,
    favorites: current.favorites.filter(item => item !== id),
    recent: current.recent.filter(item => item !== id),
  }));
  const onPlaying = (id: string) => setPreferences(current => markRecentlyPlayed(current, id));
  const setThemePreference = (next: ThemePreference) => setPreferences(current => ({ ...current, theme: next }));
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN?.trim();
  const canGlobe = Boolean(mapboxToken) && !globeFailed;

  return (
    <div
      className="flex min-h-dvh flex-col font-sans text-ink lg:h-dvh lg:overflow-hidden"
      style={{ background: 'var(--app-page-gradient)' }}
    >
      {index && (
        <Header
          playing={playing}
          onOpenPlayer={() => setPlayerOpen(true)}
          onClosePlayer={closePlayer}
          index={index}
          preferences={preferences}
          popularChannels={popularChannels}
          onPickCountry={selectCountry}
          onSelectChannel={selectChannel}
          onSelectPopularChannel={selectPopularChannel}
          onRemoveSaved={removeSaved}
          onThemeChange={setThemePreference}
        />
      )}

      {message && (
        <div className="flex items-center justify-between gap-3 border-b border-info-border bg-info-bg px-4 py-2 text-sm text-info-text lg:px-8" role="status">
          {message}
          <button className="rounded-md border border-info-border bg-[var(--app-panel)] px-3 py-1" onClick={() => setMessage('')}>关闭</button>
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
        <main className="grid min-w-0 flex-1 gap-4 px-3 py-3 sm:px-5 lg:min-h-0 lg:px-8 lg:py-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.85fr)]">
          <section
            className="relative flex h-[min(48dvh,440px)] min-h-[350px] min-w-0 flex-col overflow-hidden rounded-2xl border border-globe-divider lg:h-full lg:min-h-0"
            style={{ background: 'var(--app-globe-section-bg)' }}
          >
            <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-6">
              <div className="min-w-0">
                <small className="text-[11px] tracking-[0.18em] text-cyan">探索世界 · 实时直播</small>
                <h1 className="mt-2 truncate text-[clamp(20px,3vw,32px)] leading-tight font-semibold">{country ? country.nameZh : '从世界的某个角落开始'}</h1>
              </div>
              <div className="shrink-0 text-right text-[11px] text-footer-text">
                <p>{index.countries.length} 个国家和地区</p>
                <p className="text-cyan">{index.channels.length} 个频道</p>
              </div>
            </div>
            {canGlobe ? (
              <Globe
                token={mapboxToken!}
                countries={index.countries}
                selectedCode={countryCode}
                onSelect={selectCountry}
                onFailure={() => setGlobeFailed(true)}
                themeMode={theme.mode}
              />
            ) : (
              <div className="grid flex-1 place-content-center p-5 text-center text-muted">
                <p>地图暂不可用，可使用频道列表继续选台。</p>
              </div>
            )}
          </section>
            <aside
              className="flex h-[65dvh] min-h-[400px] min-w-0 flex-col overflow-hidden rounded-2xl border border-globe-divider bg-panel/90 backdrop-blur-sm lg:h-full lg:min-h-0"
              aria-label="国家与频道列表"
            >
              <SidePanel
                index={index}
                countries={index.countries}
                countryCode={countryCode}
                channels={channels}
                popular={popularMode}
                loading={loadingCountry}
                error={countryError}
                favorites={preferences.favorites}
                featuredId={featuredId}
                missingId={missingId}
                onPickCountry={selectCountry}
                onPickPopular={selectPopular}
                onBack={backToCountries}
                onPlay={play}
                onToggleFavorite={toggleFavorite}
                onRetry={() => setCountryRetry(value => value + 1)}
              />
            </aside>
        </main>
      )}

      {playing && (
        <PlayerModal
          open={playerOpen}
          channel={playing}
          country={playingCountry}
          channelPosition={playerChannelIndex < 0 ? undefined : { current: playerChannelIndex + 1, total: playerChannels.length }}
          onNavigate={navigatePlayer}
          onPlaying={onPlaying}
          onClose={closePlayer}
        />
      )}

      <footer className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-globe-divider px-4 py-3 text-[10px] text-footer-text sm:px-5 lg:px-8">
        <span>频道数据：Famelack · MIT；热门频道：iptv-org · Unlicense</span>
        <span>播放取决于直播源及当前网络 · 主题 {theme.mode === 'dark' ? '暗' : '亮'}</span>
      </footer>
    </div>
  );
}
