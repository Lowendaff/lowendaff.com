import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  structuredData,
  serializeJsonLd,
  markdownText,
  toIsoDateTimeCst,
} from '../src/lib/seo.ts';
import { buildTopicHubs } from '../src/lib/topic-hubs.ts';
import { buildShareLinks } from '../src/lib/share.ts';

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

test('Article license, contentLocation, CST ISO datetime and directory ItemList stay truthful', () => {
  assert.equal(toIsoDateTimeCst('2026-11-27'), '2026-11-27T00:00:00+08:00');
  const articleGraph = structuredData({
    title: 'Panama VPS',
    description: 'Measured results',
    canonical: new URL('https://lowendaff.com/reviews/panama/'),
    article: {
      publishedAt: '2026-11-27',
      author: 'jam',
      license: 'https://creativecommons.org/licenses/by/4.0/',
      location: '巴拿马巴拿马城',
      country: 'PA',
    },
  })['@graph'];
  const postNode = articleGraph.find((item) => item['@type'] === 'BlogPosting');
  assert.equal(
    postNode.license,
    'https://creativecommons.org/licenses/by/4.0/',
  );
  assert.equal(postNode.contentLocation.name, '巴拿马巴拿马城');
  assert.equal(postNode.contentLocation.address.addressCountry, 'PA');

  const listGraph = structuredData({
    title: 'VPS 测评',
    description: 'List',
    canonical: new URL('https://lowendaff.com/vps/'),
    items: [{ name: 'Panama VPS', path: '/reviews/panama/' }],
  })['@graph'];
  const listNode = listGraph.find((item) => item['@type'] === 'ItemList');
  assert.equal(listNode.numberOfItems, 1);
  assert.equal(
    listNode.itemListElement[0].url,
    'https://lowendaff.com/reviews/panama/',
  );
});

test('Topic hubs enforce quality thresholds before emitting crawlable country or vendor pages', () => {
  const makePost = (id, country, vendor, reviewType = 'vps') => ({
    id,
    data: {
      kind: 'review',
      draft: false,
      reviewType,
      title: `${vendor} ${country} VPS 测试记录`,
      permalink: `/reviews/${id}-20261127/`,
      description: '实测记录',
      vendor,
      country,
      location: country,
      geo: { city: country, latitude: 22.28, longitude: 114.17 },
      publishedAt: '2026-11-27',
    },
  });

  const single = buildTopicHubs([makePost('one', 'HK', 'GoMami')]);
  assert.deepEqual(
    single.typeHubs.map((h) => h.path),
    ['/vps/'],
  );
  assert.equal(single.countryHubs.length, 0);
  assert.equal(single.vendorHubs.length, 0);
  assert.equal(single.countryHubHref('HK'), '/tags/?country=HK');
  assert.equal(single.vendorHubHref('GoMami'), '/tags/?merchant=GoMami');

  const multi = buildTopicHubs([
    makePost('one', 'HK', 'GoMami'),
    makePost('two', 'HK', 'GoMami'),
  ]);
  assert.deepEqual(
    multi.countryHubs.map((h) => h.path),
    ['/countries/hk/'],
  );
  assert.deepEqual(
    multi.vendorHubs.map((h) => h.path),
    ['/vendors/gomami/'],
  );
  assert.equal(multi.countryHubHref('HK'), '/countries/hk/');
  assert.equal(multi.vendorHubHref('GoMami'), '/vendors/gomami/');
});

test('Social share links encode Twitter and Telegram intents safely and clamp long verdicts', () => {
  const canonical = encodeURI(
    'https://lowendaff.com/reviews/funom-越南胡志明市-vps-测试记录-20261127/',
  );
  const links = buildShareLinks({
    title: '🇻🇳 Funom 越南胡志明市 VPS 测试记录',
    url: canonical,
    price: '$1.49 / 月',
    verdict: `${'越南原生商业 IP 解锁 Netflix 与 YouTube Premium，移动直连 49ms，'.repeat(5)}#tag & ?x=1`,
  });
  assert.equal(links.shareTitle, 'Funom 越南胡志明市 VPS 测试记录');
  assert.equal(
    links.readableUrl,
    'https://lowendaff.com/reviews/funom-越南胡志明市-vps-测试记录-20261127/',
  );
  const tw = new URL(links.twitterHref);
  assert.equal(tw.origin + tw.pathname, 'https://twitter.com/intent/tweet');
  assert.equal(tw.searchParams.get('url'), canonical);
  const text = tw.searchParams.get('text') ?? '';
  assert(text.startsWith('Funom 越南胡志明市 VPS 测试记录（$1.49 / 月） — '));
  assert(text.endsWith('…'));
  assert([...text].length <= 135);

  const tg = new URL(links.telegramHref);
  assert.equal(tg.origin + tg.pathname, 'https://t.me/share/url');
  assert.equal(tg.searchParams.get('url'), canonical);
});
