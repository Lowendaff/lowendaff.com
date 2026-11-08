import type { CollectionEntry } from 'astro:content';
import { postPath } from './posts';
import { reviewTypeLabels } from './review-types';

export const countryEmoji = (code: string) =>
  code === 'TW'
    ? '🌏'
    : code && code !== 'unspecified'
      ? String.fromCodePoint(...[...code].map((c) => c.charCodeAt(0) + 127397))
      : '🌐';
const regions = new Intl.DisplayNames(['zh-CN'], { type: 'region' });
export const countryLabel = (code: string) =>
  code === 'unspecified' ? '跨境 / 未标注' : regions.of(code) || code;
export function recordTags(
  records: Awaited<ReturnType<typeof getRecords>>,
  key: 'merchant' | 'countryTag',
) {
  const counts = new Map<string, number>();
  for (const post of records)
    counts.set(post[key], (counts.get(post[key]) || 0) + 1);
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort(
      (a, b) => b.count - a.count || a.value.localeCompare(b.value, 'zh-CN'),
    );
}

/** All directory metadata belongs to the posts collection, including archive references. */
export function getRecords(posts: CollectionEntry<'posts'>[]) {
  return posts
    .filter(({ data }) => !data.draft)
    .map(({ id, data }) => ({
      id: data.recordId || id,
      title: data.title,
      reviewType: data.reviewType,
      reviewTypeLabel: reviewTypeLabels[data.reviewType],
      location: data.location,
      country: data.country,
      date: data.publishedAt,
      href:
        data.kind === 'archive-reference'
          ? data.archiveSnapshot!
          : postPath(id),
      external: data.kind === 'archive-reference',
      merchant: data.vendor,
      countryTag: data.country || 'unspecified',
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
