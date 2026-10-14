import { useMemo, useState } from 'react';
import { normalizeQuery } from '../data/catalog';
import type { Channel, CountrySummary } from '../data/types';
import styles from './drawer.module.css';

interface Props {
  hidden?: boolean;
  country?: CountrySummary;
  channels: Channel[];
  loading: boolean;
  error?: string;
  favorites: string[];
  featuredId?: string;
  missingId?: string;
  onPlay: (channel: Channel) => void;
  onToggleFavorite: (id: string) => void;
  onRetry: () => void;
  onBack: () => void;
  onPickCountry: (code: string) => void;
  topCountries: CountrySummary[];
}

export function ChannelListSection({
  hidden, country, channels, loading, error, favorites, featuredId, missingId,
  onPlay, onToggleFavorite, onRetry, onBack, onPickCountry, topCountries,
}: Props) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => channels
    .filter(channel => normalizeQuery(channel.name).includes(normalizeQuery(query)))
    .sort((a, b) => Number(b.id === featuredId) - Number(a.id === featuredId)
      || Number(favorites.includes(b.id)) - Number(favorites.includes(a.id))
      || a.name.localeCompare(b.name))
  , [channels, query, favorites, featuredId]);

  if (hidden) return null;
  if (!country) return <p className={styles.empty}>请选择一个国家查看频道。</p>;

  return (
    <div>
      <button type="button" className={styles.back} onClick={onBack} aria-label="返回国家列表">← 返回国家</button>
      <header className={styles.countryHead}>
        <small>{country.nameEn}</small>
        <h2>{country.nameZh}</h2>
        <p>{country.channelCount} 个频道</p>
      </header>

      {missingId && <div className={styles.noticeInline}>该频道已下线。可以浏览本国的其他频道。</div>}
      {loading && <p role="status" className={styles.empty}>正在加载频道…</p>}
      {error && <div role="alert" className={styles.noticeInline}>{error} <button onClick={onRetry}>重试</button></div>}

      {!loading && !error && channels.length === 0 && (
        <div className={styles.noChannels}>
          <p>该国家暂无频道收录。</p>
          <p className={styles.empty}>试试其他国家：</p>
          <ul className={styles.suggest}>
            {topCountries.map(item => (
              <li key={item.code}>
                <button type="button" onClick={() => onPickCountry(item.code)}>
                  <strong>{item.nameZh}</strong>
                  <small>{item.channelCount} 个频道</small>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && !error && channels.length > 0 && (
        <>
          <input
            className={styles.search}
            type="search"
            placeholder="搜索当前国家频道"
            value={query}
            onChange={event => setQuery(event.target.value)}
            aria-label="搜索当前国家频道"
          />
          {featuredId && shown.some(item => item.id === featuredId) && (
            <p className={styles.deepHint}>直达频道已列在最前，点击开始播放。</p>
          )}
          <ul className={styles.channelUl}>
            {shown.map(channel => (
              <li key={channel.id}>
                <button type="button" className={styles.channelPlay} onClick={() => onPlay(channel)}>
                  <span className={styles.channelInitial}>{channel.name.slice(0, 1)}</span>
                  <span className={styles.channelText}>
                    <strong>{channel.name}</strong>
                    <small>{channel.geoBlocked && '可能受地区限制 · '}{channel.sources.length} 个来源</small>
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.favBtn}
                  onClick={() => onToggleFavorite(channel.id)}
                  aria-label={`${favorites.includes(channel.id) ? '取消收藏' : '收藏'} ${channel.name}`}
                  aria-pressed={favorites.includes(channel.id)}
                >{favorites.includes(channel.id) ? '★' : '☆'}</button>
              </li>
            ))}
          </ul>
          {shown.length === 0 && <p className={styles.empty}>没有匹配的频道</p>}
        </>
      )}
    </div>
  );
}
