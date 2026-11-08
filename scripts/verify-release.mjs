import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const root = new URL('../dist/', import.meta.url);
const indexable = process.argv.includes('--indexable');
const read = (name) => readFile(new URL(name, root), 'utf8');
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
const redirects = [];
for (const file of pages) {
  const html = await read(file);
  assert(!html.includes('mcp.figma.com'), `${file}: capture script leaked`);
  if (html.includes('http-equiv="refresh"')) {
    redirects.push(file);
    continue;
  }
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/lowendaff.com\//,
    file,
  );
  assert.match(html, /property="og:title"/, file);
  assert.match(html, /href="\/rss.xml"/, file);
  const policy =
    indexable && file !== 'components/index.html'
      ? 'index,follow'
      : 'noindex,nofollow';
  assert(
    html.includes(`name="robots" content="${policy}"`),
    `${file}: robots policy`,
  );
  if (file.startsWith('reviews/')) {
    const json = html.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    )?.[1];
    assert(json, `${file}: article schema missing`);
    assert.equal(JSON.parse(json)['@type'], 'BlogPosting');
    assert(
      !html.includes('Generated at '),
      `${file}: removed timestamp returned`,
    );
    assert(!html.includes('展开全部'), `${file}: expand-all returned`);
  }
}
const rss = await read('rss.xml');
const sitemap = await read('sitemap.xml');
const robots = await read('robots.txt');
const rules = await read('_redirects');
assert.match(rss, /<rss version="2.0">/);
assert(
  !rss.includes('web.archive.org'),
  'RSS must only list locally rendered posts',
);
assert(!sitemap.includes('/components/'), 'UI kit excluded from sitemap');
assert.equal(sitemap.includes('<loc>'), indexable, 'Sitemap publication mode');
assert.equal(robots.includes('Allow: /'), indexable, 'Robots publication mode');
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
