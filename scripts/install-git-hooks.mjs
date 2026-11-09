import { execFileSync } from 'node:child_process';
import { access, chmod, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const root = git('rev-parse', '--show-toplevel');
let configured;
try {
  configured = git('config', '--get', 'core.hooksPath');
} catch (error) {
  if (error.status !== 1) throw error;
}
if (configured && configured !== '.githooks') {
  throw new Error(
    `已有 core.hooksPath=${configured}；未覆盖。请先人工合并现有 hook。`,
  );
}
if (!configured) {
  const hooks = resolve(root, git('rev-parse', '--git-path', 'hooks'));
  const entries = await readdir(hooks).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const active = entries.filter((name) => !name.endsWith('.sample'));
  if (active.length)
    throw new Error(`已有 hooks：${active.join(', ')}；未覆盖，请先人工合并。`);
}
const hook = resolve(root, '.githooks/pre-commit');
await access(hook);
await chmod(hook, 0o755);
git('config', '--local', 'core.hooksPath', '.githooks');
if (git('config', '--get', 'core.hooksPath') !== '.githooks')
  throw new Error(
    '其他配置覆盖了本仓库 core.hooksPath，请检查 Git worktree 配置。',
  );
console.log('已启用本仓库 .githooks/pre-commit；文章校验失败将阻止提交。');
