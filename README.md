# LowEndAFF Astro 主题

基于已确认的修订 13 设计，使用 Astro、Content Collections、MDX 和 Tailwind CSS。测评、广告和 Sponsors 均由内容集合驱动；本地工程与 Figma 已交付，尚未部署生产站。

## 本地开发

Node.js >= 22.12；本次使用 Node 24.17.0、npm 11.13.0。

```sh
npm ci
npm run dev
```

默认地址 `http://127.0.0.1:4321/`。页面包括 `/tags/`、`/ads/`、`/components/`、`/reviews/100tb-cn2/` 和 `/reviews/panstarcloud-singapore/`。

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

100TB 已试用普通 Markdown 正文写法（文件仍为 `.mdx`），PanstarCloud 保留原结构。维护说明见内容指南“易读测评格式”；`src/loaders/posts.ts` 在构建/开发时将正文转换为既有数据模型，页面组件继续复用。

## 检查与构建

```sh
npm run format:check
npm run check
npm run build
npm run verify:content
npm run verify:release
npm run verify:pipeline
npm run verify:markdown
npm run verify:readable
```

`verify:pipeline` 和 `verify:markdown` 使用临时内容验证集合联动，结束后恢复原文件并重建预览版；不要与其他构建或内容编辑同时运行。`verify:markdown` 的临时浏览器场景输出在 `/tmp/lowendaff-content-scenarios/`，不进入 `dist/`。

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

## 交付与边界

[验证指南](docs/verification.md) · [组件映射](docs/stage-4-component-map.md) · [发布说明](docs/release-guide.md)

42 条记录中，两篇有完整本地测评，另外 40 条指向历史快照。保留 211 张数据表；5 张历史正文图片未恢复，BGP IPv6 原文未提供。广告价格与测试结果均是历史数据；Sponsors SVG 是可着色文字标识。预览默认 noindex；发布开关、旧 URL 与主机侧重定向见发布说明。
