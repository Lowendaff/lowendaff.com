# 测评地球地理数据来源

- 数据：Natural Earth 1:50m（通过 World Atlas 2.0.2 发布），绘制陆地轮廓和国家间共享边界。
- 下载：`https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json`
- 上游说明：`https://github.com/topojson/world-atlas`；许可：`https://www.naturalearthdata.com/about/terms-of-use/`（地理数据为 public domain）。
- 本地文件：`public/globe/geography-50m.json`，约 1.34 MB（未压缩）。由 TopoJSON 的 delta arcs、scale/translate 与反向 arc 索引还原为多边形经纬度，坐标保留三位小数。包含 1,427 个陆地多边形；按国家几何对 arc 的所有权，提取 362 段由不同国家共享的边界，每段只绘制一次，不增加省州界。地理划分沿用上游数据。
- 浏览器根据当前 Tokyo 色板绘制地图，处理日期变更线与南极闭合；不使用卫星照片、Google 地图瓦片或第三方运行时地图服务。
- 测评标记来源独立于地理底图，全部读取文章 `geo`。100TB 的城市坐标 `[34.05, -118.24]` 与项目既有洛杉矶节点相同，仅表示城市。

用户否决的真实地表纹理已移除，不随站点交付。
