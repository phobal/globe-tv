import { useMemo, useState } from 'react';
import { normalizeQuery } from '../data/catalog';
import type { Channel, CountrySummary } from '../data/types';

export function ChannelPanel({ country, channels, loading, error, favorites, selectedId, featuredId, missingId, onPlay, onToggleFavorite, onRetry }: {
  country?: CountrySummary; channels: Channel[]; loading: boolean; error?: string; favorites: string[]; selectedId?: string; featuredId?: string; missingId?: string;
  onPlay: (channel: Channel) => void; onToggleFavorite: (id: string) => void; onRetry: () => void;
}) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => channels.filter(channel => normalizeQuery(channel.name).includes(normalizeQuery(query)))
    .sort((a, b) => Number(b.id === featuredId) - Number(a.id === featuredId) || Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)) || a.name.localeCompare(b.name)), [channels, favorites, query, featuredId]);
  if (!country) return <section className="channels empty"><h2>探索全球直播</h2><p>旋转地球、使用搜索，或从国家列表选择一个国家。</p></section>;
  return <section className="channels" aria-label="频道列表">
    <header><small>国家频道</small><h2>{country.nameZh}</h2><p>{country.nameEn} · 收录 {country.channelCount} 个频道</p></header>
    {missingId && <div className="notice">该频道已下线。可以浏览此国家的其他频道。</div>}
    {loading ? <p role="status">正在加载频道…</p> : error ? <div role="alert">{error}<button onClick={onRetry}>重试</button></div> : channels.length === 0 ? <p className="empty-state">暂无频道。可继续浏览其他国家。</p> : <>
      <label className="channel-filter">搜索当前国家频道<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="输入频道名称" /></label>
      {featuredId && shown.some(item => item.id === featuredId) && <p className="deep-hint">直达频道已列在最前，点击它开始播放。</p>}
      <div className="channel-list">{shown.map(channel => <div className={channel.id === selectedId || channel.id === featuredId ? 'channel active' : 'channel'} key={channel.id}>
        <button type="button" className="channel-play" onClick={() => onPlay(channel)}><span className="channel-initial">{channel.name.slice(0, 1)}</span><span><strong>{channel.name}</strong><small>{channel.geoBlocked ? '可能受地区限制 · ' : ''}{channel.sources.length} 个来源</small></span></button>
        <button type="button" className="favorite" onClick={() => onToggleFavorite(channel.id)} aria-label={`${favorites.includes(channel.id) ? '取消收藏' : '收藏'} ${channel.name}`} aria-pressed={favorites.includes(channel.id)}>{favorites.includes(channel.id) ? '★' : '☆'}</button>
      </div>)}</div>
      {shown.length === 0 && <p className="empty-state">没有匹配的频道</p>}
    </>}
  </section>;
}
