import { useEffect, useMemo, useState } from 'react';
import type { CatalogIndex, Channel, CountrySummary } from '../data/types';
import { normalizeQuery } from '../data/catalog';

interface Props {
  index: CatalogIndex;
  countries: CountrySummary[];
  countryCode?: string;
  channels: Channel[];
  loading: boolean;
  error?: string;
  favorites: string[];
  featuredId?: string;
  missingId?: string;
  onPickCountry: (code: string) => void;
  onPlay: (channel: Channel) => void;
  onToggleFavorite: (id: string) => void;
  onRetry: () => void;
}

const REGION_ORDER = ['亚洲', '欧洲', '非洲', '北美洲', '南美洲', '大洋洲', '其他'];

const REGION_CODES: Record<string, Set<string>> = {
  亚洲: new Set(['cn','jp','kr','in','th','vn','sg','id','my','ph','pk','bd','lk','np','mm','kh','la','tw','hk','mo','mn','af','ir','iq','sa','ae','qa','kw','om','ye','jo','lb','il','tr','sy','ps','bt','mv','bn','kz','uz','tj','tm','kg','az','am','ge']),
  欧洲: new Set(['gb','fr','de','it','es','pt','nl','be','lu','ch','at','ie','no','se','fi','dk','is','pl','cz','sk','hu','ro','bg','gr','hr','si','rs','ba','mk','al','me','md','ua','by','lt','lv','ee','ru','cy','mt','ad','mc','li','sm','va']),
  非洲: new Set(['eg','ly','tn','dz','ma','sd','ss','et','er','dj','so','ke','tz','ug','rw','bi','mz','mg','mu','sc','km','za','zw','zm','bw','na','ao','cd','cg','cm','cf','td','ng','ne','ml','sn','gm','gw','gn','sl','lr','ci','gh','tg','bj','bf','cv','st','eh','ls','sz','mw']),
  北美洲: new Set(['us','ca','mx','cu','gt','bz','hn','sv','ni','cr','pa','bs','jm','ht','do','pr','tt','bb','lc','gd','vc','ag','dm','kn']),
  南美洲: new Set(['br','ar','cl','co','pe','ve','ec','bo','uy','py','gy','sr','gf','fk']),
  大洋洲: new Set(['au','nz','fj','pg','sb','vu','ws','to','tv','nr','ki','fm','mh','pw','nc','pf']),
};

function regionOf(code: string): string {
  const code2 = code.toLowerCase();
  for (const region of REGION_ORDER) {
    const set = REGION_CODES[region];
    if (set?.has(code2)) return region;
  }
  return '其他';
}

function groupCountries(countries: CountrySummary[]) {
  const groups = new Map<string, CountrySummary[]>();
  for (const country of countries) {
    const region = regionOf(country.code);
    if (!groups.has(region)) groups.set(region, []);
    groups.get(region)!.push(country);
  }
  for (const list of groups.values()) list.sort((a, b) => a.nameZh.localeCompare(b.nameZh, 'zh'));
  const ordered: Array<{ region: string; countries: CountrySummary[] }> = [];
  for (const region of REGION_ORDER) {
    const list = groups.get(region);
    if (list?.length) ordered.push({ region, countries: list });
  }
  return ordered;
}

export function SidePanel({
  countries, countryCode, channels, loading, error,
  favorites, featuredId, missingId,
  onPickCountry, onPlay, onToggleFavorite, onRetry,
}: Props) {
  const [countryQuery, setCountryQuery] = useState('');
  const [channelQuery, setChannelQuery] = useState('');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const country = countries.find(item => item.code === countryCode);
  const grouped = useMemo(() => {
    const filtered = countryQuery.trim()
      ? countries.filter(item => normalizeQuery(`${item.nameZh} ${item.nameEn} ${item.code}`).includes(normalizeQuery(countryQuery)))
      : countries;
    return groupCountries(filtered);
  }, [countries, countryQuery]);

  const shownChannels = useMemo(() => channels
    .filter(channel => normalizeQuery(channel.name).includes(normalizeQuery(channelQuery)))
    .sort((a, b) => Number(b.id === featuredId) - Number(a.id === featuredId)
      || Number(favorites.includes(b.id)) - Number(favorites.includes(a.id))
      || a.name.localeCompare(b.name))
  , [channels, channelQuery, favorites, featuredId]);

  const clock = now.toLocaleTimeString('zh-CN', { hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <div className="flex h-full min-h-0 flex-col text-ink">
      <header className="shrink-0 border-b border-[#1f3650] px-4 py-4 sm:px-5">
        {!country ? (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <small className="text-[11px] tracking-[0.15em] text-cyan">选择国家</small>
            <h2 className="text-lg font-semibold">选择国家</h2>
            <span className="text-xs text-muted">{clock}</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              className="min-h-11 shrink-0 rounded-lg px-2 text-sm text-cyan hover:bg-raised"
              type="button"
              onClick={() => onPickCountry('')}
              aria-label="返回国家列表"
            >← 返回</button>
            <div>
              <small className="block text-[11px] tracking-wider text-cyan">{country.nameEn}</small>
              <h2 className="text-lg font-semibold">{country.nameZh}</h2>
            </div>
          </div>
        )}
      </header>

      {!country ? (
        <>
          <div className="shrink-0 px-4 pt-3 pb-2 sm:px-5">
            <input
              className="h-11 w-full rounded-lg border border-line bg-raised px-3 text-base text-ink placeholder:text-muted"
              type="search"
              placeholder="搜索国家"
              value={countryQuery}
              onChange={event => setCountryQuery(event.target.value)}
              aria-label="搜索国家"
            />
          </div>
          <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-3 pb-5 [-webkit-overflow-scrolling:touch]">
            {grouped.length === 0 && <p className="px-3 py-6 text-center text-muted">没有匹配的国家</p>}
            {grouped.map(group => (
              <section key={group.region} className="py-2">
                <div className="px-2 py-2 text-[11px] tracking-[0.18em] text-cyan">{group.region}</div>
                {group.countries.map(item => (
                  <button
                    key={item.code}
                    type="button"
                    className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-raised ${item.code === countryCode ? 'bg-[#173353] text-cyan' : 'text-ink'}`}
                    onClick={() => onPickCountry(item.code)}
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded bg-[#1c3650] text-xs font-semibold text-cyan">{item.nameZh.slice(0, 1)}</span>
                    <span className="min-w-0 flex-1">{item.nameZh}</span>
                    <span className="text-xs text-muted">{item.channelCount}</span>
                  </button>
                ))}
              </section>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="shrink-0 px-4 pt-3 pb-2 sm:px-5">
            <input
              className="h-11 w-full rounded-lg border border-line bg-raised px-3 text-base text-ink placeholder:text-muted"
              type="search"
              placeholder="搜索当前国家频道"
              value={channelQuery}
              onChange={event => setChannelQuery(event.target.value)}
              aria-label="搜索当前国家频道"
            />
          </div>
          <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-3 pb-5 [-webkit-overflow-scrolling:touch]" aria-label="播放列表">
            {missingId && <div className="m-2 rounded-lg border border-[#2c5e75] bg-[#1a3a4a] px-3 py-2 text-sm text-[#b6e0ee]">该频道已下线。可以浏览本国的其他频道。</div>}
            {loading && <p className="px-3 py-6 text-center text-muted">正在加载频道…</p>}
            {error && (
              <div className="m-2 rounded-xl border border-dashed border-line bg-raised p-4 text-center text-sm">
                <p>{error}</p>
                <button onClick={onRetry} className="mt-3 rounded-lg border border-line bg-[#1c3650] px-4 py-2">重试</button>
              </div>
            )}
            {!loading && !error && channels.length === 0 && (
              <div className="m-2 rounded-xl border border-dashed border-line bg-raised p-4 text-center text-sm">
                <p>该国家暂无频道收录。</p>
                <p className="py-3 text-muted">试试其他国家：</p>
                {countries
                  .filter(item => item.code !== countryCode && item.channelCount > 0)
                  .slice(0, 6)
                  .map(item => (
                    <button
                      key={item.code}
                      type="button"
                      className="m-1 inline-flex min-h-11 flex-col rounded-lg border border-line bg-[#1c3650] px-3 py-1 text-sm"
                      onClick={() => onPickCountry(item.code)}
                    >
                      <strong>{item.nameZh}</strong>
                      <small className="text-cyan">{item.channelCount} 个频道</small>
                    </button>
                  ))}
              </div>
            )}
            {!loading && !error && channels.length > 0 && (
              <ul className="m-0 list-none p-0">
                {shownChannels.map(channel => (
                  <li key={channel.id} className="flex min-w-0 items-center border-b border-[#1f3650]">
                    <button
                      type="button"
                      className="flex min-h-15 min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-raised"
                      onClick={() => onPlay(channel)}
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#1c3650] text-sm text-cyan">{channel.name.slice(0, 1)}</span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm font-medium">{channel.name}</strong>
                        <small className="mt-0.5 block text-xs text-muted">{channel.geoBlocked && '可能受地区限制 · '}{channel.sources.length} 个来源</small>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="grid size-11 shrink-0 place-items-center rounded-lg text-xl text-cyan hover:bg-raised"
                      onClick={() => onToggleFavorite(channel.id)}
                      aria-label={`${favorites.includes(channel.id) ? '取消收藏' : '收藏'} ${channel.name}`}
                      aria-pressed={favorites.includes(channel.id)}
                    >{favorites.includes(channel.id) ? '★' : '☆'}</button>
                  </li>
                ))}
              </ul>
            )}
            {!loading && shownChannels.length === 0 && channels.length > 0 && (
              <p className="px-3 py-6 text-center text-muted">没有匹配的频道</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
