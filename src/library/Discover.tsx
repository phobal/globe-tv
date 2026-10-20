import { Search, SlidersHorizontal } from 'lucide-react';
import { useMemo } from 'react';
import type { DiscoveryCatalog } from '../data/types';
import { ChannelCard } from './ChannelCard';
interface Props {
  catalog: DiscoveryCatalog; favorites: string[]; category: string; onCategory: (id: string) => void;
  query: string; onQuery: (query: string) => void; group: string; onGroup: (id: string) => void;
  country: string; onCountry: (code: string) => void; language: string; onLanguage: (language: string) => void;
  onPlay: (id: string, category?: string) => void; onToggleFavorite: (id: string) => void;
}
const languageNames: Record<string, string> = { Chinese: '中文', English: '英语', Japanese: '日语', Korean: '韩语', French: '法语', German: '德语', Arabic: '阿拉伯语', Spanish: '西班牙语', Russian: '俄语', Indonesian: '印尼语', Thai: '泰语', Vietnamese: '越南语', Portuguese: '葡萄牙语' };
const regionNames = new Intl.DisplayNames(['zh-Hans'], { type: 'region' });
function region(code: string) { try { return regionNames.of(code.toUpperCase()) ?? code; } catch { return code; } }
export function Discover(props: Props) {
  const { catalog, favorites, category, onCategory, query, onQuery, group, onGroup, country, onCountry, language, onLanguage, onPlay, onToggleFavorite } = props;
  const term = query.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  const categoryName = catalog.categories.find(c => c.id === category)?.name ?? '全部频道';
  const channels = useMemo(() => catalog.channels.filter(c =>
    (term ? c.name.toLocaleLowerCase().includes(term) : c.categoryIds.includes(category as typeof c.primaryCategory))
    && (!group || c.groupSlug === group) && (!country || c.countryCode === country) && (!language || c.languages.includes(language))), [catalog, term, category, group, country, language]);
  const overseas = catalog.channels.filter(c => c.categoryIds.includes('overseas'));
  const countries = [...new Set(overseas.map(c => c.countryCode).filter(Boolean))].sort();
  const languages = [...new Set(overseas.flatMap(c => c.languages))].sort();
  const clear = () => { onQuery(''); onGroup(''); onCountry(''); onLanguage(''); };
  return <div className="library-page discover-page">
    <div className="page-intro"><div><p className="eyebrow">找到今天想看的</p><h1>发现频道<span className="title-dot">.</span></h1></div></div>
    <div className="discover-search"><Search size={20} aria-hidden="true" /><label className="sr-only" htmlFor="channel-search">搜索所有频道</label><input id="channel-search" type="search" placeholder="搜索频道名称，如 CCTV、湖南卫视" value={query} onChange={e => onQuery(e.target.value)} />{query && <button className="text-button" onClick={() => onQuery('')}>清除</button>}</div>
    <nav className="category-nav" aria-label="内容分类">{catalog.categories.map(c => <button key={c.id} aria-pressed={category === c.id && !term} onClick={() => { onCategory(c.id); onQuery(''); onGroup(''); onCountry(''); onLanguage(''); }}>{c.name}<small>{c.channelCount}</small></button>)}</nav>
    <div className="filter-bar"><SlidersHorizontal size={16} aria-hidden="true" /><label>来源分组<select value={group} onChange={e => onGroup(e.target.value)}><option value="">全部来源</option>{catalog.groups.map(g => <option key={g.slug} value={g.slug}>{g.name}</option>)}</select></label>
      {category === 'overseas' && <><label>国家或地区<select value={country} onChange={e => onCountry(e.target.value)}><option value="">全部地区</option>{countries.map(code => <option key={code} value={code}>{region(code)}</option>)}</select></label><label>语言<select value={language} onChange={e => onLanguage(e.target.value)}><option value="">全部语言</option>{languages.map(l => <option key={l} value={l}>{languageNames[l] ?? l}</option>)}</select></label></>}
      {(group || country || language) && <button className="text-button" onClick={clear}>清除筛选</button>}
    </div>
    <div className="section-heading"><h2>{term ? `“${query.trim()}”的搜索结果` : categoryName}</h2><span className="result-count" role="status">{channels.length} 个频道{term ? ' · 全部分类' : ''}</span></div>
    <div className="channel-grid">{channels.map(channel => <ChannelCard key={channel.id} channel={channel} favorite={favorites.includes(channel.id)} categoryName={catalog.categories.find(c => c.id === channel.primaryCategory)?.name} onPlay={() => onPlay(channel.id, term ? channel.primaryCategory : category)} onToggleFavorite={() => onToggleFavorite(channel.id)} />)}</div>
    {!channels.length && <div className="empty-favorites"><h3>没有找到匹配的频道</h3><p>试试其他名称，或清除筛选后重新浏览。</p><button className="solid-button" onClick={clear}>清除搜索和筛选</button></div>}
  </div>;
}
