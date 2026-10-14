import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { feature } from 'topojson-client';
import countries from 'i18n-iso-countries';

const topo = JSON.parse(await readFile('node_modules/world-atlas/countries-110m.json', 'utf8'));
const collection = feature(topo, topo.objects.countries);
const features = collection.features.flatMap(item => {
  const code = countries.numericToAlpha2(item.id)?.toLowerCase();
  return code ? [{ ...item, properties: { code, name: item.properties.name } }] : [];
});
await mkdir('public/geo', { recursive: true });
await writeFile('public/geo/countries.geojson', JSON.stringify({ type: 'FeatureCollection', features }));
console.log(`国界：${features.length} 个 ISO 代码；其余地区通过国家列表访问`);
