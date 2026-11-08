# 设计细节优化

日期：2026-11-08。基线提交：`be9c813face24b0a950ee38f40fb778baed0f1b3`。本轮为代码细节修订，未部署或同步 Figma。用户随后确认提交 GitHub，确切提交与 CI 状态见 `test-results/design-polish/git-ci-receipt.json`。

## 范围与依据

用户指定 Taste Skill 与 Impeccable，并要求「不要为了修改而修改」。以现有 Tokyo Night Day / Tokyo Night 阅读站点为基础，检查首页、标签云、广告页及共享导航和页脚。优先处理有实际影响的空状态、点击行为、触达面积和冗余文字。

| 来源 | 本地入口 | 固定版本 |
| --- | --- | --- |
| https://github.com/leonxlnx/taste-skill | `.agents/skills/taste-skill-source/skills/taste-skill/SKILL.md` | `f6b76575f949707b4e3c37cd86cb44b0b98643e8`，2.5.1 |
| https://github.com/pbakaus/impeccable | `.agents/skills/impeccable-source/plugin/skills/impeccable/SKILL.md` | `924bbd194d02e5e15a227e75b5901fb0d7a4ecad`，4.8.1 |

读取 Taste 系统规则与 Impeccable 的 polish、operate、mode-read、craft-floor。Impeccable context 返回 `SCOPED_EXISTING_ALLOWED`，允许依据既有产品做局部优化；没有为检查器新建产品框架、引入依赖或改动本机配置。辅助参考现有 Web Guidelines、Apple 按钮/焦点规范和 Figma 首页节点 `40:15217` 截图。Figma 仅只读参考，不代表画布已更新。

## 已完成调整

- **空状态**：当文章集合为空，首页和标签云不显示无效类型/商家/国家筛选，不显示「0 条记录 · 每页 20 条」及无意义的 noscript 提示。有文章而组合筛选无结果时，仍保留筛选和清除操作。
- **首页层级**：移除首屏、赞助商和友链区重复表达中文标题的三个英文眉题；保留已确认的主标题、正文与视觉图形。
- **关注卡片**：原来不能点击的 Telegram 关注卡改为整块链接，增加悬停和键盘焦点反馈，使用纸飞机图标，并标明新标签页行为；不添加尾部按钮。
- **手机导航**：打开后显示关闭图标、当前页面底色和准确的无障碍名称。Tab 移出菜单时关闭，Escape 关闭并恢复按钮焦点，不改变滚动位置；原生 details 保持无 JS 可用。
- **页脚与点击区域**：Logo、关注入口和页脚链接至少 44px 高；桌面页脚说明从 10px 调至 12px，链接从 11px 调至 13px，与已有手机字号一致。

映射：空状态由 `RecordList.astro`、`tags.astro` 读取集合结果控制；首页卡片与标题在 `index.astro`、`HomeAds.astro`、`FriendLinks.astro`；共享导航在 `BaseLayout.astro`，图标在 `Icon.astro`，语义颜色继续引用既有 CSS Token。没有新增数据 Schema、改动 MDX 渲染协议或写入文章数据。

## 有意保留与检查器边界

保留紧凑版式、字体、Tokyo 配色、首页随机自动广告轮播、文章布局、内容与广告的 Markdown 集合。没有套用营销落地页的满屏分段、强制首屏 CTA、额外动效或换字体要求。

Taste 基线 consistency 检查报告 46 FAIL / 22 WARN，涉及大量整屏网格、首屏填满、工具专属结构要求；不能据此认定本站阅读布局有误，也不宣称通过 Taste 全套 gate。实际点击区域不足已修复。中文跳转正文链接被英文规则误报，友链焦点问题经真实键盘操作验证未复现。文字与对比度基线检查通过。

Impeccable 编辑后执行一次 detect，返回三个 warning：两处 Inter 字体、既有文章引用块的 3px 左边框。保留字体一致性和引用语义，不为清空警告更改已确认设计。完整检测结果置于忽略的 `test-results/design-polish/`。

## 验证与证据

- `npm run format:check`、`npm run check`、`npm run build`、`git diff --check` 通过；Astro 诊断 0 errors / warnings / hints。集合为空时的加载器提示符合当前状态。
- `verify:release` 通过，保留 noindex、RSS 空集合、无捕获脚本；`verify:content` 确认撤下历史文章未生成页面（内容对照不适用）；`verify:readable` 10/10 通过。
- `verify:types` 通过，临时生成类型测试夹具后清理。夹具站验证分页、URL/历史恢复、键盘筛选、组合筛选、空结果、无 JS 回退与文章类型标签。该快照在最后一次手机 focusout 修正之前生成，用于验证未受该修正影响的列表行为。
- 最终构建在 320 / 390 / 768 / 1024 / 1440px、明暗主题下检查首页、标签云、广告页，共 30 组，无页面横向溢出或 JS 错误。验证手机菜单 Tab / Escape、主题菜单互斥、手动与系统主题、切换主题保持滚动位置、友链键盘焦点、关注卡与无 JS 行为。
- 另在类型夹具站验证 320 / 390 / 1440px × 明暗主题 × 首页/标签云/独服文章，共 18 组布局；类型按钮至少 44px，无横向溢出。
- 人工查看最终手机浅色首页、桌面深色首页及手机标签云截图。证据：`test-results/design-polish/browser-report.txt`、`populated-browser-report.txt`、`after-home-*.png`、`after-tags-390.png`。
- `src/content/posts/` 最终仅 `.gitkeep`；没有恢复历史文章或发布测试夹具。临时 4399 服务已停止，原有开发/预览服务保留。

## 持久化

本报告同步至 `viking://resources/projects/lowendaff-ui/design-polish.md`，须以全文回读一致的回执为准：`test-results/design-polish/openviking-receipt.json`。全文存储不等于语义索引已完成。Skill 副本、浏览器证据和测试产物均忽略，不纳入生产源码。
