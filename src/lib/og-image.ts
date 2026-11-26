import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import flagpack from '@iconify-json/flagpack/icons.json';
import { reviewTypeLabels, type ReviewType } from './review-types';

const require = createRequire(import.meta.url);
const subsetFont = require('subset-font') as (
  buffer: Buffer | Uint8Array,
  text: string,
  options: { targetFormat: 'sfnt'; variationAxes?: Record<string, number> },
) => Promise<Buffer>;

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

interface NotoSlice {
  index: number;
  tag: string;
  regFamily: string;
  boldFamily: string;
  file: string;
  ranges: Array<[number, number]>;
}

interface RuntimeAssets {
  baseBuffers: Uint8Array[];
  interRegAdvance: (cp: number) => number;
  interBoldAdvance: (cp: number) => number;
  monoAdvance: (cp: number) => number;
  notoDir: string;
  notoSlices: NotoSlice[];
  avatarDataUri: string;
}

interface CachedSlice {
  regBuffer: Uint8Array;
  boldBuffer: Uint8Array;
  regAdvance: (cp: number) => number;
  boldAdvance: (cp: number) => number;
}

let runtimePromise: Promise<RuntimeAssets> | undefined;
const sliceCache = new Map<string, Promise<CachedSlice>>();

function parseSfntMetrics(buf: Buffer): (cp: number) => number {
  const u16 = (off: number) =>
    off >= 0 && off + 2 <= buf.length ? buf.readUInt16BE(off) : 0;
  const i16 = (off: number) =>
    off >= 0 && off + 2 <= buf.length ? buf.readInt16BE(off) : 0;
  const u32 = (off: number) =>
    off >= 0 && off + 4 <= buf.length ? buf.readUInt32BE(off) : 0;

  const tables = new Map<string, number>();
  const numTables = u16(4);
  for (let i = 0; i < numTables; i++) {
    const off = 12 + i * 16;
    if (off + 16 > buf.length) break;
    tables.set(buf.toString('ascii', off, off + 4), u32(off + 8));
  }
  const head = tables.get('head') ?? 0;
  const hhea = tables.get('hhea') ?? 0;
  const hmtx = tables.get('hmtx') ?? 0;
  const cmap = tables.get('cmap') ?? 0;
  if (!head || !hhea || !hmtx || !cmap) return () => 0;

  const upem = u16(head + 18) || 1000;
  const numHMetrics = u16(hhea + 34) || 1;
  const numSub = u16(cmap + 2);
  let fmt12 = 0;
  let fmt4 = 0;
  for (let i = 0; i < numSub; i++) {
    const recOff = cmap + 4 + i * 8;
    const platformId = u16(recOff);
    const encodingId = u16(recOff + 2);
    if (
      platformId !== 0 &&
      !(platformId === 3 && (encodingId === 1 || encodingId === 10))
    ) {
      continue;
    }
    const relOff = u32(recOff + 4);
    if (!relOff) continue;
    const subOff = cmap + relOff;
    const fmt = u16(subOff);
    if (fmt === 12 && !fmt12) fmt12 = subOff;
    else if (fmt === 4 && !fmt4) fmt4 = subOff;
  }

  const glyphId = (cp: number): number => {
    if (fmt12) {
      const nGroups = u32(fmt12 + 12);
      for (let i = 0; i < nGroups; i++) {
        const g = fmt12 + 16 + i * 12;
        if (g + 12 > buf.length) break;
        const s = u32(g);
        const e = u32(g + 4);
        const gid = u32(g + 8);
        if (cp >= s && cp <= e) return gid + (cp - s);
      }
    }
    if (fmt4 && cp <= 0xffff) {
      const segCount = Math.floor(u16(fmt4 + 6) / 2);
      const endOff = fmt4 + 14;
      const startOff = endOff + segCount * 2 + 2;
      const deltaOff = startOff + segCount * 2;
      const rangeOff = deltaOff + segCount * 2;
      for (let i = 0; i < segCount; i++) {
        const end = u16(endOff + i * 2);
        if (cp > end) continue;
        const start = u16(startOff + i * 2);
        if (cp < start || (start === 0xffff && end === 0xffff)) return 0;
        const ro = u16(rangeOff + i * 2);
        const delta = i16(deltaOff + i * 2);
        if (ro === 0) return (cp + delta) & 0xffff;
        const gAddr = rangeOff + i * 2 + ro + (cp - start) * 2;
        if (gAddr < 0 || gAddr + 2 > buf.length) return 0;
        const g = u16(gAddr);
        return g === 0 ? 0 : (g + delta) & 0xffff;
      }
    }
    return 0;
  };

  return (cp: number) => {
    const gid = glyphId(cp);
    if (gid === 0) return 0;
    const idx = Math.min(gid, numHMetrics - 1);
    const advOff = hmtx + idx * 4;
    if (advOff + 2 > buf.length) return 0;
    return u16(advOff) / upem;
  };
}

function parseUnicodeRange(unicodeRange: string): Array<[number, number]> {
  return unicodeRange.split(',').map((part) => {
    const [start, end = start] = part.trim().replace(/^U\+/i, '').split('-');
    return [parseInt(start, 16), parseInt(end, 16)];
  });
}

function buildCharset(ranges: Array<[number, number]>): string {
  let out = '';
  for (const [start, end] of ranges) {
    const cappedEnd = Math.min(end, start + 1024);
    for (let cp = start; cp <= cappedEnd; cp++) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue;
      out += String.fromCodePoint(cp);
    }
  }
  return out;
}

const LATIN_CHARSET = buildCharset([
  [0x0020, 0x007e],
  [0x00a0, 0x00ff],
  [0x2010, 0x2027],
]);

function replaceUtf16Names(
  sfntBuf: Buffer,
  pairs: Array<[string, string]>,
): Uint8Array {
  const out = Buffer.from(sfntBuf);
  const encodeU16Be = (str: string) =>
    Buffer.from(
      str
        .split('')
        .map((c) => `\0${c}`)
        .join(''),
      'binary',
    );
  for (const [fromStr, toStr] of pairs) {
    const fromBuf = encodeU16Be(fromStr);
    const toBuf = encodeU16Be(toStr);
    if (fromBuf.length !== toBuf.length) continue;
    let idx = 0;
    while ((idx = out.indexOf(fromBuf, idx)) !== -1) {
      toBuf.copy(out, idx);
      idx += toBuf.length;
    }
  }
  return new Uint8Array(out);
}

async function getRuntimeAssets(): Promise<RuntimeAssets> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const wasmPath = require.resolve('@resvg/resvg-wasm/index_bg.wasm');
      await initWasm(await readFile(wasmPath));

      const interCss = require.resolve('@fontsource-variable/inter');
      const interLatin = await readFile(
        resolve(dirname(interCss), 'files/inter-latin-wght-normal.woff2'),
      );

      const jbCss = require.resolve('@fontsource-variable/jetbrains-mono');
      const jbLatin = await readFile(
        resolve(dirname(jbCss), 'files/jetbrains-mono-latin-wght-normal.woff2'),
      );

      const [interRegSfnt, interBoldSfnt, jbSfnt] = await Promise.all([
        subsetFont(interLatin, LATIN_CHARSET, {
          targetFormat: 'sfnt',
          variationAxes: { wght: 450 },
        }),
        subsetFont(interLatin, LATIN_CHARSET, {
          targetFormat: 'sfnt',
          variationAxes: { wght: 700 },
        }),
        subsetFont(jbLatin, LATIN_CHARSET, {
          targetFormat: 'sfnt',
          variationAxes: { wght: 550 },
        }),
      ]);

      const baseBuffers = [
        replaceUtf16Names(interRegSfnt, [
          ['Inter Regular', 'IntRg Regular'],
          ['Inter-Regular', 'IntRg-Regular'],
          ['Inter', 'IntRg'],
        ]),
        replaceUtf16Names(interBoldSfnt, [
          ['Inter Regular', 'IntBd Regular'],
          ['Inter-Regular', 'IntBd-Regular'],
          ['Inter', 'IntBd'],
        ]),
        new Uint8Array(jbSfnt),
      ];
      const interRegAdvance = parseSfntMetrics(interRegSfnt);
      const interBoldAdvance = parseSfntMetrics(interBoldSfnt);
      const monoAdvance = parseSfntMetrics(jbSfnt);

      const notoCssPath = require.resolve('@fontsource-variable/noto-sans-sc');
      const notoDir = dirname(notoCssPath);
      const notoCss = await readFile(notoCssPath, 'utf8');
      const notoSlices: NotoSlice[] = [];
      let sliceIdx = 0;
      for (const match of notoCss.matchAll(/@font-face\s*\{[^}]+\}/g)) {
        const face = match[0];
        const file = face.match(/url\(([^)]+)\)/)?.[1];
        const range = face.match(/unicode-range:\s*([^;]+);/)?.[1];
        if (file && range) {
          const num = String(sliceIdx).padStart(3, '0');
          notoSlices.push({
            index: sliceIdx++,
            tag: num,
            regFamily: `Noto Sans SC R${num}`,
            boldFamily: `Noto Sans SC B${num}`,
            file,
            ranges: parseUnicodeRange(range),
          });
        }
      }

      const avatarBuf = await readFile(
        resolve(process.cwd(), 'public/brand/lowendaff-avatar.jpg'),
      );
      const avatarDataUri = `data:image/jpeg;base64,${avatarBuf.toString('base64')}`;

      return {
        baseBuffers,
        interRegAdvance,
        interBoldAdvance,
        monoAdvance,
        notoDir,
        notoSlices,
        avatarDataUri,
      };
    })();
  }
  return runtimePromise;
}

function renameSliceFamily(sfntBuf: Buffer, tag4: string): Uint8Array {
  return replaceUtf16Names(sfntBuf, [
    ['Noto Sans SC Thin', `Noto Sans SC ${tag4}`],
    ['NotoSansSC-Thin', `NotoSansSC-${tag4}`],
  ]);
}

interface TextLineSpec {
  x: number;
  y: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fill: string;
  textAnchor?: 'start' | 'middle' | 'end';
  text: string;
}

async function fontResourcesForText(text: string): Promise<{
  fontBuffers: Uint8Array[];
  drawTextLine: (spec: TextLineSpec) => string;
}> {
  const assets = await getRuntimeAssets();
  const codePoints = new Set<number>();
  for (const ch of `${text}|`) {
    const cp = ch.codePointAt(0);
    if (cp && cp >= 32) codePoints.add(cp);
  }
  const chars = [...codePoints];
  const nonLatinChars = chars.filter(
    (cp) => cp > 0x7f && assets.interRegAdvance(cp) === 0,
  );
  const neededSlices = assets.notoSlices.filter((slice) =>
    nonLatinChars.some((cp) =>
      slice.ranges.some(([start, end]) => cp >= start && cp <= end),
    ),
  );

  const sliceEntries = await Promise.all(
    neededSlices.map((slice) => {
      let cached = sliceCache.get(slice.file);
      if (!cached) {
        cached = (async () => {
          const woff = await readFile(resolve(assets.notoDir, slice.file));
          const sliceCharset = buildCharset(slice.ranges);
          const [regSfnt, boldSfnt] = await Promise.all([
            subsetFont(woff, sliceCharset, {
              targetFormat: 'sfnt',
              variationAxes: { wght: 450 },
            }),
            subsetFont(woff, sliceCharset, {
              targetFormat: 'sfnt',
              variationAxes: { wght: 700 },
            }),
          ]);
          return {
            regBuffer: renameSliceFamily(regSfnt, `R${slice.tag}`),
            boldBuffer: renameSliceFamily(boldSfnt, `B${slice.tag}`),
            regAdvance: parseSfntMetrics(regSfnt),
            boldAdvance: parseSfntMetrics(boldSfnt),
          };
        })();
        sliceCache.set(slice.file, cached);
      }
      return cached;
    }),
  );

  const fontBuffers = [
    ...assets.baseBuffers.map((b) => new Uint8Array(b)),
    ...sliceEntries.flatMap((e) => [e.regBuffer, e.boldBuffer]),
  ];

  const sliceByCp = new Map<
    number,
    {
      regFamily: string;
      boldFamily: string;
      regAdvance: (cp: number) => number;
      boldAdvance: (cp: number) => number;
    }
  >();
  for (const cp of nonLatinChars) {
    const idx = neededSlices.findIndex((slice) =>
      slice.ranges.some(([start, end]) => cp >= start && cp <= end),
    );
    if (idx >= 0) {
      sliceByCp.set(cp, {
        regFamily: neededSlices[idx].regFamily,
        boldFamily: neededSlices[idx].boldFamily,
        regAdvance: sliceEntries[idx].regAdvance,
        boldAdvance: sliceEntries[idx].boldAdvance,
      });
    }
  }

  const splitRuns = (line: string, isBold: boolean) => {
    const runs: Array<{
      family?: string;
      isCjk: boolean;
      advance?: (cp: number) => number;
      text: string;
    }> = [];
    for (const ch of line) {
      const cp = ch.codePointAt(0) ?? 0;
      const hit = cp > 0x7f ? sliceByCp.get(cp) : undefined;
      const family = hit
        ? isBold
          ? hit.boldFamily
          : hit.regFamily
        : undefined;
      const advance = hit
        ? isBold
          ? hit.boldAdvance
          : hit.regAdvance
        : undefined;
      const last = runs.at(-1);
      if (last && last.family === family) last.text += ch;
      else runs.push({ family, isCjk: Boolean(hit), advance, text: ch });
    }
    return runs;
  };

  const measureTextEm = (
    str: string,
    advFn: (cp: number) => number,
  ): number => {
    let total = 0;
    for (const ch of str) {
      const cp = ch.codePointAt(0) ?? 32;
      const adv = advFn(cp);
      total += adv || (cp === 32 ? 0.28 : cp > 0x7f ? 1 : 0.52);
    }
    return total;
  };

  const needsPanguGap = (prevText: string, nextText: string): boolean => {
    const prevLast = prevText.at(-1) ?? '';
    const nextFirst = nextText[0] ?? '';
    if (!prevLast || !nextFirst) return false;
    if (/[\s（《「【(·/+-]/.test(prevLast)) return false;
    if (/[\s，。、；：！？）》」】.,:;!?)…·/%+-]/.test(nextFirst)) return false;
    return true;
  };

  const drawTextLine = (spec: TextLineSpec): string => {
    const isBold = spec.fontWeight >= 600;
    const isMono = spec.fontFamily.startsWith('JetBrains Mono');
    const baseLatinFamily = isMono
      ? 'JetBrains Mono'
      : isBold
        ? 'IntBd'
        : 'IntRg';
    const baseLatinAdv = isMono
      ? assets.monoAdvance
      : isBold
        ? assets.interBoldAdvance
        : assets.interRegAdvance;

    const runs = splitRuns(spec.text, isBold);
    if (runs.length <= 1) {
      const one = runs[0];
      const fam = one?.family ?? baseLatinFamily;
      const anchorAttr = spec.textAnchor
        ? ` text-anchor="${spec.textAnchor}"`
        : '';
      return `<text x="${spec.x}" y="${spec.y}"${anchorAttr} font-family="${fam}" font-size="${spec.fontSize}" font-weight="${spec.fontWeight}" fill="${spec.fill}">${escapeXmlText(one?.text ?? '')}</text>`;
    }

    const segments = runs.map((r, idx) => {
      const advFn = r.advance ?? baseLatinAdv;
      const leadSpaces = r.text.match(/^ +/)?.[0] ?? '';
      const leadPx = measureTextEm(leadSpaces, advFn) * spec.fontSize;
      const widthPx = measureTextEm(r.text, advFn) * spec.fontSize;
      const next = runs[idx + 1];
      const gapAfterPx =
        next && r.isCjk !== next.isCjk && needsPanguGap(r.text, next.text)
          ? spec.fontSize * 0.12
          : 0;
      return {
        fam: r.family ?? baseLatinFamily,
        trimmed: r.text.trim(),
        leadPx,
        widthPx,
        gapAfterPx,
      };
    });

    const totalWidth = segments.reduce(
      (sum, s) => sum + s.widthPx + s.gapAfterPx,
      0,
    );
    let cursorX =
      spec.textAnchor === 'middle'
        ? spec.x - totalWidth / 2
        : spec.textAnchor === 'end'
          ? spec.x - totalWidth
          : spec.x;

    const out: string[] = [];
    for (const seg of segments) {
      const drawX = cursorX + seg.leadPx;
      cursorX += seg.widthPx + seg.gapAfterPx;
      if (!seg.trimmed) continue;
      out.push(
        `<text x="${drawX.toFixed(2)}" y="${spec.y}" font-family="${seg.fam}" font-size="${spec.fontSize}" font-weight="${spec.fontWeight}" fill="${spec.fill}">${escapeXmlText(seg.trimmed)}</text>`,
      );
    }
    return out.join('\n  ');
  };

  return { fontBuffers, drawTextLine };
}

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function charUnits(ch: string): number {
  const cp = ch.codePointAt(0) ?? 0;
  if (cp <= 0x7f) {
    if (ch === ' ') return 0.32;
    if (/[A-ZMW@#%&]/.test(ch)) return 0.68;
    if (/[il1.,:;!|/'`()-]/.test(ch)) return 0.34;
    return 0.56;
  }
  // Strip emoji variation selectors or zero-width joiners
  if (cp === 0xfe0f || cp === 0x200d) return 0;
  return 1.02;
}

function cleanDisplayText(input: string): string {
  return input
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function wrapOgText(
  raw: string,
  maxUnitsPerLine: number,
  maxLines: number,
): string[] {
  const text = cleanDisplayText(raw);
  if (!text) return [];
  const tokens =
    text.match(
      /(?:[A-Za-z0-9._+$%/-]+|[^\s])[，。、；：！？）》」】.,:;!?)%]*|\s+|./gu,
    ) ?? [];
  const lines: string[] = [];
  let current = '';
  let units = 0;

  for (let idx = 0; idx < tokens.length; idx++) {
    const tok = tokens[idx];
    if (!current && /^\s+$/.test(tok)) continue;
    const tokUnits = [...tok].reduce((sum, ch) => sum + charUnits(ch), 0);
    if (units + tokUnits <= maxUnitsPerLine || !current) {
      current += tok;
      units += tokUnits;
      continue;
    }
    if (lines.length === maxLines - 1) {
      let trimmed = current.trimEnd();
      while (
        trimmed.length > 1 &&
        [...trimmed].reduce((s, c) => s + charUnits(c), 0) >
          maxUnitsPerLine - 1.1
      ) {
        trimmed = trimmed.slice(0, -1).trimEnd();
      }
      lines.push(`${trimmed}…`);
      return lines;
    }
    lines.push(current.trimEnd());
    current = /^\s+$/.test(tok) ? '' : tok;
    units = current ? tokUnits : 0;
  }
  if (current.trim()) lines.push(current.trimEnd());
  return lines.slice(0, maxLines);
}

function flagSvgMarkup(countryCode: string | undefined, x: number, y: number) {
  const normalized = (countryCode ?? '').trim().toLowerCase();
  const aliases: Record<string, string> = { uk: 'gb-ukm', gb: 'gb-ukm' };
  const key = aliases[normalized] ?? normalized;
  const flag =
    key && key !== 'unspecified'
      ? (flagpack.icons as Record<string, { body: string }>)[key]
      : undefined;
  if (!flag) return '';
  const namespaced = flag.body
    .replace(/\bid="([^"]+)"/g, 'id="ogf-$1"')
    .replace(/url\(#([^)]+)\)/g, 'url(#ogf-$1)')
    .replace(/href="#([^"]+)"/g, 'href="#ogf-$1"');
  return `
    <g transform="translate(${x}, ${y})">
      <clipPath id="og-flag-clip">
        <rect x="0" y="0" width="36" height="27" rx="5" />
      </clipPath>
      <g clip-path="url(#og-flag-clip)">
        <svg x="0" y="0" width="36" height="27" viewBox="0 0 ${flagpack.width ?? 32} ${flagpack.height ?? 24}">
          ${namespaced}
        </svg>
      </g>
      <rect x="0.5" y="0.5" width="35" height="26" rx="4.5" fill="none" stroke="rgba(25,25,24,0.14)" stroke-width="1" />
    </g>
  `;
}

async function svgToPng(
  buildSvg: (
    sansStack: string,
    monoStack: string,
    drawTextLine: (spec: TextLineSpec) => string,
  ) => string,
  allText: string,
): Promise<Uint8Array> {
  const { fontBuffers, drawTextLine } = await fontResourcesForText(allText);
  const sansStack = 'IntRg';
  const monoStack = 'JetBrains Mono';
  const svg = buildSvg(sansStack, monoStack, drawTextLine);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: OG_WIDTH },
    font: {
      loadSystemFonts: false,
      fontBuffers,
      defaultFontFamily: 'IntRg',
      sansSerifFamily: 'IntRg',
      monospaceFamily: 'JetBrains Mono',
    },
  });
  try {
    const rendered = resvg.render();
    try {
      return new Uint8Array(rendered.asPng());
    } finally {
      rendered.free();
    }
  } finally {
    resvg.free();
  }
}

export interface ReviewOgInput {
  title: string;
  description: string;
  verdict?: string;
  vendor: string;
  country?: string;
  location: string;
  reviewType: ReviewType;
  publishedAt: string;
  testedAt?: string;
  price?: string;
}

export async function renderReviewOgPng(
  input: ReviewOgInput,
): Promise<Uint8Array> {
  const { avatarDataUri } = await getRuntimeAssets();
  const typeLabel = `${reviewTypeLabels[input.reviewType]} 实测记录`;
  const cleanTitle = input.title.replace(
    /^(?:\p{Regional_Indicator}{2}\s*)+/u,
    '',
  );
  const displayTitle = cleanTitle.endsWith('测试记录')
    ? cleanTitle
    : `${cleanTitle} ${reviewTypeLabels[input.reviewType]} 测试记录`;

  const titleUnits = [...displayTitle].reduce((s, c) => s + charUnits(c), 0);
  const titleFontSize = titleUnits > 20.5 ? 40 : 44;
  const maxTitleUnits = titleFontSize === 40 ? 24.5 : 22;
  const titleLines = wrapOgText(displayTitle, maxTitleUnits, 2);
  const summarySource = input.verdict?.trim() || input.description;
  const summaryLines = wrapOgText(summarySource, 41, 2);

  const eyebrow = `${input.location} · ${input.vendor}`;
  const dateMetric = input.testedAt
    ? input.testedAt.replace(/\s+CST$/, '')
    : input.publishedAt;
  const priceOrType = input.price
    ? `参考价 ${input.price}`
    : `类型 ${reviewTypeLabels[input.reviewType]}`;

  const pillBg = input.reviewType === 'dedicated' ? '#f3f1ee' : '#eef6fe';
  const pillBorder = input.reviewType === 'dedicated' ? '#dad6cf' : '#c5dff8';
  const pillText = input.reviewType === 'dedicated' ? '#31302e' : '#005bab';

  const hasFlag = Boolean(flagSvgMarkup(input.country, 0, 0));
  const eyebrowX = hasFlag ? 142 : 94;
  const titleStartY = 236;
  const titleLineStep = 58;
  const calloutY = titleStartY + (titleLines.length - 1) * titleLineStep + 34;
  const calloutHeight = summaryLines.length > 1 ? 104 : 72;

  const allText = [
    'LowEndAFF',
    '全球服务器独立测评手记',
    typeLabel,
    eyebrow,
    ...titleLines,
    ...summaryLines,
    priceOrType,
    `实测采样 ${dateMetric}`,
    'lowendaff.com',
    '…·',
  ].join(' ');

  return svgToPng(
    (
      fontStack,
      monoStack,
      drawTextLine,
    ) => `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <defs>
    <clipPath id="card-clip">
      <rect x="44" y="38" width="1112" height="554" rx="20" />
    </clipPath>
    <clipPath id="avatar-clip">
      <rect x="94" y="80" width="40" height="40" rx="9" />
    </clipPath>
  </defs>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="#f6f5f4" />
  <g stroke="#eceae5" stroke-width="1">
    <line x1="0" y1="126" x2="1200" y2="126" />
    <line x1="0" y1="504" x2="1200" y2="504" />
    <line x1="180" y1="0" x2="180" y2="630" />
    <line x1="1020" y1="0" x2="1020" y2="630" />
  </g>
  <rect x="44" y="38" width="1112" height="554" rx="20" fill="#ffffff" stroke="#e2e0db" stroke-width="1.5" />
  <g clip-path="url(#card-clip)">
    <rect x="44" y="38" width="1112" height="5" fill="#0075de" />
  </g>

  <image href="${avatarDataUri}" x="94" y="80" width="40" height="40" clip-path="url(#avatar-clip)" />
  <rect x="94" y="80" width="40" height="40" rx="9" fill="none" stroke="rgba(25,25,24,0.12)" stroke-width="1" />
  ${drawTextLine({ x: 148, y: 106, fontFamily: fontStack, fontSize: 22, fontWeight: 700, fill: '#191918', text: 'LowEndAFF' })}
  ${drawTextLine({ x: 288, y: 106, fontFamily: fontStack, fontSize: 18, fontWeight: 500, fill: '#78746f', text: '·   全球服务器独立测评手记' })}

  <rect x="936" y="80" width="170" height="38" rx="19" fill="${pillBg}" stroke="${pillBorder}" stroke-width="1" />
  ${drawTextLine({ x: 1021, y: 105, textAnchor: 'middle', fontFamily: fontStack, fontSize: 16, fontWeight: 600, fill: pillText, text: typeLabel })}

  <line x1="94" y1="142" x2="1106" y2="142" stroke="#eeece7" stroke-width="1" />

  ${flagSvgMarkup(input.country, 94, 165)}
  ${drawTextLine({ x: eyebrowX, y: 186, fontFamily: fontStack, fontSize: 21, fontWeight: 600, fill: '#0075de', text: eyebrow })}

  ${titleLines
    .map((line, idx) =>
      drawTextLine({
        x: 94,
        y: titleStartY + idx * titleLineStep,
        fontFamily: fontStack,
        fontSize: titleFontSize,
        fontWeight: 700,
        fill: '#191918',
        text: line,
      }),
    )
    .join('\n  ')}

  <rect x="94" y="${calloutY}" width="1012" height="${calloutHeight}" rx="10" fill="#f8f7f5" />
  <rect x="94" y="${calloutY}" width="4" height="${calloutHeight}" rx="2" fill="#0075de" />
  ${summaryLines
    .map((line, idx) =>
      drawTextLine({
        x: 116,
        y: calloutY + 36 + idx * 34,
        fontFamily: fontStack,
        fontSize: 21.5,
        fontWeight: 400,
        fill: '#46433f',
        text: line,
      }),
    )
    .join('\n  ')}

  <line x1="94" y1="510" x2="1106" y2="510" stroke="#eeece7" stroke-width="1" />
  ${drawTextLine({ x: 94, y: 550, fontFamily: monoStack, fontSize: 18, fontWeight: 500, fill: '#57534e', text: `${priceOrType}   ·   实测采样 ${dateMetric}` })}
  ${drawTextLine({ x: 1106, y: 550, textAnchor: 'end', fontFamily: monoStack, fontSize: 18, fontWeight: 600, fill: '#191918', text: 'lowendaff.com' })}
</svg>`,
    allText,
  );
}

export async function renderDefaultOgPng(): Promise<Uint8Array> {
  const { avatarDataUri } = await getRuntimeAssets();

  const headline1 = '我们评测全世界，';
  const headline2 = '让每一次选择都有依据。';
  const sub1 =
    '基于真实机器与可复现脚本，诚实记录全球 VPS 与独立服务器的硬件基准跑分、';
  const sub2 =
    '虚拟化 %st/%si 争抢曲线、原生流媒体解锁、BGP 拓扑与全国三网回程路由。';
  const footerMeta =
    '硬件性能基准  ·  原生流媒体解锁  ·  全国三网回程  ·  奇葩小国图鉴';

  const allText = [
    'LowEndAFF',
    '全球服务器独立测评手记',
    '独立实测档案库',
    headline1,
    headline2,
    sub1,
    sub2,
    footerMeta,
    'lowendaff.com',
    '·',
  ].join(' ');

  return svgToPng(
    (
      fontStack,
      monoStack,
      drawTextLine,
    ) => `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <defs>
    <clipPath id="card-clip">
      <rect x="44" y="38" width="1112" height="554" rx="20" />
    </clipPath>
    <clipPath id="avatar-clip">
      <rect x="94" y="82" width="44" height="44" rx="10" />
    </clipPath>
  </defs>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="#f6f5f4" />
  <g stroke="#eceae5" stroke-width="1">
    <line x1="0" y1="126" x2="1200" y2="126" />
    <line x1="0" y1="504" x2="1200" y2="504" />
    <line x1="180" y1="0" x2="180" y2="630" />
    <line x1="1020" y1="0" x2="1020" y2="630" />
  </g>
  <rect x="44" y="38" width="1112" height="554" rx="20" fill="#ffffff" stroke="#e2e0db" stroke-width="1.5" />
  <g clip-path="url(#card-clip)">
    <rect x="44" y="38" width="1112" height="5" fill="#0075de" />
  </g>

  <image href="${avatarDataUri}" x="94" y="82" width="44" height="44" clip-path="url(#avatar-clip)" />
  <rect x="94" y="82" width="44" height="44" rx="10" fill="none" stroke="rgba(25,25,24,0.12)" stroke-width="1" />
  ${drawTextLine({ x: 152, y: 111, fontFamily: fontStack, fontSize: 24, fontWeight: 700, fill: '#191918', text: 'LowEndAFF' })}
  ${drawTextLine({ x: 304, y: 111, fontFamily: fontStack, fontSize: 18.5, fontWeight: 500, fill: '#78746f', text: '·   全球服务器独立测评手记' })}

  <rect x="936" y="84" width="170" height="38" rx="19" fill="#eef6fe" stroke="#c5dff8" stroke-width="1" />
  ${drawTextLine({ x: 1021, y: 109, textAnchor: 'middle', fontFamily: fontStack, fontSize: 16, fontWeight: 600, fill: '#005bab', text: '独立实测档案库' })}

  <line x1="94" y1="148" x2="1106" y2="148" stroke="#eeece7" stroke-width="1" />

  ${drawTextLine({ x: 94, y: 236, fontFamily: fontStack, fontSize: 52, fontWeight: 700, fill: '#191918', text: headline1 })}
  ${drawTextLine({ x: 94, y: 304, fontFamily: fontStack, fontSize: 52, fontWeight: 700, fill: '#0075de', text: headline2 })}

  <rect x="94" y="346" width="1012" height="108" rx="12" fill="#f8f7f5" />
  <rect x="94" y="346" width="4" height="108" rx="2" fill="#0075de" />
  ${drawTextLine({ x: 118, y: 390, fontFamily: fontStack, fontSize: 22.5, fontWeight: 400, fill: '#46433f', text: sub1 })}
  ${drawTextLine({ x: 118, y: 428, fontFamily: fontStack, fontSize: 22.5, fontWeight: 400, fill: '#46433f', text: sub2 })}

  <line x1="94" y1="506" x2="1106" y2="506" stroke="#eeece7" stroke-width="1" />
  ${drawTextLine({ x: 94, y: 548, fontFamily: fontStack, fontSize: 18, fontWeight: 500, fill: '#57534e', text: footerMeta })}
  ${drawTextLine({ x: 1106, y: 548, textAnchor: 'end', fontFamily: monoStack, fontSize: 18.5, fontWeight: 600, fill: '#191918', text: 'lowendaff.com' })}
</svg>`,
    allText,
  );
}
