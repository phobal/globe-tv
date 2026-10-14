import { readFile, readdir, mkdir, writeFile, rename, rm, copyFile } from 'node:fs/promises';
import path from 'node:path';

export function normalizeChannel(value, expectedCountry) {
  if (!value || typeof value !== 'object' || typeof value.nanoid !== 'string' ||
      !value.nanoid.trim() || typeof value.name !== 'string' || !value.name.trim() ||
      typeof value.country !== 'string' || value.country.toLowerCase() !== expectedCountry ||
      !value.sources || typeof value.sources !== 'object') return null;
  const streams = value.sources.streams;
  if (streams !== undefined && !Array.isArray(streams)) return null;
  const seen = new Set();
  const sources = (streams ?? []).flatMap((url, order) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url.trim()) ||
        !/\.m3u8(?:[?#]|$)/i.test(url) || seen.has(url.trim())) return [];
    seen.add(url.trim());
    return [{ kind: 'hls', url: url.trim(), order }];
  });
  if (!sources.length) return null;
  return {
    id: value.nanoid.trim(), name: value.name.trim(), countryCode: expectedCountry,
    languages: Array.isArray(value.languages) ? value.languages.filter(item => typeof item === 'string') : [],
    geoBlocked: value.isGeoBlocked === true, sources,
  };
}

export function buildCatalog(metadata, countryFiles, zhNames = {}, upstreamCommit = 'unknown') {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error('国家元数据格式错误');
  const countries = [];
  const channels = [];
  const files = new Map();
  const rejected = [];
  const ids = new Set();
  for (const [rawCode, info] of Object.entries(metadata)) {
    const code = rawCode.toLowerCase();
    if (!/^[a-z]{2}$/.test(code) || !info || typeof info.country !== 'string' || !info.country.trim()) {
      throw new Error(`国家元数据错误：${rawCode}`);
    }
    const entries = countryFiles.get(code) ?? [];
    if (!countryFiles.has(code) && info.hasChannels === true) throw new Error(`缺少有频道的国家文件：${code}`);
    if (!Array.isArray(entries)) throw new Error(`国家文件格式错误：${code}`);
    const valid = [];
    for (const [row, entry] of entries.entries()) {
      const channel = normalizeChannel(entry, code);
      if (!channel) { rejected.push({ country: code, row, reason: '无效字段或无可用 HLS 来源' }); continue; }
      if (ids.has(channel.id)) { rejected.push({ country: code, row, reason: '重复频道 ID' }); continue; }
      ids.add(channel.id);
      valid.push(channel);
      channels.push({ id: channel.id, name: channel.name, countryCode: code });
    }
    valid.sort((a, b) => a.name.localeCompare(b.name));
    files.set(code, valid);
    countries.push({ code, nameZh: zhNames[code] ?? info.country, nameEn: info.country, channelCount: valid.length });
  }
  countries.sort((a, b) => a.nameZh.localeCompare(b.nameZh, 'zh-CN'));
  if (!channels.length) throw new Error('过滤后频道索引为空');
  const rawCount = [...countryFiles.values()].reduce((sum, entries) => sum + (Array.isArray(entries) ? entries.length : 0), 0);
  if (channels.length < rawCount * 0.2) throw new Error('频道数量异常减少');
  return { index: { version: new Date().toISOString(), upstreamCommit, countries, channels }, files, rejected };
}

export async function syncFromDirectory(inputDir, outputDir, upstreamCommit = 'unknown') {
  const metadata = JSON.parse(await readFile(path.join(inputDir, 'tv/raw/countries_metadata.json'), 'utf8'));
  const countryDir = path.join(inputDir, 'tv/raw/countries');
  const namesPath = path.join(import.meta.dirname, 'country-names-zh.json');
  const zhNames = JSON.parse(await readFile(namesPath, 'utf8'));
  const countryFiles = new Map();
  for (const filename of await readdir(countryDir)) {
    if (!/^[a-z]{2}\.json$/i.test(filename)) continue;
    countryFiles.set(filename.slice(0, 2).toLowerCase(), JSON.parse(await readFile(path.join(countryDir, filename), 'utf8')));
  }
  const { index, files, rejected } = buildCatalog(metadata, countryFiles, zhNames, upstreamCommit);
  try {
    const previous = JSON.parse(await readFile(path.join(outputDir, 'index.json'), 'utf8'));
    if (Array.isArray(previous.channels) && index.channels.length < previous.channels.length * 0.5) {
      throw new Error('相对上次发布的频道数量异常减少');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await readFile(path.join(inputDir, 'LICENSE'), 'utf8');
  const stage = `${outputDir}.stage-${process.pid}`;
  const backup = `${outputDir}.backup-${process.pid}`;
  await mkdir(path.join(stage, 'countries'), { recursive: true });
  try {
    await Promise.all([...files].map(([code, data]) => writeFile(path.join(stage, 'countries', `${code}.json`), JSON.stringify(data))));
    await writeFile(path.join(stage, 'index.json'), JSON.stringify(index));
    await writeFile(path.join(stage, 'sync-report.json'), JSON.stringify({ rejected, accepted: index.channels.length }, null, 2));
    let hadOld = false;
    try { await rename(outputDir, backup); hadOld = true; } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    try { await rename(stage, outputDir); }
    catch (error) { if (hadOld) await rename(backup, outputDir); throw error; }
    const licenses = path.join(path.dirname(outputDir), 'licenses');
    await mkdir(licenses, { recursive: true });
    await copyFile(path.join(inputDir, 'LICENSE'), path.join(licenses, 'famelack-data-LICENSE.txt'));
    if (hadOld) await rm(backup, { recursive: true, force: true });
  } catch (error) {
    await rm(stage, { recursive: true, force: true });
    throw error;
  }
  return { accepted: index.channels.length, rejected: rejected.length, countries: index.countries.length };
}
