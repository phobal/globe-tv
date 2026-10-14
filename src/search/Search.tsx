import { useState } from 'react';
import { searchCatalog } from '../data/catalog';
import type { CatalogIndex } from '../data/types';

export function Search({ index, onCountry, onChannel }: { index: CatalogIndex; onCountry: (code: string) => void; onChannel: (code: string, id: string) => void }) {
  const [query, setQuery] = useState('');
  const results = searchCatalog(index, query);
  return <div className="search">
    <label htmlFor="global-search">搜索国家或频道</label>
    <input id="global-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="例如：中国、CGTN" autoComplete="off" />
    {query.trim() && <div className="search-results" role="region" aria-label="搜索结果">
      {results.countries.slice(0, 8).map(country => <button key={country.code} onClick={() => { onCountry(country.code); setQuery(''); }}>{country.nameZh} <small>{country.channelCount} 个频道</small></button>)}
      {results.channels.slice(0, 15).map(channel => <button key={channel.id} onClick={() => { onChannel(channel.countryCode, channel.id); setQuery(''); }}>{channel.name} <small>{index.countries.find(country => country.code === channel.countryCode)?.nameZh}</small></button>)}
      {!results.countries.length && !results.channels.length && <p>没有找到相关国家或频道</p>}
    </div>}
  </div>;
}
