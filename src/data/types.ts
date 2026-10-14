export interface StreamSource {
  kind: 'hls';
  url: string;
  order: number;
}

export interface Channel {
  id: string;
  name: string;
  countryCode: string;
  languages: string[];
  geoBlocked: boolean;
  sources: StreamSource[];
}

export interface CountrySummary {
  code: string;
  nameZh: string;
  nameEn: string;
  channelCount: number;
}

export interface CatalogIndex {
  version: string;
  upstreamCommit: string;
  countries: CountrySummary[];
  channels: Pick<Channel, 'id' | 'name' | 'countryCode'>[];
}
