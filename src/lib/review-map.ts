import { z } from 'astro/zod';
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
interface MapPost {
  data: {
    title: string;
    permalink?: string;
    vendor: string;
    country: string;
    location: string;
    publishedAt: string;
    testedAt?: string;
    reviewType: ReviewType;
    kind: 'review' | 'archive-reference';
    draft: boolean;
    geo: z.infer<typeof reviewGeoSchema>;
  };
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
      date: data.testedAt?.slice(0, 10) ?? data.publishedAt,
      reviewType: data.reviewType,
    };
    const geo = reviewGeoSchema.parse(data.geo);
    const id = `${data.country.toLowerCase()}-${geo.city.normalize('NFKC').toLowerCase()}`;
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
    b.date.localeCompare(a.date) || a.href.localeCompare(b.href);
  for (const place of places.values()) place.articles.sort(newest);
  return {
    places: [...places.values()].sort(
      (a, b) =>
        b.articles.length - a.articles.length ||
        a.city.localeCompare(b.city, 'zh-CN'),
    ),
  };
}
