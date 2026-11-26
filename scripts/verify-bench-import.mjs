import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { isDeepStrictEqual } from 'node:util';
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

const KNOWN_SCHEMA_KEYWORDS = new Set([
  '$schema',
  '$id',
  'title',
  'description',
  '$defs',
  '$ref',
  'type',
  'const',
  'enum',
  'required',
  'properties',
  'patternProperties',
  'additionalProperties',
  'items',
  'prefixItems',
  'minItems',
  'maxItems',
  'minimum',
  'maximum',
  'oneOf',
  'anyOf',
  'allOf',
  'if',
  'then',
  'else',
  'not',
]);

function matchesJsonType(value, expected) {
  switch (expected) {
    case 'null':
      return value === null;
    case 'boolean':
      return typeof value === 'boolean';
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'array':
      return Array.isArray(value);
    case 'object':
      return (
        typeof value === 'object' && value !== null && !Array.isArray(value)
      );
    default:
      throw new Error(`Unsupported JSON Schema type "${expected}"`);
  }
}

function validateJsonSchema(value, schema, rootSchema = schema, path = '$') {
  if (typeof schema === 'boolean') {
    return schema ? [] : [`${path}: disallowed by false schema`];
  }
  for (const key of Object.keys(schema)) {
    if (!KNOWN_SCHEMA_KEYWORDS.has(key)) {
      throw new Error(`Unhandled JSON Schema keyword "${key}" at ${path}`);
    }
  }
  const errors = [];
  if (schema.$ref) {
    const prefix = '#/$defs/';
    if (!schema.$ref.startsWith(prefix)) {
      throw new Error(`Unsupported $ref "${schema.$ref}" at ${path}`);
    }
    const defName = schema.$ref.slice(prefix.length);
    const target = rootSchema.$defs?.[defName];
    if (target === undefined) {
      throw new Error(`Missing $defs.${defName} referenced at ${path}`);
    }
    errors.push(...validateJsonSchema(value, target, rootSchema, path));
  }

  if (schema.type !== undefined) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!allowed.some((t) => matchesJsonType(value, t))) {
      errors.push(`${path}: expected type ${allowed.join('|')}`);
      return errors;
    }
  }
  if ('const' in schema && !isDeepStrictEqual(value, schema.const)) {
    errors.push(`${path}: expected const ${JSON.stringify(schema.const)}`);
  }
  if (
    schema.enum &&
    !schema.enum.some((item) => isDeepStrictEqual(value, item))
  ) {
    errors.push(`${path}: value not in enum`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${path}: ${value} < minimum ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${path}: ${value} > maximum ${schema.maximum}`);
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(
        `${path}: length ${value.length} < minItems ${schema.minItems}`,
      );
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(
        `${path}: length ${value.length} > maxItems ${schema.maxItems}`,
      );
    }
    let startIdx = 0;
    if (Array.isArray(schema.prefixItems)) {
      startIdx = schema.prefixItems.length;
      for (let i = 0; i < Math.min(value.length, startIdx); i += 1) {
        errors.push(
          ...validateJsonSchema(
            value[i],
            schema.prefixItems[i],
            rootSchema,
            `${path}[${i}]`,
          ),
        );
      }
    }
    if ('items' in schema) {
      for (let i = startIdx; i < value.length; i += 1) {
        errors.push(
          ...validateJsonSchema(
            value[i],
            schema.items,
            rootSchema,
            `${path}[${i}]`,
          ),
        );
      }
    }
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    if (Array.isArray(schema.required)) {
      for (const reqKey of schema.required) {
        if (!Object.hasOwn(value, reqKey)) {
          errors.push(`${path}: missing required property "${reqKey}"`);
        }
      }
    }
    const evaluated = new Set();
    if (schema.properties) {
      for (const [propKey, propSchema] of Object.entries(schema.properties)) {
        if (Object.hasOwn(value, propKey)) {
          evaluated.add(propKey);
          errors.push(
            ...validateJsonSchema(
              value[propKey],
              propSchema,
              rootSchema,
              `${path}.${propKey}`,
            ),
          );
        }
      }
    }
    if (schema.patternProperties) {
      for (const [pattern, patSchema] of Object.entries(
        schema.patternProperties,
      )) {
        const re = new RegExp(pattern);
        for (const propKey of Object.keys(value)) {
          if (re.test(propKey)) {
            evaluated.add(propKey);
            errors.push(
              ...validateJsonSchema(
                value[propKey],
                patSchema,
                rootSchema,
                `${path}.${propKey}`,
              ),
            );
          }
        }
      }
    }
    if ('additionalProperties' in schema) {
      for (const propKey of Object.keys(value)) {
        if (!evaluated.has(propKey)) {
          errors.push(
            ...validateJsonSchema(
              value[propKey],
              schema.additionalProperties,
              rootSchema,
              `${path}.${propKey}`,
            ),
          );
        }
      }
    }
  }
  if (Array.isArray(schema.allOf)) {
    for (const sub of schema.allOf) {
      errors.push(...validateJsonSchema(value, sub, rootSchema, path));
    }
  }
  if (Array.isArray(schema.anyOf)) {
    const ok = schema.anyOf.some(
      (sub) => validateJsonSchema(value, sub, rootSchema, path).length === 0,
    );
    if (!ok) errors.push(`${path}: matched 0 schemas in anyOf`);
  }
  if (Array.isArray(schema.oneOf)) {
    let matches = 0;
    const branchErrors = [];
    for (const sub of schema.oneOf) {
      const subErrs = validateJsonSchema(value, sub, rootSchema, path);
      if (subErrs.length === 0) matches += 1;
      else branchErrors.push(subErrs[0]);
    }
    if (matches !== 1) {
      errors.push(
        `${path}: matched ${matches} schemas in oneOf (${branchErrors.slice(0, 2).join('; ')})`,
      );
    }
  }
  if ('not' in schema) {
    if (validateJsonSchema(value, schema.not, rootSchema, path).length === 0) {
      errors.push(`${path}: matched forbidden "not" schema`);
    }
  }
  if ('if' in schema) {
    const condOk =
      validateJsonSchema(value, schema.if, rootSchema, path).length === 0;
    if (condOk && 'then' in schema) {
      errors.push(...validateJsonSchema(value, schema.then, rootSchema, path));
    } else if (!condOk && 'else' in schema) {
      errors.push(...validateJsonSchema(value, schema.else, rootSchema, path));
    }
  }
  return errors;
}

test('Official v0.1.4 JSON Schemas strictly validate VPS & Dedicated fixtures and cross-reject wrong platform types', async () => {
  const [reportSchema, vpsSchema, dedicatedSchema, vpsReport, dedReport] =
    await Promise.all([
      readJson('schemas/bench/lowendaff-bench-report.schema.json'),
      readJson('schemas/bench/lowendaff-bench-vps.schema.json'),
      readJson('schemas/bench/lowendaff-bench-dedicated.schema.json'),
      readJson('tests/fixtures/bench/vps-v0.1.2.json'),
      readJson('tests/fixtures/bench/dedicated-v0.1.2.json'),
    ]);

  assert.deepEqual(validateJsonSchema(vpsReport, reportSchema), []);
  assert.deepEqual(validateJsonSchema(vpsReport, vpsSchema), []);
  assert(
    validateJsonSchema(vpsReport, dedicatedSchema).length > 0,
    'Dedicated schema must reject VPS report',
  );

  assert.deepEqual(validateJsonSchema(dedReport, reportSchema), []);
  assert.deepEqual(validateJsonSchema(dedReport, dedicatedSchema), []);
  assert(
    validateJsonSchema(dedReport, vpsSchema).length > 0,
    'VPS schema must reject Dedicated report',
  );
});

test('VPS v0.1.4 fixture renders all 9 standard sections, ECharts telemetry, v0.1.4 IP quality & unlock mode, and masks show_ip=true addresses', async () => {
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

  // Even when show_ip: true in raw JSON, neither MDX, notes, nor BGP SVG may leak raw host IP / CIDR
  assert(!rendered.mdx.includes('198.51.100.42'));
  assert(!rendered.mdx.includes('198.51.100.0/24'));
  assert(!rendered.mdx.includes('17.253.85.201'));
  assert(rendered.mdx.includes('`198.51.*.*`'));
  assert(rendered.mdx.includes('198.51.\\*.\\*/24'));
  assert(
    rendered.mdx.includes(
      '数据源备注：IP2Location：HTTP 429 on `198.51.*.*`。',
    ),
  );
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

  // Verify split 路由宣告 ASN vs RIR org + v0.1.4 city/timezone/asn_usage divergence/dual_isp
  assert(rendered.mdx.includes('| 路由宣告 ASN | AS36002 |'));
  assert(
    rendered.mdx.includes(
      '| RIR 网段登记标识（org） | Hong-Kong-Broadband-Network-Limited |',
    ),
  );
  assert(
    rendered.mdx.includes('| 所在城市 | Kwai Chung, Kwai Tsing District |'),
  );
  assert(rendered.mdx.includes('| 时区 | Asia/Hong\\_Kong |'));
  assert(
    rendered.mdx.includes(
      '| ASN 类型 | 住宅宽带（Residential）（IPRegistry: 数据中心（Hosting）） |',
    ),
  );
  assert(rendered.mdx.includes('| 机构类型 | 数据中心（Hosting）（双 ISP） |'));

  // Verify 5-column 服务解锁测试 with 原生 / DNS / —
  const unlockSec = parsed.sections.find((s) => s.title === '服务解锁测试');
  const unlockTables = unlockSec.blocks.filter((b) => b.type === 'table');
  assert.equal(unlockTables.length, 2);
  for (const tbl of unlockTables) {
    assert.deepEqual(tbl.headers, [
      '服务',
      '状态',
      '区域',
      '解锁方式',
      '检测备注',
    ]);
  }
  assert(rendered.mdx.includes('| Netflix | 可用 | HK | 原生 | — |'));
  assert(rendered.mdx.includes('| ChatGPT | 不支持 | — | — | ProxyDetected |'));
  assert(rendered.mdx.includes('| Bahamut Anime | 可用 | HK | DNS | — |'));

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

  // Legacy 0.1.2 fallback check: reports without v0.1.4 IP/media fields keep 使用场景分类 & 4-col unlock table
  const legacyV012 = structuredClone(vpsReport);
  legacyV012.version = '0.1.2';
  const ipqV4 = legacyV012.runs.find((r) => r.id === 'ip.quality').output.ipv4;
  for (const k of [
    'city',
    'region',
    'timezone',
    'asn_usage',
    'company_usage',
    'dual_isp',
    'usage_sources',
  ]) {
    delete ipqV4[k];
  }
  for (const r of legacyV012.runs.find((x) => x.id === 'ip.media').output
    .results) {
    delete r.ipv4_unlock;
    delete r.ipv6_unlock;
  }
  const legacyRendered = renderBenchReport(
    legacyV012,
    {
      vendor: 'GoMami',
      country: 'HK',
      location: '香港',
      geo: { city: '香港', latitude: 22.27832, longitude: 114.17469 },
      publishedAt: '2026-11-25',
      testedAt: '2026-11-25 18:06 CST',
    },
    { assetSlug: 'fixture-vps-legacy' },
  );
  assert(
    legacyRendered.mdx.includes('| 使用场景分类 | 住宅宽带（Residential） |'),
  );
  assert(legacyRendered.mdx.includes('| 服务 | 状态 | 区域 | 检测备注 |'));
});

test('Dedicated v0.1.4 fixture renders SMBIOS slots/EDAC/BMC, RAID array+passthrough, ZFS, SMART TB+CRC, multi-NIC Bond/PCIe, v0.1.4 IP/unlock, and TCP routes', async () => {
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
        memory: '64 GB DDR4 ECC RDIMM',
        disk: '1 TB NVMe + 2 TB HDD + 960 GB SSD',
        raid: 'MegaRAID SAS-3 3108（阵列卷 + HBA 直通）',
        port: '1 Gbps + 10 Gbps SFP+',
        traffic: '50 TB（出方向计算）',
        ip: '1 IPv4 + /64 IPv6',
        ipmi: '独立 ASPEED IPMI 2.0（含远程 KVM）',
        delivery: '付款后 2 小时内自动交付',
        monthly: '$129.00',
        setup: '$0',
      },
    },
    { assetSlug: 'fixture-dedicated' },
  );

  assert.equal(rendered.reviewType, 'dedicated');
  assert.deepEqual(rendered.omittedSections, []);
  assert(rendered.mdx.includes('## 买'));
  assert(rendered.mdx.includes('带外管理（IPMI / KVM）'));
  assert(
    rendered.mdx.includes('这是推广链接，通过该链接购买，本站可能获得佣金。'),
  );
  // Dedicated hardware: SMBIOS slots, downclocked MT/s, disabled DIMM warning, EDAC & BMC
  assert(
    rendered.mdx.includes('Supermicro SYS-510P-MR / Supermicro X12STH-SYS'),
  );
  assert(rendered.mdx.includes('EDAC 已纠正 CE 2 次，未纠正 UE 0 次'));
  assert(rendered.mdx.includes('ASPEED · 固件 01.04.12 · IPMI 2.0 · 接口 KCS'));
  assert(rendered.mdx.includes('### 内存插槽（SMBIOS）'));
  assert(rendered.mdx.includes('2933 / 3200 MT/s'));
  assert(rendered.mdx.includes('空槽'));
  assert(rendered.mdx.includes('已插未启用'));
  assert(rendered.mdx.includes('插槽 DIMMB2 检测到内存模块信息但处于未启用'));
  assert(rendered.mdx.includes('### NUMA 本地与跨节点访问'));

  // Dedicated storage: SSD/HDD medium, ZFS pool + test_directory, RAID array vs pass_through, SMART TB + CRC
  assert(rendered.mdx.includes('NVMe · SSD'));
  assert(rendered.mdx.includes('SCSI · HDD'));
  assert(rendered.mdx.includes('zfs（池 rpool，挂载 / · 测试目录'));
  assert(rendered.mdx.includes('关联设备：sda 阵列卷、sdb 直通盘'));
  assert(rendered.mdx.includes('4.85 TB'));
  assert(rendered.mdx.includes('重映射 0 / 待定 0 · CRC 3'));

  // Dedicated NICs: Bond, Down link, SR-IOV VF, and PCIe degradation warning
  assert(rendered.mdx.includes('Bond bond0 · 默认 IPv4 / IPv6'));
  assert(rendered.mdx.includes('未连接（Down）'));
  assert(rendered.mdx.includes('SR-IOV 2 VF'));
  assert(
    rendered.mdx.includes(
      '网卡 ens1f0 当前 PCIe 链路协商速率或通道数低于硬件规格上限',
    ),
  );

  // v0.1.4 IP location deduplication (Tokyo, Tokyo -> Tokyo) and IPv4 native vs IPv6 DNS unlock
  assert(rendered.mdx.includes('广播 IP（注册地 US，定位 JP）'));
  assert(rendered.mdx.includes('| 所在城市 | Tokyo |'));
  assert(rendered.mdx.includes('| 时区 | Asia/Tokyo |'));
  assert(rendered.mdx.includes('| ASN 类型 | 数据中心（Hosting） |'));
  assert(rendered.mdx.includes('| 机构类型 | 商业网络（Business） |'));
  assert(rendered.mdx.includes('| YouTube Premium | 可用 | JP | 原生 | — |'));
  assert(rendered.mdx.includes('| YouTube Premium | 可用 | JP | DNS | — |'));
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

  // Objective omission: if disk.health was skipped on a dedicated server, omittedSections records 'disk-health'
  const withoutSmart = structuredClone(dedReport);
  const dhRun = withoutSmart.runs.find((r) => r.id === 'disk.health');
  dhRun.status = 'skipped';
  dhRun.output = null;
  const renderedNoSmart = renderBenchReport(
    withoutSmart,
    {
      vendor: 'ExampleHost',
      country: 'JP',
      location: '东京',
      geo: { city: '东京', latitude: 35.6895, longitude: 139.6917 },
      publishedAt: '2026-11-25',
      testedAt: '2026-11-25 20:00 JST',
    },
    { assetSlug: 'fixture-dedicated-nosmart' },
  );
  assert.deepEqual(renderedNoSmart.omittedSections, ['disk-health']);
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
    assert.equal(receipt.benchVersion, '0.1.4');
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
