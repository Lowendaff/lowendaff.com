# 搜索引擎站长平台接入

日期：2026-11-09。范围：Google Search Console、Bing Webmaster Tools 的站点访问与 Sitemap 提交，以及用户授权的旧 Sitemap 清理。

## 已完成与验证结果

| 平台                  | 站点资源                           | 当前 Sitemap                        | 最后读取   | 状态    | 发现页面 |
| --------------------- | ---------------------------------- | ----------------------------------- | ---------- | ------- | -------- |
| Google Search Console | 网域资源 `sc-domain:lowendaff.com` | `https://lowendaff.com/sitemap.xml` | 2026-11-09 | 成功    | 2        |
| Bing Webmaster Tools  | 已有 `https://lowendaff.com/` 站点 | `https://lowendaff.com/sitemap.xml` | 2026-11-09 | Success | 2        |

- Google：用户完成 Cloudflare 域名验证流程；DNS 已存在 Google 所有权 TXT 记录，控制台可访问。记录应保留，不需要写入 Astro 组件。
- Bing：用户完成 Microsoft 登录；账号已拥有目标站点，无须重新导入 Google Search Console 或新增跨平台数据授权。
- 两边分别提交并核对最终列表：均只有当前 Sitemap 一条。Bing 错误和警告数量均为 0。
- 公网 `curl -fsS https://lowendaff.com/sitemap.xml` 返回有效 XML，列出首页和 `/ads/`，与平台发现的 2 个页面一致。
- 平台最初显示旧抓取日期与结果，随后均更新至 2026-11-09 并成功。不能将旧统计误判为本轮抓取失败。
- 成功读取 Sitemap 不等于所有页面已经收录，也不代表排名或 AI 引用效果已验证。

## 已授权的旧记录清理

用户明确要求删除旧站数据。本轮按当前讨论范围，从两家平台删除以下三条旧 WordPress Sitemap 提交记录：

- `https://lowendaff.com/page-sitemap.xml`
- `https://lowendaff.com/post-sitemap.xml`
- `https://lowendaff.com/sitemap-misc.xml`

清理后 Google 显示共 1 行；Bing 显示 Known sitemaps 为 1。保留当前域名资源与 `sitemap.xml`。没有提交全站搜索结果移除申请，也没有删除站长账号或搜索表现历史。

## 后续维护与待办

1. 保留域名验证记录。当前使用 DNS 与已有 Bing 站点权限，无须为本轮新增验证标签或配置文件。
2. 正式文章仍由本地 Content Collections 驱动 Sitemap；不能为了增加链接数量发布测试夹具或恢复已撤下文章。
3. 百度搜索资源平台、IndexNow 自动通知、其他搜索引擎和 AI 爬虫专项检查尚未执行。
4. IndexNow 如后续接入，应在正式发布确认成功后通知实际变化的 URL，不以构建完成替代发布成功。
5. 本轮没有修改运行时代码、提交 Git 或重新部署站点。

## 归档

本地：`docs/changes/search-console-onboarding.md`。

OpenViking：`viking://resources/projects/lowendaff-ui/search-console-onboarding.md`。全文写入与回读回执见被忽略的 `test-results/search-console/openviking-receipt.json`；语义索引状态单独判断。
