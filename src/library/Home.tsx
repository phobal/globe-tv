import { useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Play, Plus, Radio, X } from 'lucide-react';
import type { DiscoveryCatalog } from '../data/types';
import type { Preferences } from '../preferences/storage';
import { ChannelCard, ChannelLogo } from './ChannelCard';

interface Props {
  catalog: DiscoveryCatalog; preferences: Preferences;
  onPlay: (id: string) => void; onDiscover: () => void; onToggleFavorite: (id: string) => void; onReorder: (ids: string[]) => void;
}
export function Home({ catalog, preferences, onPlay, onDiscover, onToggleFavorite, onReorder }: Props) {
  const [editing, setEditing] = useState(false), [showRecent, setShowRecent] = useState(false);
  const byId = new Map(catalog.channels.map(channel => [channel.id, channel]));
  const last = preferences.recent.map(id => byId.get(id)).find(Boolean);
  const move = (index: number, direction: number) => {
    const ids = [...preferences.favorites], next = index + direction;
    if (next < 0 || next >= ids.length) return;
    [ids[index], ids[next]] = [ids[next], ids[index]];
    onReorder(ids);
  };
  return <div className="library-page home-page">
    <div className="page-intro"><div><p className="eyebrow">随时回来，接着看</p><h1>我的频道<span className="title-dot">.</span></h1></div><span className="local-note">保存在此浏览器</span></div>
    {last && <section className="resume-card" aria-label="上次观看">
      <ChannelLogo channel={last} />
      <div className="resume-copy"><small>上次观看</small><h2>{last.name}</h2><p>{catalog.categories.find(c => c.id === last.primaryCategory)?.name} · {last.contentType === 'live' ? '直播' : last.contentType === 'replay' ? '回放' : '频道'}</p></div>
      <button className="solid-button" onClick={() => onPlay(last.id)}><Play size={17} fill="currentColor" aria-hidden="true" />继续观看</button>
    </section>}
    <section aria-labelledby="favorites-title">
      <div className="section-heading"><h2 id="favorites-title">我的收藏 <span>{preferences.favorites.length.toString().padStart(2, '0')}</span></h2>
        {preferences.favorites.length > 0 && <button className="text-button" aria-pressed={editing} onClick={() => setEditing(!editing)}>{editing ? '完成排序' : '调整顺序'}</button>}
      </div>
      {preferences.favorites.length === 0 && <div className="empty-favorites"><Radio size={28} strokeWidth={1.3} aria-hidden="true" /><h3>把常看的频道放在这里</h3><p>找到喜欢的频道，点一下收藏。下次打开就能看见。</p><button className="solid-button" onClick={onDiscover}>添加常看的频道<ArrowRight size={16} aria-hidden="true" /></button></div>}
      <div className="channel-grid favorites-grid">
        {preferences.favorites.map((id, index) => {
          const channel = byId.get(id);
          return <div key={id} className="favorite-entry">
            {channel ? <ChannelCard channel={channel} favorite onPlay={() => onPlay(id)} onToggleFavorite={() => onToggleFavorite(id)} categoryName={catalog.categories.find(c => c.id === channel.primaryCategory)?.name} />
              : <article className="missing-channel"><strong>频道已下线</strong><small>{id}</small><button className="text-button" onClick={() => onToggleFavorite(id)} aria-label={`移除已下线频道 ${id}`}>移除<X size={15} aria-hidden="true" /></button></article>}
            {editing && <div className="reorder-controls"><button className="icon-button" disabled={index === 0} aria-label={`向前移动 ${channel?.name ?? id}`} onClick={() => move(index, -1)}><ArrowUp size={16} aria-hidden="true" /></button><span>{index + 1}</span><button className="icon-button" disabled={index === preferences.favorites.length - 1} aria-label={`向后移动 ${channel?.name ?? id}`} onClick={() => move(index, 1)}><ArrowDown size={16} aria-hidden="true" /></button></div>}
          </div>;
        })}
        {preferences.favorites.length > 0 && <button className="add-channel" onClick={onDiscover}><Plus size={23} strokeWidth={1.4} aria-hidden="true" /><span>添加频道</span></button>}
      </div>
    </section>
    {!preferences.favorites.length && <section><div className="section-heading"><h2>从这些频道开始</h2><button className="text-button" onClick={onDiscover}>发现更多<ArrowRight size={16} aria-hidden="true" /></button></div><div className="channel-grid">{catalog.channels.filter(c => c.primaryCategory === 'central').slice(0, 6).map(channel => <ChannelCard key={channel.id} channel={channel} favorite={false} onPlay={() => onPlay(channel.id)} onToggleFavorite={() => onToggleFavorite(channel.id)} />)}</div></section>}
    {preferences.recent.some(id => byId.has(id)) && <section><div className="section-heading"><h2>最近看过</h2>{preferences.recent.length > 6 && <button className="text-button" onClick={() => setShowRecent(!showRecent)}>{showRecent ? '收起记录' : '全部记录'}</button>}</div><div className="recent-list">{preferences.recent.filter(id => byId.has(id)).slice(0, showRecent ? 30 : 6).map(id => { const channel = byId.get(id)!;return <button key={id} onClick={() => onPlay(id)}><ChannelLogo channel={channel} /><span>{channel.name}</span><Play size={14} aria-hidden="true" /></button>; })}</div></section>}
  </div>;
}
