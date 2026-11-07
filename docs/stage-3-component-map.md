# 修订 13：Figma 与 Astro 组件映射

阶段 4 已实现，最终内容来源与核对结果见 `stage-4-component-map.md`。下方保留阶段 3B 交付时的节点说明。

2026-11-07。目标文件 `vZ3h8djsL9yAt0WIlhyCSm`。此表是实际节点映射，不代表已发布 Code Connect 集成；阶段 4 应复用现有 Astro 组件。

| Figma 主组件 | 节点 | Astro 来源 |
| --- | --- | --- |
| Navigation / Desktop | `40:17912` | `src/layouts/BaseLayout.astro`、`src/components/ThemeSwitcher.astro` |
| Navigation / Mobile | `40:18042` | 同上，手机导航与主题控件 |
| Footer / Desktop | `40:17977` | `src/layouts/BaseLayout.astro` |
| Footer / Mobile | `40:18107` | `src/layouts/BaseLayout.astro` |
| RecordRow / Desktop | `40:18273` | `src/components/RecordList.astro` |
| RecordRow / Mobile | `40:18589` | `src/components/RecordList.astro` |
| MDX / VpsSpecCard | `40:18923` | `src/components/mdx/VpsSpecCard.astro` |
| MDX / BenchmarkTerminal | `40:18976` | `src/components/mdx/BenchmarkTerminal.astro` |
| MDX / PromoCodeBox | `40:19025` | `src/components/mdx/PromoCodeBox.astro` |
| MDX / RouteTraceTable | `40:19238` | `src/components/mdx/RouteTraceTable.astro` |

记录行提供 Title、Metadata、Country、Destination 文本属性。每个首页视图包含 20 个实例，标题按容器宽度换行；外链与本地文章使用不同方向箭头。

## 变量与字体

- `LowEndAFF / Color`：`VariableCollectionId:18:5`，Light `18:3`、Dark `32:0`，19 个语义颜色变量引用 Primitives，颜色 code syntax 对应 `var(--canvas)` 等实际 CSS 名称。
- 字体使用 Inter、Noto Sans SC、JetBrains Mono；已核实三者均支持 `wght` 轴，并按源码应用 550、650 等字重。
- Layout 集合保留间距与圆角绑定。源码采用字面尺寸，未虚构 CSS 间距变量；具体数值在 `docs/design-tokens.json`。
- 文章数据表是可编辑的 Auto Layout 行和单元格；数字使用 JetBrains Mono，中文使用 Noto Sans SC，表头和内容均左对齐。UI Kit 示例保留其源页面的对齐规则。

## 验证与实现边界

`RecordRow / Mobile` 和 `VpsSpecCard` 已通过官方 `get_design_context` 连同截图抽检，原始上下文结果已移至仓库外历史备份，见 `changes/git-preparation.md`。返回的 React/Tailwind 仅作设计上下文，不得直接替换 Astro 实现。

Figma 交付默认状态设计及组件实例。完整轮播、分页、标签过滤、主题偏好持久化、服务与路由页签由现有本地原型运行；未声称在 Figma 重建全部交互或导入所有隐藏测试数据。阶段 4 已完成本地 MDX、SEO、旧 URL 和验证工程；尚未部署。
