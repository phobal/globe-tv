# 个人频道台实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将地图电视改为免登录的个人频道台，提供收藏首页、内容发现与当前分类内滑动切台。

**Architecture:** 分类索引独立于原始来源文件，摘要用于浏览和搜索，播放源按需加载。应用持有播放上下文，播放器保持挂载并负责媒体状态、手势和操作层。沿用现有 Video.js、字幕、主题与偏好存储并兼容旧链接。

**Tech Stack:** React 19、TypeScript、Vite、Tailwind CSS、Video.js、Vitest、Playwright。

**设计依据:** `docs/superpowers/specs/2026-10-20-personal-tv-design.md`

**实现分支:** `codex/personal-tv`，在用户指定的当前工作目录实现，不额外建立工作树。

## 完成清单

- [ ] 1. 分类目录、稳定 ID 与按需加载
- [ ] 2. 本地偏好迁移、播放上下文与链接
- [ ] 3. 我的频道、发现页与持续播放布局
- [ ] 4. 手机手势、3 秒浮层、选台与首次引导
- [ ] 5. 回归与界面验证、依赖清理、文档

## Task 1：分类目录与加载

**文件：** `scripts/build-discovery.mjs`、`scripts/discovery-mapping.json`、`scripts/sync-iptv-source.mjs`、`src/data/discovery.ts`、`src/data/types.ts`、`tests/discovery.test.ts`、`tests/sync-iptv-source.test.ts`、生成的 `public/data/discovery.json`、`package.json`。

- [ ] 先写测试：每个频道至少有一个内容分类、ID 唯一、多分类主分类明确、混合来源进入更多、缺失国家不影响归类；相同输入同步保持相同 ID；索引不含线路 URL。
- [ ] 执行 `npx vitest run tests/discovery.test.ts tests/sync-iptv-source.test.ts`，确认新行为未实现时失败。
- [ ] 实现七个内容分类、原始分组来源筛选、轻量摘要、按需加载、失败缓存重试及重复 ID/无效数据诊断。来源分组与播放线路明确区分。同步时重新生成索引与报告，不依赖旧报告总数。
- [ ] 执行同组测试与 `npm run catalog`；检查实际目录计数和摘要计数一致。审查数据契约与实现后勾选。

## Task 2：偏好与播放上下文

**文件：** `src/preferences/storage.ts`、`src/routing/deepLinks.ts`、`src/player/channelNavigation.ts`、新增 `src/player/playbackContext.ts`、相关 `tests/*.test.ts`。

- [ ] 先写测试：旧偏好迁移、上次分类/引导状态持久化、存储异常回退、收藏移动边界；分类队列不跨类和稳定排序；新旧链接迁移。
- [ ] 执行 `npx vitest run tests/storage.test.ts tests/deepLinks.test.ts tests/channelNavigation.test.ts tests/playbackContext.test.ts`，确认预期失败。
- [ ] 实现可选的版本化偏好字段，保留主题、旧收藏及历史；收藏进入恢复上次有效分类或主分类；新链接包含分类与频道，旧国家和热门链接可迁移。
- [ ] 执行同组测试和类型检查，审查兼容性后勾选。

## Task 3：首页、发现与应用整合

**文件：** `src/app/App.tsx`、新增 `src/library/` 下的首页、发现、频道卡片、台标组件及样式、`src/app.css`、`tests/library.test.tsx`、`tests/app.test.tsx`。

- [ ] 先写交互测试：首页不自动播放、点击继续观看、收藏编辑排序和失效条目移除；搜索跨分类、来源/语言/国家过滤；浏览不卸载正在播放的播放器。
- [ ] 运行新测试确认缺少新页面时失败。
- [ ] 实现默认首页、发现分类、全局搜索、来源筛选、最近展开、收藏编辑、加载重试及空状态。用台标回退与内容类型标识呈现频道；保持触摸目标与键盘路径。
- [ ] 用应用持有分类队列快照，兼容直达链接和浏览返回；电脑播放器与列表并排，浏览时保留当前播放入口；不导入地图组件。
- [ ] 运行页面测试与类型检查；检查 320px、390px 与电脑布局后勾选。

## Task 4：沉浸播放

**文件：** `src/player/PlayerModal.tsx`、新增 `src/player/usePlayerChrome.ts`、手机选台/引导组件、对应测试。

- [ ] 先写测试：playing 之后 3000ms 隐藏、触摸重新显示、暂停/错误/面板/焦点时不隐藏、隐藏控件不可交互；首次引导只展示一次；面板滚动和控件操作不触发换台。
- [ ] 执行计时与播放器测试确认新行为缺失时失败。
- [ ] 复用源状态机和字幕；抽出浮层逻辑，手机返回/选台/线路/全屏均叠放在播放界面；删除常驻滑动提示和上下台按钮。当前分类首尾停留，换台旧回调隔离。
- [ ] 暂停与自动播放权限限制正确呈现；首次引导显式完成后保存。模态播放和面板有焦点管理、背景隔离与安全区。
- [ ] 执行播放相关测试及浏览器触摸/计时检查；审查后勾选。

## Task 5：回归、清理与交付

**文件：** `README.md`、`docs/DEPLOYMENT.md`、`index.html`、地图相关旧组件/依赖、锁文件、验证记录。

- [ ] 更新产品名、数据生成与部署说明，移除未使用的地图组件和 Mapbox 依赖；保留仍被数据同步使用的依赖。
- [ ] 执行 `npm test`、`npm run typecheck`、`npm run build`，修复由改版产生的回归。
- [ ] 浏览器验证首页、收藏、发现筛选、持续播放、手机滑动、首次引导、操作层 3 秒计时及键盘操作；真实外部线路或设备限制如实记录。
- [ ] 先进行规格符合性审查，再代码质量审查；解决可复现问题后重新验证。
- [ ] 更新本文件逐项勾选，只勾选有验证证据的事项。提交分支内实现，不自动合并或推送。

## 验证记录

实施过程中在此追加实际命令、结果、界面验证与限制。
