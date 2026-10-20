export interface StreamSource {
  kind: 'hls';
  url: string;
  order: number;
}

export interface Channel {
  logo?: string;
  group?: string;
  id: string;
  name: string;
  countryCode: string;
  languages: string[];
  geoBlocked: boolean;
  sources: StreamSource[];
}

export interface PopularChannel extends Channel {
  tvgId: string;
  category: string;
  rank: number;
}

export interface PopularCatalog {
  version: string;
  upstreamCommit: string;
  channels: PopularChannel[];
}

export interface CountrySummary {
  code: string;
  nameZh: string;
  nameEn: string;
  channelCount: number;
  timeZone?: string;
}

export interface CatalogIndex {
  version: string;
  upstreamCommit: string;
  countries: CountrySummary[];
  channels: Pick<Channel, 'id' | 'name' | 'countryCode'>[];
}

export type DiscoveryCategoryId = 'central' | 'local' | 'sports' | 'entertainment' | 'kids' | 'overseas' | 'more';
export interface ChannelSummary {
  id: string;
  name: string;
  logo?: string;
  countryCode: string;
  languages: string[];
  groupSlug: string;
  groupName: string;
  categoryIds: DiscoveryCategoryId[];
  primaryCategory: DiscoveryCategoryId;
  contentType: 'live' | 'replay' | 'on-demand' | 'radio' | 'scenic';
}
export interface DiscoveryCatalog {
  version: string;
  categories: Array<{ id: DiscoveryCategoryId; name: string; channelCount: number }>;
  groups: Array<{ slug: string; name: string }>;
  channels: ChannelSummary[];
}
