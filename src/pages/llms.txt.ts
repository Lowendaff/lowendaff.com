import type { APIRoute } from 'astro';
import { getPublishedPosts, postPath } from '../lib/posts';
import { siteIndexable } from '../lib/site';
import { markdownText, siteIdentity } from '../lib/seo';
import { reviewTypeLabels } from '../lib/review-types';

/** Optional discovery aid; the canonical HTML remains the source of truth. */
export const GET: APIRoute = async ({ site }) => {
  const posts = siteIndexable ? await getPublishedPosts() : [];
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
          ...(posts.length
            ? [
                `- [标签云](${url('/tags/')}): 按商家、国家与测评类型筛选。`,
                `- [测评地图](${url('/map/')}): 按城市浏览已发布的测试记录。`,
              ]
            : []),
          `- [RSS](${url('/rss.xml')}): 已发布的测试记录。`,
          '',
          '## 阅读与引用',
          '',
          '每篇测评的规范 HTML 包含正文、表格和原始输出。请引用文章链接及测试日期，区分套餐承诺与实测结果，保留工具版本、单位、协议、测试地区和局限。',
          '广告及 Sponsors 属于商业展示，不是测评结论。首页线路图是示意图，不代表实时网络遥测。价格和优惠以商家当前页面为准。',
          '',
          '## 测试记录',
          '',
          ...(posts.length
            ? posts.map(
                ({ data }) =>
                  `- [${markdownText(data.title)}](${url(postPath({ data }))}): ${reviewTypeLabels[data.reviewType]}；${markdownText(data.description)} 发布 ${data.publishedAt}${data.updatedAt ? `，更新 ${data.updatedAt}` : ''}。`,
              )
            : ['暂无已发布的测试记录。']),
        ]
      : ['本站当前构建未开放收录。']),
    '',
  ];
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
