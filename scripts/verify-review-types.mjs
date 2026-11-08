import assert from 'node:assert/strict';
import { cp, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const created = [];
const file = (path) => new URL(path, root);
const read = (path) => readFile(file(path), 'utf8');
const build = () =>
  execFileSync('npm', ['run', 'build'], {
    cwd: root,
    env: { ...process.env, PUBLIC_SITE_INDEXABLE: 'false' },
    stdio: 'pipe',
    maxBuffer: 8 * 1024 * 1024,
  });
async function add(id, type, vendor, country, draft = false) {
  const path = file(`src/content/posts/type-verification-${id}.mdx`);
  const body = `---
title: '类型验证 ${id}'
description: '自动验证夹具，不是真实测评。'
${type ? `reviewType: ${type}` : ''}
vendor: '${vendor}'
country: '${country}'
location: '验证机房'
publishedAt: '2026-11-08'
route: '未分类'
draft: ${draft}
---

临时合成内容，仅用于界面回归验证。
`;
  await writeFile(path, body, { flag: 'wx' });
  created.push(path);
}
try {
  for (let i = 1; i <= 22; i++)
    await add(`vps-${i}`, i === 1 ? '' : 'vps', 'Fixture Alpha', 'US');
  await add('dedicated-1', 'dedicated', 'Fixture Alpha', 'US');
  await add('dedicated-2', 'dedicated', 'Fixture Beta', 'JP');
  await add('dedicated-3', 'dedicated', 'Fixture Beta', 'US');
  await add('draft', 'dedicated', 'Fixture Hidden', 'DE', true);
  build();
  for (const path of ['index.html', 'tags/index.html']) {
    const html = await read(`dist/${path}`);
    assert.equal(
      (html.match(/data-id="type-verification-[^"]+"\s+data-type="vps"/g) || [])
        .length,
      22,
    );
    assert.equal(
      (
        html.match(
          /data-id="type-verification-[^"]+"\s+data-type="dedicated"/g,
        ) || []
      ).length,
      3,
    );
    assert.equal((html.match(/data-type-filter/g) || []).length, 1);
    assert(!html.includes('Fixture Hidden'));
    assert(!html.includes('type-verification-draft'));
  }
  for (const type of ['vps', 'dedicated']) {
    const html = await read(
      `dist/reviews/type-verification-${type}-1/index.html`,
    );
    assert(html.includes(`data-review-kind="${type}"`));
    assert(html.includes(`href="/?type=${type}#reviews"`));
  }
  await assert.rejects(read('dist/reviews/type-verification-draft/index.html'));
  const output = file('test-results/review-types/site/');
  await mkdir(output, { recursive: true });
  await cp(file('dist/'), output, { recursive: true });
  const home = await read('dist/index.html');
  const counts = Object.fromEntries(
    ['vps', 'dedicated'].map((type) => [
      type,
      (home.match(new RegExp(`data-type="${type}"`, 'g')) || []).length,
    ]),
  );
  await writeFile(
    new URL('review-type-fixture.json', output),
    JSON.stringify(counts),
  );
  await add('invalid', 'physical', 'Fixture Invalid', 'US');
  assert.throws(build, (error) =>
    (String(error.stdout) + String(error.stderr)).includes('reviewType'),
  );
  console.log(
    'PASS: shared type schema, legacy default, list/header labels, draft exclusion and invalid type rejection. Browser fixture site: test-results/review-types/site/',
  );
} finally {
  for (const path of created) await unlink(path);
  build();
}
