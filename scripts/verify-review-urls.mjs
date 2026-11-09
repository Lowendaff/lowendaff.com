import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  normalizeReviewTitle,
  generateReviewPermalink,
  isReviewPermalink,
  assertUniqueReviewUrls,
} from '../src/lib/review-url.ts';
import { parsePost, insertPermalink } from './review-url-files.mjs';

const title = '🇺🇸 100TB 美国洛杉矶 CN2 VPS 测试记录';
const address = '/reviews/100tb-美国洛杉矶-cn2-vps-测试记录-20261110/';
const source = (extra = '') =>
  `---\n# Keep this comment\ntitle: '${title}'\ntestedAt: '2026-11-10 23:43 CST'\npublishedAt: '2026-11-11'\n${extra}---\n\n## 路由追踪\n\nBody must remain byte-for-byte unchanged.\n`;
const script = (name) => fileURLToPath(new URL(name, import.meta.url));
function run(name, cwd, args = [], env = {}) {
  return execFileSync(
    process.execPath,
    ['--experimental-strip-types', script(name), ...args],
    {
      cwd,
      encoding: 'utf8',
      stdio: 'pipe',
      env: { ...process.env, CI: '', URL_BASE_REF: 'HEAD', ...env },
    },
  );
}
function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' });
}
function commit(cwd) {
  git(cwd, 'add', '.');
  git(
    cwd,
    '-c',
    'user.name=URL fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '-qm',
    'Fixture baseline',
  );
}
async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'lowendaff-url-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, 'src/content/posts'), { recursive: true });
  git(directory, 'init', '-q');
  await writeFile(
    path.join(directory, 'README.md'),
    'Temporary URL test repository',
  );
  commit(directory);
  const file = 'src/content/posts/sample.mdx';
  return {
    directory,
    file,
    write: (content) => writeFile(path.join(directory, file), content),
    read: () => readFile(path.join(directory, file), 'utf8'),
  };
}
function fails(fn, pattern) {
  assert.throws(fn, (error) => {
    assert.match(String(error.stdout) + String(error.stderr), pattern);
    return true;
  });
}

test('Chinese title, flags, case, spaces, punctuation and keycap emoji normalize deterministically', () => {
  assert.equal(generateReviewPermalink(title, '2026-11-10 23:43 CST'), address);
  assert.equal(
    normalizeReviewTitle(' 🇺🇸 ＣＮ２ / 香港？？ VPS  '),
    'cn2-香港-vps',
  );
  assert.equal(normalizeReviewTitle('1️⃣ VPS 👨‍👩‍👧‍👦 测试'), 'vps-测试');
  assert.equal(
    generateReviewPermalink(title, '2026-11-11'),
    address.replace('20261110', '20261111'),
  );
  assert.throws(() => generateReviewPermalink('🇺🇸?!', '2026-11-10'));
});

test('test date is explicit, calendar-valid and never inferred from publication date', () => {
  for (const value of [
    undefined,
    'yesterday',
    '2026-02-29',
    '2026-13-01',
    '2026-11-31',
    '0000-01-01',
    '2026-11-10junk',
  ])
    assert.throws(() => generateReviewPermalink(title, value), /testedAt/);
  assert.ok(isReviewPermalink('/reviews/vps-20240229/'));
  for (const value of [
    address.slice(0, -1),
    address.toUpperCase(),
    encodeURI(address),
    address + '?x=1',
    address + '#x',
    '/reviews/../vps-20261110/',
    '/reviews/vps-20260229/',
    '/reviews/vps--20261110/',
    'https://evil.example' + address,
  ])
    assert.equal(isReviewPermalink(value), false, value);
});

test('canonical and redirect addresses share one namespace, including drafts', () => {
  const entry = { id: 'a', data: { permalink: address } };
  assert.throws(
    () =>
      assertUniqueReviewUrls([
        entry,
        { id: 'b', data: { permalink: address, draft: true } },
      ]),
    /Duplicate/,
  );
  assert.throws(
    () =>
      assertUniqueReviewUrls([
        entry,
        {
          id: 'b',
          data: {
            permalink: '/reviews/other-20261110/',
            redirectFrom: [address],
          },
        },
      ]),
    /Duplicate/,
  );
  assert.throws(
    () =>
      assertUniqueReviewUrls([
        { id: 'a', data: { permalink: address, redirectFrom: [address] } },
      ]),
    /Duplicate/,
  );
  assert.throws(
    () =>
      assertUniqueReviewUrls([
        {
          id: 'a',
          data: { permalink: address, redirectFrom: ['/reviews/%2e%2e/'] },
        },
      ]),
    /invalid redirect/,
  );
});

test('fill supports dry-run, targeted files, preserves all existing bytes and is idempotent', async (t) => {
  const f = await fixture(t);
  await f.write(source());
  assert.match(
    run('fill-review-urls.mjs', f.directory, ['--dry-run', f.file]),
    /Would fill/,
  );
  assert.equal(await f.read(), source());
  run('fill-review-urls.mjs', f.directory, [f.file]);
  const once = await f.read();
  assert.equal(once, insertPermalink(source(), address));
  assert.equal(parsePost(once, f.file).data.permalink, address);
  run('check-review-urls.mjs', f.directory);
  run('fill-review-urls.mjs', f.directory);
  assert.equal(await f.read(), once);
  fails(
    () => run('fill-review-urls.mjs', f.directory, ['not-an-article']),
    /Not a review source/,
  );
});

test('duplicate plans fail before any file changes, never append a random suffix', async (t) => {
  const f = await fixture(t);
  await f.write(source());
  const other = path.join(f.directory, 'src/content/posts/other.mdx');
  await writeFile(other, source('draft: true\n'));
  fails(() => run('fill-review-urls.mjs', f.directory), /Duplicate/);
  assert.equal(await f.read(), source());
  assert.equal(await readFile(other, 'utf8'), source('draft: true\n'));
});

test('CI rejects missing URLs, mismatched initial titles, invalid dates and missing comparison base', async (t) => {
  const f = await fixture(t);
  await f.write(source('draft: true\n'));
  fails(
    () => run('check-review-urls.mjs', f.directory),
    /missing or invalid permalink/,
  );
  await f.write(insertPermalink(source(), '/reviews/wrong-title-20261110/'));
  fails(() => run('check-review-urls.mjs', f.directory), /initial permalink/);
  await f.write(
    insertPermalink(
      source().replace('2026-11-10 23:43 CST', '2026-02-29'),
      address,
    ),
  );
  fails(() => run('check-review-urls.mjs', f.directory), /testedAt/);
  fails(
    () =>
      run('check-review-urls.mjs', f.directory, [], {
        CI: 'true',
        URL_BASE_REF: '',
        GITHUB_EVENT_NAME: 'push',
      }),
    /URL_BASE_REF is required/,
  );
});

test('published URLs survive title/date changes and file renames, while URL rewrites fail', async (t) => {
  const f = await fixture(t);
  await f.write(insertPermalink(source(), address));
  commit(f.directory);
  const edited = insertPermalink(
    source()
      .replace(title, '修正后的标题')
      .replace('2026-11-10 23:43 CST', '2026-11-09'),
    address,
  );
  await f.write(edited);
  run('fill-review-urls.mjs', f.directory);
  assert.equal(await f.read(), edited);
  run('check-review-urls.mjs', f.directory);
  await f.write(edited.replace(address, '/reviews/other-20261110/'));
  fails(() => run('check-review-urls.mjs', f.directory), /immutable/);
  await f.write(edited);
  git(f.directory, 'mv', f.file, 'src/content/posts/renamed.mdx');
  run('check-review-urls.mjs', f.directory);
});

test('first migration reserves the former URL and later changes cannot remove it', async (t) => {
  const f = await fixture(t);
  await f.write(source());
  commit(f.directory);
  run('fill-review-urls.mjs', f.directory);
  fails(
    () => run('check-review-urls.mjs', f.directory),
    /first migration must preserve/,
  );
  await f.write(
    insertPermalink(source("redirectFrom: ['/reviews/sample/']\n"), address),
  );
  run('check-review-urls.mjs', f.directory);
  commit(f.directory);
  await f.write(insertPermalink(source(), address));
  fails(
    () => run('check-review-urls.mjs', f.directory),
    /cannot remove published redirect/,
  );
});

test('invalid YAML and duplicate keys are rejected instead of rewritten', async (t) => {
  const f = await fixture(t);
  const invalid = source('title: Duplicate\n');
  await f.write(invalid);
  fails(() => run('fill-review-urls.mjs', f.directory), /unique|duplicate/i);
  assert.equal(await f.read(), invalid);
});
