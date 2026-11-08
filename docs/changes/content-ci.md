# CI 文章格式校验

日期：2026-11-08。

## 实现

新增 `.github/workflows/content-validation.yml`，每次 push、pull_request 与 workflow_dispatch 触发 `Article format and build`。使用 Ubuntu、Node 24、npm ci，官方 checkout/setup-node v6 固定到已核对的提交 SHA；读取仓库权限，checkout 不持久化凭据，无服务器密钥、发布或部署步骤。

CI 依次执行格式检查、Astro 类型/集合检查、正式构建、发布元数据检查、Markdown 解析器测试、VPS/独服模板正反例回归。格式命令同时覆盖 workflow YAML。无路径过滤，文章、模板、解析器、Schema、依赖变更均触发。

## 单一规则来源

Frontmatter 复用 `src/content.config.ts` Zod Schema。易读正文复用 `src/loaders/posts.ts` → `parseReadableReview()` → Schema；原生 MDX 通过 Astro 编译。不增加第二套 CI 专用文章 Schema，也不把普通 MDX 强制转为易读模板章节结构。

`src/content/posts/*.mdx` 草稿同样接受格式、Schema 与语法校验，仅不生成正式文章页。空文章集合合法；不恢复旧文章。错误显示来源文件和字段，正文转换错误带行号。

## 防回归

扩展 `verify:templates`：逐个创建错误夹具，以实际构建非零退出及来源诊断作为断言，随后清除。覆盖缺少 title、错误 reviewType、非法日期、坏 YAML、未知章节、已发布/草稿表格列数错误、已发布/草稿原生 MDX 语法错误，共 9 个反例。保留两类模板成功构建、可选章节和草稿不发布的正例。

夹具以 wx 创建，finally 清理并重建；格式检查和真实文章构建在夹具测试前执行，所有内容变更步骤串行。正常文章格式错误会直接令 CI 失败；正反例测试则确认校验器确实拒绝坏数据。

## 验证与边界

本地 actionlint、format:check、check、build、verify:release、verify:readable 与扩展 verify:templates 均通过。解析器 10 项测试通过，9 个构建反例全部被拒绝。verify:content 验证旧文章页不存在，旧文保真对照为 not-applicable。

图谱未覆盖相关源码，依据完整读取的加载器、解析器、Schema 和测试脚本确认校验链路。文章目录最终仅有 .gitkeep。

GitHub 实际运行状态及确切提交记录在 `test-results/content-ci/git-ci-receipt.json`，以远端最终结果为准。工作流失败不撤销已完成的直接 push；如需阻止不合格 PR 合并，在分支规则中要求此检查，本次未修改分支保护。

OpenViking：`viking://resources/projects/lowendaff-ui/content-ci.md`；全文写入/回读回执保存在 `test-results/content-ci/openviking-receipt.json`，不把入库排队称为语义索引完成。
