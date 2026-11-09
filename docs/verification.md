# 验证指南

## 常规检查

使用锁文件安装依赖：`npm ci`。提交前运行：

```sh
npm run format:check
npm run urls:check
npm run verify:urls
npm run check
npm run build
npm run verify:content
npm run verify:release
npm run verify:readable
npm run verify:seo
npm run verify:analytics
```

`verify:content` 保留历史原文对照能力；当前两篇旧测评已撤下，报告明确显示 `not-applicable`，并验证构建目录中不存在其旧文章页。若将来主动恢复原文，可继续与 `tests/fixtures/wordpress/` 的 HTML 比较；不得将缺少文章时的检查称为全文保真通过。`scripts/archive_html.py` 只解析 HTML，不执行脚本或网络请求。

`verify:readable` 使用 Node 内置测试框架，验证 Markdown 表格、段落、稳定 ID 和错误输入。当前没有覆盖率百分比要求。

修改两类文章模板或其解析/渲染规则时，执行 `npm run verify:templates`；验证 VPS/独服标题、可选章节、原始输出、本地图像标记与草稿隔离。它会创建临时文章并重建，须与其他构建、格式检查及内容编辑串行执行。

修改内容集合、加载器或商业内容结构时，额外按顺序运行 `npm run verify:pipeline` 和 `npm run verify:markdown`。它们使用临时合成文章，`verify:markdown` 还暂改广告配置；结束时清理夹具、恢复配置并重建默认预览；不能与其他构建或内容编辑并行运行。Markdown 检查结果默认写入 `test-results/markdown/`。

## GitHub CI 文章检查

工作流 `.github/workflows/content-validation.yml` 在每次 push、PR 及手工触发时运行，检查名为 `Article format and build`。不设置路径过滤，修改解析器、Schema、模板或依赖也会重新校验文章。

1. Node 24 + `npm ci` 使用锁定依赖。
2. `format:check` 检查源码及 `src/content/posts/*.mdx` 排版；`check` 校验类型和集合 Schema。
3. `build` 使用正式加载器验证全部文章，包括草稿的 Frontmatter 和语法，并实际渲染非草稿 MDX；`verify:release` 核对生成结果。
4. `verify:readable` 测试 Markdown 解析规则，`verify:templates` 实际构建 VPS / 独服模板，并验证错误 YAML、缺少标题、错误类型/日期、未知章节、表格列数不符及 MDX 语法错误会让构建失败。草稿也不能绕过格式校验。
5. `verify:seo` 检查结构化实体关联、日期与 JSON-LD 安全转义；`verify:pipeline` 真实构建公开/预览两种模式，验证 sitemap、AI 阅读目录和草稿隔离。`verify:templates` 另验证空摘要与倒序更新日期拒绝发布。测试完成后按 CI 的收录模式重建，再上传无夹具的产物。

检查复用 `src/content.config.ts` 与正文解析器，不维护第二套文章规则。`format: review-markdown` 服从模板章节和表格约定；原生 `format: mdx` 使用 MDX 语法，不强制套用易读模板的章节限制。空文章集合允许通过，不会自动恢复历史文章。错误日志提供来源文件及相关字段，正文解析错误含行号；格式问题可本地运行 `npm run format` 后复查，字段/语法问题需修改文章。

校验工作流只有读取仓库权限，不需要服务器密码；main 成功后的静态产物由独立 `Deploy static site` 工作流通知 Webhook 发布。测试夹具串行创建和清理，不提交、不上传为站点产物。如需强制 PR 合并门禁，应在 GitHub 分支规则中将 `Article format and build` 设为必需检查；工作流失败本身不会撤销直接 push。

## 浏览器检查

类型筛选回归使用 `npm run verify:types` 创建 22 篇 VPS、3 篇独服及草稿夹具，验证类型 Schema 和静态标识，并在 `finally` 中删除夹具、重建原站。独立浏览器样本站保存在忽略目录 `test-results/review-types/site/`，附带数量清单供分页断言使用；不导入真实历史文章。

运行 `python3 -m http.server 4399 --bind 127.0.0.1 --directory test-results/review-types/site`，再将 `scripts/verify-review-type-browser.js` 交给 Playwright MCP。它检查分页、URL/历史恢复、组合筛选、计数、键盘、无 JS 降级、文章标签及 320/390/1440px 双主题布局。测试完成后停止该专用服务；所有内容变更验证串行运行。

以下文件是 Playwright MCP 的 `async function …(page) { … }` 回调，不是独立 Node CLI。先运行对应服务，再将整个文件交给 `browser_run_code_unsafe` 的 `filename` 参数；回调返回 JSON 报告。报告与截图存入 `test-results/`，不要提交。

| 脚本 | 服务 | 范围 |
| --- | --- | --- |
| `scripts/verify-pages.js` | preview :4323 | 六页、四种宽度、明暗主题、分页、筛选、BGP 和文案 |
| `scripts/verify-routes.js` | dev :4321 | 路由目标遍历、键盘、URL 恢复、无 JS |
| `scripts/verify-review-interactions.js` | dev :4321 | 分组、提示、自定义选择器、触摸 |
| `scripts/verify-theme-scroll.js` | dev :4321 | 主题切换保持阅读位置、系统/键盘/跨页行为 |
| `scripts/verify-carousel-layout.js` | dev :4321 | 单卡、居中箭头、随机顺序、无 JS/减少动效 |
| `scripts/verify-carousel-autoplay.js` | dev :4321 | 连续自动循环、方向、缓动、暂停恢复 |
| `scripts/verify-carousel-controls.js` | dev :4321 | 双向循环、键盘、广告链接隔离 |

运行 `npm run preview -- --port 4323` 启动构建预览。部分历史浏览器脚本面向旧文章及数量，不作为当前空文章库的验收入口；有意增删内容时同步调整预期，不能为通过测试删减真实数据。

## 发布边界

默认构建 noindex，Figma 捕获脚本不可进入生产输出。`verify:release` 检查 SEO 元数据、RSS、sitemap，并拒绝静态跳转页、`_redirects` 与旧 `/feed/` 路由。公开发布另按 `release-guide.md` 执行。
