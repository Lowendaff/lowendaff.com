import { execFileSync } from 'node:child_process';
import {
  assertUniqueReviewUrls,
  generateReviewPermalink,
} from '../src/lib/review-url.ts';
import { readPosts, parsePost, postsDirectory } from './review-url-files.mjs';

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const explicit = process.env.URL_BASE_REF;
let reference = explicit || (process.env.CI ? undefined : 'HEAD');
if (process.env.CI && !reference) {
  // Manual workflows compare with their own committed snapshot.
  if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch') reference = 'HEAD';
  else throw new Error('URL_BASE_REF is required in CI');
}
let base;
if (reference && !/^0+$/.test(reference)) {
  if (!/^[a-zA-Z0-9_./-]+$/.test(reference) || reference.startsWith('-'))
    throw new Error('Invalid URL_BASE_REF');
  base = git('rev-parse', '--verify', `${reference}^{commit}`).trim();
}
const current = await readPosts();
assertUniqueReviewUrls(current);
const old = new Map();
if (base) {
  for (const file of git(
    'ls-tree',
    '-r',
    '--name-only',
    base,
    '--',
    postsDirectory,
  )
    .trim()
    .split('\n')
    .filter((file) => file.endsWith('.mdx'))) {
    old.set(file, parsePost(git('show', `${base}:${file}`), file));
  }
  // Preserve identity across ordinary file renames without adding author metadata.
  const changes = git(
    'diff',
    '--name-status',
    '-z',
    '--find-renames',
    base,
    ...(process.env.URL_TARGET_TREE ? [process.env.URL_TARGET_TREE] : []),
    '--',
    postsDirectory,
  ).split('\0');
  for (let i = 0; i < changes.length;) {
    const status = changes[i++];
    if (!status) break;
    const from = changes[i++];
    if (status.startsWith('R')) {
      const to = changes[i++];
      if (old.has(from)) old.set(to, old.get(from));
    }
  }
}
for (const post of current) {
  if (post.data.kind === 'archive-reference') continue;
  const previous =
    old.get(post.file) ??
    [...old.values()].find(
      (entry) => entry.data.permalink === post.data.permalink,
    );
  const published =
    previous &&
    previous.data.kind !== 'archive-reference' &&
    previous.data.draft !== true;
  if (published && previous.data.permalink) {
    if (post.data.permalink !== previous.data.permalink)
      throw new Error(
        `${post.file}: published permalink is immutable; restore ${previous.data.permalink}`,
      );
  } else {
    const expected = generateReviewPermalink(
      post.data.title,
      post.data.testedAt,
    );
    if (post.data.permalink !== expected)
      throw new Error(`${post.file}: initial permalink must be ${expected}`);
  }
}
console.log(
  `Validated ${current.length} article URL records against ${base ?? 'an empty repository'}; no files written.`,
);
