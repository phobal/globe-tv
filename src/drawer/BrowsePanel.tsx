import { useMemo } from 'react';
import type { CatalogIndex, Channel } from '../data/types';
import { CountryGroup } from './CountryGroup';
import { ChannelListSection } from './ChannelListSection';

interface Props {
  open: boolean;
  index: CatalogIndex;
  channels: Channel[];
  countryCode?: string;
  loading: boolean;
  error?: string;
  favorites: string[];
  featuredId?: string;
  missingId?: string;
  onClose: () => void;
  onPickCountry: (code: string) => void;
  onPlay: (channel: Channel) => void;
  onToggleFavorite: (id: string) => void;
  onRetry: () => void;
}

export function BrowsePanel({
  open, index, channels, countryCode, loading, error,
  favorites, featuredId, missingId,
  onClose, onPickCountry, onPlay, onToggleFavorite, onRetry,
}: Props) {
  const country = index.countries.find(item => item.code === countryCode);
  const topCountries = useMemo(() =>
    [...index.countries]
      .filter(item => item.code !== countryCode && item.channelCount > 0)
      .sort((a, b) => b.channelCount - a.channelCount)
      .slice(0, 6)
  , [index.countries, countryCode]);

  return (
    <>
      <CountryGroup
        hidden={!open || Boolean(countryCode)}
        countries={index.countries}
        onPick={onPickCountry}
      />
      <ChannelListSection
        hidden={!open || !countryCode}
        country={country}
        channels={channels}
        loading={loading}
        error={error}
        favorites={favorites}
        featuredId={featuredId}
        missingId={missingId}
        onPlay={onPlay}
        onToggleFavorite={onToggleFavorite}
        onRetry={onRetry}
        onBack={onClose}
        onPickCountry={onPickCountry}
        topCountries={topCountries}
      />
    </>
  );
}
