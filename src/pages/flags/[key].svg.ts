import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import flagpack from '@iconify-json/flagpack/icons.json';
import { EXOTIC_TERRITORIES } from '../../lib/exotic';

const icons = flagpack.icons as Record<string, { body: string }>;
const aliases: Record<string, string> = {
  uk: 'gb-ukm',
  gb: 'gb-ukm',
};

export async function getStaticPaths() {
  const posts = await getCollection('posts');
  const needed = new Set<string>();
  const register = (raw?: string) => {
    const normalized = (raw ?? '').trim().toLowerCase();
    const key = aliases[normalized] ?? normalized;
    if (key && /^[a-z0-9-]+$/.test(key) && icons[key]) {
      needed.add(key);
    }
  };
  for (const post of posts) register(post.data.country);
  for (const item of EXOTIC_TERRITORIES) register(item.code);
  return [...needed].sort().map((key) => ({ params: { key } }));
}

export const GET: APIRoute = ({ params }) => {
  const key = params.key ?? '';
  const icon = icons[key];
  if (!icon) return new Response('Not found', { status: 404 });
  const width = flagpack.width ?? 32;
  const height = flagpack.height ?? 24;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${icon.body}</svg>`;
  return new Response(svg, {
    headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' },
  });
};
