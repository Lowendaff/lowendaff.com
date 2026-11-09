# 友情链接核验与清理

检查日期：2026-11-09。用户要求删除无法访问或没有本站友链的条目，并补全虎窝地址。数据源为 `src/data/friends.json`。

## 检查结果

| 条目 | 核验页面/访问情况 | 本站友链 | 处理 |
| --- | --- | --- | --- |
| 米莉亚の小破站 | `https://mireya.moe/` 本机重复请求及服务器均超时 | 无法核验 | 删除 |
| 霧雨魔法店 | `https://idc.abyss.moe/` 两地均 TLS unrecognized name | 无法核验 | 删除 |
| 🐟师傅 | `https://www.bug.cy/link` HTTP 200 | 直接链接到本站 | 保留 |
| 主机百科 | `https://zhujiwiki.com/` HTTP 200 | 首页直接链接到本站 | 保留 |
| 古博 | `https://www.gubo.org/` HTTP 200 | 首页直接链接到本站 | 保留 |
| VPSlooking | `https://vpslooking.com/links` HTTP 200 | 直接链接到本站 | 保留 |
| VAVE乐园 | `https://vave.men/` HTTP 200 | 首页直接链接到本站 | 保留 |
| 虎窝（阿虎的博客） | `https://blog.ahu.moe/peers.html` HTTP 200 | Lowendaff! 经站内 /go/ 链接 HTTP 302 到 `https://lowendaff.com/` | 地址补为 `https://blog.ahu.moe/` |
| HostEvaluate | `https://www.hostevaluate.com/`；此前请求未能解析，用户随后确认站点存在并要求恢复 | 前次未能核验；按用户确认保留 | 已恢复 |
| VPS主机小镇 | `https://www.vpsxz.net/` HTTP 200 | 首页直接链接到本站 | 保留 |
| nanase’s REVIEW | `https://review.nxtrace.org/` HTTP 200 | 首页直接链接到本站 | 保留 |

初次清理从 11 项调整为 8 项；用户随后确认 HostEvaluate 存在，已按原地址恢复，当前共 9 项。没有把“首页未出现本站”当作缺少友链：继续检查了独立友链页；虎窝的站内跳转也经过实际 HTTP 验证。此次没有仅因缺少互链而删除的可访问站点。访问失败描述只代表本次双端检查结果。

## 验证与发布

不改动友情链接展示组件。提交前运行格式、类型、正式构建和现有发布/正文检查；确认首页渲染 9 个友链按钮、虎窝链接正确且不再有“暂无链接”占位。

原始网页和 HTTP 证据保存在被忽略的 `test-results/friend-links/`：`homepage-checks.json`、`detail-checks.json`、`server-rechecks.json`、`tiger-outbound-headers.txt`。初次清理回执为 `deployment-receipt.json`；恢复 HostEvaluate 的最新发布回执为 `test-results/restore-hostevaluate/deployment-receipt.json`。用户确认优先于之前的临时访问失败，不据前次结果再次删除 HostEvaluate。

OpenViking：`viking://resources/projects/lowendaff-ui/friend-links-audit.md`。
