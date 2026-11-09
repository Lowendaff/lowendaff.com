import type { APIRoute } from 'astro';
import { getPublishedPosts, postPath } from '../lib/posts';
import { escapeXml, siteIndexable } from '../lib/site';

export const GET: APIRoute = async ({ site }) => {
  const posts = siteIndexable ? await getPublishedPosts() : [];
  const entries = siteIndexable
    ? [
        { path: '/', lastmod: undefined },
        { path: '/ads/', lastmod: undefined },
        ...(posts.length ? [{ path: '/tags/', lastmod: undefined }] : []),
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
