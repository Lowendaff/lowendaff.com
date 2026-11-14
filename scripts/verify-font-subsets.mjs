import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import {
  charactersInRange,
  collectCharacters,
  createFontOverrides,
} from './site-font-subsets.mjs';

const require = createRequire(import.meta.url);

test('Source character collection refreshes after content changes, including supplementary characters', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lowendaff-font-'));
  try {
    await writeFile(join(directory, 'post.mdx'), '# 东京 🇯🇵');
    const initial = await collectCharacters(directory);
    assert(initial.includes('东'));
    assert(initial.includes('🇯'));
    await writeFile(join(directory, 'new.mdx'), '# 法兰克福');
    assert((await collectCharacters(directory)).includes('福'));
    await rm(join(directory, 'new.mdx'));
    assert(!(await collectCharacters(directory)).includes('福'));
    assert.deepEqual(
      charactersInRange(['A', '东', '🇯'], 'U+4E00-9FFF,U+1F1EF'),
      ['东', '🇯'],
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Subsets retain original fallbacks, variable weights and license metadata', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lowendaff-font-'));
  try {
    const cssPath = require.resolve('@fontsource-variable/noto-sans-sc');
    const css = await readFile(cssPath, 'utf8');
    const face = [...css.matchAll(/@font-face\s*\{[^}]+\}/g)].find(([text]) =>
      text.includes('noto-sans-sc-119-'),
    )[0];
    const output = await createFontOverrides(face, ['中', '文'], directory);
    assert(output.startsWith(face));
    assert.equal((output.match(/@font-face/g) || []).length, 2);
    assert(output.includes('font-weight: 100 900'));
    assert(output.includes('U+4e2d'));
    const [file] = await readdir(directory);
    const subset = await readFile(join(directory, file));
    const original = await readFile(
      join(dirname(cssPath), face.match(/url\(([^)]+)\)/)[1]),
    );
    assert(subset.length < original.length / 2);
    assert.equal(subset.toString('ascii', 0, 4), 'wOF2');
    // Inspect real OpenType tables, not only the declaration used to render them.
    const fontverter = require('fontverter');
    const sfnt = await fontverter.convert(subset, 'sfnt');
    const tables = new Map();
    for (let i = 0; i < sfnt.readUInt16BE(4); i++) {
      const offset = 12 + i * 16;
      tables.set(
        sfnt.toString('ascii', offset, offset + 4),
        sfnt.readUInt32BE(offset + 8),
      );
    }
    const fvar = tables.get('fvar');
    assert.notEqual(fvar, undefined);
    const axis = fvar + sfnt.readUInt16BE(fvar + 4);
    assert.equal(sfnt.toString('ascii', axis, axis + 4), 'wght');
    assert.equal(sfnt.readInt32BE(axis + 4) / 65536, 100);
    assert.equal(sfnt.readInt32BE(axis + 12) / 65536, 900);
    const name = tables.get('name');
    const ids = new Set(
      Array.from({ length: sfnt.readUInt16BE(name + 2) }, (_, i) =>
        sfnt.readUInt16BE(name + 6 + i * 12 + 6),
      ),
    );
    assert(ids.has(0));
    const originalSfnt = await fontverter.convert(original, 'sfnt');
    let originalName;
    for (let i = 0; i < originalSfnt.readUInt16BE(4); i++) {
      const offset = 12 + i * 16;
      if (originalSfnt.toString('ascii', offset, offset + 4) === 'name') {
        originalName = originalSfnt.readUInt32BE(offset + 8);
      }
    }
    for (let i = 0; i < originalSfnt.readUInt16BE(originalName + 2); i++) {
      const id = originalSfnt.readUInt16BE(originalName + 6 + i * 12 + 6);
      if ([0, 13, 14].includes(id)) assert(ids.has(id));
    }
    const repeated = await createFontOverrides(face, ['中', '文'], directory);
    assert.equal(
      repeated,
      output,
      'Stable content generates stable asset names',
    );
    assert.equal(await createFontOverrides(face, [], directory), `${face}\n`);
    const whitespaceFace = [...css.matchAll(/@font-face\s*\{[^}]+\}/g)].find(
      ([text]) => text.includes('noto-sans-sc-latin-wght'),
    )[0];
    assert.equal(
      await createFontOverrides(whitespaceFace, [' '], directory),
      `${whitespaceFace}\n`,
      'Whitespace-only content keeps its original, browser-decodable font',
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
