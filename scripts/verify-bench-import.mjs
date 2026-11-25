import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import * as prettier from 'prettier';
import {
  maskCidrPrefix,
  maskIpAddress,
  renderBenchReport,
  sanitizeBgpSvg,
} from '../src/lib/bench-report-import.ts';
import {
  parseReadableReview,
  STANDARD_DEDICATED_SECTIONS,
  STANDARD_ROUTE_HEADERS,
  STANDARD_VPS_SECTIONS,
} from '../src/lib/readable-review.ts';

const root = new URL('../', import.meta.url);
const readJson = async (relPath) =>
  JSON.parse(await readFile(new URL(relPath, root), 'utf8'));

test('VPS v0.1.2 fixture renders all 9 standard sections, ECharts telemetry, split ASN/org, and masks show_ip=true addresses', async () => {
  const vpsReport = await readJson('tests/fixtures/bench/vps-v0.1.2.json');
  const rendered = renderBenchReport(
    vpsReport,
    {
      vendor: 'GoMami',
      country: 'HK',
      location: '香港',
      geo: { city: '香港', latitude: 22.27832, longitude: 114.17469 },
      publishedAt: '2026-11-25',
      testedAt: '2026-11-25 18:06 CST',
      tags: ['EPYC', '三网优化'],
      affiliate: true,
      plans: [
        {
          name: '🌋HKG.Turin.Mini',
          cpu: '2x vCPUs',
          memory: '4GB Memory',
          disk: '100GB NVME SSD',
          traffic: '1000GB Traffic',
          port: '2Gbps VirtIO Port',
          features: 'China Mainland Optimized Pro',
          url: 'https://gomami.io/aff.php?aff=192&pid=14',
        },
        {
          name: '🌋HKG.Turin.Pro',
          cpu: '6x vCPUs',
          memory: '16GB Memory',
          disk: '180GB NVME SSD',
          traffic: '5000GB Traffic',
          port: '5Gbps VirtIO Port',
          features: 'Windows-ready ⊞ · China Mainland Optimized Pro',
          url: 'https://gomami.io/aff.php?aff=192&pid=16',
        },
      ],
    },
    { assetSlug: 'fixture-vps' },
  );

  assert.equal(rendered.reviewType, 'vps');
  assert.equal(
    rendered.permalink,
    '/reviews/gomami-香港-amd-epyc-9575f-64-core-processor-vps-测试记录-20261125/',
  );
  assert.deepEqual(rendered.omittedSections, []);
  assert.equal(rendered.assets.length, 1);

  // Even when show_ip: true in raw JSON, neither MDX nor BGP SVG may leak raw host IP / CIDR
  assert(!rendered.mdx.includes('198.51.100.42'));
  assert(!rendered.mdx.includes('198.51.100.0/24'));
  assert(!rendered.mdx.includes('17.253.85.201'));
  assert(rendered.mdx.includes('`198.51.*.*`'));
  assert(rendered.mdx.includes('198.51.\\*.\\*/24'));
  assert(!rendered.assets[0].content.includes('198.51.100.42'));
  assert(rendered.assets[0].content.includes('198.51.*.*/24'));

  // Parse through the real readable-review parser and check section/table contracts
  const parsed = parseReadableReview(
    rendered.mdx,
    rendered.frontmatter,
    'fixture-vps',
    'fixture-vps.mdx',
  );
  const titles = parsed.sections.map((s) => s.title);
  assert(titles.includes('买'));
  const buyTable = parsed.sections
    .find((s) => s.title === '买')
    .blocks.find((b) => b.type === 'table');
  assert.deepEqual(buyTable.links, {
    '0:7': {
      href: 'https://gomami.io/aff.php?aff=192&pid=14',
      sponsored: true,
    },
    '1:7': {
      href: 'https://gomami.io/aff.php?aff=192&pid=16',
      sponsored: true,
    },
  });
  for (const required of STANDARD_VPS_SECTIONS) {
    assert(titles.includes(required), `Missing section: ${required}`);
  }

  // Verify vm-cpu-telemetry block & uptime/load
  const sysSec = parsed.sections.find((s) => s.title === '系统信息');
  assert(
    sysSec.blocks.some(
      (b) => b.type === 'code' && b.language === 'vm-cpu-telemetry',
    ),
  );
  assert(rendered.mdx.includes('140 天 13 小时 19 分'));
  assert(rendered.mdx.includes('0.02 / 0.01 / 0.00'));

  // Verify split 路由宣告 ASN vs RIR 网段登记标识（org）
  assert(rendered.mdx.includes('| 路由宣告 ASN | AS36002 |'));
  assert(
    rendered.mdx.includes(
      '| RIR 网段登记标识（org） | Hong-Kong-Broadband-Network-Limited |',
    ),
  );

  // Verify 7-Zip & y-cruncher utilization, Cloudflare & Apple CDN split tables
  assert(rendered.mdx.includes('188%'));
  assert(rendered.mdx.includes('193.72'));
  assert(rendered.mdx.includes('worker\\_faults'));

  // Verify 6-column route headers, Netflix [Equinix Hong Kong], and TCP fragmentation note
  for (const secName of ['路由追踪', 'TCP 大包回程路由']) {
    const sec = parsed.sections.find((s) => s.title === secName);
    const tables = sec.blocks.filter((b) => b.type === 'table');
    assert(tables.length > 0);
    for (const tbl of tables) {
      assert.deepEqual(tbl.headers, [...STANDARD_ROUTE_HEADERS]);
    }
  }
  assert(rendered.mdx.includes('Netflix \\[Equinix Hong Kong\\]'));
  assert(
    rendered.mdx.includes(
      '在第 2 跳因需要分片停止，路由器最大允许 1460 字节。',
    ),
  );
});

test('Dedicated v0.1.2 fixture renders bare-metal DIMM/BMC/NUMA, NVMe+RAID SMART, Broadcast IP, and dual-stack IPv6 routes', async () => {
  const dedReport = await readJson(
    'tests/fixtures/bench/dedicated-v0.1.2.json',
  );
  const rendered = renderBenchReport(
    dedReport,
    {
      vendor: 'ExampleHost',
      country: 'JP',
      location: '东京',
      geo: { city: '东京', latitude: 35.6895, longitude: 139.6917 },
      publishedAt: '2026-11-25',
      testedAt: '2026-11-25 20:00 JST',
      affiliate: true,
      purchaseUrl: 'https://example.com/dedicated-offer',
      offer: {
        cpu: 'Intel Xeon E-2388G',
        memory: '64 GB DDR4 ECC',
        disk: '1 TB NVMe + 2 TB HDD',
        port: '1 Gbps',
        traffic: '50 TB',
        ip: '1 IPv4 + /64 IPv6',
        monthly: '$129.00',
        setup: '$0',
      },
    },
    { assetSlug: 'fixture-dedicated' },
  );

  assert.equal(rendered.reviewType, 'dedicated');
  assert.deepEqual(rendered.omittedSections, []);
  assert(rendered.mdx.includes('## 买'));
  assert(
    rendered.mdx.includes('这是推广链接，通过该链接购买，本站可能获得佣金。'),
  );
  assert(rendered.mdx.includes('### NUMA 本地与跨节点访问'));
  assert(rendered.mdx.includes('重映射 0 / 待定 0'));
  assert(rendered.mdx.includes('广播 IP（注册地 US，定位 JP）'));
  assert(rendered.mdx.includes('2001:0db8:…'));

  const parsed = parseReadableReview(
    rendered.mdx,
    rendered.frontmatter,
    'fixture-dedicated',
    'fixture-dedicated.mdx',
  );
  const titles = parsed.sections.map((s) => s.title);
  for (const required of STANDARD_DEDICATED_SECTIONS) {
    assert(titles.includes(required), `Missing section: ${required}`);
  }
});

test('Unconsumed completed plugin or CPU suite fails loudly instead of silently dropping data', async () => {
  const base = await readJson('tests/fixtures/bench/vps-v0.1.2.json');
  const meta = {
    vendor: 'GoMami',
    country: 'HK',
    location: '香港',
    geo: { city: '香港', latitude: 22.27832, longitude: 114.17469 },
    publishedAt: '2026-11-25',
    testedAt: '2026-11-25',
  };

  const withUnknownPlugin = structuredClone(base);
  withUnknownPlugin.runs.push({
    id: 'gpu.cuda',
    group: 'gpu',
    title: 'CUDA Benchmark',
    status: 'completed',
    status_text: 'done',
    reason: null,
    started_seconds: 300,
    elapsed_seconds: 10,
    output: { gflops: 9999 },
  });
  assert.throws(
    () => renderBenchReport(withUnknownPlugin, meta, { assetSlug: 'x' }),
    /Unhandled benchmark plugin "gpu\.cuda"/,
  );

  const withUnknownCpuSuite = structuredClone(base);
  const cpuRun = withUnknownCpuSuite.runs.find((r) => r.id === 'cpu.bench');
  cpuRun.output.superpi = { status: 'done', output: { seconds: 8.5 } };
  assert.throws(
    () => renderBenchReport(withUnknownCpuSuite, meta, { assetSlug: 'x' }),
    /Unhandled CPU benchmark suite "superpi"/,
  );
});

test('SVG sanitizer and IP mask helpers block unsafe constructs', () => {
  assert.equal(maskIpAddress('103.73.220.19'), '103.73.*.*');
  assert.equal(maskIpAddress('2400:cb00:2048:1::c629:d7a2'), '2400:cb00:…');
  assert.equal(maskCidrPrefix('103.73.220.0/22'), '103.73.*.*/22');
  assert.equal(maskCidrPrefix('2400:cb00::/32'), '2400:cb00:…/32');

  for (const unsafeSvg of [
    '<svg><script>alert(1)</script></svg>',
    '<svg onclick="alert(1)"></svg>',
    '<svg><rect fill="url(https://evil.example/x)"/></svg>',
    '<!DOCTYPE svg><svg></svg>',
    '<svg><g><rect/></svg>',
  ]) {
    assert.throws(() => sanitizeBgpSvg(unsafeSvg));
  }
});

test('CLI review:import writes Prettier-clean MDX + BGP SVG and guards against accidental overwrite', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'lowendaff-bench-cli-'));
  try {
    const outMdx = join(tempDir, 'cli-test.mdx');
    const assetsDir = join(tempDir, 'assets');
    const metaPath = join(tempDir, 'editorial.json');
    await writeFile(
      metaPath,
      JSON.stringify({
        vendor: 'GoMami',
        country: 'HK',
        location: '香港',
        geo: { city: '香港', latitude: 22.27832, longitude: 114.17469 },
        publishedAt: '2026-11-25',
        testedAt: '2026-11-25 18:06 CST',
      }),
    );

    const stdout = execFileSync(
      process.execPath,
      [
        '--experimental-strip-types',
        'scripts/import-bench-report.mjs',
        '--report',
        'tests/fixtures/bench/vps-v0.1.2.json',
        '--meta',
        metaPath,
        '--out',
        outMdx,
        '--assets-dir',
        assetsDir,
      ],
      { cwd: root, encoding: 'utf8' },
    );
    const receipt = JSON.parse(stdout);
    assert.equal(receipt.draft, true);
    assert.equal(receipt.benchVersion, '0.1.2');
    assert.deepEqual(receipt.assets, ['/archive-assets/cli-test/bgp-ipv4.svg']);

    const mdxContent = await readFile(outMdx, 'utf8');
    const prettierConfig = (await prettier.resolveConfig(outMdx)) ?? {};
    assert.equal(
      await prettier.check(mdxContent, { ...prettierConfig, filepath: outMdx }),
      true,
      'Generated MDX must pass Prettier check out of the box',
    );
    const svgContent = await readFile(join(assetsDir, 'bgp-ipv4.svg'), 'utf8');
    assert(svgContent.startsWith("<?xml version='1.0' encoding='utf-8'?>"));

    // Second run without --overwrite must refuse to clobber existing file
    assert.throws(() =>
      execFileSync(
        process.execPath,
        [
          '--experimental-strip-types',
          'scripts/import-bench-report.mjs',
          '--report',
          'tests/fixtures/bench/vps-v0.1.2.json',
          '--meta',
          metaPath,
          '--out',
          outMdx,
        ],
        { cwd: root, stdio: 'pipe' },
      ),
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
