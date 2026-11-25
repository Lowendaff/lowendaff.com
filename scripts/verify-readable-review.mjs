import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseReadableReview } from '../src/lib/readable-review.ts';
import { compactRouteHops } from '../src/lib/route-hops.ts';

const options = {
  format: 'review-markdown',
  archiveSnapshot: 'https://example.com/source',
};
const convert = (body, extra = {}) =>
  parseReadableReview(
    `---\nformat: review-markdown\n---\n\n${body}\n`,
    { ...options, ...extra },
    'fixture',
    'fixture.mdx',
  );
const table = '| Name | Result |\n| --- | --- |\n| Alpha | N/A |';

test('route display merges only adjacent, fully unanswered TTLs within a destination', () => {
  const headers = ['跳数', 'IP', 'RTT 1', 'RTT 2'];
  const rows = [
    ['1', '无应答', '—', '—'],
    ['2', '*', '*', '*'],
    ['3', '192.0.*.*', '*', '0 ms'],
    ['4', '超时', '', ''],
    ['6', '–', '–', '–'],
    ['7', '–', '–', '–'],
    ['7', '203.0.113.7', '9 ms', '*'],
    ['8', '', '', ''],
    ['9', '*', '*', '*'],
    ['10', '*', '*', '*'],
  ];
  const original = structuredClone(rows);
  assert.deepEqual(compactRouteHops(headers, rows), [
    { first: 1, last: 2 },
    rows[2],
    { first: 4, last: 4 },
    { first: 6, last: 6 },
    { first: 7, last: 7 },
    rows[6],
    rows[7],
    { first: 9, last: 10 },
  ]);
  assert.deepEqual(rows, original);
  assert.deepEqual(compactRouteHops(['节点', ...headers.slice(1)], rows), rows);
});

test('GFM cells preserve escaped pipes, literal formatting, entities and missing-data states', () => {
  const review = convert(
    '## System\n\n| Name | Value |\n| --- | --- |\n| a\\|b | &#123;value&#125; |\n| \\*literal\\* | busy |\n| Empty | |',
  );
  assert.deepEqual(review.sections[0].blocks[0].rows, [
    ['a|b', '{value}'],
    ['*literal*', 'busy'],
    ['Empty', ''],
  ]);
});
test('paragraphs, links, quotes and images stay structured without author HTML', () => {
  const review = convert(
    '## Buy\n\n[Buy](https://example.com/buy) and **bold**.\n\n> Keep `N/A`.\n\n![Graph](https://example.com/graph.png)',
    { purchaseUrl: 'https://example.com/buy' },
  );
  const blocks = review.sections[0].blocks;
  assert.match(blocks[0].html, /rel="noopener noreferrer sponsored"/);
  assert.match(blocks[0].html, /<strong>bold<\/strong>/);
  assert.equal(blocks[1].html, 'Keep <code>N/A</code>.');
  assert.equal(blocks[2].type, 'image');
});
test('stable IDs survive edits and insertion of an unrelated preceding section', () => {
  const first = convert(`## System\n\n${table}`).sections[0];
  const updated = convert(
    `## Other\n\n${table}\n\n## System\n\n${table.replace('N/A', 'changed')}`,
  ).sections[1];
  assert.equal(first.id, updated.id);
  assert.equal(first.blocks[0].id, updated.blocks[0].id);
});
test('third and fourth level headings retain group semantics and reset between sections', () => {
  const review = convert(
    `## Unlock\n\n### IPv4\n\n#### AIGC\n\n${table}\n\n#### Multination\n\n${table}\n\n## System\n\n${table}`,
  );
  assert.deepEqual(
    review.sections[0].blocks
      .filter((b) => b.type === 'table')
      .map((b) => b.headings),
    [
      ['IPv4', 'AIGC'],
      ['IPv4', 'Multination'],
    ],
  );
  assert.deepEqual(review.sections[1].blocks[0].headings, []);
});
for (const row of ['| missing |', '| extra | value | third |']) {
  test(`reject ragged table: ${row}`, () => {
    assert.throws(
      () => convert(`## System\n\n| Name | Value |\n| --- | --- |\n${row}`),
      /fixture\.mdx:\d+:.*header width/,
    );
  });
}
test('ambiguous headings and unsupported blocks fail with a file and line', () => {
  for (const body of [
    'Before heading',
    '## System\n\n#### Skipped group',
    '## System\n\n## System',
    '## System\n\n<div>HTML</div>',
    '## System\n\n- unsupported list',
  ])
    assert.throws(() => convert(body), /fixture\.mdx:\d+:/);
});
test('unsafe links and competing data sources are rejected', () => {
  assert.throws(
    () => convert('## Buy\n\n[Bad](javascript:alert)'),
    /Links must/,
  );
  assert.throws(
    () => convert(`## System\n\n${table}`, { review: {} }),
    /cannot also define review/,
  );
});

test('raw output preserves indentation and markup without interpreting it as MDX', () => {
  const output = 'Device: /dev/sda\n  RAW: {value} <script> & 100%';
  const review = convert(
    '## 磁盘性能测试\n\n### SMART\n\n```text\n' + output + '\n```',
  );
  const block = review.sections[0].blocks.at(-1);
  assert.equal(block.type, 'code');
  assert.equal(block.text, output);
  assert.equal(block.language, 'text');
  assert.deepEqual(block.headings, ['SMART']);
});

test('new reviews need no invented archive source and keep local image paths', () => {
  const review = convert(
    '## 系统信息\n\n![Hardware topology](/archive-assets/example/topology.png)',
    { archiveSnapshot: undefined },
  );
  assert.equal(review.source, undefined);
  assert.equal(
    review.sections[0].blocks[0].src,
    '/archive-assets/example/topology.png',
  );
});

test('standalone Bilibili links and BV IDs become videos, preserving parts and author labels', () => {
  const bvid = 'BV1P3411W7dj';
  const direct = 'https://www.bilibili.com/video/' + bvid + '/';
  const { blocks } = convert(
    '## 评\n\n' +
      direct +
      '?p=2&spm_id_from=333\n\n[线路实录](https://m.bilibili.com/video/' +
      bvid +
      ')\n\n' +
      bvid,
  ).sections[0];
  assert.deepEqual(
    blocks.map(({ type, src, text }) => [type, src, text]),
    [
      ['bilibili', direct + '?p=2', undefined],
      ['bilibili', direct, '线路实录'],
      ['bilibili', direct, undefined],
    ],
  );
});

test('prose, code, short links and lookalike URLs never become embeds', () => {
  const path = '/video/BV1P3411W7dj/';
  const full = 'https://www.bilibili.com' + path;
  for (const prose of [
    '另见 [视频](' + full + ')。',
    '`' + full + '`',
    'https://b23.tv/test',
    'https://www.bilibili.com.example.org' + path,
    'https://www.bilibili.com@other.example' + path,
    'https://other@www.bilibili.com' + path,
    full + '?p=0',
    full + '?p=1&p=2',
    full.replace('BV1P3411W7dj', 'invalid'),
    full.replace('https:', 'http:'),
  ])
    assert.equal(
      convert('## 评\n\n' + prose).sections[0].blocks[0].type,
      'paragraph',
      prose,
    );
});
