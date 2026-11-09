import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { format } from 'prettier';

const source = fileURLToPath(new URL('../', import.meta.url));
const article = 'src/content/posts/hook-fixture.mdx';
const valid = await format(
  `---
kind: review
format: review-markdown
reviewType: vps
permalink: '/reviews/hook-fixture-20261109/'
title: Hook fixture
description: Hook integration fixture.
vendor: Fixture
country: US
location: Test location
geo: { city: Fixture, latitude: 34.05, longitude: -118.24 }
route: Test route
publishedAt: '2026-11-09'
testedAt: '2026-11-09'
affiliate: false
draft: false
---

## 系统信息

| 项目 | 结果 |
| --- | --- |
| CPU | Fixture |
`,
  { parser: 'mdx', singleQuote: true },
);
const env = { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' };
// A test invoked from another hook must not inherit its index or Git directory.
for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key];

await test('native pre-commit validates the actual index in an isolated build', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'lowendaff-hook-test-'));
  const run = (command, args, extra = {}) =>
    spawnSync(command, args, {
      cwd: root,
      env,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      ...extra,
    });
  const git = (...args) => {
    const result = run('git', args);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return result.stdout.trim();
  };
  const put = async (path, body) => {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), body);
  };
  const install = () =>
    run(process.execPath, ['scripts/install-git-hooks.mjs']);
  const commit = (...args) =>
    run('git', ['commit', '-m', 'Test hook', ...args]);
  const output = (result) => result.stdout + result.stderr;
  let baseline;
  try {
    const files = new Set(
      execFileSync(
        'git',
        ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
        { cwd: source, encoding: 'utf8' },
      )
        .split('\0')
        .filter(Boolean),
    );
    for (const path of [
      '.githooks/pre-commit',
      'scripts/install-git-hooks.mjs',
      'scripts/check-staged-content.mjs',
    ])
      files.add(path);
    for (const path of files) {
      if (path.startsWith('src/content/posts/')) continue;
      await mkdir(dirname(join(root, path)), { recursive: true });
      await cp(join(source, path), join(root, path));
    }
    await symlink(
      join(source, 'node_modules'),
      join(root, 'node_modules'),
      'dir',
    );
    git('init', '-q');
    await put('.git/info/exclude', 'node_modules\n');
    git('config', 'user.name', 'Hook Test');
    git('config', 'user.email', 'hook-test@example.invalid');
    git('config', 'commit.gpgsign', 'false');

    await t.test(
      'installer preserves existing hook configuration and is idempotent',
      async () => {
        git('config', '--local', 'core.hooksPath', 'existing-hooks');
        assert.notEqual(install().status, 0);
        assert.equal(
          git('config', '--get', 'core.hooksPath'),
          'existing-hooks',
        );
        git('config', '--unset', 'core.hooksPath');
        await put('.git/hooks/pre-commit', '# existing hook\n');
        assert.notEqual(install().status, 0);
        await rm(join(root, '.git/hooks/pre-commit'));
        assert.equal(install().status, 0);
        assert.equal(install().status, 0);
        assert.equal(git('config', '--get', 'core.hooksPath'), '.githooks');
      },
    );
    await t.test(
      'valid initial commit builds without HEAD and preserves local caches',
      async () => {
        await put(article, valid);
        await put('.astro/sentinel', 'preview cache');
        await put('dist/sentinel', 'preview output');
        git('add', '.');
        const result = commit();
        assert.equal(result.status, 0, output(result));
        assert.match(output(result), /暂存文章校验通过/);
        assert.equal(
          await readFile(join(root, '.astro/sentinel'), 'utf8'),
          'preview cache',
        );
        assert.equal(
          await readFile(join(root, 'dist/sentinel'), 'utf8'),
          'preview output',
        );
        baseline = git('rev-parse', 'HEAD');
      },
    );
    assert.ok(
      baseline,
      'The initial commit must pass before remaining scenarios',
    );
    const reset = async () => {
      git('reset', '--hard', baseline);
      git('clean', '-fd', '--', 'src/content/posts');
    };
    const rejected = async (body, expected, workingBody = body) => {
      await reset();
      await put(article, body);
      git('add', article);
      await put(article, workingBody);
      const before = git('write-tree');
      const result = commit();
      assert.notEqual(result.status, 0, output(result));
      assert.match(output(result), expected);
      assert.equal(git('rev-parse', 'HEAD'), baseline);
      assert.equal(git('write-tree'), before);
      assert.equal(await readFile(join(root, article), 'utf8'), workingBody);
    };
    await t.test(
      'staged invalid type is rejected even when the worktree fixes it',
      () =>
        rejected(
          valid.replace('reviewType: vps', 'reviewType: physical'),
          /reviewType/,
          valid,
        ),
    );
    await t.test(
      'staged valid content passes despite invalid unstaged content',
      async () => {
        await reset();
        const good = valid.replace(
          'Hook integration fixture.',
          'Updated fixture.',
        );
        const bad = good.replace('reviewType: vps', 'reviewType: physical');
        await put(article, good);
        git('add', article);
        await put(article, bad);
        const result = commit();
        assert.equal(result.status, 0, output(result));
        assert.equal(git('show', `HEAD:${article}`), good.trimEnd());
        assert.equal(await readFile(join(root, article), 'utf8'), bad);
      },
    );
    await t.test(
      'missing coordinates block both published and draft commits',
      async () => {
        for (const draft of [false, true]) {
          await rejected(
            valid
              .replace(/^geo:.*\n/m, '')
              .replace('draft: false', `draft: ${draft}`),
            /geo/,
          );
        }
      },
    );
    await t.test('invalid draft schema is rejected', () =>
      rejected(
        valid
          .replace('draft: false', 'draft: true')
          .replace("publishedAt: '2026-11-09'", "publishedAt: '2026-13-40'"),
        /publishedAt/,
      ),
    );
    await t.test('invalid readable Markdown section is rejected', () =>
      rejected(
        valid.replace('## 系统信息', '## Unsupported fixture section'),
        /Unsupported review section/,
      ),
    );
    await t.test('malformed native draft MDX is rejected', () =>
      rejected(
        valid
          .replace('format: review-markdown', 'format: mdx')
          .replace('draft: false', 'draft: true') + '\n<Unclosed\n',
        /Unexpected|Expected|MDX|SyntaxError/i,
      ),
    );
    await t.test('published URL cannot change', () =>
      rejected(
        valid.replace(
          '/reviews/hook-fixture-20261109/',
          '/reviews/changed-fixture-20261109/',
        ),
        /immutable/,
      ),
    );
    await t.test(
      'new draft URL conflicts with an untouched published article',
      async () => {
        await reset();
        await put(
          'src/content/posts/duplicate.mdx',
          valid.replace('draft: false', 'draft: true'),
        );
        git('add', 'src/content/posts/duplicate.mdx');
        const result = commit();
        assert.notEqual(result.status, 0, output(result));
        assert.match(output(result), /duplicate|conflict|重复/i);
        assert.equal(git('rev-parse', 'HEAD'), baseline);
      },
    );
    await t.test(
      'rename detection uses the staged tree despite a different worktree',
      async () => {
        await reset();
        const renamed = 'src/content/posts/renamed.mdx';
        git('mv', article, renamed);
        // The unstaged version must not hide the staged permalink change.
        const staged = valid.replace(
          '/reviews/hook-fixture-20261109/',
          '/reviews/changed-fixture-20261109/',
        );
        await put(renamed, staged);
        git('add', renamed);
        await put(renamed, valid);
        const result = commit();
        assert.notEqual(result.status, 0, output(result));
        assert.match(output(result), /immutable/);
      },
    );
    await t.test('git commit pathspec uses the alternate index', async () => {
      await reset();
      const good = valid.replace(
        'Hook integration fixture.',
        'Pathspec fixture.',
      );
      await put(
        article,
        valid.replace('reviewType: vps', 'reviewType: physical'),
      );
      git('add', article);
      await put(article, good);
      const result = commit('--only', '--', article);
      assert.equal(result.status, 0, output(result));
      assert.equal(git('show', `HEAD:${article}`), good.trimEnd());
    });
    await t.test(
      'git commit -a rejects an unstaged invalid article',
      async () => {
        await reset();
        await put(
          article,
          valid.replace('reviewType: vps', 'reviewType: physical'),
        );
        const result = commit('-a');
        assert.notEqual(result.status, 0, output(result));
        assert.match(output(result), /reviewType/);
        assert.equal(git('rev-parse', 'HEAD'), baseline);
      },
    );
    await t.test(
      'missing dependencies fail with a setup instruction',
      async () => {
        await reset();
        await put(
          article,
          valid.replace('Hook integration fixture.', 'Dependency fixture.'),
        );
        git('add', article);
        await rm(join(root, 'node_modules'));
        try {
          const result = commit();
          assert.notEqual(result.status, 0, output(result));
          assert.match(output(result), /npm ci/);
          assert.equal(git('rev-parse', 'HEAD'), baseline);
        } finally {
          await symlink(
            join(source, 'node_modules'),
            join(root, 'node_modules'),
            'dir',
          );
        }
      },
    );
    await t.test(
      'changed dependency versions require a matching installation',
      async () => {
        await reset();
        const lock = JSON.parse(
          await readFile(join(root, 'package-lock.json'), 'utf8'),
        );
        lock.packages['node_modules/astro'].version = '0.0.0';
        await put('package-lock.json', JSON.stringify(lock));
        git('add', 'package-lock.json');
        const result = commit();
        assert.notEqual(result.status, 0, output(result));
        assert.match(output(result), /已安装依赖与暂存锁文件不一致/);
        assert.equal(git('rev-parse', 'HEAD'), baseline);
      },
    );
    await t.test(
      'moving the last article outside the collection still validates',
      async () => {
        await reset();
        git('mv', article, 'retired-hook-fixture.mdx');
        const result = commit();
        assert.equal(result.status, 0, output(result));
        assert.match(output(result), /Validated 0 article URL/);
      },
    );
    await t.test(
      'deleting the last article permits an empty collection',
      async () => {
        await reset();
        git('rm', article);
        const result = commit();
        assert.equal(result.status, 0, output(result));
        assert.match(output(result), /Validated 0 article URL/);
      },
    );
    await t.test('documentation-only commits skip the build', async () => {
      await reset();
      await put('hook-test-notes.md', 'Documentation only.\n');
      git('add', 'hook-test-notes.md');
      const result = commit();
      assert.equal(result.status, 0, output(result));
      assert.match(output(result), /跳过文章校验/);
      assert.doesNotMatch(output(result), /astro build/);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
