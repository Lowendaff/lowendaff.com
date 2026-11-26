import type { APIRoute } from 'astro';
import { getPublishedPosts, postPath } from '../lib/posts';
import { buildTopicHubs } from '../lib/topic-hubs';
import { siteIndexable } from '../lib/site';
import { markdownText, siteIdentity } from '../lib/seo';
import { reviewTypeLabels } from '../lib/review-types';

/** Optional discovery aid; the canonical HTML remains the source of truth. */
export const GET: APIRoute = async ({ site }) => {
  const posts = siteIndexable ? await getPublishedPosts() : [];
  const { allHubs } = buildTopicHubs(posts);
  const url = (path: string) => new URL(path, site).href;
  const lines = [
    `# ${siteIdentity.name}`,
    '',
    `> ${siteIdentity.description}`,
    '',
    ...(siteIndexable
      ? [
          '## 站点入口',
          '',
          `- [首页](${url('/')}): VPS 与独立服务器测试记录。`,
          `- [奇葩小国](${url('/exotic/')}): 冷门国家、孤岛海缆与稀有自治域测试记录。`,
          ...(posts.length
            ? [
                `- [测评地图](${url('/map/')}): 按城市浏览已发布的测试记录。`,
                `- [标签云](${url('/tags/')}): 按商家、国家与测评类型筛选。`,
              ]
            : []),
          ...allHubs.map(
            (hub) =>
              `- [${markdownText(hub.title)}](${url(hub.path)}): ${markdownText(hub.lead)}`,
          ),
          `- [全量实测语料（LLM 精简版）](${url('/llms-full.txt')}): 汇总全部已发布测评的完整跑分表格与路由自治域路径摘要。`,
          `- [RSS](${url('/rss.xml')}): 已发布的测试记录订阅源。`,
          '',
          '## 阅读与引用',
          '',
          '每篇测评均提供规范 HTML 页面（含全部逐跳路由表）与精简 Markdown 镜像（`/ai/reviews/{id}.md`）。请引用规范链接及测试日期，区分套餐承诺与实测结果，保留工具版本、单位、协议、测试地区和局限。',
          '原创内容采用 CC BY 4.0 许可协议（https://creativecommons.org/licenses/by/4.0/）。广告及 Sponsors 属于商业展示，不是测评结论；价格和优惠以商家当前页面为准。',
          '',
          '## 测试记录',
          '',
          ...(posts.length
            ? posts.map((post) => {
                const { data } = post;
                const metaParts = [
                  reviewTypeLabels[data.reviewType],
                  `${markdownText(data.location)}（${markdownText(data.vendor)}）`,
                  ...(data.price ? [`参考价 ${markdownText(data.price)}`] : []),
                ];
                const verdictPart = data.verdict
                  ? ` 核心结论：${markdownText(data.verdict)}`
                  : '';
                return `- [${markdownText(data.title)}](${url(postPath(post))}): ${metaParts.join(' · ')}；${markdownText(data.description)}${verdictPart} 发布 ${data.publishedAt}${data.updatedAt ? `，更新 ${data.updatedAt}` : ''}（[Markdown 原文](${url(`/ai/reviews/${post.id}.md`)})）。`;
              })
            : ['暂无已发布的测试记录。']),
        ]
      : ['本站当前构建未开放收录。']),
    '',
  ];
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
