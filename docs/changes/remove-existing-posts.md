# 撤下原有 posts

2026-11-08：用户明确要求将原有 posts 也从当前版本撤下。本次删除 `src/content/posts/` 中全部 42 篇 MDX（2 篇完整测评与 40 条历史引用），保留 `.gitkeep` 空目录。VPS/独服模板、广告与 Sponsors 不受影响。提交到 GitHub main；不重写 Git 历史，旧文章可在父提交 `fffc851958062337469ff209b0be27b3a5081dce` 找回。

首页与标签目录支持服务端空状态；文章页、旧文章跳转和 RSS 条目随集合变为空。验证脚本不再假定有两篇历史文章或固定三条跳转；Markdown 联动验证改用临时合成内容，结束后清理，不复制历史正文进其他目录。历史 HTML 仅保留为离线测试资料，不参与站点渲染。

验证：格式、Astro 类型检查、静态构建、发布契约、易读解析、两类模板、内容管线、Markdown 联动。`verify:content` 对已撤下文章报告 not-applicable，并检查对应生成页不存在。额外核对当前 posts 无 MDX、首页/标签空状态、RSS 零条目、构建无旧文章路径。

本地回执：`test-results/remove-existing-posts/`。OpenViking：`viking://resources/projects/lowendaff-ui/remove-existing-posts.md`。全文回读成功与语义索引完成分开记录。
