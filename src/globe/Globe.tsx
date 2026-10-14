import { useEffect, useMemo, useRef, useState } from 'react';
import GlobeGL from 'react-globe.gl';
import { MeshPhongMaterial } from 'three';
import type { CountrySummary } from '../data/types';
import { countryCenter, loadBoundaries, type CountryFeature } from './countries';

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
  const oceanMaterial = useMemo(() => new MeshPhongMaterial({ color: '#071e31', shininess: 16, specular: '#123e59' }), []);
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

  return <div className="globe" ref={wrapper} aria-label="交互式地球。键盘操作请使用国家列表。">
    <GlobeGL ref={globe} width={size.width} height={size.height} backgroundColor="rgba(0,0,0,0)" globeMaterial={oceanMaterial}
      showAtmosphere atmosphereColor="#5d9bc1" atmosphereAltitude={0.18}
      polygonsData={features} polygonAltitude={feature => (feature as CountryFeature).properties.code === selectedCode ? 0.025 : 0.008}
      polygonCapColor={feature => {
        const code = (feature as CountryFeature).properties.code;
        return code === selectedCode ? '#e6b771' : code === hovered ? '#5baec5' : byCode.get(code)?.channelCount ? '#37718c' : '#263e54';
      }}
      polygonSideColor={() => '#0e2435'} polygonStrokeColor={() => '#7295a6'}
      polygonLabel={feature => {
        const item = byCode.get((feature as CountryFeature).properties.code);
        return item ? `<div class="globe-tip">${item.nameZh} · ${item.channelCount} 个频道</div>` : '';
      }}
      onPolygonHover={feature => setHovered((feature as CountryFeature | null)?.properties.code)}
      onPolygonClick={feature => { setInteracted(true); onSelect((feature as CountryFeature).properties.code); }}
      onGlobeReady={() => {
        try { globe.current?.renderer(); } catch { onFailure(); }
      }}
    />
  </div>;
}
