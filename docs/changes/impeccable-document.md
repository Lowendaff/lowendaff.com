# Impeccable 现有设计系统归档

日期：2026-11-15。

## 已确认的描述

- 设计理念：全球服务器测试手记，突出真实记录与阅读。
- 气质：更强调轻松、亲近的博客感，测试证据保持严谨。
- 色彩名称：日光蓝、月光蓝、暮色灰；沿用既有 Tokyo 双主题色值。
- 层次：强调平整、安静的阅读背景，记录现有阴影，不把描述偏好当作删除阴影的授权。
- 组件：温和、清楚、顺手，像熟悉的博客。

## 交付

`DESIGN.md` 采用颜色、字阶、圆角、间距、组件 frontmatter 和八个规范章节。颜色保留源码中的 30 个浅深主题值；间距与圆角名称为文档别名，不宣称项目已有统一变量。

`.impeccable/design.json` 使用 schemaVersion 2，仅扩展色彩预览、阴影、动效、断点、组件 HTML/CSS 和叙述信息。8 个预览包括主次按钮、图标按钮、导航、标签筛选、友链卡、类型筛选与路由选择器。源码中的 CSS 变量带浅色回退，保留浅深主题绑定。

八级 OKLCH 色带仅为预览推导，不是已使用的生产色板；组件示例仅展示外观、hover/focus 和已选状态，完整筛选、主题与 combobox 行为继续复用生产组件，不把静态样例称为功能实现。

`PRODUCT.md` 仅补充用户此次确认的博客语气。AGENTS 和上下文索引增加文档入口。未更改站点源码、测评内容、Figma 或部署配置；只在当前分支本地提交，不推送。

## 来源与核验

图谱 generation 为 `2026-11-14T18:06:34Z`。已核对引用文件覆盖状态；`global.css` 标记为 parse_unusable，使用源码读取与浏览器计算样式核验，不据图谱推断其完整性。

重点来源为 `src/styles/` 下 global、editorial、compact、records、reading、directory、home、advertising、motion、review-map；组件来源为 BaseLayout、ThemeSwitcher、ReviewTypeFilter、HomeAds 与 RouteSelect。样式按实际导入顺序和选择器优先级理解，未把已被覆盖的旧尺寸当成当前设计。

本地采样包括 1440px 首页、文章、标签云、地图，以及 390px 首页与深色文章。采样未发现页面横向溢出；长文、宽表与标题使用不同字阶。静态采样不替代全量交互回归，也不证明线上状态。

验证范围包括 frontmatter 与 sidecar 结构、引用完整性、30 个色值与源码一致性、叙述一致性、预览片段的浅深主题渲染，以及仓库提交前规定检查。此处的结构检查不是官方 Stitch linter。回执与截图位于被忽略的 `test-results/impeccable-init/document-*`。

结果：上述结构检查及七项仓库检查全部通过；8 个组件在两种主题、两种宽度的 32 组预览中均保留焦点样式，没有页面横向溢出。预览友链卡桌面高度 72px、手机 64px，类型筛选不超出自身容器。已核对源文件摘要及提交差异，生产代码没有变化。当前安装目录未找到独立 `review` skill，本次使用逐项文档/源码比对与浏览器预览复核，不声称执行了该 skill。

## 持久化

- `viking://resources/projects/lowendaff-ui/DESIGN.md`
- `viking://resources/projects/lowendaff-ui/design.json`
- `viking://resources/projects/lowendaff-ui/impeccable-document.md`
- 产品语气同步至 `viking://resources/projects/lowendaff-ui/PRODUCT.md`。

全文写入需回读核对；语义索引排队不等于索引完成。设计文档和 sidecar 均应提交，预览、日志及本机临时文件不提交。
