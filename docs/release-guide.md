# 本地构建与发布说明

## 默认预览

`npm ci && npm run check && npm run build` 生成 `dist/`。默认 `PUBLIC_SITE_INDEXABLE=false`：页面 noindex、robots 禁止抓取、sitemap 为空。RSS 仍供本地验证，包含两篇完整测评；40 条快照引用不冒充全文。

`npm run preview -- --port 4323` 查看构建结果。Astro 当前使用后台服务；查看/停止可用 `npx astro preview status`、`npx astro preview stop`，开发服务对应 `astro dev status/stop`。

## 生产发布前

1. 确认 `astro.config.mjs` 的 `site` 是实际域名；目前为 `https://lowendaff.com`。
2. 核验历史商业信息、Affiliate 披露与图片版权/缺失项，补齐需要发布的内容。
3. 使用 `PUBLIC_SITE_INDEXABLE=true npm run build`，随后 `npm run verify:release -- --indexable`。此开关只改变索引策略，不执行部署。
4. 发布 `dist/` 到选定静态主机。Markdown 修改后重新构建；无运行时 CMS、数据库或远程广告请求。
5. 核验实际 HTTP 状态、TLS、缓存和旧 URL。当前仅验证本地静态页面，未验证生产主机配置。

## 旧 URL

文章 `originalUrl` 映射到新 `/reviews/<id>/`。构建生成旧路径的 meta-refresh 回退和 `dist/_redirects`：当前两条旧文章路径加 `/feed/`，共 3 个目标、8 条兼容编码规则。支持 `_redirects` 的主机可使用该文件；Nginx 等需转换成自己的 HTTP 301 配置。静态回退不等于已部署的 HTTP 301。

正文 `review.legacyAnchors` 保存原 WordPress TOC 锚点映射，并处理单次/双次 URL 编码。不要随意改变已有文章 ID、原 URL 或块 ID。

## Figma 与调试脚本

Figma 捕获脚本仅在开发模式且 `PUBLIC_FIGMA_CAPTURE=true` 时输出；生产构建验证脚本会检查其不存在。临时启用：`PUBLIC_FIGMA_CAPTURE=true npm run dev`。已有后台服务需先正常停止再启动，结束后恢复默认开发服务。

画布只保留三个最新 Frame，代码映射见 `docs/stage-4-component-map.md`。更改可见布局后才重新同步对应视图，数据改动先验证 Markdown → 页面链路。官方 Code Connect 未发布，映射表不能称为自动同步集成。

## 回退与归档

Git 清理前的源码、文档和证据已完整归档至工作区外，校验摘要见 `docs/changes/git-preparation.md`，本机完整路径见 `test-results/git-preparation/backup.json`。恢复时解压到新目录，执行 `npm ci` 后核对页面，不直接覆盖现有内容。初始化 Git 后用提交与标签保存后续版本；构建产物、测试输出和本机工具配置不提交。
