import { execFile, execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, rm, symlink } from 'node:fs/promises';
import { availableParallelism, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

export const execFileAsync = promisify(execFile);
export const repoRoot = fileURLToPath(new URL('../', import.meta.url));
export const astroBin = join(repoRoot, 'node_modules/astro/bin/astro.mjs');

/**
 * Link top-level packages inside node_modules individually so each isolated
 * workspace gets its own local node_modules/.vite cache directory and parallel
 * Astro/Vite builds never race on shared cache state.
 */
export async function linkNodeModules(targetDir, sourceDir = repoRoot) {
  const targetModules = join(targetDir, 'node_modules');
  await mkdir(targetModules, { recursive: true });
  for (const name of await readdir(join(sourceDir, 'node_modules'))) {
    if (name.startsWith('.') && name !== '.bin') continue;
    await symlink(
      resolve(sourceDir, 'node_modules', name),
      join(targetModules, name),
      'dir',
    );
  }
}

/**
 * Create a clean temporary copy of the project excluding real benchmark
 * articles and archive assets so synthetic fixture suites run in O(1) time
 * without mutating the working tree or dist/.
 */
export async function createIsolatedWorkspace(prefix = 'lowendaff-isolated-') {
  const targetDir = await mkdtemp(join(tmpdir(), prefix));
  const trackedAndUntracked = new Set(
    execFileSync(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
      { cwd: repoRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
    )
      .split('\0')
      .filter(Boolean),
  );
  const deleted = new Set(
    execFileSync('git', ['ls-files', '--deleted', '-z'], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    })
      .split('\0')
      .filter(Boolean),
  );

  for (const relPath of trackedAndUntracked) {
    if (deleted.has(relPath)) continue;
    if (
      relPath.startsWith('src/content/posts/') &&
      relPath !== 'src/content/posts/.gitkeep'
    ) {
      continue;
    }
    if (
      relPath.startsWith('public/archive-assets/') ||
      relPath.startsWith('test-results/')
    ) {
      continue;
    }
    const dest = join(targetDir, relPath);
    await mkdir(dirname(dest), { recursive: true });
    await cp(join(repoRoot, relPath), dest);
  }

  await mkdir(join(targetDir, 'src/content/posts'), { recursive: true });
  await linkNodeModules(targetDir, repoRoot);
  return targetDir;
}

/**
 * Clone an existing isolated base workspace (excluding node_modules, dist, and
 * .astro) for a parallel worker, then attach its own private node_modules links.
 */
export async function cloneIsolatedWorkspace(
  baseDir,
  prefix = 'lowendaff-worker-',
) {
  const workerDir = await mkdtemp(join(tmpdir(), prefix));
  for (const entry of await readdir(baseDir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.astro') {
      continue;
    }
    await cp(join(baseDir, entry), join(workerDir, entry), { recursive: true });
  }
  await linkNodeModules(workerDir, repoRoot);
  return workerDir;
}

export function defaultWorkerCount(taskCount, cap = 4) {
  return Math.max(1, Math.min(cap, taskCount, availableParallelism()));
}
