# SEO/GEO 验收与 100TB 文章恢复

日期：2026-11-09。用户取消百度接入，授权使用之前的 100TB 测评验证正式内容发布流程。只恢复这一篇，不恢复其他 41 篇记录，也不发布测试夹具。

## 来源与内容

- 从 `fffc851958062337469ff209b0be27b3a5081dce` 恢复 `src/content/posts/100tb-cn2.mdx`。正文保持原样，仍由 Content Collections 与易读 Markdown 解析器渲染。
- 明确 `reviewType: vps`，补全标题及事实性摘要，修正 evidence 指向 `tests/fixtures/wordpress/100tb.html`。保留原发布日期 2026-10-08、测试时间 2026-10-07 23:43 CST；未伪造新的测试或更新日期。
- 不恢复 `originalUrl`，避免生成旧 WordPress 地址跳转；`archiveSnapshot` 与离线证据保留来源信息，页面没有“对照原始快照”入口。
- 原始 HTML 的 SHA-256 与既有 manifest 一致：`80508cb7ba142d54c62c06c45356c8497ac6f9e91da1bcd4756606506f28db0a`。
- 原文 106 张表中，按既定要求排除 IP 质量分析，保留 105 张表、1,470 行正文数据、9,132 个含表头单元格及 25 段正文/引用。逐格、逐段对照通过；Generated at 不渲染。
- 两张图片此前即为 `provenance: unavailable`。测评配图源站及对应 Wayback 请求为 404，BGP 图对应 Wayback 请求也为 404。保持缺图提示，不把当前 BGP 服务的实时结果冒充历史测试证据。

## 线上抓取与 SEO/GEO

发布前基线是 `c834ce1363f59781e46bf8eb7bf817cea5465ceb`：

- 首页、广告页 HTTP 200，单个 H1、自引用 Canonical、description、OG/Twitter 与 JSON-LD 在静态 HTML 中存在；两页 `index,follow`。
- 空标签云、组件展示页 `noindex,nofollow`；不存在路径实际返回 404，HTTP 首页重定向 HTTPS。
- robots.txt 为 `User-agent: * / Allow: /` 并声明 Sitemap。llms.txt 返回 `text/plain; charset=utf-8`，中文可正确解码。
- Googlebot、bingbot、OAI-SearchBot、GPTBot、Claude-SearchBot、PerplexityBot 标识请求均返回 200。这只是从当前网络进行的 User-Agent 访问检查，不证明真实爬虫已来访、已收录或未来不会遇到限制。
- DNS A 记录直接指向服务器；读取 1Panel 站点 OpenResty 配置，未见该 server 块针对搜索爬虫的封禁。本轮没有修改 DNS、WAF 或服务器设置。
- 新构建的 Sitemap 和内容索引包含首页、广告、非空标签云、100TB 文章四个规范 URL；RSS 一篇。文章 BlogPosting、面包屑和 Sitemap lastmod 均使用真实元数据。购买链接具备 `rel="sponsored"`。
- 全部测试表格在初始 HTML 中，页签和路由选择器仅控制显示，不要求爬虫点击或执行脚本才能取得数据。

参考官方说明：OpenAI 的搜索与训练爬虫可分别控制；Google AI 搜索沿用基础 SEO，无需添加特殊 AI Schema。本轮保留现有开放策略，不为“GEO”添加虚构评分、关键词段落或训练限制。llms.txt 只是辅助目录，不承诺收录。

官方依据（本轮通过 HTTPS 读取，副本在忽略的验证目录）：

- https://developers.openai.com/api/docs/bots
- https://developers.google.com/search/docs/appearance/ai-features

## GA4 与浏览器验收

- 实际进入对应 `G-QJ1LPFHGL9` 的 GA4 媒体资源实时报告，观察到过去 30 分钟 5 位活跃用户、首页 11 次、广告页 2 次、`page_view` 13 次及 `user_engagement`、`scroll` 等事件。这些是当时窗口中的数据，不是本站长期统计，也不能用聚合数字判断单次访问是否重复上报。
- 首页仍有“尚未收到数据”的提示，但已加载完成的实时报告确实显示本站新标题和事件；没有据此改写统计代码。
- 本地静态文章桌面预览正常；CPU 页签显示原实测值 888.77，路由选择器通过键盘可从北京电信 163 切换到 CN2，表格随之更新。390px 预览保持手机布局，宽表在容器内滚动。
- 未执行新的现场 VPS 测试，未验证 Core Web Vitals 的真实用户数据，也未宣称文章已被搜索或 AI 引擎收录。

## 验证与发布回执

本地通过：Prettier、Astro check（85 文件、零错误/警告）、正式构建与 release、原文内容对照、10 项易读解析、4 项 SEO、6 项统计、12 项 IndexNow、双模式内容管线、Markdown 联动、类型筛选、两类模板与错误文章拒绝、11 项部署测试。夹具测试全部结束后重新构建正式内容。

通过既有 main → Content validation → Deploy static site → adnanh/webhook 发布；CI 上传前再次清洁构建。发布后核验公网 manifest、Sitemap、RSS、llms.txt、文章与 IndexNow 回执；实际提交 SHA、run ID、服务器版本和通知 HTTP 状态保存在 `test-results/seo-acceptance/deployment-receipt.json`，部署前不能用本地结果替代线上结果。

资料与日志：`test-results/seo-acceptance/`（Git 忽略）。OpenViking：`viking://resources/projects/lowendaff-ui/seo-acceptance-100tb.md`。全文写入及回读回执与异步索引状态分开记录。
