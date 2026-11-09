import { execFileSync } from 'node:child_process';
import {
  mkdtemp,
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  symlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const relevant = (file) =>
  /^(src\/|public\/|scripts\/|\.githooks\/|package(?:-lock)?\.json$|astro\.config\.|tsconfig|\.prettier|\.npmrc$|\.github\/workflows\/content-validation\.yml$)/.test(
    file,
  );
let temporary;
try {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 12))
    throw new Error('需要 Node.js >=22.12；请升级后运行 npm ci。');
  const root = git('rev-parse', '--show-toplevel').trim();
  process.chdir(root);
  let base = '0';
  try {
    base = git('rev-parse', '--verify', '--quiet', 'HEAD').trim();
  } catch (error) {
    if (error.status !== 1) throw error;
  }
  const changed = git(
    'diff',
    '--cached',
    '--no-renames',
    '--name-only',
    '-z',
  ).split('\0');
  if (!changed.some(relevant)) {
    console.log('[pre-commit] 本次没有内容或构建相关变更，跳过文章校验。');
    process.exit(0);
  }
  // Freeze the actual index, including Git's alternate index for commit -a / paths.
  // Never stash, reset, add or edit the author's index/worktree.
  temporary = await mkdtemp(join(tmpdir(), 'lowendaff-pre-commit-'));
  const snapshot = join(temporary, 'snapshot');
  await mkdir(snapshot);
  const gitEnv = {
    ...process.env,
    GIT_DIR: git('rev-parse', '--absolute-git-dir').trim(),
    GIT_WORK_TREE: root,
    GIT_INDEX_FILE: join(temporary, 'index'),
  };
  const exportGit = (args) =>
    execFileSync('git', args, { cwd: root, env: gitEnv, stdio: 'pipe' });
  // write-tree can update cache-tree metadata, so use a private copy of the index.
  await copyFile(
    resolve(root, git('rev-parse', '--git-path', 'index').trim()),
    gitEnv.GIT_INDEX_FILE,
  );
  const tree = exportGit(['write-tree']).toString().trim();
  exportGit(['checkout-index', '--all', `--prefix=${snapshot}/`]);

  // Reuse installed packages, but keep .astro / .vite / .vite-temp caches local.
  // Linking the whole node_modules directory would corrupt preview caches.
  const lock = JSON.parse(await readFile(join(snapshot, 'package-lock.json')));
  const manifest = JSON.parse(await readFile(join(snapshot, 'package.json')));
  const installed = JSON.parse(
    await readFile(join(root, 'node_modules/.package-lock.json')).catch(() => {
      throw new Error('缺少 npm 安装记录，请运行 npm ci 后重试。');
    }),
  );
  for (const section of [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
  ]) {
    if (
      !isDeepStrictEqual(
        manifest[section] ?? {},
        lock.packages[''][section] ?? {},
      )
    )
      throw new Error('暂存的 package.json 与 package-lock.json 不一致。');
    for (const name of Object.keys(manifest[section] ?? {})) {
      if (
        section !== 'optionalDependencies' &&
        !installed.packages[`node_modules/${name}`]
      )
        throw new Error(`缺少依赖 ${name}，请运行 npm ci。`);
    }
  }
  for (const [name, pkg] of Object.entries(installed.packages)) {
    const expected = lock.packages[name];
    if (
      !expected ||
      ['version', 'resolved', 'integrity'].some(
        (key) => pkg[key] !== expected[key],
      )
    )
      throw new Error(`已安装依赖与暂存锁文件不一致：${name}。请运行 npm ci。`);
  }
  await mkdir(join(snapshot, 'node_modules'));
  for (const name of await readdir(join(root, 'node_modules'))) {
    if (name.startsWith('.') && name !== '.bin') continue;
    await symlink(
      resolve(root, 'node_modules', name),
      join(snapshot, 'node_modules', name),
      'dir',
    );
  }
  const cleanEnv = {
    ...process.env,
    ASTRO_TELEMETRY_DISABLED: '1',
    PUBLIC_SITE_INDEXABLE: 'false',
  };
  for (const key of git('rev-parse', '--local-env-vars').trim().split('\n'))
    delete cleanEnv[key];
  delete cleanEnv.URL_BASE_REF;
  delete cleanEnv.URL_TARGET_TREE;
  const run = (command, args, env = cleanEnv) =>
    execFileSync(command, args, { cwd: snapshot, env, stdio: 'inherit' });
  console.log('[pre-commit] 校验暂存快照：文章排版、URL、Schema 与 MDX 构建…');
  const posts = git(
    'ls-tree',
    '-r',
    '--name-only',
    '-z',
    tree,
    '--',
    'src/content/posts',
  )
    .split('\0')
    .filter((file) => /^src\/content\/posts\/[^/]+\.mdx$/.test(file));
  // Avoid shell globbing and command-line length limits on a large article library.
  for (let offset = 0; offset < posts.length; offset += 50)
    run(process.execPath, [
      join(snapshot, 'node_modules/prettier/bin/prettier.cjs'),
      '--check',
      ...posts.slice(offset, offset + 50),
    ]);
  run(
    process.execPath,
    ['--experimental-strip-types', 'scripts/check-review-urls.mjs'],
    {
      ...cleanEnv,
      ...Object.fromEntries(
        Object.entries(gitEnv).filter(([key]) => key.startsWith('GIT_')),
      ),
      URL_BASE_REF: base,
      URL_TARGET_TREE: tree,
    },
  );
  run('npm', ['run', 'build']);
  console.log('[pre-commit] 暂存文章校验通过。');
} catch (error) {
  console.error(`\n[pre-commit] 提交已阻止：${error.message}`);
  console.error('请修复后重新 git add，再提交；校验未自动修改文章或暂存区。');
  process.exitCode = 1;
} finally {
  if (temporary) await rm(temporary, { recursive: true, force: true });
}
