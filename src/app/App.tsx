import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Heart, Home as HomeIcon, Search, Tv2 } from 'lucide-react';
import { loadDiscovery, loadDiscoveryChannel } from '../data/discovery';
import type { DiscoveryCatalog, ChannelSummary, Channel } from '../data/types';
import { Discover } from '../library/Discover';
import { Home } from '../library/Home';
const PlayerModal = lazy(() => import('../player/PlayerModal').then(module => ({ default: module.PlayerModal })));
import { resolvePlaybackContext } from '../player/playbackContext';
import type { PlaybackContext } from '../player/playbackContext';
import { linkToCategory, parseDeepLink } from '../routing/deepLinks';
import { markRecentlyPlayed, readPreferences, savePreferences, type ThemePreference } from '../preferences/storage';
import { useThemeEffect } from '../preferences/useTheme';

type Page = 'home' | 'discover' | 'watch';
export function App() {
  const [catalog, setCatalog] = useState<DiscoveryCatalog>();
  const [error, setError] = useState('');
  const [preferences, setPreferences] = useState(readPreferences);
  const [page, setPage] = useState<Page>('home');
  const [returnPage, setReturnPage] = useState<Page>('home');
  const [playing, setPlaying] = useState<Channel>();
  const [playingSummary, setPlayingSummary] = useState<ChannelSummary>();
  const [context, setContext] = useState<PlaybackContext>();
  const [category, setCategory] = useState('central');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');
  const [country, setCountry] = useState('');
  const [language, setLanguage] = useState('');
  const [message, setMessage] = useState('');
  const theme = useThemeEffect(preferences.theme);

  const refresh = useCallback(() => { loadDiscovery().then(setCatalog).catch(err => setError(String(err))); }, []);
  useEffect(refresh, [refresh]);
  useEffect(() => { savePreferences(preferences); }, [preferences]);
  const byId = useMemo(() => new Map(catalog?.channels.map(channel => [channel.id, channel]) ?? []), [catalog]);

  const navigate = useCallback((next: Page) => {
    if (next === 'watch' && page !== 'watch') setReturnPage(page);
    setPage(next);
    if (next === 'discover' && catalog) history.replaceState({}, '', linkToCategory(category));
    else if (next === 'home') history.replaceState({}, '', location.pathname);
  }, [page, catalog, category]);

  const startChannel = useCallback(async (id: string, preferredCategory?: string) => {
    if (!catalog) return;
    const summary = byId.get(id);
    if (!summary) { setMessage('这个频道已不在目录中。'); return; }
    try {
      const channel = await loadDiscoveryChannel(summary);
      setPlaying(channel); setPlayingSummary(summary);
      const savedCategory = preferredCategory ?? preferences.lastCategories?.[id];
      const playback = resolvePlaybackContext(catalog.channels, id, savedCategory);
      if (!playback) { setMessage('无法找到频道所属分类。'); return; }
      setContext(playback); setCategory(playback.categoryId);
      setReturnPage(current => page === 'watch' ? current : page);
      setPreferences(value => ({ ...value, lastCategories: { ...value.lastCategories, [id]: playback.categoryId } }));
      setPage('watch');
      history.replaceState({}, '', linkToCategory(playback.categoryId, id));
    } catch (err) { setMessage(`频道加载失败：${String(err)}`); }
  }, [catalog, byId, page, preferences.lastCategories]);

  useEffect(() => {
    if (!catalog || playing) return;
    const deep = parseDeepLink(location.search);
    if (deep.invalid) { setMessage('链接无效，已打开频道首页。'); return; }
    if (deep.country || deep.collection === 'popular') {
      if (deep.channel && byId.has(deep.channel)) {
        const summary = byId.get(deep.channel)!;
        const preferred = deep.country && summary.categoryIds.includes('overseas') ? 'overseas' : summary.primaryCategory;
        void startChannel(deep.channel, preferred);
      } else if (deep.country) {
        setCategory('overseas'); setCountry(deep.country); setPage('discover');
        history.replaceState({}, '', linkToCategory('overseas'));
      } else {
        setPage('discover');
        history.replaceState({}, '', linkToCategory(category));
      }
      return;
    }
    if (deep.category) { setCategory(deep.category); if (!deep.channel) setPage('discover'); }
    if (deep.channel) void startChannel(deep.channel, deep.category);
  }, [catalog, playing, startChannel, byId, category]);

  const toggleFavorite = (id: string) => setPreferences(value => ({ ...value,
    favorites: value.favorites.includes(id) ? value.favorites.filter(item => item !== id) : [...value.favorites, id],
  }));
  const reorderFavorites = (ids: string[]) => setPreferences(value => ({ ...value, favorites: ids }));
  const recordPlaying = (id: string) => setPreferences(value => markRecentlyPlayed(value, id));
  const resetDiscovery = () => { setQuery(''); setGroup(''); setCountry(''); setLanguage(''); setCategory('central'); };

  return <div className="tv-app" data-theme={theme.mode}>
    <header className="app-header">
      <a className="brand" href={location.pathname} onClick={e => { e.preventDefault(); navigate('home'); }}><span className="brand-mark"><Tv2 size={19} aria-hidden="true" /></span><span>频道<span className="brand-accent">台</span></span></a>
      <nav className="primary-nav" aria-label="主导航">
        <button aria-current={page === 'home' ? 'page' : undefined} onClick={() => navigate('home')}><HomeIcon size={16} aria-hidden="true" />我的频道</button>
        <button aria-current={page === 'discover' ? 'page' : undefined} onClick={() => navigate('discover')}><Search size={16} aria-hidden="true" />发现频道</button>
      </nav>
      {playing && <button className="return-playing" onClick={() => navigate('watch')}><span className="live-dot" />正在播放：{playing.name}</button>}
      <label className="theme-control"><span className="sr-only">主题</span><select value={preferences.theme} onChange={e => setPreferences(v => ({ ...v, theme: e.target.value as ThemePreference }))}><option value="auto">自动主题</option><option value="light">浅色</option><option value="dark">深色</option></select></label>
    </header>
    {message && <div className="app-notice" role="status">{message}<button onClick={() => setMessage('')} aria-label="关闭提示">×</button></div>}
    <main className={`app-main ${page === 'watch' ? 'watch-open' : ''}`}>
      <section className="page-region" hidden={page === 'watch'}>
        {error ? <div className="empty-favorites"><h2>频道数据加载失败</h2><p>{error}</p><button className="solid-button" onClick={refresh}>重新加载</button></div> : !catalog ? <p className="loading-state" role="status">正在整理频道…</p> : page === 'home'
          ? <Home catalog={catalog} preferences={preferences} onPlay={id => void startChannel(id)} onDiscover={() => { resetDiscovery(); navigate('discover'); }} onToggleFavorite={toggleFavorite} onReorder={reorderFavorites} />
          : <Discover catalog={catalog} favorites={preferences.favorites} category={category} onCategory={setCategory} query={query} onQuery={setQuery} group={group} onGroup={setGroup} country={country} onCountry={setCountry} language={language} onLanguage={setLanguage} onPlay={(id, cat) => void startChannel(id, cat)} onToggleFavorite={toggleFavorite} />}
      </section>
      {catalog && page === 'watch' && playing && playingSummary && context && <>
        <aside className="watch-queue"><div className="watch-queue-head"><div><p className="eyebrow">当前分类</p><h2>{catalog.categories.find(c => c.id === context.categoryId)?.name}</h2></div><button className="text-button" onClick={() => navigate('discover')}>浏览分类</button></div>
          {context.channelIds.map(id => { const item = byId.get(id); return item && <button className="watch-queue-row" key={id} aria-current={id === playing.id ? 'true' : undefined} onClick={() => void startChannel(id, context.categoryId)}><span className="queue-number">{String(context.channelIds.indexOf(id) + 1).padStart(2, '0')}</span><span>{item.name}</span><Heart size={15} fill={preferences.favorites.includes(id) ? 'currentColor' : 'none'} aria-label={preferences.favorites.includes(id) ? '已收藏' : '未收藏'} /></button>; })}
        </aside>
      </>}
      {catalog && playing && playingSummary && context && <section className={`player-surface ${page === 'watch' ? 'player-expanded' : 'player-collapsed'}`} aria-label={page === 'watch' ? '频道播放' : '迷你播放器'}>
        {page !== 'watch' && <button className="dock-screen" aria-label={`继续观看 ${playing.name}`} onClick={() => navigate('watch')}><span className="dock-video"><Tv2 size={22} aria-hidden="true" /><span><strong>{playing.name}</strong><small>{catalog.categories.find(c => c.id === context.categoryId)?.name ?? ''}</small></span></span></button>}
        {page !== 'watch' && <button className="dock-close" aria-label="关闭播放器" onClick={() => { setPlaying(undefined); setPlayingSummary(undefined); setContext(undefined); }}>×</button>}
        <Suspense fallback={null}><PlayerModal open channel={playing} expanded={page === 'watch'} categoryName={catalog.categories.find(c => c.id === context.categoryId)?.name} onboardingRequired={!preferences.onboardingVersion} favorite={preferences.favorites.includes(playing.id)} onToggleFavorite={() => toggleFavorite(playing.id)} onOnboardingComplete={() => setPreferences(v => ({ ...v, onboardingVersion: 1 }))} onBrowse={() => navigate('discover')} onNavigate={direction => {
          const index = context.channelIds.indexOf(playing.id), nextIndex = index + (direction === 'next' ? 1 : -1), nextId = context.channelIds[nextIndex];
          if (nextId) void startChannel(nextId, context.categoryId);
        }} onPlaying={recordPlaying} onClose={() => navigate(returnPage)} /></Suspense>
      </section>}
    </main>
    <footer className="app-footer"><span>收藏与观看记录仅保存在当前浏览器</span><span>频道数据 · 播放取决于直播源与网络</span></footer>
  </div>;
}
