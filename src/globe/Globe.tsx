import { useEffect, useMemo, useRef, useState } from 'react';
import GlobeGL from 'react-globe.gl';
import { MeshPhongMaterial } from 'three';
import type { CountrySummary } from '../data/types';
import { countryCenter, loadBoundaries, type CountryFeature } from './countries';
import { LABEL_CHANNEL_THRESHOLD } from './labelDedup';

interface Props {
  countries: CountrySummary[];
  selectedCode?: string;
  onSelect: (code: string) => void;
  onFailure: () => void;
}

export function Globe({ countries, selectedCode, onSelect, onFailure }: Props) {
  const [features, setFeatures] = useState<CountryFeature[]>([]);
  const [hovered, setHovered] = useState<string>();
  const [size, setSize] = useState({ width: 600, height: 600 });
  const [interacted, setInteracted] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const globe = useRef<any>(null);
  const byCode = useMemo(() => new Map(countries.map(item => [item.code, item])), [countries]);
  const oceanMaterial = useMemo(() => new MeshPhongMaterial({
    color: '#4ba3d0',
    shininess: 22,
    specular: '#2c7fb3',
    emissive: '#1c4a73',
    emissiveIntensity: 0.18,
  }), []);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => { loadBoundaries().then(setFeatures).catch(onFailure); }, [onFailure]);
  useEffect(() => {
    if (!wrapper.current) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: Math.max(1, entry.contentRect.width), height: Math.max(1, entry.contentRect.height) }));
    observer.observe(wrapper.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const controls = globe.current?.controls();
    if (!controls) return;
    controls.autoRotate = !interacted && !reduced && !selectedCode;
    controls.autoRotateSpeed = 0.35;
    const stop = () => setInteracted(true);
    controls.addEventListener('start', stop);
    return () => controls.removeEventListener('start', stop);
  }, [interacted, reduced, features, selectedCode]);
  useEffect(() => {
    const selected = features.find(item => item.properties.code === selectedCode);
    if (!selected || !globe.current) return;
    globe.current.pointOfView({ ...countryCenter(selected), altitude: 1.9 }, reduced ? 0 : 900);
  }, [selectedCode, features, reduced]);

  return <div className="relative min-h-0 flex-1 cursor-grab active:cursor-grabbing [&_canvas]:block" ref={wrapper} aria-label="交互式地球。键盘操作请使用国家列表。">
    <GlobeGL
      ref={globe}
      width={size.width}
      height={size.height}
      backgroundColor="rgba(0,0,0,0)"
      globeMaterial={oceanMaterial}
      showAtmosphere
      atmosphereColor="#9bd4f0"
      atmosphereAltitude={0.28}
      polygonsData={features}
      polygonAltitude={feature => (feature as CountryFeature).properties.code === selectedCode ? 0.022 : 0.006}
      polygonCapColor={feature => {
        const code = (feature as CountryFeature).properties.code;
        if (code === selectedCode) return '#d7e7c8';
        if (code === hovered) return '#c8e2c1';
        const item = byCode.get(code);
        if (!item) return '#7a9a78';
        return item.channelCount >= LABEL_CHANNEL_THRESHOLD
          ? '#cae0c4'
          : item.channelCount > 0 ? '#b8d9b5' : '#7a9a78';
      }}
      polygonSideColor={() => '#7fa8c2'}
      polygonStrokeColor={() => '#ff5b6e'}
      polygonLabel={feature => {
        const item = byCode.get((feature as CountryFeature).properties.code);
        if (!item) return '';
        const sub = item.channelCount >= LABEL_CHANNEL_THRESHOLD
          ? `<br><small>${item.channelCount} 个频道</small>`
          : `<br><small>${item.channelCount} 个频道</small>`;
        return `<div class="rounded-md border border-[#4b6a82] bg-[#0d1b2ae6] px-2 py-1 text-xs text-white [&_small]:text-cyan"><strong>${item.nameZh}</strong>${sub}</div>`;
      }}
      polygonsTransitionDuration={300}
      onPolygonHover={feature => setHovered((feature as CountryFeature | null)?.properties.code)}
      onPolygonClick={feature => { setInteracted(true); onSelect((feature as CountryFeature).properties.code); }}
      onGlobeReady={() => {
        try { globe.current?.renderer(); } catch { onFailure(); }
      }}
    />
  </div>;
}
