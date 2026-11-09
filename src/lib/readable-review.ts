import { createHash } from 'node:crypto';
import { z } from 'astro/zod';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { toString } from 'mdast-util-to-string';
import type { Root, RootContent, Paragraph } from 'mdast';
import type { Root as HtmlRoot, Element } from 'hast';

const identifier = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const compatibilitySchema = z.object({
  sections: z.record(z.string(), identifier).default({}),
  tables: z.record(z.string(), identifier).default({}),
  anchors: z.record(z.string(), z.string()).default({}),
});
export const reviewImagesSchema = z.record(
  z.string(),
  z.object({
    local: z.string().startsWith('/archive-assets/').nullable(),
    provenance: z.string(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  }),
);
const optionsSchema = z.object({
  format: z.literal('review-markdown'),
  recordId: identifier.optional(),
  archiveSnapshot: z.url().optional(),
  purchaseUrl: z.url().optional(),
  compatibility: compatibilitySchema.optional(),
  images: reviewImagesSchema.optional(),
});
type Block =
  | { type: 'heading'; level: number; text: string; line: number }
  | { type: 'paragraph' | 'quote'; html: string; line: number }
  | {
      type: 'code';
      id: string;
      headings: string[];
      text: string;
      language: string;
      line: number;
    }
  | {
      type: 'image';
      src: string;
      alt: string;
      line: number;
      asset?: z.infer<typeof reviewImagesSchema>[string];
    }
  | {
      type: 'table';
      id: string;
      headings: string[];
      headers: string[];
      rows: string[][];
      line: number;
    };
type Section = {
  id: string;
  title: string;
  level: number;
  line: number;
  blocks: Block[];
};
const parser = unified().use(remarkParse).use(remarkGfm);
const htmlProcessor = unified().use(remarkRehype).use(rehypeStringify);

/** Pure conversion: authored Markdown becomes the existing, validated review model. */
export function parseReadableReview(
  source: string,
  raw: Record<string, unknown>,
  id: string,
  file = id,
) {
  const options = optionsSchema.parse(raw);
  if (raw.review !== undefined)
    throw new Error(`${file}: review-markdown cannot also define review data`);
  const frontmatter = source.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) throw new Error(`${file}: missing frontmatter`);
  const offset = frontmatter[0].split('\n').length - 1;
  const body = source.slice(frontmatter[0].length);
  const tree = parser.parse(body);
  const key = options.recordId ?? id;
  const sections: Section[] = [];
  let current: Section | undefined;
  let headings: string[] = [];
  const occurrences = new Map<string, number>();
  const fail = (node: RootContent, message: string): never => {
    throw new Error(
      `${file}:${offset + (node.position?.start.line ?? 1)}: ${message}`,
    );
  };
  const stableId = (kind: string, path: string) =>
    `${key}-${kind}-${createHash('sha256').update(path).digest('hex').slice(0, 16)}`;
  const inlineHtml = (node: Paragraph) => {
    const root: Root = { type: 'root', children: [node] };
    const html = htmlProcessor.runSync(root) as HtmlRoot;
    const visit = (parent: HtmlRoot | Element) => {
      for (const child of parent.children) {
        if (child.type !== 'element') continue;
        if (child.tagName === 'a') {
          const href = String(child.properties.href ?? '');
          if (/^https?:\/\//.test(href)) {
            child.properties.target = '_blank';
            child.properties.rel = [
              'noopener',
              'noreferrer',
              ...(href === options.purchaseUrl ? ['sponsored'] : []),
            ];
          } else if (
            !href.startsWith('#') &&
            !href.startsWith('/') &&
            !href.startsWith('mailto:')
          ) {
            fail(
              node,
              'Links must use HTTP(S), mailto, a root-relative path, or an anchor',
            );
          }
        }
        visit(child);
      }
    };
    visit(html);
    return htmlProcessor
      .stringify(html)
      .replace(/^<p>/, '')
      .replace(/<\/p>$/, '');
  };
  const checkInline = (node: RootContent) => {
    const walk = (value: { type: string; children?: unknown[] }) => {
      if (
        [
          'html',
          'image',
          'imageReference',
          'linkReference',
          'footnoteReference',
        ].includes(value.type)
      )
        fail(
          node,
          `Unsupported inline ${value.type}; use Markdown text, emphasis, code or explicit links`,
        );
      for (const child of value.children ?? []) walk(child as typeof value);
    };
    walk(node);
  };
  for (const node of tree.children) {
    const line = offset + (node.position?.start.line ?? 1);
    if (node.type === 'heading' && node.depth <= 2) {
      const title = toString(node);
      if (sections.some((s) => s.title === title))
        fail(node, `Duplicate section: ${title}`);
      current = {
        id:
          options.compatibility?.sections[title] ?? stableId('section', title),
        title,
        level: node.depth,
        line,
        blocks: [],
      };
      sections.push(current);
      headings = [];
      continue;
    }
    if (!current)
      fail(node, 'Start review content with a level 1 or 2 section heading');
    const section = current!;
    if (node.type === 'heading') {
      if (node.depth > 4 || (node.depth === 4 && !headings[0]))
        fail(
          node,
          'Use level 3 groups followed by optional level 4 test names',
        );
      const text = toString(node);
      headings[node.depth - 3] = text;
      headings.length = node.depth - 2;
      section.blocks.push({ type: 'heading', level: node.depth, text, line });
    } else if (node.type === 'table') {
      const rows = node.children.map((row) =>
        row.children.map((cell) => toString(cell)),
      );
      const headers = rows.shift()!;
      if (rows.some((row) => row.length !== headers.length))
        fail(node, 'Each row must match the table header width');
      const path = [section.title, ...headings].join(' / ');
      const occurrence = (occurrences.get(path) ?? 0) + 1;
      occurrences.set(path, occurrence);
      const tableKey = occurrence === 1 ? path : `${path} / #${occurrence}`;
      section.blocks.push({
        type: 'table',
        id:
          options.compatibility?.tables[tableKey] ??
          stableId('table', tableKey),
        headings: [...headings],
        headers,
        rows,
        line,
      });
    } else if (node.type === 'code') {
      const path = [section.title, ...headings, 'code'].join(' / ');
      const occurrence = (occurrences.get(path) ?? 0) + 1;
      occurrences.set(path, occurrence);
      section.blocks.push({
        type: 'code',
        id: stableId('code', `${path} / #${occurrence}`),
        headings: [...headings],
        text: node.value,
        language: node.lang ?? 'text',
        line,
      });
    } else if (
      node.type === 'paragraph' &&
      node.children.length === 1 &&
      node.children[0].type === 'image'
    ) {
      const image = node.children[0];
      section.blocks.push({
        type: 'image',
        src: image.url,
        alt: image.alt ?? '',
        asset: options.images?.[image.url],
        line,
      });
    } else if (node.type === 'paragraph') {
      checkInline(node);
      section.blocks.push({ type: 'paragraph', html: inlineHtml(node), line });
    } else if (
      node.type === 'blockquote' &&
      node.children.length === 1 &&
      node.children[0].type === 'paragraph'
    ) {
      checkInline(node);
      section.blocks.push({
        type: 'quote',
        html: inlineHtml(node.children[0]),
        line,
      });
    } else {
      fail(
        node,
        `Unsupported review block: ${node.type}; no content was silently discarded`,
      );
    }
  }
  return {
    id: key,
    source: options.archiveSnapshot,
    legacyAnchors: options.compatibility?.anchors ?? {},
    sections,
  };
}
