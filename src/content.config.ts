import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { postsLoader } from './loaders/posts';
import { compatibilitySchema, reviewImagesSchema } from './lib/readable-review';

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
  table.extend({
    ...origin,
    type: z.literal('table'),
    id: identifier,
    headings: z.array(z.string()),
  }),
  z.object({ ...origin, type: z.literal('paragraph'), html: z.string() }),
  z.object({ ...origin, type: z.literal('quote'), html: z.string() }),
  z.object({
    ...origin,
    type: z.literal('heading'),
    level: z.number().int().min(1).max(6),
    text: z.string(),
  }),
  z.object({
    ...origin,
    type: z.literal('image'),
    src: httpUrl,
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
    source: httpUrl,
    legacyAnchors: z.record(z.string(), z.string()),
    sections: z.array(
      z.object({
        id: identifier,
        title: z.string(),
        level: z.number().int(),
        line: z.number().int(),
        blocks: z.array(block),
      }),
    ),
  })
  .superRefine((value, ctx) => {
    const ids = value.sections.flatMap((section) => [
      section.id,
      ...section.blocks.flatMap((b) => (b.type === 'table' ? [b.id] : [])),
    ]);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: 'custom',
        message: 'Section and table IDs must be unique',
      });
    for (const title of [
      '买',
      '评',
      '系统信息',
      '网络信息',
      'BGP 透视',
      '服务解锁测试',
      'CPU 性能测试',
      '磁盘性能测试',
      '网络带宽测试',
      'Cloudflare Speedtest',
      'Apple CDN Speedtest',
      '路由追踪',
      '去程路由追踪',
    ]) {
      if (!value.sections.some((s) => s.title === title))
        ctx.addIssue({
          code: 'custom',
          message: `Missing structured review section: ${title}`,
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
      compatibility: compatibilitySchema.optional(),
      images: reviewImagesSchema.optional(),
      recordId: identifier.optional(),
      title: z.string().min(1),
      description: z.string(),
      vendor: z.string().min(1),
      originalUrl: httpUrl
        .refine((value) => {
          const url = new URL(value);
          return (
            url.origin === 'https://lowendaff.com' &&
            /^\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/$/.test(url.pathname) &&
            !url.search &&
            !url.hash
          );
        }, 'Use the original LowEndAFF dated permalink')
        .optional(),
      archiveSnapshot: httpUrl.optional(),
      evidence: z.string().optional(),
      categories: z.array(z.string()).default([]),
      tags: z.array(z.string()).default([]),
      recommendation: z.number().min(0).max(5).optional(),
      author: z.string().default('jam'),
      draft: z.boolean().default(false),
      country: z.string().regex(/^([A-Z]{2})?$/),
      location: z.string(),
      publishedAt: z.iso.date(),
      testedAt: z.string().optional(),
      route: z.string(),
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
    }),
});
// Each placement owns its Markdown files; creatives are never shared implicitly.
const adSchema = z
  .object({
    name: z.string().min(1),
    title: z.string().min(1),
    description: z.string(),
    url: httpUrl,
    tags: z.array(z.string()).default([]),
    theme: z.enum(['indigo', 'orange', 'teal', 'slate']),
    enabled: z.boolean().default(true),
    order: z.number().int().default(0),
    source: z.string(),
  })
  .strict();
const homeAds = defineCollection({
  loader: glob({ base: './src/content/ads/home', pattern: '*.md' }),
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
  articleTopAds,
  articleBottomAds,
  articleSidebarAds,
  sponsors,
  advertising,
};
