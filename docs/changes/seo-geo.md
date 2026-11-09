# Sitemap、SEO 与 GEO

2026-11-09：用户明确要求「线上收录直接打开」。本轮通过既有 GitHub CI → Webhook 链路发布；最终提交、CI、服务器与公网回执保存在 `test-results/seo/deployment-receipt.json`，不以本地构建代替线上成功证据。

## 实现与约束

- `/sitemap.xml` 从已发布内容集合生成：首页、广告页、本地测评，以及存在本地测评时的标签页。排除草稿、组件展示、站外历史引用、筛选参数与重定向。文章 `lastmod` 使用 `updatedAt ?? publishedAt`，静态页不编造更新时间。
- 首页文案和布局保持既定设计，HTML title 明确描述 VPS 与独立服务器测试记录。共享布局统一 canonical、description、Open Graph、Twitter 卡片与中文 locale。
- JSON-LD 关联 Organization / WebSite / WebPage；文章增加 BlogPosting 与 BreadcrumbList。数据来自 Frontmatter，不添加虚构评分、Product Offer、作者资历、FAQ 或已删除的搜索入口。序列化转义 `<`，防止内容结束 script 元素。
- `updatedAt` 可选，在文章头部显示，Schema 拒绝早于发布日期；`authorUrl` 链接真实作者介绍；`coverImage` / `coverAlt` 支持分享卡片。未设置时分享使用站点头像，但不把头像当作文章实测图片。
- `/llms.txt` 动态提供阅读目录及引用边界，只有正式收录模式列出文章。正文仍是完整静态 HTML，AI 目录不替代测评内容。模板指南补充结论、条件、单位、工具版本、来源与限制；没有添加占位文章或旧网址迁移规则。

## 收录与发布

本地默认仍是预览。CI 仅对非 PR 的 main 构建读取仓库变量 `SITE_INDEXABLE=true`，映射为 `PUBLIC_SITE_INDEXABLE=true`。服务器读取服务环境 `LOWENDAFF_SITE_INDEXABLE`，要求与清单一致，并验证 HTML robots、sitemap 和 robots.txt。正式 robots 不屏蔽组件页，让爬虫读到其 noindex；组件页、空标签页不进入 sitemap。

修复夹具测试留下预览 dist 的问题：临时内容清理后，CI 按发布模式重建并校验，再生成清单上传。服务器先备份与更新安装器及 systemd 收录配置，再正常 CI 发布；不安装 Node/npm，不上传本地 dist。

## 验证

- Prettier、Astro check（74 文件、零错误/警告/提示）、正式构建与发布校验通过。
- 10 个 Markdown 解析器测试、4 个 SEO 测试、11 个部署测试通过；涵盖 JSON-LD 安全转义、实体关联、模式不一致拒绝、robots/sitemap 违规拒绝与跨模式回退健康检查。
- `verify:pipeline` 实际构建公开和预览模式，验证草稿隔离、静态正文、更新日期、RSS、sitemap 与 llms.txt；`verify:markdown` 验证四类广告和 Sponsors；两类模板与错误摘要/日期等负例通过。
- 当前空库正式构建有 2 个 sitemap URL，文章测试夹具全部删除。真实公开构建通过本地部署安装器验证。
- Playwright：首页、广告、标签云 × 390/1440px × 明/暗共 12 组，均 HTTP 200、一个 H1、规范 URL 与 JSON-LD 正确、无溢出与脚本错误。回执 `test-results/seo/browser-public.json`。

## GEO 边界与维护

GEO 以可抓取的真实正文、实体归属和可核验数据为基础。`llms.txt` 是可选目录，不是 Google AI 功能的必需文件，不保证 AI 引用或排名。没有测量平台曝光、引用率或实地 Core Web Vitals；空文章库不能证明文章排名改善。

通用 Allow 同样允许搜索型 AI 爬虫；本轮未另设模型训练策略。OAI-SearchBot 用于搜索，GPTBot 用于可能的模型训练，两者不能混为一谈。WAF 额外限制及平台实际抓取需查看对应日志。

发布后可在 Google Search Console / Bing Webmaster Tools 提交 sitemap，并通过 URL 检查核实抓取；本轮未操作这些账户，也未声称已收录。维护文章时填写实际作者和日期，正文实质变化才更新 `updatedAt`。

## 来源与持久化

已读取本机 seo、seo-sitemap、seo-schema、seo-geo，并通过官方规范核对；不沿用技能中未经验证的曝光统计。以下官方页面已通过终端成功读取，留存在 `test-results/seo/`：

- https://developers.google.com/search/docs/appearance/ai-features
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://platform.openai.com/docs/bots

OpenViking：`viking://resources/projects/lowendaff-ui/seo-geo.md`，以全文回读确认存储；语义索引完成与发布状态分别验证。
