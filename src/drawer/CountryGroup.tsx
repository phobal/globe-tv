import { useMemo, useState } from 'react';
import { normalizeQuery } from '../data/catalog';
import type { CountrySummary } from '../data/types';
import styles from './drawer.module.css';

const REGION_ORDER = ['亚洲', '欧洲', '非洲', '北美洲', '南美洲', '大洋洲', '其他'];

const REGION_CODES: Record<string, Set<string>> = {
  亚洲: new Set(['cn','jp','kr','in','th','vn','sg','id','my','ph','pk','bd','lk','np','mm','kh','la','tw','hk','mo','mn','af','ir','iq','sa','ae','qa','kw','om','ye','jo','lb','il','tr','sy','ps','bt','mv','bn','kz','uz','tj','tm','kg','az','am','ge','az']),
  欧洲: new Set(['gb','fr','de','it','es','pt','nl','be','lu','ch','at','ie','no','se','fi','dk','is','pl','cz','sk','hu','ro','bg','gr','hr','si','rs','ba','mk','al','me','md','ua','by','lt','lv','ee','ru','cy','mt','ad','mc','li','sm','va','fo','gl','ax']),
  非洲: new Set(['eg','ly','tn','dz','ma','sd','ss','et','er','dj','so','ke','tz','ug','rw','bi','mz','mg','mu','sc','km','za','zw','zm','bw','na','ao','cd','cg','cm','cf','td','ng','ne','ml','sn','gm','gw','gn','sl','lr','ci','gh','tg','bj','bf','cv','st','eh','ls','sz','mw','re','yt','sh','pm','io','tf']),
  北美洲: new Set(['us','ca','mx','cu','gt','bz','hn','sv','ni','cr','pa','bs','jm','ht','do','pr','tt','bb','lc','gd','vc','ag','dm','kn','mq','gp','aw','bq','cw','sx','tc','ky','bm','vg','vi','mf','bl','pm']),
  南美洲: new Set(['br','ar','cl','co','pe','ve','ec','bo','uy','py','gy','sr','gf','fk']),
  大洋洲: new Set(['au','nz','fj','pg','sb','vu','ws','to','tv','nr','ki','fm','mh','pw','nc','pf','wf','ck','nu','tk','mp','gu','as','nf']),
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
  for (const list of groups.values()) {
    list.sort((a, b) => a.nameZh.localeCompare(b.nameZh, 'zh'));
  }
  const ordered: Array<{ region: string; countries: CountrySummary[] }> = [];
  for (const region of REGION_ORDER) {
    const list = groups.get(region);
    if (list?.length) ordered.push({ region, countries: list });
  }
  return ordered;
}

interface Props {
  hidden?: boolean;
  countries: CountrySummary[];
  onPick: (code: string) => void;
}

export function CountryGroup({ hidden, countries, onPick }: Props) {
  const [query, setQuery] = useState('');
  const grouped = useMemo(() => {
    const filtered = query.trim()
      ? countries.filter(item => normalizeQuery(`${item.nameZh} ${item.nameEn} ${item.code}`).includes(normalizeQuery(query)))
      : countries;
    return groupCountries(filtered);
  }, [countries, query]);

  if (hidden) return null;

  return (
    <div>
      <input
        className={styles.search}
        type="search"
        placeholder="搜索国家（中/英）"
        value={query}
        onChange={event => setQuery(event.target.value)}
        data-autofocus={query === '' ? true : undefined}
        aria-label="搜索国家"
      />
      {grouped.length === 0 && <p className={styles.empty}>没有匹配的国家</p>}
      {grouped.map(group => (
        <section key={group.region} className={styles.region}>
          <h3>{group.region} <small>{group.countries.length}</small></h3>
          <ul>
            {group.countries.map(country => (
              <li key={country.code}>
                <button type="button" onClick={() => onPick(country.code)} disabled={country.channelCount === 0}>
                  <span className={styles.flag}>{country.nameZh.slice(0, 1)}</span>
                  <span className={styles.name}>
                    <strong>{country.nameZh}</strong>
                    <small>{country.nameEn}</small>
                  </span>
                  <span className={styles.count}>{country.channelCount}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
