import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';
import {
  astroBin,
  cloneIsolatedWorkspace,
  createIsolatedWorkspace,
  defaultWorkerCount,
  execFileAsync,
  repoRoot,
} from './isolated-workspace.mjs';

const readSource = async (relPath) => {
  const source = await readFile(join(repoRoot, relPath), 'utf8');
  // Authors must fill coordinates; only integration fixtures replace the blanks.
  return relPath.startsWith('templates/reviews/')
    ? source
        .replace('latitude: null', 'latitude: 34.05')
        .replace('longitude: null', 'longitude: -118.24')
    : source;
};

const withDefaultPermalink = (name, body, includeUrl = true) => {
  if (includeUrl && !/^permalink:/m.test(body)) {
    return body.replace(
      /^---\n/,
      `---\npermalink: '/reviews/template-check-${name}-20261108/'\n`,
    );
  }
  return body;
};

const tempDirs = [];
try {
  const baseDir = await createIsolatedWorkspace('lowendaff-templates-base-');
  tempDirs.push(baseDir);

  const positiveDir = await cloneIsolatedWorkspace(
    baseDir,
    'lowendaff-templates-pos-',
  );
  tempDirs.push(positiveDir);

  const addPositive = async (name, body, includeUrl = true) => {
    const filePath = join(
      positiveDir,
      `src/content/posts/template-check-${name}.mdx`,
    );
    await writeFile(filePath, withDefaultPermalink(name, body, includeUrl), {
      flag: 'wx',
    });
  };

  for (const name of ['vps', 'dedicated-server']) {
    const template = await readSource(`templates/reviews/${name}.mdx`);
    assert.equal(parse(template.split('---')[1]).draft, true);
    await addPositive(name, template.replace('draft: true', 'draft: false'));
    await addPositive(`${name}-draft`, template);
  }
  const vpsTemplate = await readSource('templates/reviews/vps.mdx');
  const dedicated = await readSource('templates/reviews/dedicated-server.mdx');
  const header = dedicated
    .slice(0, dedicated.indexOf('\n## 买'))
    .replace('draft: true', 'draft: false')
    .replace(/^benchVersion:.*\n/m, '')
    .replace(
      "title: '待填写商家与地区 独立服务器测试记录'",
      "title: 'Template minimal dedicated'",
    )
    .replace(
      "description: '待填写硬件、磁盘健康与网络测试结论。'",
      "description: 'Synthetic validation fixture.'",
    )
    .replace("vendor: '待填写商家'", "vendor: 'Fixture'")
    .replace("location: '待填写实际机房地区'", "location: 'Los Angeles'")
    .replace("city: '待填写测评城市'", "city: '洛杉矶'")
    .replace(
      "testedAt: '待填写测试日期、时段与时区'",
      "testedAt: '2026-11-08 12:00 UTC'",
    );

  await addPositive(
    'minimal',
    `${header}\n## 系统信息\n\n### dmidecode\n\n\`\`\`text\nRAW_TEMPLATE_SENTINEL <script>alert(1)</script> {unexecuted}\n\`\`\`\n`,
  );
  await addPositive(
    'raw-network',
    `${header}\n## 服务解锁测试\n\n### IPv6\n\n#### AIGC\n\n\`\`\`text\nRAW_UNLOCK_SENTINEL\n\`\`\`\n\n## 路由追踪\n\n### 中国境内目标\n\n#### 北京电信 (IPv6)\n\n\`\`\`text\nRAW_ROUTE_SENTINEL\n\`\`\`\n`,
  );
  // Missing image is tested as rendering syntax only, never shipped as an article.
  await addPositive(
    'images',
    `${header}\n## 系统信息\n\n![Topology](/archive-assets/template-check-topology.png)\n\n## BGP 透视\n\n### IPv6\n\n![IPv6 BGP](/archive-assets/template-check-bgp.png)\n`,
  );

  execFileSync('npm', ['run', 'build'], {
    cwd: positiveDir,
    env: {
      ...process.env,
      ASTRO_TELEMETRY_DISABLED: '1',
      PUBLIC_SITE_INDEXABLE: 'false',
    },
    stdio: 'pipe',
    maxBuffer: 8 * 1024 * 1024,
  });

  const readDist = (relPath) => readFile(join(positiveDir, relPath), 'utf8');

  for (const name of ['vps', 'dedicated-server']) {
    const html = await readDist(
      `dist/reviews/template-check-${name}-20261108/index.html`,
    );
    assert(html.includes('class="full-review"'));
    assert(html.includes('data-route-explorer="return-route"'));
    assert(html.includes('data-route-explorer="return-tcp-route"'));
    assert(html.includes('data-review-tab="ip-quality"'));
    assert(html.includes('data-review-tab="tcping"'));
    assert(html.includes('data-review-panels="unlock"'));
    assert(html.includes('ASN 类型'));
    assert(html.includes('解锁方式'));
    assert(!html.includes('href="#speed"') || html.includes('id="speed"'));
    const heading = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1];
    assert.equal((heading.match(/测试记录/g) || []).length, 1);
    if (name === 'vps') {
      assert(html.includes('data-vm-telemetry-root'));
    }
    if (name === 'dedicated-server') {
      assert(!heading.includes('VPS'));
      assert(html.includes('SMART 与健康状态'));
      assert(html.includes('data-component="BenchmarkTerminal"'));
    }
    await assert.rejects(
      readDist(`dist/reviews/template-check-${name}-draft-20261108/index.html`),
      { code: 'ENOENT' },
    );
  }
  const minimal = await readDist(
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
  const raw = await readDist(
    'dist/reviews/template-check-raw-network-20261108/index.html',
  );
  assert(
    raw.includes('RAW_UNLOCK_SENTINEL') && raw.includes('RAW_ROUTE_SENTINEL'),
  );
  const images = await readDist(
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
    assert(
      !(await readDist(`dist/${path}`)).includes('template-check-vps-draft'),
    );
    assert(
      !(await readDist(`dist/${path}`)).includes(
        'template-check-dedicated-server-draft',
      ),
    );
  }

  // Exercise the actual Astro build gate (not a separate CI-only schema) across
  // bounded parallel isolated workers so negative checks remain O(1) as real
  // published articles grow.
  const validBody = '\n## 系统信息\n\nValidation fixture.\n';
  await writeFile(
    join(baseDir, 'src/content/posts/template-check-vps.mdx'),
    withDefaultPermalink('vps', header + validBody, true),
    { flag: 'wx' },
  );

  const negativeCases = [];
  const queueRejection = (name, body, expected, includeUrl = true) => {
    negativeCases.push({ name, body, expected, includeUrl });
  };

  for (const draft of [false, true]) {
    queueRejection(
      `missing-url-${draft ? 'draft' : 'published'}`,
      header.replace('draft: false', `draft: ${draft}`) + validBody,
      /Missing permalink/,
      false,
    );
  }
  queueRejection(
    'bad-url-date',
    header.replace(/^---\n/, "---\npermalink: '/reviews/test-20260229/'\n") +
      validBody,
    /normalized-title/,
  );
  queueRejection(
    'duplicate-url',
    header.replace(
      /^---\n/,
      "---\npermalink: '/reviews/template-check-vps-20261108/'\n",
    ) + validBody,
    /Duplicate review URL/,
  );
  queueRejection(
    'unsupported-redirect',
    header.replace(
      /^---\n/,
      "---\nredirectFrom: ['/reviews/template-check-vps-20261108/']\n",
    ) + validBody,
    /redirectFrom/,
  );
  queueRejection(
    'unsupported-original-url',
    header.replace(
      /^---\n/,
      "---\noriginalUrl: 'https://lowendaff.com/2026/11/08/sample/'\n",
    ) + validBody,
    /originalUrl/,
  );
  for (const draft of [false, true]) {
    const sample = header.replace('draft: false', `draft: ${draft}`);
    queueRejection(
      `missing-geo-${draft}`,
      sample.replace(/^geo:\n(?:[ \t]+.*\n)+/m, '') + validBody,
      /geo/,
    );
    queueRejection(
      `missing-longitude-${draft}`,
      sample.replace(/^  longitude:.*\n/m, '') + validBody,
      /longitude/,
    );
    queueRejection(
      `invalid-latitude-${draft}`,
      sample.replace(/^  latitude:.*$/m, '  latitude: 91') + validBody,
      /latitude/,
    );
  }
  queueRejection(
    'missing-title',
    header.replace(/^title:.*\n/m, '') + validBody,
    /title/,
  );
  queueRejection(
    'bad-type',
    header.replace('reviewType: dedicated', 'reviewType: physical') + validBody,
    /reviewType/,
  );
  queueRejection(
    'bad-date',
    header.replace(/^publishedAt:.*$/m, "publishedAt: '2026-13-40'") +
      validBody,
    /publishedAt/,
  );
  queueRejection(
    'bad-updated-date',
    header.replace(
      /^publishedAt:.*$/m,
      "publishedAt: '2026-11-08'\nupdatedAt: '2026-11-07'",
    ) + validBody,
    /updatedAt/,
  );
  queueRejection(
    'empty-description',
    header.replace(/^description:.*$/m, "description: ' '") + validBody,
    /description/,
  );
  queueRejection(
    'bad-yaml',
    header.replace(/^title:.*$/m, 'title: [unfinished') + validBody,
    /YAML|flow collection/i,
  );
  queueRejection(
    'bad-section',
    `${header}\n## 意外的顶级章节\n\nThis must fail.\n`,
    /Unsupported review section/,
  );
  const raggedTable =
    '\n## 系统信息\n\n| Item | Result |\n| --- | --- |\n| Missing result |\n';
  for (const draft of [false, true]) {
    queueRejection(
      `bad-table-${draft ? 'draft' : 'published'}`,
      header.replace('draft: false', `draft: ${draft}`) + raggedTable,
      /\.mdx:\d+:.*header width/,
    );
  }
  for (const draft of [false, true]) {
    queueRejection(
      `bad-mdx-${draft ? 'draft' : 'published'}`,
      header
        .replace('format: review-markdown', 'format: mdx')
        .replace('draft: false', `draft: ${draft}`) + '\n<Unclosed\n',
      /Unexpected|Expected|MDX/i,
    );
  }
  queueRejection(
    'bad-route-headers',
    vpsTemplate.replace(
      /#### 北京电信 163 AS4134 \(IPv4\)[\s\S]*?(?=#### 上海联通)/,
      '#### 北京电信 163 AS4134 (IPv4)\n\n| 跳数 | 应答地址（脱敏） | ASN | 位置 / 网络 | 最小 RTT（ms） |\n| --- | --- | --- | --- | --- |\n| 1 | 103.73.*.* | AS36002 | 香港 | 0.8 ms |\n\n',
    ),
    /standard 6-column headers/,
  );
  queueRejection(
    'missing-standard-section',
    vpsTemplate.replace(/## IP 质量检测[\s\S]*?(?=## 服务解锁测试)/, ''),
    /Missing standard vps review section "IP 质量检测"/,
  );
  queueRejection(
    'missing-tcping-v015',
    vpsTemplate.replace(/## TCP 延迟测试[\s\S]*?(?=## 路由追踪)/, ''),
    /Missing standard vps review section "TCP 延迟测试"/,
  );
  queueRejection(
    'missing-vm-telemetry',
    vpsTemplate.replace(/```vm-cpu-telemetry[\s\S]*?```\n\n/, ''),
    /vm-cpu-telemetry/,
  );
  queueRejection(
    'missing-dedicated-disk-health',
    dedicated.replace(/### SMART 与健康状态[\s\S]*?(?=### fio)/, ''),
    /disk-health/,
  );
  queueRejection(
    'stale-omitted-section',
    vpsTemplate.replace(
      /^(benchVersion: .*\n)/m,
      "$1omittedSections: ['系统信息']\n",
    ),
    /omittedSections lists "系统信息"/,
  );
  queueRejection(
    'placeholder-leak',
    header.replace(
      /^---\n/,
      "---\npermalink: '/reviews/real-published-placeholder-20261108/'\n",
    ) + '\n## 系统信息\n\n| 项目 | 结果 |\n| --- | --- |\n| CPU | 待填写 |\n',
    /template placeholders/,
    false,
  );
  queueRejection(
    'missing-local-asset',
    header.replace(
      /^---\n/,
      "---\npermalink: '/reviews/real-published-missing-asset-20261108/'\n",
    ) +
      '\n## BGP 透视\n\n### IPv4\n\n![IPv4 BGP 透视](/archive-assets/nonexistent-fixture/bgp-ipv4.svg)\n',
    /missing local asset/,
    false,
  );

  const workerCount = defaultWorkerCount(negativeCases.length, 4);
  const workerDirs = await Promise.all(
    Array.from({ length: workerCount }, () =>
      cloneIsolatedWorkspace(baseDir, 'lowendaff-templates-neg-'),
    ),
  );
  tempDirs.push(...workerDirs);

  let nextIdx = 0;
  const logs = new Array(negativeCases.length);
  await Promise.all(
    workerDirs.map(async (workerDir) => {
      while (nextIdx < negativeCases.length) {
        const idx = nextIdx++;
        const item = negativeCases[idx];
        const fixturePath = join(
          workerDir,
          `src/content/posts/template-check-${item.name}.mdx`,
        );
        await writeFile(
          fixturePath,
          withDefaultPermalink(item.name, item.body, item.includeUrl),
          { flag: 'wx' },
        );
        try {
          let failedOutput = null;
          try {
            await execFileAsync(process.execPath, [astroBin, 'build'], {
              cwd: workerDir,
              env: {
                ...process.env,
                ASTRO_TELEMETRY_DISABLED: '1',
                PUBLIC_SITE_INDEXABLE: 'false',
              },
              maxBuffer: 8 * 1024 * 1024,
            });
          } catch (error) {
            failedOutput =
              String(error.stdout ?? '') + String(error.stderr ?? '');
          }
          assert.notEqual(
            failedOutput,
            null,
            `Expected astro build to reject ${item.name}`,
          );
          assert.match(failedOutput, new RegExp(`template-check-${item.name}`));
          assert.match(failedOutput, item.expected);
          logs[idx] = `PASS: rejected ${item.name} with a source diagnostic.`;
        } finally {
          await unlink(fixturePath).catch(() => {});
        }
      }
    }),
  );

  for (const line of logs) console.log(line);
  console.log(
    'PASS: both templates, product titles, optional sections/TOC, raw output escaping, route/unlock output, local image markup, draft exclusion, YAML/schema/Markdown/MDX rejection.',
  );
} finally {
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
  );
}
