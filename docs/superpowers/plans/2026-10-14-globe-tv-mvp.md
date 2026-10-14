# 地球电视首版实施计划

> 执行说明：按下列任务顺序实施；每个任务完成后运行对应验证，再继续下一项。任务状态用复选框跟踪。

**目标：**交付可通过公开网址访问的电视直播网页，让用户在 3D 地球选国家、找频道并播放；在中国大陆直连网络下完成实际验收。

**架构：**React + TypeScript + Vite 构建静态单页应用。构建期从 Famelack 仓库生成本站频道索引及按国家拆分的数据文件；浏览器不访问 GitHub。地球组件、频道浏览状态和播放器状态分离，浏览国家不打断播放。浏览器直连视频源，不设置视频代理。

**技术栈：**React、TypeScript、Vite、React Globe.GL、HTML video、hls.js、Vitest、Playwright、GitHub Actions；首选 GitHub Pages，备选 Cloudflare Workers 静态资源。

**范围依据：**[地球电视首版需求文档](../specs/2026-10-14-globe-tv-mvp.md)。本计划只覆盖首版电视功能。

---

## 预期目录与职责

| 路径 | 职责 |
| --- | --- |
| `package.json`, `vite.config.ts`, `tsconfig.json` | 构建、类型检查和测试入口 |
| `src/app/App.tsx`, `src/app/App.css` | 页面布局与顶层状态协调 |
| `src/data/types.ts`, `src/data/catalog.ts` | 标准数据类型、加载和查询 |
| `scripts/sync-tv.mjs` | 构建期读取上游文件、校验、过滤、输出数据 |
| `public/data/index.json`, `public/data/countries/*.json` | 本站提供的国家索引和频道数据 |
| `public/licenses/famelack-data-LICENSE.txt` | 上游许可证副本 |
| `src/globe/Globe.tsx`, `src/globe/countries.ts` | 地球、国界与国家代码映射 |
| `public/geo/countries.geojson` | 经过许可核对的国界数据 |
| `src/channels/ChannelPanel.tsx`, `src/search/Search.tsx` | 频道列表、筛选、全局搜索 |
| `src/player/Player.tsx`, `src/player/sourceMachine.ts` | 视频播放、源切换与失败恢复 |
| `src/preferences/storage.ts` | 收藏、最近观看、数据迁移 |
| `src/routing/deepLinks.ts` | 国家和频道直达链接 |
| `src/components/CountryList.tsx` | 国家列表与 WebGL 回退 |
| `tests/`, `e2e/` | 数据、状态及核心交互验证 |
| `.github/workflows/deploy.yml` | 每日同步、校验、构建和部署 |

文件可随实现微调，但上述职责边界应保持。`public/data/` 是构建产物；可放入少量开发样例，但正式数据由同步脚本生成。

## 阶段 0：技术验证与选型门槛

### 任务 1：建立可复现的地球与播放原型

**文件：**创建 `package.json`、`vite.config.ts`、`src/main.tsx`、`src/app/App.tsx`、`src/globe/Globe.tsx`、`src/player/Player.tsx`、`docs/validation/spike-results.md`。

- [ ] 初始化 Vite React TypeScript 项目，配置 `dev`、`build`、`typecheck`、`test` 命令；固定依赖版本并提交锁文件。
- [ ] 用真实国界 GeoJSON 试做国家多边形点击、旋转、选中高亮。记录数据来源、许可、大小、地图代码与 Famelack 国家代码的差异。对无法直接映射的地区建显式映射表，不做模糊名称匹配。
- [ ] 用至少 6 个代表样本验证播放：国内与海外频道、单 HLS 源、多源、预期失败源、地区受限源。分别记录桌面 Chrome/Edge/Safari 与至少一台手机的实际结果、加载耗时和错误类型。
- [ ] 验证不支持 WebGL、弱性能设备和系统“减少动态效果”设置。若 React Globe.GL 在目标手机明显卡顿或命中不可靠，再比较 MapLibre 的 globe 投影；将最终选择和原因写入 `docs/validation/spike-results.md`。
- [ ] 制作只有静态 HTML、JS 和一个数据文件的 Pages 与 Workers 测试部署；请作者在中国大陆直连网络打开并记录可访问性。未取得该环境实测前，托管结论标记为“待验收”。

**通过条件：**明确地球库、国界数据、浏览器播放路径和候选托管平台；失败样本有可复现记录。原型只是选型证据，不能以开发机网络结果代替作者的直连结果。

## 阶段 1：可用的数据底座

### 任务 2：建立标准频道格式与同步脚本

**文件：**创建 `src/data/types.ts`、`scripts/sync-tv.mjs`、`tests/sync-tv.test.ts`、`public/data/index.json`、`public/data/countries/*.json`、`public/licenses/famelack-data-LICENSE.txt`。

- [ ] 定义标准频道字段：`id`（上游 `nanoid`）、`name`、`countryCode`（小写 ISO 风格代码）、`languages`、`geoBlocked`、`sources`。来源至少包含 `kind`、`url` 和原始顺序；只接收原型已验证可由浏览器直接处理的来源类型。
- [ ] 同步脚本读取上游 `tv/raw/countries/*.json` 和 `countries_metadata.json`，校验顶层结构及每条记录的必需字段。无效条目写入构建报告并跳过；若整个国家文件损坏、总数据异常减少或索引为空，则脚本非零退出。
- [ ] 过滤仅含 YouTube 来源的频道，去除空 URL 与重复 URL；同一频道按 ID 去重。保持源顺序，不将频道数解释为实时可播放数。
- [ ] 生成轻量 `index.json`（国家代码、中文名、英文名、过滤后数量、频道搜索必要字段）和按国家拆分的频道文件；国家列表点击时只加载该国文件。中文名使用随项目维护的显式映射，缺失时回退英文名。
- [ ] 将上游 MIT LICENSE 和版权信息复制到本站产物，并在界面“数据来源”入口链接至 Famelack。上游 README 明确提示结构可变、建议维护本站副本。
- [ ] 写有意义的单元测试：仅 YouTube 过滤、HLS 保留、重复源去重、上游字段缺失、空国家、过滤后频道数和同步失败不产生可发布空索引。用小型固定样例，不在测试中请求网络。
- [ ] 运行 `npm run test -- --run`、`npm run typecheck`、`npm run build`；预期全部成功且 `dist/data/index.json` 非空。

**通过条件：**网站可以完全从本站静态文件获得国家和频道数据；过滤后计数与频道列表一致；错误同步会让 CI 失败，不会覆盖上一版部署。

### 任务 3：实现数据加载、搜索与直达链接

**文件：**创建 `src/data/catalog.ts`、`src/routing/deepLinks.ts`、`tests/catalog.test.ts`、`tests/deepLinks.test.ts`。

- [ ] 实现索引只加载一次、国家数据按需加载、加载失败可重试。国家与频道搜索统一处理大小写和多余空格；国家支持中英文，频道按原名搜索。
- [ ] 采用静态托管友好的查询参数：`?country=cn` 与 `?country=cn&channel=<id>`。解析时校验国家代码和频道 ID；无效参数回到地球首页并提示，不让页面空白。
- [ ] 打开频道直达链接时选中国家并展示频道，但等待用户点击播放；复制链接应保留当前浏览国家或频道。
- [ ] 为索引查询、未知国家、未知频道、重复名称频道及带编码字符的 URL 写测试；运行 `npm run test -- --run`。

**通过条件：**刷新及直接打开 URL 都能恢复对应视图；上游已删除频道时展示下线状态。

## 阶段 2：核心选台界面

### 任务 4：实现地球、国家列表和搜索

**文件：**完善 `src/globe/Globe.tsx`、`src/globe/countries.ts`，创建 `src/components/CountryList.tsx`、`src/search/Search.tsx`、`tests/country-selection.test.tsx`。

- [ ] 地球首次缓慢自转；第一次拖动、点击、键盘选国或搜索后停止。选中、悬停/焦点高亮对应国界并显示国家名称与过滤后的收录数。无频道国界降低亮度，点击后出现明确空态。
- [ ] 国家列表与搜索提供相同选国能力，用于小国家和 WebGL 回退。检测 WebGL 初始化失败时切换列表；保持全局搜索和播放器可用。
- [ ] 国家边界与数据代码不匹配时，在国家列表保留该国家入口；地图不假装可点击。将映射缺口写入验证记录。
- [ ] 支持键盘焦点、按钮语义和可见焦点；遵循 `prefers-reduced-motion`，关闭自动旋转与长距离过渡。
- [ ] 测试选国、无频道、地图失败回退和搜索；运行 `npm run test -- --run`。

**通过条件：**鼠标、触摸与键盘都能选国；WebGL 不可用时仍可完成选台。

### 任务 5：实现频道浏览及响应式布局

**文件：**创建 `src/channels/ChannelPanel.tsx`，完善 `src/app/App.tsx`、`src/app/App.css`，创建 `e2e/browse.spec.ts`。

- [ ] 频道列表提供当前国家标题、收录数、国家内搜索、收藏优先排序和地区限制标记。频道名称保留原文；缺失徽标时用名称首字母/文字标识。
- [ ] 桌面端以地球、频道面板和右侧大播放器组成稳定布局；播放前播放器区展示引导，播放后地球缩小但仍可操作。
- [ ] 手机端未播放时地球占主视觉；播放后播放器置顶，下方在“地球 / 频道”之间切换。设置列表独立滚动，避免拖地球时意外滚动整个页面。
- [ ] 明确分离 `browsingCountry` 与 `playingChannel`：点击新国家只改列表与地球，不能改播放器源。为这个行为写交互测试。
- [ ] 运行 `npm run build` 和 `npx playwright test e2e/browse.spec.ts`；在窄屏与宽屏截图检查遮挡、溢出和触摸目标。

**通过条件：**桌面与手机都能完成选国找台；播放状态不会被浏览操作覆盖。

## 阶段 3：播放与个人功能

### 任务 6：完成多源播放器

**文件：**完善 `src/player/Player.tsx`，创建 `src/player/sourceMachine.ts`、`tests/sourceMachine.test.ts`、`e2e/player.spec.ts`。

- [ ] 源状态明确为 `idle`、`loading`、`playing`、`trying-next`、`failed`；每次换频道生成新的播放会话标识，旧请求或事件不能影响新频道。
- [ ] 对原生 HLS 可用的浏览器使用 `video.src`，否则在 `Hls.isSupported()` 时使用 hls.js；切换或卸载时销毁旧实例。对不支持或被跨域拦截的源进入下一源。
- [ ] 播放失败依序尝试同频道备用源，显示第几个源、允许取消与手动选源；全部失败显示重试和换台。不要自动播放其他频道。为连续失败、取消、手动切源和迟到事件写状态测试。
- [ ] 实现播放/暂停、音量、静音、全屏；只有浏览器支持时显示画中画按钮。播放限制导致自动播放被拒绝时显示“点击播放”，不误报为源失效。
- [ ] 用原型中已记录的可播与失败样本实测；运行 `npm run test -- --run`、`npx playwright test e2e/player.spec.ts`。E2E 可用可控本地视频/模拟错误检验状态，真实直播结果另记入验证文档。

**通过条件：**同频道可自动恢复或清晰失败；快速换台不会串台；控制项按能力工作。

### 任务 7：完成收藏、历史和直达体验

**文件：**创建 `src/preferences/storage.ts`、`tests/storage.test.ts`，完善 `src/app/App.tsx`、`src/channels/ChannelPanel.tsx`，创建 `e2e/personal.spec.ts`。

- [ ] 使用带版本号的 `localStorage` 键保存收藏 ID 与最近成功开播的频道 ID；读取损坏数据时清理该键并回退为空列表，不让应用崩溃。
- [ ] 最近观看只在 `playing` 状态首次到达时记录；重复观看将频道移到最前。设置合理数量上限，例如 30 条。
- [ ] 收藏和历史中的已下线频道显示不可播放状态，并提供移除操作；查询参数直达已下线频道时提供返回该国列表入口。
- [ ] 测试收藏排序、历史更新、坏存储数据、频道下线和刷新持久化；运行 `npm run test -- --run`、`npx playwright test e2e/personal.spec.ts`。

**通过条件：**无账号情况下收藏与历史在当前浏览器持久；清站点数据后应用正常回到初始状态。

## 阶段 4：视觉、发布和验收

### 任务 8：完成视觉和无障碍检查

**文件：**完善 `src/app/App.css`、`src/globe/Globe.tsx`、`src/channels/ChannelPanel.tsx`、`src/player/Player.tsx`；记录结果到 `docs/validation/ui-qa.md`。

- [ ] 按深色影院风统一颜色、字体、间距、面板层级和按钮状态；重点检查首次地球页、国家空态、频道失败态、播放器加载态。
- [ ] 检查 360px 手机、常见桌面宽度、横屏手机和浏览器缩放。长频道名可换行或截断但应能查看完整名称。
- [ ] 用键盘完成搜索、选国家、选频道、播放器控制；检查焦点、标签、对比度与减少动态效果。无法在 3D 图层中逐国键盘导航时，国家列表必须承担完整替代路径。
- [ ] 保存关键界面截图与手动检查结果；运行 `npm run typecheck`、`npm run test -- --run`、`npm run build` 和全部 Playwright 用例。

**通过条件：**核心流程无布局遮挡，视觉状态完整，键盘和回退路径可用。

### 任务 9：配置每日发布与失败保护

**文件：**创建 `.github/workflows/deploy.yml`、`docs/DEPLOYMENT.md`，必要时创建 `wrangler.jsonc`。

- [ ] workflow 支持手动触发、主分支推送和每日定时触发。构建前拉取上游固定提交或记录其 SHA；同步、测试、类型检查、构建全部成功后才执行部署。
- [ ] GitHub Pages 版本使用官方 Pages Actions；部署路径、Vite `base` 和直达链接方式保持一致。若大陆直连实测不稳，改用 Workers 静态资源，保留相同构建产物和每日同步触发。
- [ ] 将 Workers API 凭据仅放在 GitHub Actions Secrets，不提交仓库；文档写出创建账号、免费域名、Secrets 与首次发布的具体操作。
- [ ] 模拟上游拉取失败或数据格式错误，确认 CI 停在构建前、已发布版本仍可访问。检查许可证文件和数据来源链接随部署保留。

**通过条件：**每日自动更新，失败不清空网站；部署步骤可由作者按文档复现。

### 任务 10：正式验收与问题记录

**文件：**创建 `docs/validation/release-checklist.md`，更新 `docs/superpowers/specs/2026-10-14-globe-tv-mvp.md` 的状态。

- [ ] 在真实公开网址用大陆直连网络验证：首页、地球资源、国家索引、频道文件、播放器资源；记录日期、网络与设备。
- [ ] 至少验收：中国及两个海外国家、一个无频道国家、一个地区受限频道、一个多源频道、一个全部失败频道、一个直达链接、收藏和历史。
- [ ] 在桌面 Chrome/Edge/Safari 与手机 Safari/Chrome 中记录“可播放 / 不可播放 / 未测试”。对于设备缺失或无法验证的组合，明确标为未测试。
- [ ] 检查浏览国家不中断播放、无 WebGL 回退、减少动态效果、频道下线状态及同步失败保护；把阻断性问题修复并重跑相关验证。
- [ ] 上线后记录最终网址、选用平台、数据版本与已知限制。

**通过条件：**达到[地球电视首版需求文档](../specs/2026-10-14-globe-tv-mvp.md)的首版验收标准；剩余限制有明确记录，不把未验证项表述为已通过。

## 实施时的固定约束

- 先完成任务 1 再锁定地球与托管技术；其余任务可在本地继续，但正式发布必须等作者直连实测。
- `sources` 只接纳经原型确认的可处理类型；新增来源类型需补一条数据测试和一条播放验证记录。
- 上游 MIT 授权适用于数据集再使用；频道直播本身的可访问性与播放权利不能由数据集许可证推定。提供来源说明和处理失效/投诉的维护方式。
- 不加入电台、摄像头、账号、直播转码、中转或节目时刻表，以免阻塞首版。
