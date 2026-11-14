# Impeccable 产品上下文初始化

日期：2026-11-15。

## 用户确认

用户确认 LowEndAFF 面向中文 VPS 与独立服务器购买者、技术爱好者，通过真实测试记录、网络线路及服务可用性数据帮助选型；读者理解测试证据优先，赞助与 Affiliate 是商业支持。

## 产物与范围

- 新建根目录 `PRODUCT.md`，使用 `impeccable:product-schema 1` 与 `web` 平台标识，记录受众、目的、内容约束、维护方式、品牌承诺和可访问性要求。
- 既有事实来自用户确认、`AGENTS.md`、`README.md` 和当前项目配置；不增加无证据的市场定位、客户或商业承诺。
- 未修改页面、主题、文章、运行配置或 Figma；本次不创建 `DESIGN.md`。
- 未设置 `buildPath`：当前没有图像生成能力确认或用户对该工作流的选择。未启动 live，也未修改 CSP；需要可视化迭代时再配置 live。
- 产品上下文与工程规范分开维护，详细交互和发布约束继续以 `AGENTS.md` 为准。

## 维护

`PRODUCT.md` 属于可提交的产品文档。以后产生的 `DESIGN.md`、`.impeccable/config.json`、`surfaces/`、`design.json`、`live/config.json` 与 `critique/ignore.md` 也应进入版本控制；运行时 questions、mocks、review、critique 快照及 `config.local.json` 保留本地。不要整体忽略 `.impeccable/`。

下一步可按需使用 `impeccable document` 记录已确认的现有视觉系统。

## 持久化

产品 URI：`viking://resources/projects/lowendaff-ui/PRODUCT.md`。
初始化记录 URI：`viking://resources/projects/lowendaff-ui/impeccable-init.md`。
回读核验与本地检查回执：`test-results/impeccable-init/`。语义索引状态独立于全文写入与回读结果。
