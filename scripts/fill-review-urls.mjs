import { readFile, writeFile, rename, stat, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  generateReviewPermalink,
  assertUniqueReviewUrls,
} from '../src/lib/review-url.ts';
import { readPosts, insertPermalink } from './review-url-files.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const selected = new Set(
  args
    .filter((arg) => arg !== '--dry-run')
    .map((arg) => path.relative(process.cwd(), path.resolve(arg))),
);
const posts = await readPosts();
for (const file of selected)
  if (!posts.some((post) => post.file === file))
    throw new Error(`Not a review source file: ${file}`);
const plans = [];
for (const post of posts) {
  if (
    post.data.kind === 'archive-reference' ||
    (selected.size && !selected.has(post.file))
  )
    continue;
  if (Object.hasOwn(post.data, 'permalink')) continue;
  try {
    post.data.permalink = generateReviewPermalink(
      post.data.title,
      post.data.testedAt,
    );
  } catch (error) {
    throw new Error(`${post.file}: ${error.message}`);
  }
  plans.push({
    ...post,
    next: insertPermalink(post.source, post.data.permalink),
  });
}
// Check all reserved addresses before writing any file, including drafts and aliases.
assertUniqueReviewUrls(
  posts.filter((post) => post.data.permalink !== undefined),
);
for (const plan of plans) {
  if ((await readFile(plan.file, 'utf8')) !== plan.source)
    throw new Error(`${plan.file}: source changed during URL generation`);
}
for (const plan of plans) {
  if (!dryRun) {
    const temp = `${plan.file}.url-${process.pid}.tmp`;
    try {
      await writeFile(temp, plan.next, {
        flag: 'wx',
        mode: (await stat(plan.file)).mode,
      });
      await rename(temp, plan.file);
    } finally {
      await rm(temp, { force: true });
    }
  }
  console.log(
    `${dryRun ? 'Would fill' : 'Filled'} ${plan.file}: ${plan.data.permalink}`,
  );
}
console.log(
  `${plans.length} URL(s) ${dryRun ? 'planned' : 'filled'}; existing permalinks left unchanged.`,
);
