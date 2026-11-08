# 验证指南

## 常规检查

使用锁文件安装依赖：`npm ci`。提交前运行：

```sh
npm run format:check
npm run check
npm run build
npm run verify:content
npm run verify:release
npm run verify:readable
```

`verify:content` 保留历史原文对照能力；当前两篇旧测评已撤下，报告明确显示 `not-applicable`，并验证构建目录中不存在其旧文章页。若将来主动恢复原文，可继续与 `tests/fixtures/wordpress/` 的 HTML 比较；不得将缺少文章时的检查称为全文保真通过。`scripts/archive_html.py` 只解析 HTML，不执行脚本或网络请求。

`verify:readable` 使用 Node 内置测试框架，验证 Markdown 表格、段落、稳定 ID 和错误输入。当前没有覆盖率百分比要求。

修改两类文章模板或其解析/渲染规则时，执行 `npm run verify:templates`；验证 VPS/独服标题、可选章节、原始输出、本地图像标记与草稿隔离。它会创建临时文章并重建，须与其他构建、格式检查及内容编辑串行执行。

修改内容集合、加载器或商业内容结构时，额外按顺序运行 `npm run verify:pipeline` 和 `npm run verify:markdown`。它们使用临时合成文章，`verify:markdown` 还暂改广告配置；结束时清理夹具、恢复配置并重建默认预览；不能与其他构建或内容编辑并行运行。Markdown 检查结果默认写入 `test-results/markdown/`。

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

默认构建 noindex，Figma 捕获脚本不可进入生产输出。`verify:release` 检查 SEO 元数据、RSS、sitemap 和旧 URL 回退；不代表实际主机已部署 HTTP 301。公开发布另按 `release-guide.md` 执行。
