# 提交前文章校验

## 安装与日常使用

每份新克隆在安装依赖后启用一次：

```sh
npm ci
npm run hooks:install
```

安装器只设置本仓库的 `core.hooksPath=.githooks`，可以重复执行。发现其他 hooks 路径或默认目录已有非示例 hook 时会停止，不覆盖现有配置。终端或 Git 客户端须能找到 Node.js >=22.12 和 npm；依赖、锁文件不一致时先运行 `npm ci`。

正常编辑、`git add`、`git commit` 即可。失败后按错误中的文件与字段修复，重新暂存再提交。可主动检查已经暂存的内容：

```sh
npm run check:staged
```

新文章先填写标题和测试日期，运行 `npm run urls:fill` 补齐缺失地址，再检查并暂存；hook 不会自动补地址、格式化或 `git add`。

## 检查范围

暂存变更涉及 `src/`、`public/`、脚本、hook、依赖、Astro/TypeScript/Prettier/npm 配置或文章 CI 时，执行：

1. 全部暂存文章的 Prettier 排版检查。
2. 共享 URL 校验：地址格式、初始标题与测试日期、跨文章唯一性（含草稿）、已提交非草稿地址冻结。
3. 真实 Astro 构建：复用 Content Collections 的 Zod、易读 Markdown 解析和 MDX 编译，同时检查广告等其他集合。

纯文档提交跳过。完整类型检查、回归测试、SEO 和发布检查继续由 CI 执行；不会把所有测试放进每次提交。

## 部分暂存与隔离

校验从 Git 当前索引冻结快照，包括 `git commit -a` 和指定路径提交使用的临时索引。暂存错误、工作区已修好仍阻止提交；暂存正确、未暂存内容错误允许提交。

快照导出到系统临时目录，只链接已安装的依赖包，单独建立 Astro/Vite 缓存和构建产物。不会 stash、重写正文、调整暂存内容或使用工作区的 `.env`。普通成功或失败后删除临时目录。本地预览服务继续运行。

Git hook 不是远端权限控制：`--no-verify`、未安装 hook 的克隆或网页提交可以绕过它。GitHub 的 `Article format and build` 检查仍是发布门禁；新增的 `npm run verify:hooks` 在隔离 Git 仓库内回归这些行为。
