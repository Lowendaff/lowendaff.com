import type { ReviewType } from './review-types.ts';

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
