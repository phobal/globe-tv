# 本地运行与数据同步

## 本地开发

```sh
npm ci
npm run typecheck
npm test
npm run dev
```

应用按类别和来源分组浏览频道。`public/data/category/*.json` 保存可播放目录；构建时 `npm run catalog` 会从中生成不含线路 URL 的 `public/data/discovery.json` 摘要索引与分类报告。播放器只在用户选择频道后加载对应分组文件。

## 同步 IPTV 数据

```sh
npm run sync:iptv
```

同步会从配置的 IPTV 上游刷新分类频道，保留已有频道 ID、为新频道生成稳定 ID，并重建发现索引与分类报告。分类归属和来源分组映射维护在 `scripts/discovery-mapping.json`。也可直接运行 `npm run catalog` 重建索引。

## Cloudflare Workers 部署

项目使用 `wrangler.jsonc` 将 Vite 静态资源和 HLS 代理部署到同一个 Worker。静态文件由 Workers Static Assets 提供，只有 `/proxy` 会执行 Worker 脚本。构建时会从 `public/data/category/*.json` 生成 `public/data/proxy-origins.json`；代理只接受这些播放源中的协议、主机和端口组合，并会重新校验上游重定向。

Cloudflare Workers 的子请求不支持直接 `fetch()` IP 字面量。代理会把白名单内的 IPv4 源站映射到对应的 `sslip.io` 主机名再回源，例如 `61.138.99.166` 会请求 `61-138-99-166.sslip.io`；客户端播放地址和重写后的分片地址仍使用原始源站 URL。该做法依赖公共 `sslip.io` DNS 服务，并会让源站看到这个别名作为 HTTP Host。若某个源站要求特定 Host，需要为它增加显式的自有 DNS 别名映射；此处已验证的频道 85 接受 `sslip.io` 别名。

本地开发时 Vite dev server 已内置 HLS 代理，直接运行即可获得与线上一致的播放能力：

```sh
npm run dev
```

`vite.config.ts` 中的 `hlsProxyDevMiddleware` 会拦截 `/proxy` 请求，复用 Worker 的 `createHlsProxyHandler`，白名单读取 `public/data/proxy-origins.json`，回源行为（含 sslip.io 别名）与线上一致。因此本地前端改动即时生效，无需重新构建。

需要预览真实的 Worker 运行环境（ASSETS 绑定、Cloudflare 运行时）时再使用：

```sh
npm run dev:worker
```

部署到 Cloudflare Workers：

```sh
npm run deploy:worker
```

命令需要本机已登录 Wrangler（可先运行 `npx wrangler login`）。部署后可使用 Worker 的 `workers.dev` 地址，也可在 Cloudflare Dashboard 为该 Worker 配置自定义域名。应用页面和 `/proxy` 同源，因此播放器请求 HTTP 上游时不会触发浏览器的 CORS 或 HTTPS 混合内容拦截。

Workers Free 当前限制为每天 100,000 次 Worker 请求；HLS 每个分片都会计为一次请求，额度由账号下的 Worker 共用。`/proxy` 是公开 HTTP 路由，没有用户登录保护；上游主机白名单限制了它能访问的站点，但知道部署地址的人仍可消耗额度。仅将地址用于个人或小范围访问，并留意 Cloudflare 对视频分发的服务条款。

## GitHub Actions 与静态托管

仓库 Actions 工作流每天同步一次目录，也可手动运行。上游数据有变化时，工作流提交 `public/data/category/`、`discovery.json` 和报告；应用本身可部署到任意静态托管服务，构建命令为 `npm run build`，产物位于 `dist/`。部署平台需将站点根路径配置为该产物目录，并允许带查询参数的静态链接。

目前工作流负责数据同步，不会自动发布站点。Cloudflare Workers 部署使用上方的 Wrangler 命令。其他静态托管平台不会自动提供 `/proxy` 路由（Worker 部署和本地 `npm run dev` 都有）；将构建变量 `VITE_HLS_PROXY=false` 后可以继续直连播放源，但播放效果会受到源站 CORS 和 HTTPS 支持影响。

更新来源后重新生成目录并重新部署即可；Worker 使用构建生成的最新上游来源清单。
