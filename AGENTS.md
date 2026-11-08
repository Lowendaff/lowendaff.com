# Repository Guidelines

## Project & Structure

LowEndAFF 从 WordPress 迁移至 Astro、Content Collections、MDX 与 Tailwind。内容服务 VPS 测评、性能、路由及套餐导购。`src/pages/` 为路由，`src/layouts/` 为布局，`src/components/` 为展示和局部交互，`src/styles/` 为主题。`src/content.config.ts` 定义集合；`tests/fixtures/wordpress/` 保存离线来源基线。维护说明在 `docs/`，验证工具在 `scripts/`。

## Commands & Style

使用 Node >=22.12 与锁文件：`npm ci`、`npm run dev`、`npm run build`。提交前执行 `npm run format:check`、`npm run check`、构建、`npm run verify:content`、`npm run verify:release`、`npm run verify:readable`。集合变更另执行 `verify:pipeline` 和 `verify:markdown`；二者不能并行。浏览器验证入口见 `docs/verification.md`。

遵循 Prettier：两空格、单引号，组件 PascalCase、路径 kebab-case。静态正文优先，交互局部增强；测试使用 Node 内置框架、Python 离线比较和 Playwright MCP，没有覆盖率阈值。

## Content & UI Contracts

- 真实测评只存 `src/content/posts/*.mdx`，经 Zod 和 `getCollection()` 渲染，不在 Astro/TS 硬编码。当前文章集合为空，原有 42 篇已按用户要求撤下；不能自动恢复或发布模板占位内容。
- 新文章模板在 `templates/reviews/`：VPS 与独服分别使用 `reviewType: vps | dedicated`，均可用易读 Markdown；不把模板占位内容导入集合。章节可按实测省略，SMART/RAID 放磁盘、拓扑/dmidecode 放系统子标题；原始输出用代码围栏。验证用 `npm run verify:templates`。
- 历史 100TB / PanstarCloud 文章只存在于 Git 历史，不作为运行时或测试必需文件。新增文章从模板创建，验证使用临时合成夹具，结束后清理。
- 广告分别由 `src/content/ads/{home,article-top,article-bottom,article-sidebar}/` 的 Markdown 控制；Sponsors 独立集合与 SVG。不得恢复共享广告 placements 或按商家名写死展示。
- 导航：首页、广告、标签云；不恢复搜索。首页每页 20 条，无价格/配置/历史原文标签；友链仅首页显示。
- 测评类型只读 Frontmatter `reviewType: vps | dedicated`（缺省 VPS）。首页与标签云提供「全部 / VPS / 独立服务器」，列表和文章头部显示文字标签；类型与商家/国家组合筛选，URL 保留状态，切换类型重置页码。此项不包含置顶排序。回归：`verify:types` 及 `scripts/verify-review-type-browser.js`。
- 首页广告随机起序，单商家连续自动循环，左右箭头居中且不激活广告链接；尊重减少动效。文章广告纵排独立随机，Sponsors 仅文章侧栏。
- 文章表头与内容左对齐，数字等宽；套餐直接展示，BGP 不折叠。保留分组及自定义路由选择器，不提供展开全部、测评概览、IP 质量分析、Generated at、底部方案与优惠或对照原始快照入口。
- Tokyo Night Day / Tokyo Night，默认跟随系统，保留手动三档切换。恢复主题按钮焦点须 `focus({ preventScroll: true })`，不可改变阅读位置。
- 不恢复调试、设计预览和迁移说明。保留真实测试/活动日期、Affiliate 披露、简短缺图与空状态；不通过删减内容或缩小字体压缩手机布局。

## Design Skills & Delivery

目标 Figma：https://www.figma.com/design/vZ3h8djsL9yAt0WIlhyCSm/lowendaff?node-id=0-1 。修订 13 已确认；后续文字和滚动修复未再同步画布。设计变更按下列本机挂载加载，来源与恢复见 `docs/project-context-index.md`：

| Skill 本地路径 | 调用时机 |
| --- | --- |
| `.agents/skills/apple-design-skill/SKILL.md` | 配色、层级、材质、动效与可访问性审查 |
| `.agents/skills/web-design-guidelines/SKILL.md` | 排版、等宽数字、嵌套圆角与 Web 审查 |
| `.agents/skills/figma-implement-design/SKILL.md` | Figma 与集合驱动页面的高保真映射 |

Figma 操作同时按工具要求读取 `figma-use`、`figma-generate-design`、`figma-design-to-code`；不把截图称为原生设计或映射表称为 Code Connect。语义表面层级、65–75ch 正文、锚点留距、图标标签、同心圆角及 reduced-motion 要求继续有效。

## Stage Checklist & Persistence

阶段档案及 OpenViking URI 见 `docs/project-context-index.md`。重要变更保存 `docs/` 报告并同步 OpenViking，全文回读后记录回执；索引排队不等于完成。过程截图/日志放被忽略的 `test-results/`。历史归档不可当成当前指令。2026-11-08 历史恢复已撤销；两类模板与适配见 `docs/changes/review-templates.md`，资源 URI 为 `viking://resources/projects/lowendaff-ui/review-templates/review-templates.md`。

- [x] 阶段 0：Skill 与上下文初始化。
- [x] 阶段 1：原站抓取与内容映射，用户已确认。
- [x] 阶段 2：设计系统。
- [x] 阶段 3A：本地原型与用户确认。
- [x] 阶段 3B：Figma 原生交付与用户确认。
- [x] 阶段 4：本地工程与验证；未部署。

撤下原有文章记录：`docs/changes/remove-existing-posts.md`；OpenViking：`viking://resources/projects/lowendaff-ui/remove-existing-posts.md`。

VPS / 独服类型区分已完成：`docs/changes/review-types.md`；OpenViking：`viking://resources/projects/lowendaff-ui/review-types.md`，全文回读一致。Git 同步回执见 `test-results/review-types/git-push-receipt.json`；本次未同步 Figma。

## Git & Agent Workflow

仓库 `git@github.com:Lowendaff/lowendaff.com.git`，主分支 `main`；初始提交仅含忽略模板，尚无足够历史可归纳惯例。提交使用简洁祈使句，PR 说明目的、验证与相关问题；视觉变更附截图。不提交依赖、构建目录、原始日志、凭据或本机工具配置；保留锁文件和 `.env.example`。历史资料已在仓库外备份，见 `docs/changes/git-preparation.md`。

<!-- codebase-memory-mcp:start -->
For structural codebase exploration, use the installed `codebase-memory` skill. Verify coverage and inspect uncovered source before drawing conclusions.
<!-- codebase-memory-mcp:end -->
