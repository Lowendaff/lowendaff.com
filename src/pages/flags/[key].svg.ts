import type { APIRoute } from 'astro';
import flagpack from '@iconify-json/flagpack/icons.json';

const icons = flagpack.icons as Record<string, { body: string }>;

export function getStaticPaths() {
  return Object.keys(icons)
    .filter((key) => /^[a-z0-9-]+$/.test(key))
    .map((key) => ({ params: { key } }));
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
