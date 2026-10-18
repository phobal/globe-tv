import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { feature } from 'topojson-client';
import countries from 'i18n-iso-countries';

function splitAntimeridianRing(ring) {
  const unwrapped = [ring[0]];
  for (const [longitude, latitude, ...rest] of ring.slice(1)) {
    let adjustedLongitude = longitude;
    const previousLongitude = unwrapped.at(-1)[0];
    while (adjustedLongitude - previousLongitude > 180) adjustedLongitude -= 360;
    while (adjustedLongitude - previousLongitude < -180) adjustedLongitude += 360;
    unwrapped.push([adjustedLongitude, latitude, ...rest]);
  }

  const clip = (points, boundary, keepGreater) => {
    const clipped = [];
    const vertices = points.length > 1 && points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1]
      ? points.slice(0, -1)
      : points;
    for (let index = 0; index < vertices.length; index += 1) {
      const start = vertices[index];
      const end = vertices[(index + 1) % vertices.length];
      const startInside = keepGreater ? start[0] >= boundary : start[0] <= boundary;
      const endInside = keepGreater ? end[0] >= boundary : end[0] <= boundary;
      if (startInside) clipped.push(start);
      if (startInside !== endInside) {
        const fraction = (boundary - start[0]) / (end[0] - start[0]);
        clipped.push([boundary, start[1] + fraction * (end[1] - start[1])]);
      }
    }
    return clipped;
  };

  const longitudes = unwrapped.map(point => point[0]);
  const firstBand = Math.floor((Math.min(...longitudes) + 180) / 360);
  const lastBand = Math.floor((Math.max(...longitudes) + 180) / 360);
  const pieces = [];
  for (let band = firstBand; band <= lastBand; band += 1) {
    let piece = clip(unwrapped, -180 + 360 * band, true);
    piece = clip(piece, 180 + 360 * band, false);
    piece = piece.map(([longitude, latitude]) => [longitude - 360 * band, latitude]);
    piece = piece.filter((point, index) => index === 0 || point[0] !== piece[index - 1][0] || point[1] !== piece[index - 1][1]);
    if (piece.length < 3) continue;
    if (piece[0][0] !== piece.at(-1)[0] || piece[0][1] !== piece.at(-1)[1]) piece.push(piece[0]);
    if (piece.length >= 4) pieces.push(piece);
  }
  return pieces;
}

function repairFijiGeometry(geometry) {
  if (geometry.type !== 'MultiPolygon') return geometry;
  const coordinates = [];
  for (const polygon of geometry.coordinates) {
    const outerRing = polygon[0];
    const crossesAntimeridian = outerRing.some((point, index) => index > 0 && Math.abs(point[0] - outerRing[index - 1][0]) > 180);
    if (!crossesAntimeridian || polygon.length > 1) {
      coordinates.push(polygon);
      continue;
    }
    for (const piece of splitAntimeridianRing(outerRing)) coordinates.push([piece]);
  }
  return { ...geometry, coordinates };
}

const topo = JSON.parse(await readFile('node_modules/world-atlas/countries-110m.json', 'utf8'));
const collection = feature(topo, topo.objects.countries);
const features = collection.features.flatMap(item => {
  const code = countries.numericToAlpha2(item.id)?.toLowerCase();
  return code ? [{
    ...item,
    geometry: code === 'fj' ? repairFijiGeometry(item.geometry) : item.geometry,
    properties: { code, name: item.properties.name },
  }] : [];
});
await mkdir('public/geo', { recursive: true });
await writeFile('public/geo/countries.geojson', JSON.stringify({ type: 'FeatureCollection', features }));
console.log(`国界：${features.length} 个 ISO 代码；其余地区通过国家列表访问`);
