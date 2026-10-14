import { useState } from 'react';
import type { CatalogIndex } from '../data/types';
import type { Preferences } from './storage';

export function Library({ index, preferences, onSelect, onRemove }: { index: CatalogIndex; preferences: Preferences; onSelect: (code: string, id: string) => void; onRemove: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'favorites' | 'recent'>('favorites');
  const ids = preferences[tab];
  return <div className="library"><button className="library-toggle" onClick={() => setOpen(value => !value)} aria-expanded={open}>我的频道</button>
    {open && <div className="library-panel"><div className="library-tabs"><button className={tab === 'favorites' ? 'active' : ''} onClick={() => setTab('favorites')}>收藏</button><button className={tab === 'recent' ? 'active' : ''} onClick={() => setTab('recent')}>最近观看</button></div>
      {!ids.length && <p>{tab === 'favorites' ? '还没有收藏频道' : '尚无成功播放记录'}</p>}
      {ids.map(id => {
        const channel = index.channels.find(item => item.id === id);
        return <div className="library-row" key={id}><button disabled={!channel} onClick={() => { if (channel) { onSelect(channel.countryCode, id); setOpen(false); } }}>{channel?.name ?? '该频道已下线'}</button><button onClick={() => onRemove(id)} aria-label={`移除 ${channel?.name ?? id}`}>×</button></div>;
      })}
    </div>}
  </div>;
}
