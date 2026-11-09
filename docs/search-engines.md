# 搜索引擎接入与 IndexNow

Google 和 Bing 的站点验证及 Sitemap 提交已完成，回执见 `changes/search-console-onboarding.md`。IndexNow 用于通知参与协议的引擎页面发生变化，不替代 Google Search Console，也不保证收录或排名。

## 配置入口

编辑 `src/config/search-engines.json`：

- `site`：本站正式来源，目前限定为 `https://lowendaff.com`。
- `indexNow.enabled`：自动通知开关；关闭后不发送，也不生成验证文件。
- `indexNow.key`：32 位小写十六进制所有权验证值，由构建生成根目录下同名 `.txt` 文件。它不是服务器密码或站长后台登录凭据，不需要额外 GitHub Secret。轮换必须先部署新验证文件。
- `indexNow.endpoint`：限定为官方统一端点 `https://api.indexnow.org/indexnow`。

构建与 Actions 共用严格校验，不接受任意外部端点或跨域 URL。所有通知只在 GitHub Actions 执行；浏览器不发送 IndexNow 请求，服务器不增加 Node.js/npm 或常驻程序。

## 发布与差异通知

1. 构建从真实 `sitemap.xml` 读取可收录页面，生成 `search-index.json`。指纹覆盖标题、描述、正文、表格、链接、图片描述、本地图像字节及结构化数据；忽略 CSS 属性、脚本和装饰性 SVG。外部图片不在构建期间下载，替换外部图片应更新 URL 或文章内容。
2. 正式构建生成验证文件，预览构建不生成；草稿、组件页、空标签页和筛选 URL 不进入通知集合。
3. 构建清单记录内容索引的 SHA-256。CI 在部署前读取线上旧索引；Webhook 发布成功后再次核对公网的 commit、runId、runAttempt、indexable、内容索引校验和及验证文件内容。
4. 根据上次通知状态计算新增、修改和删除 URL。每批最多 10,000 个，只提交真实变化与待重试项目。首次启用提交当前可收录页面，纯样式修改不通知。
5. `indexnow-state` Actions 产物保存已观察内容和未确认 URL。发送前保存待办，每批收到 HTTP 200/202 后才移除；失败保留待办，下次发布或手动重试继续处理。HTTP 202 只是已接受且等待 key 验证。

每个批次前重新检查线上版本。站点被回退或已切换到不同版本时停止发送，不能把 Webhook 的重复请求回执当作当前部署成功证明。

## 失败与重试

IndexNow 步骤失败会显示 Actions warning 和步骤摘要，不回滚网站。通知状态仍上传为产物；若状态上传本身失败，工作流会失败，需检查 Actions 日志后重试。

在 GitHub Actions 中手动运行 **Deploy static site**，选择 `main`：这个手工入口只重试 IndexNow，不重新部署网页。只有 main 提交与线上版本一致时允许发送。也可以重跑原部署工作流；仍会核验实际线上构建。

状态产物保留 90 天，受 GitHub 仓库保留策略约束，不是永久存储。产物过期后，正常发布使用部署前快照继续检测当次删除；没有快照的首次/手工运行提交当前页面。已过期产物里的更早失败删除通知无法自动恢复，因此不要让失败通知长期无人处理。重新提交可能重复通知同一 URL；跨网络请求与产物上传不能保证严格 exactly-once。

## 检查

```sh
npm run verify:indexnow
PUBLIC_SITE_INDEXABLE=true npm run build
PUBLIC_SITE_INDEXABLE=true npm run verify:release
```

CI 同时运行上述通知规则测试和发布模式验证。部署后检查公网 `deployment.json`、`search-index.json` 及验证文件，再查看 Actions 摘要中的实际 HTTP 状态；不能以单元测试或 Sitemap 成功代替 IndexNow 提交回执。

官方协议：https://www.indexnow.org/documentation 。百度搜索资源平台已于 2026-11-09 按用户决定跳过，不接入验证或提交凭据。
