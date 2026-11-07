# 阶段 4：Figma、Astro 与内容映射

2026-11-07。视觉基线为修订 13，Token 0.13.0。文件 `vZ3h8djsL9yAt0WIlhyCSm`；仅保留 UI Kit `40:15216`、首页 `40:15217`、文章 `40:15218` 三组顶级 Frame。完整节点表和变量 ID 见 `stage-3-component-map.md`，本文件补充最终工程的数据来源。

| Figma / 页面 | Astro | 内容来源 |
| --- | --- | --- |
| 首页 Desktop `40:15220` / Dark `44:1567` | `pages/index.astro` | `getCollection('posts')` → `getRecords()` → `RecordList` |
| 首页 Mobile `40:15845` / Dark `44:1986` | 同上，CSS 响应式 | 同一集合与分页，不复制手机数据 |
| 文章 `40:16417` / Dark `44:2373` | `pages/reviews/[id].astro` → `ReviewLayout` | `getPublishedPosts()` → `getCollection('posts')` → 易读格式由 `FullReview` 渲染，原生 MDX 由 `render(post)` 渲染 |
| RecordRow `40:18273` / `40:18589` | `RecordList.astro` | Markdown 标题、国家、地区、日期与类别 |
| VpsSpecCard `40:18923` | `components/mdx/VpsSpecCard.astro` | 文章 `specs`，UI Kit 通过 `showcase.specs` 选样本 |
| BenchmarkTerminal `40:18976` | `components/mdx/BenchmarkTerminal.astro` | 文章 `showcase.terminal` 规范化摘录 |
| RouteTraceTable `40:19238` | `components/mdx/RouteTraceTable.astro` | 文章 `showcase.route.tableId` 引用 `review.sections` 原表 |
| PromoCodeBox `40:19025` | `components/mdx/PromoCodeBox.astro` | 文章 price / coupon / purchaseUrl / startingPrice / terms |
| 首页广告横幅 | `ads/HomeAds.astro` → `getAds('homeAds')` | `content/ads/home/*.md` |
| 文首广告 | `ads/ArticleTopAds.astro` → `getAds('articleTopAds')` | `content/ads/article-top/*.md` |
| 文尾广告 | `ads/ArticleBottomAds.astro` → `getAds('articleBottomAds')` | `content/ads/article-bottom/*.md` |
| 文章侧栏广告 | `ads/ArticleSidebarAds.astro` → `getAds('articleSidebarAds')` | `content/ads/article-sidebar/*.md` |
| Sponsors | `archive/Sponsors.astro` → `getSponsors()` | `content/sponsors/*.md`，logo 明确关联本地 SVG |
| 广告说明页 | `pages/ads.astro` | `getEntry('advertising', 'policy')` |

三种文章广告入口共用纯展示组件 `ads/AdStack.astro`，通过 props 传入各自数据；共享样式和随机排列行为，不共享内容。2026-11-07 广告拆分只更新源码映射，未改 Figma 画布。

## 实际链路

历史快照 → 已核验 MDX 内容 → Zod Schema → Content Collections → 静态 HTML → 浏览器局部交互 → 官方 Figma 捕获校验。`src/lib/review-model.ts` 只转换分组；不包含任何商家、真实规格、价格或测试数据常量。100TB 的正文与表格现为普通 Markdown，`postsLoader()` → `parseReadableReview()` → Zod → 相同的 `review` 数据模型；PanstarCloud 仍用原有 Frontmatter。普通 MDX 文章可直接撰写段落并调用组件。

Astro 7 使用 `src/content.config.ts` 与 glob loader；`src/content/config.ts` 是早期方案路径，未与新配置并存。没有为静态正文引入 React 水合；轮播、页签、路由选择器和主题偏好通过局部浏览器脚本增强，禁用 JS 仍可访问基础内容。

## 已完成的 Figma 校验（2026-11-07）

以 Markdown/MDX 驱动的本地 `/`、`/reviews/100tb-cn2/`、`/components/` 执行官方 `generate_figma_design`。捕获根 `55:1444`、`56:1444`、`54:1444` 曾用于内容校验，随后移除，避免重复交付。捕获时浏览器宽 1512px；其结果用于来源与内容核对，不声称是 1440px 全像素相等证明。

保留原生 1440/390px 设计及既有组件、变量。UI Kit 的示例延迟由合成 `23.45 ms` 更新为真实表格中的 `151.11 ms`，修改节点 `40:17513` / `44:3454`，复制自本轮捕获文本。首页/文章没有设计重排。捕获截图及写入/清理回执已归档至仓库外，见 `changes/git-preparation.md`。

画布表达默认可见状态；186 个路由目标和其余隐藏表格以 Astro 源码/页面为准。此文档是人工核对的映射，不是已发布的 Code Connect 集成。

主题滚动修复与页面辅助文字清理随后仅修改本地代码，未再次同步 Figma。当前页面以源码为准，不将早期截图等同于最新版本。
