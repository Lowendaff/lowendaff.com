# 首页 Polish

日期：2026-11-15。基于已完成的首页阅读优先优化继续精修；仅本地修改，无 Git 提交、推送、部署或 Figma 同步。

## 范围与依据

读取 PRODUCT.md、DESIGN.md、AGENTS.md 及上一轮报告，按 Impeccable polish 和 craft-floor 执行。现有内容优先布局、Tokyo 主题、广告/线路图行为和文章字号保持不变；没有重新设计页面或修改文章/广告数据。

`critique-storage latest src/pages/index.astro --json` 返回 exit 2：上轮实现已改变目标文件，旧 critique 不再是当前待办。本轮依据实际渲染独立核对，未再次关闭一个未读取的快照。DESIGN.md 的旧尺寸记录不作为回退依据，也未自动修复设计系统文件。

## 实际修改

只有两个生产 CSS 文件新增规则：

- `src/styles/home.css`：标语第二分句采用可收缩 inline-block，避免 768px 平板把“让”字留在第一行；保留手机原有分句换行。记录正文增加 `overflow-wrap: anywhere`，连续英文标题可自然换行。
- `src/styles/advertising.css`：品牌、文案容器设置 `min-width: 0` 与自然换行，品牌文字和标签允许收缩。修复长英文商家名/标签被卡片裁切的问题；正常内容尺寸和广告轮播脚本不变。

没有截断文字、隐藏内容或减小字体。友链已有长文本换行能力，未为修改而重复增加样式。

## 浏览器验证

使用本机独立无界面 Chrome；没有操作用户已有标签页。现有开发服务保持运行。

- 320 / 390 / 768 / 1024 / 1440px，浅色与深色共十种渲染：正常内容无横向溢出，空状态可读。
- 1440×900、390×844 浅深主题：文章入口、类型筛选、URL 前进/后退/刷新、清除空状态、键盘焦点和主题切换保留滚动位置均通过。
- 首页线路图仍有8节点/11通道，起点变化及离屏停止检查通过，手机保持隐藏。
- 既有广告 layout / controls 回归通过：单卡、随机顺序、双向切换、键盘、广告链接隔离、自动恢复、减少动效和无 JS 降级。完整一圈 autoplay 回归上一轮已在两种视口通过，本次未改变该脚本逻辑。
- 正常手机完整记录仍为 y=633.2–713.2px；桌面为636.8–712.8px。
- 长文本压力样本仅注入测试浏览器 DOM，不写入 Content Collections。修复前出现页面横向溢出、广告品牌/标签和记录标题超出容器；修复后均无溢出/裁切。
- 200%文字尺寸模拟无横向溢出或容器裁切；这是浏览器 DOM 的字号放大测试，不等同于真实浏览器菜单缩放验收。
- 十类文字的浅深主题对比度抽检通过（普通文字至少4.5:1、大字至少3:1）。不将局部抽检称为完整可访问性验收；本轮未验证其他浏览器引擎。

## 工程验证

通过 `format:check`、`check`、`build`、`verify:content`、`verify:release`、`verify:readable`、`verify:seo`、`verify:analytics`。一次检查误扫描本轮保存的 `.astro` 备份，产生相对导入错误；备份改为 `.astro.txt` 后重跑通过，无生产源码诊断错误。未修改 CI、Schema、模板或内容集合。

本轮未重复运行检测器；上一轮已有机械扫描，本次按 polish 规范以实际渲染、边界条件和源码差异核验补充，未把检测器零命中当成质量证明。

## 归档

`test-results/homepage-polish/`：十种 before/after 截图、筛选空状态、长内容与文字放大样本、`inspection-after.json`、`stress-before.json`、`stress-after.json`、`contrast.json`、`browser-checks.json`、各项工程检查日志。

OpenViking：`viking://resources/projects/lowendaff-ui/homepage-polish.md`。全文回读与校验回执见 `test-results/homepage-polish/openviking-receipt.json`；语义/向量索引是否完成另行核实，不由写入成功推断。
