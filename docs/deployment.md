# CI 产物与 Webhook 部署

站点只运行静态文件。Node.js/npm 仅在 GitHub Actions 中使用；服务器的 HTTP 接收器是 Debian 提供的 `adnanh/webhook`，由 systemd 管理。`deploy/deploy.py` 是一次性安装辅助程序，使用系统自带 Python 标准库校验 ZIP 与切换文件，不监听端口。

## 发布链路

1. `main` push 或手动运行 `Content validation`：检查格式、类型、文章模板及部署规则，构建 `dist/`，写入 `deployment.json`，上传固定提交的产物，保存 7 天。
2. `Deploy static site` 响应成功的 `workflow_run`，核验来源仓库、分支、工作流和当前 main 提交。PR、失败运行与已落后 main 的构建不发布。
3. 通知任务使用仅本次有效的 `GITHUB_TOKEN` 获取产物短期下载地址，通过 HTTPS 发送 HMAC-SHA256 签名请求。GitHub 仓库只保存 `DEPLOY_WEBHOOK_SECRET`，不保存服务器 SSH 凭据。
4. OpenResty 将 `/hooks/deploy-site` 代理到 `127.0.0.1:9000`。webhook 验签并执行固定程序，同步返回部署结果；500/网络错误会触发通知端重试，每次重新获取下载地址。
5. 安装程序校验来源、时间、产物 SHA-256、ZIP 文件类型/路径/大小及构建清单；加锁、拒绝重复和旧运行，再原子切换相对软链接。通过本机 OpenResty HTTPS 检查清单和首页；失败恢复原链接。

服务器不保存 GitHub 长期令牌、源码或 npm 依赖。短期下载地址不会写入部署状态或日志。hook 请求临时文件由 webhook 清理；不要启用 debug 或记录请求正文。

自动更新范围只有静态产物。`deploy/` 内接收器配置、部署程序和 systemd unit 的修改，需要另行备份并安装到服务器，不会随网页产物自动替换。

## 服务器布局

| 路径/服务 | 用途 |
| --- | --- |
| `/opt/1panel/www/sites/lowendaff.com/index` | 1Panel 网站根，软链接到 `.deploy/current` |
| 同站点目录下 `.deploy/releases/` | 完整静态版本；`bootstrap` 保存原始默认站点 |
| `.deploy/current`、`.deploy/state.json` | 当前相对链接与成功构建水位/回退记录 |
| `/etc/lowendaff-webhook/hooks.json` | 签名配置，root:lowendaff-deploy 0640，不纳入 Git |
| `/usr/local/lib/lowendaff-deploy/deploy.py` | root 管理的部署程序，服务用户不可修改 |
| `/etc/systemd/system/lowendaff-webhook.service` | 低权限服务，只写状态和版本目录 |
| 站点目录下 `webhook-location.conf` | OpenResty 代理片段，由域名配置 include |

1Panel 已将宿主机 `/opt/1panel/www` 挂载到 OpenResty 的 `/www`，所以版本、根目录和相对链接均放在此挂载内。不要将 index 改为指向容器不可见的宿主机路径。通过 1Panel 编辑配置后，核查代理 include 和 index 软链接仍存在。

## 检查与回退

```sh
systemctl status lowendaff-webhook
readlink /opt/1panel/www/sites/lowendaff.com/.deploy/current
curl --fail https://lowendaff.com/deployment.json
docker exec 1Panel-openresty-nIbq openresty -t
```

回退时从服务器 `.deploy/state.json` 的 previous 或 releases 目录选择明确版本，以服务身份执行：

```sh
runuser -u lowendaff-deploy -- /usr/local/lib/lowendaff-deploy/deploy.py \
  --rollback releases/RUN_ID-ATTEMPT-COMMIT_PREFIX
```

回退不会降低成功构建水位，延迟或重复通知无法覆盖回退结果。重新发布应创建新构建或重跑验证工作流以增加 attempt，不能仅重跑已被消费的通知。首次默认站点可用 `--rollback releases/bootstrap`；它没有构建清单，需手动核验 HTTP。

目前保留各版本供演练，不自动清理；后续清理必须避开当前与回退版本。短期地址过期时重跑通知任务重新取址；超过 7 天的产物需重新构建。GitHub 的公开仓库不代表 Actions 产物可匿名通过 API 下载，此流程由 CI 获取临时授权地址。

## 演练与正式发布边界

默认保持 noindex。CI 仅在非 PR 的 main 构建且 GitHub 仓库变量 `SITE_INDEXABLE=true` 时设置 `PUBLIC_SITE_INDEXABLE=true`。发布验证从同一环境读取模式；临时夹具测试结束后，CI 必须重新构建并校验真实内容，再创建部署清单，避免上传测试留下的预览产物。

正式收录同时需要服务器部署程序支持。安装本次 `deploy/deploy.py` 前备份旧文件；在 `lowendaff-webhook.service` 的 systemd drop-in `[Service]` 中设置 `Environment=LOWENDAFF_SITE_INDEXABLE=true`，随后 daemon-reload 和重启接收服务。该值默认 false，CI 清单模式与服务器不一致会拒绝发布。安装器还验证 HTML robots、robots.txt 和 sitemap 的实际内容，不能只改清单冒充开放。修改安装器需要另行同步，不会随静态产物更新。

发布后核验 `/deployment.json` 的 `indexable`、首页 robots meta、`/robots.txt`、`/sitemap.xml` 及 `/llms.txt`。回退健康检查依据回退版本清单，允许恢复到之前的 noindex 版本；后续新部署仍按当前服务配置验证。搜索收录需用户确认，配置能力的加入本身不代表已开启。

当前文章集合为空，不恢复旧文章，不为本次部署新增旧网址迁移规则。静态部署不提供服务端 CMS 或动态文章编辑。

测试：`python3 -m unittest discover -s tests/deployment -v`；现有 Astro 检查按 `AGENTS.md` 执行。通知流程必须用真实 CI 产物验证，单元测试不能代替公网发布证据。演练备份和运行回执记录于 `docs/changes/deploy-rehearsal.md` 及被忽略的 `test-results/deploy-rehearsal/`。
