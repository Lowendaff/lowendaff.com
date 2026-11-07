import type { APIRoute } from 'astro';
import { getPublishedPosts, postPath } from '../lib/posts';
import { escapeXml, siteIndexable } from '../lib/site';

export const GET: APIRoute = async ({ site }) => {
  const paths = siteIndexable
    ? [
        '/',
        '/ads/',
        '/tags/',
        ...(await getPublishedPosts()).map(({ id }) => postPath(id)),
      ]
    : [];
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${escapeXml(new URL(path, site).href)}</loc></url>`).join('')}</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
