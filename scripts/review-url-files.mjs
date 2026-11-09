import { readdir, readFile } from 'node:fs/promises';
import { parse } from 'yaml';

export const postsDirectory = 'src/content/posts';
export function parsePost(source, file) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error(`${file}: missing YAML frontmatter`);
  const data = parse(match[1], { uniqueKeys: true });
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error(`${file}: invalid frontmatter`);
  return { id: file, file, source, data };
}
export async function readPosts(root = process.cwd()) {
  const names = (await readdir(`${root}/${postsDirectory}`))
    .filter((name) => name.endsWith('.mdx'))
    .sort();
  return Promise.all(
    names.map(async (name) => {
      const file = `${postsDirectory}/${name}`;
      return parsePost(await readFile(`${root}/${file}`, 'utf8'), file);
    }),
  );
}

/** Insert only new fields: preserve the existing frontmatter, comments and body bytes. */
export function insertPermalink(source, permalink) {
  const newline = source.startsWith('---\r\n') ? '\r\n' : '\n';
  return source.replace(
    /^---\r?\n/,
    `---${newline}permalink: '${permalink}'${newline}`,
  );
}
