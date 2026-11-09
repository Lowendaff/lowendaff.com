import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { parse } from 'yaml';

const root = new URL('../', import.meta.url);
const created = [];
const file = (path) => new URL(path, root);
const read = (path) => readFile(file(path), 'utf8');
const build = () =>
  execFileSync('npm', ['run', 'build'], {
    cwd: root,
    env: { ...process.env, PUBLIC_SITE_INDEXABLE: 'false' },
    stdio: 'pipe',
    maxBuffer: 8 * 1024 * 1024,
  });
async function add(name, body, includeUrl = true) {
  const path = file(`src/content/posts/template-check-${name}.mdx`);
  if (includeUrl && !/^permalink:/m.test(body))
    body = body.replace(
      /^---\n/,
      `---\npermalink: '/reviews/template-check-${name}-20261108/'\n`,
    );
  await writeFile(path, body, { flag: 'wx' });
  created.push(path);
  return path;
}
async function rejectsArticle(name, body, expected, includeUrl = true) {
  const path = await add(name, body, includeUrl);
  try {
    assert.throws(build, (error) => {
      const output = String(error.stdout) + String(error.stderr);
      assert.match(output, new RegExp(`template-check-${name}`));
      assert.match(output, expected);
      return true;
    });
    console.log(`PASS: rejected ${name} with a source diagnostic.`);
  } finally {
    await unlink(path);
    created.splice(created.indexOf(path), 1);
  }
}
try {
  for (const name of ['vps', 'dedicated-server']) {
    const template = await read(`templates/reviews/${name}.mdx`);
    assert.equal(parse(template.split('---')[1]).draft, true);
    await add(name, template.replace('draft: true', 'draft: false'));
    await add(`${name}-draft`, template);
  }
  const dedicated = await read('templates/reviews/dedicated-server.mdx');
  const header = dedicated
    .slice(0, dedicated.indexOf('\n## 买'))
    .replace('draft: true', 'draft: false')
    .replace(
      "title: '待填写商家与地区 独立服务器测试记录'",
      "title: 'Template minimal dedicated'",
    );
  await add(
    'minimal',
    `${header}\n## 系统信息\n\n### dmidecode\n\n\`\`\`text\nRAW_TEMPLATE_SENTINEL <script>alert(1)</script> {unexecuted}\n\`\`\`\n`,
  );
  await add(
    'raw-network',
    `${header}\n## 服务解锁测试\n\n### IPv6\n\n#### AIGC\n\n\`\`\`text\nRAW_UNLOCK_SENTINEL\n\`\`\`\n\n## 路由追踪\n\n### 中国境内目标\n\n#### 北京电信 (IPv6)\n\n\`\`\`text\nRAW_ROUTE_SENTINEL\n\`\`\`\n`,
  );
  // Missing image is tested as rendering syntax only, never shipped as an article.
  await add(
    'images',
    `${header}\n## 系统信息\n\n![Topology](/archive-assets/template-check-topology.png)\n\n## BGP 透视\n\n### IPv6\n\n![IPv6 BGP](/archive-assets/template-check-bgp.png)\n`,
  );
  build();
  for (const name of ['vps', 'dedicated-server']) {
    const html = await read(
      `dist/reviews/template-check-${name}-20261108/index.html`,
    );
    assert(html.includes('class="full-review"'));
    assert(html.includes('data-route-explorer="return-route"'));
    assert(html.includes('data-review-panels="unlock"'));
    assert(!html.includes('href="#speed"') || html.includes('id="speed"'));
    const heading = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1];
    assert.equal((heading.match(/测试记录/g) || []).length, 1);
    if (name === 'dedicated-server') {
      assert(!heading.includes('VPS'));
      assert(html.includes('SMART 与健康状态'));
      assert(html.includes('data-component="BenchmarkTerminal"'));
    }
    await assert.rejects(
      read(`dist/reviews/template-check-${name}-draft-20261108/index.html`),
      { code: 'ENOENT' },
    );
  }
  const minimal = await read(
    'dist/reviews/template-check-minimal-20261108/index.html',
  );
  for (const id of ['purchase', 'unlock', 'speed', 'routing']) {
    assert(!minimal.includes(`href="#${id}"`), `Empty TOC target ${id}`);
    assert(!minimal.includes(`id="${id}"`), `Empty chapter ${id}`);
  }
  for (const id of ['cpu', 'disk', 'network'])
    assert(!minimal.includes(`data-review-tab="${id}"`));
  assert(minimal.includes('RAW_TEMPLATE_SENTINEL &lt;script&gt;'));
  const terminal = minimal.match(
    /<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/,
  )[1];
  assert(!terminal.includes('<script>'));
  assert(terminal.includes('{unexecuted}'));
  assert(minimal.includes('独立服务器 测试记录'));
  const raw = await read(
    'dist/reviews/template-check-raw-network-20261108/index.html',
  );
  assert(
    raw.includes('RAW_UNLOCK_SENTINEL') && raw.includes('RAW_ROUTE_SENTINEL'),
  );
  const images = await read(
    'dist/reviews/template-check-images-20261108/index.html',
  );
  assert(images.includes('src="/archive-assets/template-check-topology.png"'));
  assert(images.includes('src="/archive-assets/template-check-bgp.png"'));
  for (const path of [
    'index.html',
    'tags/index.html',
    'rss.xml',
    'sitemap.xml',
    'llms.txt',
  ]) {
    assert(!(await read(`dist/${path}`)).includes('template-check-vps-draft'));
    assert(
      !(await read(`dist/${path}`)).includes(
        'template-check-dedicated-server-draft',
      ),
    );
  }
  // Exercise the actual build gate, not a separate CI-only schema.
  const validBody = '\n## 系统信息\n\nValidation fixture.\n';
  for (const draft of [false, true]) {
    await rejectsArticle(
      `missing-url-${draft ? 'draft' : 'published'}`,
      header.replace('draft: false', `draft: ${draft}`) + validBody,
      /Missing permalink/,
      false,
    );
  }
  await rejectsArticle(
    'bad-url-date',
    header.replace(/^---\n/, "---\npermalink: '/reviews/test-20260229/'\n") +
      validBody,
    /normalized-title/,
  );
  await rejectsArticle(
    'duplicate-url',
    header.replace(
      /^---\n/,
      "---\npermalink: '/reviews/template-check-vps-20261108/'\n",
    ) + validBody,
    /Duplicate review URL/,
  );
  await rejectsArticle(
    'unsupported-redirect',
    header.replace(
      /^---\n/,
      "---\nredirectFrom: ['/reviews/template-check-vps-20261108/']\n",
    ) + validBody,
    /redirectFrom/,
  );
  await rejectsArticle(
    'unsupported-original-url',
    header.replace(
      /^---\n/,
      "---\noriginalUrl: 'https://lowendaff.com/2026/11/08/sample/'\n",
    ) + validBody,
    /originalUrl/,
  );
  await rejectsArticle(
    'missing-title',
    header.replace(/^title:.*\n/m, '') + validBody,
    /title/,
  );
  await rejectsArticle(
    'bad-type',
    header.replace('reviewType: dedicated', 'reviewType: physical') + validBody,
    /reviewType/,
  );
  await rejectsArticle(
    'bad-date',
    header.replace(/^publishedAt:.*$/m, "publishedAt: '2026-13-40'") +
      validBody,
    /publishedAt/,
  );
  await rejectsArticle(
    'bad-updated-date',
    header.replace(
      /^publishedAt:.*$/m,
      "publishedAt: '2026-11-08'\nupdatedAt: '2026-11-07'",
    ) + validBody,
    /updatedAt/,
  );
  await rejectsArticle(
    'empty-description',
    header.replace(/^description:.*$/m, "description: ' '") + validBody,
    /description/,
  );
  await rejectsArticle(
    'bad-yaml',
    header.replace(/^title:.*$/m, 'title: [unfinished') + validBody,
    /YAML|flow collection/i,
  );
  await rejectsArticle(
    'bad-section',
    `${header}\n## 意外的顶级章节\n\nThis must fail.\n`,
    /Unsupported review section/,
  );
  const raggedTable =
    '\n## 系统信息\n\n| Item | Result |\n| --- | --- |\n| Missing result |\n';
  for (const draft of [false, true]) {
    await rejectsArticle(
      `bad-table-${draft ? 'draft' : 'published'}`,
      header.replace('draft: false', `draft: ${draft}`) + raggedTable,
      /\.mdx:\d+:.*header width/,
    );
  }
  for (const draft of [false, true]) {
    await rejectsArticle(
      `bad-mdx-${draft ? 'draft' : 'published'}`,
      header
        .replace('format: review-markdown', 'format: mdx')
        .replace('draft: false', `draft: ${draft}`) + '\n<Unclosed\n',
      /Unexpected|Expected|MDX/i,
    );
  }
  console.log(
    'PASS: both templates, product titles, optional sections/TOC, raw output escaping, route/unlock output, local image markup, draft exclusion, YAML/schema/Markdown/MDX rejection.',
  );
} finally {
  for (const path of created) await unlink(path);
  build();
}
