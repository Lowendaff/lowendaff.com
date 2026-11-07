# 首次 Git 同步

日期：2026-11-08。

远端：`git@github.com:Lowendaff/lowendaff.com.git`；主分支 `main`。远端原有提交 `476f32c6ca513d2bf22ee13d38d84327f52083e4` 仅包含 Node/Astro 忽略模板。本地接续该历史，保留原忽略规则并补充项目本机工具、缓存和证据排除项；不强制推送、不删除远端历史。

同步范围为清理后的 Astro 源码、Markdown/MDX 内容、锁文件、必要 WordPress 测试夹具、验证脚本和当前文档。历史截图、日志、一次性脚本与旧素材已在工作区外备份，见 `git-preparation.md`。依赖、构建输出、凭据、本机 Skill/OpenViking 配置及本地测试结果不提交。

提交前重新运行格式、类型、构建、正文、发布和 Markdown 解析检查，结果见本机 `test-results/git-sync/checks.json`。清理时的独立安装、完整集合契约和浏览器回归仍记录于 `test-results/git-preparation/`；本轮没有应用逻辑变更。

最终提交与远端 HEAD 对比、工作区状态保存到被忽略的 `test-results/git-sync/push-receipt.json`，避免把尚未完成的推送写成已交付。源码同步不等同于部署，未新增 CI 或发布流程。

本报告及当前上下文同步至 `viking://resources/projects/lowendaff-ui/git-sync/`，全文回读与推送回执以本机记录为准；语义索引异步。
