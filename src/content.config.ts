import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { postsLoader } from './loaders/posts';
import { bilibiliUrls } from './lib/bilibili';
import { reviewTypes } from './lib/review-types';
import { isReviewPermalink } from './lib/review-url';
import { reviewGeoSchema } from './lib/review-map';
import {
  compatibilitySchema,
  reviewImagesSchema,
  STANDARD_DEDICATED_SECTIONS,
  STANDARD_ROUTE_HEADERS,
  STANDARD_VPS_SECTIONS,
} from './lib/readable-review';

const httpUrl = z
  .url()
  .refine((url) => /^https?:\/\//.test(url), 'Use an HTTP(S) URL');
const identifier = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const table = z
  .object({
    headers: z.array(z.string()).min(1),
    rows: z.array(z.array(z.string())),
  })
  .refine(
    ({ headers, rows }) => rows.every((row) => row.length === headers.length),
    'Each row must match the table header width',
  );
const origin = { line: z.number().int().nonnegative() };
const block = z.discriminatedUnion('type', [
  z.object({
    ...origin,
    type: z.literal('bilibili'),
    src: z
      .string()
      .refine(
        (value) => Boolean(bilibiliUrls(value)),
        'Expected a Bilibili video',
      ),
    text: z.string().optional(),
  }),
  table.extend({
    ...origin,
    type: z.literal('table'),
    id: identifier,
    headings: z.array(z.string()),
    links: z
      .record(
        z.string(),
        z.object({
          href: z.string(),
          sponsored: z.boolean().optional(),
        }),
      )
      .optional(),
  }),
  z.object({ ...origin, type: z.literal('paragraph'), html: z.string() }),
  z.object({ ...origin, type: z.literal('quote'), html: z.string() }),
  z.object({
    ...origin,
    type: z.literal('code'),
    id: identifier,
    headings: z.array(z.string()),
    text: z.string(),
    language: z.string(),
  }),
  z.object({
    ...origin,
    type: z.literal('heading'),
    level: z.number().int().min(1).max(6),
    text: z.string(),
  }),
  z.object({
    ...origin,
    type: z.literal('image'),
    src: z.union([httpUrl, z.string().startsWith('/archive-assets/')]),
    alt: z.string(),
    asset: z
      .object({
        local: z.string().startsWith('/archive-assets/').nullable(),
        provenance: z.string(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
      })
      .optional(),
  }),
]);
const review = z
  .object({
    id: identifier,
    source: httpUrl.optional(),
    legacyAnchors: z.record(z.string(), z.string()),
    sections: z
      .array(
        z.object({
          id: identifier,
          title: z.string(),
          level: z.number().int(),
          line: z.number().int(),
          blocks: z.array(block),
        }),
      )
      .min(1),
  })
  .superRefine((value, ctx) => {
    const ids = value.sections.flatMap((section) => [
      section.id,
      ...section.blocks.flatMap((b) => ('id' in b ? [b.id] : [])),
    ]);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: 'custom',
        message: 'Section and table IDs must be unique',
      });
    const supported = [
      // Retained only as source evidence in the two original reviews; never rendered.
      'Bench Report',
      'IPv4 质量分析',
      '买',
      '评',
      '系统信息',
      '网络信息',
      'BGP 透视',
      'IP 质量检测',
      '服务解锁测试',
      'CPU 性能测试',
      '磁盘性能测试',
      '网络带宽测试',
      'Cloudflare Speedtest',
      'Apple CDN Speedtest',
      '路由追踪',
      'TCP 大包回程路由',
      '去程路由追踪',
    ];
    for (const section of value.sections) {
      if (!supported.includes(section.title))
        ctx.addIssue({
          code: 'custom',
          message: `Unsupported review section: ${section.title}; use a supported section with level 3 subheadings`,
        });
    }
  });
const spec = z.object({
  label: z.string(),
  value: z.string(),
  detail: z.string().optional(),
});
const posts = defineCollection({
  loader: postsLoader(),
  schema: z
    .object({
      kind: z.enum(['review', 'archive-reference']).default('review'),
      format: z.enum(['mdx', 'review-markdown']).default('mdx'),
      benchVersion: z.string().trim().min(1).optional(),
      omittedSections: z.array(z.string().trim().min(1)).default([]),
      reviewType: z.enum(reviewTypes).default('vps'),
      compatibility: compatibilitySchema.optional(),
      images: reviewImagesSchema.optional(),
      recordId: identifier.optional(),
      title: z.string().min(1),
      permalink: z
        .string()
        .refine(
          isReviewPermalink,
          'Use /reviews/{normalized-title}-{YYYYMMDD}/',
        )
        .optional(),
      // A new site has one canonical URL per article, without legacy aliases.
      redirectFrom: z.never().optional(),
      description: z.string().trim().min(1),
      vendor: z.string().min(1),
      originalUrl: z.never().optional(),
      archiveSnapshot: httpUrl.optional(),
      evidence: z.string().optional(),
      categories: z.array(z.string()).default([]),
      tags: z.array(z.string()).default([]),
      recommendation: z.number().min(0).max(5).optional(),
      author: z.string().default('jam'),
      authorUrl: httpUrl.optional(),
      coverImage: z
        .union([
          httpUrl,
          z.string().regex(/^\/(?!\/)[^\s?#]+\.(?:png|jpe?g|webp|avif)$/i),
        ])
        .optional(),
      coverAlt: z.string().trim().min(1).optional(),
      draft: z.boolean().default(false),
      country: z.string().regex(/^([A-Z]{2})?$/),
      location: z.string(),
      geo: reviewGeoSchema,
      publishedAt: z.iso.date(),
      updatedAt: z.iso.date().optional(),
      testedAt: z.string().optional(),
      price: z.string().optional(),
      purchaseUrl: httpUrl.optional(),
      affiliate: z.boolean().default(false),
      coupon: z.string().optional(),
      terms: z.string().optional(),
      verdict: z.string().optional(),
      startingPrice: z.boolean().default(false),
      specs: z.array(spec).default([]),
      review: review.optional(),
      showcase: z
        .object({
          specs: z.boolean().default(false),
          promo: z.boolean().default(false),
          terminal: z
            .object({
              title: z.string(),
              output: z.string(),
              source: z.string(),
            })
            .optional(),
          route: z
            .object({
              tableId: identifier,
              target: z.string(),
              protocol: z.enum(['IPv4', 'IPv6']),
            })
            .optional(),
          typography: z.array(z.string()).optional(),
          promoTerms: z.string().optional(),
        })
        .optional(),
    })
    .superRefine((data, ctx) => {
      if (data.kind === 'review' && !data.permalink)
        ctx.addIssue({
          code: 'custom',
          path: ['permalink'],
          message: 'Missing permalink; run npm run urls:fill',
        });
      if (data.updatedAt && data.updatedAt < data.publishedAt)
        ctx.addIssue({
          code: 'custom',
          path: ['updatedAt'],
          message: 'updatedAt must not be earlier than publishedAt',
        });
      if (
        data.kind === 'archive-reference' &&
        (!data.archiveSnapshot || data.review)
      )
        ctx.addIssue({
          code: 'custom',
          message:
            'Archive references need a snapshot URL and cannot contain a local review',
        });
      if (
        data.showcase?.route &&
        !data.review?.sections.some((section) =>
          section.blocks.some(
            (block) =>
              block.type === 'table' &&
              block.id === data.showcase?.route?.tableId,
          ),
        )
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Showcase route must reference a table in this review',
        });
      if (data.showcase?.promo && (!data.price || !data.purchaseUrl))
        ctx.addIssue({
          code: 'custom',
          message: 'Promo showcases require a price and purchase URL',
        });
      if (
        data.format === 'review-markdown' &&
        data.benchVersion &&
        data.review
      ) {
        const requiredSections =
          data.reviewType === 'dedicated'
            ? STANDARD_DEDICATED_SECTIONS
            : STANDARD_VPS_SECTIONS;
        const presentSections = new Set(
          data.review.sections.map((section) => section.title),
        );
        const omittedSet = new Set(data.omittedSections);
        for (const reqTitle of requiredSections) {
          if (!presentSections.has(reqTitle) && !omittedSet.has(reqTitle)) {
            ctx.addIssue({
              code: 'custom',
              path: ['review'],
              message: `Missing standard ${data.reviewType} review section "${reqTitle}" (benchVersion ${data.benchVersion}); include the measurement or declare "${reqTitle}" in omittedSections`,
            });
          }
        }
        const sysSection = data.review.sections.find(
          (section) => section.title === '系统信息',
        );
        const hasVmTelemetry = Boolean(
          sysSection?.blocks.some(
            (b) => b.type === 'code' && b.language === 'vm-cpu-telemetry',
          ),
        );
        if (
          data.reviewType === 'vps' &&
          sysSection &&
          !hasVmTelemetry &&
          !omittedSet.has('vm-cpu-telemetry')
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['review'],
            message: `VPS review (benchVersion ${data.benchVersion}) must include a vm-cpu-telemetry chart block in 系统信息, or declare "vm-cpu-telemetry" in omittedSections`,
          });
        }
        for (const item of omittedSet) {
          if (
            presentSections.has(item) ||
            (item === 'vm-cpu-telemetry' && hasVmTelemetry)
          ) {
            ctx.addIssue({
              code: 'custom',
              path: ['omittedSections'],
              message: `omittedSections lists "${item}" which is actually present in the review`,
            });
          }
        }
        const routeSections = new Set([
          '路由追踪',
          'TCP 大包回程路由',
          '去程路由追踪',
        ]);
        for (const section of data.review.sections) {
          if (!routeSections.has(section.title)) continue;
          for (const b of section.blocks) {
            if (b.type !== 'table') continue;
            const matches =
              b.headers.length === STANDARD_ROUTE_HEADERS.length &&
              b.headers.every((h, idx) => h === STANDARD_ROUTE_HEADERS[idx]);
            if (!matches) {
              ctx.addIssue({
                code: 'custom',
                path: ['review'],
                message: `Route table at line ${b.line} in "${section.title}" must use standard 6-column headers: ${STANDARD_ROUTE_HEADERS.join(' | ')}`,
              });
            }
          }
        }
      }
      if (
        data.kind === 'review' &&
        !data.draft &&
        !data.permalink?.startsWith('/reviews/template-check-')
      ) {
        const textPool = [
          data.title,
          data.description,
          data.vendor,
          data.location,
          data.geo.city,
          data.testedAt ?? '',
          data.purchaseUrl ?? '',
          JSON.stringify(data.review ?? {}),
        ].join('\n');
        if (
          textPool.includes('待填写') ||
          textPool.includes('example.com/replace-')
        ) {
          ctx.addIssue({
            code: 'custom',
            message:
              'Published review (draft: false) must not contain template placeholders ("待填写" or "example.com/replace-")',
          });
        }
        for (const section of data.review?.sections ?? []) {
          for (const b of section.blocks) {
            if (b.type !== 'image') continue;
            const localPath = b.src.startsWith('/archive-assets/')
              ? b.src
              : b.asset?.local;
            if (localPath?.startsWith('/archive-assets/')) {
              const diskPath = resolve(
                process.cwd(),
                'public',
                localPath.replace(/^\/+/, ''),
              );
              if (!existsSync(diskPath)) {
                ctx.addIssue({
                  code: 'custom',
                  path: ['review'],
                  message: `Published review references missing local asset "${localPath}"`,
                });
              }
            }
          }
        }
      }
    }),
});
// Each placement owns its Markdown files; creatives are never shared implicitly.
const adLogoPath = z.string().regex(/^\/brand\/[a-z0-9-]+\.(?:png|svg|webp)$/i);
const adSchema = z
  .object({
    name: z.string().min(1),
    title: z.string().min(1),
    description: z.string(),
    url: httpUrl,
    logo: adLogoPath.optional(),
    logoDark: adLogoPath.optional(),
    tags: z.array(z.string()).default([]),
    theme: z.enum(['indigo', 'orange', 'teal', 'slate']).default('slate'),
    enabled: z.boolean().default(true),
    order: z.number().int().default(0),
    source: z.string(),
  })
  .strict();
const homeAds = defineCollection({
  loader: glob({ base: './src/content/ads/home', pattern: '*.md' }),
  schema: adSchema,
});
const homeFeaturedAds = defineCollection({
  loader: glob({ base: './src/content/ads/home/featured', pattern: '*.md' }),
  schema: adSchema,
});
const articleTopAds = defineCollection({
  loader: glob({ base: './src/content/ads/article-top', pattern: '*.md' }),
  schema: adSchema,
});
const articleBottomAds = defineCollection({
  loader: glob({ base: './src/content/ads/article-bottom', pattern: '*.md' }),
  schema: adSchema,
});
const articleSidebarAds = defineCollection({
  loader: glob({ base: './src/content/ads/article-sidebar', pattern: '*.md' }),
  schema: adSchema,
});
const sponsors = defineCollection({
  loader: glob({ base: './src/content/sponsors', pattern: '*.md' }),
  schema: z.object({
    name: z.string().min(1),
    url: httpUrl,
    logo: z.string().regex(/^[a-zA-Z0-9_-]+\.svg$/),
    brandLogo: adLogoPath.optional(),
    brandLogoDark: adLogoPath.optional(),
    enabled: z.boolean().default(true),
    order: z.number().int().default(0),
    placements: z
      .array(z.literal('article-sidebar'))
      .default(['article-sidebar']),
    source: z.string(),
  }),
});
const details = z.array(
  z.object({ title: z.string(), description: z.string() }),
);
const advertising = defineCollection({
  loader: glob({ base: './src/content/advertising', pattern: '*.md' }),
  schema: z.object({
    contactUrl: httpUrl,
    contactLabel: z.string(),
    sourceUrl: httpUrl,
    reference: z.string(),
    placements: z.array(
      z.object({
        name: z.string(),
        price: z.number().nonnegative(),
        type: z.enum(['home', 'top', 'side', 'bottom']),
        copy: z.string(),
        spec: z.string(),
      }),
    ),
    bundle: z.object({
      price: z.number().nonnegative(),
      description: z.string(),
      availability: z.string(),
    }),
    benefits: details,
    policies: details,
    terms: details,
  }),
});
export const collections = {
  posts,
  homeAds,
  homeFeaturedAds,
  articleTopAds,
  articleBottomAds,
  articleSidebarAds,
  sponsors,
  advertising,
};
