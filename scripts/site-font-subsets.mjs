import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import subsetFont from 'subset-font';
import fontverter from 'fontverter';

const require = createRequire(import.meta.url);
const sourceFontCss = require.resolve('@fontsource-variable/noto-sans-sc');

export function hasGlyphOutlines(sfnt) {
  for (let i = 0; i < sfnt.readUInt16BE(4); i++) {
    const offset = 12 + i * 16;
    if (sfnt.toString('ascii', offset, offset + 4) === 'glyf') {
      return sfnt.readUInt32BE(offset + 12) > 0;
    }
  }
  return false;
}

export async function collectCharacters(directory) {
  const characters = new Set();
  const visit = async (folder) => {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (/\.(astro|css|ts|js|json|md|mdx)$/.test(entry.name)) {
        for (const character of await readFile(path, 'utf8')) {
          if (character.codePointAt(0) >= 32) characters.add(character);
        }
      }
    }
  };
  await visit(directory);
  return [...characters].sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
}

export function charactersInRange(characters, unicodeRange) {
  const ranges = unicodeRange.split(',').map((part) => {
    const [start, end = start] = part.trim().replace(/^U\+/i, '').split('-');
    return [parseInt(start, 16), parseInt(end, 16)];
  });
  return characters.filter((character) =>
    ranges.some(([start, end]) => {
      const code = character.codePointAt(0);
      return code >= start && code <= end;
    }),
  );
}

export function formatUnicodeRange(characters) {
  const codes = characters.map((c) => c.codePointAt(0));
  const parts = [];
  for (let i = 0; i < codes.length;) {
    const start = codes[i];
    let end = start;
    while (i + 1 < codes.length && codes[i + 1] === end + 1) {
      i++;
      end = codes[i];
    }
    parts.push(
      start === end
        ? `U+${start.toString(16)}`
        : `U+${start.toString(16)}-${end.toString(16)}`,
    );
    i++;
  }
  return parts.join(',');
}

export async function createFontOverrides(css, characters, cacheDirectory) {
  await mkdir(cacheDirectory, { recursive: true });
  const overrides = [];
  for (const match of css.matchAll(/@font-face\s*\{[^}]+\}/g)) {
    const face = match[0];
    const file = face.match(/url\(([^)]+)\)/)?.[1];
    const range = face.match(/unicode-range:\s*([^;]+);/)?.[1];
    if (!file || !range)
      throw new Error('Unexpected Noto Sans SC font declaration');
    const needed = charactersInRange(characters, range);
    if (!needed.length) continue;
    const original = await readFile(resolve(dirname(sourceFontCss), file));
    const subset = await subsetFont(original, needed.join(''), {
      targetFormat: 'woff2',
      preserveNameIds: [0, 13, 14],
    });
    if (subset.length >= original.length - 512) continue;
    // Space/format-only subsets can have an empty glyf table, which browsers
    // reject. Leave their original face intact instead of emitting a bad font.
    if (!hasGlyphOutlines(await fontverter.convert(subset, 'sfnt'))) continue;
    const hash = createHash('sha256').update(subset).digest('hex').slice(0, 16);
    const output = join(cacheDirectory, `noto-site-${hash}.woff2`);
    await writeFile(output, subset);
    const url = relative(dirname(sourceFontCss), output).split('\\').join('/');
    const subsetRange = formatUnicodeRange(needed);
    overrides.push(face.replace(file, url).replace(range, subsetRange));
  }
  // Later faces win for covered characters. Keep every original face as a
  // fallback for escaped strings, third-party text, and future runtime content.
  return `${css}\n${overrides.join('\n')}`;
}

export function siteFontSubsets() {
  let root;
  let generated;
  return {
    name: 'lowendaff-site-font-subsets',
    apply: 'build',
    enforce: 'pre',
    configResolved(config) {
      root = config.root;
    },
    async transform(code, id) {
      if (id.split('?')[0] !== sourceFontCss) return;
      generated ??= collectCharacters(join(root, 'src')).then((characters) =>
        createFontOverrides(
          code,
          characters,
          join(root, '.astro', 'font-subsets'),
        ),
      );
      return { code: await generated, map: null };
    },
  };
}
