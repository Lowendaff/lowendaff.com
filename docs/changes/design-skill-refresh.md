# 设计 Skill 挂载与更新

日期：2026-11-09。用户指定引入 `heydamir/unslop`，更新 `pbakaus/impeccable`；随后要求先处理 Skill，URL 方案留待下一步讨论。本轮只挂载、核对规则及登记，不修改界面或 URL。

## 来源与版本

| Skill | 项目入口 | 固定来源 |
| --- | --- | --- |
| unslop | `.agents/skills/unslop/SKILL.md` | `heydamir/unslop`，`97daa3eb365670ea3f87ed85356cbfcee18105a5`，源目录 `skills/unslop/` |
| Impeccable | `.agents/skills/impeccable/SKILL.md` | `pbakaus/impeccable`，`613fbf88e0ef08709eaf238653285f430250c0ea`，源目录 `.agents/skills/impeccable/` |

使用 Codex skill-installer 的下载脚本将完整包放入项目 `.agents/skills/`，包含 references 和配套脚本。此目录继续被 Git 忽略，跨机器按固定提交恢复。保留 unslop 作者 Damir Sokolovsky 与 CC BY 4.0 署名。

旧 Impeccable 来源副本 `.agents/skills/impeccable-source/` 从 `924bbd194d02e5e15a227e75b5901fb0d7a4ecad` 更新到上述提交；工作树更新前无修改。新入口使用上游 Codex 版本，旧 source 路径用于来源核对。

比较旧、新 `plugin/skills/impeccable/`：`SKILL.md` 和 reference 规则无变化；变化仅为脚本 VERSION 与 engine-checksums，捆绑引擎从 0.1.19 到 0.1.20，Skill 版本仍为 4.8.1。检查时 GitHub 独立最新引擎 release 为 `engine-v0.1.21`，但 main 的 Skill 包仍固定 0.1.20；本轮使用包内版本和校验清单，不混装独立 release，也不声称已运行 0.1.21。

## 规则摘要与使用顺序

- unslop：先看渲染画面，列出具体问题；根据严重程度选择精修或重做。以产品、性格、场景、重点画面、辨识细节五项说明方向，再按间距、颜色、图标、文案、字体、布局、细节、视觉、动效逐层处理。只修真实问题，不能为区别于旧稿而修改好设计。
- Impeccable：以表面的实际任务选择模式。文章属于 Read，筛选与测试控制属于 Operate；优先阅读、精确、可访问性及熟悉的交互。精修保留既有身份、内容和行为，设计审查与技术审查分开。
- 后续界面任务先读取两个入口；Impeccable 按当前入口运行 context，并加载对应 playbook。实际 UI 编辑前才加载 craft-floor。当前只是安装与规则核对，不运行设计命令、自动 hook、live Apply 或检测修复。
- 先提供基于现状的审查和具体方向，收到用户的设计范围后再实施；本轮没有页面审查结果，不能将通用反例当作本站发现。

## 项目约束优先

用户已确认的 Tokyo Night Day / Tokyo Night、手工三档主题切换、GitHub 头像、国家国旗 Emoji、表头与内容左对齐、等宽数字、紧凑阅读结构和地图循环动效继续有效。unslop 的“全部 Emoji 换线性图标”“数字右对齐”“移除循环动效”等通用建议不覆盖这些明确要求。

真实测评与广告仍由 Markdown/MDX 和 Content Collections 驱动；不因 Skill 示例而填入假数据、调整历史测试日期、恢复已删除的文案或创建整屏营销 Hero。不在此次安装中修改主题、图标、交互、路由或正式发布配置。

## 验证与归档

安装包核对、来源 SHA 与版本差异见 `test-results/skill-refresh/`。OpenViking：`viking://resources/projects/lowendaff-ui/design-skill-refresh.md`。同步本报告中的规则摘要与项目决定，不把第三方 Skill 源码作为自写记忆复制上传。全文回读与语义索引完成状态分开记录。
