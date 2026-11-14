# 首页审查修复与验证

日期：2026-11-15。用户授权依次使用 Impeccable 自主推进；本轮完成 harden → optimize → document → polish → audit，全部保留本地，未提交、推送、部署或同步 Figma。

## 1. Harden

依据 `.agents/skills/impeccable/reference/harden.md`，处理上一轮已复现的问题：

- `index.astro` 的 Telegram 链接名称包含完整可见标题「在 Telegram 关注更新」，保留 LowEndAFF 身份与新标签页提示。
- `HomeAds.astro` 在 transform 动画和原生滚动之间双向同步商户索引；原生滚动更新活动状态，动画中途切换动效偏好时落在最近的一张。保留随机起序、单商户、自动循环、箭头、暂停与恢复规则。
- 新增 `scripts/verify-carousel-motion-preference.js`，覆盖手机/桌面、双向偏好切换、原生滚动同步和循环动画中断后的继续操作。

## 2. Optimize

依据 `.agents/skills/impeccable/reference/optimize.md`，以生产构建的真实请求数据定位字体开销。

新增 `scripts/site-font-subsets.mjs` 构建插件。每次构建从 `src/` 文本源码收集字符，为锁定版本的 Noto Sans SC 分片生成内容哈希子集，保留 100–900 可变字重、排版特性及原有许可元信息。新增开发依赖 `subset-font` / `fontverter`；不增加浏览器运行时或服务器软件要求。

优化声明追加在原字体声明之后，原始字体及其完整 Unicode 范围保留为回退；转义字符串、运行时新字符、未来内容不会因子集缺字失去原字体。开发服务器使用原始字体，正式构建自动优化；`.astro/font-subsets/` 为忽略目录。发布字体许可位于 `public/fonts/OFL-NotoSansSC.txt`。

测试发现只含空白/格式字符的子集可能具有空 `glyf` 表，Chrome 会拒绝解码。插件现检查真实 OpenType 轮廓表，这种情况沿用原始字体；对应真实字体回归已加入 `npm run verify:fonts`。没有将异常字体交付为最终产物。

本地冷页面、相同随机种子、字体全部加载完成后测量：

| 指标 | 修改前 | 修改后 |
| --- | ---: | ---: |
| 390px 独立字体请求 | 16 / 887,316 B | 12 / 254,456 B |
| 1440px 独立字体请求 | 17 / 927,720 B | 13 / 294,860 B |
| 共享 CSS 原始大小 | 200,350 B | 238,282 B |
| 手机字体请求 + CSS | 1,087,666 B | 492,738 B（减少约 55%） |
| 桌面字体请求 + CSS | 1,128,070 B | 533,142 B（减少约 53%） |

Vite 将小字体嵌入 CSS，因此独立字体字节不是全部字体开销；上表合计已包含这些内嵌资源。CSS 的 gzip 本地估算为 63,149 → 86,190 B；这不是公网传输或真实用户 CWV 测量。共享样式仍包含其他页面规则，本轮优先解决已量化的大头，不根据首页默认状态覆盖率盲删规则。

## 3. Document

依据 `.agents/skills/impeccable/reference/document.md`，按用户本轮逐步推进授权更新现有设计文档，沿用此前确认的品牌描述：

- `DESIGN.md` 的首页字号、字重、行高、字距与当前实现一致。
- 友链由卡片条目更新为轻量链接行，说明标题、关注入口、广告与地图的现有布局。
- 同步 `.impeccable/design.json` 的组件示例及生成时间；未改动 Tokyo 色板、产品定位或原有视觉哲学。
- `docs/verification.md` 记录新字体检查与轮播回归入口。

## 4. Polish

依据 `.agents/skills/impeccable/reference/polish.md` 与 `craft-floor.md` 进行整条路径复查，不追加装饰性改版。critique-storage 返回 2，表示没有可处理的当前快照；未关闭任何未读取快照。

390×844 / 1440×900，分别对照浅深主题。固定广告随机种子，仅截图对比排除动态地图区域：手机两套主题与桌面浅色像素完全一致；桌面深色仅 9 个像素有 1/255 的通道差异。首条完整记录仍为手机 633.17–713.17px、桌面 636.78–712.78px。

八种视口/主题组合（320/390/768/1440，两套主题）无页面横向溢出。文章入口、筛选 URL、空状态清除恢复、手机菜单 Escape、焦点可见、真正鼠标点击主题菜单的滚动保持均通过。无 JS、字体请求失败及 DOM 字体 200% 放大模拟仍可进入文章且无横向溢出；该模拟不等同于真实浏览器缩放认证。

轮播四组回归通过：布局、按钮、完整自动循环、偏好切换。Chrome 合成触摸可操作箭头及减少动效模式下的原生滑动，之后仍可继续切换。没有验证物理手机、Safari/Firefox 或完整屏幕阅读器流程。

字集外字符「龘」实际加载原始 Noto 分片，CDP 确认使用自托管字体。首页、文章、标签、广告、地图、组件展示六页均无字体加载失败。

## 5. Final audit

依据 `.agents/skills/impeccable/reference/audit.md`。实现完整性通过；上轮四项发现均已处理，未发现新增 P0/P1/P2 待修复项。

| 维度 | 分数 | 依据与保留限制 |
| --- | ---: | --- |
| 可访问性 | 3/4 | 名称已统一；采样文字对比度通过，未作完整辅助技术认证 |
| 性能 | 3/4 | 字体与 CSS 合计显著降低；仍保留完整回退及共享样式，未测公网 CWV |
| 主题 | 4/4 | 两套主题与滚动保持检查通过 |
| 响应式 | 4/4 | 已测视口、合成触摸、偏好切换及降级路径通过 |
| 实现一致性 | 4/4 | 内容驱动结构保持，设计文档与本轮实现同步 |
| 合计 | 18/20 | Excellent；仅适用于本轮范围与验证条件 |

检测器剩余 37 条提示（36 advisory、1 warning）。已按选择器与既有约束核对：主要为量表未逐项记录的局部尺寸、非首页规则、已确认 Inter 字体。未将其当成 37 个功能缺陷，也未为消除提示修改既有视觉。首页线路图的动效偏好特例按用户约束保留；本报告不宣称全站 WCAG 完全合规。

工程检查通过：`format:check`、`check`、`verify:fonts`、`build`、`verify:content`、`verify:release`、`verify:readable`、`verify:seo`、`verify:analytics`。Astro check 为 0 errors / 0 warnings，另有本机验证脚本相关 hints。未修改测评正文、广告数据、友情链接、URL 或 CI/部署流程。

## 证据与持久化

- 本地证据：`test-results/homepage-follow-through/`，含基线备份、同视口前后截图、`measure.json`、`visual-diff.json`、`carousel.json`、`font-fallback.json`、`resilience.json`、`final-browser.json`、`final-followup.json`、`final-contrast.json`、`detector-final.json`、`final-checks.json` 与 `build-final.log`。
- [手机浅色修改前](../../test-results/homepage-follow-through/before-390-light.png) / [修改后](../../test-results/homepage-follow-through/after-390-light.png)。同目录保存手机深色及桌面两套主题。
- OpenViking 报告 URI：`viking://resources/projects/lowendaff-ui/homepage-audit-follow-through.md`。
- 设计文档 URI：`viking://resources/projects/lowendaff-ui/DESIGN.md` 与 `viking://resources/projects/lowendaff-ui/design.json`。
- 写入与全文回读结果以 `test-results/homepage-follow-through/openviking-receipt.json` 为准；资源写入/回读不等于语义索引完成。
