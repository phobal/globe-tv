import { useEffect, useRef, useState } from 'react';
import mapboxgl, { type Map as MapboxMap } from 'mapbox-gl';
import type { FeatureCollection } from 'geojson';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { CountrySummary } from '../data/types';
import type { ThemeMode } from '../preferences/theme';
import { countryCenter, loadBoundaries, type CountryFeature } from './countries';

interface Props {
  token: string;
  countries: CountrySummary[];
  selectedCode?: string;
  onSelect: (code: string) => void;
  onFailure: () => void;
  themeMode: ThemeMode;
}

const SOURCE = 'channel-countries';
const LABEL_SOURCE = 'country-label-points';
const LABELS = 'country-labels-small-globe';
const HIT = 'country-hit';
const HOVER = 'country-hover';
const SELECTED = 'country-selected';
const SELECTED_LINE = 'country-selected-line';
const codeFilter = (code?: string): mapboxgl.FilterSpecification => ['==', ['get', 'code'], code ?? ''];
const globeZoom = (height: number) => Math.max(0.2, Math.min(1.75, 1.75 + Math.log2(Math.max(height, 1) / 570)));

function fogFor(themeMode: ThemeMode): mapboxgl.FogSpecification {
  if (themeMode === 'dark') {
    return {
      color: '#c7e5ff',
      'high-color': '#315c87',
      'horizon-blend': 0.025,
      'space-color': '#07182c',
      'star-intensity': 0.5,
    };
  }
  return {
    color: '#e6f0f8',
    'high-color': '#a8c5dc',
    'horizon-blend': 0.02,
    'space-color': '#d4e6f5',
    'star-intensity': 0,
  };
}

export function Globe({ token, countries, selectedCode, onSelect, onFailure, themeMode }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const featuresRef = useRef<CountryFeature[]>([]);
  const selectedRef = useRef(selectedCode);
  const onSelectRef = useRef(onSelect);
  const onFailureRef = useRef(onFailure);
  const themeRef = useRef(themeMode);
  const styleReadyRef = useRef(false);
  const [hoveredCode, setHoveredCode] = useState<string>();
  selectedRef.current = selectedCode;
  onSelectRef.current = onSelect;
  onFailureRef.current = onFailure;
  themeRef.current = themeMode;

  useEffect(() => {
    if (!container.current || !mapboxgl.supported()) {
      onFailureRef.current();
      return;
    }
    let disposed = false;
    let styleReady = false;
    let map: MapboxMap;
    try {
      map = new mapboxgl.Map({
        container: container.current,
        accessToken: token,
        style: 'mapbox://styles/mapbox/outdoors-v12',
        projection: 'globe',
        center: [15, 20],
        zoom: globeZoom(container.current.clientHeight),
        pitch: 0,
        bearing: 0,
        antialias: true,
        scrollZoom: true,
        dragRotate: true,
      });
    } catch {
      onFailureRef.current();
      return;
    }
    mapRef.current = map;
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container.current);
    map.on('error', () => {
      if (!styleReady && !disposed) onFailureRef.current();
    });
    map.on('style.load', async () => {
      if (disposed) return;
      styleReady = true;
      styleReadyRef.current = true;
      map.setFog(fogFor(themeRef.current));
      try {
        const features = await loadBoundaries();
        if (disposed) return;
        featuresRef.current = features;
        map.addSource(SOURCE, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features } as unknown as FeatureCollection,
        });
        map.addSource(LABEL_SOURCE, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: features.map(feature => {
              const { lng, lat } = countryCenter(feature);
              return {
                type: 'Feature' as const,
                properties: { name: feature.properties.name },
                geometry: { type: 'Point' as const, coordinates: [lng, lat] },
              };
            }),
          },
        });
        map.addLayer({
          id: HIT,
          type: 'fill',
          source: SOURCE,
          paint: { 'fill-color': '#60a5fa', 'fill-opacity': 0.01 },
        });
        map.addLayer({
          id: 'country-borders',
          type: 'line',
          source: SOURCE,
          paint: { 'line-color': '#e9a4af', 'line-opacity': 0.65, 'line-width': 0.8 },
        });
        map.addLayer({
          id: HOVER,
          type: 'fill',
          source: SOURCE,
          filter: codeFilter(),
          paint: { 'fill-color': '#f5b969', 'fill-opacity': 0.22 },
        });
        map.addLayer({
          id: SELECTED,
          type: 'fill',
          source: SOURCE,
          filter: codeFilter(selectedRef.current),
          paint: { 'fill-color': '#f5b969', 'fill-opacity': 0.26 },
        });
        map.addLayer({
          id: SELECTED_LINE,
          type: 'line',
          source: SOURCE,
          filter: codeFilter(selectedRef.current),
          paint: { 'line-color': '#e97856', 'line-opacity': 0.95, 'line-width': 2 },
        });
        map.addLayer({
          id: LABELS,
          type: 'symbol',
          source: LABEL_SOURCE,
          maxzoom: 1.2,
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'],
            'text-size': 11,
          },
          paint: {
            'text-color': '#213548',
            'text-halo-color': '#f9fff3',
            'text-halo-width': 1.4,
          },
        });
        const selected = features.find(item => item.properties.code === selectedRef.current);
        if (selected) {
          const { lat, lng } = countryCenter(selected);
          map.jumpTo({ center: [lng, lat], zoom: globeZoom(map.getContainer().clientHeight) });
        }
        map.on('mousemove', HIT, event => {
          const code = event.features?.[0]?.properties?.code as string | undefined;
          map.getCanvas().style.cursor = code ? 'pointer' : '';
          map.setFilter(HOVER, codeFilter(code));
          setHoveredCode(code);
        });
        map.on('mouseleave', HIT, () => {
          map.getCanvas().style.cursor = '';
          map.setFilter(HOVER, codeFilter());
          setHoveredCode(undefined);
        });
        map.on('click', HIT, event => {
          const code = event.features?.[0]?.properties?.code as string | undefined;
          if (code) onSelectRef.current(code);
        });
      } catch {
        if (!disposed) onFailureRef.current();
      }
    });
    return () => {
      disposed = true;
      resizeObserver.disconnect();
      mapRef.current = null;
      map.remove();
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer(SELECTED)) return;
    map.setFilter(SELECTED, codeFilter(selectedCode));
    map.setFilter(SELECTED_LINE, codeFilter(selectedCode));
    const selected = featuresRef.current.find(item => item.properties.code === selectedCode);
    if (!selected) return;
    const { lat, lng } = countryCenter(selected);
    map.easeTo({
      center: [lng, lat],
      zoom: globeZoom(map.getContainer().clientHeight),
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 850,
      essential: false,
    });
  }, [selectedCode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    map.setFog(fogFor(themeMode));
  }, [themeMode]);

  const hovered = countries.find(item => item.code === hoveredCode);
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden" aria-label="交互式地球。键盘操作请使用国家列表。">
      <div className="absolute inset-0">
        <div ref={container} className="h-full w-full" />
      </div>
      {hovered && (
        <div className="pointer-events-none absolute bottom-8 left-4 rounded-lg border border-globe-divider bg-[var(--app-overlay-bg)] px-3 py-2 text-xs text-ink shadow-lg backdrop-blur-md">
          <strong className="block text-sm font-semibold">{hovered.nameZh}</strong>
          <span className="text-cyan">{hovered.channelCount} 个频道</span>
        </div>
      )}
    </div>
  );
}
