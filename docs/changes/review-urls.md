# 测评 URL 规则与自动补全

日期：2026-11-09。用户确认中文语义标题加测试日期，并明确保留末尾 `/`。本轮完成实现与 CI 配置，用户随后授权推送及部署；实际发布结果以 `test-results/review-urls/deployment-receipt.json` 为准。

## 地址契约

`/reviews/{normalized-title}-{YYYYMMDD}/`：标题做 NFKC 规范化，英文小写，中文保留，空格及标点合并为 `-`，国旗和 Emoji 不进入地址。日期取 `testedAt` 开头的合法日历日期；不以发布日期、当前时间或构建时间代替。

每篇文章由 Frontmatter `permalink` 显式保存完整路径，独立于文件名。新文章初始地址须与标题/测试日期一致；在对比基线中已经是非草稿的文章，修改标题和测试日期时保留原地址。草稿需重新生成时先删除 `permalink`，再运行补全。独立复测建立新文章；同日同标题必须通过真实的标题差异区分，不自动编造序号。

100TB 标题按用户给定内容调整，地址为 `/reviews/100tb-美国洛杉矶-cn2-vps-测试记录-20261007/`；实际测试日期仍为 2026-10-07，发布日期仍为 2026-10-08。`redirectFrom` 保留 `/reviews/100tb-cn2/`，不恢复 WordPress 旧文章。

## 自动化与 CI

```sh
npm run urls:fill -- --dry-run
npm run urls:fill
npm run urls:fill -- src/content/posts/100tb-cn2.mdx
npm run urls:check
npm run verify:urls
```

补全命令仅插入缺失字段，保留原 Frontmatter、注释和正文；先检查全批次计划的地址冲突，再逐文件写入。已有字段不会覆盖。CI 只读检查，不回写仓库。

- 共享 `src/lib/review-url.ts` 负责规范化、日期和地址规则；Content Collections Schema 与实际构建也检查缺失、非法 URL 及全局冲突，草稿不能绕过。
- 正式地址与 `redirectFrom` 共用唯一命名空间，拒绝自跳转、占用他人地址、百分号编码写入字段、外站路径及非法日期。
- CI checkout 完整历史，push 使用 before SHA、PR 使用 base SHA；手工运行对比当前提交。本地默认对比 HEAD，可通过 `URL_BASE_REF` 指定基线。基线中非草稿的地址和已有别名不能意外改写；普通重命名或保留相同 permalink 的文件移动可识别。文章删除与另建文章仍属于内容管理，不提供对蓄意删除重建的防篡改保证。
- 首页、标签列表、文章路由、面包屑、RSS、Sitemap、llms.txt 统一读取保存的地址，按需要编码一次。IndexNow 支持新中文 URL，保留旧 ASCII 地址以发送迁移删除通知。

## 验证

- 9 组 URL 测试：标题规范化、闰日/非法日期、唯一性、dry-run/指定文件/幂等、冲突写入前失败、CI 基线与初始匹配、已发布地址冻结/文件重命名、首次迁移与别名保留、重复 YAML 键拒绝。
- 实际 Astro 构建新增 5 个拒绝场景：正式文章缺地址、草稿缺地址、无效日期、重复正式地址、别名抢占。两类模板、正文解析、广告 Markdown、类型筛选和公开/预览两种构建均通过。
- 格式与 Astro 检查通过（0 errors / 0 warnings；旧忽略目录审查脚本有 1 个 hint）。正文对照保留 105 张表、9,132 个单元格及原始保留段落。
- IndexNow 13 测试、部署 12 测试通过；实际中文目录的正式构建也通过更新后的部署校验。浏览器 1440/390 验证首页新链接、正确 Canonical、中文路由、105 张表、开发服务旧地址 301 和无页面横溢/脚本异常。
- 证据：`test-results/review-urls/browser.json`、`article-*.png`、`static-validation.json`。远端 CI、Webhook 和公网证据另存 `deployment-receipt.json`。

## 服务器升级与发布

`deploy/deploy.py` 原先把磁盘中文目录直接与编码后的 Sitemap URL 比较。本次已按 UTF-8 URL 编码统一比较，并有正反例测试。静态产物部署不会自动更新服务器安装程序，本次 push main 前已备份并同步此程序，并验证现有线上版本兼容；不需要为末尾斜杠修改 OpenResty 静态目录规则。

旧地址已生成静态跳转页和 `_redirects` 的 301 规则。Astro 开发服务的 HTTP 301 已实测；OpenResty 不会自动读取 `_redirects`，线上 HTTP 301 规则已加入 `deploy/openresty-location.conf`，发布后安装并实测，保留原请求 query string，不能把静态 meta refresh 当成已部署的 HTTP 301。

服务器备份：`/root/lowendaff-backups/review-urls-20261109T101606Z/`，保存原部署程序与 OpenResty include。安装器 SHA-256：`fe33961dbcbebe25d514b5cb2fb9256eb3fa66eb6fb0c72526de57bcb600318c`。旧地址有无末尾斜杠均跳至保留末尾 `/` 的新地址。新增 `redirectFrom` 时也必须更新服务器规则；回退到旧地址版本时恢复对应 include，避免重定向至不存在页面。

OpenViking：`viking://resources/projects/lowendaff-ui/review-urls.md`；全文回读回执位于 `test-results/review-urls/openviking-receipt.json`，索引完成状态另行记录。
