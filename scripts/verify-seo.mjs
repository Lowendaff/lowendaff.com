import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  structuredData,
  serializeJsonLd,
  markdownText,
} from '../src/lib/seo.ts';

test('Article graph links real authorship, dates, publisher, canonical page and breadcrumbs', () => {
  const canonical = new URL('https://lowendaff.com/reviews/example/');
  const schema = structuredData({
    title: 'Example VPS',
    description: 'Measured results',
    canonical,
    article: {
      publishedAt: '2026-10-01',
      updatedAt: '2026-11-09',
      author: 'Writer',
      authorUrl: 'https://example.com/author/',
      tags: ['VPS'],
      section: 'VPS 测评',
    },
    coverImage: '/archive-assets/example.jpg',
    breadcrumbs: [
      { name: '首页', path: '/' },
      { name: 'Example', path: canonical.pathname },
    ],
  });
  const graph = schema['@graph'];
  const article = graph.find((item) => item['@type'] === 'BlogPosting');
  assert.equal(article.dateModified, '2026-11-09');
  assert.equal(article.datePublished, '2026-10-01');
  assert.equal(article.author.url, 'https://example.com/author/');
  assert.equal(
    article.image,
    'https://lowendaff.com/archive-assets/example.jpg',
  );
  assert.equal(article.mainEntityOfPage['@id'], `${canonical.href}#webpage`);
  assert(graph.some((item) => item['@id'] === article.publisher['@id']));
  assert.deepEqual(
    graph
      .find((item) => item['@type'] === 'BreadcrumbList')
      .itemListElement.map((item) => item.position),
    [1, 2],
  );
  assert(!JSON.stringify(schema).includes('SearchAction'));
  assert(!JSON.stringify(schema).includes('aggregateRating'));
});

test('Unchanged articles retain publication date and do not invent a cover or author profile', () => {
  const schema = structuredData({
    title: 'Example',
    description: 'Result',
    canonical: new URL('https://lowendaff.com/reviews/example/'),
    article: { publishedAt: '2026-10-01', author: 'Writer' },
  });
  const article = schema['@graph'].find(
    (item) => item['@type'] === 'BlogPosting',
  );
  assert.equal(article.dateModified, article.datePublished);
  assert.equal(article.image, undefined);
  assert.equal(article.author.url, undefined);
});

test('JSON-LD round trips hostile content without closing its script element', () => {
  const input = { headline: '</script><script>alert(1)</script> & "测试"' };
  const encoded = serializeJsonLd(input);
  assert(!encoded.includes('<'));
  assert.deepEqual(JSON.parse(encoded), input);
});

test('AI index labels cannot introduce a second line or an unescaped link', () => {
  assert.equal(
    markdownText('Vendor\n[link](x) <script>'),
    'Vendor \\[link\\](x) \\<script\\>',
  );
});
