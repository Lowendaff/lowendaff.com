import type { APIRoute } from 'astro';
import { getPublishedPosts, postPath } from '../lib/posts';
import { escapeXml as xml } from '../lib/site';

export const GET: APIRoute = async ({ site }) => {
  const posts = await getPublishedPosts();
  const items = posts
    .map(({ id, data }) => {
      const url = xml(new URL(postPath(id), site).href);
      return `<item><title>${xml(data.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><description>${xml(data.description)}</description><pubDate>${new Date(`${data.publishedAt}T00:00:00+08:00`).toUTCString()}</pubDate></item>`;
    })
    .join('');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>LowEndAFF</title><link>${xml(site!.href)}</link><description>我们评测全世界，让每一次选择都有依据。</description><language>zh-CN</language>${items}</channel></rss>`,
    { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } },
  );
};
