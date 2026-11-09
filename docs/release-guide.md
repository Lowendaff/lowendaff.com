# 本地构建与发布说明

## 默认预览

`npm ci && npm run check && npm run build` 生成 `dist/`。默认 `PUBLIC_SITE_INDEXABLE=false`：页面 noindex、robots 禁止抓取、sitemap 为空。当前文章集合为空，RSS 没有文章；不能自动恢复历史文章或导入模板占位内容。

当前服务器通过 GitHub Actions 构建产物与 adnanh/webhook 部署，已完成 HTTPS 演练，操作见 `deployment.md`。服务器不安装 Node/npm。main 的成功构建会自动发布，PR 不发布。

`npm run preview -- --port 4323` 查看构建结果。Astro 当前使用后台服务；查看/停止可用 `npx astro preview status`、`npx astro preview stop`，开发服务对应 `astro dev status/stop`。

## 生产发布前

1. 确认 `astro.config.mjs` 的 `site` 是实际域名；目前为 `https://lowendaff.com`。
2. 核验历史商业信息、Affiliate 披露与图片版权/缺失项，补齐需要发布的内容。
3. 正式收录使用 GitHub 仓库变量 `SITE_INDEXABLE=true`，并先安装兼容部署程序、将服务器服务环境 `LOWENDAFF_SITE_INDEXABLE=true`。步骤见 `deployment.md`；CI 自动读取模式并校验，不再手改工作流中的验证参数。本地 `PUBLIC_SITE_INDEXABLE=true npm run build` 只生成文件，不会部署。
4. 通过 main 的成功 CI 产物发布。Markdown 修改后重新构建；无运行时 CMS、数据库或远程广告请求。
5. 核验实际 HTTP 状态、TLS、缓存和 `deployment.json` 中的提交。演练验证记录见 `changes/deploy-rehearsal.md`。

## 路由范围

`/sitemap.xml` 自动列出首页、广告页和已发布本地测评；有本地测评才列出标签页。文章日期来自 `updatedAt` / `publishedAt`；静态页面不编造更新时间。草稿、组件展示、重定向、筛选参数与站外历史引用不进入 sitemap。`/llms.txt` 是可选的 AI 阅读目录，不是收录承诺，正文 HTML 才是完整内容来源。正式模式的 robots 允许抓取页面，让爬虫能够读取被排除页面的 noindex。

按用户决定，新站从零开始，不实施旧文章网址迁移，也不添加旧站 HTTP 301 规则。当前构建保留已有 `/feed/` 到 `/rss.xml` 的静态回退；`dist/_redirects` 不会被 OpenResty 自动解释为配置。文章撤下后不存在历史文章页面。

## Figma 与调试脚本

Figma 捕获脚本仅在开发模式且 `PUBLIC_FIGMA_CAPTURE=true` 时输出；生产构建验证脚本会检查其不存在。临时启用：`PUBLIC_FIGMA_CAPTURE=true npm run dev`。已有后台服务需先正常停止再启动，结束后恢复默认开发服务。

画布只保留三个最新 Frame，代码映射见 `docs/stage-4-component-map.md`。更改可见布局后才重新同步对应视图，数据改动先验证 Markdown → 页面链路。官方 Code Connect 未发布，映射表不能称为自动同步集成。

## 回退与归档

Git 清理前的源码、文档和证据已完整归档至工作区外，校验摘要见 `docs/changes/git-preparation.md`，本机完整路径见 `test-results/git-preparation/backup.json`。恢复时解压到新目录，执行 `npm ci` 后核对页面，不直接覆盖现有内容。初始化 Git 后用提交与标签保存后续版本；构建产物、测试输出和本机工具配置不提交。
