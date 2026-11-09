# CI 产物部署演练

2026-11-09，用户授权在 `152.175.20.141`、1Panel 网站根 `/opt/1panel/www/sites/lowendaff.com/index` 使用 adnanh/webhook 演练静态发布。

## 变更与备份

- Debian 13 / 1Panel v2.4.2 / OpenResty 1.31.8.1；域名解析和公网 HTTPS 已核验。OpenResty 是既有 1Panel 容器，本站没有新增应用容器。
- 新安装 Debian 签名仓库的 webhook 2.8.0-4+b19；禁用发行版默认服务，独立 `lowendaff-webhook` 只监听回环 9000，使用 lowendaff-deploy 用户。
- 原网站目录备份：`/root/lowendaff-backups/20261109T025925Z/site-before.tar.gz`；SHA-256 `6cd8bae89b80f5d782ec1a709a1a82935dd40a4d0a5f125ca99d7183b32971bb`。HTTPS 配置修改前另备份 `site-with-tls.conf`；未改动证书私钥。
- 网站根保留原 1Panel 路径，改为指向 `.deploy/current`；初始默认页保存在 `.deploy/releases/bootstrap`。OpenResty 增加一个 HTTPS Webhook 代理 include，配置检查通过后 reload。
- 添加 CI 产物上传与成功运行通知工作流。下载授权来自 CI 临时签名地址，服务器无需 GitHub PAT 或 SSH 凭据；仓库新增共享 HMAC Secret，其值不进入 Git 或报告。
- HTTP 接收与 HMAC 验证使用 adnanh/webhook；Python 仅为已有系统运行时上的一次性安全 ZIP/文件切换助手，不运行 HTTP 服务。不安装 Node/npm。

## 检查范围

本地 Astro 格式、类型、构建、发布元数据、Markdown 解析器与模板正反例检查通过。部署单元测试覆盖来源、过期、下载域名、校验和、路径穿越/符号链接/重复 ZIP 项、解压大小、清单不符、旧通知与重复通知、上线失败回退、手动回退保留水位。

公网入口无签名请求返回 403；签名正确但来源无效的请求由部署程序拒绝（HTTP 500），未改变当前站点。真实 CI 发布、重复通知和回退演练结果以本目录后续记录及 `test-results/deploy-rehearsal/` 回执为准，不以单元测试推断。

## 实际演练结果

- 首次发布提交 `34d136fb80f28909c3240efa3603c188191c00f8`；Content validation 运行 `42554620014` 与 Deploy static site 运行 `42554686070` 均成功。公网 `deployment.json` 与该提交、run ID 完全一致。
- 产物 ID `13646168749`，4,909,776 bytes，SHA-256 `e7fb7cf22a91aaf8929383dd7129c00c2eba0b65167a888a2c22c4d6d1ccdbdb`。由 CI 上传和服务器下载，未通过 SSH 上传本地 dist。
- 公网重复与较旧通知返回 200 ignored，未下载或切换；过期通知被拒绝。Debian webhook 2.8.0 对错误 HMAC 返回 500，对缺失签名/错误事件返回 403，均未触发成功发布；不将所有拒绝误报为 403。
- 实际执行 `--rollback releases/bootstrap`，公网确认原默认首页，再恢复首次 CI 版本并核对清单。回退期间重放原成功通知仍被忽略，成功构建水位未下降。自动健康检查失败回退另有单元测试，未故意中断公网 OpenResty。
- 线上首页、标签云、广告页、robots、RSS、sitemap 均 HTTP 200。浏览器验证 390/1440px × 明暗模式 × 三页，共 12 组；无横向溢出、缺图、请求失败或 JS 错误。截图与回执在 `test-results/deploy-rehearsal/`。
- systemd 服务 active、零重启，监听地址为 `127.0.0.1:9000`，临时 payload 文件已清理；服务器没有 Node/npm。现有 1Panel unit 的 StartLimitIntervalSec 位置警告属于原配置，本次未修改其服务。

后续文档提交同样走自动部署；最终 Git HEAD、构建/部署运行和公网清单以 `test-results/deploy-rehearsal/final-receipt.json` 为准。维护文档不会通过写入自身最终 commit hash 触发循环提交。

OpenViking 归档：`viking://resources/projects/lowendaff-ui/deploy-rehearsal.md`；全文回读回执置于同一测试结果目录。报告全文存储与语义索引完成是不同状态。

演练保留 noindex，文章集合仍为空，没有恢复任何历史 posts。详细维护与恢复步骤见 `../deployment.md`。
