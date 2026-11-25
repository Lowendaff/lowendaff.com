# 从 lowendaff-bench v0.1.2 生成标准 VPS 与独服测评

自 `lowendaff-bench` `v0.1.2` 起，站点采用「官方导入器 + 模板规范 + Schema 契约门禁 + 基准夹具回归」四层闭环保证每篇 VPS 与独立服务器测评内容完整、口径统一、桌面端表格零横向溢出。早期手工对照说明 `docs/changes/dedicated-bench-report-v0.1.1.md` 作为历史归档保留，现行标准以本文为准。

## 1. 官方导入命令

```sh
npm run review:import -- \
  --report /path/to/report.json \
  --meta /path/to/editorial.json \
  --out src/content/posts/vendor-hk-vps.mdx
```

导入逻辑集中在纯函数模块 `src/lib/bench-report-import.ts`，CLI 封装在 `scripts/import-bench-report.mjs`。它具备两项防漏保护：

1. **未知插件 / 子项硬阻断**：遍历 `runs[]` 与 `cpu.bench` 子项，一旦未来 `lowendaff-bench` 新增了不在已知白名单中的插件 ID 或 CPU 测试套，导入直接抛错，杜绝静默丢数据。
2. **强制脱敏与 SVG 白名单清洗**：无论输入 JSON 的 `show_ip` 为 `true` 或 `false`，导入器都会对公网 IPv4/IPv6、CIDR 前缀、路由跳点及内联 BGP SVG 文本做脱敏处理，并按严格标签与属性白名单校验 SVG。

## 2. 报告字段与页面映射对照表

| 报告来源                                                            | 页面章节 / 组件                              | 标准展示口径                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `system`                                                            | `系统信息` → `实测平台`                      | 区分虚拟化环境与裸机硬件（主板/固件/BMC/DIMM/ECC）；完整记录根文件系统总计/已用/可用容量、系统运行时间、采样时 `1 / 5 / 15 min` 负载（带宿主机标记）及拥塞控制/队列。                                                                                                            |
| `vm_cpu_telemetry`                                                  | `系统信息` → `虚拟化 CPU 抢占与软中断采样`   | 生成 `vm-cpu-telemetry` 代码块与均值/P95/峰值汇总表；前端由 `VmCpuTelemetryChart.astro` + ECharts 渲染 `%st` / `%si` 双序列折线图，内置底部时间轴拖拽缩放、Y 轴自适应重算与深浅色主题联动。                                                                                      |
| `memory.sysbench`、`memory.stream`、`memory.latency`、`memory.numa` | `系统信息` 子分组                            | 保留 `MiB/s` 与 `MB/s` 原生单位；`below_rule: true` 时注明大容量 L3 缓存加速影响；独服多节点输出 `NUMA 本地与跨节点访问`。                                                                                                                                                       |
| `cpu.bench`                                                         | `CPU 性能测试`                               | 完整覆盖 Geekbench（含临时 swap 说明与成绩外链）、sysbench、UnixBench（总指数 + 12 子项）、7-Zip（含 `usage_pct` CPU 利用率与 `ru_mips` 单核效率）、PassMark（总分 + 8 子项）、HPL、y-cruncher（含 `cpu_utilization_pct` CPU 利用率与多核效率）、Prime95（附短时压力边界说明）。 |
| `disk.health`、`disk.fio`                                           | `磁盘性能测试`                               | 兼容 NVMe（`Named` + `Count` 坏块数）与阵列卡成员盘（`Card` + `Sectors` 重映射/待定扇区）；fio 按 `4k / 64k / 512k / 1m` 列读写 `KiB/s` 与 IOPS。                                                                                                                                |
| `network.bgp`                                                       | `网络信息` + `BGP 透视`                      | 汇总宣告前缀、起源 ASN（附 `asn_names` 名称）、RPKI、不同路径数、观测对等体数与直接上游；内联 `svg` 经白名单清洗后落盘至 `public/archive-assets/<slug>/bgp-ipv4.svg`（及 `bgp-ipv6.svg`）。                                                                                      |
| `ip.quality`                                                        | `IP 质量检测`（配置与性能 → `IP 质量` 页签） | 将实时 BGP 宣告的 `路由宣告 ASN`（`asn`）与 RIR WHOIS 静态登记的 `RIR 网段登记标识（org）` 拆分为两行独立展示，避免读者误判上游归属；完整展示原生/广播判定、场景分类、多源风险评分、风险特征维度、DNSBL 黑名单统计与邮局 25 端口 SMTP 状态。                                     |
| `ip.media`                                                          | `服务解锁测试`                               | 按 IPv4 / IPv6 与五大区域分组，保留 `Yes`、`OriginalsOnly`、`No`（含 `ProxyDetected` 等限制原因）、`BlockedWaf`、`RateLimited`、`TimedOut` 原始判定。                                                                                                                            |
| `network.iperf3`、`network.taier`                                   | `网络带宽测试`                               | iperf3 支持双栈表并转换 `Mbps` 与 `ms`；泰尔保留 `完成`、`不可达`、`节点繁忙`、`超时`、`失败（原因）` 等全部状态。                                                                                                                                                               |
| `network.cloudflare`                                                | `Cloudflare Speedtest`                       | 拆分为「上下行吞吐与传输流量」「空载与负载延迟统计」「延迟分位分布（ms）」「UDP 与稳定性」四张适宽表，分别陈述客户端 ASN 与地址库归属。                                                                                                                                          |
| `network.inetspeed`                                                 | `Apple CDN Speedtest`                        | 拆分为「节点与空载延迟基准」「分轮吞吐与传输流量（含 `worker_faults` 等故障标记）」「分轮负载延迟分布」三张表。                                                                                                                                                                  |
| `network.trace`                                                     | `路由追踪` + `TCP 大包回程路由`              | 强制 6 列表头 `跳数 \| 应答地址（脱敏） \| ASN \| 运营商 \| 位置 \| 最小 RTT（ms）`；Netflix 节点在 `运营商` 列追加 `[exchange]`；中国境内目标含 `tcp` 字段时单独渲染 `TCP 大包回程路由` 页签并标注探测端口、包大小与分片停止跳点/MTU。                                          |

## 3. Schema 与 CI 质量门禁

1. **标准章节与遥测完整性**：声明 `benchVersion` 的 `review-markdown` 文章在 `src/content.config.ts` 构建期校验标准章节集合（VPS 要求 9 节 + `vm-cpu-telemetry` 图表块；独服要求 8 节）。客观缺测项必须在 Frontmatter `omittedSections` 显式声明，且禁止在 `omittedSections` 保留实际已存在的章节。
2. **6 列路由表头锁定**：`路由追踪`、`TCP 大包回程路由` 与 `去程路由追踪` 下所有表格表头必须严格匹配 6 列标准定义，防止列错位或退回 5/7 列导致桌面端横向滚动条。
3. **正式发布防呆**：非草稿（`draft: false`）文章若残留 `待填写`、`example.com/replace-` 占位符，或引用了不存在的 `/archive-assets/` 本地配图，构建、`.githooks/pre-commit` 与 GitHub Actions 直接阻断。
4. **自动化回归**：`npm run verify:bench`（`scripts/verify-bench-import.mjs`）基于 `tests/fixtures/bench/{vps,dedicated}-v0.1.2.json` 验证导入器、脱敏规则、未知插件阻断与 CLI 格式化输出，并已纳入 `.github/workflows/content-validation.yml`。
