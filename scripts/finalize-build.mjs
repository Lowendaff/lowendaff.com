import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSearchIndex } from './build-search-index.mjs';

const distDir = fileURLToPath(new URL('../dist/', import.meta.url));

async function walkHtml(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walkHtml(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

/**
 * Split bulky CJK / monospace @font-face declarations out of render-blocking
 * BaseLayout.*.css into a deferred stylesheet so First Contentful Paint only
 * waits for core layout CSS (~46 KB raw / ~9 KB gzip).
 */
async function splitDeferredFontFaces(htmlFiles) {
  const astroDir = join(distDir, '_astro');
  let entries;
  try {
    entries = await readdir(astroDir);
  } catch {
    return;
  }
  const baseCssName = entries.find(
    (name) => name.startsWith('BaseLayout.') && name.endsWith('.css'),
  );
  if (!baseCssName) return;

  const baseCssPath = join(astroDir, baseCssName);
  const originalCss = await readFile(baseCssPath, 'utf8');
  const deferredFaces = [];
  const remainingCss = originalCss.replace(
    /@font-face\s*\{[^}]*\}/g,
    (face) => {
      if (
        /font-family:\s*['"]?(?:Noto Sans SC Variable|JetBrains Mono Variable)['"]?/i.test(
          face,
        )
      ) {
        deferredFaces.push(face);
        return '';
      }
      return face;
    },
  );
  if (!deferredFaces.length) return;

  const deferredCss = deferredFaces.join('\n');
  const hash = createHash('sha256')
    .update(deferredCss)
    .digest('hex')
    .slice(0, 10);
  const deferredFile = `fonts-deferred.${hash}.css`;
  await writeFile(join(astroDir, deferredFile), deferredCss);
  await writeFile(baseCssPath, remainingCss);

  const baseHref = `/_astro/${baseCssName}`;
  const deferredHref = `/_astro/${deferredFile}`;
  const injection = `<link rel="stylesheet" href="${deferredHref}" media="print" data-deferred-fonts><noscript><link rel="stylesheet" href="${deferredHref}"></noscript>`;

  for (const htmlPath of htmlFiles) {
    const html = await readFile(htmlPath, 'utf8');
    if (!html.includes(baseHref) || html.includes(deferredHref)) continue;
    const targetTag = new RegExp(
      `(<link[^>]*href="${baseHref.replace('.', '\\.')}"[^>]*>)`,
    );
    const updated = html.replace(targetTag, `$1${injection}`);
    if (updated !== html) await writeFile(htmlPath, updated);
  }
}

/**
 * Deduplicate repeated monochrome 24x24 inline <svg> icons within each HTML
 * page into a local <symbol> sprite when an identical icon body repeats >= 3x.
 */
async function deduplicatePageSvgIcons(htmlFiles) {
  const svgRe = /<svg\b([^>]*)>([\s\S]*?)<\/svg>/g;
  for (const htmlPath of htmlFiles) {
    const html = await readFile(htmlPath, 'utf8');
    // Protect <template> blocks from replacement so cloneNode templates keep standalone SVGs.
    const templates = [];
    const masked = html.replace(/<template\b[\s\S]*?<\/template>/g, (tpl) => {
      const idx = templates.push(tpl) - 1;
      return `__TPL_MASK_${idx}__`;
    });

    const freq = new Map();
    for (const m of masked.matchAll(svgRe)) {
      const [, attrs, body] = m;
      if (
        !attrs.includes('viewBox="0 0 24 24"') ||
        !attrs.includes('aria-hidden="true"') ||
        /<(?:defs|linearGradient|radialGradient|clipPath|mask|symbol|use)\b/i.test(
          body,
        )
      ) {
        continue;
      }
      freq.set(body, (freq.get(body) || 0) + 1);
    }

    const spriteIds = new Map();
    const symbols = [];
    for (const [body, count] of freq) {
      if (count < 3) continue;
      const id = `mc-sym-${symbols.length}`;
      spriteIds.set(body, id);
      symbols.push(`<symbol id="${id}" viewBox="0 0 24 24">${body}</symbol>`);
    }
    if (!symbols.length) continue;

    let rewritten = masked.replace(svgRe, (full, attrs, body) => {
      if (
        !attrs.includes('viewBox="0 0 24 24"') ||
        !attrs.includes('aria-hidden="true"')
      ) {
        return full;
      }
      const id = spriteIds.get(body);
      return id ? `<svg${attrs}><use href="#${id}"/></svg>` : full;
    });

    const spriteBlock = `<svg aria-hidden="true" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden"><defs>${symbols.join('')}</defs></svg>`;
    rewritten = rewritten.replace(/(<body\b[^>]*>)/, `$1${spriteBlock}`);
    rewritten = rewritten.replace(
      /__TPL_MASK_(\d+)__/g,
      (_, idx) => templates[Number(idx)],
    );
    await writeFile(htmlPath, rewritten);
  }
}

const htmlFiles = await walkHtml(distDir);
await splitDeferredFontFaces(htmlFiles);
await deduplicatePageSvgIcons(htmlFiles);
await buildSearchIndex();
