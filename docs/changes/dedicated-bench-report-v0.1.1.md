# 从 lowendaff-bench v0.1.1 填写独服测评

使用 [独服模板](../../templates/reviews/dedicated-server.mdx)，按 `runs[].id` 找测试，不按数组位置或本地化标题匹配。以下是报告与现有文章分组的对照；不是新增必填项。

| 来源 | 模板位置 | 取数口径 |
| --- | --- | --- |
| `system` | 系统信息、磁盘清单、网络信息 | 先看各节的 `state`；物理核心、逻辑 CPU 和进程可用 CPU 分开。登记实际探测到的固件、插槽、网卡、阵列与磁盘。 |
| `cpu.bench` | CPU 性能测试 | 八项独立取舍。sysbench 记 events/s，UnixBench 记副本数与指数，7-Zip 分压缩与解压，PassMark 分总评与子项。HPL 记规模、GFLOP/s 与残差；Geekbench 用报告版本、单/多核及内存或 swap 条件。y-cruncher 区分计算/总用时，Prime95 记本次时长、错误与警告，不外推长期稳定性。 |
| `memory.sysbench`、`memory.stream` | 系统信息 → 内存读写、STREAM | 前者按读写、线程、块大小记录 MiB/s；后者按线程记录四个内核的最佳 MB/s，顺序是 Copy、Scale、Add、Triad。不要混用两种单位。 |
| `memory.latency`、`memory.numa` | 系统信息 → 缓存与主存延迟、NUMA | 层级延迟带工作集大小；`missing` 不代表硬件不存在。NUMA 的行是 CPU 节点，列是内存节点；每格的带宽和延迟可以各自缺失。 |
| `disk.health`、`disk.fio` | 磁盘性能测试 | SMART 按盘分开；无法读取不等于健康。fio 按块大小及结果状态列读写 KiB/s 和 IOPS；文件大小不能当磁盘容量。报告未给出的队列深度等条件不猜填。 |
| `network.iperf3`、`network.taier` | 网络带宽测试 → 国际节点、国内运营商 | 从被测机视角记方向。iperf3 的 `bits`、泰尔的 `*_bps` 均为 bit/s，除以 1,000,000 才是 Mbps。iperf3 上传 RTT 从 µs 转 ms（除以 1,000）；空重传值不算零。泰尔只有 `state: measured` 才有可引用的测速成绩。 |
| `network.cloudflare` | Cloudflare Speedtest | 按协议与接入点分别记上下行；空载、下载负载、上传负载延迟分别列。UDP 丢包与 MOS、缓冲膨胀及稳定性评级均为可选结果，不混成吞吐分数。 |
| `network.inetspeed` | Apple CDN Speedtest | 用最终选中的节点；每轮保留方向、线程数、吞吐、负载延迟和错误。空载取 `idle_latency`，不要把候选节点探测 RTT 当成此值。 |
| `network.trace` | 路由追踪（回程） | 按协议、目标分组，保留 `reached`。每跳可有零个或多个应答；空应答数组按原跳数逐行留存，显示为 `*`，连续跳合并为范围。`latency` 是每个地址的最小 RTT（µs），换为 ms 后再展示。没有外部探针的独立证据就删除「去程路由追踪」。 |
| `network.bgp` | 网络信息；有图另加 BGP 透视 | 使用 `distinct_paths`、`total_peers` 等汇总，不用导出的路径数组长度代替总数。若对应协议有 `svg`，核对并脱敏后另存站内图片，按模板说明引用；只有统计时不建空图片章节。 |
| `ip.media` | 服务解锁测试 | 三级标题写 IPv4 / IPv6；四级按 `group` 分国际平台（global）、亚洲、欧洲、美洲、大洋洲。保留服务原名、返回区域与状态；WAF 拦截、限流、超时不能都写成“不解锁”。 |
| `ip.quality` | 不展示 | 遵循本站编辑约定，不恢复 IP 质量分析；这与服务解锁、BGP 观测是不同项目。 |

**先判状态，再引用数值。** `runs[].status` 区分完成、跳过、失败、超时、中断；`reason` 可用于说明缺测。顶层 `not_applicable` 列的是未进入运行列表的不适用项目。CPU 子工具还要检查自身的 `status`：`done` 读 `output`；`failed` 若有 `partial` 只能标作部分结果；`skipped` 或 `null` 不生成分数。保留真实零值，缺字段、协议不可达和没测到不要补零。`summary.total_seconds` 是测试耗时，不是测试日期。独服不要求 VM 专用的 `vm_cpu_telemetry`。

**发布前检查。** 只摘录与正文有关的字段。即使 `show_ip: false`，仍要检查跳点、节点名、硬件标识和 BGP 图里的文字，不要把整份 JSON 或内联 SVG 粘进 MDX。

**核验基准。** 配套说明中的 Schema 与独立 JSON 文件按结构比对一致。使用 Draft 2020-12 校验器验证 Schema 及提供的 aarch64 实机报告：报告零错误，15 个插件中 14 个有运行记录，Memory NUMA 列为不适用。以上是格式核验，不表示每个子工具、节点或协议都有有效成绩。
