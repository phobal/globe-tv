# 地球电视 (Globe TV)

一个围绕世界地图浏览 IPTV 频道的前端项目. 应用以 Mapbox GL 渲染的 3D 地球作为入口, 按国家聚合频道, 选择国家后可在侧栏浏览频道列表并通过 video.js 播放 HLS (.m3u8) 直播源.

数据来自 [famelack/famelack-data](https://github.com/famelack/famelack-data) 的 `tv/raw` 目录, 由 `scripts/sync-tv.mjs` 在每次同步时校验、过滤、规范化后生成 `public/data/index.json`. GitHub Actions (`.github/workflows/deploy.yml`) 每天定时拉取上游最新提交, 若有数据变更会自动提交回仓库.

## 技术栈

- React 19 + TypeScript
- Vite 构建, Tailwind CSS 样式
- Mapbox GL (地球可视化)
- video.js (HLS 播放)
- Vitest (单元测试)
- Node.js 22

## 本地开发

环境要求: Node.js 22+, npm.

```bash
npm ci                 # 安装依赖
npm run dev            # 启动 Vite 开发服务 (默认 http://localhost:5173)
```

开发模式下应用直接读取仓库里的 `public/data/index.json`; 第一次克隆如果该文件不存在, 启动时会显示空数据, 需要先跑一次同步脚本.

### 同步频道数据

频道目录由上游仓库提供, 同步脚本会读取其中的 `metadata.json` 和各国频道文件, 校验格式、剔除无效或重复条目, 最终产出 `public/data/index.json`.

```bash
# 1. 拉取上游数据 (只需拉 tv/raw 子目录)
git clone --depth 1 --filter=blob:none --sparse https://github.com/famelack/famelack-data.git .upstream
git -C .upstream sparse-checkout set tv/raw

# 2. 执行同步, 将 .upstream/tv/raw 下的数据写入 public/data/
npm run sync -- .upstream
```

可选的第二个参数可以指定输出目录, 省略时默认写到 `public/data/`.

`scripts/make-geo.mjs` (`npm run geo`) 用于生成或更新与地图相关的离线资源, 一般情况下无需手动运行.

### 其它脚本

```bash
npm run typecheck   # tsc --noEmit, 仅做类型检查
npm test            # 跑一遍 Vitest 单元测试
npm run build       # 产出 dist/, 部署时使用
```

## 项目结构

```
src/                 应用源码 (app / globe / player / sidepanel 等)
scripts/             数据同步与离线资源脚本
public/data/         同步生成的频道目录 (index.json)
tests/               Vitest 测试用例
fixtures/            测试用固定数据
docs/                设计/开发文档
```

## 数据同步机制

`.github/workflows/deploy.yml` 在以下情况触发:

- `push` 到 `main` 分支
- 每天 03:17 (UTC) 定时执行
- 在 GitHub 网页上手动 `workflow_dispatch`

流程: 拉取上游 → 校验并生成目录 → 若 `public/data/index.json` 有变更, 自动以 `data: 同步 Famelack 上游完整目录 (<sha>)` 为消息提交回 `main`. 项目本身不再部署, 仅作为数据中转.

## 许可证

本项目源码按仓库内的许可证发布. 请注意, `public/data/index.json` 中的频道元数据与直播源链接来自上游仓库, 使用时需遵守其对应条款.
