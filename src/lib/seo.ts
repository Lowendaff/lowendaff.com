/** Shared public identity. Review facts always come from Content Collections. */
export const siteIdentity = {
  name: 'LowEndAFF',
  description:
    '全球 VPS 与独立服务器测试记录，涵盖硬件性能、三网回程、BGP 与服务解锁，提供测试条件和原始数据供读者核对。',
  logo: '/brand/lowendaff-avatar.jpg',
  sameAs: ['https://github.com/Lowendaff', 'https://t.me/lowendaff_blog'],
};

export interface ArticleMetadata {
  publishedAt: string;
  updatedAt?: string;
  author: string;
  authorUrl?: string;
  tags?: string[];
  section?: string;
}

export interface Breadcrumb {
  name: string;
  path: string;
}

export function structuredData({
  title,
  description,
  canonical,
  article,
  coverImage,
  breadcrumbs = [],
}: {
  title: string;
  description: string;
  canonical: URL;
  article?: ArticleMetadata;
  coverImage?: string;
  breadcrumbs?: Breadcrumb[];
}) {
  const home = new URL('/', canonical).href;
  const publisher = `${home}#organization`;
  const website = `${home}#website`;
  const page = `${canonical.href}#webpage`;
  const breadcrumb = `${canonical.href}#breadcrumb`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': publisher,
        name: siteIdentity.name,
        url: home,
        logo: {
          '@type': 'ImageObject',
          url: new URL(siteIdentity.logo, home).href,
        },
        sameAs: siteIdentity.sameAs,
      },
      {
        '@type': 'WebSite',
        '@id': website,
        name: siteIdentity.name,
        url: home,
        inLanguage: 'zh-CN',
        publisher: { '@id': publisher },
      },
      {
        '@type': 'WebPage',
        '@id': page,
        url: canonical.href,
        name: title,
        description,
        inLanguage: 'zh-CN',
        isPartOf: { '@id': website },
        ...(breadcrumbs.length ? { breadcrumb: { '@id': breadcrumb } } : {}),
        ...(article
          ? { mainEntity: { '@id': `${canonical.href}#article` } }
          : {}),
      },
      ...(article
        ? [
            {
              '@type': 'BlogPosting',
              '@id': `${canonical.href}#article`,
              headline: title,
              description,
              url: canonical.href,
              datePublished: article.publishedAt,
              dateModified: article.updatedAt ?? article.publishedAt,
              author: {
                '@type': 'Person',
                name: article.author,
                ...(article.authorUrl ? { url: article.authorUrl } : {}),
              },
              publisher: { '@id': publisher },
              mainEntityOfPage: { '@id': page },
              inLanguage: 'zh-CN',
              ...(article.section ? { articleSection: article.section } : {}),
              ...(article.tags?.length
                ? { keywords: article.tags.join(', ') }
                : {}),
              ...(coverImage ? { image: new URL(coverImage, home).href } : {}),
            },
          ]
        : []),
      ...(breadcrumbs.length
        ? [
            {
              '@type': 'BreadcrumbList',
              '@id': breadcrumb,
              itemListElement: breadcrumbs.map((item, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: item.name,
                item: new URL(item.path, home).href,
              })),
            },
          ]
        : []),
    ],
  };
}

/** Prevent content from closing an inline JSON-LD script. */
export const serializeJsonLd = (value: unknown) =>
  JSON.stringify(value).replace(/</g, '\\u003c');

/** Keep authored strings on one line and escape Markdown link labels. */
export const markdownText = (value: string) =>
  value.replace(/\s+/g, ' ').replace(/[\\`*_[\]<>]/g, '\\$&');
