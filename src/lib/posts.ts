import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import { assertUniqueReviewUrls } from './review-url';

/** One publication filter for routes, directories and feeds. Drafts never ship. */
export async function getPublishedEntries() {
  const entries = await getCollection('posts');
  assertUniqueReviewUrls(entries);
  const posts = entries.filter(({ data }) => !data.draft);
  const sources = new Set<string>();
  for (const post of posts) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.id))
      throw new Error(`Post filenames must be flat kebab-case: ${post.id}`);
    if (post.data.originalUrl) {
      const key = decodeURI(new URL(post.data.originalUrl).pathname);
      if (sources.has(key)) throw new Error(`Duplicate original URL: ${key}`);
      sources.add(key);
    }
  }
  return posts.sort((a, b) =>
    b.data.publishedAt.localeCompare(a.data.publishedAt),
  );
}

export async function getPublishedPosts() {
  return (await getPublishedEntries()).filter(
    ({ data }) => data.kind === 'review',
  );
}

export const postPath = ({ data }: Pick<CollectionEntry<'posts'>, 'data'>) =>
  encodeURI(data.permalink!);
