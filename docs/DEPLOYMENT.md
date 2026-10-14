# 本地运行与发布

## 本地原型

```sh
npm ci
npm run typecheck
npm test
npm run dev
```

仓库中的 `public/data` 是开发样例，只含中国真实频道文件及德国、美国两个空国家。它用于检查交互，不代表正式全量目录。`fixtures/famelack` 保存生成它的输入。生产构建会从 Famelack 仓库拉取完整上游数据并重新生成目录。

## 生成完整目录

```sh
git clone --depth 1 --filter=blob:none --sparse https://github.com/famelack/famelack-data.git .upstream
git -C .upstream sparse-checkout set tv/raw
UPSTREAM_SHA="$(git -C .upstream rev-parse HEAD)" npm run sync -- .upstream
npm run build
```

同步会校验国家文件与频道字段，过滤仅 YouTube 来源、重复地址及非 HLS 地址，重算国家收录数。输出 `public/data/sync-report.json` 记录跳过项目；索引包含上游提交 SHA。校验失败时脚本非零退出，保留上一次有效数据。不要把 `.upstream` 提交到本站仓库。

## GitHub Pages

1. 将仓库推送到 GitHub，默认分支设为 `main`。
2. 在仓库 **Settings → Pages → Build and deployment** 中，将 Source 设为 **GitHub Actions**。
3. 在 **Actions** 手动运行 **Sync and deploy Globe TV**，或推送到 `main`。之后工作流每日运行一次。
4. 构建先完成上游同步、类型检查和测试，全部成功后才将 `dist` 部署到 Pages。上游失败不会触发部署，旧站点继续保留。
5. 访问 `https://<账号>.github.io/<仓库名>/`。查询参数直达链接支持静态托管，无需服务器路由回退。

工作流使用 GitHub 官方 Pages Actions，无需额外凭据。尚未在作者中国大陆直连网络验证 Pages、地球资源和直播源；部署完成后按 `docs/validation/spike-results.md` 记录实际结果，再决定是否评估 Workers。

数据来源：[Famelack Data](https://github.com/famelack/famelack-data)。本项目在 `public/licenses/famelack-data-LICENSE.txt` 保留其 MIT 声明。直播流由浏览器直接访问，数据集许可证不说明具体直播源的播放权利或可用性。失效或投诉可通过删除对应频道源、重新同步及重新部署处理。
