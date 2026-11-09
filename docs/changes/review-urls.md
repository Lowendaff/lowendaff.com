# 测评 URL 规则与自动补全

日期：2026-11-09。按用户确认采用中文语义标题加测试日期，保留末尾 `/`。站点从新开始，不兼容旧地址；此前加入的 301 已按后续指令撤销，当前契约以本文为准。

## 地址契约

`/reviews/{normalized-title}-{YYYYMMDD}/`：标题做 NFKC 规范化，英文小写，中文保留，空格及标点合并为 `-`，国旗和 Emoji 不进入地址。日期取 `testedAt` 开头的合法日历日期，不以发布日期、当前时间或构建时间代替。

Frontmatter `permalink` 显式保存完整路径，独立于文件名。新文章初始地址须与标题和测试日期一致；基线中已经非草稿的文章，修改标题或测试日期时保留原地址。草稿需重新生成时先删除 `permalink`，再运行补全。独立复测建立新文章，同日同标题须通过真实的标题差异区分，不自动添加序号。

100TB 地址：`/reviews/100tb-美国洛杉矶-cn2-vps-测试记录-20261007/`。测试日期为 2026-10-07，发布日期为 2026-10-08。旧 `/reviews/100tb-cn2/` 不保留，不生成跳转页或 301。

## 自动化与 CI

```sh
npm run urls:fill -- --dry-run
npm run urls:fill
npm run urls:fill -- src/content/posts/100tb-cn2.mdx
npm run urls:check
npm run verify:urls
```

补全仅插入缺失字段，保留 Frontmatter、注释和正文；先检查全批次地址冲突，再逐文件写入，已有地址不覆盖。CI 只读检查，不回写仓库。

- `src/lib/review-url.ts` 统一规范化、日期和地址规则；Schema 与构建检查缺失、非法地址和重复，草稿不能绕过。
- `redirectFrom`、`originalUrl` 是禁用字段，CI 与 Schema 均拒绝；不提供别名或旧网址迁移。
- CI checkout 完整历史，push 对比 before SHA、PR 对比 base SHA，手工运行对比当前提交；本地默认 HEAD，可用 `URL_BASE_REF` 指定基线。已发布地址冻结，普通文件重命名可识别。
- 首页、文章路由、面包屑、RSS、Sitemap、llms.txt 统一读取显式地址，只编码一次。正式 URL 保留末尾 `/`。
- `verify:release` 拒绝静态跳转页、`_redirects` 和旧 `/feed/` 路由。RSS 直接使用 `/rss.xml`。

## 验证与发布

URL 测试覆盖规范化、日期、唯一性、补全幂等性、CI 基线、地址冻结、重命名及禁用旧地址字段。实际构建覆盖正式文章/草稿缺地址、非法日期、重复地址和禁用字段拒绝。正文保留 105 张表、9,132 个单元格。

服务器部署程序已按 UTF-8 编码比较磁盘中文路径与 Sitemap；无需安装 Node/npm。OpenResty include 仅保留字符集和 Webhook 代理，不保留文章跳转。自动发布通过 main push → CI → Webhook 完成。

撤销旧地址兼容的具体记录：`remove-legacy-redirects.md`。最新发布证据：`test-results/remove-legacy-redirects/deployment-receipt.json`。前次发布回执只作为过程记录，不代表当前跳转策略。

OpenViking：`viking://resources/projects/lowendaff-ui/review-urls.md`。
