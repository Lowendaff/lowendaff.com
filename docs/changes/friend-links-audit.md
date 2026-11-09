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
| HostEvaluate | `https://www.hostevaluate.com/` 及根域两地均无可用 DNS 地址 | 无法核验 | 删除 |
| VPS主机小镇 | `https://www.vpsxz.net/` HTTP 200 | 首页直接链接到本站 | 保留 |
| nanase’s REVIEW | `https://review.nxtrace.org/` HTTP 200 | 首页直接链接到本站 | 保留 |

从 11 项调整为 8 项。没有把“首页未出现本站”当作缺少友链：继续检查了独立友链页；虎窝的站内跳转也经过实际 HTTP 验证。此次没有仅因缺少互链而删除的可访问站点。访问失败描述只代表本次双端检查结果。

## 验证与发布

不改动友情链接展示组件。提交前运行格式、类型、正式构建和现有发布/正文检查；确认首页渲染 8 个有效外链、虎窝链接正确且不再有“暂无链接”占位。

原始网页和 HTTP 证据保存在被忽略的 `test-results/friend-links/`：`homepage-checks.json`、`detail-checks.json`、`server-rechecks.json`、`tiger-outbound-headers.txt`。发布后以 `deployment-receipt.json` 记录最终提交、CI/Webhook 和线上渲染结果。

OpenViking：`viking://resources/projects/lowendaff-ui/friend-links-audit.md`。
