import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { validateConfig, validateIndex } from './indexnow-core.mjs';
import { pageFingerprint } from './build-search-index.mjs';

const root = new URL('../dist/', import.meta.url);
const indexable =
  process.argv.includes('--indexable') ||
  process.env.PUBLIC_SITE_INDEXABLE === 'true';
const read = (name) => readFile(new URL(name, root), 'utf8');
const analytics = JSON.parse(
  await readFile(
    new URL('../src/config/analytics.json', import.meta.url),
    'utf8',
  ),
);
const pages = [];
async function walk(directory = '') {
  for (const entry of await readdir(new URL(directory, root), {
    withFileTypes: true,
  })) {
    if (entry.isDirectory()) await walk(`${directory}${entry.name}/`);
    else if (entry.name.endsWith('.html'))
      pages.push(`${directory}${entry.name}`);
  }
}
await walk();
const sitemap = await read('sitemap.xml');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (match) => match[1],
);
const searchConfig = validateConfig(
  JSON.parse(
    await readFile(
      new URL('../src/config/search-engines.json', import.meta.url),
      'utf8',
    ),
  ),
);
const searchIndex = validateIndex(
  JSON.parse(await read('search-index.json')),
  searchConfig.site,
);
assert.equal(searchIndex.indexable, indexable, 'Search index publication mode');
assert.deepEqual(
  new Set(Object.keys(searchIndex.entries)),
  new Set(urls),
  'Search index matches sitemap',
);
for (const url of urls) {
  const html = await read(new URL(url).pathname.slice(1) + 'index.html');
  assert.equal(
    searchIndex.entries[url],
    await pageFingerprint(html, root),
    'Search content fingerprint',
  );
}
const keyName = `${searchConfig.indexNow.key}.txt`;
if (indexable && searchConfig.indexNow.enabled)
  assert.equal(
    (await read(keyName)).trim(),
    searchConfig.indexNow.key,
    'Public IndexNow verification key',
  );
else
  await assert.rejects(
    read(keyName),
    { code: 'ENOENT' },
    'Preview excludes IndexNow key',
  );
assert.equal(new Set(urls).size, urls.length, 'Unique sitemap URLs');
const expectedUrls = new Set();
const redirects = [];
for (const file of pages) {
  const html = await read(file);
  assert(!html.includes('mcp.figma.com'), `${file}: capture script leaked`);
  if (html.includes('http-equiv="refresh"')) {
    redirects.push(file);
    continue;
  }
  const pagePath = `/${file.replace(/index\.html$/, '')}`;
  const analyticsJson = html.match(
    /<script id="site-analytics-config" type="application\/json">([\s\S]*?)<\/script>/,
  )?.[1];
  const providers = analytics.providers.filter((provider) => provider.enabled);
  const shouldTrack =
    indexable &&
    analytics.enabled &&
    !analytics.excludePaths.includes(pagePath) &&
    providers.length > 0;
  assert.equal(
    Boolean(analyticsJson),
    shouldTrack,
    `${file}: analytics publication policy`,
  );
  if (analyticsJson)
    assert.deepEqual(
      JSON.parse(analyticsJson),
      { allowedHosts: analytics.allowedHosts, providers },
      `${file}: JSON-driven analytics`,
    );
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/lowendaff.com\//,
    file,
  );
  assert.match(html, /property="og:title"/, file);
  assert.match(html, /href="\/rss.xml"/, file);
  const policy =
    indexable &&
    file !== 'components/index.html' &&
    !(
      file === 'tags/index.html' &&
      !pages.some((path) => path.startsWith('reviews/'))
    )
      ? 'index,follow'
      : 'noindex,nofollow';
  assert(
    html.includes(`name="robots" content="${policy}"`),
    `${file}: robots policy`,
  );
  const json = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  )?.[1];
  assert(json, `${file}: schema missing`);
  const schema = JSON.parse(json);
  assert.equal(schema['@context'], 'https://schema.org');
  const graph = schema['@graph'];
  for (const type of ['Organization', 'WebSite', 'WebPage'])
    assert.equal(
      graph.filter((node) => node['@type'] === type).length,
      1,
      `${file}: ${type}`,
    );
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  assert(
    canonical && !new URL(canonical).search && !new URL(canonical).hash,
    `${file}: clean canonical`,
  );
  assert.equal(
    graph.find((node) => node['@type'] === 'WebPage').url,
    canonical,
  );
  if (policy === 'index,follow') expectedUrls.add(canonical);
  for (const marker of [
    'name="description"',
    'property="og:description"',
    'name="twitter:description"',
    'property="og:locale"',
  ])
    assert(html.includes(marker), `${file}: ${marker}`);
  if (file.startsWith('reviews/')) {
    const article = graph.find((node) => node['@type'] === 'BlogPosting');
    assert(article, `${file}: article schema missing`);
    assert.equal(article.url, canonical);
    assert(
      article.dateModified >= article.datePublished,
      `${file}: article date order`,
    );
    assert(article.author.name && article.publisher['@id']);
    assert(graph.some((node) => node['@type'] === 'BreadcrumbList'));
    assert(
      !html.includes('Generated at '),
      `${file}: removed timestamp returned`,
    );
    assert(!html.includes('展开全部'), `${file}: expand-all returned`);
  }
}
const rss = await read('rss.xml');
const robots = await read('robots.txt');
const llms = await read('llms.txt');
const rules = await read('_redirects');
assert.match(rss, /<rss version="2.0">/);
assert(
  !rss.includes('web.archive.org'),
  'RSS must only list locally rendered posts',
);
assert(!sitemap.includes('/components/'), 'UI kit excluded from sitemap');
assert.equal(sitemap.includes('<loc>'), indexable, 'Sitemap publication mode');
assert.equal(robots.includes('Allow: /'), indexable, 'Robots publication mode');
assert.deepEqual(
  new Set(urls),
  expectedUrls,
  'Sitemap matches indexable canonical pages',
);
assert.equal(
  robots.includes('Sitemap: https://lowendaff.com/sitemap.xml'),
  indexable,
);
assert(!/priority|changefreq/.test(sitemap), 'No invented sitemap hints');
assert(!llms.includes('/components/'), 'UI kit excluded from AI directory');
assert(rules.includes('/feed/ /rss.xml 301'), 'Legacy RSS redirect');
assert(redirects.includes('feed/index.html'), 'RSS redirect fallback');
const reviewPages = pages.filter((path) => path.startsWith('reviews/'));
assert.equal(
  (rss.match(/<item>/g) || []).length,
  reviewPages.length,
  'RSS must match actual articles',
);
for (const file of redirects) {
  const html = await read(file);
  const target = html.match(
    /http-equiv="refresh" content="0;url=([^"\s]+)/,
  )?.[1];
  assert(target, `${file}: missing redirect target`);
  await read(target.replace(/^\//, '').replace(/\/$/, '/index.html'));
}
for (const file of reviewPages) {
  const path = `/${file.replace(/index\.html$/, '')}`;
  assert.equal(
    llms.includes(`https://lowendaff.com${path}`),
    indexable,
    `${file}: AI directory policy`,
  );
  if (indexable) {
    const html = await read(file);
    const schema = JSON.parse(
      html.match(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
      )[1],
    );
    const article = schema['@graph'].find(
      (node) => node['@type'] === 'BlogPosting',
    );
    assert(
      sitemap.includes(
        `<loc>https://lowendaff.com${path}</loc><lastmod>${article.dateModified}</lastmod>`,
      ),
      `${file}: lastmod uses authored dates`,
    );
  }
}
console.log(
  JSON.stringify(
    {
      indexable,
      htmlPages: pages.length,
      redirectPages: redirects.length,
      rssItems: (rss.match(/<item>/g) || []).length,
      sitemapUrls: (sitemap.match(/<loc>/g) || []).length,
      captureScriptAbsent: true,
      metadataValidated: true,
    },
    null,
    2,
  ),
);
