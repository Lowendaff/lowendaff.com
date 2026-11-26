import type { APIRoute } from 'astro';
import { getPublishedPosts, postPath } from '../lib/posts';
import { countryLabel } from '../lib/records';
import { reviewTypeLabels } from '../lib/review-types';
import { escapeXml as xml } from '../lib/site';

export const GET: APIRoute = async ({ site }) => {
  const posts = await getPublishedPosts();
  const items = posts
    .map(({ data }) => {
      const url = xml(new URL(postPath({ data }), site).href);
      const summary = data.verdict
        ? `${data.description} 核心结论：${data.verdict}`
        : data.description;
      const categories = [
        ...new Set(
          [
            reviewTypeLabels[data.reviewType],
            data.country ? countryLabel(data.country) : '',
            data.vendor,
            ...data.tags,
          ].filter(Boolean),
        ),
      ]
        .map((cat) => `<category>${xml(cat)}</category>`)
        .join('');
      return `<item><title>${xml(data.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><description>${xml(summary)}</description>${categories}<pubDate>${new Date(`${data.publishedAt}T00:00:00+08:00`).toUTCString()}</pubDate></item>`;
    })
    .join('');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>LowEndAFF</title><link>${xml(site!.href)}</link><description>我们评测全世界，让每一次选择都有依据。</description><language>zh-CN</language>${items}</channel></rss>`,
    { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } },
  );
};
