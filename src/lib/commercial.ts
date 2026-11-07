import { getCollection, type CollectionEntry } from 'astro:content';
export type AdCollection =
  'homeAds' | 'articleTopAds' | 'articleBottomAds' | 'articleSidebarAds';
export type Ad = CollectionEntry<AdCollection>['data'] & { id: string };
export async function getAds(collection: AdCollection): Promise<Ad[]> {
  return (await getCollection(collection, ({ data }) => data.enabled))
    .sort((a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id))
    .map(({ id, data }) => ({ id, ...data }));
}
export async function getSponsors(placement: 'article-sidebar') {
  return (
    await getCollection(
      'sponsors',
      ({ data }) => data.enabled && data.placements.includes(placement),
    )
  )
    .sort((a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id))
    .map(({ id, data }) => ({ id, ...data }));
}
