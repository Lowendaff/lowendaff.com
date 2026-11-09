# IndexNow 自动通知

日期：2026-11-09。

## 目标与实现

用户确认在 Google / Bing 站长平台接入完成后继续实施 IndexNow。配置集中在 `src/config/search-engines.json`，保留静态站架构；CI 生成验证文件与内容指纹，Webhook 发布后核验公网版本，再向官方端点提交新增、更新和删除页面。

主要文件：`scripts/build-search-index.mjs`、`scripts/indexnow-core.mjs`、`scripts/notify-indexnow.mjs`、`scripts/verify-indexnow.mjs`。`create-deploy-manifest.mjs` 记录索引摘要；发布校验检查索引与 Sitemap 完全一致。`parse5` 为构建阶段 HTML 解析依赖，无额外浏览器脚本。

通知失败保留队列，不回滚发布；`indexnow-state` Actions 产物保留 90 天。手动运行 Deploy static site 只重试通知。索引过期恢复、202 含义与网络重复通知边界见 `../search-engines.md`。

## 验证与发布证据

本地覆盖：配置拒绝、URL 范围、纯样式变化、正文/链接/图像变化、新增修改删除、失败队列保留、构建版本不一致、200/202、429/5xx、批次上限与预览隔离。原有格式、Astro 类型、SEO、统计、内容及部署回归继续执行。

实际提交、CI、Webhook 发布、公网索引与 IndexNow HTTP 回执以被忽略的 `test-results/indexnow/deployment-receipt.json` 为准。仅有本地测试不能声称远端已接收。

## 持久化

OpenViking：`viking://resources/projects/lowendaff-ui/indexnow.md`。最终写入与全文回读证据保存于 `test-results/indexnow/openviking-receipt.json`。语义索引排队不等于完成。
