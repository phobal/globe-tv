/**
 * 同步 iptv.445569.xyz/live.m3u 的直播源到 public/data/.
 *
 * 1. 拉取上游 m3u 并落盘到 public/data/index.m3u, 防止源站点失效;
 * 2. 解析每个 #EXTINF 条目, 按 group-title (经归一化) 分组;
 * 3. 为每个分组写出 public/data/category/<slug>.json, 字段结构参考 cctv.json,
 *    同名频道的多个源会聚合到 sources 数组里.
 *
 * 运行: node scripts/sync-iptv-source.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { generateDiscovery } from './build-discovery.mjs';

const UPSTREAM_URL = 'https://iptv.445569.xyz/live.m3u';
const OUTPUT_DIR = process.argv[2] ?? 'public/data';
const M3U_PATH = path.join(OUTPUT_DIR, 'index.m3u');
const REPORT_PATH = path.join(OUTPUT_DIR, 'category-report.json');
const TIMEOUT_MS = Number(process.env.IPTV_TIMEOUT_MS ?? 20_000);

/**
 * 每个原始 group-title (经归一化去掉 [...] 修饰) 到分组信息的映射.
 *  - slug: 文件名 / channels[].group 的英文短横线形式
 *  - name: 写进 channels[].group 的人类可读英文名
 *  - countryCode: 固定的 ISO 3166-1 alpha-2 国家代码; 留空时回落到国旗 emoji 推断
 *  - languages: 同上, 没有则用 defaultLanguages() 按国家代码推断
 */
const GROUP_OVERRIDES = {
    "🇨🇳央卫视直播": { slug: "china-central-and-satellite-tv", name: "China Central & Satellite TV", countryCode: "cn", languages: ["Chinese"] },
    "💎地方台直播": { slug: "china-local-tv", name: "China Local TV", countryCode: "cn", languages: ["Chinese"] },
    "🍔数字频道直播": { slug: "china-digital-tv", name: "China Digital TV", countryCode: "cn", languages: ["Chinese"] },
    "👶🏻少儿直播": { slug: "kids-tv", name: "Kids TV", countryCode: "cn", languages: ["Chinese"] },
    "👴🏻老年直播": { slug: "seniors-tv", name: "Seniors TV", countryCode: "cn", languages: ["Chinese"] },
    "🔮港澳台直播": { slug: "hong-kong-macau-taiwan-tv", name: "Hong Kong / Macau / Taiwan TV", countryCode: "", languages: ["Chinese"] },
    "🇦🇹奥地利直播": { slug: "austria-tv", name: "Austria TV", countryCode: "at", languages: ["German"] },
    "🇧🇩孟加拉国直播": { slug: "bangladesh-tv", name: "Bangladesh TV", countryCode: "bd", languages: ["Bengali"] },
    "🇨🇻佛得角直播": { slug: "cape-verde-tv", name: "Cape Verde TV", countryCode: "cv", languages: ["Portuguese"] },
    "🇩🇪德国直播": { slug: "germany-tv", name: "Germany TV", countryCode: "de", languages: ["German"] },
    "🇪🇸西班牙直播": { slug: "spain-tv", name: "Spain TV", countryCode: "es", languages: ["Spanish"] },
    "🇫🇮芬兰直播": { slug: "finland-tv", name: "Finland TV", countryCode: "fi", languages: ["Finnish","Swedish"] },
    "🇫🇷法国直播": { slug: "france-tv", name: "France TV", countryCode: "fr", languages: ["French"] },
    "🇭🇹海地直播": { slug: "haiti-tv", name: "Haiti TV", countryCode: "ht", languages: ["French","Haitian Creole"] },
    "🇮🇩印尼直播": { slug: "indonesia-tv", name: "Indonesia TV", countryCode: "id", languages: ["Indonesian"] },
    "🇮🇳印度直播": { slug: "india-tv", name: "India TV", countryCode: "in", languages: ["Hindi","English"] },
    "🇯🇲牙买加直播": { slug: "jamaica-tv", name: "Jamaica TV", countryCode: "jm", languages: ["English"] },
    "🇯🇵日本直播": { slug: "japan-tv", name: "Japan TV", countryCode: "jp", languages: ["Japanese"] },
    "🇰🇭柬埔寨直播": { slug: "cambodia-tv", name: "Cambodia TV", countryCode: "kh", languages: ["Khmer"] },
    "🇰🇵朝鲜直播": { slug: "north-korea-tv", name: "North Korea TV", countryCode: "kp", languages: ["Korean"] },
    "🇰🇷韩国直播": { slug: "korea-tv", name: "Korea TV", countryCode: "kr", languages: ["Korean"] },
    "🇱🇦老挝直播": { slug: "laos-tv", name: "Laos TV", countryCode: "la", languages: ["Lao"] },
    "🇱🇰斯里兰卡直播": { slug: "sri-lanka-tv", name: "Sri Lanka TV", countryCode: "lk", languages: ["Sinhala","Tamil"] },
    "🇲🇲缅甸直播": { slug: "myanmar-tv", name: "Myanmar TV", countryCode: "mm", languages: ["Burmese"] },
    "🇲🇳蒙古国直播": { slug: "mongolia-tv", name: "Mongolia TV", countryCode: "mn", languages: ["Mongolian"] },
    "🇲🇽墨西哥": { slug: "mexico-tv", name: "Mexico TV", countryCode: "mx", languages: ["Spanish"] },
    "🇲🇾马来西亚直播": { slug: "malaysia-tv", name: "Malaysia TV", countryCode: "my", languages: ["Malay"] },
    "🇳🇬尼日利亚直播": { slug: "nigeria-tv", name: "Nigeria TV", countryCode: "ng", languages: ["English"] },
    "🇳🇵尼泊尔直播": { slug: "nepal-tv", name: "Nepal TV", countryCode: "np", languages: ["Nepali"] },
    "🇵🇭菲律宾直播": { slug: "philippines-tv", name: "Philippines TV", countryCode: "ph", languages: ["Filipino","English"] },
    "🇶🇦卡塔尔直播": { slug: "qatar-tv", name: "Qatar TV", countryCode: "qa", languages: ["Arabic"] },
    "🇷🇺俄罗斯直播": { slug: "russia-tv", name: "Russia TV", countryCode: "ru", languages: ["Russian"] },
    "🇸🇬新加坡直播": { slug: "singapore-tv", name: "Singapore TV", countryCode: "sg", languages: ["English"] },
    "🇹🇩乍得直播": { slug: "chad-tv", name: "Chad TV", countryCode: "td", languages: ["French","Arabic"] },
    "🇹🇭泰国直播": { slug: "thailand-tv", name: "Thailand TV", countryCode: "th", languages: ["Thai"] },
    "🇹🇷土耳其直播": { slug: "turkey-tv", name: "Turkey TV", countryCode: "tr", languages: ["Turkish"] },
    "🇺🇸美国直播": { slug: "united-states-tv", name: "United States TV", countryCode: "us", languages: ["English"] },
    "🇻🇳越南直播": { slug: "vietnam-tv", name: "Vietnam TV", countryCode: "vn", languages: ["Vietnamese"] },
    "🇾🇪也门直播": { slug: "yemen-tv", name: "Yemen TV", countryCode: "ye", languages: ["Arabic"] },
    "🇿🇦南非直播": { slug: "south-africa-tv", name: "South Africa TV", countryCode: "za", languages: ["English","Afrikaans"] },
    "🇿🇼津巴布韦直播": { slug: "zimbabwe-tv", name: "Zimbabwe TV", countryCode: "zw", languages: ["English"] },
    "☁️CloudFlare直播": { slug: "cloudflare-live", name: "Cloudflare Live", countryCode: "", languages: ["Chinese"] },
    "⚽️体育直播": { slug: "sports-live", name: "Sports Live", countryCode: "", languages: ["Chinese"] },
    "✡️周杰伦歌曲点播": { slug: "jay-chou-on-demand", name: "Jay Chou On-demand", countryCode: "cn", languages: ["Chinese"] },
    "✴️BestTV直播": { slug: "besttv-mobile", name: "BestTV (Mobile)", countryCode: "cn", languages: ["Chinese"] },
    "✴️ITV直播": { slug: "itv-mobile", name: "ITV (Mobile)", countryCode: "cn", languages: ["Chinese"] },
    "✴️NewTV直播": { slug: "newtv-mobile", name: "NewTV (Mobile)", countryCode: "cn", languages: ["Chinese"] },
    "✴️内网直播": { slug: "intranet-mobile", name: "Intranet (Mobile)", countryCode: "cn", languages: ["Chinese"] },
    "✴️咪视界直播": { slug: "mishi-jie-mobile", name: "Mi Shi Jie (Mobile)", countryCode: "cn", languages: ["Chinese"] },
    "🌲乡野直播": { slug: "countryside-live", name: "Countryside Live", countryCode: "cn", languages: ["Chinese"] },
    "🍿短剧直播": { slug: "short-drama-live", name: "Short Drama Live", countryCode: "", languages: ["Chinese"] },
    "🎎动漫直播": { slug: "anime-live", name: "Anime Live", countryCode: "", languages: ["Chinese","Japanese"] },
    "🎚️相声直播": { slug: "xiangsheng-live", name: "Xiangsheng (Crosstalk) Live", countryCode: "cn", languages: ["Chinese"] },
    "🎞️电影直播": { slug: "movies-live", name: "Movies Live", countryCode: "", languages: ["Chinese"] },
    "🎣钓鱼直播": { slug: "fishing-live", name: "Fishing Live", countryCode: "cn", languages: ["Chinese"] },
    "🎧音乐直播": { slug: "music-live", name: "Music Live", countryCode: "", languages: ["Chinese"] },
    "🎨埋堆堆直播": { slug: "maiduidui-live", name: "Maiduidui Live", countryCode: "cn", languages: ["Chinese"] },
    "🎮游戏直播": { slug: "gaming-live", name: "Gaming Live", countryCode: "", languages: ["Chinese"] },
    "👁️‍🗨️监控直播": { slug: "surveillance-live", name: "Surveillance Live", countryCode: "cn", languages: ["Chinese"] },
    "👙模特直播": { slug: "model-live", name: "Model Live", countryCode: "", languages: ["Chinese"] },
    "💃🏻热舞直播": { slug: "hot-dance-live", name: "Hot Dance Live", countryCode: "", languages: ["Chinese"] },
    "💄女团直播": { slug: "girl-group-live", name: "Girl Group Live", countryCode: "", languages: ["Chinese"] },
    "💋车模直播": { slug: "car-model-live", name: "Car Model Live", countryCode: "", languages: ["Chinese"] },
    "💖爱奇艺直播": { slug: "iqiyi-live", name: "iQIYI Live", countryCode: "cn", languages: ["Chinese"] },
    "💽纪录片直播": { slug: "documentary-live", name: "Documentary Live", countryCode: "", languages: ["Chinese"] },
    "📖评书直播": { slug: "pingshu-live", name: "Pingshu (Storytelling) Live", countryCode: "cn", languages: ["Chinese"] },
    "📚听书直播": { slug: "audiobook-live", name: "Audiobook Live", countryCode: "cn", languages: ["Chinese"] },
    "📺电视剧直播": { slug: "tv-series-live", name: "TV Series Live", countryCode: "", languages: ["Chinese"] },
    "📻广播直播": { slug: "radio-live", name: "Radio Live", countryCode: "cn", languages: ["Chinese"] },
    "📽️综艺直播": { slug: "variety-show-live", name: "Variety Show Live", countryCode: "", languages: ["Chinese"] },
    "🔊解说直播": { slug: "commentary-live", name: "Commentary Live", countryCode: "", languages: ["Chinese"] },
    "🔯API随机点播": { slug: "api-random-on-demand", name: "API Random On-demand", countryCode: "cn", languages: ["Chinese"] },
    "🔯歌手合集点播": { slug: "singer-collection-on-demand", name: "Singer Collection On-demand", countryCode: "cn", languages: ["Chinese"] },
    "🗣️脱口秀直播": { slug: "standup-talk-show-live", name: "Standup Talk Show Live", countryCode: "", languages: ["Chinese"] },
    "🚗集锦直播": { slug: "highlights-live", name: "Highlights Live", countryCode: "", languages: ["Chinese"] },
    "🤖Ai直播": { slug: "ai-live", name: "AI Live", countryCode: "", languages: ["Chinese"] },
    "🤣沙雕动画直播": { slug: "funny-animation-live", name: "Funny Animation Live", countryCode: "", languages: ["Chinese"] },
    "🧁漫画直播": { slug: "manga-live", name: "Manga Live", countryCode: "", languages: ["Chinese","Japanese"] },
    "🧘🏻‍♀️瑜伽裤直播": { slug: "yoga-pants-live", name: "Yoga Pants Live", countryCode: "", languages: ["Chinese"] },
    "🧨小品直播": { slug: "xiaopin-live", name: "Xiaopin (Sketch Comedy) Live", countryCode: "cn", languages: ["Chinese"] },
    "虎牙直播": { slug: "huya-live", name: "Huya Live", countryCode: "cn", languages: ["Chinese"] },
    "斗鱼直播": { slug: "douyu-live", name: "Douyu Live", countryCode: "cn", languages: ["Chinese"] },
    "抖音直播": { slug: "douyin-live", name: "Douyin Live", countryCode: "cn", languages: ["Chinese"] },
    "快手直播": { slug: "kuaishou-live", name: "Kuaishou Live", countryCode: "cn", languages: ["Chinese"] },
    "来疯直播": { slug: "laifeng-live", name: "Laifeng Live", countryCode: "cn", languages: ["Chinese"] },
    "酷狗直播": { slug: "kugou-live", name: "Kugou Live", countryCode: "cn", languages: ["Chinese"] },
    "TikTok直播": { slug: "tiktok-live", name: "TikTok Live", countryCode: "", languages: ["Chinese","English"] },
    "Twitch直播": { slug: "twitch-live", name: "Twitch Live", countryCode: "", languages: ["English"] },
    "赛事回放": { slug: "event-replay", name: "Event Replay", countryCode: "cn", languages: ["Chinese"] },
};

/**
 * 把 2 个 Regional Indicator 字符组成的旗帜 emoji 转成 ISO 3166-1 alpha-2 国家代码.
 * 见 https://en.wikipedia.org/wiki/Regional_indicator_symbols
 */
function flagToCountryCode(firstCodePoint, secondCodePoint) {
  const FIRST_START = 0x1f1e6;
  const a = 0x41;
  if (firstCodePoint < FIRST_START || firstCodePoint > FIRST_START + 25) return '';
  if (secondCodePoint < FIRST_START || secondCodePoint > FIRST_START + 25) return '';
  return String.fromCharCode(a + (firstCodePoint - FIRST_START), a + (secondCodePoint - FIRST_START)).toLowerCase();
}

/**
 * 从 group-title 归一化掉尾部 [...] 修饰, 用于合并多备份分支, 例如:
 *   "🇨🇳央卫视直播[1]" -> "🇨🇳央卫视直播"
 *   "🇯🇵日本直播[需日本ip]" -> "🇯🇵日本直播"
 *   "✴️NewTV直播[移动]" -> "✴️NewTV直播"
 */
function stripBracketSuffix(value) {
  return value.replace(/\[[^\]]*\]\s*$/u, '').trim();
}

/**
 * 解析单个 #EXTINF 行 (含属性段和逗号后的频道名).
 */
function parseExtinf(line) {
  const attrsMatch = line.match(/^#EXTINF:[^\s]*\s+(.*)$/);
  if (!attrsMatch) return null;
  const attrsSegment = attrsMatch[1];
  const commaIndex = attrsSegment.lastIndexOf(',');
  if (commaIndex < 0) return null;
  const attrs = attrsSegment.slice(0, commaIndex);
  const name = attrsSegment.slice(commaIndex + 1).trim();
  if (!name) return null;
  const tvgLogo = (attrs.match(/\btvg-logo="([^"]*)"/i)?.[1] ?? '').trim();
  const groupTitle = (attrs.match(/\bgroup-title="([^"]*)"/i)?.[1] ?? '').trim();
  return { name, tvgLogo, groupTitle };
}

/**
 * 解析一份 m3u 文本, 返回 [{ groupTitle, name, logo, url }, ...].
 */
export function parseM3uEntries(text) {
  const lines = String(text).split(/\r?\n/);
  const entries = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith('#EXTINF:')) continue;
    const info = parseExtinf(line);
    if (!info) continue;
    let url = '';
    for (let j = i + 1; j < lines.length; j += 1) {
      const candidate = lines[j].trim();
      if (!candidate) continue;
      if (candidate.startsWith('#EXTINF:')) break;
      if (!candidate.startsWith('#')) url = candidate;
      break;
    }
    if (!/^https?:\/\//i.test(url) || !/\.m3u8(?:[?#]|$)/i.test(url)) continue;
    if (!info.groupTitle) continue;
    entries.push({ groupTitle: info.groupTitle, name: info.name, logo: info.tvgLogo, url: url.trim() });
  }
  return entries;
}

/**
 * 从 group-title 里找出一对相邻的 Regional Indicator, 推断 ISO 3166-1 alpha-2 国家代码.
 * 返回 '' 表示无法识别.
 */
function inferCountryCodeFromGroup(groupTitle) {
  if (!groupTitle) return '';
  const codePoints = Array.from(groupTitle);
  for (let i = 0; i < codePoints.length - 1; i += 1) {
    const cp = codePoints[i].codePointAt(0);
    const next = codePoints[i + 1].codePointAt(0);
    if (cp != null && next != null && cp >= 0x1f1e6 && cp <= 0x1f1ff && next >= 0x1f1e6 && next <= 0x1f1ff) {
      return flagToCountryCode(cp, next);
    }
  }
  return '';
}

/**
 * 给定原始 group-title, 返回 { slug, name, countryCode, languages, geoBlocked }.
 */
export function resolveGroup(groupTitle) {
  const key = stripBracketSuffix(groupTitle);
  const override = GROUP_OVERRIDES[key];
  const fallbackCountry = inferCountryCodeFromGroup(key);
  if (override) {
    return {
      slug: override.slug,
      name: override.name,
      countryCode: override.countryCode || fallbackCountry,
      languages: override.languages || [],
      geoBlocked: false,
    };
  }
  return {
    slug: fallbackSlug(key),
    name: key || 'Uncategorized',
    countryCode: fallbackCountry,
    languages: [],
    geoBlocked: false,
  };
}

function fallbackSlug(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'uncategorized';
}

/**
 * 把 entries 按分组聚合, 返回 [{ slug, channels[], info }, ...]
 * 同一 groupTitle + channel name 的多个 url 会合并到一个 sources 数组, 按出现顺序赋 order。
 */
export function buildCategoryCatalog(entries, existingGroups = new Map()) {
  const grouped = new Map();
  for (const entry of entries) {
    const info = resolveGroup(entry.groupTitle);
    const slug = info.slug;
    if (!grouped.has(slug)) {
      grouped.set(slug, { info, items: new Map() });
    }
    const bucket = grouped.get(slug);
    if (!bucket.items.has(entry.name)) {
      bucket.items.set(entry.name, { entry, urls: [] });
    }
    const item = bucket.items.get(entry.name);
    if (!item.urls.includes(entry.url)) item.urls.push(entry.url);
  }
  const categories = [];
  for (const [slug, bucket] of grouped) {
    const channels = [];
    for (const { entry, urls } of bucket.items.values()) {
      channels.push({
        id: existingGroups.get(slug)?.find(channel => channel.name === entry.name)?.id ?? `iptv-${createHash('sha256').update(`${slug}\0${entry.name}`).digest('hex').slice(0, 24)}`,
        name: entry.name,
        countryCode: bucket.info.countryCode,
        languages: bucket.info.languages.length ? bucket.info.languages : defaultLanguages(bucket.info),
        group: bucket.info.name,
        logo: entry.logo || undefined,
        geoBlocked: bucket.info.geoBlocked,
        sources: urls.map((url, order) => ({ kind: 'hls', url, order })),
      });
    }
    channels.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
    categories.push({ slug, info: bucket.info, channels });
  }
  categories.sort((a, b) => a.slug.localeCompare(b.slug));
  return categories;
}

const COUNTRY_LANGUAGES = {
  cn: ['Chinese'], hk: ['Chinese'], mo: ['Chinese', 'Portuguese'], tw: ['Chinese'],
  jp: ['Japanese'], kr: ['Korean'], kp: ['Korean'],
  us: ['English'], gb: ['English'], au: ['English'], ca: ['English', 'French'], nz: ['English'],
  in: ['Hindi', 'English'], pk: ['Urdu', 'English'], bd: ['Bengali'], lk: ['Sinhala', 'Tamil'], np: ['Nepali'],
  de: ['German'], fr: ['French'], es: ['Spanish'], it: ['Italian'], pt: ['Portuguese'], nl: ['Dutch'],
  ru: ['Russian'], tr: ['Turkish'], sa: ['Arabic'], ae: ['Arabic'], qa: ['Arabic'], ye: ['Arabic'],
  th: ['Thai'], vn: ['Vietnamese'], id: ['Indonesian'], my: ['Malay'], ph: ['Filipino', 'English'],
  mm: ['Burmese'], kh: ['Khmer'], la: ['Lao'], mn: ['Mongolian'],
  ng: ['English'], za: ['English', 'Afrikaans'], ke: ['English', 'Swahili'], eg: ['Arabic'],
  br: ['Portuguese'], ar: ['Spanish'], mx: ['Spanish'], cl: ['Spanish'], co: ['Spanish'],
  ht: ['French', 'Haitian Creole'], jm: ['English'], cv: ['Portuguese'],
  at: ['German'], fi: ['Finnish', 'Swedish'],
};

function defaultLanguages(info) {
  return (info.countryCode && COUNTRY_LANGUAGES[info.countryCode]) || ['Chinese'];
}

/**
 * 从网络拉取 m3u; 失败时回落到本地缓存. 返回 { text, source: 'remote' | 'cache' }.
 */
export async function fetchOrLoadM3u({ url, cachePath, timeoutMs = TIMEOUT_MS } = {}) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { 'user-agent': 'GlobeTV iptv-source-sync/1.0' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (!text.includes('#EXTM3U')) throw new Error('响应不是有效 m3u 文件');
      return { text, source: 'remote' };
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    let cached;
    try {
      cached = await readFile(cachePath, 'utf8');
    } catch (cacheError) {
      throw new Error(`拉取 ${url} 失败 (${error instanceof Error ? error.message : error}); 且本地缓存 ${cachePath} 不可用 (${cacheError instanceof Error ? cacheError.message : cacheError})`);
    }
    return { text: cached, source: 'cache' };
  }
}

/**
 * 把分类数据落盘到 OUTPUT_DIR/category 下; 同时写出 category-report.json.
 * 清理掉这次未再生成的旧文件 (例如上游 group-title 改名或被合并),
 * 但保留 cctv.json 等非本脚本产出的手工文件.
 */
export async function writeCategories(categories, outputDir, reportPath) {
  const categoryDir = path.join(outputDir, 'category');
  await mkdir(categoryDir, { recursive: true });
  const expected = new Set(categories.map((c) => `${c.slug}.json`));
  try {
    const { readdir, unlink } = await import('node:fs/promises');
    const existing = await readdir(categoryDir);
    const orphans = existing.filter((name) => name.endsWith('.json') && !expected.has(name) && name !== 'cctv.json');
    await Promise.all(orphans.map((name) => unlink(path.join(categoryDir, name)).catch(() => {})));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await Promise.all(categories.map(async ({ slug, channels }) => {
    await writeFile(path.join(categoryDir, `${slug}.json`), `${JSON.stringify(channels, null, 2)}\n`);
  }));
  const report = await generateDiscovery(outputDir, reportPath);
  return report;
}

/**
 * 同步入口: 拉取/加载 m3u -> 解析 -> 按分类生成 -> 落盘 category-report.json.
 */
export async function syncIptvSource({ outputDir = OUTPUT_DIR, url = UPSTREAM_URL, cachePath = M3U_PATH, reportPath = REPORT_PATH } = {}) {
  const { text, source } = await fetchOrLoadM3u({ url, cachePath });
  await mkdir(outputDir, { recursive: true });
  await writeFile(cachePath, text);
  const entries = parseM3uEntries(text);
  const existingGroups = new Map();
  try {
    for (const file of await readdir(path.join(outputDir, 'category'))) {
      if (!file.endsWith('.json')) continue;
      existingGroups.set(file.slice(0, -5), JSON.parse(await readFile(path.join(outputDir, 'category', file), 'utf8')));
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const categories = buildCategoryCatalog(entries, existingGroups);
  const report = await writeCategories(categories, outputDir, reportPath);
  return { source, entryCount: entries.length, ...report, categories };
}

// CLI 入口
const isCli = import.meta.url === `file://${process.argv[1]}`;
if (isCli) {
  try {
    const result = await syncIptvSource();
    console.log(`同步完成 (来源=${result.source}): 解析 ${result.entryCount} 条 -> ${result.categoryCount} 个分类, 共 ${result.channelCount} 个频道, ${result.sourceCount} 个直播源`);
    console.log(`分类报告: ${path.relative(process.cwd(), REPORT_PATH)}`);
    console.log(`m3u 缓存:  ${path.relative(process.cwd(), M3U_PATH)}`);
  } catch (error) {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  }
}
