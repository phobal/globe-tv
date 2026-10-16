import type { CatalogIndex, Channel, PopularCatalog } from './types';

const base = import.meta.env.BASE_URL;
let indexPromise: Promise<CatalogIndex> | undefined;
let popularPromise: Promise<PopularCatalog> | undefined;
const countryPromises = new Map<string, Promise<Channel[]>>();

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${base}${path}`);
  if (!response.ok) throw new Error(`数据加载失败：${response.status}`);
  return response.json() as Promise<T>;
}

export function loadIndex(): Promise<CatalogIndex> {
  indexPromise ??= fetchJson<CatalogIndex>('data/index.json').catch(error => {
    indexPromise = undefined;
    throw error;
  });
  return indexPromise;
}

export function loadCountry(code: string): Promise<Channel[]> {
  if (!/^[a-z]{2}$/.test(code)) return Promise.reject(new Error('无效国家代码'));
  if (!countryPromises.has(code)) {
    countryPromises.set(code, fetchJson<Channel[]>(`data/countries/${code}.json`).catch(error => {
      countryPromises.delete(code);
      throw error;
    }));
  }
  return countryPromises.get(code)!;
}

export function loadPopular(): Promise<PopularCatalog> {
  popularPromise ??= fetchJson<PopularCatalog>('data/popular.json').catch(error => {
    popularPromise = undefined;
    throw error;
  });
  return popularPromise;
}

export function normalizeQuery(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function searchCatalog(index: CatalogIndex, query: string) {
  const term = normalizeQuery(query);
  if (!term) return { countries: [], channels: [] };
  return {
    countries: index.countries.filter(country =>
      normalizeQuery(`${country.nameZh} ${country.nameEn} ${country.code}`).includes(term)),
    channels: index.channels.filter(channel => normalizeQuery(channel.name).includes(term)),
  };
}
