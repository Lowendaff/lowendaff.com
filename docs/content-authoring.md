# 内容维护指南

## 数据归属

所有真实测评数据放在 `src/content/posts/*.mdx`。广告按位置放在 `src/content/ads/` 的四个子目录，Sponsors 放在 `src/content/sponsors/*.md`；页面和组件只读取集合、排版和处理交互。不要修改测试夹具或仓库外归档的旧 JSON 来更新页面。

Astro 在开发时监听内容，在构建时生成静态页面。Markdown 改动不是线上实时更新；部署后需重新运行构建并发布。无需修改 `.astro` 商家名单、数量或分组。

## 广告

四个位置分别维护，目录决定投放位置：

| 位置 | Markdown 目录 | 集合 / 组件 |
| --- | --- | --- |
| 首页 | `src/content/ads/home/` | `homeAds` / `HomeAds.astro` |
| 文章头 | `src/content/ads/article-top/` | `articleTopAds` / `ArticleTopAds.astro` |
| 文章尾 | `src/content/ads/article-bottom/` | `articleBottomAds` / `ArticleBottomAds.astro` |
| 文章侧边栏 | `src/content/ads/article-sidebar/` | `articleSidebarAds` / `ArticleSidebarAds.astro` |

一份 Markdown 只属于一个位置，例如 `src/content/ads/home/example-cloud.md`：

```yaml
---
name: Example Cloud
title: 探索云服务器方案
description: 查看地区、规格与产品信息。
url: https://example.com/products
tags: [云服务器, 多地区]
theme: indigo
enabled: true
order: 10
source: 商家素材来源或核验记录
---
```

- 不再填写 `placements`，旧字段会被 Schema 拒绝。把文件放入对应目录即可投放；根目录不放广告文件。
- 同一商家投放多个位置时，分别创建文件。各位置的文案、链接、主题、启用状态互相独立，不会联动；移动文件到另一目录即改变投放位置。
- `enabled: false` 或删除文件只移除该位置的广告，其他位置不受影响。
- `theme` 可选 `indigo`、`orange`、`teal`、`slate`，对应现有主题样式。
- `order` 只控制无 JavaScript 时的基础顺序，不提供优先曝光。每个文章位置独立随机排列；首页先随机，再连续循环。
- 首页零家时不渲染该区；一家时显示静态卡片；多家时显示两侧按钮并自动轮播。减少动态效果模式不自动播放。
- 商家、标题、简介、链接与标签均来自 Frontmatter；Markdown 正文可写维护备注，目前不向页面展示。

## Sponsors

```yaml
---
name: Example Cloud
url: https://example.com/
logo: example-cloud.svg
enabled: true
order: 10
placements: [article-sidebar]
source: 品牌授权或素材来源
---
```

把可信 SVG 放入 `src/assets/sponsors/example-cloud.svg`；`logo` 填文件名，不按 Sponsors 数组下标关联。使用 `fill="currentColor"` 或 `stroke="currentColor"`，由 `.sponsor-mark` 的主题色统一风格。缺少配置的 SVG 会让构建失败。当前仅提供文章侧栏位置；首页不显示 Sponsors。新增品牌需新建 Markdown 和对应素材，不改组件。

广告说明页的报价、组合套餐、权益、规则、联系方式统一编辑 `src/content/advertising/policy.md`。这不是商业排期或计费系统。

## 文章与历史目录

新文章从 [`VPS 模板`](../templates/reviews/vps.mdx) 或 [`独立服务器模板`](../templates/reviews/dedicated-server.mdx) 复制，详细用法见 [`模板说明`](../templates/reviews/README.md)。两者均使用 `format: review-markdown`，以 `reviewType: vps | dedicated` 区分。模板不在内容集合中，不会发布成文章。

文件名使用平铺 kebab-case，决定 `/reviews/<id>/`。最小原生 MDX 示例：

```mdx
---
kind: review
title: Example Cloud 测试记录
description: 本次实测的范围与条件。
vendor: Example Cloud
country: US
location: 美国
publishedAt: '2026-11-07'
testedAt: '2026-11-07'
route: 未分类
draft: false
specs:
  - label: 实测核心
    value: 按实际结果填写
---
import VpsSpecCard from '../../components/mdx/VpsSpecCard.astro';

## 配置

<VpsSpecCard specs={frontmatter.specs} />

在这里写真实测评正文与证据。
```

日期要加引号，避免 YAML 将其解析为日期对象。`draft: true` 从目录、文章路径、RSS、sitemap 和旧 URL 映射中排除。缺国家信息时 `country: ''`，标签显示未标注，不猜测地区。

当前两种历史测评格式共存：100TB 已试用下方易读格式；PanstarCloud 仍在 Frontmatter 的 `review.sections[].blocks` 中保存结构化数据，并通过原有 MDX 组件调用渲染。不要把旧格式字段复制到易读格式中。两者均受同一内容 Schema 校验。

### 易读测评格式与新文章模板

参考 `src/content/posts/100tb-cn2.mdx`，设置 `format: review-markdown`。正文直接写 Markdown，无需 import、JSX 或 `frontmatter.review`。集合加载器解析正文，再经过原有 Zod 校验；页面复用 FullReview 和原有页签、路由组件。

```markdown
## CPU 性能测试

| 测试项目 | 测试结果 |
| --- | --- |
| 单线程测试 | 按实测填写 |
| 多线程测试 | N/A |

## 服务解锁测试

### IPv4

#### AIGC

| 服务 | 状态 |
| --- | --- |
| 示例服务 | 按实测填写 |
```

- 一级或二级标题划分原有章节；三级标题表示分组，四级标题表示检测项。沿用样本章节名，不能跳级或重复顶层章节。路由分组沿用 `路由追踪 / 中国境内目标 / 北京电信…` 等现有语义，不靠模糊猜测。
- 表头和每行列数必须一致；每条结果占一行。保留 N/A、busy、空值，不能把缺失数据当作零。单元格中的竖线写为 `\|`；字面量星号写为 `\*`。
- 正文支持段落、加粗、行内代码、显式链接、单段引用，以及单独一段的图片。图片本地恢复信息可选填 `images`。另支持代码围栏及 `/archive-assets/` 本地图片；尚未扩展列表、多段引用、引用式链接和嵌入 JSX；不支持的块会报出文件与行号，不会默默丢弃。普通 MDX 模式不受此限制。
- 历史样本的 `compatibility` 只保存章节/表格旧 ID 和锚点映射，不含测评数值。它是迁移兼容信息，日常改数据无需动它；重命名已映射标题时要同步映射键以保留旧链接。新表格自动获得稳定 ID；同一路径多表按出现次序区分，优先给各测试设置不同标题。
- `showcase` 是组件展示页的可选样本配置，不是写每篇文章的必填项。`compatibility` 也不是新内容的必填项。新文章可删掉未测章节，无需历史来源 URL；目录和页签只显示实际内容。独服拓扑、SMART、dmidecode 等分别放系统和磁盘章节的子标题下。
- 真实正文和跑分仍全部在这份 MDX 中；历史 JSON 只用于迁移对照，不参与应用加载。Markdown 正文改动会更新开发页面；静态部署仍需构建发布。

运行 `npm run verify:readable` 检查解析规则；`npm run verify:markdown -- test-results/readable-mdx` 检查真实正文改动能否联动文章及组件展示页。后者会临时修改内容，结束后恢复，运行时暂停其他内容编辑。

只有目录信息时使用 `kind: archive-reference` 并提供 `archiveSnapshot`、元数据和证据路径。这类条目可在首页和标签云查找，但不生成虚构的本地全文、RSS 条目或 sitemap URL。补齐全文后改为 `review`。

## 组件展示页与检查

`showcase` 在文章内选择规格卡、终端摘要、路由和优惠样本。路由用 `tableId` 引用同篇文章的表格，修改原表即同步 UI Kit；不能引用其他 JSON。终端样本来自文章的 `showcase.terminal`。不要把真实规格、优惠码或跑分写回 `.astro`。

修改后运行 `npm run check && npm run build`。结构变化再运行 `npm run verify:markdown`；添加文章可运行 `npm run verify:pipeline`。它们会临时改动测试内容并在结束时恢复，执行期间暂停其他内容编辑。
