# 项目上下文索引

## 当前状态

2026-11-08：Astro 本地工程已交付，已接续 GitHub `Lowendaff/lowendaff.com` 的初始历史，使用 `main` 分支；首次同步结果以 `test-results/git-sync/` 回执为准，尚未部署。源码和当前维护文档留在工作区；历史报告、截图、抓取日志、一次性脚本与旧素材已备份后移出，清理记录见 `changes/git-preparation.md`。

42 条 MDX 中 2 篇完整测评、40 条快照引用。100TB 采用易读 Markdown 试用，PanstarCloud 仍为结构化 MDX。广告四个独立集合，Sponsors 单独维护。当前测试数据、广告和样式以源码为准；历史说明不覆盖 `AGENTS.md`。

## 当前文档

- `content-authoring.md`：文章、广告及 Sponsors 维护。
- `../templates/reviews/README.md`：VPS / 独服 Markdown 模板；`changes/review-templates.md` 记录历史依据、恢复撤销和兼容调整。
- `verification.md`：类型、格式、构建、内容契约和浏览器检查。
- `release-guide.md`：noindex、发布开关、重定向和部署边界。
- `stage-3-component-map.md`、`stage-4-component-map.md`：Figma 节点与内容链路。
- `design-tokens.json`：修订 13 的设计 Token。

## 历史阶段与资源

下列报告原相对路径保存在仓库外 `before-cleanup.tar.gz` 中，可解压到独立目录。原 OpenViking 全文回读曾通过，语义索引完成状态未据此推断。

| 阶段 | 归档内路径 | OpenViking URI |
| --- | --- | --- |
| 0 | `docs/stage-0-initialization.md` | `viking://resources/projects/lowendaff-ui/stage-0-initialization.md` |
| 1 | `docs/stage-1-analysis.md`、`docs/stage-1-content-contracts.md` | `viking://resources/projects/lowendaff-ui/stage-1-analysis.md` |
| 2 | `docs/stage-2-design-system.md` | `viking://resources/projects/lowendaff-ui/stage-2-design-system.md` |
| 3A | `docs/stage-3-revision-13.md` | `viking://resources/projects/lowendaff-ui/revisions/13/stage-3-revision-13.md` |
| 3B | `docs/stage-3-figma-delivery.md` | `viking://resources/projects/lowendaff-ui/figma-delivery/revision-13/stage-3-figma-delivery.md` |
| 4 | `docs/stage-4-design-audit.md` | `viking://resources/projects/lowendaff-ui/stage-4/stage-4-design-audit.md` |

后续归档资源根：`advertising-split/`、`readable-mdx-trial/`、`theme-scroll/`、`copy-cleanup/`（均位于 `viking://resources/projects/lowendaff-ui/` 下；精确 URI 以对应历史回执为准）。本轮 `git-preparation/` 的回执写入 `test-results/git-preparation/`。

## 设计资源与本机 Skill

Figma file key：`vZ3h8djsL9yAt0WIlhyCSm`。三个最终 Frame：UI Kit `40:15216`、首页 `40:15217`、文章 `40:15218`。用户已确认修订 13；之后滚动修复、文字清理仅修改本地代码。

`.agents/skills/` 本机副本保留，但不纳入 Git；跨机器使用前从以下来源挂载所需 Skill，阅读 `SKILL.md` 和核心 references。构建与测试不依赖这些文件。

- `apple-design-skill`：https://github.com/dickwu/apple-design-skill
- `web-design-guidelines`：https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines
- Vercel 规则源：https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
- `figma-implement-design`：https://github.com/openai/skills/tree/main/skills/.curated/figma-implement-design
- 官方工具关联的 `figma-use`、`figma-generate-design`、`figma-design-to-code` 按可用 Figma Skill 包挂载；操作前先读取相应规范。

OpenViking 本机配置 `.openviking/config.json` 保留且忽略，不包含在源码交付中。结构探索先按 codebase-memory 查询图谱；当前索引未覆盖实际源码，须读取源文件确认。
