import { useEffect, useMemo, useState } from 'react';
import type { CatalogIndex, Channel, CountrySummary } from '../data/types';
import { normalizeQuery } from '../data/catalog';
import styles from './sidepanel.module.css';

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
    <div className={styles.panel}>
      <header className={styles.head}>
        {!country ? (
          <div className={styles.headTitle}>
            <small>选择国家</small>
            <h2>选择国家</h2>
            <span className={styles.clock}>{clock}</span>
          </div>
        ) : (
          <div className={styles.headTitle}>
            <button
              className={styles.backBtn}
              type="button"
              onClick={() => onPickCountry('')}
              aria-label="返回国家列表"
            >← 返回</button>
            <div>
              <small>{country.nameEn}</small>
              <h2>{country.nameZh}</h2>
            </div>
          </div>
        )}
      </header>

      {!country ? (
        <>
          <div style={{ padding: '10px 18px 8px' }}>
            <input
              className={styles.search}
              type="search"
              placeholder="搜索国家"
              value={countryQuery}
              onChange={event => setCountryQuery(event.target.value)}
              aria-label="搜索国家"
            />
          </div>
          <div className={styles.list}>
            {grouped.length === 0 && <p className={styles.empty}>没有匹配的国家</p>}
            {grouped.map(group => (
              <section key={group.region} className={styles.region}>
                <div className={styles.regionLabel}>{group.region}</div>
                {group.countries.map(item => (
                  <button
                    key={item.code}
                    type="button"
                    className={item.code === countryCode ? `${styles.row} ${styles.active}` : styles.row}
                    onClick={() => onPickCountry(item.code)}
                  >
                    <span className={styles.flag}>{item.nameZh.slice(0, 1)}</span>
                    <span className={styles.name}>{item.nameZh}</span>
                    <span className={styles.count}>{item.channelCount}</span>
                  </button>
                ))}
              </section>
            ))}
          </div>
        </>
      ) : (
        <>
          <div style={{ padding: '10px 18px 8px' }}>
            <input
              className={styles.search}
              type="search"
              placeholder="搜索当前国家频道"
              value={channelQuery}
              onChange={event => setChannelQuery(event.target.value)}
              aria-label="搜索当前国家频道"
            />
          </div>
          <div className={styles.list}>
            {missingId && <div className={styles.deepLinkBanner}>该频道已下线。可以浏览本国的其他频道。</div>}
            {loading && <p className={styles.empty}>正在加载频道…</p>}
            {error && (
              <div className={styles.noChannels}>
                <p>{error}</p>
                <button onClick={onRetry} className={styles.suggestion}>重试</button>
              </div>
            )}
            {!loading && !error && channels.length === 0 && (
              <div className={styles.noChannels}>
                <p>该国家暂无频道收录。</p>
                <p className={styles.empty}>试试其他国家：</p>
                {countries
                  .filter(item => item.code !== countryCode && item.channelCount > 0)
                  .slice(0, 6)
                  .map(item => (
                    <button
                      key={item.code}
                      type="button"
                      className={styles.suggestion}
                      onClick={() => onPickCountry(item.code)}
                    >
                      <strong>{item.nameZh}</strong>
                      <small>{item.channelCount} 个频道</small>
                    </button>
                  ))}
              </div>
            )}
            {!loading && !error && channels.length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {shownChannels.map(channel => (
                  <li key={channel.id} style={{ display: 'flex', alignItems: 'center' }}>
                    <button
                      type="button"
                      className={styles.channelRow}
                      onClick={() => onPlay(channel)}
                    >
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
            )}
            {!loading && shownChannels.length === 0 && channels.length > 0 && (
              <p className={styles.empty}>没有匹配的频道</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
