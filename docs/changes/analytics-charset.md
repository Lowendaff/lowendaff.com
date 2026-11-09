# 中文字符集修复与 JSON 统计配置

2026-11-09：用户反馈 llms.txt 中文乱码，并要求通过 JSON 管理 Google Analytics 及后续平台；提供 GA4 ID `G-QJ1LPFHGL9`。

## 乱码原因与修复

线上文件字节是有效 UTF-8，但 OpenResty 返回 `Content-Type: text/plain`，没有 charset。Playwright 实际观察浏览器使用 GBK，中文变成乱码。Astro 静态输出只保存文件正文，源端点 Response 中的 charset 不会成为 OpenResty 的响应头。

已在受版本管理的 `deploy/openresty-location.conf` 中加入 server 级 `charset utf-8`，同步现有站点 include。修改前备份至 `/root/lowendaff-charset-backup-20261109`，OpenResty `-t` 成功后平滑 reload。文件内容前后逐字节相同；公网响应变为 `text/plain; charset=utf-8`，浏览器 `document.characterSet` 为 UTF-8，中文正常。没有转换成英文，也没有往文件插入 HTML meta 标签。

## 统计架构

- `src/config/analytics.json` 是唯一统计配置：总开关、生产域名、排除路径、各平台启停和参数。GA4 ID 不写入 Astro 页面或环境变量。
- `src/lib/analytics.ts` 在构建时以 Zod 严格校验，配置错误直接阻断发布。
- `Analytics.astro` 仅在正式构建输出经过转义的 JSON；客户端先校验真实 hostname，再异步加载启用的平台。开发/PR/预览、组件页不采集。
- GA4 适配器负责一次初始化和目标配置；通用 script 适配器支持 HTTPS 外部脚本与 data-* 属性，不执行配置中的任意内联代码。后续特殊 SDK 可增加适配器，配置位置不变。
- CI 增加配置、域名门禁、单次加载及非法输入回归；发布验证核对构建后的统计配置与原始 JSON 一致。

## 验证与交付

6 个统计测试通过，涵盖总开关、单项开关、域名、排除路径、重复初始化与错误配置。浏览器实际下载 Google tag 成功，捕获到正确 Measurement ID 的单次初始 page_view；采集请求被本地模拟 204 截获，不写入真实 GA 报表。额外模拟的通用平台验证脚本加载和 data-* 参数；真实 GA 后台实时数据未替用户登录验证。

完整操作指南见 `docs/analytics.md`。部署和线上回执保存在 `test-results/analytics/deployment-receipt.json`。OpenViking：`viking://resources/projects/lowendaff-ui/analytics-charset.md`，保存后全文回读，索引排队不等于完成。

参考已核对的官方资料：Nginx charset 模块、Google tag 文档与 GA4 手动接入说明。没有增加运行时依赖、服务端统计组件或文章。

- https://nginx.org/en/docs/http/ngx_http_charset_module.html
- https://developers.google.com/tag-platform/gtagjs
- https://support.google.com/analytics/answer/17231523
