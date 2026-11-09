import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const created = [];
const build = (indexable) =>
  execFileSync('npm', ['run', 'build'], {
    cwd: root,
    env: { ...process.env, PUBLIC_SITE_INDEXABLE: String(indexable) },
    stdio: 'pipe',
  });
const content = (draft) => `---
permalink: '/reviews/pipeline-verification-${draft ? 'draft' : 'published'}-20261101/'
title: 'Pipeline verification ${draft ? 'draft' : 'published'}'
description: 'Temporary build fixture, removed after verification.'
vendor: 'Fixture'
country: 'US'
location: 'Fixture'
geo: { city: Fixture, latitude: 34.05, longitude: -118.24 }
publishedAt: '2026-11-01'
updatedAt: '2026-11-09'
testedAt: '2026-11-01'
route: 'Fixture'
draft: ${draft}
---
import VpsSpecCard from '../../components/mdx/VpsSpecCard.astro';

## Pipeline fixture heading

This paragraph must render through the MDX collection.

<VpsSpecCard specs={[{ label: 'Fixture CPU', value: '1 vCPU' }]} />
`;
try {
  for (const draft of [false, true]) {
    const file = new URL(
      `src/content/posts/pipeline-verification-${draft ? 'draft' : 'published'}.mdx`,
      root,
    );
    await writeFile(file, content(draft), { flag: 'wx' });
    created.push(file);
  }
  build(true);
  const article = await readFile(
    new URL(
      'dist/reviews/pipeline-verification-published-20261101/index.html',
      root,
    ),
    'utf8',
  );
  assert(
    article.includes('This paragraph must render through the MDX collection.'),
  );
  assert(article.includes('data-component="VpsSpecCard"'));
  assert(article.includes('href="#pipeline-fixture-heading"'));
  for (const file of [
    'index.html',
    'tags/index.html',
    'map/index.html',
    'rss.xml',
    'sitemap.xml',
    'llms.txt',
  ]) {
    const html = await readFile(new URL(`dist/${file}`, root), 'utf8');
    assert(
      html.includes('pipeline-verification-published'),
      `${file}: new post missing`,
    );
    assert(
      !html.includes('pipeline-verification-draft'),
      `${file}: draft leaked`,
    );
  }
  await assert.rejects(
    readFile(
      new URL(
        'dist/reviews/pipeline-verification-draft-20261101/index.html',
        root,
      ),
    ),
    { code: 'ENOENT' },
  );
  console.log(
    execFileSync('node', ['scripts/verify-release.mjs', '--indexable'], {
      cwd: root,
      encoding: 'utf8',
    }),
  );
  const sitemap = await readFile(new URL('dist/sitemap.xml', root), 'utf8');
  assert(sitemap.includes('<lastmod>2026-11-09</lastmod>'));
  assert(article.includes('2026-11-09 更新'));
  build(false);
  console.log(
    execFileSync('node', ['scripts/verify-release.mjs'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, PUBLIC_SITE_INDEXABLE: 'false' },
    }),
  );
  console.log(
    'PASS: native MDX, component rendering, TOC, directory, RSS, sitemap and draft exclusion.',
  );
} finally {
  for (const file of created) await unlink(file);
  build(false);
}
