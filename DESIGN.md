---
name: LowEndAFF
description: 全球服务器测试手记：轻松亲近，真实记录与阅读优先。
colors:
  day-canvas: '#e1e2e7'
  day-surface: '#ebedf3'
  day-raised: '#f4f5f8'
  day-subtle: '#dcdfea'
  day-text: '#343b58'
  day-muted: '#53618a'
  day-accent: '#295fba'
  day-accent-soft: '#dce4f5'
  day-on-accent: '#f4f5f8'
  day-border: '#bec5d7'
  day-success: '#48652d'
  day-warning: '#785c2c'
  day-danger: '#b52650'
  day-brand-orange: '#965027'
  day-brand-teal: '#006783'
  night-canvas: '#1a1b26'
  night-surface: '#202230'
  night-raised: '#292e42'
  night-subtle: '#24283b'
  night-text: '#c0caf5'
  night-muted: '#9aa5ce'
  night-accent: '#7aa2f7'
  night-accent-soft: '#283451'
  night-on-accent: '#1a1b26'
  night-border: '#3b4261'
  night-success: '#9ece6a'
  night-warning: '#e0af68'
  night-danger: '#f7768e'
  night-brand-orange: '#ff9e64'
  night-brand-teal: '#73daca'
typography:
  display:
    fontFamily: "'Inter Variable', 'Noto Sans SC Variable', sans-serif"
    fontSize: clamp(24px, 2.25vw, 32px)
    fontWeight: 550
    lineHeight: 1.5
    letterSpacing: -0.025em
  page-title:
    fontFamily: "'Inter Variable', 'Noto Sans SC Variable', sans-serif"
    fontSize: clamp(30px, 3vw, 40px)
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: -0.035em
  headline:
    fontFamily: "'Inter Variable', 'Noto Sans SC Variable', sans-serif"
    fontSize: 32px
    fontWeight: 650
    lineHeight: 1.45
    letterSpacing: -0.035em
  title:
    fontFamily: "'Inter Variable', 'Noto Sans SC Variable', sans-serif"
    fontSize: 26px
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: -0.035em
  body:
    fontFamily: "'Inter Variable', 'Noto Sans SC Variable', sans-serif"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.75
  reading:
    fontFamily: "'Inter Variable', 'Noto Sans SC Variable', sans-serif"
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.95
  label:
    fontFamily: "'Inter Variable', 'Noto Sans SC Variable', sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
  button:
    fontFamily: "'Inter Variable', 'Noto Sans SC Variable', sans-serif"
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.6
  data:
    fontFamily: "'JetBrains Mono Variable', monospace"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.7
rounded:
  r6: 6px
  r8: 8px
  r9: 9px
  r10: 10px
  r12: 12px
  r16: 16px
  r18: 18px
  r24: 24px
spacing:
  s4: 4px
  s8: 8px
  s12: 12px
  s16: 16px
  s18: 18px
  s20: 20px
  s24: 24px
  s28: 28px
  s32: 32px
  s40: 40px
components:
  button-primary:
    backgroundColor: '{colors.day-accent}'
    textColor: '{colors.day-on-accent}'
    typography: '{typography.button}'
    rounded: '{rounded.r12}'
    padding: 11px 18px
  button-secondary:
    backgroundColor: '{colors.day-surface}'
    textColor: '{colors.day-text}'
    typography: '{typography.button}'
    rounded: '{rounded.r12}'
    padding: 11px 18px
  button-icon:
    backgroundColor: transparent
    textColor: '{colors.day-text}'
    rounded: '{rounded.r12}'
    width: 44px
    height: 44px
  navigation-link:
    textColor: '{colors.day-muted}'
    padding: 14px 0
  tag-filter:
    backgroundColor: '{colors.day-surface}'
    textColor: '{colors.day-text}'
    rounded: '{rounded.r9}'
    padding: 9px 14px
  tag-filter-selected:
    backgroundColor: '{colors.day-accent-soft}'
    textColor: '{colors.day-accent}'
    rounded: '{rounded.r9}'
    padding: 9px 14px
  friend-link:
    backgroundColor: transparent
    textColor: '{colors.day-text}'
    padding: 10px 0
  review-type-filter:
    backgroundColor: '{colors.day-subtle}'
    rounded: '{rounded.r12}'
    padding: 4px
    width: min(100%, 360px)
  route-picker:
    backgroundColor: '{colors.day-surface}'
    textColor: '{colors.day-text}'
    rounded: '{rounded.r12}'
    padding: 13px 16px
    width: 100%
---

# Design System: LowEndAFF

## Overview

**Creative North Star: "全球服务器测试手记"**

像翻阅熟悉博主的测试手记：语气轻松、亲近，测试证据保持清楚、严谨。头像、国旗和友情链接保留个人博客的温度；页面让读者顺手找到记录，再按需查看数据。

平整、安静的阅读背景是主调。Tokyo 的日光蓝与月光蓝标记链接和选中状态，暮色灰构成表面层级；现有阴影辅助区分卡片与浮层，不把每块内容做成悬浮控件。

这是现有实现的记录，不是改版提案；首页已合并 2026-11-15 的精简与审查修复，记录见 [首页归档](docs/changes/homepage-audit-follow-through.md)；同日全站推广见 [本轮归档](docs/changes/all-pages-impeccable.md)。用户确认的描述与绑定约束优先；产品事实见 [PRODUCT.md](PRODUCT.md)，初次提取来源见 [归档](docs/changes/impeccable-document.md)。

**Key Characteristics:**

- 轻松、亲近的博客气质，真实记录优先。
- 浅深主题共用语义角色，表面明度逐层变化。
- 信息紧凑，正文、表格和手机布局各自保持可读。
- 按钮与筛选温和、清楚、顺手；反馈不打断阅读。

## Colors

保留 Tokyo Night Day / Tokyo Night 的冷灰与蓝色；色值见 frontmatter，命名只解释角色。

### Primary

- **日光蓝**：`day-accent`，用于浅色链接、选中状态和主要动作。
- **月光蓝**：`night-accent`，用于深色同一语义角色。两种主题的 `accent-soft` 为选中背景，`on-accent` 为实心按钮文字。

### Secondary

- **商家暖橙 / 青绿**：`brand-orange`、`brand-teal` 仅作为已有商家展示的辅助色，不替代站点主色。
- **状态绿 / 琥珀 / 红**：`success`、`warning`、`danger` 表示检测状态，并配合文本含义。

### Neutral

**暮色灰**是中性色族的描述，涵盖 `canvas` 页面底、`surface` 内容面、`raised` 浮层、`subtle` 分组背景、`text` 正文、`muted` 次要文字和 `border` 分隔线。深色浮层比页面底更亮。

frontmatter 的 `day-*` / `night-*` 对应 `src/styles/global.css` 中同名无前缀变量。组件条目以浅色为基础样本；深色按相同后缀替换，实际组件始终使用 `var(--…)`。sidecar 的八级色带是面板预览推导值，不是新增生产色板。

**The Semantic Theme Rule.** 组件读取语义 CSS 变量；不把浅色值写死进生产组件，深色也不做机械反色。

## Typography

正文和界面使用 Inter Variable、Noto Sans SC Variable 与 sans-serif 回退；数字表格和终端使用 JetBrains Mono Variable 与 monospace 回退。中文保持自然阅读节奏，等宽字体服务数据对比。

### Hierarchy

- **Display**：首页主标题；采用 frontmatter 的流体字号。手机为 24px，行高与字距延续 Display。标语采用单色，第二分句保持完整；不恢复大号双色宣传标题。
- **Page title**：标签云、广告、测评地图与组件展示使用 30–40px 流体字号，不覆盖文章标题或首页标语。
- **Headline**：测评标题；手机为 27px、行高 1.5，不将首页字号套用全站。
- **Title**：常规区块标题；测评章节为 24px，手机通常 22px。
- **Body / Reading**：界面基础文本与长文分别建模；长文容器上限 70ch，不能把界面的基础字号当成长文规则。
- **Label / Button / Data**：筛选标签、通用按钮与数据表分别使用 frontmatter 角色。文章按钮可覆盖为 14px，路由数量等局部标注可为 12px；这些不是全局缩字规则。

**The Evidence Alignment Rule.** 价格、容量、分数、延迟启用等宽数字；文章表头与内容均左对齐。

## Layout

主容器最大宽度 1200px。视口不超过 1279px 时左右留白 40px；不超过 760px 时为 18px，390px 手机实际内容宽度 354px。页头高度桌面 84px、手机 72px。

首页为单列内容流；测试列表桌面行高下限 76px、手机 80px，允许标题换行后增长。友链在宽屏三列、1000px 以下两列、520px 以下一列，链接行高至少 48px。首页引言上下各 24px 留距，手机下方为 16px；桌面线路图高度 144px，手机隐藏。

标签与广告页桌面上下留白 36px / 48px，手机 32px / 48px。标签筛选区用上下细线分组，列表沿用首页的平整样式；类型、商家、国家和 URL 状态保持独立。

测评桌面为弹性正文加 300px 侧栏，间距 36px；900px 以下转为单列。目录在桌面位于文章标题元信息后、顶部广告前，以横向 sticky 栏停靠页头下方；手机通过点击展开。长文宽度与宽数据表分开约束，宽表在自身容器滚动。

spacing 条目记录已有常用尺寸，并非项目已经声明了统一间距变量。遵循相邻组件的实际密度，不强行把全部局部值归并成同一倍数。

## Elevation & Depth

安静的底色和细边框承担主要分组职责。内容面保留两层低强度阴影，深色使用对应更深的阴影；菜单、提示层使用更明显的浮层阴影。精确值保存在 sidecar 的 `extensions.shadows`，不是 frontmatter 的伪扩展字段。

导航使用主题 `--glass` 背景与 20px 模糊，底部分隔线为混合透明边框。降低透明度偏好下回退为实色。地图弹层采用遮罩明确模态关系，不把整页变成黑色展示背景。

**The Quiet Reading Rule.** 以表面色差和边框组织内容；列表、标签筛选和说明区保持平整，阴影用于确有层级需求的内容面与浮层。

## Shapes

圆角柔和但有层次：通用面板 24px，赞助横幅 18px，地图容器 16px，按钮与路由选择器 12px，表格框 10px，标签筛选 9px。首页友链不设卡片圆角。圆形只用于头像、地点和轮播箭头等已有元素。

嵌套圆角随内边距缩小。测评类型外框 12px、内边距 4px、按钮 8px 是现有例子；路由菜单外框 12px、内边距 5px、选项 6px。普通边界为 1px，浮层边界保持可见。不要把这些文档别名误认为已经存在的 CSS 自定义属性。

## Components

### Buttons

温和、清楚、顺手。主按钮使用 accent 与 on-accent，次按钮使用 surface 与细边框；通用按钮最小高度 44px。悬停轻微上移 1px，主按钮颜色略加深；图标按钮采用 44px 方形点击区。可见焦点使用 3px accent 描边，默认外偏移 5px，局部控件有适应自身容器的偏移。

### Chips and filters

文章标签是静态信息；标签云按钮是筛选动作，不混用语义。标签云选择后使用 accent-soft 背景、accent 边框与文字，并有内描边。测评类型筛选为三等分，宽度上限 360px，选中项在 subtle 底上使用 surface。

### Cards / Containers

内容卡轻轻分隔，不遮挡阅读。首页与标签页测试列表使用平整的共享区域，不增加外框和阴影；标题与元数据纵向组织，国旗是地域线索，不能代替文字。友情链接采用整行可点击的自然网格，无独立卡片底色、边框和阴影；悬停或聚焦时名称出现下划线，外链箭头加深。关注入口沿用整块点击，以图标和“在 Telegram 关注更新”标题识别，不增加卡片外壳或尾部按钮。

### Inputs / Fields

当前导航与首页没有搜索输入，不凭旧 CSS 创建搜索规范。路由筛选使用已有自定义 combobox：最小高度 50px、正文左对齐；展开后高亮背景，列表按可用空间向上或向下打开，保留键盘选项导航和关闭行为。不要替换为系统原生下拉。

### Navigation

桌面导航文字为 13px，当前项加深并加重；悬停可出现细线反馈。手机通过菜单展开，关闭与键盘反馈明确。主题菜单提供跟随系统、浅色、深色，图标有无障碍名称；恢复焦点使用 preventScroll。

### Review data

系统、网络与服务检测按现有分组查阅。标题提示以 tooltip 提供，避免常驻多余说明。表格使用等宽数字、左对齐、局部滚动与四向边缘提示；展开属于具体数据组，不提供全局“展开全部”。BGP 图与套餐购买信息直接可见；缺图提示不承诺另一协议一定可用。章节标题直接命名测试类别，不加无顺序含义的编号。

### Advertising and Sponsors

首页是浅深主题下均使用内容表面的单商家横幅，随机起序、连续循环，箭头位于两侧中部。桌面品牌与信息横向排列，最小高度 144px；手机纵排，内边距 16px 28px，内容自然撑高。整卡跳转，不重复添加品牌旁和最右侧 CTA。减少动效时采用原生横向滚动；切换动效偏好保留当前商户，动画中途切换落在最近的一张。

文章广告采用品牌色深色画面与纵向排列；头尾 CTA 为浅色按钮式区域，侧栏 CTA 为分隔线下的通栏入口。Sponsors 的 SVG 用 CSS 统一明暗观感，仅出现在文章侧栏。它们不是首页横幅的同义组件。广告介绍页保留位置示意、报价和规则；位置卡为 16px 圆角细边框，不加阴影，合作须知直接排版，以细线分节。

### Component showcase

组件页继续从真实集合取样。语义色块与排版样本使用平整网格，不套装饰面板；配置与数据表保留生产组件本身的样式。标题不加编号，缺少样本时明确显示简短空状态，不能填入虚构测试或只留下空标题。

### Maps and motion

首页线路图与测评地球是两个不同组件。地球使用 Tokyo 语义色、抽象陆海与细国境线；点击城市后桌面居中弹层、手机底部列表，不保留常驻右侧列表。缓慢自转在交互、离屏或后台暂停；减少动效时不自动旋转。弹层类型按钮最小高度 44px，地球补充屏幕阅读器可读的键盘操作说明。

普通反馈优先采用现有 quick / panel 时长和 arrive 曲线。首页广告切换为 650ms，停留计时 5 秒；入场只短暂提示层级。默认尊重减少动效，首页线路图的既有例外见 AGENTS.md，不推广到其他组件。

## Do's and Don'ts

### Do:

- Do 使用现有语义色和三档主题切换，切换后保留阅读位置。
- Do 让手机内容自然换行，宽表局部滚动，目录按需展开。
- Do 保留国旗、真实日期、必要的缺图和空状态，以及清楚的赞助披露。
- Do 复用可见焦点、键盘操作和组件的减少动效行为。

### Don't:

- Don’t 因“轻松亲近”添加虚构测试、夸张结论或无意义的小字。
- Don’t 恢复搜索、展开全部、常驻地图测评侧栏或黑底写实地球。
- Don’t 用缩小正文或删除证据的方法压缩手机布局。
- Don’t 将首页广告、文章广告和 Sponsors 的不同视觉角色合并成一种展示。
