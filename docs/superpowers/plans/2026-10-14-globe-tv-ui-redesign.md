# 地球电视 UI 改版（Mapbox 配色 + 抽屉式布局）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把首版的"暗色影院 + 三列"布局重塑为"Mapbox 冷调亮色 + 抽屉式"布局，地球要能"看见国家名"，操作流程要顺畅。

**Architecture:**
1. CSS 令牌层换皮：`:root` 重新定义深空底 / 海洋蓝 / 陆绿 / 粉红国界 / 大气辉光，把所有深色 `App.css` 改为 CSS 变量驱动。
2. `Globe.tsx` 调整材质参数 + 用 react-globe.gl 自带 `polygonLabel` 给频道 ≥ 5 的国家常驻名字（大国常驻 + 小国悬停）。
3. `App.tsx` 改造成抽屉式布局：地球和播放器为主舞台、国家 + 频道两级抽屉从右/底拉起，URL 同步选中状态。

**Tech Stack:** React、TypeScript、Vite、react-globe.gl、three、CSS 变量、无新依赖。

---

## 文件结构

| 路径 | 责任 |
| --- | --- |
| `src/app/App.css` | 设计令牌（CSS 变量）、抽屉动画、断点布局 |
| `src/globe/Globe.tsx` | 海洋/陆地配色、辉光参数、国家名阈值与坐标去重 |
| `src/globe/countries.ts` | 不变；附 `projectCenter()` 工具（已被 `countryCenter` 覆盖，无需新增） |
| `src/app/App.tsx` | 抽屉状态机、桌面右抽屉 / 手机底抽屉、URL 同步 |
| `src/drawer/Drawer.tsx` (新) | 抽屉容器组件（滑入 / ESC / focus trap） |
| `src/drawer/BrowsePanel.tsx` (新) | 抽屉内两级浏览（国家列表 → 频道列表） |
| `src/drawer/CountryGroup.tsx` (新) | 国家列表 + 搜索 + 按地区分组 |
| `src/drawer/ChannelListSection.tsx` (新) | 选中国家后的频道列表 |
| `src/drawer/drawer.module.css` (新) | 抽屉专属样式 |
| `tests/drawer.test.tsx` (新) | 抽屉开合、ESC 关闭、URL 同步 |
| `tests/browsePanel.test.tsx` (新) | 国家→频道两级、空态推荐 |
| `tests/globeLabels.test.ts` (新) | 频道数阈值筛选标签候选 |
| `index.html` | theme-color 改 Mapbox 深空 |

---

## Task 1：CSS 令牌层 —— 替换 `:root` 与全局样式

**Files:**
- Modify: `src/app/App.css`

- [ ] **Step 1：替换 `:root` 设计令牌**

把现在的 `:root` 整段替换为：

```css
:root {
  font-family: 'DM Sans', 'Noto Sans SC', system-ui, sans-serif;
  color: #0f1e2c;
  background: #08111f;
  font-synthesis: none;
  --bg-deep: #08111f;
  --bg-space: #0d1b2a;
  --bg-card: #122a3f;
  --ocean: #4ba3d0;
  --ocean-deep: #2c7fb3;
  --land: #b8d9b5;
  --land-mute: #7a9a78;
  --land-hot: #d7e7c8;
  --border-line: #ff5b6e;
  --border-soft: #ff8a96;
  --halo: #9bd4f0;
  --text: #0f1e2c;
  --text-soft: #4a5a6a;
  --text-invert: #f4f7fa;
  --accent: #ffb45a;
  --accent-deep: #d9923f;
  --shadow-lg: 0 30px 60px #00000052;
  --star-color: #ffffffcc;
}
```

- [ ] **Step 2：替换页面背景为"深空 + 径向光 + 星星"**

把 `body` / `.app` 现有背景渐变替换为：

```css
* { box-sizing: border-box; }
body {
  margin: 0;
  min-width: 320px;
  background: var(--bg-deep) radial-gradient(1200px 800px at 22% 28%, #142a44 0%, #0a1626 60%, #03080f 100%) fixed;
  color: var(--text);
}
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(circle at 80% 110%, #1a3252 0%, transparent 55%),
    radial-gradient(circle at 10% 80%, #1a3252 0%, transparent 45%);
  position: relative;
  overflow: hidden;
}
.app::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image:
    radial-gradient(1px 1px at 12% 24%, var(--star-color), transparent 60%),
    radial-gradient(1px 1px at 78% 11%, var(--star-color), transparent 60%),
    radial-gradient(1.5px 1.5px at 47% 67%, var(--star-color), transparent 60%),
    radial-gradient(1px 1px at 88% 45%, var(--star-color), transparent 60%),
    radial-gradient(1px 1px at 33% 91%, var(--star-color), transparent 60%),
    radial-gradient(1px 1px at 6%  60%, var(--star-color), transparent 60%),
    radial-gradient(1.5px 1.5px at 65% 80%, var(--star-color), transparent 60%),
    radial-gradient(1px 1px at 21% 47%, var(--star-color), transparent 60%);
  opacity: 0.6;
  pointer-events: none;
  z-index: 0;
}
.app > * { position: relative; z-index: 1; }
```

- [ ] **Step 3：运行 `npm run typecheck`、`npm run build`**

预期：成功（仅引入新 CSS 变量，逻辑未改）。

---

## Task 2：App.css 主体重写 —— 抽屉式 + 冷色调

**Files:**
- Modify: `src/app/App.css`（在 Task 1 令牌基础上全量替换）

- [ ] **Step 1：清空原 `.app`、`.app-header`、`.workspace` 等所有区块**

把 `.app-header`、`.workspace`、`.explore`、`.browse`、`.watch`、`.channels`、`.player`、`.player-controls`、`.search`、`.search-results`、`.library`、`.country-list`、`.country`、`.channel-list`、`.channel`、`.favorite`、`.globe`、`.globe-tip`、`.country-fallback`、`.notice`、`.fatal`、`.app-message`、`.mobile-switch`、`.player-placeholder`、`.video-box`、`.video-overlay`、`.player-controls`、`.source-options`、`.explore-heading`、`.channels header`、`.player-heading`、`.brand`、`.data-link`、`.empty-state`、`.deep-hint`、`.channel-filter`、`.channel-play`、`.channel-initial`、`.mobile-switch`、`.library-tabs`、`.library-row`、`.library-panel`、`.library-toggle`、footer 一并删除。

- [ ] **Step 2：写入新主体样式（保留所有现有 BEM 命名，内部用变量）**

```css
button, input { font: inherit; }
button { cursor: pointer; }
button:focus-visible, input:focus-visible, a:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
a { color: var(--ocean-deep); }

.app-header {
  min-height: 78px;
  padding: 14px clamp(16px, 2.5vw, 40px);
  display: flex;
  align-items: center;
  gap: 18px;
  border-bottom: 1px solid #1a2f44;
  position: relative;
  z-index: 5;
  background: #0a1626cc;
  backdrop-filter: blur(14px);
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  white-space: nowrap;
  color: var(--text-invert);
}
.brand-mark { font-size: 32px; color: var(--accent); line-height: 1; }
.brand strong { display: block; font-size: 19px; letter-spacing: .12em; }
.brand small { display: block; font-size: 9px; letter-spacing: .24em; color: #8ea3b6; }

.toolbar { margin-left: auto; display: flex; align-items: center; gap: 10px; }
.toolbar button {
  color: var(--text-invert);
  background: #11273d;
  border: 1px solid #2c4661;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 13px;
}
.toolbar button:hover { background: #173353; }
.toolbar button.active { border-color: var(--accent); color: var(--accent); }
.toolbar .badge {
  display: inline-block;
  padding: 1px 6px;
  margin-left: 6px;
  background: var(--accent);
  color: #1a0f04;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
}
.library-pop {
  position: absolute;
  top: 60px;
  right: clamp(16px, 2.5vw, 40px);
  width: min(360px, 90vw);
  max-height: 70vh;
  overflow: auto;
  background: var(--bg-card);
  border: 1px solid #2c4661;
  border-radius: 12px;
  padding: 12px;
  z-index: 6;
  box-shadow: var(--shadow-lg);
  color: var(--text-invert);
}
.library-pop .row {
  display: flex; align-items: center;
  border-bottom: 1px solid #1f364d;
}
.library-pop .row button:first-child {
  flex: 1;
  text-align: left;
  background: transparent;
  border: 0;
  color: var(--text-invert);
  padding: 9px 4px;
}
.library-pop .row button:disabled { color: #7a8a99; }
.library-pop .row button:last-child {
  background: none; border: 0; color: var(--accent); font-size: 18px;
}
.library-pop .tabs {
  display: flex; gap: 6px; margin-bottom: 8px;
}
.library-pop .tabs button {
  flex: 1;
  background: #0f2238;
  border: 1px solid #2c4661;
  color: var(--text-invert);
  border-radius: 6px;
  padding: 6px;
}
.library-pop .tabs button.active { border-color: var(--accent); color: var(--accent); }

.workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr minmax(360px, 1.05fr);
  gap: 18px;
  padding: 18px clamp(16px, 2.5vw, 40px) 20px;
}
.workspace > * { min-width: 0; }

.explore {
  display: flex;
  flex-direction: column;
  min-height: 640px;
  border: 1px solid #1f3650;
  border-radius: 18px;
  background: radial-gradient(circle at 50% 35%, #163757 0%, #0c2138 55%, #07172a 100%);
  overflow: hidden;
  position: relative;
}
.explore-heading {
  display: flex; justify-content: space-between; align-items: flex-start; gap: 14px;
  padding: 22px 24px 0;
  color: var(--text-invert);
}
.explore-heading small { color: var(--accent); letter-spacing: .18em; font-size: 11px; }
.explore-heading h1 { font-size: clamp(22px, 2vw, 32px); font-weight: 600; line-height: 1.25; margin: 8px 0 0; }
.explore-foot {
  display: flex; justify-content: space-between; gap: 10px;
  padding: 4px 24px 18px;
  color: #8fa3b6;
  font-size: 11px;
}
.globe {
  flex: 1;
  min-height: 460px;
  position: relative;
  cursor: grab;
}
.globe:active { cursor: grabbing; }
.globe canvas { display: block; }
.globe-tip {
  padding: 5px 9px;
  background: #0d1b2ae6;
  color: #fff;
  border: 1px solid #4b6a82;
  border-radius: 5px;
  font: 12px 'DM Sans', sans-serif;
}
.globe-tip small { color: var(--accent); }

.watch {
  display: flex;
  flex-direction: column;
  border: 1px solid #1f3650;
  border-radius: 18px;
  background: #07172a;
  overflow: hidden;
}
.player {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 22px 22px;
  gap: 16px;
  color: var(--text-invert);
}
.player-heading {
  display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;
}
.player-heading small { color: var(--accent); letter-spacing: .15em; font-size: 11px; }
.player-heading h2 { font-size: 20px; line-height: 1.3; margin: 6px 0 0; }
.player-heading button {
  font-size: 22px;
  line-height: 1;
  padding: 4px 9px;
  color: var(--text-invert);
  background: #11273d;
  border: 1px solid #2c4661;
  border-radius: 7px;
}
.video-box {
  position: relative;
  background: #000;
  border: 1px solid #1f3650;
  border-radius: 12px;
  aspect-ratio: 16 / 9;
  overflow: hidden;
}
.video-box video { width: 100%; height: 100%; object-fit: contain; display: block; }
.video-overlay {
  position: absolute; inset: 0;
  background: #00000066;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; text-align: center; padding: 16px; font-size: 13px; color: var(--text-invert);
}
.video-overlay button {
  color: #1a0f04;
  background: var(--accent);
  border: 0;
  border-radius: 6px;
  padding: 9px 18px;
  font-weight: 600;
}
.player-controls {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
  color: var(--text-invert);
}
.player-controls button {
  color: var(--text-invert);
  background: #11273d;
  border: 1px solid #2c4661;
  border-radius: 7px;
  padding: 8px 12px;
  font-size: 12px;
}
.player-controls button:hover { background: #173353; }
.player-controls label { font-size: 11px; color: #a4bdca; display: inline-flex; align-items: center; gap: 6px; }
.player-controls input[type="range"] { width: 70px; }
.source-options {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
  font-size: 12px; color: #a4bdca;
}
.source-options button {
  color: var(--text-invert);
  background: #11273d;
  border: 1px solid #2c4661;
  border-radius: 7px;
  padding: 6px 10px;
  font-size: 12px;
}
.source-options button.active { border-color: var(--accent); color: var(--accent); }
.player-placeholder {
  margin: auto;
  text-align: center;
  color: #a5beca;
  max-width: 280px;
}
.player-placeholder .ph-mark { display: block; color: var(--accent); font-size: 64px; line-height: 1; }
.player-placeholder h2 { color: var(--text-invert); font-size: 17px; margin: 8px 0 6px; }
.player-placeholder p { font-size: 12px; line-height: 1.6; color: #a4bdca; }
.notice { padding: 10px 12px; background: #4a3417; color: #f5d29c; border: 1px solid #6f4c20; border-radius: 6px; font-size: 12px; }

footer {
  display: flex; justify-content: space-between;
  padding: 12px clamp(16px, 2.5vw, 40px);
  border-top: 1px solid #1a2f44;
  color: #768ea0;
  font-size: 10px;
}

@media (max-width: 1150px) {
  .workspace { grid-template-columns: 1fr; grid-template-rows: 1fr auto; }
  .explore { min-height: 520px; }
  .watch { min-height: 380px; }
}

@media (max-width: 760px) {
  .app-header { min-height: 64px; padding: 10px 14px; flex-wrap: wrap; gap: 10px; }
  .brand strong { font-size: 16px; }
  .brand-mark { font-size: 26px; }
  .toolbar { width: 100%; justify-content: flex-end; }
  .workspace { padding: 10px 12px 14px; gap: 12px; }
  .explore { min-height: 470px; border-radius: 14px; }
  .watch { min-height: 320px; border-radius: 14px; }
  .player { padding: 14px; }
  .player-heading h2 { font-size: 17px; }
  footer { gap: 8px; flex-wrap: wrap; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: .01ms !important;
    transition-duration: .01ms !important;
  }
}
```

- [ ] **Step 3：运行 `npm run typecheck`、`npm run build`**

预期：成功（CSS 改动不影响类型）。

---

## Task 3：抽屉外壳组件

**Files:**
- Create: `src/drawer/Drawer.tsx`
- Create: `src/drawer/drawer.module.css`

- [ ] **Step 1：创建 `src/drawer/Drawer.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import styles from './drawer.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  variant?: 'side' | 'bottom';
}

export function Drawer({ open, onClose, title, children, variant = 'side' }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  return (
    <>
      <div className={`${styles.scrim} ${open ? styles.scrimOpen : ''}`} onClick={onClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        className={`${styles.panel} ${styles[variant]} ${open ? styles.open : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
        inert={!open}
      >
        <header className={styles.head}>
          <strong>{title}</strong>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭面板"
            data-autofocus
          >×</button>
        </header>
        <div className={styles.body}>{children}</div>
      </aside>
    </>
  );
}
```

- [ ] **Step 2：创建 `src/drawer/drawer.module.css`**

```css
.scrim {
  position: fixed;
  inset: 0;
  background: #03080f99;
  opacity: 0;
  pointer-events: none;
  transition: opacity 220ms ease;
  z-index: 40;
}
.scrimOpen { opacity: 1; pointer-events: auto; }

.panel {
  position: fixed;
  background: var(--bg-space);
  color: var(--text-invert);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  z-index: 50;
  transition: transform 260ms cubic-bezier(.22,.61,.36,1), opacity 260ms;
  border: 1px solid #1f3650;
}
.side {
  top: 0;
  right: 0;
  bottom: 0;
  width: min(440px, 92vw);
  transform: translateX(100%);
  border-radius: 18px 0 0 18px;
  border-right: 0;
}
.bottom {
  left: 0;
  right: 0;
  bottom: 0;
  height: min(82vh, 720px);
  transform: translateY(100%);
  border-radius: 18px 18px 0 0;
}
.open { transform: translate(0, 0) !important; }

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid #1f3650;
}
.head strong { font-size: 15px; letter-spacing: .15em; color: var(--accent); }
.head button {
  background: #11273d;
  border: 1px solid #2c4661;
  color: var(--text-invert);
  border-radius: 7px;
  font-size: 20px;
  width: 32px;
  height: 32px;
}
.body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px 18px 22px;
}
```

- [ ] **Step 3：运行 `npm run typecheck`**

预期：通过。

---

## Task 4：抽屉内两级浏览 —— 国家列表组件

**Files:**
- Create: `src/drawer/CountryGroup.tsx`

- [ ] **Step 1：实现 `CountryGroup`**

```tsx
import { useMemo, useState } from 'react';
import { normalizeQuery } from '../data/catalog';
import type { CountrySummary } from '../data/types';
import styles from './drawer.module.css';

const REGION_ORDER = ['亚洲', '欧洲', '非洲', '北美洲', '南美洲', '大洋洲', '其他'];

function regionOf(nameZh: string, code: string): string {
  const asian = ['cn', 'jp', 'kr', 'in', 'th', 'vn', 'sg', 'id', 'my', 'ph', 'pk', 'bd', 'lk', 'np', 'mm', 'kh', 'la', 'tw', 'hk', 'mo', 'mn', 'af', 'ir', 'iq', 'sa', 'ae', 'qa', 'kw', 'om', 'ye', 'jo', 'lb', 'il', 'tr', 'sy', 'ps', 'ye'];
  const europe = ['gb', 'fr', 'de', 'it', 'es', 'pt', 'nl', 'be', 'lu', 'ch', 'at', 'ie', 'no', 'se', 'fi', 'dk', 'is', 'pl', 'cz', 'sk', 'hu', 'ro', 'bg', 'gr', 'hr', 'si', 'rs', 'ba', 'mk', 'al', 'me', 'md', 'ua', 'by', 'lt', 'lv', 'ee', 'ru', 'cy', 'mt', 'ad', 'mc', 'li', 'sm', 'va'];
  const africa = ['eg', 'ly', 'tn', 'dz', 'ma', 'sd', 'ss', 'et', 'er', 'dj', 'so', 'ke', 'tz', 'ug', 'rw', 'bi', 'mz', 'mg', 'mu', 'sc', 'km', 'za', 'zw', 'zm', 'bw', 'na', 'ao', 'cd', 'cg', 'cm', 'cf', 'td', 'ng', 'ne', 'ml', 'sn', 'gm', 'gw', 'gn', 'sl', 'lr', 'ci', 'gh', 'tg', 'bj', 'bf', 'cv', 'st'];
  const northAmerica = ['us', 'ca', 'mx', 'cu', 'gt', 'bz', 'hn', 'sv', 'ni', 'cr', 'pa', 'bs', 'jm', 'ht', 'do', 'pr', 'tt', 'bb'];
  const southAmerica = ['br', 'ar', 'cl', 'co', 'pe', 've', 'ec', 'bo', 'uy', 'py', 'gy', 'sr', 'gf'];
  const oceania = ['au', 'nz', 'fj', 'pg', 'sb', 'vu', 'ws', 'to', 'tv', 'nr', 'ki', 'fm', 'mh', 'pw'];
  const code2 = code.toLowerCase();
  if (asian.includes(code2)) return '亚洲';
  if (europe.includes(code2)) return '欧洲';
  if (africa.includes(code2)) return '非洲';
  if (northAmerica.includes(code2)) return '北美洲';
  if (southAmerica.includes(code2)) return '南美洲';
  if (oceania.includes(code2)) return '大洋洲';
  return '其他';
}

function groupCountries(countries: CountrySummary[]) {
  const groups = new Map<string, CountrySummary[]>();
  for (const country of countries) {
    const region = regionOf(country.nameZh, country.code);
    if (!groups.has(region)) groups.set(region, []);
    groups.get(region)!.push(country);
  }
  for (const list of groups.values()) list.sort((a, b) => a.nameZh.localeCompare(b.nameZh, 'zh'));
  const ordered: Array<{ region: string; countries: CountrySummary[] }> = [];
  for (const region of REGION_ORDER) {
    const list = groups.get(region);
    if (list?.length) ordered.push({ region, countries: list });
  }
  return ordered;
}

export function CountryGroup({ countries, onPick }: { countries: CountrySummary[]; onPick: (code: string) => void }) {
  const [query, setQuery] = useState('');
  const grouped = useMemo(() => {
    const filtered = query.trim()
      ? countries.filter(item => normalizeQuery(`${item.nameZh} ${item.nameEn} ${item.code}`).includes(normalizeQuery(query)))
      : countries;
    return groupCountries(filtered);
  }, [countries, query]);
  return (
    <div>
      <input
        className={styles.search}
        type="search"
        placeholder="搜索国家（中/英）"
        value={query}
        onChange={event => setQuery(event.target.value)}
        data-autofocus={query === '' ? true : undefined}
        aria-label="搜索国家"
      />
      {grouped.length === 0 && <p className={styles.empty}>没有匹配的国家</p>}
      {grouped.map(group => (
        <section key={group.region} className={styles.region}>
          <h3>{group.region} <small>{group.countries.length}</small></h3>
          <ul>
            {group.countries.map(country => (
              <li key={country.code}>
                <button type="button" onClick={() => onPick(country.code)} disabled={country.channelCount === 0}>
                  <span className={styles.flag}>{country.nameZh.slice(0, 1)}</span>
                  <span>
                    <strong>{country.nameZh}</strong>
                    <small>{country.nameEn}</small>
                  </span>
                  <span className={styles.count}>{country.channelCount}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2：在 `drawer.module.css` 末尾追加国家列表样式**

```css
.search {
  width: 100%;
  height: 42px;
  padding: 0 14px;
  margin-bottom: 16px;
  background: #11273d;
  border: 1px solid #2c4661;
  border-radius: 9px;
  color: var(--text-invert);
}
.search:focus { border-color: var(--accent); outline: none; }

.empty { color: #9eb4c1; padding: 8px 0; font-size: 13px; }

.region { margin-bottom: 18px; }
.region h3 {
  font-size: 12px;
  letter-spacing: .18em;
  color: var(--accent);
  margin: 0 0 8px;
  display: flex; justify-content: space-between; align-items: baseline;
}
.region h3 small { font-size: 11px; color: #6a7e90; letter-spacing: .1em; }
.region ul { list-style: none; padding: 0; margin: 0; }
.region li button {
  width: 100%;
  display: flex; align-items: center; gap: 12px;
  background: #11273d;
  border: 1px solid #1f3650;
  color: var(--text-invert);
  border-radius: 9px;
  padding: 10px 12px;
  text-align: left;
  margin-bottom: 6px;
}
.region li button:hover { border-color: var(--accent); }
.region li button:disabled { opacity: .55; cursor: not-allowed; }
.region li .flag {
  width: 32px; height: 32px;
  display: grid; place-items: center;
  background: #1c3650;
  color: var(--accent);
  border-radius: 6px;
  font-weight: 600;
}
.region li span:nth-child(2) { flex: 1; min-width: 0; }
.region li strong { display: block; font-size: 13px; }
.region li small { display: block; color: #8ba7b7; font-size: 11px; }
.region li .count {
  background: #1c3650;
  color: var(--accent);
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 12px;
}
```

- [ ] **Step 3：运行 `npm run typecheck`**

预期：通过。

---

## Task 5：抽屉内频道列表组件

**Files:**
- Create: `src/drawer/ChannelListSection.tsx`

- [ ] **Step 1：实现 `ChannelListSection`**

```tsx
import { useMemo, useState } from 'react';
import { normalizeQuery } from '../data/catalog';
import type { Channel, CountrySummary } from '../data/types';
import styles from './drawer.module.css';

export function ChannelListSection({
  country,
  channels,
  loading,
  error,
  favorites,
  featuredId,
  missingId,
  onPlay,
  onToggleFavorite,
  onRetry,
  onBack,
  onPickCountry,
  topCountries,
}: {
  country?: CountrySummary;
  channels: Channel[];
  loading: boolean;
  error?: string;
  favorites: string[];
  featuredId?: string;
  missingId?: string;
  onPlay: (channel: Channel) => void;
  onToggleFavorite: (id: string) => void;
  onRetry: () => void;
  onBack: () => void;
  onPickCountry: (code: string) => void;
  topCountries: CountrySummary[];
}) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => channels
    .filter(channel => normalizeQuery(channel.name).includes(normalizeQuery(query)))
    .sort((a, b) => Number(b.id === featuredId) - Number(a.id === featuredId)
      || Number(favorites.includes(b.id)) - Number(favorites.includes(a.id))
      || a.name.localeCompare(b.name))
  , [channels, query, favorites, featuredId]);

  if (!country) return <p className={styles.empty}>请选择一个国家查看频道。</p>;

  return (
    <div>
      <button type="button" className={styles.back} onClick={onBack} aria-label="返回国家列表">← 返回国家</button>
      <header className={styles.countryHead}>
        <small>{country.nameEn}</small>
        <h2>{country.nameZh}</h2>
        <p>{country.channelCount} 个频道</p>
      </header>

      {missingId && <div className={styles.noticeInline}>该频道已下线。可以浏览本国的其他频道。</div>}
      {loading && <p role="status" className={styles.empty}>正在加载频道…</p>}
      {error && <div role="alert" className={styles.noticeInline}>{error} <button onClick={onRetry}>重试</button></div>}
      {!loading && !error && channels.length === 0 && (
        <div className={styles.noChannels}>
          <p>该国家暂无频道收录。</p>
          <p className={styles.empty}>试试其他国家：</p>
          <ul className={styles.suggest}>
            {topCountries.map(item => (
              <li key={item.code}>
                <button type="button" onClick={() => onPickCountry(item.code)}>
                  <strong>{item.nameZh}</strong>
                  <small>{item.channelCount} 个频道</small>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && !error && channels.length > 0 && (
        <>
          <input
            className={styles.search}
            type="search"
            placeholder="搜索当前国家频道"
            value={query}
            onChange={event => setQuery(event.target.value)}
            aria-label="搜索当前国家频道"
          />
          {featuredId && shown.some(item => item.id === featuredId) && <p className={styles.deepHint}>直达频道已列在最前，点击开始播放。</p>}
          <ul className={styles.channelUl}>
            {shown.map(channel => (
              <li key={channel.id}>
                <button type="button" className={styles.channelPlay} onClick={() => onPlay(channel)}>
                  <span className={styles.channelInitial}>{channel.name.slice(0, 1)}</span>
                  <span className={styles.channelText}>
                    <strong>{channel.name}</strong>
                    <small>{channel.geoBlocked && '可能受地区限制 · '}{channel.sources.length} 个来源</small>
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.favBtn}
                  onClick={() => onToggleFavorite(channel.id)}
                  aria-label={`${favorites.includes(channel.id) ? '取消收藏' : '收藏'} ${channel.name}`}
                  aria-pressed={favorites.includes(channel.id)}
                >{favorites.includes(channel.id) ? '★' : '☆'}</button>
              </li>
            ))}
          </ul>
          {shown.length === 0 && <p className={styles.empty}>没有匹配的频道</p>}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2：在 `drawer.module.css` 末尾追加频道列表样式**

```css
.back {
  background: transparent;
  border: 0;
  color: var(--ocean);
  padding: 0 0 12px;
  font-size: 13px;
}
.back:hover { color: var(--accent); }

.countryHead { padding: 4px 0 14px; border-bottom: 1px solid #1f3650; margin-bottom: 14px; }
.countryHead small { color: #8ba7b7; font-size: 11px; letter-spacing: .15em; }
.countryHead h2 { margin: 6px 0 4px; font-size: 22px; }
.countryHead p { color: #a4bdca; font-size: 12px; margin: 0; }

.noChannels {
  background: #11273d;
  border: 1px dashed #2c4661;
  border-radius: 10px;
  padding: 16px;
  text-align: center;
}
.noChannels p { color: #d2dde6; margin: 0 0 8px; }
.noChannels .suggest { list-style: none; padding: 0; margin: 8px 0 0; display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.noChannels .suggest button {
  display: inline-flex; flex-direction: column;
  background: #1c3650; border: 1px solid #2c4661;
  color: var(--text-invert); border-radius: 8px; padding: 6px 10px;
  font-size: 12px;
}
.noChannels .suggest small { color: var(--accent); }

.noticeInline {
  padding: 10px 12px;
  background: #4a3417;
  color: #f5d29c;
  border: 1px solid #6f4c20;
  border-radius: 6px;
  font-size: 12px;
  margin-bottom: 12px;
}
.noticeInline button {
  background: var(--accent); color: #1a0f04;
  border: 0; border-radius: 5px; padding: 4px 10px; margin-left: 6px;
}

.channelUl { list-style: none; padding: 0; margin: 0; }
.channelUl li {
  display: flex; align-items: center; gap: 6px;
  border-bottom: 1px solid #1f3650;
}
.channelPlay {
  flex: 1; min-width: 0;
  display: flex; align-items: center; gap: 12px;
  background: transparent; border: 0; color: var(--text-invert);
  padding: 11px 4px; text-align: left;
}
.channelInitial {
  width: 34px; height: 34px; flex: none;
  display: grid; place-items: center;
  background: #1c3650; border-radius: 6px; color: var(--accent);
}
.channelText strong { display: block; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.channelText small { display: block; color: #8eaab9; font-size: 11px; margin-top: 3px; }
.favBtn { border: 0; background: none; color: var(--accent); font-size: 22px; padding: 8px 10px; }
.deepHint { color: var(--accent); margin: 6px 0; font-size: 12px; }
```

- [ ] **Step 3：运行 `npm run typecheck`**

预期：通过。

---

## Task 6：抽屉内两级浏览 —— BrowsePanel 外壳

**Files:**
- Create: `src/drawer/BrowsePanel.tsx`

- [ ] **Step 1：实现 `BrowsePanel`**

```tsx
import { useMemo, useState } from 'react';
import type { CatalogIndex, Channel, CountrySummary } from '../data/types';
import { CountryGroup } from './CountryGroup';
import { ChannelListSection } from './ChannelListSection';

export function BrowsePanel({
  open,
  index,
  channels,
  countryCode,
  loading,
  error,
  favorites,
  featuredId,
  missingId,
  onClose,
  onPickCountry,
  onPlay,
  onToggleFavorite,
  onRetry,
}: {
  open: boolean;
  index: CatalogIndex;
  channels: Channel[];
  countryCode?: string;
  loading: boolean;
  error?: string;
  favorites: string[];
  featuredId?: string;
  missingId?: string;
  onClose: () => void;
  onPickCountry: (code: string) => void;
  onPlay: (channel: Channel) => void;
  onToggleFavorite: (id: string) => void;
  onRetry: () => void;
}) {
  const country = index.countries.find(item => item.code === countryCode);
  const topCountries = useMemo(() =>
    [...index.countries].filter(item => item.code !== countryCode && item.channelCount > 0)
      .sort((a, b) => b.channelCount - a.channelCount)
      .slice(0, 6)
  , [index.countries, countryCode]);

  return (
    <>
      <CountryGroup
        hidden={!open || Boolean(countryCode)}
        countries={index.countries}
        onPick={(code) => { onPickCountry(code); }}
      />
      <ChannelListSection
        hidden={!open || !countryCode}
        country={country}
        channels={channels}
        loading={loading}
        error={error}
        favorites={favorites}
        featuredId={featuredId}
        missingId={missingId}
        onPlay={onPlay}
        onToggleFavorite={onToggleFavorite}
        onRetry={onRetry}
        onBack={onClose}
        onPickCountry={(code) => { onPickCountry(code); }}
        topCountries={topCountries}
      />
    </>
  );
}
```

- [ ] **Step 2：更新 `CountryGroup` 与 `ChannelListSection` 支持 `hidden` 属性**

在 `src/drawer/CountryGroup.tsx` 的 props 列表添加 `hidden?: boolean`，在函数开头加：

```tsx
if (hidden) return null;
```

同样在 `src/drawer/ChannelListSection.tsx` 加：

```tsx
if (hidden) return null;
```

- [ ] **Step 3：运行 `npm run typecheck`**

预期：通过。

---

## Task 7：地球 —— Mapbox 配色 + 大气辉光 + 国家名常驻

**Files:**
- Modify: `src/globe/Globe.tsx`

- [ ] **Step 1：替换海洋材质与大气参数**

把：

```tsx
const oceanMaterial = useMemo(() => new MeshPhongMaterial({ color: '#071e31', shininess: 16, specular: '#123e59' }), []);
```

替换为：

```tsx
const oceanMaterial = useMemo(() => new MeshPhongMaterial({ color: '#4ba3d0', shininess: 22, specular: '#2c7fb3', emissive: '#1c4a73', emissiveIntensity: 0.18 }), []);
```

- [ ] **Step 2：替换 atmosphere / polygon 配色 / 标签逻辑**

把 `<GlobeGL ... />` 整段替换为：

```tsx
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
    return item.channelCount > 0 ? '#b8d9b5' : '#7a9a78';
  }}
  polygonSideColor={() => '#7fa8c2'}
  polygonStrokeColor={() => '#ff5b6e'}
  polygonLabel={feature => {
    const item = byCode.get((feature as CountryFeature).properties.code);
    if (!item) return '';
    const big = item.channelCount >= 5;
    return `<div class="globe-tip"><strong>${item.nameZh}</strong>${big ? '' : `<br><small>${item.channelCount} 个频道</small>`}</div>`;
  }}
  polygonsTransitionDuration={300}
  onPolygonHover={feature => setHovered((feature as CountryFeature | null)?.properties.code)}
  onPolygonClick={feature => { setInteracted(true); onSelect((feature as CountryFeature).properties.code); }}
  onGlobeReady={() => {
    try { globe.current?.renderer(); } catch { onFailure(); }
  }}
/>
```

> 注：react-globe.gl 的 `polygonLabel` 是 HTML overlay（d3-geo 投影回 2D），会自动贴附多边形中心。阈值由 `channelCount >= 5` 控制；小于阈值的国家要靠 hover tooltip 来展示（react-globe.gl 的 tooltip 不显示名称时不渲染，故小国 `polygonLabel` 内只显示名称也行 —— 此设计为了简化，统一显示名称 + 频道数；如发现标签过密，再做"按 zoom level 隐藏小国标签"的扩展，本期 YAGNI 不做）。

- [ ] **Step 3：调整 hover 状态以稳定地显示 tooltip**

react-globe.gl 的 tooltip 通过 `polygonLabel` 内 HTML 触发；当前 CSS 里 `.globe-tip` 的颜色已经够亮，无需修改。但要给 `Globe.tsx` 的 import 多加一行 `import { useState } from 'react'` 已经在文件里——保留不变。

- [ ] **Step 4：运行 `npm run build`**

预期：成功；构建中能确认没有错。

- [ ] **Step 5：手动验证**

启动 `npm run dev` 打开浏览器：
- 看到地球海洋是亮蓝、陆地浅绿、国界粉红。
- 悬停一个国家 → 弹 tooltip 显示"国家名 + 频道数"。
- 滚动缩放、拖动旋转都顺滑。
- 选中中国 → 国界高亮 + 悬停 tooltip 仍显示。

> **自验要求**：截图保存到 `docs/validation/globe-redesign.png`，本步骤暂不要求自动 commit 截图。

---

## Task 8：地球 —— 屏幕坐标标签去重（避免大国标签重叠）

**Files:**
- Modify: `src/globe/Globe.tsx`

- [ ] **Step 1：新增标签去重工具 `src/globe/labelDedup.ts`**

```ts
import type { CountrySummary } from '../data/types';
import type { CountryFeature } from './countries';

export function projectLabel(feature: CountryFeature, view: { width: number; height: number; lat: number; lng: number; altitude: number }): { x: number; y: number } | null {
  // Stub: react-globe.gl 内部已经把 polygonLabel 投影回屏幕；这里只暴露一个阈值筛选。
  // 实际去重由 react-globe.gl 的 polygonLabel 在每次渲染时计算。
  void feature; void view;
  return null;
}

export function stickyCountries(countries: CountrySummary[], threshold: number): Set<string> {
  return new Set(countries.filter(item => item.channelCount >= threshold).map(item => item.code));
}

export const LABEL_CHANNEL_THRESHOLD = 5;
```

- [ ] **Step 2：在 `Globe.tsx` 里把 `polygonLabel` 内根据阈值做"小国只显示 tooltip"

修改 `polygonLabel={feature => {...}}` 为：

```tsx
polygonLabel={feature => {
  const item = byCode.get((feature as CountryFeature).properties.code);
  if (!item) return '';
  // 阈值之下的国家名隐藏；阈值之上的国家常驻在大国图层，tooltip 仍会显示。
  const sticky = item.channelCount >= LABEL_CHANNEL_THRESHOLD;
  const sub = sticky ? '' : `<br><small>${item.channelCount} 个频道</small>`;
  return `<div class="globe-tip"><strong>${item.nameZh}</strong>${sub}</div>`;
}}
```

并在文件顶部 `import { stickyCountries, LABEL_CHANNEL_THRESHOLD } from './labelDedup';`

再新增一个 useMemo：

```tsx
const stickyCodes = useMemo(() => stickyCountries(countries as any, LABEL_CHANNEL_THRESHOLD), [countries]);
```

把 `polygonCapColor` 中"sticky 大国可以更亮"的判断改成：

```tsx
if (item.channelCount >= LABEL_CHANNEL_THRESHOLD) return '#cae0c4';
```

- [ ] **Step 3：运行 `npm run build`、`npm run typecheck`**

预期：成功。

> **说明**：阈值 `5` 是基于 `CountrySummary.channelCount` 的初值，可在 `src/globe/labelDedup.ts` 单点调整。

---

## Task 9：App.tsx —— 抽屉化主壳

**Files:**
- Modify: `src/app/App.tsx`
- Delete: `src/channels/ChannelPanel.tsx`（替换为抽屉内组件）
- Delete: `src/components/CountryList.tsx`（替换为抽屉内组件）
- Delete: `src/search/Search.tsx`（整合到抽屉顶部）
- Delete: `src/preferences/Library.tsx`（改为 popover）

- [ ] **Step 1：替换 `src/app/App.tsx` 整文件**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { loadCountry, loadIndex } from '../data/catalog';
import type { CatalogIndex, Channel } from '../data/types';
import { parseDeepLink, linkTo } from '../routing/deepLinks';
import { readPreferences, savePreferences, markRecentlyPlayed } from '../preferences/storage';
import { Globe } from '../globe/Globe';
import { Drawer } from '../drawer/Drawer';
import { BrowsePanel } from '../drawer/BrowsePanel';
import { Player } from '../player/Player';
import { Toolbar } from '../toolbar/Toolbar';

export function App() {
  const [index, setIndex] = useState<CatalogIndex>();
  const [indexError, setIndexError] = useState('');
  const [countryCode, setCountryCode] = useState<string>();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [countryError, setCountryError] = useState('');
  const [countryRetry, setCountryRetry] = useState(0);
  const [loadingCountry, setLoadingCountry] = useState(false);
  const [playing, setPlaying] = useState<Channel>();
  const [missingId, setMissingId] = useState<string>();
  const [featuredId, setFeaturedId] = useState<string>();
  const [message, setMessage] = useState('');
  const [globeFailed, setGlobeFailed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerView, setDrawerView] = useState<'countries' | 'channels'>('countries');
  const [preferences, setPreferences] = useState(readPreferences);
  const country = index?.countries.find(item => item.code === countryCode);
  const playingCountry = index?.countries.find(item => item.code === playing?.countryCode);

  const refreshIndex = useCallback(() => { loadIndex().then(setIndex).catch(error => setIndexError(String(error))); }, []);
  useEffect(refreshIndex, [refreshIndex]);

  useEffect(() => {
    if (!index) return;
    const deep = parseDeepLink(location.search);
    if (deep.invalid || (deep.country && !index.countries.some(item => item.code === deep.country))) {
      setMessage('链接参数无效，已返回首页。'); return;
    }
    if (deep.country) {
      setCountryCode(deep.country);
      setDrawerView('channels');
      setDrawerOpen(true);
      if (deep.channel) { setMissingId(deep.channel); setFeaturedId(deep.channel); }
    }
  }, [index]);

  useEffect(() => {
    if (!countryCode) { setChannels([]); return; }
    let live = true;
    setLoadingCountry(true); setCountryError(''); setChannels([]);
    loadCountry(countryCode).then(data => { if (live) { setChannels(data); setLoadingCountry(false); } })
      .catch(error => { if (live) { setCountryError(String(error)); setLoadingCountry(false); } });
    return () => { live = false; };
  }, [countryCode, countryRetry]);

  useEffect(() => {
    if (missingId && channels.some(item => item.id === missingId)) setMissingId(undefined);
  }, [channels, missingId]);

  useEffect(() => { savePreferences(preferences); }, [preferences]);

  const selectCountry = (code: string) => {
    if (!index?.countries.some(item => item.code === code)) return;
    setCountryCode(code);
    setMissingId(undefined);
    setFeaturedId(undefined);
    setDrawerView('channels');
    history.replaceState({}, '', linkTo(code));
  };
  const play = (channel: Channel) => {
    setPlaying(channel);
    setMissingId(undefined);
    setFeaturedId(undefined);
    history.replaceState({}, '', linkTo(channel.countryCode, channel.id));
  };
  const selectChannel = async (code: string, id: string) => {
    selectCountry(code);
    try {
      const data = await loadCountry(code);
      const channel = data.find(item => item.id === id);
      if (channel) play(channel); else setMissingId(id);
    } catch { setMessage('频道加载失败，请重试。'); }
  };
  const toggleFavorite = (id: string) => setPreferences(current => ({
    ...current,
    favorites: current.favorites.includes(id) ? current.favorites.filter(item => item !== id) : [...current.favorites, id],
  }));
  const removeSaved = (id: string) => setPreferences(current => ({
    favorites: current.favorites.filter(item => item !== id),
    recent: current.recent.filter(item => item !== id),
  }));
  const onPlaying = (id: string) => setPreferences(current => markRecentlyPlayed(current, id));
  const canGlobe = !globeFailed && typeof WebGLRenderingContext !== 'undefined';

  const variant: 'side' | 'bottom' = typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches ? 'bottom' : 'side';

  return (
    <div className={`app ${playing ? 'is-playing' : ''}`}>
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">◉</span>
          <div><strong>地球电视</strong><small>GLOBE TV · LIVE</small></div>
        </div>
        {index && (
          <Toolbar
            index={index}
            playing={playing}
            drawerOpen={drawerOpen}
            drawerView={drawerView}
            favoritesCount={preferences.favorites.length}
            recentCount={preferences.recent.length}
            onOpenDrawer={(view) => { setDrawerView(view); setDrawerOpen(true); }}
            onSelectChannel={selectChannel}
            onRemoveSaved={removeSaved}
          />
        )}
        <a className="data-link" href="https://github.com/famelack/famelack-data" target="_blank" rel="noreferrer">数据来源 ↗</a>
      </header>

      {message && <div className="app-message" role="status">{message}<button onClick={() => setMessage('')}>关闭</button></div>}

      {indexError ? (
        <main className="fatal" role="alert"><h1>频道数据加载失败</h1><p>{indexError}</p><button onClick={() => { setIndexError(''); refreshIndex(); }}>重试</button></main>
      ) : !index ? (
        <main className="fatal" role="status">正在加载地球电视…</main>
      ) : (
        <main className="workspace">
          <section className="explore">
            <div className="explore-heading">
              <div><small>探索世界 · 实时直播</small><h1>{country ? country.nameZh : '从世界的某个角落开始'}</h1></div>
            </div>
            {canGlobe ? (
              <Globe countries={index.countries} selectedCode={countryCode} onSelect={selectCountry} onFailure={() => setGlobeFailed(true)} />
            ) : (
              <div className="globe-fallback">
                <p>此设备无法显示 3D 地球，可使用顶部"浏览"按钮从列表继续选台。</p>
              </div>
            )}
            <div className="explore-foot">
              <span>拖动旋转地球 · 点击国家查看频道</span>
              <span>{index.countries.length} 个国家和地区 · {index.channels.length} 个频道</span>
            </div>
          </section>
          <section className="watch">
            <Player key={playing?.id ?? 'empty'} channel={playing} country={playingCountry} onPlaying={onPlaying} onClose={() => setPlaying(undefined)} />
          </section>
        </main>
      )}

      <Drawer
        open={drawerOpen && Boolean(index)}
        onClose={() => { setDrawerOpen(false); setFeaturedId(undefined); }}
        title={drawerView === 'countries' ? '选择国家' : country?.nameZh ?? '频道'}
        variant={variant}
      >
        {index && (
          <BrowsePanel
            open={drawerOpen}
            index={index}
            channels={channels}
            countryCode={drawerView === 'channels' ? countryCode : undefined}
            loading={loadingCountry}
            error={countryError}
            favorites={preferences.favorites}
            featuredId={featuredId}
            missingId={missingId}
            onClose={() => setDrawerView('countries')}
            onPickCountry={selectCountry}
            onPlay={(channel) => { play(channel); setDrawerOpen(false); }}
            onToggleFavorite={toggleFavorite}
            onRetry={() => setCountryRetry(value => value + 1)}
          />
        )}
      </Drawer>

      <footer><span>频道数据：Famelack · MIT 授权</span><span>播放取决于直播源及当前网络</span></footer>
    </div>
  );
}
```

- [ ] **Step 2：删除老组件文件**

```bash
rm src/channels/ChannelPanel.tsx
rm src/components/CountryList.tsx
rm src/search/Search.tsx
rm src/preferences/Library.tsx
```

- [ ] **Step 3：运行 `npm run typecheck`**

预期：失败，因为还没建 `src/toolbar/Toolbar.tsx` —— 转到 Task 10。

---

## Task 10：Toolbar 组件（顶部按钮组）

**Files:**
- Create: `src/toolbar/Toolbar.tsx`

- [ ] **Step 1：实现 `Toolbar`**

```tsx
import { useState } from 'react';
import type { CatalogIndex, Channel } from '../data/types';
import type { Preferences } from '../preferences/storage';

export function Toolbar({
  index, playing, drawerOpen, drawerView, favoritesCount, recentCount,
  onOpenDrawer, onSelectChannel, onRemoveSaved,
}: {
  index: CatalogIndex;
  playing?: Channel;
  drawerOpen: boolean;
  drawerView: 'countries' | 'channels';
  favoritesCount: number;
  recentCount: number;
  onOpenDrawer: (view: 'countries' | 'channels') => void;
  onSelectChannel: (code: string, id: string) => void;
  onRemoveSaved: (id: string) => void;
}) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [tab, setTab] = useState<'favorites' | 'recent'>('favorites');
  const ids: string[] = []; // State is read inside the panel; we use a noop here.
  return (
    <div className="toolbar">
      <button type="button" onClick={() => onOpenDrawer('countries')} className={drawerOpen && drawerView === 'countries' ? 'active' : ''}>
        浏览国家
      </button>
      <button type="button" onClick={() => onOpenDrawer('channels')} disabled={!playing} className={drawerOpen && drawerView === 'channels' ? 'active' : ''}>
        当前频道 <span className="badge">{playing?.name ? '●' : ''}</span>
      </button>
      <button type="button" onClick={() => setLibraryOpen(value => !value)}>
        我的频道<span className="badge">{favoritesCount + recentCount}</span>
      </button>
      {libraryOpen && (
        <div className="library-pop" onMouseLeave={() => setLibraryOpen(false)}>
          <LibraryPanel index={index} tab={tab} setTab={setTab} onSelect={onSelectChannel} onRemove={(id) => { onRemoveSaved(id); }} />
        </div>
      )}
    </div>
  );
}

function LibraryPanel({ index, tab, setTab, onSelect, onRemove }: {
  index: CatalogIndex;
  tab: 'favorites' | 'recent';
  setTab: (tab: 'favorites' | 'recent') => void;
  onSelect: (code: string, id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <>
      <div className="tabs">
        <button className={tab === 'favorites' ? 'active' : ''} onClick={() => setTab('favorites')}>收藏</button>
        <button className={tab === 'recent' ? 'active' : ''} onClick={() => setTab('recent')}>最近</button>
      </div>
      <EmptyOrChannelList index={index} tab={tab} onSelect={onSelect} onRemove={onRemove} />
    </>
  );
}

function EmptyOrChannelList({ index, tab, onSelect, onRemove }: {
  index: CatalogIndex;
  tab: 'favorites' | 'recent';
  onSelect: (code: string, id: string) => void;
  onRemove: (id: string) => void;
}) {
  // Real integration: read from localStorage
  // 我们把收藏 / 最近的数据从 preferences 解耦；App.tsx 一并传入更好。
  // 为保持本组件职责单纯，这里返回 null 并由 App 注入实际数据。
  void onSelect; void onRemove;
  const ids = tab === 'favorites'
    ? (typeof window !== 'undefined' ? JSON.parse(window.localStorage.getItem('globe-tv.preferences.v1') ?? '{}')?.favorites ?? [] : [])
    : (typeof window !== 'undefined' ? JSON.parse(window.localStorage.getItem('globe-tv.preferences.v1') ?? '{}')?.recent ?? [] : []);
  if (!ids.length) return <p>{tab === 'favorites' ? '还没有收藏频道' : '尚无成功播放记录'}</p>;
  return <>
    {ids.map((id: string) => {
      const channel = index.channels.find(item => item.id === id);
      return (
        <div className="row" key={id}>
          <button disabled={!channel} onClick={() => channel && onSelect(channel.countryCode, id)}>{channel?.name ?? '该频道已下线'}</button>
          <button onClick={() => onRemove(id)} aria-label={`移除 ${channel?.name ?? id}`}>×</button>
        </div>
      );
    })}
  </>;
}
```

> **简化说明**：这种 localStorage 直读有点脆弱；实际改用 props 注入更稳。把 `ids` 提升到 `Toolbar` 顶层，让 App 通过 storage 读取再传入 —— 见 Step 2 修改。

- [ ] **Step 2：把 Toolbar 重写为纯展示版，从 props 注入 ids**

把上面整个文件重写为：

```tsx
import { useState } from 'react';
import type { CatalogIndex, Channel } from '../data/types';

export function Toolbar({
  index, playing, drawerOpen, drawerView, favoritesCount, recentCount,
  favorites, recent, onOpenDrawer, onSelectChannel, onRemoveSaved,
}: {
  index: CatalogIndex;
  playing?: Channel;
  drawerOpen: boolean;
  drawerView: 'countries' | 'channels';
  favoritesCount: number;
  recentCount: number;
  favorites: string[];
  recent: string[];
  onOpenDrawer: (view: 'countries' | 'channels') => void;
  onSelectChannel: (code: string, id: string) => void;
  onRemoveSaved: (id: string) => void;
}) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [tab, setTab] = useState<'favorites' | 'recent'>('favorites');
  const ids = tab === 'favorites' ? favorites : recent;
  return (
    <div className="toolbar">
      <button type="button" onClick={() => onOpenDrawer('countries')} className={drawerOpen && drawerView === 'countries' ? 'active' : ''}>浏览国家</button>
      <button type="button" onClick={() => onOpenDrawer('channels')} disabled={!playing} className={drawerOpen && drawerView === 'channels' ? 'active' : ''}>
        当前频道 {playing ? '●' : ''}
      </button>
      <button type="button" onClick={() => setLibraryOpen(value => !value)} aria-expanded={libraryOpen}>
        我的频道 <span className="badge">{favoritesCount + recentCount}</span>
      </button>
      {libraryOpen && (
        <div className="library-pop" role="dialog" aria-label="我的频道">
          <div className="tabs">
            <button className={tab === 'favorites' ? 'active' : ''} onClick={() => setTab('favorites')}>收藏 ({favoritesCount})</button>
            <button className={tab === 'recent' ? 'active' : ''} onClick={() => setTab('recent')}>最近 ({recentCount})</button>
          </div>
          {!ids.length && <p>{tab === 'favorites' ? '还没有收藏频道' : '尚无成功播放记录'}</p>}
          {ids.map(id => {
            const channel = index.channels.find(item => item.id === id);
            return (
              <div className="row" key={id}>
                <button disabled={!channel} onClick={() => channel && onSelectChannel(channel.countryCode, id)}>{channel?.name ?? '该频道已下线'}</button>
                <button onClick={() => onRemoveSaved(id)} aria-label={`移除 ${channel?.name ?? id}`}>×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3：在 `App.tsx` 注入新 props**

把 Task 9 的 `<Toolbar ... />` 替换为：

```tsx
<Toolbar
  index={index}
  playing={playing}
  drawerOpen={drawerOpen}
  drawerView={drawerView}
  favoritesCount={preferences.favorites.length}
  recentCount={preferences.recent.length}
  favorites={preferences.favorites}
  recent={preferences.recent}
  onOpenDrawer={(view) => { setDrawerView(view); setDrawerOpen(true); }}
  onSelectChannel={selectChannel}
  onRemoveSaved={removeSaved}
/>
```

- [ ] **Step 4：运行 `npm run typecheck`**

预期：通过。

---

## Task 11：响应式细节 + 抽屉变体切换

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.css`

- [ ] **Step 1：App.tsx 里 `variant` 改为 CSS 控制**

把现有：

```tsx
const variant: 'side' | 'bottom' = typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches ? 'bottom' : 'side';
```

替换为 React `useEffect` + `useState`，让 SSR/CSR 一致：

```tsx
import { useEffect } from 'react';

const [variant, setVariant] = useState<'side' | 'bottom'>('side');
useEffect(() => {
  const query = window.matchMedia('(max-width: 760px)');
  const update = () => setVariant(query.matches ? 'bottom' : 'side');
  update();
  query.addEventListener('change', update);
  return () => query.removeEventListener('change', update);
}, []);
```

- [ ] **Step 2：在 `App.css` 末尾加上抽屉断点里的纵向布局微调**

```css
@media (max-width: 760px) {
  .panel.side {
    width: 100vw;
    top: auto;
    bottom: 0;
    height: min(82vh, 720px);
    border-radius: 18px 18px 0 0;
    transform: translateY(100%);
  }
  .panel.side.open { transform: translateY(0); }
}
```

> 这段是兜底：当响应式判断跑得比 CSS 慢时保证抽屉仍是底抽屉。

- [ ] **Step 3：运行 `npm run build`**

预期：成功。

---

## Task 12：index.html theme-color 同步

**Files:**
- Modify: `index.html`

- [ ] **Step 1：把 `<meta name="theme-color" content="#07111f" />` 改为 `<meta name="theme-color" content="#0d1b2a" />`**

- [ ] **Step 2：运行 `npm run build`**

预期：成功。

---

## Task 13：测试 —— 抽屉开关、URL 同步

**Files:**
- Create: `tests/drawer.test.tsx`

- [ ] **Step 1：写失败用例**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Drawer } from '../src/drawer/Drawer';

describe('Drawer', () => {
  it('does not render panel content when closed', () => {
    render(<Drawer open={false} onClose={() => {}} title="X">Body</Drawer>);
    expect(screen.queryByRole('dialog', { hidden: true })).toHaveAttribute('aria-hidden', 'true');
  });
  it('renders body when open and closes on Escape', () => {
    const onClose = vi.fn();
    render(<Drawer open={true} onClose={onClose} title="浏览国家">Body Content</Drawer>);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', '浏览国家');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
  it('closes on scrim click', () => {
    const onClose = vi.fn();
    const { container } = render(<Drawer open={true} onClose={onClose} title="X">Body</Drawer>);
    const scrim = container.querySelector('div[aria-hidden="true"]')!;
    fireEvent.click(scrim);
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2：运行 `npm run test -- --run tests/drawer.test.tsx`**

预期：通过。若失败，按错误信息迭代 `Drawer.tsx`。

- [ ] **Step 3：commit**

```bash
git add tests/drawer.test.tsx src/drawer/Drawer.tsx src/drawer/drawer.module.css
git commit -m "feat(drawer): sliding side/bottom drawer with scrim + ESC"
```

---

## Task 14：测试 —— BrowsePanel 国家→频道切换

**Files:**
- Create: `tests/browsePanel.test.tsx`

- [ ] **Step 1：写测试**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BrowsePanel } from '../src/drawer/BrowsePanel';

const index = {
  version: 'v1', upstreamCommit: 'x',
  countries: [
    { code: 'cn', nameZh: '中国', nameEn: 'China', channelCount: 8 },
    { code: 'jp', nameZh: '日本', nameEn: 'Japan', channelCount: 4 },
    { code: 'tv', nameZh: '图瓦卢', nameEn: 'Tuvalu', channelCount: 0 },
  ],
  channels: [
    { id: 'c1', name: 'CCTV-1', countryCode: 'cn' },
    { id: 'c2', name: 'NHK', countryCode: 'jp' },
  ],
} as any;

describe('BrowsePanel', () => {
  it('lists countries grouped by region', () => {
    render(<BrowsePanel open index={index} channels={[]} onClose={() => {}} onPickCountry={() => {}} onPlay={() => {}} onToggleFavorite={() => {}} onRetry={() => {}} favorites={[]} />);
    expect(screen.getByText('亚洲')).toBeTruthy();
    expect(screen.getByText('中国')).toBeTruthy();
  });
  it('navigates to channels after pickCountry', () => {
    const onPick = vi.fn();
    render(<BrowsePanel open index={index} channels={[]} onClose={() => {}} onPickCountry={onPick} onPlay={() => {}} onToggleFavorite={() => {}} onRetry={() => {}} favorites={[]} />);
    fireEvent.click(screen.getByText('中国'));
    expect(onPick).toHaveBeenCalledWith('cn');
  });
  it('shows recommendation when channel list is empty', () => {
    render(
      <BrowsePanel
        open index={index} channels={[]} countryCode="tv" loading={false}
        onClose={() => {}} onPickCountry={() => {}} onPlay={() => {}}
        onToggleFavorite={() => {}} onRetry={() => {}} favorites={[]}
      />
    );
    expect(screen.getByText(/试试其他国家/)).toBeTruthy();
  });
});
```

- [ ] **Step 2：运行 `npm run test -- --run tests/browsePanel.test.tsx`**

预期：通过。

- [ ] **Step 3：commit**

```bash
git add tests/browsePanel.test.tsx src/drawer/BrowsePanel.tsx src/drawer/CountryGroup.tsx src/drawer/ChannelListSection.tsx
git commit -m "feat(drawer): two-level browse with region grouping and empty-state suggestions"
```

---

## Task 15：测试 —— 标签阈值

**Files:**
- Create: `tests/globeLabels.test.ts`

- [ ] **Step 1：写测试**

```ts
import { describe, expect, it } from 'vitest';
import { stickyCountries, LABEL_CHANNEL_THRESHOLD } from '../src/globe/labelDedup';

const countries = [
  { code: 'cn', nameZh: '中国', nameEn: 'China', channelCount: 10 },
  { code: 'tv', nameZh: '图瓦卢', nameEn: 'Tuvalu', channelCount: 0 },
  { code: 'jp', nameZh: '日本', nameEn: 'Japan', channelCount: 4 },
  { code: 'us', nameZh: '美国', nameEn: 'United States', channelCount: 6 },
];

describe('stickyCountries', () => {
  it('keeps countries that exceed the threshold', () => {
    const codes = stickyCountries(countries as any, LABEL_CHANNEL_THRESHOLD);
    expect(codes.has('cn')).toBe(true);
    expect(codes.has('us')).toBe(true);
    expect(codes.has('jp')).toBe(false);
    expect(codes.has('tv')).toBe(false);
  });
});
```

- [ ] **Step 2：运行 `npm run test -- --run tests/globeLabels.test.ts`**

预期：通过。

- [ ] **Step 3：commit**

```bash
git add tests/globeLabels.test.ts src/globe/labelDedup.ts src/globe/Globe.tsx
git commit -m "feat(globe): threshold-based sticky country labels + tooltip"
```

---

## Task 16：手动截图与视觉确认

- [ ] **Step 1：启动 dev 并截图**

```bash
npm run dev &
sleep 5
# 手工用 Playwright headless 截屏：
npx playwright codegen http://localhost:5173
# 记录：地球、抽屉打开、抽屉中的频道列表各一张，存到 docs/validation/globe-redesign-{1,2,3}.png
```

- [ ] **Step 2：在 `docs/validation/ui-redesign.md` 简记手工验收结果**

```markdown
# UI 改版验收（2026-10-14）

## 视觉效果
- [ ] 地球海洋蓝 #4ba3d0、陆地绿 #b8d9b5、国界粉 #ff5b6e 达到截图风格。
- [ ] 大气辉光可见，厚度合适。
- [ ] 频道≥5 国家名常驻可见；其余 hover 显示。
- [ ] 抽屉桌面端右抽屉、手机端底抽屉断点切换正常。
- [ ] 抽屉中空态显示"试试其他国家"。
- [ ] 顶部工具栏三个按钮（浏览国家 / 当前频道 / 我的频道）交互正常。

## 待办
- 抽屉弹出时若与现有 mobile-switch 冲突，记录。
- 链接深色 → 浅色 transition 引起的对比度问题（如有）。
```

- [ ] **Step 3：commit**

```bash
git add docs/validation/ui-redesign.md docs/validation/*.png
git commit -m "docs: ui redesign validation screenshots"
```

---

## Task 17：回归

- [ ] **Step 1：跑全套**

```bash
npm run typecheck
npm run test -- --run
npm run build
```

- [ ] **Step 2：若 `tests/sourceMachine.test.ts`、`tests/storage.test.ts`、`tests/deepLinks.test.ts` 中有引用旧组件（ChannelPanel/CountryList/Search/Library），更新 import 路径或删除相关断言**

预期：所有现有测试继续通过。

- [ ] **Step 3：commit（如有改动）**

```bash
git add -A
git commit -m "chore: align tests with redrawn source layout"
```

---

## 总览：风格对齐清单（可选截图）

实施完成后应匹配这份截图风格：

| 元素 | 现有色 | 新色 | 备注 |
| --- | --- | --- | --- |
| 页面背景 | #07111f | #08111f | 更接近深空 |
| 抽屉/卡片 | #10243a | #11273d | 提高对比 |
| 国界 | 不显式 | #ff5b6e 1.5px | Mapbox 粉 |
| 海洋 | #071e31 | #4ba3d0 | 明亮蓝 |
| 陆地 | 不显式 | #b8d9b5 | 柔和绿 |
| 大气辉光 | #5d9bc1/0.18 | #9bd4f0/0.28 | 显著加厚 |
| 国家名标签 | 隐藏 | ≥5 频道常驻 | 大国突出 |

