import type { APIRoute } from 'astro';
import { renderDefaultOgPng } from '../../lib/og-image';

export const GET: APIRoute = async () => {
  const png = await renderDefaultOgPng();
  return new Response(Buffer.from(png), {
    headers: { 'Content-Type': 'image/png' },
  });
};
