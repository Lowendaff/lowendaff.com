# LowEndAFF Astro 主题

使用 Astro、Content Collections、MDX 和 Tailwind CSS 构建的静态测评站点，支持 VPS 与独立服务器测试记录。测评、广告和 Sponsors 均由内容集合驱动；通过 GitHub CI 构建静态产物，交由 Webhook 自动部署到 OpenResty。

## 本地开发

Node.js >= 22.12，CI 使用 Node.js 24；通过 npm 和锁文件安装依赖。

```sh
npm ci
npm run hooks:install
npm run dev
```

默认地址 `http://127.0.0.1:4321/`。页面包括 `/tags/`、`/ads/` 和 `/components/`。测评地址由 Frontmatter `permalink` 决定，使用 `/reviews/{规范化标题}-{测试日期YYYYMMDD}/`，保留末尾 `/`，与文件名解耦。

每份克隆执行一次 `hooks:install`；它只修改本仓库的 Git 配置，遇到其他 hook 会提示人工合并。

## 内容入口

| 内容 | 编辑位置 |
| --- | --- |
| 测评、目录元数据、跑分、路由 | `src/content/posts/*.mdx` |
| 首页轮播广告 | `src/content/ads/home/*.md` |
| 文章头部广告 | `src/content/ads/article-top/*.md` |
| 文章尾部广告 | `src/content/ads/article-bottom/*.md` |
| 文章侧边栏广告 | `src/content/ads/article-sidebar/*.md` |
| Sponsors 链接、SVG、启用状态 | `src/content/sponsors/*.md` |
| 广告页价格、合作政策、联系方式 | `src/content/advertising/policy.md` |
| 内容校验 | `src/content.config.ts` |

详见 [内容维护指南](docs/content-authoring.md)。开发模式监听文件变化；静态部署须重新构建并发布 `dist/` 才会更新。随机排序和轮播在浏览器执行，商家名单由 Markdown 决定。

统计平台统一由 `src/config/analytics.json` 配置，支持 GA4 和外部脚本型平台；配置示例、启停与扩展方式见 [统计配置](docs/analytics.md)。

新文章从 [VPS / 独服模板](templates/reviews/README.md) 复制，以普通 Markdown 正文编写（扩展名仍为 `.mdx`）。维护说明见内容指南“易读测评格式”；`src/loaders/posts.ts` 在构建/开发时将正文转换为既有数据模型，页面组件继续复用。

## 写作与提交

1. 从模板创建文章，填写标题、测试日期、必填元数据与真实测试内容；`reviewType` 使用 `vps` 或 `dedicated`。
2. 运行 `npm run urls:fill` 补齐缺失的 `permalink`。已有地址不会被覆盖；已提交的非草稿地址保持不变。
3. 草稿使用 `draft: true`，不生成文章页面，但仍须通过格式和字段校验。完成内容后改为 `draft: false` 并本地预览。
4. `git add` 后正常提交。`pre-commit` 检查实际暂存内容的排版、URL、Schema 与 MDX 构建；失败会阻止提交，修复后需重新暂存。

```sh
npm run urls:check    # 检查工作区文章的 URL
npm run check:staged  # 主动检查本次暂存快照
```

Hook 支持部分暂存，在临时目录构建，不自动格式化、补地址或暂存文件，也不影响本地预览缓存。纯文档提交跳过文章校验。详细范围与故障处理见 [Git Hook 使用说明](docs/git-hooks.md)。

本地 hook 可被跳过，GitHub CI 的 `Article format and build` 仍负责最终验证；未安装 hook 的其他克隆和网页提交同样受 CI 校验。

## 检查与构建

```sh
npm run format:check
npm run urls:check
npm run verify:urls
npm run verify:hooks
npm run check
npm run build
npm run verify:content
npm run verify:release
npm run verify:seo
npm run verify:pipeline
npm run verify:markdown
npm run verify:readable
npm run verify:templates
```

`verify:hooks` 在隔离 Git 仓库中验证真实提交行为。`verify:pipeline`、`verify:markdown` 和 `verify:templates` 使用临时文章验证集合与模板，结束后清理夹具并重建预览版；不要与其他构建或内容编辑同时运行。`verify:markdown` 的临时浏览器场景输出在 `/tmp/lowendaff-content-scenarios/`，不进入 `dist/`。

`npm run preview -- --port 4323` 查看构建结果。浏览器回归脚本位于 `scripts/`，供 Playwright MCP 执行，非独立 Node CLI；完整入口见 [验证指南](docs/verification.md)。

## 工程结构

- `src/layouts/`：站点外壳与文章布局。
- `src/components/mdx/`：参数卡、终端、表格与优惠组件。
- `src/components/archive/`：归档正文、路由选择器、BGP 与 Sponsors。
- `src/components/ads/`：四个独立广告入口及共享文章卡片渲染器。
- `src/lib/`：集合查询和通用视图转换，不保存商家或测评数据。
- `src/styles/`：Tokyo Night Day / Tokyo Night 语义主题；跟随系统及手动切换。
- `public/`：站点头像；Sponsors SVG 在 `src/assets/sponsors/`。
- `tests/fixtures/wordpress/`：正文验证和目录溯源所需的原始快照。
- `docs/`：当前设计映射、内容维护、验证与发布指南。

旧 JSON、重复快照、历史截图及一次性迁移脚本已归档至仓库外；恢复索引见 [清理记录](docs/changes/git-preparation.md)。依赖、构建产物、测试输出和本机工具配置由 `.gitignore` 排除；保留 `package-lock.json` 和 `.env.example`。

## 部署与内容边界

[验证指南](docs/verification.md) · [组件映射](docs/stage-4-component-map.md) · [部署指南](docs/deployment.md) · [搜索引擎接入](docs/search-engines.md)

推送 `main` 后，成功的 CI 构建产物通过 `adnanh/webhook` 发布到 1Panel/OpenResty；PR 不部署。服务器只提供静态文件，无需安装 Node.js 或 npm。

本地与 PR 默认 noindex；正式发布的收录开关由 CI 与服务器配置共同控制，详见部署指南。站点提供 `/sitemap.xml`、`/rss.xml` 和 `/llms.txt`；不保留旧站地址或 301 跳转。

当前正式文章为 `src/content/posts/100tb-cn2.mdx`。其余已撤下历史文章不自动恢复，模板占位内容不能发布；文章集合为空时仍可构建。模板、广告和 Sponsors 独立维护，测试使用临时合成文章。
