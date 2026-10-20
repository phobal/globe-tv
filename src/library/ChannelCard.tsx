import { useState } from 'react';
import { Play, Plus, Star } from 'lucide-react';
import type { ChannelSummary } from '../data/types';

export function ChannelLogo({ channel }: { channel: { id: string; name: string; logo?: string } }) {
  const [failed, setFailed] = useState<string>();
  return <span className="channel-logo" aria-hidden="true">
    {channel.logo && failed !== channel.logo
      ? <img src={channel.logo} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(channel.logo)} />
      : <span>{channel.name.replace(/\s+/g, '').slice(0, 5)}</span>}
  </span>;
}
const contentNames = { live: '直播', replay: '回放', 'on-demand': '点播', radio: '广播', scenic: '实景' };
export function ChannelCard({ channel, favorite, onPlay, onToggleFavorite, categoryName }: {
  channel: ChannelSummary; favorite: boolean; onPlay: () => void; onToggleFavorite: () => void; categoryName?: string;
}) {
  return <article className="channel-card">
    <button className="channel-card-main" onClick={onPlay} aria-label={`播放 ${channel.name}`}>
      <ChannelLogo channel={channel} />
      <span className="channel-card-copy"><strong>{channel.name}</strong><small>{categoryName ?? channel.groupName}</small></span>
      <Play className="channel-play" size={17} aria-hidden="true" />
    </button>
    <div className="channel-card-foot"><small>{contentNames[channel.contentType]}</small>
      <button className="icon-button" onClick={onToggleFavorite} aria-label={`${favorite ? '取消收藏' : '收藏'} ${channel.name}`} aria-pressed={favorite}>
        {favorite ? <Star size={16} fill="currentColor" aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
      </button>
    </div>
  </article>;
}
