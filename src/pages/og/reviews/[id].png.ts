import type { APIRoute } from 'astro';
import type { CollectionEntry } from 'astro:content';
import { getPublishedPosts } from '../../../lib/posts';
import { renderReviewOgPng } from '../../../lib/og-image';

export async function getStaticPaths() {
  return (await getPublishedPosts()).map((post) => ({
    params: { id: post.id },
    props: { post },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { post } = props as { post: CollectionEntry<'posts'> };
  const p = post.data;
  const png = await renderReviewOgPng({
    title: p.title,
    description: p.description,
    verdict: p.verdict,
    vendor: p.vendor,
    country: p.country,
    location: p.location,
    reviewType: p.reviewType,
    publishedAt: p.publishedAt,
    testedAt: p.testedAt,
    price: p.price,
  });
  return new Response(Buffer.from(png), {
    headers: { 'Content-Type': 'image/png' },
  });
};
