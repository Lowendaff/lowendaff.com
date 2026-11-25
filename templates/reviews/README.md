# 测评生成与 MDX 模板指南

本站测评页面统一沿用「套餐与购买 → 配置与性能 → 服务解锁 → 网络检测 → 路由追踪」结构化阅读视图，正文采用易读 Markdown（`format: review-markdown`），无需手写 import、JSX、表格 ID 或嵌套 YAML。

## 标准生产路径：从 `lowendaff-bench` JSON 一键导入（推荐）

拿到 `lowendaff-bench`（`v0.1.2+`）生成的 JSON 报告后，优先通过官方导入命令生成标准草稿与脱敏 BGP SVG，不手工抄表：

```sh
npm run review:import -- \
  --report /path/to/report.json \
  --meta /path/to/editorial.json \
  --out src/content/posts/vendor-hk-vps.mdx
```

`editorial.json` 只填写报告之外的社论与地理信息（也可直接通过 `--vendor`、`--city`、`--lat`、`--lon` 等命令行参数传入）：

```json
{
  "vendor": "GoMami",
  "country": "HK",
  "location": "香港",
  "geo": { "city": "香港", "latitude": 22.27832, "longitude": 114.17469 },
  "publishedAt": "2026-11-25",
  "testedAt": "2026-11-25 18:06 CST",
  "tags": ["EPYC", "三网优化"],
  "affiliate": false
}
```

导入器会自动完成：

- 按 `system.platform.kind` 识别 `vps` 或 `dedicated`，生成规范化 `permalink` 并校验全站唯一；
- 校验并输出脱敏后的 `/archive-assets/<slug>/bgp-ipv4.svg`（及 `bgp-ipv6.svg`），即使输入报告误开 `show_ip: true` 也会自动抹除本机公网地址与前缀；
- 生成 `%st` / `%si` 交互折线图（`vm-cpu-telemetry` 代码块）、系统运行时间与负载、CPU 八项基准（含 `7-Zip` / `y-cruncher` CPU 利用率）、拆分 `路由宣告 ASN` 与 `RIR 网段登记标识（org）` 的 `IP 质量检测`、拆分的 Cloudflare / Apple CDN 吞吐与延迟表、6 列标准路由表与 `TCP 大包回程路由`；
- 若未来 `lowendaff-bench` 新增未适配的测试插件或 CPU 子项，导入器会直接报错提醒升级映射，绝不静默漏项；
- 自动格式化为符合 Prettier 规范的 `.mdx`（默认 `draft: true`），作者只需补充可选的 `## 买` 与 `## 评`，确认无误后将 `draft` 改为 `false`。字段映射细则见 [v0.1.2 报告对照说明](../../docs/changes/bench-report-v0.1.2.md)。

## 手工模板选择与使用

无自动采集报告、需手工整理的测评可从以下模板起步：

| 模板                   | 适用内容                | 标准章节契约（`benchVersion: '0.1.2'`）                                                                                |
| ---------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `vps.mdx`              | VPS / 云服务器测评      | 系统信息（含 `vm-cpu-telemetry`）、CPU、磁盘、网络信息、IP 质量检测、服务解锁、网络带宽、路由追踪、TCP 大包回程路由    |
| `dedicated-server.mdx` | 独立服务器 / 裸金属测评 | 系统信息（含硬件/DIMM/NUMA/dmidecode）、CPU、磁盘（含 SMART/fio）、网络信息、IP 质量检测、服务解锁、网络带宽、路由追踪 |

```sh
cp templates/reviews/vps.mdx src/content/posts/vendor-location-vps.mdx
# 或选独服模板：
cp templates/reviews/dedicated-server.mdx src/content/posts/vendor-location-dedicated.mdx
```

模板放在内容集合之外，不会生成文章。复制后默认 `draft: true`。若某台机器客观缺少某标准章节（例如 LXC 容器无 `vm-cpu-telemetry`、目标机未开启 `TCP 大包回程路由`），删除空章节并在 Frontmatter 的 `omittedSections` 显式列出，如 `omittedSections: ['vm-cpu-telemetry']`。`draft: false` 正式发布时，构建门禁会自动拦截残留的 `待填写`、`example.com/replace-` 占位符以及缺失的 `/archive-assets/` 本地配图。

## 自动生成 URL

URL 规则为 `/reviews/{规范化标题}-{YYYYMMDD}/`，保留中文与末尾 `/`；国旗/Emoji 和标点不进入地址，英文小写、空格变连字符。日期取 `testedAt` 开头的真实测试日期，不能用发布日期或构建时间代替。`testedAt` 例如 `'2026-11-25 18:06 CST'`，也允许只有 `'2026-11-25'`。

```sh
npm run urls:fill -- --dry-run  # 预览所有缺失地址
npm run urls:fill               # 补全所有缺失地址，写回 Frontmatter
npm run urls:check              # 只检查，不改文件
```

生成的 `permalink` 是唯一地址来源，文件名仍可使用简短英文名称。已发布文章改标题或纠正日期必须保留原地址。站点不兼容旧地址，不提供别名或 301；`redirectFrom`、`originalUrl` 会被 CI 和构建拒绝。

## 地球地图坐标（必填）

每篇文章（包括草稿）必须填写 `geo.city`、`geo.latitude` 和 `geo.longitude`。模板中的 `null` 必须替换成真实数字：

```yaml
geo:
  city: 香港
  latitude: 22.27832
  longitude: 114.17469
```

纬度范围 `-90..90`，北纬为正；经度范围 `-180..180`，东经为正。使用被测机器所在城市的参考坐标，不使用测试端所在地、商家总部或 IP 数据库推测结果。

## 章节与页面映射

二级标题是机器可识别的章节名称；三级、四级标题细分工具、设备与测试类别：

| Markdown 二级标题                             | 页面位置 / 写法                                                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `买`、`评`                                    | 套餐与购买、作者评价和附件，直接显示                                                                                 |
| `系统信息`                                    | 配置与性能 → 系统；包含实测平台、`vm-cpu-telemetry` 折线图、内存读写/带宽/延迟、NUMA、拓扑图、dmidecode              |
| `CPU 性能测试`                                | 配置与性能 → CPU；Geekbench、sysbench、UnixBench、7-Zip、PassMark、HPL、y-cruncher、Prime95 按三级标题分组           |
| `磁盘性能测试`                                | 配置与性能 → 磁盘；磁盘与文件系统、SMART 与健康状态、fio 分组                                                        |
| `网络信息`、`BGP 透视`                        | 配置与性能 → 网络与 IP                                                                                               |
| `IP 质量检测`                                 | 配置与性能 → IP 质量；区分 `路由宣告 ASN` 与 `RIR 网段登记标识（org）`，记录多源评分、风险维度、DNSBL 与 25 端口状态 |
| `服务解锁测试`                                | 三级写 IPv4 / IPv6，四级写 Multination / 地区类别，自动按检测类别合并                                                |
| `网络带宽测试`                                | 网络检测 → 地区节点（iperf3 国际节点与泰尔国内运营商测速）                                                           |
| `Cloudflare Speedtest`、`Apple CDN Speedtest` | 网络检测 → 独立工具页签；吞吐/流量与空载/负载延迟拆表展示，保证桌面端零横向溢出                                      |
| `路由追踪`                                    | 路由追踪 → 回程路由（ICMP）；三级写中国境内目标 / 主要公共服务 / 主要国际网络运营商                                  |
| `TCP 大包回程路由`                            | 路由追踪 → TCP 大包回程；对照大小包是否走不同回程路径及分片 MTU 限制                                                 |
| `去程路由追踪`                                | 路由追踪 → 去程路由；无独立外部探针证据时省略                                                                        |

### 标准 6 列路由表契约

声明 `benchVersion` 的测评中，`路由追踪`、`TCP 大包回程路由` 与 `去程路由追踪` 下的所有表格必须使用统一 6 列表头（顺序与列名由 Schema 强校验）：

```markdown
| 跳数 | 应答地址（脱敏） | ASN | 运营商 | 位置 | 最小 RTT（ms） |
```

- 整跳无应答时在地址格写 `\*`，其余格填 `—` 或留空；连续无应答跳由前端自动合并显示为范围（如 `8–11　*`）。
- Netflix 等公共服务节点命中 IX 交换中心时，在 `运营商` 列追加 `[Equinix Hong Kong]` 等交换点标注。

## BGP 图片、原始输出与哔哩哔哩视频

- **BGP 与硬件图片**：放入 `public/archive-assets/文章名/`，正文独立一段写 `![IPv4 BGP 透视](/archive-assets/vendor-location/bgp-ipv4.svg)`。
- **虚拟化遥测图表**：在 `## 系统信息` 下使用 `vm-cpu-telemetry` 代码围栏嵌入 JSON，页面自动通过按需裁剪的 ECharts 渲染支持时间轴拖拽缩放、峰值标注与深浅色实时切换的 `%st` / `%si` 折线图。
- **原始输出**：支持 `text` 代码围栏原样展示 `dmidecode`、`smartctl` 等终端文本，不执行脚本。
- **行内哔哩哔哩视频（可选）**：在 `## 评` 等章节独立一行写 `[视频说明](https://www.bilibili.com/video/BV1P3411W7dj/)` 即可渲染播放器。
