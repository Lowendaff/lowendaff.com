import { readFile, writeFile, rm } from 'node:fs/promises';
import { parse } from 'parse5';
import { hash, validateConfig, validPage } from './indexnow-core.mjs';

const children = (node) => node.childNodes ?? [];
const attr = (node, name) =>
  node.attrs?.find((item) => item.name === name)?.value;
function find(node, predicate) {
  if (predicate(node)) return node;
  for (const child of children(node)) {
    const result = find(child, predicate);
    if (result) return result;
  }
}

/** Rendered content, not asset hashes or style attributes, determines updates. */
export function contentFingerprint(html) {
  const document = parse(html);
  const main = find(document, (node) => node.tagName === 'main');
  if (!main) throw new Error('Search page has no main content');
  const tokens = [];
  function visit(node) {
    if (
      ['script', 'style', 'svg', 'template', 'noscript'].includes(node.tagName)
    )
      return;
    if (attr(node, 'aria-hidden') === 'true') return;
    if (node.nodeName === '#text') {
      const text = node.value.replace(/\s+/g, ' ').trim();
      if (text) tokens.push(text);
      return;
    }
    // Keep meaningful destinations and image descriptions; discard visual attributes.
    for (const name of ['href', 'src', 'alt', 'datetime']) {
      const value = attr(node, name);
      if (value) tokens.push(`${name}:${value}`);
    }
    if (/^h[1-6]$/.test(node.tagName)) tokens.push(node.tagName);
    for (const child of children(node)) visit(child);
  }
  const title = find(document, (node) => node.tagName === 'title');
  if (title) visit(title);
  const description = find(
    document,
    (node) => node.tagName === 'meta' && attr(node, 'name') === 'description',
  );
  tokens.push(attr(description ?? {}, 'content') ?? '');
  visit(main);
  // Authored dates/author metadata can change without changing visible paragraph text.
  const jsonld = find(
    document,
    (node) =>
      node.tagName === 'script' && attr(node, 'type') === 'application/ld+json',
  );
  if (jsonld)
    tokens.push(
      JSON.stringify(
        JSON.parse(
          children(jsonld)
            .map((node) => node.value ?? '')
            .join(''),
        ),
      ),
    );
  return hash(JSON.stringify(tokens));
}

/** Replacing a local evidence image at the same URL is a content update too. */
export async function pageFingerprint(html, root) {
  const sources = new Set();
  function collect(node) {
    const src = attr(node, 'src');
    if (node.tagName === 'img' && src?.startsWith('/') && !src.startsWith('//'))
      sources.add(src);
    for (const child of children(node)) collect(child);
  }
  const main = find(parse(html), (node) => node.tagName === 'main');
  if (main) collect(main);
  const images = [];
  for (const src of [...sources].sort()) {
    const pathname = decodeURIComponent(
      new URL(src, 'https://lowendaff.com').pathname,
    );
    const file = new URL(pathname.slice(1), root);
    if (!file.href.startsWith(root.href))
      throw new Error('Image escaped the build directory');
    images.push([src, hash(await readFile(file))]);
  }
  return hash(JSON.stringify([contentFingerprint(html), images]));
}

export async function buildSearchIndex(
  root = new URL('../dist/', import.meta.url),
) {
  const config = validateConfig(
    JSON.parse(
      await readFile(
        new URL('../src/config/search-engines.json', import.meta.url),
        'utf8',
      ),
    ),
  );
  const indexable = process.env.PUBLIC_SITE_INDEXABLE === 'true';
  const sitemap = await readFile(new URL('sitemap.xml', root), 'utf8');
  const entries = {};
  for (const match of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const url = match[1];
    if (!indexable || !validPage(url, config.site))
      throw new Error('Unexpected search index URL');
    const relative = new URL(url).pathname.slice(1) + 'index.html';
    entries[url] = await pageFingerprint(
      await readFile(new URL(relative, root), 'utf8'),
      root,
    );
  }
  const index = { schema: 1, site: config.site, indexable, entries };
  await writeFile(
    new URL('search-index.json', root),
    JSON.stringify(index) + '\n',
  );
  const keyFile = new URL(`${config.indexNow.key}.txt`, root);
  if (indexable && config.indexNow.enabled)
    await writeFile(keyFile, config.indexNow.key + '\n');
  else await rm(keyFile, { force: true });
  console.log(
    `Search content index: ${Object.keys(entries).length} pages; IndexNow key ${indexable && config.indexNow.enabled ? 'enabled' : 'excluded'}.`,
  );
}
