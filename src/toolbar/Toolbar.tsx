import { useState } from 'react';
import type { CatalogIndex, Channel } from '../data/types';

interface Props {
  index: CatalogIndex;
  playing?: Channel;
  drawerOpen: boolean;
  drawerView: 'countries' | 'channels';
  favoritesCount: number;
  recentCount: number;
  favorites: string[];
  recent: string[];
  onOpenDrawer: (view: 'countries' | 'channels') => void;
  onSelectChannel: (code: string, id: string) => void;
  onRemoveSaved: (id: string) => void;
}

export function Toolbar({
  index, playing, drawerOpen, drawerView,
  favoritesCount, recentCount, favorites, recent,
  onOpenDrawer, onSelectChannel, onRemoveSaved,
}: Props) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [tab, setTab] = useState<'favorites' | 'recent'>('favorites');
  const ids = tab === 'favorites' ? favorites : recent;
  return (
    <div className="toolbar">
      <button
        type="button"
        onClick={() => onOpenDrawer('countries')}
        className={drawerOpen && drawerView === 'countries' ? 'active' : ''}
      >浏览国家</button>
      <button
        type="button"
        onClick={() => onOpenDrawer('channels')}
        disabled={!playing}
        className={drawerOpen && drawerView === 'channels' ? 'active' : ''}
      >当前频道{playing ? ' ●' : ''}</button>
      <button type="button" onClick={() => setLibraryOpen(value => !value)} aria-expanded={libraryOpen}>
        我的频道<span className="badge">{favoritesCount + recentCount}</span>
      </button>
      {libraryOpen && (
        <div className="library-pop" role="dialog" aria-label="我的频道">
          <div className="tabs">
            <button className={tab === 'favorites' ? 'active' : ''} onClick={() => setTab('favorites')}>收藏 ({favoritesCount})</button>
            <button className={tab === 'recent' ? 'active' : ''} onClick={() => setTab('recent')}>最近 ({recentCount})</button>
          </div>
          {!ids.length && <p>{tab === 'favorites' ? '还没有收藏频道' : '尚无成功播放记录'}</p>}
          {ids.map(id => {
            const channel = index.channels.find(item => item.id === id);
            return (
              <div className="row" key={id}>
                <button disabled={!channel} onClick={() => channel && onSelectChannel(channel.countryCode, id)}>
                  {channel?.name ?? '该频道已下线'}
                </button>
                <button onClick={() => onRemoveSaved(id)} aria-label={`移除 ${channel?.name ?? id}`}>×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
