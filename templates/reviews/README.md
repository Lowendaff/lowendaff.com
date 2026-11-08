# 测评 MDX 模板

两份模板沿用本站「套餐与购买 → 配置与性能 → 服务解锁 → 网络检测 → 路由追踪」的分组界面，正文使用普通 Markdown，无需 import、JSX、表格 ID 或嵌套 YAML 数据。

## 选择与使用

| 模板 | 适用内容 | 特有内容 |
| --- | --- | --- |
| `vps.mdx` | VPS / 云服务器测评 | vCPU、虚拟化、资源限制、虚拟磁盘 |
| `dedicated-server.mdx` | 独立服务器 / 裸金属测评 | CPU 颗数/物理核心/线程、NUMA、内存条、拓扑、SMART、RAID、dmidecode |

```sh
cp templates/reviews/vps.mdx src/content/posts/vendor-location-vps.mdx
# 或选独服模板：
cp templates/reviews/dedicated-server.mdx src/content/posts/vendor-location-dedicated.mdx
```

模板放在内容集合之外，不会生成文章。复制后默认 `draft: true`，草稿不会生成可访问的文章页面。替换全部「待填写」、示例链接和日期，删除不适用的段落/测试，再改为 `draft: false` 本地预览；发布前运行 `npm run check && npm run build`。不要将占位模板当成真实测评发布。

## 元数据

- `reviewType`：`vps` 或 `dedicated`，驱动首页/标签云类型筛选、列表标签、文章头部类型和返回列表链接，也控制标题缺少测评后缀时的类型。新文章明确填写；省略时兼容为 `vps`，其他值会构建报错。不要根据商家名或标题猜产品类型。
- `title`：建议写完整标题，如「商家 地区 独立服务器测试记录」。页面不会再重复追加 VPS 字样。
- `country`：两位地区码，如 `US`、`SG`、`HK`、`TW`，未知用 `''`。`location` 写实际机房，GeoIP 误差在正文说明。
- `publishedAt` 使用引号包裹的 `YYYY-MM-DD`；`testedAt` 可写日期、时段、时区；模板日期必须替换。
- `categories`、`tags` 自由填写；商家和国家筛选仍分别读取 `vendor`、`country`。
- 新文章不用填 `originalUrl`、`archiveSnapshot`、`evidence`、`compatibility`、`showcase`。这些是历史迁移或展示页选样信息。
- 有 Affiliate 时设 `affiliate: true`、填写真实 `purchaseUrl`，正文明确披露返佣关系；正文购买链接与 `purchaseUrl` 保持一致。优惠和价格以具体测试/活动日期为准。
- 广告和 Sponsors 继续在各自 Markdown 集合维护，不塞进文章模板。

## 章节与页面映射

二级标题是机器可识别的章节名称；三级、四级标题可以细分工具、设备、测试类别。没有测试可以**整节删除**，页面和目录不生成对应空栏目，不必填 N/A 凑齐模板。保留原始结果中的 N/A、busy、超时、空值，不能代换为零。

| Markdown 二级标题 | 页面位置 / 写法 |
| --- | --- |
| `买`、`评` | 套餐与购买、作者评价和附件，直接显示 |
| `系统信息` | 配置与性能 → 系统；独服拓扑、NUMA、dmidecode、内存性能放三级标题下 |
| `CPU 性能测试` | 配置与性能 → CPU；不同工具/版本用三级标题分开 |
| `磁盘性能测试` | 配置与性能 → 磁盘；清单、RAID、SMART、fio 分组 |
| `网络信息`、`BGP 透视` | 配置与性能 → 网络与 IP |
| `服务解锁测试` | 三级写 IPv4 / IPv6，四级写 AIGC / Multination / 地区类别，自动按检测类别合并 |
| `网络带宽测试` | 网络检测 → 地区节点 |
| `Cloudflare Speedtest`、`Apple CDN Speedtest` | 可选工具页签，页面不重复显示这些冗长章节标题 |
| `路由追踪` | 回程，三级写中国境内目标 / 主要公共服务 / 主要国际网络运营商，四级写节点及协议 |
| `去程路由追踪` | 去程，三级写来源运营商，四级写来源城市、目标及协议 |

不要新增 `## SMART` 或 `## Geekbench` 这样的顶层章节；分别写成 `磁盘性能测试` 下的 `### SMART`、`CPU 性能测试` 下的 `### Geekbench 6`，避免脱离现有布局。未知二级标题会报错，不会悄悄丢掉正文。一级标题也被当作章节，建议统一使用二级，文章大标题来自 Frontmatter。

## 独服内容取舍

模板参考了 Taipei101、YxVM、MEJIRO 和 Megalayer 的历史独服文章。独服需要把**套餐承诺、实际硬件、健康信息、性能数据**分开：

- CPU 分别记录颗数、物理核心、线程，不能直接把工具报告的逻辑 CPU 数写成物理核数。
- 内存记录类型、ECC、条数和实际运行频率；硬件拓扑图与 dmidecode 可按实测补充。
- 多盘 SMART 按设备分别写；NVMe、SATA SSD、HDD 保留各自实际指标，不套用不存在的字段。不凭不明厂商属性推算剩余寿命。
- 单盘与 RAID 测试区分目标、缓存、文件系统和参数；原始输出可直接用代码围栏，原文不应为迎合表格而丢失。
- VPS 不要求填写宿主机 SMART、物理插槽或真实磁盘型号；只报告虚拟机可观察和已核验的信息。

## BGP 与硬件图片

把实际文件放入 `public/archive-assets/文章名/`，正文引用站点根路径。图片独占一段；BGP alt 必须包含对应的 IPv4 / IPv6。没有图片就删除对应段或整节，模板不附带虚构配图。

```markdown
## BGP 透视

### IPv4

![IPv4 BGP 透视](/archive-assets/vendor-location/bgp-ipv4.png)

### IPv6

![IPv6 BGP 透视](/archive-assets/vendor-location/bgp-ipv6.png)
```

拓扑图放到 `## 系统信息` 下：

```markdown
### 硬件拓扑

![CPU、NUMA 与内存拓扑](/archive-assets/vendor-location/topology.png)
```

历史外部图仍可配合 `images` 字段指定本地副本；只有外链、没有本地副本时，保留现有缺图提示和查看链接。发布前确认本地图片确实存在。

## 原始输出与可选网络工具

支持 `text` 等代码围栏，内容作为文本原样显示，不执行命令，不把里面的 HTML 当页面代码。可放在 CPU、SMART、系统等分组中；路由代码围栏沿用同样的三级、四级分组规则，也可通过运营商和节点选择器查看。

````markdown
### SMART 原始输出

```text
在这里粘贴实际 smartctl 输出，不需要转成 YAML 或逐行加引号。
```
````

需要 Cloudflare 或 Apple CDN 时，复制下方结构，将二级标题换成对应名称。速度和延迟分别列出，不混成一个成绩；没有执行这项工具就不添加。

```markdown
## Cloudflare Speedtest

### 速度测试

| 项目 | 结果 |
| --- | --- |
| 下载 | 待填写 Mbps |
| 上传 | 待填写 Mbps |

### 延迟测试

| 项目 | 结果 |
| --- | --- |
| 空载延迟 | 待填写 ms |
| 下载负载延迟 | 待填写 ms |
| 上传负载延迟 | 待填写 ms |
```

## 写作边界

正文支持段落、加粗、行内代码、显式链接、单段引用、表格、独立图片和代码围栏。不支持列表、多段引用、引用式链接或 JSX；复杂原始输出放代码块。表格单元格用纯文本，链接单独放段落，避免链接目标在表格转换中丢失。

表头与每行列数一致；单元格字面竖线写 `\|`，字面星号写 `\*`。保留工具版本、单位、测试条件和时间；多个测试节点用不同四级标题。无关的硬件序列号、UUID、管理地址或口令不要发布。

不加入 IP 质量分析、Generated at、展开全部、对照快照按钮或底部重复优惠。模板不是采集脚本，也不自动恢复文章。
