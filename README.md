# 频道台

一个免登录的在线频道播放器。打开「我的频道」可继续观看、整理收藏和查看最近播放；「发现频道」提供内容分类、全局搜索及来源筛选。手机播放页支持在当前分类内上下滑动切台，电脑播放时可同时浏览当前分类的频道。

收藏、顺序、最近观看和首次滑动引导保存在当前浏览器。频道目录来自 `public/data/category/*.json`，以稳定频道 ID 生成不含播放 URL 的 `public/data/discovery.json`。具体播放源按需从原分类文件加载。

## 本地开发

环境要求：Node.js 22+、npm。

```bash
npm ci
npm run dev
```

## 数据维护

修改 `scripts/discovery-mapping.json` 中的频道或来源分组映射后，运行：

```bash
npm run catalog
```

脚本读取分类 JSON、检查无效记录和重复 ID，重建分类索引与 `category-report.json`。每次生产构建前会自动执行此步骤。

从 IPTV 上游刷新频道及分类：

```bash
npm run sync:iptv
```

同步保留已有频道 ID，为新增频道生成稳定 ID，再重建发现索引和报告。自动同步工作流每天运行一次，检测并提交分类数据变更。

## 检查与构建

```bash
npm test
npm run typecheck
npm run build
```

构建输出到 `dist/`。应用使用 Video.js 播放 HLS；直播可用性取决于频道源与网络。
