# 统计配置

唯一配置入口是 `src/config/analytics.json`，不通过环境变量设置统计 ID，不在页面中粘贴平台脚本。修改 JSON 后提交 main，CI 构建并由 Webhook 发布后生效；服务器不需要 Node/npm。

## Google Analytics 4

当前配置：

```json
{
  "enabled": true,
  "allowedHosts": ["lowendaff.com"],
  "excludePaths": ["/components/"],
  "providers": [
    {
      "name": "google-analytics",
      "type": "ga4",
      "enabled": true,
      "measurementId": "G-QJ1LPFHGL9"
    }
  ]
}
```

- 顶层 `enabled`：全部统计的总开关。
- `allowedHosts`：允许统计的精确域名，不填写协议、端口或路径；本地 127.0.0.1 / localhost 不在其中。
- `excludePaths`：排除的精确路径，按本站约定保留末尾 `/`。
- `providers[].enabled`：单个平台的开关；`name` 是唯一的配置标识。
- `measurementId`：GA4 Measurement ID。它会出现在公开页面中，属于前端标识，不是管理凭据。

只有正式可收录构建才嵌入统计配置；开发、预览和 PR 构建不发送统计。即使把正式 dist 放到本地预览，浏览器也会先校验域名。组件展示页默认排除，空标签页仍可记录真实访问。

GA4 由适配器统一初始化，多个 GA4 目标共用一次脚本加载；每个目标只配置一次。当前是原生页面导航，不追加 SPA 路由 page_view。自定义事件与 Google Tag Manager 容器不是本次配置范围。

## 增加其他平台

对官方安装方式为「外部脚本 + data-* 属性」的平台，在 `providers` 中加入一项；以下仅是格式示例，不是可直接启用的真实服务：

```json
{
  "name": "umami",
  "type": "script",
  "enabled": false,
  "src": "https://stats.example.com/script.js",
  "attributes": {
    "data-website-id": "replace-with-your-website-id"
  }
}
```

将 `src` 和 `attributes` 替换为对应平台控制台提供的实际值，然后开启这一项。脚本统一异步加载；不支持把任意 JavaScript 或 onload 等事件处理器塞入 JSON。需要特殊初始化的 SDK 应增加独立适配器，配置仍统一放在该文件。

构建校验未知字段、错误 ID、非 HTTPS 脚本、重复目标和非法属性；不会静默忽略错误。运行 `npm run verify:analytics` 检查配置和加载规则，`npm run verify:release` 检查构建输出与 JSON 一致。

## 验证数据

发布后查看 GA 的实时报告；浏览器侧可核对 Google tag 的加载及 `page_view` 请求目标。广告拦截器可能阻止第三方请求。本项目自动浏览器测试会在本地截获采集请求并返回模拟 204，避免测试流量混入真实报表，因此测试通过不代表已验证 GA 管理后台。
