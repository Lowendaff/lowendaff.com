# 文章阅读界面精修

日期：2026-11-09。用户授权同时处理三项审查发现，手机目录保持点击展开；实施阶段仅本地修改。验收后用户授权提交 GitHub 并观察现有 CI/Webhook 自动部署；实际提交、工作流与公网核验见 `test-results/ui-reading-polish/deployment-receipt.json`。未同步 Figma。

## 已完成

1. 目录提前到标题元信息之后、顶部广告之前。手机使用默认收起的原生 `details`，开关与章节链接至少 44px 高。桌面使用紧凑的横向章节导航，滚动时贴合 84px 页头；锚点结合全局 100px scroll-padding 与局部 56px scroll-margin，章节标题在导航底部约 18px 处显示。
2. 路由表增加主题滚动条及四向边缘提示。提示随滚动、窗口尺寸、线路和运营商切换更新；到达边界即消失，不拦截鼠标与触摸，表头继续固定。保留完整表格及原有可聚焦滚动区域。
3. 桌面运营商分组的数量从 10px 提升至 12px，使用等宽数字。手机继续隐藏数量徽标。

最初尝试把 sticky 目录直接移到侧栏广告之前，实测会遮挡广告，因此没有采用。最终将目录与侧栏分离，右侧 Sponsors 和七张广告随页面正常滚动，无新增侧栏滚动容器。顶部导航下方的正文正常经过导航背景。

## Skill 与实现

使用本机 unslop 和 Impeccable 4.8.1 的 Read / polish 规则，以审查证据限定范围；保留 Tokyo 双主题、广告 Markdown 数据及独立随机排序。修改涉及 `ReviewLayout.astro`、`RouteExplorer.astro` 与 `editorial.css`、`compact.css`、`reading.css`，移除弃用 sticky 目录样式。未修改文章集合与测评数据。

## 验证

- 格式检查、Astro 类型检查、静态构建、内容一致性与发布验证通过。Astro 检查为 0 errors / 0 warnings；1 个 hint 来自被忽略的旧审查脚本 `test-results/ui-review-b/contrast-correction.mjs`，不是产品源码。
- 100TB 保留 105 张表格、9,132 个单元格，原文保留段落一致。
- 独立 Chromium 复验覆盖桌面 1440/1000、手机 390/768 与浅深色；验证目录展开、章节跳转、路由表边缘状态、隐藏线路切换、表头固定、无页面横溢和脚本异常。四组主题切换实测阅读位置 1700→1700。
- 广告顶部 3、底部 4、侧栏 7，重复加载仍独立随机排序。侧栏旧方案的遮挡截图已明确否决，不作为最终证据。
- 最终 Impeccable 检测留下 1 个既有 `side-tab` 样式警告（`editorial.css` 既存 accent 边框）；不属于本轮三项修改，不据此扩大范围。
- 最终导航证据：`test-results/ui-polish-a/nav-recheck/latest-*` 和 `latest.json`；路由及手机交互证据：`test-results/ui-polish-b/`。未进行实体手机、辅助技术或其他浏览器引擎验收。

本地预览：`http://127.0.0.1:4321/reviews/100tb-cn2/`。

OpenViking：`viking://resources/projects/lowendaff-ui/ui-reading-polish.md`。全文回读与索引状态见被忽略的 `test-results/ui-reading-polish/openviking-receipt.json`；索引排队不等于完成。
