import type { CountrySummary } from '../data/types';

export function CountryList({ countries, selectedCode, onSelect }: { countries: CountrySummary[]; selectedCode?: string; onSelect: (code: string) => void }) {
  return <div className="country-list" aria-label="国家列表">
    {countries.map(country => <button key={country.code} type="button" className={country.code === selectedCode ? 'country active' : 'country'} onClick={() => onSelect(country.code)}>
      <span>{country.nameZh}<small>{country.nameEn}</small></span>
      <span className="count">{country.channelCount}</span>
    </button>)}
  </div>;
}
