import { z } from 'astro/zod';
import { comparePostOrder } from './post-sort.ts';
import type { ReviewType } from './review-types';

/** City-level reference coordinates, never a datacenter's exact address. */
export const reviewGeoSchema = z
  .object({
    city: z.string().trim().min(1).max(80),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .strict();

export interface MapArticle {
  title: string;
  href: string;
  vendor: string;
  country: string;
  location: string;
  date: string;
  testedAt?: string;
  pinned?: boolean;
  reviewType: ReviewType;
}
export interface ReviewPlace {
  id: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  articles: MapArticle[];
}
export type MapReviewFilter = 'all' | ReviewType;
export type FilteredReviewPlace = ReviewPlace & {
  count: number;
};

export function filterReviewPlaces(
  places: ReviewPlace[],
  type: MapReviewFilter = 'all',
): FilteredReviewPlace[] {
  const filtered: FilteredReviewPlace[] = [];
  for (const place of places) {
    const articles =
      type === 'all'
        ? place.articles
        : place.articles.filter((article) => article.reviewType === type);
    if (!articles.length) continue;
    filtered.push({
      ...place,
      articles,
      count: articles.length,
    });
  }
  return filtered.sort(
    (a, b) => b.count - a.count || a.city.localeCompare(b.city, 'zh-CN'),
  );
}
interface MapPost {
  data: {
    title: string;
    permalink?: string;
    vendor: string;
    country: string;
    location: string;
    publishedAt: string;
    testedAt?: string;
    pinned?: boolean;
    reviewType: ReviewType;
    kind: 'review' | 'archive-reference';
    draft: boolean;
    geo: z.infer<typeof reviewGeoSchema>;
  };
}

export function reviewPlaceId(country: string, city: string) {
  return `${country.toLowerCase()}-${city.trim().normalize('NFKC').toLowerCase()}`;
}

export function reviewPlaceHref(
  country: string,
  city: string,
  reviewType: ReviewType,
) {
  const params = new URLSearchParams({
    type: reviewType,
    place: reviewPlaceId(country, city),
  });
  return `/map/?${params.toString()}`;
}

export function buildReviewMap(posts: MapPost[]) {
  const places = new Map<string, ReviewPlace>();
  for (const { data } of posts) {
    if (data.draft || data.kind !== 'review') continue;
    if (!data.permalink) throw new Error(`${data.title}: missing permalink`);
    const article: MapArticle = {
      title: data.title,
      href: encodeURI(data.permalink),
      vendor: data.vendor,
      country: data.country,
      location: data.location,
      date: data.publishedAt,
      testedAt: data.testedAt,
      pinned: Boolean(data.pinned),
      reviewType: data.reviewType,
    };
    const geo = reviewGeoSchema.parse(data.geo);
    const id = reviewPlaceId(data.country, geo.city);
    const place = places.get(id) ?? {
      id,
      country: data.country,
      ...geo,
      articles: [],
    };
    place.articles.push(article);
    places.set(id, place);
  }
  const newest = (a: MapArticle, b: MapArticle) =>
    comparePostOrder(
      {
        id: a.href,
        pinned: a.pinned,
        publishedAt: a.date,
        testedAt: a.testedAt,
      },
      {
        id: b.href,
        pinned: b.pinned,
        publishedAt: b.date,
        testedAt: b.testedAt,
      },
    );
  for (const place of places.values()) place.articles.sort(newest);
  return {
    places: [...places.values()].sort(
      (a, b) =>
        b.articles.length - a.articles.length ||
        a.city.localeCompare(b.city, 'zh-CN'),
    ),
  };
}
