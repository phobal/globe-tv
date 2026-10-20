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

## GitHub Actions 与静态托管

仓库 Actions 工作流每天同步一次目录，也可手动运行。上游数据有变化时，工作流提交 `public/data/category/`、`discovery.json` 和报告；应用本身可部署到任意静态托管服务，构建命令为 `npm run build`，产物位于 `dist/`。部署平台需将站点根路径配置为该产物目录，并允许带查询参数的静态链接。

目前工作流负责数据同步，不会自动发布站点。部署步骤取决于所选静态托管平台。

直播流由浏览器直接访问；具体播放效果取决于来源可用性、跨域策略与网络环境。更新来源后重新生成目录并部署即可。
