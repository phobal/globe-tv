import { useEffect, useState } from 'react';
import { Menu, Search, Tv, X } from 'lucide-react';
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

  useEffect(() => {
    if (!menuOpen && !searchOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [menuOpen, searchOpen]);

  return (
    <header className="relative z-30 flex min-h-14 items-center gap-2 border-b border-[#1a2f44] bg-[#08111fcc] px-3 py-2 text-ink backdrop-blur-md sm:gap-3 sm:px-5 lg:min-h-16 lg:px-8">
      <button
        type="button"
        className="grid size-11 shrink-0 place-items-center rounded-lg text-ink hover:bg-raised"
        onClick={() => setMenuOpen(value => !value)}
        aria-label="主菜单"
        aria-expanded={menuOpen}
      ><Menu size={22} aria-hidden="true" /></button>

      <a className="whitespace-nowrap text-lg font-semibold tracking-wide text-ink hover:text-cyan sm:text-[22px]" href="/">
        地球电视
      </a>
      <span className="hidden items-center gap-1.5 rounded-full border border-line bg-raised/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted sm:inline-flex" aria-hidden="true">
        <span className="size-1.5 rounded-full bg-cyan/80" />
        famelack
      </span>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        {playing && (
          <button
            type="button"
            className="grid size-11 shrink-0 place-items-center rounded-lg text-cyan hover:bg-raised"
            onClick={onOpenPlayer}
            aria-label="打开播放器"
          ><Tv size={22} aria-hidden="true" /></button>
        )}
        <button
          type="button"
          className="grid size-11 shrink-0 place-items-center rounded-lg text-ink hover:bg-raised"
          onClick={() => setSearchOpen(value => !value)}
          aria-label="搜索国家或频道"
          aria-expanded={searchOpen}
        ><Search size={22} aria-hidden="true" /></button>
      </div>

      {menuOpen && (
        <div className="absolute top-full left-3 z-50 mt-2 max-h-[70dvh] w-[min(360px,calc(100vw-24px))] overflow-y-auto rounded-xl border border-line bg-[#0a1626f5] p-3 shadow-2xl [&>button]:m-1 [&>button]:flex [&>button]:min-h-11 [&>button]:items-center [&>button]:justify-center [&>button]:gap-2 [&>button]:rounded-lg [&>button]:border [&>button]:border-line [&>button]:bg-raised [&>button]:px-3 [&>button]:py-2 [&>button]:text-sm sm:left-5" role="dialog" aria-label="主菜单">
          <button onClick={onToggleSide} type="button">
            {sideOpen ? '隐藏频道列表' : '显示频道列表'}
          </button>
          <button onClick={() => setTab('favorites')} className={tab === 'favorites' ? 'border-cyan! text-cyan!' : ''} type="button">
            收藏 ({preferences.favorites.length})
          </button>
          <button onClick={() => setTab('recent')} className={tab === 'recent' ? 'border-cyan! text-cyan!' : ''} type="button">
            最近 ({preferences.recent.length})
          </button>
          <div className="my-2 max-h-64 overflow-y-auto">
            {(tab === 'favorites' ? preferences.favorites : preferences.recent).length === 0 && (
              <p>{tab === 'favorites' ? '还没有收藏频道' : '尚无成功播放记录'}</p>
            )}
            {(tab === 'favorites' ? preferences.favorites : preferences.recent).map(id => {
              const channel = index.channels.find(item => item.id === id);
              return (
                <div className="flex items-center border-b border-[#1f364d]" key={id}>
                  <button className="min-w-0 flex-1 truncate px-1 py-2 text-left disabled:text-[#7a8a99]" disabled={!channel} type="button" onClick={() => channel && onSelectChannel(channel.countryCode, id)}>
                    {channel?.name ?? '该频道已下线'}
                  </button>
                  <button className="grid size-10 place-items-center text-cyan hover:text-white" onClick={() => onRemoveSaved(id)} aria-label={`移除 ${channel?.name ?? id}`}><X size={16} aria-hidden="true" /></button>
                </div>
              );
            })}
          </div>
          <button onClick={() => setMenuOpen(false)} type="button">关闭</button>
        </div>
      )}

      {searchOpen && (
        <div className="absolute top-full right-3 z-50 mt-2 max-h-[70dvh] w-[min(420px,calc(100vw-24px))] overflow-y-auto rounded-xl border border-line bg-[#0a1626f5] p-3 shadow-2xl sm:right-5" role="dialog" aria-label="搜索">
          <input
            type="search"
            className="mb-3 h-11 w-full rounded-lg border border-line bg-raised px-3 text-base text-ink placeholder:text-muted"
            placeholder="搜索国家或频道"
            value={query}
            onChange={event => setQuery(event.target.value)}
            aria-label="搜索国家或频道"
          />
          {query.trim() && (
            <div className="flex flex-col gap-1 [&_button]:flex [&_button]:min-h-11 [&_button]:w-full [&_button]:items-center [&_button]:justify-between [&_button]:gap-2 [&_button]:rounded-lg [&_button]:border [&_button]:border-line [&_button]:bg-raised [&_button]:px-3 [&_button]:py-2 [&_button]:text-left [&_button]:text-sm [&_small]:shrink-0 [&_small]:text-cyan" role="region" aria-label="搜索结果">
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
