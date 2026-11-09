# 提交前文章校验

日期：2026-11-09。用户确认在可行性审查后实施 Git hook。

## 结果

新增原生 `.githooks/pre-commit`，本机已启用 `core.hooksPath=.githooks`。无需 Husky 等额外依赖。新克隆在 `npm ci` 后运行 `npm run hooks:install`；日常提交自动检查，也可执行 `npm run check:staged`。安装器拒绝覆盖其他 hook 配置。

实现基于 `9e0e39b1c9831bb3b9b6cdde325f8439394f1648`，文章与界面没有改动。用户随后授权将 Hook、CI 回归与 README 更新提交到 GitHub；具体提交、远端和 CI 结果见 `test-results/git-hooks/git-push-receipt.json`。

## 实现与边界

- `scripts/check-staged-content.mjs` 复制当前 Git 索引到临时目录，由私有索引冻结 tree 并导出快照；支持初始提交、部分暂存、`commit -a` 和指定路径提交。连 `write-tree` 的缓存元数据更新也只发生在私有索引。
- 在快照内执行文章 Prettier、共享 URL 校验与真实 Astro 构建，复用 Zod、易读 Markdown 解析器及 MDX 编译，不复制业务校验规则。草稿也检查。
- URL 重命名比较使用冻结 tree，避免未暂存改动干扰；缺失文章目录作为合法空集合处理。发布地址仍冻结，重复地址覆盖所有文章。
- 依赖链接到现有安装，但缓存目录与构建输出独立；核对暂存 package/lock 与 npm 安装记录，不下载依赖、不自动修正文、补地址、暂存或 stash。
- 内容、源码、构建脚本和配置变更触发；删除/移出文章目录也触发；纯文档跳过。该 hook 不代替 CI 的完整类型检查与回归门禁。
- 本地 hook 可被 `--no-verify` 绕过，新克隆也需安装。GitHub CI 保留文章门禁，并增加 `verify:hooks` 回归步骤。

操作指南：`docs/git-hooks.md`；内容维护入口同步更新。没有新增服务器 Node/npm 或部署服务。

## 验证

以下命令全部退出 0：

- `format:check`、`verify:hooks`（18 项全部通过）、`urls:check`、`verify:urls`。
- `check`、`build`、`verify:content`、`verify:release`、`verify:readable`、`verify:seo`、`verify:templates`。
- Hook 回归使用临时 Git 仓库和真实 `git commit`，覆盖安装冲突、初始提交、暂存/工作区差异、错误草稿、Markdown/MDX、URL 冲突与冻结、重命名、替代索引、依赖缺失/不一致、移动/删除末篇文章、纯文档跳过。
- 当前完整项目使用另一个临时索引调用已安装的 `git hook run pre-commit`，实际构建通过；真实索引前后 SHA-256 相同。
- 本地预览 `http://127.0.0.1:4321/` 返回 200；临时夹具已清理，原有文章未修改。

`astro check` 为 0 errors、0 warnings，另有既存忽略目录 `test-results/ui-review-b/contrast-correction.mjs` 的 1 个 hint。

证据：`test-results/git-hooks/validation.json`、`installation.json`、各命令日志及 `real-project.log`。源码图谱未覆盖相关文件，判断基于已直接读取的源文件。

## 归档

OpenViking：`viking://resources/projects/lowendaff-ui/git-hooks.md`。同步后以全文回读验证；语义索引排队不等于索引完成。回执保存于 `test-results/git-hooks/openviking-receipt.json`。
