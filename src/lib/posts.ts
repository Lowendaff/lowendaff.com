import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import { comparePostOrder } from './post-sort';
import { assertUniqueReviewUrls } from './review-url';

/** One publication filter for routes, directories and feeds. Drafts never ship. */
export async function getPublishedEntries(
  options: { honorPinned?: boolean } = {},
) {
  const entries = await getCollection('posts');
  assertUniqueReviewUrls(entries);
  const posts = entries.filter(({ data }) => !data.draft);
  for (const post of posts) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.id))
      throw new Error(`Post filenames must be flat kebab-case: ${post.id}`);
  }
  return posts.sort((a, b) =>
    comparePostOrder(
      {
        id: a.id,
        pinned: a.data.pinned,
        publishedAt: a.data.publishedAt,
        updatedAt: a.data.updatedAt,
        testedAt: a.data.testedAt,
      },
      {
        id: b.id,
        pinned: b.data.pinned,
        publishedAt: b.data.publishedAt,
        updatedAt: b.data.updatedAt,
        testedAt: b.data.testedAt,
      },
      options,
    ),
  );
}

export async function getPublishedPosts(
  options: { honorPinned?: boolean } = {},
) {
  return (await getPublishedEntries(options)).filter(
    ({ data }) => data.kind === 'review',
  );
}

export const postPath = ({ data }: Pick<CollectionEntry<'posts'>, 'data'>) =>
  encodeURI(data.permalink!);
