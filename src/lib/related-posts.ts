import type { CollectionEntry } from 'astro:content';
import { postPath } from './posts';
import { countryLabel } from './records';
import { reviewPlaceHref } from './review-map';
import { reviewTypeLabels } from './review-types';

const MACRO_REGIONS: Record<string, string> = {
  US: '北美西岸与美东',
  CA: '北美西岸与美东',
  MX: '北美与拉美',
  HK: '亚太东亚枢纽',
  MO: '亚太东亚枢纽',
  TW: '亚太东亚枢纽',
  JP: '亚太东亚枢纽',
  KR: '亚太东亚枢纽',
  SG: '东南亚与澳新',
  MY: '东南亚与澳新',
  TH: '东南亚与澳新',
  VN: '东南亚与澳新',
  ID: '东南亚与澳新',
  AU: '东南亚与澳新',
  DE: '欧洲骨干枢纽',
  NL: '欧洲骨干枢纽',
  GB: '欧洲骨干枢纽',
  UK: '欧洲骨干枢纽',
  FR: '欧洲骨干枢纽',
};

export interface RelatedArticleItem {
  id: string;
  href: string;
  external: boolean;
  title: string;
  description: string;
  merchant: string;
  country: string;
  location: string;
  reviewTypeLabel: string;
  date: string;
  reasons: string[];
  score: number;
}

export interface InferredTopicChannel {
  badge: string;
  title: string;
  subtitle: string;
  href: string;
  icon: string;
  countryCode?: string;
}

export function buildRecommendations(
  current: CollectionEntry<'posts'>,
  allPosts: CollectionEntry<'posts'>[],
  limit = 6,
) {
  const p = current.data;
  const currentHref = postPath(current);
  const currentId = p.recordId || current.id;
  const currentTags = new Set(
    [...(p.tags || []), ...(p.categories || [])]
      .map((t) => t.trim())
      .filter(Boolean),
  );
  const currentMacro = p.country ? MACRO_REGIONS[p.country] : undefined;

  const articles: RelatedArticleItem[] = allPosts
    .filter(({ data }) => !data.draft)
    .filter((entry) => {
      const id = entry.data.recordId || entry.id;
      const href =
        entry.data.kind === 'archive-reference'
          ? entry.data.archiveSnapshot!
          : postPath(entry);
      return id !== currentId && href !== currentHref;
    })
    .map((entry) => {
      const d = entry.data;
      let score = 0;
      const reasons: string[] = [];

      if (d.vendor === p.vendor) {
        score += 6;
        reasons.push(`同商家 · ${d.vendor}`);
      }

      if (p.country && d.country === p.country) {
        if (p.geo?.city && d.geo?.city === p.geo.city) {
          score += 5;
          reasons.push(`同城市 · ${d.geo.city}`);
        } else {
          score += 4;
          reasons.push(`同地区 · ${countryLabel(d.country)}`);
        }
      } else if (
        currentMacro &&
        d.country &&
        MACRO_REGIONS[d.country] === currentMacro
      ) {
        score += 2;
        reasons.push(`相邻区域 · ${currentMacro}`);
      }

      const candidateTags = [...(d.tags || []), ...(d.categories || [])]
        .map((t) => t.trim())
        .filter(Boolean);
      const sharedTags = candidateTags.filter((t) => currentTags.has(t));
      if (sharedTags.length > 0) {
        score += Math.min(6, sharedTags.length * 3);
        reasons.push(`同标签 · ${sharedTags[0]}`);
      }

      if (d.reviewType === p.reviewType) {
        score += 1;
        if (reasons.length === 0) {
          reasons.push(`同类机型 · ${reviewTypeLabels[d.reviewType]}`);
        }
      }

      if (reasons.length === 0) {
        reasons.push('其他实测推荐');
      }

      return {
        id: d.recordId || entry.id,
        href:
          d.kind === 'archive-reference' ? d.archiveSnapshot! : postPath(entry),
        external: d.kind === 'archive-reference',
        title: d.title.replace(/^(?:\p{Regional_Indicator}{2}\s*)+/u, ''),
        description: d.description || '',
        merchant: d.vendor,
        country: d.country,
        location: d.location,
        reviewTypeLabel: reviewTypeLabels[d.reviewType],
        date: d.publishedAt,
        reasons: reasons.slice(0, 2),
        score,
      };
    })
    .sort((a, b) => b.score - a.score || b.date.localeCompare(a.date))
    .slice(0, limit);

  // Build inferred topic channels from the article's region, vendor and tags.
  const inferredTopics: InferredTopicChannel[] = [];
  if (p.country) {
    const regionText = countryLabel(p.country);
    inferredTopics.push({
      badge: `同国家地区 · ${p.country}`,
      title: `${regionText}${p.geo?.city ? ` · ${p.geo.city}` : ''} 相关测评`,
      subtitle: `检索位于${regionText}机房的其他 VPS 与独服实测数据`,
      href: `/tags/?country=${encodeURIComponent(p.country)}`,
      icon: 'location-line',
      countryCode: p.country,
    });
  }
  if (p.geo?.city && p.country) {
    inferredTopics.push({
      badge: '空间邻近节点',
      title: `在 3D 地图定位 ${p.geo.city}`,
      subtitle: '查看当地及周边城市的测评记录',
      href: reviewPlaceHref(p.country, p.geo.city, p.reviewType),
      icon: 'earth-2-line',
    });
  }
  inferredTopics.push({
    badge: `服务商档案 · ${p.vendor}`,
    title: `${p.vendor} 关联机型与同级对比`,
    subtitle:
      p.tags.length > 0
        ? `关联标签：${p.tags.slice(0, 3).join(' / ')}`
        : '查看这家服务商的其他测评',
    href: `/tags/?merchant=${encodeURIComponent(p.vendor)}`,
    icon: 'building-2-line',
  });
  inferredTopics.push({
    badge: '边缘网络延伸',
    title: '奇葩小国 · 冷门地区与稀有海缆图鉴',
    subtitle: '对比常规热门机房与全球 44 处奇葩小国节点的路由差异',
    href: '/exotic/',
    icon: 'planet-line',
  });

  return { articles, inferredTopics };
}
