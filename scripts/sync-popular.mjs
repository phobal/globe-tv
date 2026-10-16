import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildPopularCatalog, parseM3u } from './popular-core.mjs';

const inputDir = process.argv[2] ?? '.iptv-upstream';
const outputDir = process.argv[3] ?? 'public/data';
const attempts = Number(process.env.POPULAR_PROBE_ATTEMPTS ?? 2);
const timeoutMs = Number(process.env.POPULAR_PROBE_TIMEOUT_MS ?? 12_000);
const selections = JSON.parse(await readFile(new URL('./popular-channels.json', import.meta.url), 'utf8'));

async function loadEntries() {
  const streamDir = path.join(inputDir, 'streams');
  const files = (await readdir(streamDir)).filter(filename => filename.endsWith('.m3u')).sort();
  const groups = await Promise.all(files.map(async filename => parseM3u(await readFile(path.join(streamDir, filename), 'utf8'))));
  return groups.flat();
}

async function fetchManifest(url, signal) {
  const started = Date.now();
  const headers = { 'user-agent': 'GlobeTV popular-channel-check/1.0', origin: 'http://localhost:5173' };
  const response = await fetch(url, { signal, redirect: 'follow', headers });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  if (!text.includes('#EXTM3U')) throw new Error('响应不是 HLS 播放列表');
  const child = text.split(/\r?\n/).map(line => line.trim()).find(line => line && !line.startsWith('#'));
  if (text.includes('#EXT-X-STREAM-INF') && child) {
    const childResponse = await fetch(new URL(child, response.url), { signal, redirect: 'follow', headers });
    if (!childResponse.ok || !(await childResponse.text()).includes('#EXTM3U')) throw new Error('子播放列表无效');
  }
  return { latencyMs: Date.now() - started, corsAllowed: response.headers.get('access-control-allow-origin') === '*' };
}

async function probe(url) {
  let successes = 0;
  let latencyTotal = 0;
  let corsAllowed = false;
  let lastError = '';
  for (let round = 0; round < attempts; round += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const result = await fetchManifest(url, controller.signal);
      successes += 1;
      latencyTotal += result.latencyMs;
      corsAllowed ||= result.corsAllowed;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    } finally {
      clearTimeout(timer);
    }
  }
  return { attempts, successes, latencyMs: successes ? Math.round(latencyTotal / successes) : timeoutMs, corsAllowed, lastError };
}

async function mapConcurrent(values, concurrency, worker) {
  const results = new Array(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await worker(values[index], index);
    }
  }));
  return results;
}

const entries = await loadEntries();
const selectedEntries = selections.flatMap(selection => entries
  .filter(entry => entry.channelId === selection.id && !entry.geoBlocked)
  .filter(entry => !selection.variants || selection.variants.includes(entry.tvgId))
  .sort((a, b) => b.quality - a.quality)
  .slice(0, 8));
const urls = [...new Set(selectedEntries.map(entry => entry.url))];
console.log(`正在检测 ${selections.length} 个频道的 ${urls.length} 个候选源（${attempts} 轮）…`);
const results = await mapConcurrent(urls, 16, async (url, index) => {
  const result = await probe(url);
  console.log(`[${index + 1}/${urls.length}] ${result.successes}/${attempts} ${url}`);
  return result;
});
const probes = new Map(urls.map((url, index) => [url, results[index]]));
const checkedAt = new Date().toISOString();
const upstreamCommit = (await readFile(path.join(inputDir, '.git', 'refs', 'heads', 'master'), 'utf8').catch(() => process.env.UPSTREAM_SHA ?? 'unknown')).trim();
const built = buildPopularCatalog(entries, selections, probes, { expectedCount: 50, checkedAt, upstreamCommit });
await writeFile(path.join(outputDir, 'popular.json'), `${JSON.stringify(built.catalog, null, 2)}\n`);
await writeFile(path.join(outputDir, 'popular-report.json'), `${JSON.stringify({ ...built.report, probes: Object.fromEntries(probes) }, null, 2)}\n`);
console.log(`热门频道同步完成：${built.channels.length} 个频道`);
