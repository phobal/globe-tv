export interface CountryFeature {
  type: 'Feature';
  properties: { code: string; name: string };
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] };
}

export async function loadBoundaries(): Promise<CountryFeature[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}geo/countries.geojson`);
  if (!response.ok) throw new Error('国界数据加载失败');
  const data = await response.json();
  if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('国界数据格式错误');
  return data.features;
}

export function countryCenter(feature: CountryFeature): { lat: number; lng: number } {
  const rings = feature.geometry.type === 'Polygon'
    ? feature.geometry.coordinates as number[][][]
    : (feature.geometry.coordinates as number[][][][]).flat();
  const ring = rings.reduce((best, current) => current.length > best.length ? current : best, [] as number[][]);
  const points = ring.slice(0, -1);
  if (!points.length) return { lat: 0, lng: 0 };
  const sum = points.reduce((acc, [lng, lat]) => ({ x: acc.x + Math.cos(lng * Math.PI / 180), y: acc.y + Math.sin(lng * Math.PI / 180), lat: acc.lat + lat }), { x: 0, y: 0, lat: 0 });
  return { lat: sum.lat / points.length, lng: Math.atan2(sum.y, sum.x) * 180 / Math.PI };
}
