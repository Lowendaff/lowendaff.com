# VPS 与独立服务器 MDX 模板

日期：2026-11-08。

## 清理边界

用户撤销批量历史恢复。已停止该任务的抓取进程，删除新增的 139 篇 MDX，恢复该任务改写的 29 篇原记录及配套工程文件，共恢复 43 个受跟踪文件。清理时工作树已回到 `a8a40be024e54944417b0b4db06eccacbf76e986`。本轮模板调整在此之后独立实施；未提交、未推送。

站点仍为 42 条记录：2 篇完整测评、40 条快照引用。历史下载移到仓库外 `../lowendaff_ui_backups/cancelled-history-recovery-20261108/`，仅用于此次模板对照，不参与集合或构建。

## 原文依据

直接重新读取下列 Wayback 原始 HTML 的本地副本，核对目录、表格和代码输出；逐一验证 SHA-256 与抓取清单一致。未恢复它们为本地文章，也未声称本轮重新在线抓取成功。

- [🇺🇸 100TB 美国优质网络（CN2） VPS 测试记录](https://web.archive.org/web/20261010140736id_/https://lowendaff.com/2026/10/08/%F0%9F%87%BA%F0%9F%87%B8-100tb-%E7%BE%8E%E5%9B%BD%E4%BC%98%E8%B4%A8%E7%BD%91%E7%BB%9C%EF%BC%88cn2%EF%BC%89-vps-%E6%B5%8B%E8%AF%95%E8%AE%B0%E5%BD%95/)
  - 原始副本：`pages/d6bb42b2ff0088d5ee94.html`；SHA-256：`80508cb7ba142d54c62c06c45356c8497ac6f9e91da1bcd4756606506f28db0a`。
- [🇸🇬 PanstarCloud 新加坡 VPS 测试记录](https://web.archive.org/web/20261010144131id_/https://lowendaff.com/2026/09/14/%F0%9F%87%B8%F0%9F%87%AC-panstarcloud-%E6%96%B0%E5%8A%A0%E5%9D%A1-vps-%E6%B5%8B%E8%AF%95%E8%AE%B0%E5%BD%95/)
  - 原始副本：`pages/e6e07c789968718848b7.html`；SHA-256：`f742703e79654a3b2f1243446fe19528c8cb2c1d150ce9a6dea5a9cc6fb91731`。
- [Taipei101 台湾独立服务器盲盒测试记录](https://web.archive.org/web/20260710235354id_/https://lowendaff.com/2026/07/04/taipei101-%E5%8F%B0%E6%B9%BE%E7%8B%AC%E7%AB%8B%E6%9C%8D%E5%8A%A1%E5%99%A8%E7%9B%B2%E7%9B%92%E6%B5%8B%E8%AF%95%E8%AE%B0%E5%BD%95/)
  - 原始副本：`pages/c1bfa04a87acbdf1127b.html`；SHA-256：`be37d0a06ce660b613d2ae5855fa16e876bc8926d57166d2d088bd7e80ea2876`。
- [🇭🇰 YxVM 香港大带宽独立服务器测试记录](https://web.archive.org/web/20260710223600id_/https://lowendaff.com/2026/06/30/%F0%9F%87%AD%F0%9F%87%B0-yxvm-%E9%A6%99%E6%B8%AF%E5%A4%A7%E5%B8%A6%E5%AE%BD%E7%8B%AC%E7%AB%8B%E6%9C%8D%E5%8A%A1%E5%99%A8%E6%B5%8B%E8%AF%95%E8%AE%B0%E5%BD%95/)
  - 原始副本：`pages/1cae16a1f1db2c2276df.html`；SHA-256：`91c5a4732c410dba5f94d5bca1c0cd88355b07bfadf5d1e8a638ae3bafef6461`。
- [🇭🇰 MEJIRO NETWORK 香港独立服务器测试记录](https://web.archive.org/web/20260115142836id_/https://lowendaff.com/2025/08/19/%F0%9F%87%AD%F0%9F%87%B0-mejiro-network-%E9%A6%99%E6%B8%AF%E7%8B%AC%E7%AB%8B%E6%9C%8D%E5%8A%A1%E5%99%A8%E6%B5%8B%E8%AF%95%E8%AE%B0%E5%BD%95/)
  - 原始副本：`pages/59f3b33682372a661a56.html`；SHA-256：`295572bd4d347ba3448e0d5ded06b225fd9a80d4279fce8920454f85d0d1fd91`。
- [Megalayer 美国圣何塞独立服务器测试记录](https://web.archive.org/web/20230415045059id_/https://lowendaff.com/archives/megalayer-dedi.html)
  - 原始副本：`pages/bdcb741077d38431f7cc.html`；SHA-256：`ee2dc1757e7f006e14d9e51751580886f2ad75b7d5226e39b9c414f58511d747`。

VPS 样本以系统、虚拟化、CPU/磁盘、解锁、测速与路由为主。独服并非只换标题：Taipei101 有硬件拓扑、SMART、使用情况和健康指标；YxVM 有拓扑、SMART 和 Geekbench 6；MEJIRO 和 Megalayer 的早期文章大量采用代码块，并有 dmidecode / SMART。不能把这些信息强制转换成 VPS 配置表。

## 交付与映射

- `templates/reviews/vps.mdx`：vCPU、虚拟化、资源限制、系统可见磁盘及共同网络测试。
- `templates/reviews/dedicated-server.mdx`：CPU 颗数/核心/线程、NUMA、内存条与 ECC、拓扑、dmidecode、逐盘 SMART、RAID 与 fio。
- `templates/reviews/README.md`：复制命令、字段、可选章节、BGP 图、代码围栏、路由分组与写作边界。

均为 `format: review-markdown`。Frontmatter 的 `reviewType: vps | dedicated` 经 Zod 校验；真实内容继续只从 MDX 集合读取。模板不在集合目录，默认草稿且仅有明确占位，不能误称实测样本。

保持原有五组阅读布局；SMART/RAID 放磁盘页签，拓扑/dmidecode/内存性能放系统页签，Geekbench 放 CPU 页签。未执行的章节可删除，目录和页签随内容收缩；新文章不要求伪造历史来源。新的未知顶层标题会报错，避免内容被渲染层遗漏。两篇历史正文保留原样，其中既有 Bench Report 和 IPv4 质量分析仅保留来源数据，不恢复显示。

原始输出通过代码围栏 → `parseReadableReview` 的 code block → `BenchmarkTerminal format=raw` 显示；代码作为文本转义。路由原始输出继续经过运营商/节点选择器，解锁原始输出按检测项归组。本地 Markdown 图片映射 `public/archive-assets/` → `ArchiveBlock`；BGP 延续 IPv4/IPv6 切换。

## 验证

验证结果和日志置于 `test-results/review-templates/`。`verify:templates` 会临时复制两份模板及针对性夹具，检查完整构建、独服标题、草稿隔离、可选章节/目录、代码输出转义、路由/解锁输出、本地图像路径以及未知章节拒绝；结束后删除夹具并重建原站。图片验证只覆盖生成标记，不代表占位图片资源存在。

以上模板验证已通过。格式、Astro 类型检查（0 错误/警告）、原文内容保真（211 张表、15,988 单元格、51 段正文）、发布契约、10 项易读解析测试、内容管线和 Markdown 动态联动检查也已通过。模板发布时仍需人工核实填入的数据、图片、购买链接、日期与测试条件。

## 持久化

OpenViking 资源：`viking://resources/projects/lowendaff-ui/review-templates/review-templates.md`。回执记录于 `test-results/review-templates/openviking-receipt.json`；全文回读一致仅代表持久化成功，不代表语义索引完成。
