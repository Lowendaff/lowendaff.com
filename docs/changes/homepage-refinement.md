# 首页阅读优先优化

日期：2026-11-15。范围：基于本轮首页 critique 的本地实施；未提交、推送、部署或同步 Figma。

## 依据与保留项

读取 PRODUCT.md、DESIGN.md、AGENTS.md，沿用 Impeccable 的 Read 模式、distill / layout / quieter 原则。Tokyo 日光蓝/月光蓝/暮色灰、头像、标语原文、国旗、真实日期、20 条分页、类型筛选、线路图与广告轮播行为均保留。DESIGN.md 是此前实现快照，本次调整的尺寸与容器以本报告及源码为准；未借此重建或自动修复整套设计文档。

## 实际修改

- 标语由桌面 56px / 手机 29.64px 调整为 32px / 24px，使用统一文字色；手机按两个分句换行。删除重复副文案和三项图标声明。
- 线路图按 144px 高度适配引言；数据、8 城市、11 通道、随机起终点、2.4 秒周期及离屏暂停逻辑未修改，手机继续隐藏。
- 赞助区标题降为辅助层级，桌面横幅 190px → 144px；手机品牌左对齐、缩小内部间隔与边距，广告高度约 300px → 237px。广告正文仍为桌面 16px / 手机 15px，不删广告数据、不截断文案。随机排列、单商家显示、连续循环、居中 44px 箭头及减少动效降级逻辑保持不变。
- 桌面记录列表去掉共享面板的填充底色、圆角与阴影，保留行分隔；手机已有平整列表样式保留。文章标题仍为桌面 16px / 手机 15px，行高下限仍为 76px / 80px。
- 友情链接为轻量网格/链接行，全部 9 项地址不变，保留外链 SVG、可见焦点，操作行至少 48px；手机友链网格从 656px 减至 432px。
- 关注入口移除面板外壳，整块可点击；标题为“在 Telegram 关注更新”，副句为“有新的测试记录时，在频道里见。”，无额外尾部按钮。
- 仅列表展示标题移除开头重复国旗，源文章标题与 permalink 未变。服务端和筛选脚本仅在超过 20 条时显示“每页20条”；首页空状态只提类型，标签云继续提类型/商家/国家。

## CSS 整理

修改前记录了浏览器匹配规则及计算值，确认导入顺序为 global → editorial → compact → records → reading → directory → home → advertising → motion。全局 CSS 图索引不可解析的区间已直接阅读。

移除 global/editorial 中旧 hero 与 follow 规则、compact 中旧友链与产品卡覆盖及过时三列/横滑布局，统一由 home.css 管理首页引言/关注/友链，由 advertising.css 管理首页广告。移除不再使用的副文案入场规则。保留其他页面的共用样式及手机列表规则，不在文件尾叠加补丁。

## 首条完整记录位置

距离页面顶部，滚动位置 0；浅深主题一致。截图采用相同视口、相同字体加载完成状态和固定随机输入，使前后展示同一商家；真实随机行为另行检查。

| 视口 | 修改前记录范围 | 修改后记录范围 | 整条在首屏内 |
| --- | --- | --- | --- |
| 1440 × 900 | 833.8–909.8px | 636.8–712.8px | 是 |
| 390 × 844 | 840.7–920.7px | 633.2–713.2px | 是 |

`test-results/homepage-refinement/` 保存：

- `before/after-{1440,390}-{light,dark}.png`：全页截图。
- `compare-{1440,390}-{light,dark}.png`：相同视口首屏对照，左修改前、右修改后。
- `before-measurements.json`、`after-measurements.json`：位置、字号、边框、阴影及实际 CSS 规则。
- `browser-checks.json`、`fixture-browser.json`：交互回执。
- 各 npm 检查的独立日志。

## 验证

已通过 format:check、urls:check、verify:urls、check、build、verify:content、verify:release、verify:readable、verify:seo、verify:analytics、verify:types。最终 HTML/CSS 调整后重跑 format:check、check、build、verify:release；check 为 0 errors / 0 warnings，另有 45 hints（含忽略目录中的历史浏览器辅助脚本）。类型夹具与构建串行，夹具清理后仅保留正式 100TB。

100TB 与原始基线的 9,132 个表格单元格精确比对一致；撤下文章未恢复。类型夹具浏览器验证覆盖 20 条分页、VPS/独服切换、URL 前进/后退/刷新、类型/商家/国家交集、分页提示条件、320/390/1440 布局和无 JS 降级。

四种目标视口/主题检查文章真实跳转、类型筛选、空状态恢复、浏览器历史与刷新、键盘可见焦点；9 条友链地址及操作高度逐项核验。主题通过实际指针位置点击验证浅/深/系统切换保持阅读位置；自动 locator 点击会自行滚动 sticky 头部，未用这种自动滚动误判产品缺陷。首页地图验证随机起点改变、8 节点/11 连线和离屏停止；手机保持隐藏。

广告已有三组回归（layout / controls / autoplay）全部通过：320/390/768/1024/1440 双主题布局、四个商家随机排列、单卡可访问、双向循环、完整自动循环回到起点、650ms 缓动、悬停/焦点暂停恢复、箭头不激活广告链接、整卡跳转、减少动效与无 JS 降级。`verify-carousel-layout.js` 的桌面高度预期同步为 140–180px。

Impeccable layout 检测对首页、记录、友链和广告组件返回 0 项；这仅作为机械检查补充，不代替实际截图和交互核验。

## 持久化

OpenViking 目标：`viking://resources/projects/lowendaff-ui/homepage-refinement.md`。全文回读及摘要校验回执保存在 `test-results/homepage-refinement/openviking-receipt.json`；索引状态独立记录，不把资源写入等同于语义索引完成。
