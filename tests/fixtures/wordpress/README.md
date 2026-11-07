# WordPress 来源夹具

这些 HTML 是迁移时保存的原始响应，仅供离线解析和来源核对，不作为站点页面发布，也不执行其中脚本。

- `100tb.html`、`panstarcloud.html`：`npm run verify:content` 比对的原始测评。
- `home.html`：文章目录与 Evoxt 首页广告的来源。
- `page-2.html`：补充目录的历史分页来源。
- `manifest.json`：原文件路径与 SHA256；迁移时未修改响应正文。

文章中的 `archiveSnapshot` 保存对应 Wayback 地址。目录首页与早期首页快照内容相同，已去重为 `home.html`。完整抓取日志、提取结果和设计过程截图移至仓库外备份，见 `docs/changes/git-preparation.md`。

新增文章不需要添加 WordPress 夹具；只在变更迁移基线时维护这些文件。测试输出写入被忽略的 `test-results/`，不可覆盖本目录。
