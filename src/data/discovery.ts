import type { Channel, ChannelSummary, DiscoveryCatalog } from './types';
const base = import.meta.env.BASE_URL;
let catalogPromise: Promise<DiscoveryCatalog> | undefined;
const groups = new Map<string, Promise<Channel[]>>();
async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${base}data/${path}`);
  if (!response.ok) throw new Error(`频道数据加载失败：${response.status}`);
  return response.json() as Promise<T>;
}
export function loadDiscovery(): Promise<DiscoveryCatalog> {
  catalogPromise ??= fetchJson<DiscoveryCatalog>('discovery.json').catch(error => { catalogPromise = undefined; throw error; });
  return catalogPromise;
}
export async function loadDiscoveryChannel(summary: ChannelSummary): Promise<Channel> {
  if (!/^[\p{L}\p{N}_-]+$/u.test(summary.groupSlug)) throw new Error('无效来源分组');
  if (!groups.has(summary.groupSlug)) groups.set(summary.groupSlug, fetchJson<Channel[]>(`category/${encodeURIComponent(summary.groupSlug)}.json`).catch(error => { groups.delete(summary.groupSlug); throw error; }));
  const channel = (await groups.get(summary.groupSlug)!).find(c => c.id === summary.id);
  if (!channel) throw new Error('频道已不可用，请重新选台');
  return channel;
}
