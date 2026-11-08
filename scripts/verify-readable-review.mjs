import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseReadableReview } from '../src/lib/readable-review.ts';

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
