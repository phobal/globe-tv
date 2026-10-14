import { useState } from 'react';
import type { CatalogIndex, Channel } from '../data/types';
import type { Preferences } from '../preferences/storage';

interface Props {
  sideOpen: boolean;
  onToggleSide: () => void;
  playing?: Channel;
  onOpenPlayer: () => void;
  onClosePlayer: () => void;
  index: CatalogIndex;
  preferences: Preferences;
  onPickCountry: (code: string) => void;
  onSelectChannel: (code: string, id: string) => void;
  onRemoveSaved: (id: string) => void;
}

export function Header({
  sideOpen, onToggleSide, playing, onOpenPlayer,
  index, preferences, onPickCountry, onSelectChannel, onRemoveSaved,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [tab, setTab] = useState<'favorites' | 'recent'>('favorites');
  const [query, setQuery] = useState('');

  return (
    <header className="app-header">
      <button
        type="button"
        className="icon-btn"
        onClick={() => setMenuOpen(value => !value)}
        aria-label="菜单"
        aria-expanded={menuOpen}
      >≡</button>
      <a className="brand brand-logo" href="https://github.com/famelack/famelack-data" target="_blank" rel="noreferrer">
        地球电视
      </a>
      <span className="brand-sub">famelack</span>

      <div className="header-right">
        {playing && (
          <button
            type="button"
            className="player-toggle"
            onClick={onOpenPlayer}
            aria-label="打开播放器"
          >📺</button>
        )}
        <button
          type="button"
          className="icon-btn"
          onClick={() => setSearchOpen(value => !value)}
          aria-label="搜索"
          aria-expanded={searchOpen}
        >🔍</button>
      </div>

      {menuOpen && (
        <div className="header-popover" role="dialog" aria-label="主菜单">
          <button onClick={onToggleSide} type="button">
            {sideOpen ? '隐藏' : '显示'}右侧列表
          </button>
          <button onClick={() => setTab('favorites')} className={tab === 'favorites' ? 'active' : ''} type="button">
            收藏 ({preferences.favorites.length})
          </button>
          <button onClick={() => setTab('recent')} className={tab === 'recent' ? 'active' : ''} type="button">
            最近 ({preferences.recent.length})
          </button>
          <div className="header-popover-list">
            {(tab === 'favorites' ? preferences.favorites : preferences.recent).length === 0 && (
              <p>{tab === 'favorites' ? '还没有收藏频道' : '尚无成功播放记录'}</p>
            )}
            {(tab === 'favorites' ? preferences.favorites : preferences.recent).map(id => {
              const channel = index.channels.find(item => item.id === id);
              return (
                <div className="header-row" key={id}>
                  <button disabled={!channel} type="button" onClick={() => channel && onSelectChannel(channel.countryCode, id)}>
                    {channel?.name ?? '该频道已下线'}
                  </button>
                  <button onClick={() => onRemoveSaved(id)} aria-label={`移除 ${channel?.name ?? id}`}>×</button>
                </div>
              );
            })}
          </div>
          <button onClick={() => setMenuOpen(false)} type="button">关闭</button>
        </div>
      )}

      {searchOpen && (
        <div className="header-popover search-popover" role="dialog" aria-label="搜索">
          <input
            type="search"
            placeholder="搜索国家或频道"
            value={query}
            onChange={event => setQuery(event.target.value)}
            aria-label="搜索国家或频道"
          />
          {query.trim() && (
            <div className="search-results" role="region" aria-label="搜索结果">
              {index.countries
                .filter(item => {
                  const q = query.trim().toLowerCase();
                  return `${item.nameZh} ${item.nameEn} ${item.code}`.toLowerCase().includes(q);
                })
                .slice(0, 8)
                .map(country => (
                  <button key={country.code} type="button" onClick={() => { onPickCountry(country.code); setQuery(''); setSearchOpen(false); }}>
                    <span>{country.nameZh}</span>
                    <small>{country.channelCount} 个频道</small>
                  </button>
                ))}
              {index.channels
                .filter(item => item.name.toLowerCase().includes(query.trim().toLowerCase()))
                .slice(0, 12)
                .map(channel => (
                  <button key={channel.id} type="button" onClick={() => { onSelectChannel(channel.countryCode, channel.id); setQuery(''); setSearchOpen(false); }}>
                    <span>{channel.name}</span>
                    <small>{index.countries.find(country => country.code === channel.countryCode)?.nameZh}</small>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
