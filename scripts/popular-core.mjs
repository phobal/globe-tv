function cleanName(value) {
  return value
    .replace(/\s*\([^)]*p\)\s*/gi, ' ')
    .replace(/\s*\[(?:Geo-blocked|Not 24\/7)\]\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseM3u(text) {
  const lines = String(text).split(/\r?\n/);
  const entries = [];
  for (let index = 0; index < lines.length; index += 1) {
    const info = lines[index].trim();
    if (!info.startsWith('#EXTINF:')) continue;
    const idMatch = info.match(/\btvg-id="([^"]+)"/i);
    if (!idMatch) continue;
    let url = '';
    for (let next = index + 1; next < lines.length; next += 1) {
      const candidate = lines[next].trim();
      if (!candidate) continue;
      if (candidate.startsWith('#EXTINF:')) break;
      if (!candidate.startsWith('#')) url = candidate;
      break;
    }
    // 同时接受 http 与 https 源；http 源在 HTTPS 页面下会被浏览器按混合内容策略拦截，仅适用于 HTTP 部署或本地开发，与 sync-core.mjs 保持一致
    if (!/^https?:\/\//i.test(url) || !/\.m3u8(?:[?#]|$)/i.test(url)) continue;
    const tvgId = idMatch[1].trim();
    const channelId = tvgId.split('@')[0];
    const countryMatch = channelId.match(/\.([a-z]{2})$/i);
    if (!countryMatch) continue;
    const rawName = info.slice(info.indexOf(',') + 1).trim();
    const qualityMatch = rawName.match(/\((\d{3,4})p\)/i);
    entries.push({
      tvgId,
      channelId,
      name: cleanName(rawName),
      countryCode: countryMatch[1].toLowerCase(),
      url,
      geoBlocked: /\[Geo-blocked\]/i.test(rawName),
      quality: qualityMatch ? Number(qualityMatch[1]) : 0,
    });
  }
  return entries;
}

function safeId(id) {
  return `popular-${id.replace(/\./g, '-')}`;
}

export function buildPopularCatalog(entries, selections, probes, options) {
  const channels = [];
  const report = [];
  for (const [selectionIndex, selection] of selections.entries()) {
    // 先取满足 channel/variants/non-geo 的所有候选
    const allCandidates = entries
      .filter(entry => entry.channelId === selection.id && !entry.geoBlocked)
      .filter(entry => !selection.variants || selection.variants.includes(entry.tvgId));
    // 探测通过的源：https 源要求较高（公网可达），http 源放宽（中国境内 IPTV 源对境外探测常不可达）
    const verified = allCandidates.filter(entry => {
      const probe = probes.get(entry.url);
      if (!probe) return false;
      const isHttps = entry.url.startsWith('https://');
      return isHttps
        ? probe.successes >= Math.min(2, probe.attempts) && probe.successes / probe.attempts >= 2 / 3
        : probe.successes / probe.attempts >= 1 / 2;
    });
    // 兜底：若所有候选都探测失败（probe 存在但 successes/attempts 不达标），保留 http 源避免热门频道被完全丢弃；未探测的源不参与兜底
    const probedHttp = allCandidates.filter(entry => probes.has(entry.url) && entry.url.startsWith('http://'));
    const candidates = verified.length ? verified : (probedHttp.length ? probedHttp : []);
    candidates.sort((left, right) => {
      const a = probes.get(left.url);
      const b = probes.get(right.url);
      const preferred = url => selection.preferredHosts?.some(host => new URL(url).hostname === host || new URL(url).hostname.endsWith(`.${host}`)) ? 1 : 0;
      // a 是 left 的探测结果，b 是 right 的探测结果；sort 返回值 > 0 表示 b（right）应排在 a（left）前面
      const cmp = (a && b ? (b.successes / b.attempts) - (a.successes / a.attempts) : 0)
        || (b?.successes ?? 0) - (a?.successes ?? 0)
        || preferred(right.url) - preferred(left.url)
        || right.quality - left.quality
        || (a?.latencyMs ?? Number.POSITIVE_INFINITY) - (b?.latencyMs ?? Number.POSITIVE_INFINITY);
      return cmp;
    });
    const unique = [...new Map(candidates.map(entry => [entry.url, entry])).values()].slice(0, 3);
    report.push({ id: selection.id, candidates: candidates.length, accepted: unique.length });
    if (!unique.length) continue;
    channels.push({
      id: safeId(selection.id),
      tvgId: selection.id,
      name: selection.name,
      countryCode: unique[0].countryCode,
      languages: selection.languages ?? [],
      geoBlocked: false,
      category: selection.category,
      rank: selectionIndex + 1,
      sources: unique.map((entry, order) => ({ kind: 'hls', url: entry.url, order })),
    });
  }
  if (options.requireFull !== false && channels.length !== options.expectedCount) {
    const missing = selections.filter(selection => !channels.some(channel => channel.tvgId === selection.id)).map(item => item.id);
    throw new Error(`热门频道数量不足：需要 ${options.expectedCount}，实际 ${channels.length}；缺少 ${missing.join(', ')}`);
  }
  return {
    catalog: { version: options.checkedAt, upstreamCommit: options.upstreamCommit, channels },
    channels,
    report: { checkedAt: options.checkedAt, upstreamCommit: options.upstreamCommit, channels: report },
  };
}
