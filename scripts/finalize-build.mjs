import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildSearchIndex } from './build-search-index.mjs';

// Derive hosting rules from Astro's actual generated redirects, not a second URL list.
const root = new URL('../dist/', import.meta.url);
const redirects = [];
async function walk(directory = '') {
  for (const entry of await readdir(new URL(directory, root), {
    withFileTypes: true,
  })) {
    const relative = `${directory}${entry.name}`;
    if (entry.isDirectory()) await walk(`${relative}/`);
    else if (entry.name === 'index.html') {
      const html = await readFile(new URL(relative, root), 'utf8');
      const target = html.match(
        /<meta http-equiv="refresh" content="0;url=([^"\s]+)"/i,
      )?.[1];
      if (!target) continue;
      if (!target.startsWith('/') || target.startsWith('//'))
        throw new Error(`Unexpected redirect: ${target}`);
      const source = `/${path.posix.dirname(relative)}/`;
      redirects.push({ source, target });
    }
  }
}
await walk();
const lines = new Set();
for (const { source, target } of redirects) {
  lines.add(`${encodeURI(source)} ${target} 301`);
  // WordPress snapshots contain both uppercase and lowercase percent escapes.
  lines.add(
    `${encodeURI(source).replace(/%[0-9A-F]{2}/g, (escape) => escape.toLowerCase())} ${target} 301`,
  );
  lines.add(`${encodeURI(source.slice(0, -1))} ${target} 301`);
}
await writeFile(new URL('_redirects', root), `${[...lines].join('\n')}\n`);
console.log(
  `Generated ${redirects.length} redirect targets (${lines.size} hosting rules).`,
);
await buildSearchIndex();
