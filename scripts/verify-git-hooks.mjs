import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { availableParallelism, tmpdir } from 'node:os';
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

function runAsync(cwd, command, args) {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      { cwd, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
      (error, stdout = '', stderr = '') => {
        resolve({
          status: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
          stdout: String(stdout),
          stderr: String(stderr),
        });
      },
    );
  });
}

function makeHarness(cwd, baselineSha) {
  const run = (command, args) => runAsync(cwd, command, args);
  const git = async (...args) => {
    const result = await run('git', args);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return result.stdout.trim();
  };
  const put = async (path, body) => {
    await mkdir(dirname(join(cwd, path)), { recursive: true });
    await writeFile(join(cwd, path), body);
  };
  const install = () =>
    run(process.execPath, ['scripts/install-git-hooks.mjs']);
  const commit = (...args) =>
    run('git', ['commit', '-m', 'Test hook', ...args]);
  const output = (result) => result.stdout + result.stderr;
  const reset = async () => {
    await git('reset', '--hard', baselineSha);
    await git('clean', '-fd', '--', 'src/content/posts');
  };
  const rejected = async (body, expected, workingBody = body) => {
    await reset();
    await put(article, body);
    await git('add', article);
    await put(article, workingBody);
    const before = await git('write-tree');
    const result = await commit();
    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), expected);
    assert.equal(await git('rev-parse', 'HEAD'), baselineSha);
    assert.equal(await git('write-tree'), before);
    assert.equal(await readFile(join(cwd, article), 'utf8'), workingBody);
  };
  return { cwd, run, git, put, install, commit, output, reset, rejected };
}

async function cloneHookRepo(baseRoot) {
  const workerRoot = await mkdtemp(join(tmpdir(), 'lowendaff-hook-worker-'));
  for (const entry of await readdir(baseRoot)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.astro') {
      continue;
    }
    await cp(join(baseRoot, entry), join(workerRoot, entry), {
      recursive: true,
    });
  }
  await symlink(
    join(source, 'node_modules'),
    join(workerRoot, 'node_modules'),
    'dir',
  );
  return workerRoot;
}

await test('native pre-commit validates the actual index in an isolated build', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'lowendaff-hook-test-'));
  const tempDirs = [root];
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
    const deleted = new Set(
      execFileSync('git', ['ls-files', '--deleted', '-z'], {
        cwd: source,
        encoding: 'utf8',
      })
        .split('\0')
        .filter(Boolean),
    );
    for (const path of files) {
      if (
        (path.startsWith('src/content/posts/') &&
          path !== 'src/content/posts/.gitkeep') ||
        path.startsWith('public/archive-assets/') ||
        path.startsWith('test-results/') ||
        deleted.has(path)
      ) {
        continue;
      }
      await mkdir(dirname(join(root, path)), { recursive: true });
      await cp(join(source, path), join(root, path));
    }
    await symlink(
      join(source, 'node_modules'),
      join(root, 'node_modules'),
      'dir',
    );

    const initH = makeHarness(root, null);
    await initH.git('init', '-q');
    await initH.put('.git/info/exclude', 'node_modules\n');
    await initH.git('config', 'user.name', 'Hook Test');
    await initH.git('config', 'user.email', 'hook-test@example.invalid');
    await initH.git('config', 'commit.gpgsign', 'false');

    await t.test(
      'installer preserves existing hook configuration and is idempotent',
      async () => {
        await initH.git(
          'config',
          '--local',
          'core.hooksPath',
          'existing-hooks',
        );
        assert.notEqual((await initH.install()).status, 0);
        assert.equal(
          await initH.git('config', '--get', 'core.hooksPath'),
          'existing-hooks',
        );
        await initH.git('config', '--unset', 'core.hooksPath');
        await initH.put('.git/hooks/pre-commit', '# existing hook\n');
        assert.notEqual((await initH.install()).status, 0);
        await rm(join(root, '.git/hooks/pre-commit'));
        assert.equal((await initH.install()).status, 0);
        assert.equal((await initH.install()).status, 0);
        assert.equal(
          await initH.git('config', '--get', 'core.hooksPath'),
          '.githooks',
        );
      },
    );
    await t.test(
      'valid initial commit builds without HEAD and preserves local caches',
      async () => {
        await initH.put(article, valid);
        await initH.put('.astro/sentinel', 'preview cache');
        await initH.put('dist/sentinel', 'preview output');
        await initH.git('add', '.');
        const result = await initH.commit();
        assert.equal(result.status, 0, initH.output(result));
        assert.match(initH.output(result), /暂存文章校验通过/);
        assert.equal(
          await readFile(join(root, '.astro/sentinel'), 'utf8'),
          'preview cache',
        );
        assert.equal(
          await readFile(join(root, 'dist/sentinel'), 'utf8'),
          'preview output',
        );
        baseline = await initH.git('rev-parse', 'HEAD');
      },
    );
    assert.ok(
      baseline,
      'The initial commit must pass before remaining scenarios',
    );

    const scenarios = [
      [
        'staged invalid type is rejected even when the worktree fixes it',
        (h) =>
          h.rejected(
            valid.replace('reviewType: vps', 'reviewType: physical'),
            /reviewType/,
            valid,
          ),
      ],
      [
        'staged valid content passes despite invalid unstaged content',
        async (h) => {
          await h.reset();
          const good = valid.replace(
            'Hook integration fixture.',
            'Updated fixture.',
          );
          const bad = good.replace('reviewType: vps', 'reviewType: physical');
          await h.put(article, good);
          await h.git('add', article);
          await h.put(article, bad);
          const result = await h.commit();
          assert.equal(result.status, 0, h.output(result));
          assert.equal(await h.git('show', `HEAD:${article}`), good.trimEnd());
          assert.equal(await readFile(join(h.cwd, article), 'utf8'), bad);
        },
      ],
      [
        'missing coordinates block both published and draft commits',
        async (h) => {
          for (const draft of [false, true]) {
            await h.rejected(
              valid
                .replace(/^geo:.*\n/m, '')
                .replace('draft: false', `draft: ${draft}`),
              /geo/,
            );
          }
        },
      ],
      [
        'invalid draft schema is rejected',
        (h) =>
          h.rejected(
            valid
              .replace('draft: false', 'draft: true')
              .replace(
                "publishedAt: '2026-11-09'",
                "publishedAt: '2026-13-40'",
              ),
            /publishedAt/,
          ),
      ],
      [
        'invalid readable Markdown section is rejected',
        (h) =>
          h.rejected(
            valid.replace('## 系统信息', '## Unsupported fixture section'),
            /Unsupported review section/,
          ),
      ],
      [
        'malformed native draft MDX is rejected',
        (h) =>
          h.rejected(
            valid
              .replace('format: review-markdown', 'format: mdx')
              .replace('draft: false', 'draft: true') + '\n<Unclosed\n',
            /Unexpected|Expected|MDX|SyntaxError/i,
          ),
      ],
      [
        'published URL cannot change',
        (h) =>
          h.rejected(
            valid.replace(
              '/reviews/hook-fixture-20261109/',
              '/reviews/changed-fixture-20261109/',
            ),
            /immutable/,
          ),
      ],
      [
        'new draft URL conflicts with an untouched published article',
        async (h) => {
          await h.reset();
          await h.put(
            'src/content/posts/duplicate.mdx',
            valid.replace('draft: false', 'draft: true'),
          );
          await h.git('add', 'src/content/posts/duplicate.mdx');
          const result = await h.commit();
          assert.notEqual(result.status, 0, h.output(result));
          assert.match(h.output(result), /duplicate|conflict|重复/i);
          assert.equal(await h.git('rev-parse', 'HEAD'), baseline);
        },
      ],
      [
        'rename detection uses the staged tree despite a different worktree',
        async (h) => {
          await h.reset();
          const renamed = 'src/content/posts/renamed.mdx';
          await h.git('mv', article, renamed);
          // The unstaged version must not hide the staged permalink change.
          const staged = valid.replace(
            '/reviews/hook-fixture-20261109/',
            '/reviews/changed-fixture-20261109/',
          );
          await h.put(renamed, staged);
          await h.git('add', renamed);
          await h.put(renamed, valid);
          const result = await h.commit();
          assert.notEqual(result.status, 0, h.output(result));
          assert.match(h.output(result), /immutable/);
        },
      ],
      [
        'git commit pathspec uses the alternate index',
        async (h) => {
          await h.reset();
          const good = valid.replace(
            'Hook integration fixture.',
            'Pathspec fixture.',
          );
          await h.put(
            article,
            valid.replace('reviewType: vps', 'reviewType: physical'),
          );
          await h.git('add', article);
          await h.put(article, good);
          const result = await h.commit('--only', '--', article);
          assert.equal(result.status, 0, h.output(result));
          assert.equal(await h.git('show', `HEAD:${article}`), good.trimEnd());
        },
      ],
      [
        'git commit -a rejects an unstaged invalid article',
        async (h) => {
          await h.reset();
          await h.put(
            article,
            valid.replace('reviewType: vps', 'reviewType: physical'),
          );
          const result = await h.commit('-a');
          assert.notEqual(result.status, 0, h.output(result));
          assert.match(h.output(result), /reviewType/);
          assert.equal(await h.git('rev-parse', 'HEAD'), baseline);
        },
      ],
      [
        'missing dependencies fail with a setup instruction',
        async (h) => {
          await h.reset();
          await h.put(
            article,
            valid.replace('Hook integration fixture.', 'Dependency fixture.'),
          );
          await h.git('add', article);
          await rm(join(h.cwd, 'node_modules'));
          try {
            const result = await h.commit();
            assert.notEqual(result.status, 0, h.output(result));
            assert.match(h.output(result), /npm ci/);
            assert.equal(await h.git('rev-parse', 'HEAD'), baseline);
          } finally {
            await symlink(
              join(source, 'node_modules'),
              join(h.cwd, 'node_modules'),
              'dir',
            );
          }
        },
      ],
      [
        'changed dependency versions require a matching installation',
        async (h) => {
          await h.reset();
          const lock = JSON.parse(
            await readFile(join(h.cwd, 'package-lock.json'), 'utf8'),
          );
          lock.packages['node_modules/astro'].version = '0.0.0';
          await h.put('package-lock.json', JSON.stringify(lock));
          await h.git('add', 'package-lock.json');
          const result = await h.commit();
          assert.notEqual(result.status, 0, h.output(result));
          assert.match(h.output(result), /已安装依赖与暂存锁文件不一致/);
          assert.equal(await h.git('rev-parse', 'HEAD'), baseline);
        },
      ],
      [
        'moving the last article outside the collection still validates',
        async (h) => {
          await h.reset();
          await h.git('mv', article, 'retired-hook-fixture.mdx');
          const result = await h.commit();
          assert.equal(result.status, 0, h.output(result));
          assert.match(h.output(result), /Validated 0 article URL/);
        },
      ],
      [
        'deleting the last article permits an empty collection',
        async (h) => {
          await h.reset();
          await h.git('rm', article);
          const result = await h.commit();
          assert.equal(result.status, 0, h.output(result));
          assert.match(h.output(result), /Validated 0 article URL/);
        },
      ],
      [
        'documentation-only commits skip the build',
        async (h) => {
          await h.reset();
          await h.put('hook-test-notes.md', 'Documentation only.\n');
          await h.git('add', 'hook-test-notes.md');
          const result = await h.commit();
          assert.equal(result.status, 0, h.output(result));
          assert.match(h.output(result), /跳过文章校验/);
          assert.doesNotMatch(h.output(result), /astro build/);
        },
      ],
    ];

    const workerCount = Math.max(
      1,
      Math.min(4, scenarios.length, availableParallelism()),
    );
    const workerDirs = await Promise.all(
      Array.from({ length: workerCount }, () => cloneHookRepo(root)),
    );
    tempDirs.push(...workerDirs);

    let nextIdx = 0;
    const outcomes = new Array(scenarios.length);
    await Promise.all(
      workerDirs.map(async (workerDir) => {
        const harness = makeHarness(workerDir, baseline);
        while (nextIdx < scenarios.length) {
          const idx = nextIdx++;
          const [name, fn] = scenarios[idx];
          try {
            await fn(harness);
            outcomes[idx] = { name, error: null };
          } catch (error) {
            outcomes[idx] = { name, error };
          }
        }
      }),
    );

    for (const { name, error } of outcomes) {
      await t.test(name, () => {
        if (error) throw error;
      });
    }
  } finally {
    await Promise.all(
      tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
    );
  }
});
