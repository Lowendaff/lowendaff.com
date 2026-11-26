import type { APIRoute } from 'astro';
import { getPublishedPosts, postPath } from '../lib/posts';
import { isExoticPost } from '../lib/exotic';
import { buildTopicHubs } from '../lib/topic-hubs';
import { escapeXml, siteIndexable } from '../lib/site';

const latestPostDate = (
  list: Awaited<ReturnType<typeof getPublishedPosts>>,
): string | undefined =>
  list
    .map(({ data }) => data.updatedAt ?? data.publishedAt)
    .sort()
    .at(-1);

export const GET: APIRoute = async ({ site }) => {
  const posts = siteIndexable ? await getPublishedPosts() : [];
  const { allHubs } = buildTopicHubs(posts);
  const latestAll = latestPostDate(posts);
  const latestExotic = latestPostDate(posts.filter(isExoticPost));
  const entries = siteIndexable
    ? [
        { path: '/', lastmod: latestAll },
        { path: '/exotic/', lastmod: latestExotic },
        ...(posts.length ? [{ path: '/map/', lastmod: latestAll }] : []),
        ...(posts.length ? [{ path: '/tags/', lastmod: latestAll }] : []),
        { path: '/ads/', lastmod: undefined },
        ...allHubs.map((hub) => ({
          path: hub.path,
          lastmod: hub.lastmod || undefined,
        })),
        ...posts.map(({ data }) => ({
          path: postPath({ data }),
          lastmod: data.updatedAt ?? data.publishedAt,
        })),
      ]
    : [];
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(({ path, lastmod }) => `  <url><loc>${escapeXml(new URL(path, site).href)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
