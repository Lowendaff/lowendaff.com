# 项目上下文索引

## 当前状态

2026-11-09：Astro 工程已通过 GitHub `Lowendaff/lowendaff.com` 的 main 分支 CI 产物完成 HTTPS 部署演练，保持 noindex，未开启正式收录。首次 Git 同步结果以 `test-results/git-sync/` 回执为准；当前发布证据见 `test-results/deploy-rehearsal/`。源码和当前维护文档留在工作区；历史报告、截图、抓取日志、一次性脚本与旧素材已备份后移出，清理记录见 `changes/git-preparation.md`。

原有 42 篇 MDX 已按用户要求撤下，当前文章集合为空；新增内容使用 VPS / 独服模板。撤下记录见 `changes/remove-existing-posts.md`。广告四个独立集合，Sponsors 单独维护。当前测试数据、广告和样式以源码为准；历史说明不覆盖 `AGENTS.md`。

VPS / 独服类型区分已完成：首页筛选、列表/文章类型标签及标签云组合筛选，详见 `changes/review-types.md`。未实现置顶。OpenViking：`viking://resources/projects/lowendaff-ui/review-types.md`（全文回读一致，回执在 `test-results/review-types/openviking-receipt.json`）；Git 同步回执见 `test-results/review-types/git-push-receipt.json`。未部署或同步本次 Figma 画布。

## 当前文档

- `changes/motion-preview.md`：2026-11-09 本地八城市、11 条海缆/陆缆组合通道，2.4 秒随机起终点连通路径动效；美国东西岸直连线加强显示；按用户要求地图不再跟随 reduced-motion 停播；OpenViking：`viking://resources/projects/lowendaff-ui/motion-preview.md`，全文回读一致，回执在 `test-results/global-network/openviking-receipt.json`。用户已授权推送并通过 CI/Webhook 发布，结果以 `test-results/motion-deploy/final-receipt.json` 为准；未同步 Figma。

- `deployment.md`：GitHub Actions 产物、adnanh/webhook、systemd、OpenResty 和版本回退操作；服务器不构建源码，演练保持 noindex。
- `changes/deploy-rehearsal.md`：2026-11-09 真实 CI 发布与回退演练。OpenViking：`viking://resources/projects/lowendaff-ui/deploy-rehearsal.md`，全文回读与运行回执在 `test-results/deploy-rehearsal/`。
- `changes/design-polish.md`：Taste / Impeccable 驱动的空状态、手机导航、点击区域与冗余文字优化；GitHub 提交与 CI 回执见 `test-results/design-polish/git-ci-receipt.json`，未同步 Figma。OpenViking：`viking://resources/projects/lowendaff-ui/design-polish.md`，全文回读回执见 `test-results/design-polish/openviking-receipt.json`。
- `changes/content-ci.md`：GitHub push/PR 文章格式校验与构建反例测试；OpenViking：`viking://resources/projects/lowendaff-ui/content-ci.md`。
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
- `taste-skill`：https://github.com/leonxlnx/taste-skill；入口 `.agents/skills/taste-skill-source/skills/taste-skill/SKILL.md`，固定提交 `f6b76575f949707b4e3c37cd86cb44b0b98643e8`。
- `impeccable`：https://github.com/pbakaus/impeccable；入口 `.agents/skills/impeccable-source/plugin/skills/impeccable/SKILL.md`，固定提交 `924bbd194d02e5e15a227e75b5901fb0d7a4ecad`。按既有阅读站点范围使用，规则取舍见本轮归档。
- `web-design-guidelines`：https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines
- Vercel 规则源：https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
- `figma-implement-design`：https://github.com/openai/skills/tree/main/skills/.curated/figma-implement-design
- 官方工具关联的 `figma-use`、`figma-generate-design`、`figma-design-to-code` 按可用 Figma Skill 包挂载；操作前先读取相应规范。

OpenViking 本机配置 `.openviking/config.json` 保留且忽略，不包含在源码交付中。结构探索先按 codebase-memory 查询图谱；当前索引未覆盖实际源码，须读取源文件确认。
