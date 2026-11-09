# 撤销旧网址兼容

日期：2026-11-09。用户明确要求按全新站点处理，取消旧地址 301，不引入历史兼容。

## 变更

- 删除 100TB 的 `redirectFrom`，文章只按 `permalink` 生成新路径。
- 删除 WordPress 旧网址路由、旧 `/feed/` 跳转和 `_redirects` 生成逻辑。正常 RSS 保留 `/rss.xml`。
- 删除别名保留、首次迁移必须保留旧地址等 CI 规则；保留标题/测试日期格式、自动补全、唯一性和已发布正式地址冻结。
- Schema 与 URL 校验拒绝 `redirectFrom` / `originalUrl`；发布校验拒绝静态跳转页，防止兼容逻辑再次进入产物。
- OpenResty include 移除两个旧文章 301 location；保留 HTTPS、UTF-8 字符集与 Webhook 代理。

## 发布验收

提交前运行格式、类型、URL 回归、模板负例、内容管道、正文完整性及公开构建检查。产物应有 5 个 HTML 页面、0 个跳转页，保留 1 篇测评与 105 张表格。

用户已授权本轮推送部署。静态页面走现有 CI/Webhook，服务器 include 另行备份并安装，`openresty -t` 成功后 reload。最终核验旧文章路径有无斜杠、旧 `/feed/`、历史日期型路径返回 404 且无 Location，新文章与 RSS 返回 200。

最终提交、CI、服务器配置和公网检查见 `test-results/remove-legacy-redirects/deployment-receipt.json`。OpenViking：`viking://resources/projects/lowendaff-ui/remove-legacy-redirects.md`。

此记录取代前次 URL 发布中的旧地址 301 安装要求；不改变当前中文语义地址、末尾斜杠或文章内容。
