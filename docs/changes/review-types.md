# VPS 与独立服务器类型区分

日期：2026-11-08。范围为用户选择的第 1 项；未实现置顶或优先级排序。

## 内容契约

唯一类型来源为文章 Frontmatter 的 `reviewType: vps | dedicated`。共享枚举与中文标签定义在 `src/lib/review-types.ts`，Content Collections Zod Schema 校验后由 `getRecords()` 供列表使用，文章布局直接读取集合数据。缺省兼容为 VPS；新文章须明确填写，未知值阻止构建。自由分类、商家、标题不参与类型推断。

文章模板和写作说明已更新。原有文章继续撤下，`src/content/posts/` 仅有 `.gitkeep`；没有恢复历史内容。

## 页面与交互

- 首页：测试记录下新增「全部 / VPS / 独立服务器」分段按钮，列表元数据展示类型。
- 标签云：同一类型按钮可与商家、国家交叉筛选；各标签数量反映其他已选条件。
- 文章：头部类型标签、面包屑和返回列表链接对应当前类型。
- URL 使用 `type=vps|dedicated`，刷新、前进后退可恢复。切换类型重置第一页，每页仍为 20 条，普通记录仍按日期排序。
- 组合无结果时显示空状态并允许清除全部筛选。无 JavaScript 时隐藏无效按钮并显示全部记录。

## 设计审查

沿用 Tokyo Night Day / Tokyo Night 语义色、现有列表密度与手工/系统主题机制。分段控件外圆角 12px、内圆角 8px、内距 4px；按钮至少 44px 高。选中态同时依靠底色、字重与 aria-pressed，类型有明确文字；支持 Tab、Enter/Space、方向键、Home/End。焦点恢复使用 preventScroll，现有分页尊重减少动效。

应用本地 Apple 设计与 Web Design Guidelines 技能；Figma 官方 MCP 只读取既有首页节点 `40:15217` 作为视觉参考，没有修改画布，本次新控件尚未同步至 Figma。

## 验证证据

- `npm run format:check`、`npm run check`：通过，0 errors / warnings / hints。
- 静态构建、`verify:types`、`verify:templates`、`verify:pipeline`、`verify:markdown`、`verify:release`：通过，内容变更测试串行执行。
- `verify:readable`：10 项通过。
- `verify:content`：旧文对照为 not-applicable，确认旧页面不存在，不宣称全文保真。
- 新回归使用 22 篇 VPS、3 篇独服和草稿夹具，验证缺省类型、错误类型拒绝、草稿隔离、列表/文章映射；结束后移除夹具并重建空站。
- Playwright：类型切换、20 条分页、URL/历史恢复、类型×商家×国家筛选、计数、清除与空状态、键盘和无 JS 均通过。
- 首页/标签云/文章页在 320、390、1440px 的 light/dark 共 18 个组合无横向溢出，浏览器无脚本错误；检查桌面暗色与移动亮色截图。
- `test-results/review-types/browser-report.txt` 保存报告；同目录保存截图与独立合成样本站。默认 dist 不含临时文章，RSS 为 0 项。
- 源码图谱未覆盖所需文件，已回退直接读取源文件；未将空图查询当成代码不存在的证据。

## 交付边界

交付包含源码、模板说明与验证脚本；用户已授权提交 GitHub，提交及远端核验以 `test-results/review-types/git-push-receipt.json` 为准。未部署，未改变广告集合和既有主题交互。

OpenViking 资源：`viking://resources/projects/lowendaff-ui/review-types.md`。写入后执行全文回读比对；回执保存在 `test-results/review-types/openviking-receipt.json`，语义索引完成状态不由写入成功推断。
