import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseHtml } from 'parse5';
import { parse, stringify } from 'yaml';
import {
  astroBin,
  cloneIsolatedWorkspace,
  createIsolatedWorkspace,
  defaultWorkerCount,
  execFileAsync,
  repoRoot,
} from './isolated-workspace.mjs';
const articlePath = 'src/content/posts/markdown-verification.mdx';
const sponsorPath = 'src/content/sponsors/markdown-fixture.md';
const results = [];

const unpack = (text) => {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  assert(match);
  return { data: parse(match[1]), body: text.slice(match[0].length) };
};
const pack = ({ data, body = '' }) =>
  `---\n${stringify(data, { lineWidth: 0 }).replace(/^publishedAt: (\d{4}-\d{2}-\d{2})$/m, "publishedAt: '$1'")}---\n${body}`;

const tempDirs = [];
try {
  const workDir = await createIsolatedWorkspace('lowendaff-markdown-');
  tempDirs.push(workDir);

  const originals = new Map();
  const created = [];
  const file = (relPath) => join(workDir, relPath);
  const read = (relPath) => readFile(file(relPath), 'utf8');
  const build = () =>
    execFileSync('npm', ['run', 'build'], {
      cwd: workDir,
      env: {
        ...process.env,
        ASTRO_TELEMETRY_DISABLED: '1',
        PUBLIC_SITE_INDEXABLE: 'false',
      },
      stdio: 'pipe',
      maxBuffer: 8 * 1024 * 1024,
    });

  async function edit(relPath, change, changeBody = (body) => body) {
    if (!originals.has(relPath)) originals.set(relPath, await read(relPath));
    const content = unpack(originals.get(relPath));
    change(content.data);
    content.body = changeBody(content.body);
    await writeFile(file(relPath), pack(content));
  }
  async function restore() {
    for (const [relPath, text] of originals)
      await writeFile(file(relPath), text);
  }
  async function scenario(name) {
    const path = `/tmp/lowendaff-content-scenarios/${name}`;
    await mkdir(path, { recursive: true });
    await cp(file('dist/index.html'), `${path}/index.html`);
  }

  // Test content is synthetic and isolated; never edit published articles.
  const metadata = {
    kind: 'review',
    format: 'review-markdown',
    title: 'Markdown verification fixture',
    permalink: '/reviews/markdown-verification-20261108/',
    description: 'Synthetic integration data',
    vendor: 'Fixture',
    country: 'US',
    location: 'Fixture',
    geo: { city: 'Fixture', latitude: 34.05, longitude: -118.24 },
    publishedAt: '2026-11-08',
    specs: [{ label: 'Fixture CPU', value: '1 vCPU' }],
    compatibility: {
      tables: { '路由追踪 / 中国境内目标 / 北京电信 (IPv4)': 'fixture-route' },
    },
    showcase: {
      specs: true,
      route: { tableId: 'fixture-route', target: 'Fixture', protocol: 'IPv4' },
    },
  };
  const body = `
## 买

Synthetic fixture; never published.

## 系统信息

| Name | Value |
| --- | --- |
| Fixture CPU | 1 vCPU |

## CPU 性能测试

| Test | Result |
| --- | --- |
| Fixture score | 888.77 |

## 路由追踪

### 中国境内目标

#### 北京电信 (IPv4)

| Hop | RTT |
| --- | --- |
| Fixture | 151.11 ms |
`;
  await writeFile(file(articlePath), pack({ data: metadata, body }), {
    flag: 'wx',
  });
  await writeFile(
    file('src/content/posts/markdown-reference.mdx'),
    pack({
      data: {
        kind: 'archive-reference',
        title: 'Archive reference fixture',
        description: 'Synthetic reference',
        vendor: 'Fixture',
        country: '',
        location: 'Fixture',
        geo: { city: 'Fixture', latitude: 34.05, longitude: -118.24 },
        publishedAt: '2026-11-08',
        archiveSnapshot: 'https://example.com/archive-fixture',
      },
    }),
    { flag: 'wx' },
  );
  await writeFile(
    file(sponsorPath),
    pack({
      data: {
        name: 'MARKDOWN_NEW_SPONSOR',
        url: 'https://example.com/markdown-sponsor',
        logo: '00.svg',
        enabled: true,
        order: 0,
        placements: ['article-sidebar'],
        source: 'Verification fixture',
      },
    }),
    { flag: 'wx' },
  );

  const rejectCases = [
    [
      'src/content/ads/home/dmit.md',
      (data) => {
        data.placements = ['invalid-slot'];
      },
      'placements',
    ],
    [
      'src/content/ads/home/dmit.md',
      (data) => {
        data.url = 'javascript:alert(1)';
      },
      'HTTP(S)',
    ],
    [
      sponsorPath,
      (data) => {
        data.logo = 'missing-test.svg';
      },
      'Missing sponsor SVG',
    ],
    [
      articlePath,
      (data) => {
        data.format = 'mdx';
        data.review = {
          id: 'markdown-verification',
          legacyAnchors: {},
          sections: [
            {
              id: 'fixture-system',
              title: '系统信息',
              level: 2,
              line: 1,
              blocks: [
                {
                  type: 'table',
                  id: 'fixture-route',
                  headings: [],
                  line: 2,
                  headers: ['Name', 'Result'],
                  rows: [['missing-cell']],
                },
              ],
            },
          ],
        };
      },
      'header width',
    ],
    [
      articlePath,
      (data) => {
        data.showcase.route.tableId = 'missing-table';
      },
      'reference a table',
    ],
  ];

  const workerDirs = await Promise.all(
    Array.from({ length: defaultWorkerCount(rejectCases.length, 4) }, () =>
      cloneIsolatedWorkspace(workDir, 'lowendaff-markdown-neg-'),
    ),
  );
  tempDirs.push(...workerDirs);

  let nextIdx = 0;
  const rejectResults = new Array(rejectCases.length);
  await Promise.all(
    workerDirs.map(async (negDir) => {
      while (nextIdx < rejectCases.length) {
        const idx = nextIdx++;
        const [relPath, change, message] = rejectCases[idx];
        const targetFile = join(negDir, relPath);
        const origText = await readFile(targetFile, 'utf8');
        const parsed = unpack(origText);
        change(parsed.data);
        await writeFile(targetFile, pack(parsed));
        try {
          let failure;
          try {
            await execFileAsync(process.execPath, [astroBin, 'build'], {
              cwd: negDir,
              env: {
                ...process.env,
                ASTRO_TELEMETRY_DISABLED: '1',
                PUBLIC_SITE_INDEXABLE: 'false',
              },
              maxBuffer: 8 * 1024 * 1024,
            });
          } catch (error) {
            failure = String(error.stdout ?? '') + String(error.stderr ?? '');
          }
          assert(failure?.includes(message), `Expected rejection: ${message}`);
          rejectResults[idx] = { check: message, pass: true };
        } finally {
          await writeFile(targetFile, origText);
        }
      }
    }),
  );
  results.push(...rejectResults);

  await edit(
    articlePath,
    (data) => {
      data.title = 'MDX_PIPELINE_TITLE';
    },
    (b) => {
      assert(b.includes('888.77') && b.includes('151.11 ms'));
      return b
        .replace(
          'Synthetic fixture; never published.',
          '[Fixture video](https://www.bilibili.com/video/BV1P3411W7dj/)',
        )
        .replace('888.77', 'MDX_PIPELINE_BENCHMARK')
        .replace('151.11 ms', '987.65 ms');
    },
  );
  await edit('src/content/ads/home/dmit.md', (data) => {
    data.enabled = false;
  });
  await edit('src/content/ads/home/featured/dmit.md', (data) => {
    data.title = 'FEATURED_ONLY_TITLE';
  });
  await edit('src/content/ads/home/featured/gomami.md', (data) => {
    data.enabled = false;
  });
  await edit('src/content/advertising/policy.md', (data) => {
    data.placements[0].price = 321;
    data.contactLabel = '@markdown-test';
  });
  for (const directory of [
    'article-top',
    'article-bottom',
    'article-sidebar',
  ]) {
    await edit(`src/content/ads/${directory}/dmit.md`, (data) => {
      data.title = `INDEPENDENT_${directory}`;
      data.url = `https://example.com/${directory}`;
    });
  }
  // Removing one placement must not remove the merchant from other slots.
  const removed = 'src/content/ads/article-top/gomami.md';
  originals.set(removed, await read(removed));
  await rm(file(removed));
  const newAd = file('src/content/ads/home/markdown-fixture.md');
  await writeFile(
    newAd,
    pack({
      data: {
        name: 'MARKDOWN_NEW_AD',
        title: 'MARKDOWN_AD_TITLE',
        description: 'Fixture only',
        url: 'https://example.com/markdown-ad',
        tags: ['Markdown'],
        theme: 'teal',
        enabled: true,
        order: 0,
        source: 'Verification fixture',
      },
    }),
    { flag: 'wx' },
  );
  created.push(newAd);
  build();
  const home = await read('dist/index.html'),
    article = await read(
      'dist/reviews/markdown-verification-20261108/index.html',
    ),
    kit = await read('dist/components/index.html'),
    policy = await read('dist/ads/index.html');
  for (const html of [home, article])
    assert(html.includes('MDX_PIPELINE_TITLE'));
  assert(article.includes('MDX_PIPELINE_BENCHMARK'));
  const descendants = (node) => [
    node,
    ...(node.childNodes ?? []).flatMap(descendants),
  ];
  const attr = (node, name) =>
    node.attrs?.find((item) => item.name === name)?.value;
  const players = descendants(parseHtml(article)).filter(
    (node) =>
      node.tagName === 'iframe' && attr(node, 'title') === 'Fixture video',
  );
  assert.equal(players.length, 1);
  assert.equal(
    new URL(attr(players[0], 'src')).searchParams.get('autoplay'),
    '0',
  );
  for (let node = players[0]; node; node = node.parentNode) {
    assert(
      !['details', 'a'].includes(node.tagName) &&
        attr(node, 'hidden') === undefined,
    );
  }
  for (const html of [article, kit]) assert(html.includes('987.65 ms'));
  assert(
    home.includes('MARKDOWN_NEW_AD') && !article.includes('MARKDOWN_NEW_AD'),
  );
  assert(
    !home.includes('data-feed-brand="DMIT"') &&
      home.includes('data-product-brand="DMIT"') &&
      article.includes('data-ad-brand="DMIT"'),
  );
  assert(home.includes('data-feed-brand="GoMami"'));
  assert(!home.includes('data-product-brand="GoMami"'));
  assert(home.includes('data-feed-brand="MARKDOWN_NEW_AD"'));
  assert(!home.includes('data-product-brand="MARKDOWN_NEW_AD"'));
  const carousel = home.match(
    /<article[^>]*data-feed-carousel[^>]*>[\s\S]*?<\/article>/,
  )?.[0];
  assert(carousel?.includes('MARKDOWN_AD_TITLE'));
  assert(!carousel.includes('FEATURED_ONLY_TITLE'));
  assert(home.includes('FEATURED_ONLY_TITLE'));
  const slot = (html, name) =>
    html.match(
      new RegExp(`<aside[^>]*data-ad-slot="${name}"[^>]*>[\\s\\S]*?</aside>`),
    )?.[0] ?? '';
  const placements = [
    ['article-top', 'article-top'],
    ['article-bottom', 'article-bottom'],
    ['article-sidebar', 'sidebar'],
  ];
  for (const [directory, name] of placements) {
    const html = slot(article, name);
    assert(html.includes(`INDEPENDENT_${directory}`));
    assert(html.includes(`https://example.com/${directory}`));
    for (const [other] of placements)
      if (other !== directory) assert(!html.includes(`INDEPENDENT_${other}`));
    assert(!home.includes(`INDEPENDENT_${directory}`));
  }
  assert(!slot(article, 'article-top').includes('data-ad-brand="GoMami"'));
  assert(slot(article, 'article-bottom').includes('data-ad-brand="GoMami"'));
  assert(slot(article, 'sidebar').includes('data-ad-brand="GoMami"'));
  assert(article.includes('MARKDOWN_NEW_SPONSOR 赞助商网站'));
  assert(policy.includes('321') && policy.includes('@markdown-test'));
  assert(!(await read('dist/rss.xml')).includes('markdown-reference'));
  await assert.rejects(read('dist/reviews/markdown-reference/index.html'), {
    code: 'ENOENT',
  });
  await scenario('custom');
  results.push({
    check:
      'MDX title/benchmark/route, independent ad add/disable/delete/copy/link per placement, sponsor add/disable, advertising policy, reference exclusion',
    pass: true,
  });
  for (const path of created.splice(0)) await rm(path);
  await restore();

  await edit(sponsorPath, (data) => {
    data.enabled = false;
  });
  for (const directory of ['home', 'home/featured'])
    for (const name of await readdir(file(`src/content/ads/${directory}/`)))
      if (name.endsWith('.md'))
        await edit(`src/content/ads/${directory}/${name}`, (data) => {
          data.enabled = name === 'dmit.md';
        });
  build();
  assert.equal(
    ((await read('dist/index.html')).match(/data-product-brand=/g) || [])
      .length,
    1,
  );
  assert(
    !(
      await read('dist/reviews/markdown-verification-20261108/index.html')
    ).includes('MARKDOWN_NEW_SPONSOR 赞助商网站'),
  );
  await scenario('one');
  assert(
    !(
      await read('dist/reviews/markdown-verification-20261108/index.html')
    ).includes('data-bili-video'),
  );
  await edit('src/content/ads/home/dmit.md', (data) => {
    data.enabled = false;
  });
  for (const directory of [
    'home/featured',
    'article-top',
    'article-bottom',
    'article-sidebar',
  ])
    for (const name of await readdir(file(`src/content/ads/${directory}/`)))
      if (name.endsWith('.md'))
        await edit(`src/content/ads/${directory}/${name}`, (data) => {
          data.enabled = false;
        });
  for (const name of await readdir(file('src/content/sponsors/')))
    if (name.endsWith('.md'))
      await edit(`src/content/sponsors/${name}`, (data) => {
        data.enabled = false;
      });
  build();
  assert(!(await read('dist/index.html')).includes('class="sponsor-products"'));
  assert(
    !/<article\b[^>]*\bdata-feed-carousel\b/.test(
      await read('dist/index.html'),
    ),
  );
  const emptyArticle = await read(
    'dist/reviews/markdown-verification-20261108/index.html',
  );
  assert(
    !emptyArticle.includes('data-ad-slot=') &&
      !emptyArticle.includes('class="sponsor-wall"'),
  );
  await scenario('zero');
  results.push({
    check: 'one-ad and zero-ad builds, zero-sponsor empty state',
    pass: true,
  });

  await cp(file('dist/_astro'), '/tmp/lowendaff-content-scenarios/_astro', {
    recursive: true,
  });
  await cp(file('public/brand'), '/tmp/lowendaff-content-scenarios/brand', {
    recursive: true,
  });
  const evidence = process.argv[2] ?? 'test-results/markdown';
  const evidenceDir = join(repoRoot, evidence);
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(
    join(evidenceDir, 'markdown-contracts.json'),
    JSON.stringify(results, null, 2) + '\n',
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
  );
}
