import type { CollectionEntry } from 'astro:content';
import { countryLabel, getRecords } from './records.ts';
import {
  reviewTypes,
  reviewTypeLabels,
  type ReviewType,
} from './review-types.ts';

const localPostPath = (permalink: string) => encodeURI(permalink);

export const MIN_TYPE_HUB_POSTS = 1;
export const MIN_COUNTRY_HUB_POSTS = 2;
export const MIN_VENDOR_HUB_POSTS = 2;

export interface TopicHub {
  kind: 'type' | 'country' | 'vendor';
  key: string;
  slug: string;
  path: string;
  title: string;
  seoTitle: string;
  heading: string;
  description: string;
  lead: string;
  countryCode?: string;
  reviewType?: ReviewType;
  lastmod: string;
  posts: CollectionEntry<'posts'>[];
  records: ReturnType<typeof getRecords>;
}

export function vendorHubSlug(vendor: string): string {
  return vendor
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\p{Script=Han}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

function latestDate(posts: CollectionEntry<'posts'>[]): string {
  return (
    posts
      .map(({ data }) => data.updatedAt ?? data.publishedAt)
      .sort()
      .at(-1) ?? ''
  );
}

export function buildTopicHubs(
  publishedReviewPosts: CollectionEntry<'posts'>[],
) {
  const localPosts = publishedReviewPosts.filter(
    ({ data }) => !data.draft && data.kind === 'review',
  );

  const typeHubs: TopicHub[] = [];
  for (const type of reviewTypes) {
    const matched = localPosts.filter(({ data }) => data.reviewType === type);
    if (matched.length < MIN_TYPE_HUB_POSTS) continue;
    const label = reviewTypeLabels[type];
    const countries = new Set(
      matched.map(({ data }) => data.country).filter(Boolean),
    );
    const vendors = new Set(matched.map(({ data }) => data.vendor));
    const description =
      type === 'vps'
        ? `汇总 LowEndAFF 已发布的 ${matched.length} 篇全球 VPS 云主机实测档案，覆盖 ${countries.size} 个国家或地区与 ${vendors.size} 家服务商的 CPU 基准、%st/%si 抢占曲线、原生流媒体解锁与全国三网回程路由。`
        : `汇总 LowEndAFF 已发布的 ${matched.length} 篇独立服务器与物理裸机实测档案，覆盖 ${countries.size} 个国家或地区与 ${vendors.size} 家服务商的 SMBIOS/SMART 硬件验机、存储吞吐、原生解锁与全国三网回程路由。`;

    typeHubs.push({
      kind: 'type',
      key: type,
      slug: type,
      path: `/${type}/`,
      title: `${label} 测评记录`,
      seoTitle: `${label} 测评与三网回程性能实测记录 · LowEndAFF`,
      heading: `${label} 实测档案库`,
      description,
      lead:
        type === 'vps'
          ? '按真实交付机型记录 KVM / 容器云主机的处理器跑分、宿主机争抢曲线、磁盘 IOPS、原生解锁与全国三网回程。'
          : '按真实上架物理裸机记录硬件规格核验、SMART 磁盘健康、带宽吞吐、原生解锁与全国三网回程。',
      reviewType: type,
      lastmod: latestDate(matched),
      posts: matched,
      records: getRecords(matched),
    });
  }

  const byCountry = new Map<string, CollectionEntry<'posts'>[]>();
  for (const post of localPosts) {
    const code = post.data.country?.trim().toUpperCase();
    if (!code) continue;
    const list = byCountry.get(code) ?? [];
    list.push(post);
    byCountry.set(code, list);
  }

  const countryHubs: TopicHub[] = [...byCountry.entries()]
    .filter(([, list]) => list.length >= MIN_COUNTRY_HUB_POSTS)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([code, matched]) => {
      const regionName = countryLabel(code);
      const slug = code.toLowerCase();
      const cities = [
        ...new Set(matched.map(({ data }) => data.geo.city).filter(Boolean)),
      ];
      const vendors = [...new Set(matched.map(({ data }) => data.vendor))];
      return {
        kind: 'country',
        key: code,
        slug,
        path: `/countries/${slug}/`,
        title: `${regionName} VPS 与服务器测评`,
        seoTitle: `${regionName} VPS 与独立服务器实测汇总（三网回程 / 流媒体解锁） · LowEndAFF`,
        heading: `${regionName} 服务器实测专题`,
        description: `收录 ${matched.length} 篇位于${regionName}（${cities.join('、')}）的 VPS 与独立服务器实测记录，涵盖 ${vendors.slice(0, 4).join('、')} 等商家的硬件基准、IP 质量与全国三网回程路由对比。`,
        lead: `共 ${matched.length} 篇实测档案 · 覆盖 ${cities.join(' / ')} 机房节点。`,
        countryCode: code,
        lastmod: latestDate(matched),
        posts: matched,
        records: getRecords(matched),
      };
    });

  const byVendor = new Map<
    string,
    { vendor: string; posts: CollectionEntry<'posts'>[] }
  >();
  for (const post of localPosts) {
    const slug = vendorHubSlug(post.data.vendor);
    if (!slug) continue;
    const existing = byVendor.get(slug);
    if (existing) existing.posts.push(post);
    else byVendor.set(slug, { vendor: post.data.vendor, posts: [post] });
  }

  const vendorHubs: TopicHub[] = [...byVendor.entries()]
    .filter(([, entry]) => entry.posts.length >= MIN_VENDOR_HUB_POSTS)
    .sort(
      (a, b) =>
        b[1].posts.length - a[1].posts.length || a[0].localeCompare(b[0]),
    )
    .map(([slug, { vendor, posts: matched }]) => {
      const locations = [
        ...new Set(matched.map(({ data }) => data.location).filter(Boolean)),
      ];
      return {
        kind: 'vendor',
        key: vendor,
        slug,
        path: `/vendors/${slug}/`,
        title: `${vendor} 测评汇总`,
        seoTitle: `${vendor} VPS 与服务器实测记录汇总（跑分 / 解锁 / 回程） · LowEndAFF`,
        heading: `${vendor} 实测档案汇总`,
        description: `汇总 ${matched.length} 篇 ${vendor} 旗下机房（${locations.join('、')}）的服务器实测记录，提供性能基准、IP 质量、流媒体解锁与三网回程客观数据对比。`,
        lead: `共收录 ${matched.length} 篇 ${vendor} 不同地区与机型的实测记录。`,
        lastmod: latestDate(matched),
        posts: matched,
        records: getRecords(matched),
      };
    });

  const allHubs = [...typeHubs, ...countryHubs, ...vendorHubs];
  const typePaths = new Map(typeHubs.map((h) => [h.key, h.path]));
  const countryPaths = new Map(countryHubs.map((h) => [h.key, h.path]));
  const vendorPaths = new Map(
    vendorHubs.map((h) => [vendorHubSlug(h.key), h.path]),
  );

  return {
    typeHubs,
    countryHubs,
    vendorHubs,
    allHubs,
    typeHubHref(type: ReviewType): string {
      return typePaths.get(type) ?? `/?type=${type}#reviews`;
    },
    countryHubHref(code?: string): string {
      const normalized = code?.trim().toUpperCase() ?? '';
      if (!normalized) return '/tags/';
      return (
        countryPaths.get(normalized) ??
        `/tags/?country=${encodeURIComponent(normalized)}`
      );
    },
    vendorHubHref(vendor: string): string {
      const slug = vendorHubSlug(vendor);
      return (
        (slug ? vendorPaths.get(slug) : undefined) ??
        `/tags/?merchant=${encodeURIComponent(vendor)}`
      );
    },
    hubListItems(hub: TopicHub) {
      return hub.posts.map((post) => ({
        name: post.data.title,
        path: localPostPath(post.data.permalink!),
      }));
    },
  };
}
