import type { APIRoute } from 'astro';
import type { CollectionEntry } from 'astro:content';
import { getPublishedPosts } from '../../../lib/posts';
import { siteIndexable } from '../../../lib/site';
import { renderPostAiMarkdown } from '../../../lib/ai-markdown';

export async function getStaticPaths() {
  if (!siteIndexable) return [];
  return (await getPublishedPosts()).map((post) => ({
    params: { id: post.id },
    props: { post },
  }));
}

export const GET: APIRoute = ({ props, site }) => {
  const { post } = props as { post: CollectionEntry<'posts'> };
  return new Response(renderPostAiMarkdown(post, site!), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
