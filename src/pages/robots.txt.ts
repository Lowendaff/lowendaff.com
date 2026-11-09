import type { APIRoute } from 'astro';
import { siteIndexable } from '../lib/site';

export const GET: APIRoute = ({ site }) =>
  new Response(
    siteIndexable
      ? `User-agent: *\nAllow: /\nSitemap: ${new URL('/sitemap.xml', site).href}\n`
      : 'User-agent: *\nDisallow: /\n',
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
