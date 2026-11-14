# 全站 Impeccable 精修与验证

日期：2026-11-15。范围：测评文章、标签云、广告、测评地图、组件展示，并回归首页。按用户授权继续 audit → harden → optimize → document → polish → audit，仅本地修改；没有提交、推送、部署或同步 Figma。

## Audit：证据与取舍

以 PRODUCT.md、DESIGN.md、AGENTS.md 和实际渲染为依据。保留 Tokyo 双主题、轻松亲近的博客气质、集合驱动内容、四类独立广告和现有地图行为。

| 优先级 | 位置与实际问题 | 处理 |
| --- | --- | --- |
| P2 | 标签页沿用较大的标题、重筛选面板和列表外框，与已确认首页阅读方向不一致 | polish：页面标题统一到 30–40px；筛选用细线分区，列表平整化，保留所有筛选与 URL 状态 |
| P2 | 标签列表遇到连续英文长标题，390px 视口页面宽度可扩到 2,052px | harden：将首页已有换行规则移入共享列表规则，文章标题与正文同样允许长标识自然换行 |
| P2 | 组件页仍有旧标语、装饰编号；缺少优惠样本时留下空标题 | harden / polish：使用确认标语、修正标题层级、明确缺样本状态；色块与排版不再套装饰卡片 |
| P2 | BGP IPv6 缺图提示建议切换 IPv4，但当前记录 IPv4 图片也不可用 | harden：只陈述当前协议缺图，不承诺另一协议可用，不伪造补图 |
| P3 | 广告介绍页位置卡、合作须知有重复容器层级 | polish：保留位置示意与报价卡的细边框，去阴影；合作须知直接分节排版，商业事实不变 |
| P3 | 文章章节编号无实际阅读顺序含义；地图键盘操作缺少辅助说明 | polish：移除装饰编号，保留章节锚点和分组；增加屏幕阅读器说明，弹层类型按钮提升至 44px |

保留真实地点与线路元信息、国旗、商业披露、宽表滚动、手机点击目录及 Sponsors。文章头尾和侧栏广告继续纵向随机排列，没有改成首页轮播。地图继续使用已确认的抽象陆海与细国境线。

## Optimize：测量后保持克制

上轮的构建字体子集已覆盖全部页面，保留完整原始字体回退，本轮没有再引入依赖或删除字符。资源采样见 `before.json` / `after.json`。

地图的主要专属成本为 1,342,508 字节地理数据与约 559KB 地球模块（浏览器解码体积，非公网压缩传输量）；它们按需用于地图页。为保持明确国境线与交互精度，本轮不降级地理数据，也不以空白占位代替地球。没有宣称公网 CWV 或真实性能提速。

## Document / polish

DESIGN.md 与 `.impeccable/design.json` 同步页面标题尺度、平整列表/说明区、样本空状态及地图触摸目标。保留原有「日光蓝 / 月光蓝 / 暮色灰」命名与品牌语气。

调整已有 CSS，删除此次涉及的重复手机覆盖；列表长标题换行放入共享 `.home-revision .article-main`，没有再追加首页特例。配置卡、测试表等生产组件仍保持自己的信息分组。

同视口标签页第一条完整记录位置：

| 视口 | 修改前 top–bottom | 修改后 top–bottom |
| --- | --- | --- |
| 390 × 844 | 660.19–748.19px | 646.19–734.19px |
| 1440 × 900 | 750.64–838.64px | 684.64–772.64px |

浅深主题一致，没有缩小列表或文章正文。

## 验证

- 五个非首页页面：1440×900、390×844 浅深主题同视口前后截图；文章另有路由章节截图，地图另有弹层截图。
- 全部六页：320px、768px 浅深主题边界检查，没有横向页面溢出；主题切换保持阅读位置，手机导航 Escape 可关闭。
- 148 个代表性文字样本对比度通过；未把品牌图片、地理边界或渐变面当成纯色文字样本。
- 标签：键盘切换分类、类型/国家组合、空状态、清除、重载和浏览器前进/后退通过。
- 文章：105 张表、9,132 个单元格保留；76 个回程节点与16 个去程节点逐项切换、键盘、自定义选择器及 URL 恢复通过。无 JavaScript 时92 个路由结果可阅读；章节锚点位于导航下方。
- 地图：城市弹层的焦点、关闭恢复、类型空状态通过；实际触发 WebGL context lost 后仍能浏览文章，重新加载恢复地球。
- 动效：地图自转、悬停、键盘/弹层暂停、关闭恢复及减少动效通过；首页广告布局、按钮、完整自动循环、偏好切换通过。首轮并行浏览器运行中固定 750ms 的轮播状态断言失败，独立复测及随后整套复测均通过；没有因此修改轮播生产逻辑，保留 `motion.log` 与 `motion-recheck.log`，不将未复现解释为已证明的根因。
- 无 JavaScript：标签和地图均有文章入口，文章保留全部表格。连续英文商家和标题通过换行检查；没有改动实际内容。
- 工程：`format:check`、`check`、`build`、`verify:content`、`verify:release`、`verify:readable`、`verify:seo`、`verify:analytics`、`verify:fonts`、`verify:map`。结果以本轮日志为准。

## 最终 audit

实现一致性通过。检测器本轮范围从 26 条 advisory 变为 21 条 advisory，无主级警告；剩余为局部字号、圆角等量表提示，没有将其视为功能失败，也没有扩大改版来清零。

| 维度 | 分数 | 依据与限制 |
| --- | ---: | --- |
| 可访问性 | 3/4 | 采样对比度、键盘路径及可访问名称验证；不是完整辅助技术认证 |
| 性能 | 3/4 | 复用全站字体优化与按需地图加载；保留明确的地图资源成本，未测公网 CWV |
| 主题 | 4/4 | 两套主题、语义色及滚动保持通过 |
| 响应式 | 4/4 | 桌面、手机、窄屏与平板断点；长标题恢复自然换行 |
| 实现一致性 | 4/4 | 阅读优先，真实内容不变，设计文档同步 |
| 合计 | 18/20 | 仅适用于本轮范围与证据条件 |

浏览器证据来自本机独立无界面 Chrome 与模拟视口；没有覆盖物理手机、Safari / Firefox、完整屏幕阅读器或真实弱网。历史两张不可恢复图片仍明确显示缺图。

## 证据与归档

全部截图与日志在忽略目录 `test-results/all-pages-impeccable/`：`before.json`、`after.json`、`sections.json`、`interactions-after.json`、`hardening.json`、`contrast.json`、`review-routes.json`、`globe-motion.json`、`motion.json`、`checks.json`。`site-before/` 保存本轮修改前的静态产物。

- [标签页手机：前](../../test-results/all-pages-impeccable/before-tags-390-light.png) / [后](../../test-results/all-pages-impeccable/after-tags-390-light.png)
- [组件页手机：前](../../test-results/all-pages-impeccable/before-components-390-light.png) / [后](../../test-results/all-pages-impeccable/after-components-390-light.png)
- [文章路由桌面：前](../../test-results/all-pages-impeccable/before-routing-1440-dark.png) / [后](../../test-results/all-pages-impeccable/after-routing-1440-dark.png)
- OpenViking：`viking://resources/projects/lowendaff-ui/all-pages-impeccable.md`，设计文档沿用项目 `DESIGN.md` 与 `design.json` URI。
- 写入及全文回读以 `openviking-receipt.json` 为准；索引排队不等于已完成。
