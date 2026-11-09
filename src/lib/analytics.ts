import { z } from 'astro/zod';

const common = {
  name: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  enabled: z.boolean(),
};
const providerSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...common,
      type: z.literal('ga4'),
      measurementId: z.string().regex(/^G-[A-Z0-9]+$/),
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal('script'),
      src: z.url().refine((value) => {
        const url = new URL(value);
        return (
          url.protocol === 'https:' &&
          !url.username &&
          !url.password &&
          !url.hash &&
          url.hostname !== 'www.googletagmanager.com'
        );
      }, 'Use an HTTPS script URL without credentials; use the ga4 adapter for Google Analytics'),
      attributes: z.record(
        z.string().regex(/^data-[a-z0-9]+(?:-[a-z0-9]+)*$/),
        z.string(),
      ),
    })
    .strict(),
]);

export const analyticsSchema = z
  .object({
    enabled: z.boolean(),
    allowedHosts: z
      .array(
        z.string().regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/),
      )
      .min(1),
    excludePaths: z.array(z.string().regex(/^\/(?!\/)[^?#\s]*$/)),
    providers: z.array(providerSchema),
  })
  .strict()
  .superRefine((config, ctx) => {
    const names = config.providers.map((provider) => provider.name);
    const targets = config.providers
      .filter((provider) => provider.enabled)
      .map((provider) =>
        provider.type === 'ga4' ? provider.measurementId : provider.src,
      );
    if (
      new Set(names).size !== names.length ||
      new Set(targets).size !== targets.length
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'Analytics provider names and enabled destinations must be unique',
      });
  });

export type AnalyticsConfig = z.infer<typeof analyticsSchema>;
export type AnalyticsProvider = AnalyticsConfig['providers'][number];

/** Preview builds never include tracking configuration, even with enabled providers. */
export function analyticsForPage(
  config: AnalyticsConfig,
  indexableBuild: boolean,
  path: string,
) {
  return config.enabled && indexableBuild && !config.excludePaths.includes(path)
    ? config.providers.filter((provider) => provider.enabled)
    : [];
}
