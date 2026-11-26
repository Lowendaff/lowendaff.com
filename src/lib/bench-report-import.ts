import { isIP } from 'node:net';
import { z } from 'astro/zod';
import {
  isBenchVersionBefore,
  STANDARD_DEDICATED_SECTIONS,
  STANDARD_ROUTE_HEADERS,
  STANDARD_VPS_SECTIONS,
  vmCpuTelemetrySchema,
} from './readable-review.ts';
import { generateReviewPermalink, isReviewPermalink } from './review-url.ts';

export const HANDLED_PLUGIN_IDS = new Set([
  'cpu.bench',
  'memory.sysbench',
  'memory.stream',
  'memory.latency',
  'memory.numa',
  'disk.health',
  'disk.fio',
  'network.iperf3',
  'network.taier',
  'network.cloudflare',
  'network.inetspeed',
  'network.tcping',
  'network.trace',
  'network.bgp',
  'ip.quality',
  'ip.media',
]);

export const HANDLED_CPU_SUITES = new Set([
  'geekbench',
  'sysbench',
  'unixbench',
  'seven_zip',
  'passmark',
  'hpl',
  'ycruncher',
  'prime95',
]);

const ALLOWED_SVG_TAGS = new Set(['svg', 'g', 'text', 'rect', 'line', 'path']);

const ALLOWED_SVG_ATTRS = new Set([
  'xmlns',
  'viewBox',
  'width',
  'height',
  'fill',
  'font-family',
  'font-size',
  'text-anchor',
  'stroke',
  'stroke-width',
  'opacity',
  'rx',
  'font-weight',
  'dominant-baseline',
  'x1',
  'x2',
  'y1',
  'y2',
  'x',
  'y',
  'd',
  'stroke-dasharray',
]);

export const benchOfferSchema = z.object({
  plan: z.string().trim().min(1).optional(),
  cpu: z.string().trim().min(1),
  memory: z.string().trim().min(1),
  disk: z.string().trim().min(1),
  raid: z.string().trim().min(1).optional(),
  port: z.string().trim().min(1),
  traffic: z.string().trim().min(1),
  ip: z.string().trim().min(1),
  ipmi: z.string().trim().min(1).optional(),
  delivery: z.string().trim().min(1).optional(),
  monthly: z.string().trim().min(1),
  setup: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
});

export const benchPlanSchema = z.object({
  name: z.string().trim().min(1),
  cpu: z.string().trim().min(1),
  memory: z.string().trim().min(1),
  disk: z.string().trim().min(1),
  traffic: z.string().trim().min(1),
  port: z.string().trim().min(1).optional(),
  features: z.string().trim().min(1).optional(),
  price: z.string().trim().min(1).optional(),
  url: z.url().optional(),
});

export const benchEditorialSchema = z.object({
  reviewType: z.enum(['vps', 'dedicated']).optional(),
  draft: z.boolean().default(true),
  title: z.string().trim().min(1).optional(),
  permalink: z
    .string()
    .refine(isReviewPermalink, 'Use /reviews/{normalized-title}-{YYYYMMDD}/')
    .optional(),
  description: z.string().trim().min(1).optional(),
  author: z.string().trim().min(1).default('jam'),
  publishedAt: z.iso.date(),
  updatedAt: z.iso.date().optional(),
  testedAt: z.string().trim().min(10),
  vendor: z.string().trim().min(1),
  country: z.string().regex(/^([A-Z]{2})?$/),
  location: z.string().trim().min(1),
  geo: z.object({
    city: z.string().trim().min(1),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  categories: z.array(z.string().trim().min(1)).optional(),
  tags: z.array(z.string().trim().min(1)).default([]),
  affiliate: z.boolean().default(false),
  purchaseUrl: z.url().optional(),
  tosUrl: z.url().optional(),
  aupUrl: z.url().optional(),
  price: z.string().trim().min(1).optional(),
  coupon: z.string().trim().min(1).optional(),
  terms: z.string().trim().min(1).optional(),
  offer: benchOfferSchema.optional(),
  plans: z.array(benchPlanSchema).min(1).optional(),
  planNotes: z.string().trim().min(1).optional(),
  verdict: z.string().trim().min(1).optional(),
  verdictParagraphs: z.array(z.string().trim().min(1)).optional(),
  omittedSections: z.array(z.string().trim().min(1)).default([]),
});

export type BenchEditorialInput = z.input<typeof benchEditorialSchema>;

export interface RenderedBenchAsset {
  filename: string;
  publicPath: string;
  content: string;
}

export interface RenderedBenchReview {
  mdx: string;
  frontmatter: Record<string, unknown>;
  permalink: string;
  reviewType: 'vps' | 'dedicated';
  omittedSections: string[];
  assets: RenderedBenchAsset[];
}

const RISK_LEVEL_CN: Record<string, string> = {
  Low: '低风险',
  Medium: '中风险',
  High: '高风险',
  VeryHigh: '极高风险',
};

const USAGE_TYPE_CN: Record<string, string> = {
  Residential: '住宅宽带（Residential）',
  Business: '商业网络（Business）',
  Hosting: '数据中心（Hosting）',
  Mobile: '移动网络（Mobile）',
  Education: '教育网络（Education）',
  Government: '政府网络（Government）',
  ContentDelivery: '内容分发（CDN）',
};

const GREYNOISE_CN: Record<string, string> = {
  NotObserved: '未观测到扫描噪声',
  Benign: '良性服务节点',
  Malicious: '恶意活动标记',
  Unknown: '未分类',
};

const FACTOR_CN: Record<string, string> = {
  Proxy: '代理（Proxy）',
  Vpn: 'VPN',
  Tor: 'Tor 出口',
  Datacenter: '机房属性（Datacenter）',
  Abuser: '滥用记录（Abuser）',
  Robot: '自动化爬虫（Robot）',
  Bogon: '保留/未分配地址（Bogon）',
};

const MEDIA_VERDICT_CN: Record<string, string> = {
  Yes: '可用',
  No: '不支持',
  OriginalsOnly: '仅自制内容',
  Unexpected: '结果未确定',
  BlockedWaf: 'WAF 拦截',
  RateLimited: '请求受限',
  TimedOut: '超时',
  NoAddress: '无地址',
};

const MEDIA_RESTRICTION_CN: Record<string, string> = {
  ChinaMainland: 'ChinaMainland',
  ComingSoon: 'ComingSoon',
  ProxyDetected: 'ProxyDetected',
};

const TAIER_CITIES_CN: Record<string, string> = {
  Beijing: '北京',
  Shanghai: '上海',
  Guangzhou: '广州',
  Shenzhen: '深圳',
  Chengdu: '成都',
  Hangzhou: '杭州',
  Nanjing: '南京',
  Wuhan: '武汉',
  Xian: '西安',
  Tianjin: '天津',
};

const TAIER_OPS_CN: Record<string, string> = {
  telecom: '电信',
  unicom: '联通',
  mobile: '移动',
  cernet: '教育网',
  cbn: '广电',
  other: '其他',
};

type AnyRecord = Record<string, any>;

function val(x: unknown, digits = 2): string | null {
  return typeof x === 'number' && Number.isFinite(x) ? x.toFixed(digits) : null;
}

function gib(bytes: unknown): string | null {
  return typeof bytes === 'number' && Number.isFinite(bytes)
    ? `${(bytes / 2 ** 30).toFixed(2)} GiB`
    : null;
}

function mib(bytes: unknown): string | null {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return null;
  const n = bytes / 2 ** 20;
  const formatted = Number.isInteger(n)
    ? String(n)
    : Number(n.toPrecision(6)).toString();
  return `${formatted} MiB`;
}

function gbDec(bytes: unknown): string | null {
  return typeof bytes === 'number' && Number.isFinite(bytes)
    ? `${(bytes / 1e9).toFixed(2)} GB`
    : null;
}

function fmtUptime(sec: unknown): string | null {
  if (typeof sec !== 'number' || !Number.isFinite(sec)) return null;
  const total = Math.trunc(sec);
  const days = Math.floor(total / 86400);
  const rem1 = total % 86400;
  const hours = Math.floor(rem1 / 3600);
  const mins = Math.floor((rem1 % 3600) / 60);
  if (days > 0) return `${days} 天 ${hours} 小时 ${mins} 分`;
  if (hours > 0) return `${hours} 小时 ${mins} 分`;
  return `${mins} 分`;
}

function fmtMmSs(sec: number): string {
  const total = Math.round(sec);
  const mins = Math.floor(total / 60);
  const rem = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function expandIpv6Hextets(addr: string): string[] | null {
  const zoneStripped = addr.split('%')[0]!;
  let working = zoneStripped;
  if (working.includes('.')) {
    const lastColon = working.lastIndexOf(':');
    const v4Part = working.slice(lastColon + 1);
    if (isIP(v4Part) !== 4) return null;
    const octets = v4Part.split('.').map(Number);
    const hi = ((octets[0]! << 8) | octets[1]!).toString(16);
    const lo = ((octets[2]! << 8) | octets[3]!).toString(16);
    working = `${working.slice(0, lastColon)}:${hi}:${lo}`;
  }
  const halves = working.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - (left.length + right.length);
  if (halves.length === 1 && left.length !== 8) return null;
  if (halves.length === 2 && missing < 1) return null;
  const full =
    halves.length === 2
      ? [...left, ...Array.from({ length: missing }, () => '0'), ...right]
      : left;
  if (full.length !== 8) return null;
  return full.map((part) => part.toLowerCase().padStart(4, '0'));
}

export function maskIpAddress(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const trimmed = raw.trim();
  const family = isIP(trimmed);
  if (family === 4) {
    const parts = trimmed.split('.');
    return `${parts[0]}.${parts[1]}.*.*`;
  }
  if (family === 6) {
    const hextets = expandIpv6Hextets(trimmed);
    return hextets ? `${hextets[0]}:${hextets[1]}:…` : '已隐去';
  }
  if (trimmed.includes('*') || trimmed.includes('…')) return trimmed;
  return '已隐去';
}

export function maskCidrPrefix(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const trimmed = raw.trim();
  if (trimmed.includes('*') || trimmed.includes('…')) return trimmed;
  const slash = trimmed.indexOf('/');
  if (slash === -1) return maskIpAddress(trimmed);
  const ip = trimmed.slice(0, slash);
  const len = trimmed.slice(slash + 1);
  const family = isIP(ip);
  if (family === 4) {
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.*.*` + `/${len}`;
  }
  if (family === 6) {
    const hextets = expandIpv6Hextets(ip);
    return hextets ? `${hextets[0]}:${hextets[1]}:…/${len}` : '已隐去';
  }
  return trimmed;
}

export function sanitizeBgpSvg(
  svgSource: string,
  redactions: Array<[string, string]> = [],
): string {
  const trimmed = svgSource.trim();
  if (!trimmed) throw new Error('Empty BGP SVG payload');
  if (
    /<!(?:DOCTYPE|ENTITY|\[CDATA\[)|<!--/i.test(trimmed) ||
    /<(?:script|foreignObject|iframe|image|use|a|style)\b/i.test(trimmed)
  ) {
    throw new Error('Disallowed XML construct or active tag in BGP SVG');
  }
  const withoutXmlDecl = trimmed.replace(/^<\?xml[^?]*\?>\s*/i, '');
  if (
    !withoutXmlDecl.startsWith('<svg') ||
    !withoutXmlDecl.endsWith('</svg>')
  ) {
    throw new Error('BGP SVG root element must be <svg>');
  }

  const stack: string[] = [];
  const tagRegex = /<\/?([A-Za-z][A-Za-z0-9:_-]*)([^>]*?)(\/?)>/g;
  for (const match of withoutXmlDecl.matchAll(tagRegex)) {
    const full = match[0]!;
    const rawTag = match[1]!;
    const attrChunk = match[2] ?? '';
    const selfClosing = match[3] === '/';
    const isClosing = full.startsWith('</');
    const localTag = rawTag.includes(':') ? rawTag.split(':').at(-1)! : rawTag;

    if (!ALLOWED_SVG_TAGS.has(localTag)) {
      throw new Error(`Disallowed BGP SVG element <${rawTag}>`);
    }
    if (isClosing) {
      if (attrChunk.trim() !== '') {
        throw new Error(`Unexpected attributes on closing tag </${rawTag}>`);
      }
      const expected = stack.pop();
      if (expected !== localTag) {
        throw new Error(
          `Mismatched BGP SVG closing tag </${localTag}> (expected </${expected ?? 'none'}>)`,
        );
      }
      continue;
    }

    const attrRegex =
      /([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let consumed = '';
    for (const attrMatch of attrChunk.matchAll(attrRegex)) {
      consumed += attrMatch[0];
      const attrName = attrMatch[1]!;
      const attrVal = attrMatch[2] ?? attrMatch[3] ?? '';
      if (!ALLOWED_SVG_ATTRS.has(attrName)) {
        throw new Error(
          `Disallowed BGP SVG attribute "${attrName}" on <${localTag}>`,
        );
      }
      if (/url\s*\(|javascript:|data:/i.test(attrVal)) {
        throw new Error(
          `Disallowed external/script reference in BGP SVG attribute "${attrName}"`,
        );
      }
    }
    if (attrChunk.replace(attrRegex, '').trim() !== '') {
      throw new Error(`Malformed attributes on BGP SVG <${localTag}>`);
    }
    if (!selfClosing) stack.push(localTag);
  }
  if (stack.length > 0) {
    throw new Error(`Unclosed BGP SVG tags: ${stack.join(', ')}`);
  }

  let normalized = withoutXmlDecl;
  if (!/^<svg\b[^>]*\bxmlns=/.test(normalized)) {
    normalized = normalized.replace(
      /^<svg\b/,
      '<svg xmlns="http://www.w3.org/2000/svg"',
    );
  }
  for (const [needle, replacement] of redactions) {
    if (needle && needle !== replacement) {
      normalized = normalized.replaceAll(needle, replacement);
    }
  }
  return `<?xml version='1.0' encoding='utf-8'?>\n${normalized}\n`;
}

interface MarkdownLinkCell {
  __markdownLink: { label: string; url: string };
}

function linkCell(label: string, url: string): MarkdownLinkCell {
  return { __markdownLink: { label, url } };
}

function escapeCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (
    typeof value === 'object' &&
    value !== null &&
    '__markdownLink' in (value as AnyRecord)
  ) {
    const { label, url } = (value as MarkdownLinkCell).__markdownLink;
    return `[${escapeCell(label)}](${url})`;
  }
  return String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('|', '\\|')
    .replaceAll('*', '\\*')
    .replaceAll('_', '\\_')
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]')
    .replaceAll('`', '\\`')
    .replaceAll('<', '\\<')
    .replaceAll('\n', ' ');
}

function renderTable(headers: readonly string[], rows: unknown[][]): string {
  if (rows.length === 0) {
    throw new Error(`Cannot render empty table (${headers.join(' | ')})`);
  }
  for (const row of rows) {
    if (row.length !== headers.length) {
      throw new Error(
        `Table row width ${row.length} does not match header width ${headers.length} (${headers.join(' | ')})`,
      );
    }
  }
  const allRows = [
    headers.map((h) => escapeCell(h)),
    headers.map(() => '---'),
    ...rows.map((r) => r.map((v) => escapeCell(v))),
  ];
  return allRows.map((r) => `| ${r.join(' | ')} |`).join('\n');
}

function formatIpOrigin(orig: unknown): string {
  if (orig === 'Unknown' || orig === null || orig === undefined) return '未知';
  if (typeof orig === 'object') {
    const obj = orig as AnyRecord;
    if (obj.Native) return `原生 IP（${obj.Native.country}）`;
    if (obj.Broadcast) {
      return `广播 IP（注册地 ${obj.Broadcast.registered}，定位 ${obj.Broadcast.located}）`;
    }
  }
  return String(orig);
}

function formatIpLocation(city: unknown, region: unknown): string | null {
  const c = typeof city === 'string' ? city.trim() : '';
  const r = typeof region === 'string' ? region.trim() : '';
  if (c && r) {
    return c.toLowerCase() === r.toLowerCase() ? c : `${c}, ${r}`;
  }
  return c || r || null;
}

function formatAsnUsage(
  asnUsage: unknown,
  usageSources: unknown,
): string | null {
  if (typeof asnUsage !== 'string' || !asnUsage) return null;
  const primaryLabel = USAGE_TYPE_CN[asnUsage] ?? asnUsage;
  if (!Array.isArray(usageSources)) return primaryLabel;
  const diffs: string[] = [];
  for (const entry of usageSources as AnyRecord[]) {
    if (
      entry &&
      typeof entry.asn_usage === 'string' &&
      entry.asn_usage !== asnUsage
    ) {
      diffs.push(
        `${entry.source}: ${USAGE_TYPE_CN[entry.asn_usage] ?? entry.asn_usage}`,
      );
    }
  }
  return diffs.length > 0
    ? `${primaryLabel}（${diffs.join('，')}）`
    : primaryLabel;
}

function formatCompanyUsage(
  companyUsage: unknown,
  dualIsp: unknown,
): string | null {
  if (typeof companyUsage !== 'string' || !companyUsage) {
    return dualIsp === true ? '双 ISP' : null;
  }
  const base = USAGE_TYPE_CN[companyUsage] ?? companyUsage;
  return dualIsp === true ? `${base}（双 ISP）` : base;
}

function redactInlineIpTokens(text: string): string {
  return text.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, (m) => {
    const masked = maskIpAddress(m);
    return masked ? `\`${masked}\`` : m;
  });
}

function formatScoreVerdict(verdict: unknown): string {
  if (typeof verdict === 'string') {
    return MEDIA_VERDICT_CN[verdict] ?? verdict;
  }
  if (verdict && typeof verdict === 'object') {
    const v = verdict as AnyRecord;
    if (v.Numeric) {
      const n = v.Numeric;
      return `${n.score} / ${n.max}（${RISK_LEVEL_CN[n.level] ?? n.level}）`;
    }
    if (v.Ratio) {
      const r = v.Ratio;
      return `${r.text}（${RISK_LEVEL_CN[r.level] ?? r.level}）`;
    }
    if (v.GreyNoise) {
      const g = v.GreyNoise;
      const cls = GREYNOISE_CN[g.classification] ?? g.classification;
      return `${cls}（Noise: ${g.noise ? '是' : '否'}，RIOT: ${g.riot ? '是' : '否'}）`;
    }
    if (v.Shodan) {
      const sh = v.Shodan;
      return `开放端口 ${sh.ports}，已知漏洞 ${sh.vulns}（${sh.flagged ? '已标记风险' : '未标记风险'}）`;
    }
    if (v.Unexpected) return `返回异常（${v.Unexpected}）`;
  }
  return String(verdict);
}

function formatMailStatus(stObj: unknown): string {
  if (stObj === 'Blocked') return '25 端口封锁';
  if (stObj === 'NoAddress') return '无可用地址';
  if (stObj && typeof stObj === 'object') {
    const s = stObj as AnyRecord;
    if ('Deliverable' in s) return `可达（SMTP ${s.Deliverable}）`;
    if ('Rejected' in s) return `远端拒绝（SMTP ${s.Rejected}）`;
    if ('Unexpected' in s) return `响应异常（${s.Unexpected}）`;
  }
  return String(stObj);
}

function formatDiskHealthLocation(loc: unknown, severalCards = false): string {
  if (loc && typeof loc === 'object') {
    const l = loc as AnyRecord;
    if (typeof l.Named === 'string') return l.Named;
    if (l.Card) {
      const nums = (l.Card.numbers ?? []).join(':');
      return severalCards
        ? `RAID Host ${l.Card.host} [${nums}]`
        : `RAID 槽位 [${nums}]`;
    }
  }
  return String(loc ?? '—');
}

function formatDiskHealthVerdict(health: unknown): string {
  if (typeof health === 'string') {
    const map: Record<string, string> = {
      Passed: '通过（Passed）',
      Failed: '失败（Failed）',
      Unsupported: '不支持 SMART',
    };
    return map[health] ?? health;
  }
  if (health && typeof health === 'object') {
    const h = health as AnyRecord;
    if (h.Unknown) {
      return h.Unknown.smart_off ? '未知（SMART 已关闭）' : '未知';
    }
    if (h.ReadFailed) {
      if (typeof h.ReadFailed === 'string') {
        const faultMap: Record<string, string> = {
          Unparsable: '返回无法解析',
          Unopened: '无法打开设备',
          Refused: '参数被拒绝',
        };
        return `读取失败（${faultMap[h.ReadFailed] ?? h.ReadFailed}）`;
      }
      if (h.ReadFailed.Message) return `读取失败（${h.ReadFailed.Message}）`;
      return `读取失败（${JSON.stringify(h.ReadFailed)}）`;
    }
  }
  return String(health ?? '—');
}

function formatDiskWritten(bytes: unknown): string | null {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) {
    return null;
  }
  if (bytes < 1e12) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes < 1e15) return `${(bytes / 1e12).toFixed(2)} TB`;
  return `${(bytes / 1e15).toFixed(2)} PB`;
}

function formatDiskErrors(
  badBlocks: unknown,
  interfaceErrors: unknown,
): string | number | null {
  let badPart: string | null = null;
  if (badBlocks && typeof badBlocks === 'object') {
    const b = badBlocks as AnyRecord;
    if ('Count' in b && b.Count !== null && b.Count !== undefined) {
      badPart = String(b.Count);
    } else if (b.Sectors) {
      const realloc = b.Sectors.reallocated;
      const pending = b.Sectors.pending;
      if (realloc !== null || pending !== null) {
        badPart = `重映射 ${realloc ?? '—'} / 待定 ${pending ?? '—'}`;
      }
    }
  }
  const hasCrc =
    typeof interfaceErrors === 'number' && Number.isFinite(interfaceErrors);
  if (badPart !== null && hasCrc) {
    return `${badPart} · CRC ${interfaceErrors}`;
  }
  if (badPart !== null) return badPart;
  if (hasCrc) return `CRC ${interfaceErrors}`;
  return null;
}

const ECC_MODE_CN: Record<string, string> = {
  none: '无 ECC',
  parity: '奇偶校验（Parity）',
  single_bit: '单比特纠错 ECC（SECDED）',
  multi_bit: '多比特纠错 ECC（Multi-bit）',
  crc: 'CRC 校验',
  unknown: '未知',
};

const RAID_ATTACHMENT_CN: Record<string, string> = {
  array: '阵列卷',
  pass_through: '直通盘',
  unknown: '通道未知',
};

function formatHwLine(line: AnyRecord | null | undefined): string | null {
  if (!line || typeof line !== 'object') return null;
  const name = typeof line.name === 'string' ? line.name.trim() : '';
  const vendorRaw = typeof line.vendor === 'string' ? line.vendor.trim() : '';
  const vendor =
    vendorRaw &&
    (!name || !name.toLowerCase().startsWith(vendorRaw.toLowerCase()))
      ? vendorRaw
      : '';
  const main = [vendor, name].filter(Boolean).join(' ');
  const detail = typeof line.detail === 'string' ? line.detail.trim() : '';
  if (!main && !detail) return null;
  if (!main) return detail;
  return detail ? `${main}（${detail}）` : main;
}

function formatFirmwareLine(fw: AnyRecord | null | undefined): string | null {
  if (!fw || typeof fw !== 'object') return null;
  if (fw.kind === 'u_boot') {
    return fw.version ? `U-Boot ${fw.version}` : 'U-Boot';
  }
  if (fw.kind === 'raspberry_pi') {
    const built =
      typeof fw.timestamp === 'number'
        ? new Date(fw.timestamp * 1000).toISOString().slice(0, 10)
        : null;
    return built
      ? `Raspberry Pi Bootloader（${built}）`
      : 'Raspberry Pi Bootloader';
  }
  const main = [fw.vendor, fw.version].filter(Boolean).join(' ');
  const dateStr =
    typeof fw.date === 'string' && fw.date.trim() ? fw.date.trim() : '';
  if (!main && !dateStr) return null;
  return dateStr ? `${main || 'BIOS'}（${dateStr}）` : main;
}

function formatBmcLine(bmc: AnyRecord | null | undefined): string | null {
  if (!bmc || typeof bmc !== 'object') return null;
  if (bmc.source === 'acpi') return 'ACPI IPMI 设备（IPI0001）';
  const parts = [
    bmc.vendor ?? null,
    bmc.firmware ? `固件 ${bmc.firmware}` : null,
    bmc.ipmi ? `IPMI ${bmc.ipmi}` : null,
    bmc.interface ? `接口 ${String(bmc.interface).toUpperCase()}` : null,
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(' · ');
  return bmc.source === 'driver' ? 'IPMI 驱动已就绪' : '固件声明支持 BMC';
}

function formatSlotCapacity(slot: AnyRecord): string {
  if (slot.status === 'empty') return '空槽';
  if (slot.status === 'disabled') return '已插未启用';
  if (slot.status === 'unknown') return '未知容量';
  const bytes = slot.size_bytes;
  if (typeof bytes === 'number' && bytes > 0) {
    if (bytes % 2 ** 30 === 0) return `${bytes / 2 ** 30} GB`;
    if (bytes % 2 ** 20 === 0) return `${bytes / 2 ** 20} MB`;
    return gib(bytes) ?? '—';
  }
  return '—';
}

function formatSlotSpeed(slot: AnyRecord): string | null {
  const cfg = slot.configured_speed_mts;
  const rated = slot.speed_mts;
  if (cfg && rated) {
    return cfg === rated ? `${cfg} MT/s` : `${cfg} / ${rated} MT/s`;
  }
  if (cfg) return `${cfg} MT/s`;
  if (rated) return `额定 ${rated} MT/s`;
  return null;
}

function formatIperfWay(way: unknown): {
  mbps: string | null;
  retransmits: number | null;
  rttMs: string | null;
} {
  if (typeof way === 'string') {
    const map: Record<string, string> = {
      Busy: '节点繁忙',
      Unreachable: '不可达',
      Nothing: '无数据',
      Skipped: '跳过',
    };
    return { mbps: map[way] ?? way, retransmits: null, rttMs: null };
  }
  if (way && typeof way === 'object') {
    const w = way as AnyRecord;
    if (w.Measured) {
      const m = w.Measured;
      return {
        mbps: val(m.bits / 1e6),
        retransmits: m.retransmits ?? null,
        rttMs: m.rtt !== null && m.rtt !== undefined ? val(m.rtt / 1000) : null,
      };
    }
    if (w.Error)
      return { mbps: `错误（${w.Error}）`, retransmits: null, rttMs: null };
    if (w.Fault) return { mbps: '执行异常', retransmits: null, rttMs: null };
  }
  return { mbps: String(way ?? '—'), retransmits: null, rttMs: null };
}

function cnTargetName(rawName: string): string {
  let name = rawName;
  for (const [en, cn] of Object.entries({
    ...TAIER_CITIES_CN,
    Telecom: '电信',
    Unicom: '联通',
    Mobile: '移动',
  })) {
    name = name.replaceAll(en, cn);
  }
  return name.replace(
    /(北京|上海|广州|深圳|成都|杭州|南京|武汉|西安|天津)\s+(电信|联通|移动|教育网|广电)/g,
    '$1$2',
  );
}

function operatorLabel(ans: AnyRecord, isNetflix: boolean): string | null {
  const net = ans.network ?? null;
  const ex = isNetflix ? (ans.exchange ?? null) : null;
  if (ex && net) return `${net} [${ex}]`;
  if (ex) return `[${ex}]`;
  return net;
}

function buildHopRows(hops: AnyRecord[], isNetflix: boolean): unknown[][] {
  const rows: unknown[][] = [];
  for (let i = 0; i < hops.length; i += 1) {
    const hopNum = i + 1;
    const answers: AnyRecord[] = hops[i]?.answers ?? [];
    if (answers.length === 0) {
      rows.push([hopNum, '*', null, null, null, null]);
      continue;
    }
    for (const ans of answers) {
      rows.push([
        hopNum,
        maskIpAddress(ans.address),
        ans.asn ?? null,
        operatorLabel(ans, isNetflix),
        ans.place ?? null,
        typeof ans.latency === 'number' ? val(ans.latency / 1000, 3) : null,
      ]);
    }
  }
  return rows;
}

function formatRouteOutcome(
  routeObj: AnyRecord,
  prefix = '',
): { note: string; hops: AnyRecord[] | null } {
  if (routeObj.Traced) {
    const tr = routeObj.Traced;
    const frag = tr.fragmented;
    let status: string;
    if (frag) {
      const mtuTxt = frag.mtu ? `，路由器最大允许 ${frag.mtu} 字节` : '';
      status = `在第 ${frag.hop} 跳因需要分片停止${mtuTxt}。`;
    } else if (tr.reached) {
      status = '已到达目标。';
    } else {
      status = '未到达目标，以下是实际收到的应答。';
    }
    return { note: `${prefix}${status}`, hops: tr.hops ?? [] };
  }
  if (routeObj.Unavailable) {
    return {
      note: `${prefix}目标不可用（${JSON.stringify(routeObj.Unavailable)}）。`,
      hops: null,
    };
  }
  if (routeObj.Failed) {
    return {
      note: `${prefix}探测失败（${JSON.stringify(routeObj.Failed)}）。`,
      hops: null,
    };
  }
  return { note: `${prefix}未知状态。`, hops: null };
}

function yamlScalar(value: unknown, forceSingleQuote = false): string {
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }
  const str = String(value);
  if (
    forceSingleQuote ||
    str === '' ||
    /^\d{4}-\d{2}-\d{2}/.test(str) ||
    /^[:#[\]{}&*!|>'"%@`?-]|\s$|^\s|:\s|#/.test(str)
  ) {
    return `'${str.replaceAll("'", "''")}'`;
  }
  return `'${str.replaceAll("'", "''")}'`;
}

function serializeFrontmatter(fm: Record<string, unknown>): string {
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(fm)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(
          `${key}: [${value.map((item) => yamlScalar(item)).join(', ')}]`,
        );
      }
      continue;
    }
    if (value && typeof value === 'object') {
      lines.push(`${key}:`);
      for (const [subKey, subVal] of Object.entries(value as AnyRecord)) {
        if (subVal === undefined) continue;
        lines.push(`  ${subKey}: ${yamlScalar(subVal)}`);
      }
      continue;
    }
    lines.push(`${key}: ${yamlScalar(value)}`);
  }
  lines.push('---');
  return lines.join('\n');
}

export function renderBenchReport(
  rawReport: unknown,
  rawEditorial: BenchEditorialInput,
  options: { assetSlug: string },
): RenderedBenchReview {
  if (!rawReport || typeof rawReport !== 'object') {
    throw new Error('Invalid benchmark report JSON: expected top-level object');
  }
  const report = rawReport as AnyRecord;
  if (
    typeof report.version !== 'string' ||
    !report.system ||
    !Array.isArray(report.runs) ||
    !report.summary
  ) {
    throw new Error(
      'Invalid benchmark report JSON: missing version, system, runs, or summary',
    );
  }

  for (const run of report.runs as AnyRecord[]) {
    if (!HANDLED_PLUGIN_IDS.has(run.id)) {
      throw new Error(
        `Unhandled benchmark plugin "${run.id}" in lowendaff-bench ${report.version}; update src/lib/bench-report-import.ts before importing`,
      );
    }
  }

  const completedRuns: Record<string, AnyRecord> = {};
  for (const run of report.runs as AnyRecord[]) {
    if (run.status === 'completed' && run.output !== null) {
      completedRuns[run.id] = run.output;
    }
  }

  const cpuDone: Record<string, AnyRecord> = {};
  if (completedRuns['cpu.bench']) {
    for (const [suiteKey, suiteVal] of Object.entries(
      completedRuns['cpu.bench'],
    )) {
      if (suiteKey === 'suites' || suiteVal === null) continue;
      if (!HANDLED_CPU_SUITES.has(suiteKey)) {
        throw new Error(
          `Unhandled CPU benchmark suite "${suiteKey}" in cpu.bench; update src/lib/bench-report-import.ts before importing`,
        );
      }
      if (
        typeof suiteVal === 'object' &&
        (suiteVal as AnyRecord).status === 'done' &&
        (suiteVal as AnyRecord).output
      ) {
        cpuDone[suiteKey] = (suiteVal as AnyRecord).output;
      }
    }
  }

  const editorial = benchEditorialSchema.parse(rawEditorial);
  const sys = report.system as AnyRecord;
  const inferredType: 'vps' | 'dedicated' =
    sys.platform?.kind === 'dedicated' ? 'dedicated' : 'vps';
  const reviewType = editorial.reviewType ?? inferredType;

  const hw = sys.hardware?.state === 'done' ? sys.hardware.data : null;
  const cpuInfo = sys.cpu?.state === 'done' ? sys.cpu.data : null;
  const memInfo = sys.memory?.state === 'done' ? sys.memory.data : null;
  const storInfo = sys.storage?.state === 'done' ? sys.storage.data : null;
  const osInfo = sys.os?.state === 'done' ? sys.os.data : null;
  const cardsInfo: AnyRecord[] =
    sys.cards?.state === 'done' ? (sys.cards.data ?? []) : [];

  if (!cpuInfo || !memInfo || !storInfo || !osInfo) {
    throw new Error(
      'Benchmark report is missing completed system profile facts (cpu, memory, storage, or os)',
    );
  }

  const traceOut = completedRuns['network.trace'];
  const traceV4: AnyRecord[] = traceOut?.ipv4 ?? [];
  const traceV6: AnyRecord[] = traceOut?.ipv6 ?? [];
  const tcpV4 = traceV4.filter((r) => r.tcp !== null && r.tcp !== undefined);
  const tcpV6 = traceV6.filter((r) => r.tcp !== null && r.tcp !== undefined);

  const gbScores = cpuDone.geekbench?.scores ?? null;
  const defaultTitle =
    reviewType === 'dedicated'
      ? `${editorial.vendor} ${editorial.location} ${hw?.board?.name ?? cpuInfo.model ?? ''} 独立服务器测试记录`.replace(
          /\s+/g,
          ' ',
        )
      : `${editorial.vendor} ${editorial.location} ${cpuInfo.model ?? ''} VPS 测试记录`.replace(
          /\s+/g,
          ' ',
        );
  const title = editorial.title ?? defaultTitle;
  const permalink =
    editorial.permalink ?? generateReviewPermalink(title, editorial.testedAt);

  const defaultDesc = (() => {
    const cpuLead =
      reviewType === 'dedicated'
        ? `${cpuInfo.cores ?? cpuInfo.logical} 核 ${cpuInfo.model}，${gib(memInfo.total_bytes)} 内存。`
        : `${cpuInfo.logical} vCPU ${cpuInfo.model}（${(sys.platform?.hypervisor ?? sys.platform?.container ?? 'VM').toUpperCase()}），${gib(memInfo.total_bytes)} 内存。`;
    const gbLead = gbScores
      ? `Geekbench ${gbScores.version} 单核 ${gbScores.single}、多核 ${gbScores.multi}；`
      : '';
    const routeTail =
      tcpV4.length > 0
        ? `${traceV4.length} 个 IPv4 回程与 ${tcpV4.length} 个 TCP 大包回程。`
        : `${traceV4.length} 个 IPv4 目标回程。`;
    return `${cpuLead}${gbLead}下文记录 CPU 基准、内存、磁盘、三网测速及 ${routeTail}`;
  })();
  const description = editorial.description ?? defaultDesc;

  const price =
    editorial.price ??
    (editorial.offer ? `${editorial.offer.monthly} / 月` : undefined);

  if (editorial.offer && !editorial.purchaseUrl) {
    throw new Error('editorial.offer requires editorial.purchaseUrl');
  }

  const blocks: string[] = [];
  const renderedSectionTitles = new Set<string>();
  const assets: RenderedBenchAsset[] = [];

  const heading = (level: number, label: string) => {
    if (level === 2) renderedSectionTitles.add(label);
    blocks.push(`${'#'.repeat(level)} ${label}`);
  };
  const para = (text: string) => {
    blocks.push(text);
  };
  const table = (headers: readonly string[], rows: unknown[][]) => {
    blocks.push(renderTable(headers, rows));
  };

  // Optional ## 买
  const policyLinks = [
    editorial.tosUrl ? `[服务条款（ToS）](${editorial.tosUrl})` : null,
    editorial.aupUrl ? `[合理使用政策（AUP）](${editorial.aupUrl})` : null,
  ].filter(Boolean);
  const policyLine =
    policyLinks.length > 0 ? `商家条款：${policyLinks.join(' · ')}` : null;

  if (editorial.plans && editorial.plans.length > 0) {
    heading(2, '买');
    const hasPort = editorial.plans.some((p) => Boolean(p.port));
    const hasPrice = editorial.plans.some((p) => Boolean(p.price));
    const hasFeatures = editorial.plans.some((p) => Boolean(p.features));
    const hasUrl = editorial.plans.some((p) => Boolean(p.url));
    const planHeaders = [
      '套餐',
      'CPU',
      '内存',
      '硬盘',
      '流量',
      ...(hasPort ? ['端口'] : []),
      ...(hasFeatures ? ['特性与线路'] : []),
      ...(hasPrice ? ['价格'] : []),
      ...(hasUrl ? ['购买'] : []),
    ];
    table(
      planHeaders,
      editorial.plans.map((p) => [
        p.name,
        p.cpu,
        p.memory,
        p.disk,
        p.traffic,
        ...(hasPort ? [p.port ?? null] : []),
        ...(hasFeatures ? [p.features ?? null] : []),
        ...(hasPrice ? [p.price ?? null] : []),
        ...(hasUrl ? [p.url ? linkCell('立即购买', p.url) : null] : []),
      ]),
    );
    if (editorial.planNotes) para(editorial.planNotes);
    if (policyLine) para(policyLine);
    if (editorial.affiliate) {
      para('这是推广链接，通过该链接购买，本站可能获得佣金。');
    }
  } else if (editorial.offer) {
    const offer = editorial.offer;
    heading(2, '买');
    const offerRows: unknown[][] = [];
    if (offer.plan) offerRows.push(['套餐名称', offer.plan]);
    offerRows.push(
      ['处理器', offer.cpu],
      ['内存', offer.memory],
      ['硬盘', offer.disk],
    );
    if (offer.raid) offerRows.push(['阵列 / RAID', offer.raid]);
    offerRows.push(
      ['公网端口', offer.port],
      ['流量', offer.traffic],
      ['IP 地址', offer.ip],
    );
    if (offer.ipmi) offerRows.push(['带外管理（IPMI / KVM）', offer.ipmi]);
    if (offer.delivery) offerRows.push(['交付时效', offer.delivery]);
    offerRows.push(['月租', price ?? offer.monthly]);
    if (offer.setup) offerRows.push(['一次性初装费', offer.setup]);
    table(['套餐项目', '商家标称配置与费用'], offerRows);
    para(`[前往 ${editorial.vendor} 购买此套餐](${editorial.purchaseUrl})`);
    if (offer.notes) para(offer.notes);
    if (policyLine) para(policyLine);
    if (editorial.affiliate) {
      para('这是推广链接，通过该链接购买，本站可能获得佣金。');
    }
  }

  // Optional ## 评
  if (editorial.verdictParagraphs && editorial.verdictParagraphs.length > 0) {
    heading(2, '评');
    for (const p of editorial.verdictParagraphs) para(p);
  }

  // ## 系统信息
  const summary = report.summary as AnyRecord;
  heading(2, '系统信息');
  heading(3, '实测平台');
  const mins = Math.floor(summary.total_seconds / 60);
  const secs = Math.floor(summary.total_seconds % 60);
  if (reviewType === 'dedicated') {
    para(
      `lowendaff-bench ${report.version} 完成 ${summary.completed} 个测试组，用时 ${mins} 分 ${secs} 秒。系统未检测到虚拟化（${sys.arch ?? '—'}）。以下均为本机本轮读数。`,
    );
    const allSlots: AnyRecord[] = Array.isArray(hw?.slots) ? hw.slots : [];
    const installedSlots = allSlots.filter((sl) => sl.status === 'installed');
    const uniqueGenForms = Array.from(
      new Set(
        installedSlots
          .map((sl) => [sl.generation, sl.form].filter(Boolean).join(' '))
          .filter(Boolean),
      ),
    );
    const uniqueSpeeds = Array.from(
      new Set(
        installedSlots
          .map((sl) => sl.configured_speed_mts ?? sl.speed_mts)
          .filter(Boolean),
      ),
    );
    const dimmSummary =
      installedSlots.length > 0
        ? `（${installedSlots.length} 条${uniqueGenForms.length > 0 ? ` ${uniqueGenForms.join('/')}` : ' DIMM'}${uniqueSpeeds.length > 0 ? ` @ ${uniqueSpeeds.join('/')} MT/s` : ''}）`
        : '';
    const memUsedTxt =
      typeof memInfo.used_bytes === 'number'
        ? `（采样已用 ${mib(memInfo.used_bytes)}）`
        : '';
    const memLine = hw?.board_memory_bytes
      ? `${gib(hw.board_memory_bytes)}${dimmSummary} / 系统可见 ${gib(memInfo.total_bytes)}${memUsedTxt}`
      : `${gib(memInfo.total_bytes)}${dimmSummary}${memUsedTxt}`;

    const eccLabels = ((hw?.ecc_modes ?? []) as string[]).map(
      (m) => ECC_MODE_CN[m] ?? m,
    );
    const edac = hw?.edac_errors;
    const eccLine =
      eccLabels.length > 0 || edac
        ? [
            eccLabels.length > 0 ? eccLabels.join(' / ') : null,
            edac
              ? `EDAC 已纠正 CE ${edac.corrected} 次，未纠正 UE ${edac.uncorrected} 次`
              : null,
          ]
            .filter(Boolean)
            .join('（') + (eccLabels.length > 0 && edac ? '）' : '')
        : null;

    const swapLine =
      memInfo.swap_total_bytes > 0
        ? `${mib(memInfo.swap_total_bytes)}（已用 ${mib(memInfo.swap_used_bytes ?? 0)}）`
        : '0 MiB';
    const machineBoard = [formatHwLine(hw?.machine), formatHwLine(hw?.board)]
      .filter(
        (v, idx, arr): v is string => Boolean(v) && arr.indexOf(v) === idx,
      )
      .join(' / ');
    const fwLine = formatFirmwareLine(hw?.firmware);
    const bmcLine = formatBmcLine(hw?.bmc);
    const aesVirtParts = [
      cpuInfo.aes === true
        ? 'AES 可用'
        : cpuInfo.aes === false
          ? 'AES 未开启'
          : null,
      cpuInfo.virtualization && cpuInfo.virtualization !== 'not_applicable'
        ? `虚拟化 ${cpuInfo.virtualization}`
        : null,
    ].filter(Boolean);
    const platformRows: unknown[][] = [
      ['机型 / 主板', machineBoard || null],
      ['架构 / 处理器', `${sys.arch ?? '—'} / ${cpuInfo.model ?? '—'}`],
      [
        '插槽 / 核心 / 逻辑 CPU',
        `${cpuInfo.sockets ?? '—'} / ${cpuInfo.cores ?? '—'} / ${cpuInfo.logical ?? '—'}（进程可用 ${cpuInfo.usable ?? '—'}${aesVirtParts.length > 0 ? `，${aesVirtParts.join('，')}` : ''}）`,
      ],
      [
        '报告频率',
        cpuInfo.mhz !== null && cpuInfo.mhz !== undefined
          ? `${Number(cpuInfo.mhz.toFixed(3))} MHz`
          : null,
      ],
      [
        'CPU 缓存',
        (cpuInfo.caches ?? [])
          .map(
            (x: AnyRecord) =>
              `${x.name} ${Math.floor(x.size_bytes / 1024)} KiB`,
          )
          .join('、') || null,
      ],
      ['物理内存 / 系统可见', memLine],
    ];
    if (eccLine) platformRows.push(['ECC 与内存纠错', eccLine]);
    platformRows.push(['系统采样时的 swap', swapLine]);
    platformRows.push(['固件', fwLine]);
    if (bmcLine) platformRows.push(['带外管理（BMC）', bmcLine]);
    platformRows.push(
      [
        '系统 / 内核 / C 库',
        `${osInfo.distribution ?? '—'} / ${osInfo.kernel ?? '—'} / ${sys.libc.kind}${sys.libc.version ? ` ${sys.libc.version}` : ''}`,
      ],
      [
        '系统运行时间',
        fmtUptime(osInfo.uptime_seconds)
          ? `${fmtUptime(osInfo.uptime_seconds)}${osInfo.uptime_from_host ? '（宿主机）' : ''}`
          : null,
      ],
      [
        '采样时系统负载（1 / 5 / 15 min）',
        Array.isArray(osInfo.load)
          ? `${osInfo.load.map((x: number) => x.toFixed(2)).join(' / ')}${osInfo.load_from_host ? '（宿主机）' : ''}`
          : null,
      ],
      [
        '拥塞控制 / 队列',
        `${osInfo.congestion_control ?? '—'} / ${osInfo.qdisc ?? '—'}`,
      ],
    );
    table(['项目', '结果'], platformRows);

    if (allSlots.length > 0) {
      heading(3, '内存插槽（SMBIOS）');
      const emptyCount = allSlots.filter((s) => s.status === 'empty').length;
      const disabledSlots = allSlots
        .map((s, idx) => ({
          slot: s,
          label: s.name ?? `Slot ${idx + 1}`,
        }))
        .filter(({ slot }) => slot.status === 'disabled');
      const summaryBits = [
        `共检测到 ${allSlots.length} 个内存插槽`,
        `已启用 ${installedSlots.length} 条`,
        ...(emptyCount > 0 ? [`空置 ${emptyCount} 个`] : []),
        ...(disabledSlots.length > 0
          ? [`已插未启用 ${disabledSlots.length} 个`]
          : []),
      ];
      para(`${summaryBits.join('，')}。`);
      table(
        ['插槽', '容量 / 状态', '规格', '频率（运行 / 额定）', '厂商', '料号'],
        allSlots.map((sl, idx) => [
          sl.name ?? `Slot ${idx + 1}`,
          formatSlotCapacity(sl),
          [sl.generation, sl.form].filter(Boolean).join(' ') || null,
          formatSlotSpeed(sl),
          sl.manufacturer ?? null,
          sl.part_number ?? null,
        ]),
      );
      if (disabledSlots.length > 0) {
        para(
          `注意：插槽 ${disabledSlots.map((d) => d.label).join('、')} 检测到内存模块信息但处于未启用（Disabled）状态，建议核查内存条状态或主板通道。`,
        );
      }
    }
  } else {
    para(
      `lowendaff-bench ${report.version} 完成 ${summary.completed} 个测试组，用时 ${mins} 分 ${secs} 秒。运行环境为 ${report.environment}（${sys.arch ?? '—'}）。以下均为本机本轮读数。`,
    );
    const virtKind = (
      sys.platform?.hypervisor ??
      sys.platform?.container ??
      'vm'
    ).toUpperCase();
    const quotaTxt =
      cpuInfo.quota !== null && cpuInfo.quota !== undefined
        ? `CFS 配额 ${cpuInfo.quota}`
        : '配额无额外限制';
    const aesTxt =
      cpuInfo.aes === true
        ? 'AES 指令集可用'
        : cpuInfo.aes === false
          ? 'AES 指令集未开启'
          : 'AES 状态未知';
    const disk0 = storInfo.disks?.[0];
    const fs0 = storInfo.filesystems?.[0];
    const diskFsSummary =
      disk0 && fs0
        ? `${disk0.name}（${disk0.model ?? '虚拟磁盘'}，${disk0.interface}，${gbDec(disk0.size_bytes)}） / ${fs0.fs_type}（总计 ${gbDec(fs0.total_bytes)}，已用 ${gbDec(fs0.used_bytes)}，可用 ${gbDec(fs0.available_bytes)}）`
        : fs0
          ? `${fs0.fs_type}（总计 ${gbDec(fs0.total_bytes)}，已用 ${gbDec(fs0.used_bytes)}，可用 ${gbDec(fs0.available_bytes)}）`
          : null;
    table(
      ['项目', '结果'],
      [
        [
          '虚拟化环境',
          `${virtKind}（CPU 虚拟化特征 ${cpuInfo.virtualization ?? '—'}）`,
        ],
        [
          '架构 / 处理器（系统可见）',
          `${sys.arch ?? '—'} / ${cpuInfo.model ?? '—'}`,
        ],
        [
          '分配的 vCPU / 进程可用',
          `${cpuInfo.logical ?? '—'} / ${cpuInfo.usable ?? '—'}（${quotaTxt}，${aesTxt}）`,
        ],
        [
          '报告频率',
          cpuInfo.mhz !== null && cpuInfo.mhz !== undefined
            ? `${cpuInfo.mhz.toFixed(3)} MHz`
            : null,
        ],
        [
          'CPU 缓存',
          (cpuInfo.caches ?? [])
            .map(
              (x: AnyRecord) =>
                `${x.name} ${Math.floor(x.size_bytes / 1024)} KiB`,
            )
            .join('、') || null,
        ],
        [
          '系统可见内存 / 采样时已用',
          `${gib(memInfo.total_bytes)} / ${val(memInfo.used_bytes / 2 ** 20)} MiB`,
        ],
        ['系统采样时的 swap', mib(memInfo.swap_total_bytes)],
        ['虚拟磁盘 / 根文件系统', diskFsSummary],
        [
          '系统 / 内核 / C 库',
          `${osInfo.distribution ?? '—'} / ${osInfo.kernel ?? '—'} / ${sys.libc.kind}${sys.libc.version ? ` ${sys.libc.version}` : ''}`,
        ],
        [
          '系统运行时间',
          fmtUptime(osInfo.uptime_seconds)
            ? `${fmtUptime(osInfo.uptime_seconds)}${osInfo.uptime_from_host ? '（宿主机）' : ''}`
            : null,
        ],
        [
          '采样时系统负载（1 / 5 / 15 min）',
          Array.isArray(osInfo.load)
            ? `${osInfo.load.map((x: number) => x.toFixed(2)).join(' / ')}${osInfo.load_from_host ? '（宿主机）' : ''}`
            : null,
        ],
        [
          '拥塞控制 / 队列',
          `${osInfo.congestion_control ?? '—'} / ${osInfo.qdisc ?? '—'}`,
        ],
      ],
    );
  }

  let hasVmTelemetry = false;
  if (report.vm_cpu_telemetry) {
    const tel = vmCpuTelemetrySchema.parse(report.vm_cpu_telemetry);
    hasVmTelemetry = true;
    heading(3, '虚拟化 CPU 抢占与软中断采样');
    para(
      `测试全程每 ${tel.interval_seconds} 秒记录一次 CPU 状态，共 ${tel.sample_count} 个样本：`,
    );
    blocks.push(`\`\`\`vm-cpu-telemetry\n${JSON.stringify(tel)}\n\`\`\``);
    const { st_pct: st, si_pct: si } = tel;
    table(
      ['指标', '均值', 'P95', '峰值', '峰值出现阶段'],
      [
        [
          '宿主机 CPU 抢占（%st）',
          `${val(st.avg)}%`,
          `${val(st.p95)}%`,
          `${val(st.max)}%`,
          `${st.peak_title}（${fmtMmSs(st.peak_elapsed_seconds)} / ${Math.round(st.peak_elapsed_seconds)} s）`,
        ],
        [
          '软中断开销（%si）',
          `${val(si.avg)}%`,
          `${val(si.p95)}%`,
          `${val(si.max)}%`,
          `${si.peak_title}（${fmtMmSs(si.peak_elapsed_seconds)} / ${Math.round(si.peak_elapsed_seconds)} s）`,
        ],
      ],
    );
  }

  if (completedRuns['memory.sysbench']) {
    const m1 = completedRuns['memory.sysbench'];
    heading(3, 'sysbench 内存读写');
    para(`sysbench ${m1.version ?? '—'}；按线程数比较同一块大小下的读写。`);
    const threadSet = Array.from(
      new Set<number>((m1.runs ?? []).map((r: AnyRecord) => r.threads)),
    ).sort((a, b) => a - b);
    table(
      ['线程数', '每线程块大小', '读取（MiB/s）', '写入（MiB/s）'],
      threadSet.map((n) => {
        const readRun = (m1.runs ?? []).find(
          (r: AnyRecord) => r.operation === 'Read' && r.threads === n,
        );
        const writeRun = (m1.runs ?? []).find(
          (r: AnyRecord) => r.operation === 'Write' && r.threads === n,
        );
        return [
          n,
          mib(n === 1 ? m1.single : (m1.per_thread ?? m1.single)),
          readRun?.rate?.text ?? null,
          writeRun?.rate?.text ?? null,
        ];
      }),
    );
  }

  if (completedRuns['memory.stream']) {
    const m2 = completedRuns['memory.stream'];
    heading(3, 'STREAM 内存带宽');
    let streamNote = `STREAM ${m2.version ?? '—'}，每个数组 ${m2.millions} 百万个元素；以下是各内核的最佳带宽。`;
    if (m2.below_rule) {
      streamNote +=
        '由于测试数组规模未超过三级缓存的 4 倍（below_rule），读数受大容量 L3 缓存加速影响，不能直接代表纯主存带宽。';
    }
    para(streamNote);
    table(
      ['线程', 'Copy（MB/s）', 'Scale（MB/s）', 'Add（MB/s）', 'Triad（MB/s）'],
      (m2.runs ?? []).map((v: AnyRecord) => [
        v.threads,
        ...(v.rates ?? []).map((r: AnyRecord) => r.text),
      ]),
    );
  }

  if (completedRuns['memory.latency']) {
    const m3 = completedRuns['memory.latency'];
    heading(3, '缓存与主存延迟');
    if ((m3.rows ?? []).length > 0) {
      table(
        ['层级', '工作集（KiB）', '访问延迟（ns）'],
        (m3.rows as AnyRecord[]).map((r) => [
          r.level === 'Memory' ? '主存' : r.level,
          Math.floor(r.buffer / 1024),
          r.latency?.text ?? null,
        ]),
      );
    }
    const missingLevels = (m3.missing ?? []) as string[];
    const naList = (report.not_applicable ?? []) as string[];
    if (missingLevels.length > 0 || naList.length > 0) {
      const parts: string[] = [];
      if (missingLevels.length > 0) {
        parts.push(`本轮没有 ${missingLevels.join('、')} 延迟读数`);
      } else {
        parts.push('本轮 L1–L3 与主存层级均有实测读数');
      }
      if (naList.length > 0) {
        parts.push(`${naList.join('、')} 被报告标为不适用`);
      }
      para(`${parts.join('；')}。`);
    }
  }

  if (completedRuns['memory.numa']) {
    const numa = completedRuns['memory.numa'];
    if ((numa.rows ?? []).length > 0 && (numa.columns ?? []).length > 0) {
      heading(3, 'NUMA 本地与跨节点访问');
      const numaRows: unknown[][] = [];
      for (let rIdx = 0; rIdx < numa.rows.length; rIdx += 1) {
        for (let cIdx = 0; cIdx < numa.columns.length; cIdx += 1) {
          const cellObj = numa.cells?.[rIdx]?.[cIdx];
          numaRows.push([
            `Node ${numa.rows[rIdx]}`,
            `Node ${numa.columns[cIdx]}`,
            cellObj?.bandwidth?.value?.text ?? null,
            cellObj?.latency?.value?.text ?? null,
          ]);
        }
      }
      table(['CPU 节点', '内存节点', '带宽（MiB/s）', '延迟（ns）'], numaRows);
      if (numa.cache_unknown) {
        para(
          '末级缓存容量未能从系统读取，按默认缓存规模估算跨节点测试工作集。',
        );
      }
    }
  }

  // ## CPU 性能测试
  const cpuRaw = completedRuns['cpu.bench'] ?? null;
  if (
    Object.keys(cpuDone).length > 0 ||
    cpuRaw?.geekbench?.status === 'failed'
  ) {
    heading(2, 'CPU 性能测试');
    if (cpuDone.geekbench?.scores) {
      const gb = cpuDone.geekbench;
      const sc = gb.scores;
      heading(3, `Geekbench ${sc.version ?? ''}`.trim());
      table(['单核', '多核'], [[sc.single, sc.multi]]);
      if (gb.memory?.Swapped) {
        para(
          `运行条件：工具为本项启用了 ${gb.memory.Swapped.gib} GiB 临时 swap。`,
        );
      } else if (gb.memory?.Short) {
        para('运行条件：可用内存低于推荐阈值且未能启用临时 swap。');
      }
      if (sc.url) {
        para(`[查看本次 Geekbench 成绩](${sc.url})`);
      }
    } else if (cpuRaw?.geekbench?.status === 'failed') {
      const gbFail = cpuRaw.geekbench;
      const swapGib = gbFail.partial?.memory?.Swapped?.gib;
      heading(3, 'Geekbench');
      if (gbFail.failure === 'OutOfMemory') {
        para(
          swapGib
            ? `本轮因内存不足（OutOfMemory，工具已启用 ${swapGib} GiB 临时 swap）未能完成跑分。`
            : '本轮因内存不足（OutOfMemory）未能完成跑分。',
        );
      } else {
        const reason =
          typeof gbFail.failure === 'string' ? gbFail.failure : '执行异常';
        para(`本轮未能完成跑分（${reason}）。`);
      }
    }

    if (cpuDone.sysbench) {
      const z = cpuDone.sysbench;
      heading(3, `sysbench ${z.version ?? ''}`.trim());
      const sbRows: unknown[][] = [[z.single.threads, z.single.rate.text]];
      if (z.multi) sbRows.push([z.multi.threads, z.multi.rate.text]);
      table(['线程', '每秒事件数'], sbRows);
    }

    if (cpuDone.unixbench) {
      const z = cpuDone.unixbench;
      heading(3, `UnixBench ${z.version ?? ''}`.trim());
      const ubSummary: unknown[][] = [[z.single.copies, val(z.single.index)]];
      if (z.multi) ubSummary.push([z.multi.copies, val(z.multi.index)]);
      table(['并发副本数', '综合指数'], ubSummary);
      if (z.multi) {
        const multiMap = new Map<string, AnyRecord>(
          (z.multi.items ?? []).map((item: AnyRecord) => [item.id, item]),
        );
        table(
          ['子项', '原生单位', '单副本速率', '多副本速率', '单 / 多副本指数'],
          (z.single.items ?? []).map((item: AnyRecord) => {
            const mItem = multiMap.get(item.id);
            return [
              item.id,
              item.unit,
              val(item.rate),
              mItem ? val(mItem.rate) : null,
              `${val(item.index) ?? '—'} / ${mItem ? (val(mItem.index) ?? '—') : '—'}`,
            ];
          }),
        );
      } else {
        table(
          ['子项', '原生单位', '单副本速率', '单副本指数'],
          (z.single.items ?? []).map((item: AnyRecord) => [
            item.id,
            item.unit,
            val(item.rate),
            val(item.index),
          ]),
        );
      }
    }

    if (cpuDone.seven_zip) {
      const z = cpuDone.seven_zip;
      heading(3, `7-Zip ${z.version ?? ''}`.trim());
      const runs = [z.single, ...(z.multi ? [z.multi] : [])];
      table(
        [
          '线程',
          'CPU 利用率',
          '压缩 / 解压（KiB/s）',
          '压缩 / 解压（MIPS）',
          '单核效率（MIPS）',
          '总评（MIPS）',
        ],
        runs.map((r: AnyRecord) => [
          r.threads,
          r.usage_pct !== null && r.usage_pct !== undefined
            ? `${r.usage_pct}%`
            : null,
          `${r.compress_kib_s} / ${r.decompress_kib_s}`,
          `${r.compress_mips} / ${r.decompress_mips}`,
          r.ru_mips ?? null,
          r.total_mips,
        ]),
      );
    }

    if (cpuDone.passmark) {
      const z = cpuDone.passmark;
      heading(3, `PassMark ${z.version ?? ''}`.trim());
      para(
        `CPU Mark 为 ${val(z.cpu_mark)}，单线程子项为 ${val(z.single_thread)}。各子项不相加。`,
      );
      table(
        ['子项', '工具读数'],
        [
          ['整数', val(z.integer_math)],
          ['浮点', val(z.floating_math)],
          ['质数', val(z.prime)],
          ['排序', val(z.sorting)],
          ['加密', val(z.encryption)],
          ['压缩', val(z.compression)],
          ['物理模拟', val(z.physics)],
          ['扩展指令', val(z.extended_instructions)],
        ],
      );
    }

    if (cpuDone.hpl) {
      const z = cpuDone.hpl;
      heading(3, `HPL ${z.version ?? ''}`.trim());
      table(
        ['线程', '矩阵阶数 N', '分块 NB', '用时（s）', 'GFLOP/s', '残差'],
        [[z.threads, z.n, z.nb, z.seconds, z.gflops, z.residual ?? null]],
      );
    }

    if (cpuDone.ycruncher) {
      const z = cpuDone.ycruncher;
      heading(3, `y-cruncher ${z.version ?? ''}`.trim());
      table(
        [
          '调优模式',
          '计算位数',
          '计算用时（s）',
          '总用时（s）',
          'CPU 利用率（%）',
          '多核效率（%）',
        ],
        [
          [
            z.tuning ?? null,
            Number(z.digits).toLocaleString('en-US'),
            val(z.computation_secs, 3),
            val(z.wall_secs, 2),
            val(z.cpu_utilization_pct, 2),
            val(z.multicore_efficiency_pct, 2),
          ],
        ],
      );
    }

    if (cpuDone.prime95) {
      const z = cpuDone.prime95;
      heading(3, `Prime95 ${z.version ?? ''}`.trim());
      table(
        [
          '工作线程 / FFT',
          '实测时长（s）',
          '完成测试数',
          '错误 / 警告',
          '本轮结果',
        ],
        [
          [
            z.fft_desc ? `${z.workers}（${z.fft_desc}）` : String(z.workers),
            z.duration_secs,
            z.tests_completed,
            `${z.errors} / ${z.warnings}`,
            z.passed ? '通过' : '未通过',
          ],
        ],
      );
      para('仅记录本轮短时压力结果，不外推长期满载稳定性。');
    }
  }

  // ## 磁盘性能测试
  let hasDiskHealth = false;
  if (
    (storInfo.disks ?? []).length > 0 ||
    completedRuns['disk.health'] ||
    completedRuns['disk.fio']
  ) {
    heading(2, '磁盘性能测试');
    const raidCards: AnyRecord[] = Array.isArray(storInfo.raid)
      ? storInfo.raid
      : [];
    const raidAttachmentByDisk = new Map<string, string>();
    for (const rc of raidCards) {
      for (const rd of (rc.disks ?? []) as AnyRecord[]) {
        if (rd.name) {
          raidAttachmentByDisk.set(
            rd.name,
            RAID_ATTACHMENT_CN[rd.attachment] ?? rd.attachment,
          );
        }
      }
    }
    if ((storInfo.disks ?? []).length > 0) {
      heading(
        3,
        reviewType === 'dedicated' ? '磁盘与文件系统' : '虚拟磁盘与文件系统',
      );
      table(
        [
          '设备',
          '型号',
          reviewType === 'dedicated' ? '接口 / 介质' : '接口',
          '容量（GB）',
          '文件系统与可用空间',
        ],
        (storInfo.disks as AnyRecord[]).map((dItem) => {
          const fsMatches = (storInfo.filesystems ?? []).filter(
            (f: AnyRecord) => (f.disks ?? []).includes(dItem.name),
          );
          const mountedPools = new Set(
            fsMatches.map((f: AnyRecord) => f.zfs_pool).filter(Boolean),
          );
          const fsParts = fsMatches.map((f: AnyRecord) => {
            const testMark = f.test_directory ? ' · 测试目录' : '';
            const availTxt =
              f.available_bytes !== null && f.available_bytes !== undefined
                ? `可用 ${val(f.available_bytes / 1e9) ?? '—'} GB`
                : '容量未知';
            if (f.zfs_pool) {
              return `zfs（池 ${f.zfs_pool}，挂载 ${f.mount_point}${testMark}，${availTxt}）`;
            }
            return `${f.fs_type}（挂载 ${f.mount_point}${testMark}，${availTxt}）`;
          });
          for (const u of (dItem.uses ?? []) as string[]) {
            if (u === 'swap') {
              fsParts.push('swap 交换分区');
            } else if (u.startsWith('zfs:')) {
              const pool = u.slice(4);
              if (!mountedPools.has(pool))
                fsParts.push(`ZFS 池成员（${pool}）`);
            }
          }
          const raidMode = raidAttachmentByDisk.get(dItem.name);
          if (raidMode) fsParts.push(`RAID ${raidMode}`);
          const mediumLabel =
            reviewType === 'dedicated'
              ? dItem.rotational === false
                ? 'SSD'
                : dItem.rotational === true
                  ? 'HDD'
                  : null
              : null;
          const ifaceCell =
            mediumLabel && dItem.interface
              ? `${dItem.interface} · ${mediumLabel}`
              : (dItem.interface ?? mediumLabel);
          return [
            dItem.name,
            dItem.model ?? null,
            ifaceCell,
            val(dItem.size_bytes / 1e9),
            fsParts.join('；') || null,
          ];
        }),
      );
      if (raidCards.length > 0) {
        const raidDesc = raidCards
          .map((rc: AnyRecord) => {
            const diskModes = ((rc.disks ?? []) as AnyRecord[])
              .map(
                (rd) =>
                  `${rd.name} ${RAID_ATTACHMENT_CN[rd.attachment] ?? rd.attachment}`,
              )
              .join('、');
            const detail = [
              rc.address ? `PCI ${rc.address}` : null,
              `驱动 ${rc.driver ?? '—'}`,
              diskModes ? `关联设备：${diskModes}` : null,
            ]
              .filter(Boolean)
              .join('，');
            return `${rc.name ?? rc.address}（${detail}）`;
          })
          .join('；');
        para(`检测到阵列控制器：${raidDesc}。`);
      }
    }

    if (
      completedRuns['disk.health'] &&
      (completedRuns['disk.health'].disks ?? []).length > 0
    ) {
      const dh = completedRuns['disk.health'];
      const dhDisks = dh.disks as AnyRecord[];
      const raidHostSet = new Set(
        dhDisks
          .map((r) => r.location?.Card?.host)
          .filter((h) => h !== undefined && h !== null),
      );
      const severalCards = raidHostSet.size > 1;
      hasDiskHealth = true;
      heading(3, 'SMART 与健康状态');
      table(
        [
          '设备',
          'SMART',
          '通电（h）',
          '温度（°C）',
          '累计写入',
          '寿命已消耗',
          '坏块 / 接口错误',
        ],
        dhDisks.map((r) => [
          formatDiskHealthLocation(r.location, severalCards),
          formatDiskHealthVerdict(r.health),
          r.values?.hours ?? null,
          r.values?.temperature ?? null,
          formatDiskWritten(r.values?.written),
          r.values?.endurance_used !== null &&
          r.values?.endurance_used !== undefined
            ? `${r.values.endurance_used}%`
            : null,
          formatDiskErrors(r.values?.bad_blocks, r.values?.interface_errors),
        ]),
      );
      if (Array.isArray(dh.nodes_left) && dh.nodes_left.length > 0) {
        const leftList = (dh.nodes_left as AnyRecord[])
          .map((n) => `${n.path}（${n.error}）`)
          .join('、');
        para(`注意：smartctl 创建的临时设备节点未能自动清理：${leftList}。`);
      }
    }

    if (completedRuns['disk.fio']) {
      const fio = completedRuns['disk.fio'];
      heading(3, `fio ${fio.version ?? ''}`.trim());
      let fioNote = `测试文件大小为 ${mib(fio.size)}。带宽保留工具原始单位 KiB/s。`;
      if (typeof fio.zfs_needed === 'number' && fio.zfs_needed > 0) {
        fioNote += `ZFS 空间膨胀预估需至少 ${mib(fio.zfs_needed)} 可用空间。`;
      }
      para(fioNote);
      table(
        ['块大小', '读取（KiB/s）', '读取 IOPS', '写入（KiB/s）', '写入 IOPS'],
        (fio.tests as AnyRecord[]).map((t) => {
          if (t.outcome?.Done) {
            const done = t.outcome.Done;
            return [
              t.block_size,
              done.read_kib,
              done.read_iops,
              done.write_kib,
              done.write_iops,
            ];
          }
          const timedOutSecs = t.outcome?.Failed?.Tool?.TimedOut?.secs;
          const failLabel =
            typeof timedOutSecs === 'number'
              ? `超时（${timedOutSecs} s）`
              : '测试失败';
          return [t.block_size, failLabel, null, failLabel, null];
        }),
      );
    }
  }

  // ## 网络信息 & ## BGP 透视
  const bgpOut = completedRuns['network.bgp'];
  if (cardsInfo.length > 0 || bgpOut) {
    heading(2, '网络信息');
    if (cardsInfo.length > 0) {
      heading(
        3,
        reviewType === 'dedicated'
          ? '网卡与公网连通性'
          : '虚拟网卡与公网连通性',
      );
      const hasRoleCol = cardsInfo.some(
        (c) =>
          Boolean(c.master) ||
          Boolean(c.default_ipv4) ||
          Boolean(c.default_ipv6) ||
          (typeof c.virtual_functions === 'number' && c.virtual_functions > 0),
      );
      const cardHeaders = [
        '接口',
        reviewType === 'dedicated' ? '网卡型号 / 驱动' : '虚拟网卡型号 / 驱动',
        '链路与速率',
        'MTU',
        ...(hasRoleCol ? ['聚合与默认路由'] : []),
      ];
      table(
        cardHeaders,
        cardsInfo.map((c) => {
          const linkTxt =
            c.link_up === false
              ? '未连接（Down）'
              : c.speed_mbps
                ? `${c.speed_mbps} Mbps${c.duplex ? `（${c.duplex}）` : ''}`
                : '已连接（速率未上报）';
          const roles: string[] = [];
          if (c.master) {
            const kindLabel =
              c.master_kind === 'bond'
                ? 'Bond'
                : c.master_kind === 'bridge'
                  ? '网桥'
                  : '上层接口';
            roles.push(`${kindLabel} ${c.master}`);
          }
          if (c.default_ipv4 && c.default_ipv6) {
            roles.push('默认 IPv4 / IPv6');
          } else if (c.default_ipv4) {
            roles.push('默认 IPv4');
          } else if (c.default_ipv6) {
            roles.push('默认 IPv6');
          }
          if (
            typeof c.virtual_functions === 'number' &&
            c.virtual_functions > 0
          ) {
            roles.push(`SR-IOV ${c.virtual_functions} VF`);
          }
          return [
            c.interface,
            c.model ? `${c.model}（${c.driver ?? '—'}）` : (c.driver ?? null),
            linkTxt,
            c.mtu ?? null,
            ...(hasRoleCol ? [roles.join(' · ') || null] : []),
          ];
        }),
      );
      const degradedCards = cardsInfo.filter((c) => c.pcie_degraded === true);
      if (degradedCards.length > 0) {
        para(
          `注意：网卡 ${degradedCards.map((c) => c.interface).join('、')} 当前 PCIe 链路协商速率或通道数低于硬件规格上限（pcie_degraded），高带宽传输可能受插槽通道限制。`,
        );
      }
    }
    const netV4 = sys.network?.ipv4;
    const netV6 = sys.network?.ipv6;
    const v4Part = netV4?.reachable
      ? `公网 IPv4（\`${maskIpAddress(netV4.public_address)}\`）可达`
      : '本次采样本机无可用 IPv4 公网连接';
    const v6Part = netV6?.reachable
      ? `公网 IPv6（\`${maskIpAddress(netV6.public_address)}\`）可达`
      : '本次采样本机无可用 IPv6 路由';
    const linkTail =
      reviewType === 'dedicated'
        ? '网口的协商速率不等于公网吞吐。'
        : 'Virtio 等虚拟网卡不报告物理链路协商速率。';
    para(`${v4Part}；${v6Part}。${linkTail}`);

    for (const [familyKey, familyLabel] of [
      ['ipv4', 'IPv4'],
      ['ipv6', 'IPv6'],
    ] as const) {
      const bn = bgpOut?.[familyKey];
      if (!bn) continue;
      heading(3, `${familyLabel} BGP 路径观测`);
      const asnNames = (bn.asn_names ?? {}) as Record<string, string>;
      const originKey = bn.origin_asn !== null ? String(bn.origin_asn) : '';
      const originName = originKey ? asnNames[originKey] : '';
      const originLabel =
        bn.origin_asn !== null
          ? originName
            ? `AS${bn.origin_asn}（${originName}）`
            : `AS${bn.origin_asn}`
          : null;
      const upstreamLabel =
        (bn.upstreams ?? [])
          .map((u: AnyRecord) => {
            const uName = asnNames[String(u.asn)];
            return `AS${u.asn}${uName ? ` ${uName}` : ''}（${u.peers} 个对等体）`;
          })
          .join('、') || null;
      table(
        [
          '宣告前缀',
          '起源 ASN',
          'RPKI',
          '不同路径数',
          '观测对等体数',
          '观测到的直接上游',
        ],
        [
          [
            maskCidrPrefix(bn.prefix),
            originLabel,
            bn.rpki,
            bn.distinct_paths,
            bn.total_peers,
            upstreamLabel,
          ],
        ],
      );
    }
  }

  if (bgpOut?.ipv4?.svg || bgpOut?.ipv6?.svg) {
    heading(2, 'BGP 透视');
    for (const [familyKey, familyLabel, filename] of [
      ['ipv4', 'IPv4', 'bgp-ipv4.svg'],
      ['ipv6', 'IPv6', 'bgp-ipv6.svg'],
    ] as const) {
      const bn = bgpOut?.[familyKey];
      if (!bn?.svg) continue;
      const redactions: Array<[string, string]> = [];
      if (typeof bn.address === 'string' && !bn.address.includes('*')) {
        const masked = maskIpAddress(bn.address);
        if (masked) redactions.push([bn.address, masked]);
      }
      if (typeof bn.prefix === 'string' && !bn.prefix.includes('*')) {
        const masked = maskCidrPrefix(bn.prefix);
        if (masked) redactions.push([bn.prefix, masked]);
      }
      const cleanSvg = sanitizeBgpSvg(bn.svg, redactions);
      const publicPath = `/archive-assets/${options.assetSlug}/${filename}`;
      assets.push({ filename, publicPath, content: cleanSvg });
      heading(3, familyLabel);
      para(`![${familyLabel} BGP 透视](${publicPath})`);
    }
  }

  // ## IP 质量检测
  const ipqOut = completedRuns['ip.quality'];
  const ipqFamilies = (
    [
      ['ipv4', 'IPv4'],
      ['ipv6', 'IPv6'],
    ] as const
  ).filter(([k]) => Boolean(ipqOut?.[k]));
  if (ipqFamilies.length > 0) {
    heading(2, 'IP 质量检测');
    const multiFamily = ipqFamilies.length > 1;
    for (const [familyKey, familyLabel] of ipqFamilies) {
      const ipq = ipqOut![familyKey] as AnyRecord;
      const prefix = multiFamily ? `${familyLabel} ` : '';
      heading(3, `${familyLabel} 基础属性与归属`);
      const votesStr = (ipq.geo_votes ?? [])
        .map((v: AnyRecord) => `${v.country}（${v.count}/${ipq.geo_total}）`)
        .join('、');
      const hasV014IpFields =
        'asn_usage' in ipq ||
        'company_usage' in ipq ||
        'city' in ipq ||
        'timezone' in ipq;
      const ipSummaryRows: unknown[][] = [
        ['检测地址（脱敏）', maskIpAddress(ipq.address)],
        [
          '路由宣告 ASN',
          ipq.asn !== null && ipq.asn !== undefined ? `AS${ipq.asn}` : null,
        ],
        ['RIR 网段登记标识（org）', ipq.org ?? null],
        ['区域互联网注册机构（RIR）', ipq.rir ?? null],
        [
          '注册国家 / GeoIP 投票',
          `${ipq.registered_country || '—'} / ${votesStr || ipq.geo_country || '—'}`,
        ],
        ['原生 / 广播判定', formatIpOrigin(ipq.origin)],
      ];
      if (hasV014IpFields) {
        ipSummaryRows.push(
          ['所在城市', formatIpLocation(ipq.city, ipq.region) ?? '未知'],
          ['时区', ipq.timezone ?? '未知'],
          [
            'ASN 类型',
            formatAsnUsage(ipq.asn_usage, ipq.usage_sources) ?? '未知',
          ],
          [
            '机构类型',
            formatCompanyUsage(ipq.company_usage, ipq.dual_isp) ?? '未知',
          ],
        );
      } else {
        ipSummaryRows.push([
          '使用场景分类',
          USAGE_TYPE_CN[ipq.usage] ?? ipq.usage ?? null,
        ]);
      }
      table(['项目', '检测结果'], ipSummaryRows);
      if ((ipq.scores ?? []).length > 0) {
        heading(3, `${prefix}风险评分与安全情报`);
        table(
          ['数据源', '评估结果'],
          (ipq.scores as [string, unknown][]).map(([srcName, verdict]) => [
            srcName,
            formatScoreVerdict(verdict),
          ]),
        );
      }
      if ((ipq.factors ?? []).length > 0) {
        heading(3, `${prefix}风险特征与 DNSBL 黑名单`);
        table(
          ['风险维度', '核验源数', '标记情况'],
          (ipq.factors as AnyRecord[]).map((f) => [
            FACTOR_CN[f.factor] ?? f.factor,
            f.checked,
            (f.flagged_by ?? []).length > 0
              ? `命中（${f.flagged_by.join('、')}）`
              : '未命中',
          ]),
        );
      }
      if (ipq.dnsbl) {
        const listedTxt =
          (ipq.dnsbl.listed ?? []).length > 0
            ? ipq.dnsbl.listed.join('、')
            : '无命中';
        para(
          `DNSBL 黑名单共查询 ${ipq.dnsbl.checked} 家：命中 ${(ipq.dnsbl.listed ?? []).length} 家（${listedTxt}），另有 ${ipq.dnsbl.refused} 家拒绝查询。`,
        );
      }
      if ((ipq.mail ?? []).length > 0) {
        heading(3, `${prefix}邮局 25 端口连通性`);
        table(
          ['邮件服务商', '连通状态'],
          (ipq.mail as AnyRecord[]).map((mItem) => [
            mItem.name,
            formatMailStatus(mItem.status),
          ]),
        );
      }
      if (Array.isArray(ipq.notes) && ipq.notes.length > 0) {
        const noteTxt = (ipq.notes as [string, string][])
          .map(([prov, reason]) => `${prov}：${redactInlineIpTokens(reason)}`)
          .join('；');
        para(`数据源备注：${noteTxt}。`);
      }
    }
  }

  // ## 服务解锁测试
  const mediaOut = completedRuns['ip.media'];
  if (mediaOut && (mediaOut.results ?? []).length > 0) {
    heading(2, '服务解锁测试');
    const mediaResults = mediaOut.results as AnyRecord[];
    const showUnlockCol =
      mediaResults.some(
        (r) => Boolean(r.ipv4_unlock) || Boolean(r.ipv6_unlock),
      ) || !['0.1.0', '0.1.1', '0.1.2'].includes(String(report.version));
    const families: Array<['ipv4' | 'ipv6', string]> = [];
    if (
      mediaOut.ipv4_reachable ||
      mediaResults.some((r) => r.ipv4 && r.ipv4 !== 'NoAddress')
    ) {
      families.push(['ipv4', 'IPv4']);
    }
    if (
      mediaOut.ipv6_reachable ||
      mediaResults.some((r) => r.ipv6 && r.ipv6 !== 'NoAddress')
    ) {
      families.push(['ipv6', 'IPv6']);
    }
    for (const [fKey, fLabel] of families) {
      heading(3, fLabel);
      const unlockField = `${fKey}_unlock` as 'ipv4_unlock' | 'ipv6_unlock';
      for (const [groupKey, groupTitle] of [
        ['global', 'Multination'],
        ['asia', '亚洲平台'],
        ['europe', '欧洲平台'],
        ['americas', '美洲平台'],
        ['oceania', '大洋洲平台'],
      ] as const) {
        const groupItems = mediaResults.filter(
          (r) => r.group === groupKey && r[fKey] !== null,
        );
        if (groupItems.length === 0) continue;
        heading(4, groupTitle);
        table(
          showUnlockCol
            ? ['服务', '状态', '区域', '解锁方式', '检测备注']
            : ['服务', '状态', '区域', '检测备注'],
          groupItems.map((r) => {
            const x = r[fKey];
            const tag = typeof x === 'string' ? x : Object.keys(x)[0]!;
            const data = typeof x === 'object' ? x[tag] : null;
            const region =
              data && typeof data === 'object' ? (data.region ?? null) : null;
            const rawRestriction =
              data && typeof data === 'object'
                ? (data.restriction ?? null)
                : data;
            const note =
              typeof rawRestriction === 'string'
                ? (MEDIA_RESTRICTION_CN[rawRestriction] ?? rawRestriction)
                : rawRestriction;
            const rawMode = r[unlockField];
            const modeLabel =
              rawMode === 'native' ? '原生' : rawMode === 'dns' ? 'DNS' : null;
            return showUnlockCol
              ? [r.name, MEDIA_VERDICT_CN[tag] ?? tag, region, modeLabel, note]
              : [r.name, MEDIA_VERDICT_CN[tag] ?? tag, region, note];
          }),
        );
      }
    }
  }

  // ## 网络带宽测试
  const iperfOut = completedRuns['network.iperf3'];
  const taierOut = completedRuns['network.taier'];
  if (iperfOut || taierOut) {
    heading(2, '网络带宽测试');
    if (iperfOut) {
      heading(3, 'iperf3 国际节点');
      para(
        `iperf3 ${iperfOut.version ?? '—'}，${iperfOut.settings.streams} 条并发流，每次 ${iperfOut.settings.seconds} 秒。上传和下载均以本机为参照。`,
      );
      for (const [fKey, fLabel] of [
        ['ipv4', 'IPv4 节点'],
        ['ipv6', 'IPv6 节点'],
      ] as const) {
        const list = (iperfOut[fKey] ?? []) as AnyRecord[];
        if (list.length === 0) continue;
        table(
          [
            fLabel,
            '服务商',
            '上传（Mbps）',
            '下载（Mbps）',
            '上传重传',
            '上传 RTT（ms）',
          ],
          list.map((r) => {
            const up = formatIperfWay(r.upload);
            const down = formatIperfWay(r.download);
            return [
              `${r.country} · ${r.location}`,
              r.provider,
              up.mbps,
              down.mbps,
              up.retransmits,
              up.rttMs,
            ];
          }),
        );
      }
    }

    if (taierOut && (taierOut.results ?? []).length > 0) {
      heading(3, '泰尔国内运营商测速');
      para(
        `${taierOut.settings.streams} 条并发流，每次 ${taierOut.settings.seconds} 秒；仅 state 为 measured 的节点记入有效吞吐。`,
      );
      table(
        ['城市', '运营商', '下载（Mbps）', '上传（Mbps）', '状态'],
        (taierOut.results as AnyRecord[]).map((r) => {
          const city = TAIER_CITIES_CN[r.city] ?? r.city;
          const op = TAIER_OPS_CN[r.operator] ?? r.operator;
          const oc = r.outcome as AnyRecord;
          if (oc.state === 'measured') {
            return [
              city,
              op,
              val(oc.data.download_bps / 1e6),
              val(oc.data.upload_bps / 1e6),
              '完成',
            ];
          }
          if (oc.state === 'unreachable') {
            return [city, op, null, null, '不可达'];
          }
          if (oc.state === 'busy') {
            return [city, op, null, null, '节点繁忙'];
          }
          if (oc.state === 'timed_out') {
            return [city, op, null, null, '超时'];
          }
          if (oc.state === 'auth_rejected') {
            return [city, op, null, null, '鉴权拒绝'];
          }
          const detail = oc.data ? String(oc.data) : oc.state;
          return [city, op, null, null, `失败（${detail}）`];
        }),
      );
    }
  }

  // ## Cloudflare Speedtest
  const cfOut = completedRuns['network.cloudflare'];
  const cfFamilies = (
    [
      ['ipv4', 'IPv4'],
      ['ipv6', 'IPv6'],
    ] as const
  ).filter(([k]) => Boolean(cfOut?.[k]));
  if (cfFamilies.length > 0) {
    heading(2, 'Cloudflare Speedtest');
    const cfSet = cfOut!.settings ?? {};
    const multiCf = cfFamilies.length > 1;
    for (const [fKey, fLabel] of cfFamilies) {
      const z = cfOut![fKey] as AnyRecord;
      const pfx = multiCf ? `${fLabel} ` : '';
      heading(3, `${pfx}上下行吞吐与传输流量`);
      para(
        `${fLabel}，接入点 ${z.server ?? z.colo ?? '—'}；服务端识别客户端 ASN 为 ${z.asn !== null ? `AS${z.asn}` : '—'}、地址库归属为 ${z.as_org ?? '—'}，并发数 ${cfSet.concurrency ?? '—'}。`,
      );
      table(
        [
          '方向',
          '总吞吐（Mbps）',
          '中位数（Mbps）',
          'P25 / P75（Mbps）',
          'P95 / P99（Mbps）',
          '传输流量 / 用时',
        ],
        (
          [
            ['download', '下载'],
            ['upload', '上传'],
          ] as const
        ).map(([k, n]) => [
          n,
          val(z[k].mbps),
          val(z[k].median_mbps),
          `${val(z[k].p25_mbps)} / ${val(z[k].p75_mbps)}`,
          `${val(z[k].p95_mbps)} / ${val(z[k].p99_mbps)}`,
          `${gbDec(z[k].bytes)}（${val(z[k].duration_ms / 1000)} s）`,
        ]),
      );
      heading(3, `${pfx}空载与负载延迟统计`);
      const latStages = [
        ['idle_latency', '空载'],
        ['loaded_download_latency', '下载中'],
        ['loaded_upload_latency', '上传中'],
      ] as const;
      table(
        [
          '状态',
          '收 / 发',
          '最小（ms）',
          '均值（ms）',
          '中位数（ms）',
          '最大（ms）',
          '抖动 / 丢包',
        ],
        latStages.map(([k, n]) => [
          n,
          `${z[k].received} / ${z[k].sent}`,
          val(z[k].min_ms),
          val(z[k].mean_ms),
          val(z[k].median_ms),
          val(z[k].max_ms),
          `${val(z[k].jitter_ms) ?? '—'} ms / ${val(z[k].loss_pct)}%`,
        ]),
      );
      heading(3, `${pfx}延迟分位分布（ms）`);
      table(
        ['状态', 'P25', 'P50（中位）', 'P75', 'P95', 'P99'],
        latStages.map(([k, n]) => [
          n,
          val(z[k].p25_ms),
          val(z[k].median_ms),
          val(z[k].p75_ms),
          val(z[k].p95_ms),
          val(z[k].p99_ms),
        ]),
      );
      if (z.udp || z.quality) {
        heading(3, `${pfx}UDP 与稳定性`);
        if (z.udp) {
          const u = z.udp;
          if (u.target) para(`UDP 测试目标：\`${u.target}\`。`);
          table(
            [
              '已收 / 已发',
              '延迟中位数（ms）',
              '抖动（ms）',
              '丢包 / 乱序（%）',
              'MOS / 质量',
            ],
            [
              [
                `${u.received} / ${u.sent}`,
                val(u.median_ms, 3),
                val(u.jitter_ms, 3),
                `${val(u.loss_pct)} / ${val(u.out_of_order_pct)}`,
                `${val(u.mos, 3) ?? '—'}（${u.quality ?? '—'}）`,
              ],
            ],
          );
        }
        if (z.quality) {
          const q = z.quality;
          para(
            `工具给出的缓冲膨胀评级为 ${q.bufferbloat_grade}（${val(q.bufferbloat_ms) ?? '—'} ms），吞吐稳定性评级为 ${q.stability_grade}（变异系数 ${val(q.stability_cv_pct) ?? '—'}%）。`,
          );
        }
      }
    }
  }

  // ## Apple CDN Speedtest
  const inetOut = completedRuns['network.inetspeed'];
  if (inetOut && (inetOut.rounds ?? []).length > 0) {
    heading(2, 'Apple CDN Speedtest');
    heading(3, '节点与空载延迟基准');
    const sel = inetOut.selected;
    para(
      `选中节点 \`${sel.host}\`（\`${maskIpAddress(sel.ip)}\`，DoH 探测 RTT ${val(sel.rtt_ms) ?? '—'} ms）；${inetOut.rounds.length} 轮测试累计传输流量 ${gbDec(inetOut.total_bytes)}（${gib(inetOut.total_bytes)}）。`,
    );
    if (inetOut.idle_latency) {
      const il = inetOut.idle_latency;
      table(
        [
          '空载采样数',
          '最小（ms）',
          '均值（ms）',
          '中位数（ms）',
          '最大（ms）',
          '抖动（ms）',
        ],
        [
          [
            il.samples,
            val(il.min_ms),
            val(il.avg_ms),
            val(il.median_ms),
            val(il.max_ms),
            val(il.jitter_ms),
          ],
        ],
      );
    }
    heading(3, '分轮吞吐与传输流量');
    table(
      ['方向', '线程', '吞吐（Mbps）', '传输流量', '用时（s）', '故障'],
      (inetOut.rounds as AnyRecord[]).map((r) => {
        const fc = r.fault_count;
        const err = r.error;
        const faultLabel =
          err && typeof err === 'object' && err.kind
            ? `${fc} (${err.kind})`
            : err
              ? `${fc} (${String(err)})`
              : fc;
        return [
          r.direction === 'download' ? '下载' : '上传',
          r.threads,
          val(r.mbps),
          gbDec(r.bytes),
          val(r.duration_ms / 1000),
          faultLabel,
        ];
      }),
    );
    const loadedRounds = (inetOut.rounds as AnyRecord[]).filter((r) =>
      Boolean(r.loaded_latency),
    );
    if (loadedRounds.length > 0) {
      heading(3, '分轮负载延迟分布');
      table(
        [
          '方向 / 线程',
          '样本数',
          '最小（ms）',
          '均值（ms）',
          '中位数（ms）',
          '最大（ms）',
          '抖动（ms）',
        ],
        loadedRounds.map((r) => [
          `${r.direction === 'download' ? '下载' : '上传'} · ${r.threads} 线程`,
          r.loaded_latency.samples,
          val(r.loaded_latency.min_ms),
          val(r.loaded_latency.avg_ms),
          val(r.loaded_latency.median_ms),
          val(r.loaded_latency.max_ms),
          val(r.loaded_latency.jitter_ms),
        ]),
      );
    }
  }

  // ## TCP 延迟测试 (network.tcping, v0.1.5+)
  const tcpingOut = completedRuns['network.tcping'];
  const tcpingTargets: AnyRecord[] = Array.isArray(tcpingOut?.targets)
    ? tcpingOut!.targets
    : [];
  if (tcpingOut && tcpingTargets.length > 0) {
    heading(2, 'TCP 延迟测试');
    const choiceMap: Record<string, string> = {
      china: '中国大陆常规',
      'china-premium': '中国大陆优化',
      global: '国际节点',
      all: '全部节点',
    };
    const groupTitleMap: Record<string, string> = {
      china: '中国大陆常规节点',
      china_premium: '中国大陆优化线路',
      global: '国际与公共节点',
    };
    const tcSet = tcpingOut.settings ?? {};
    const groupLabels = Array.isArray(tcSet.groups)
      ? tcSet.groups.map((g: string) => choiceMap[g] ?? g).join('、')
      : '默认';
    const measuredCnt = tcpingTargets.filter(
      (t) => t.status === 'measured',
    ).length;
    const lossCnt = tcpingTargets.filter((t) => t.status === 'loss').length;
    const failCnt = tcpingTargets.filter((t) => t.status === 'failed').length;
    const tailParts = [
      `${measuredCnt} 个完成`,
      ...(lossCnt > 0 ? [`${lossCnt} 个全丢包`] : []),
      ...(failCnt > 0 ? [`${failCnt} 个探测失败`] : []),
    ];
    para(
      `非特权 TCP 握手延迟探测（每目标 ${tcSet.count ?? '—'} 次，范围：${groupLabels}${tcSet.all_targets ? ' · 全量目标' : ''}）：共 ${tcpingTargets.length} 条记录（${tailParts.join('，')}）。`,
    );

    const redactCellIps = (raw: string): string =>
      raw
        .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, (m) => maskIpAddress(m) ?? m)
        .replace(/\b(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{0,4}\b/g, (m) =>
          isIP(m) === 6 ? (maskIpAddress(m) ?? m) : m,
        );

    for (const [isV6, proto] of [
      [false, 'IPv4'],
      [true, 'IPv6'],
    ] as const) {
      for (const grp of ['china', 'china_premium', 'global'] as const) {
        const subset = tcpingTargets.filter(
          (t) => Boolean(t.ipv6) === isV6 && t.group === grp,
        );
        if (subset.length === 0) continue;
        heading(3, `${proto} · ${groupTitleMap[grp]}`);
        table(
          [
            '节点',
            '网络 / 端口',
            '最小 / 均值（ms）',
            '中位 / P95（ms）',
            '最大 / 抖动（ms）',
            '丢包 / 状态',
          ],
          subset.map((t) => {
            const rawName = cnTargetName(String(t.name ?? ''));
            const nodeLabel =
              grp === 'global' && t.region && !rawName.includes(t.region)
                ? `${t.region} · ${rawName}`
                : rawName;
            const netPort =
              t.port !== undefined && t.port !== null
                ? `AS${t.asn} · TCP ${t.port}`
                : `AS${t.asn} · ${TAIER_OPS_CN[t.operator] ?? t.operator}`;
            if (t.status === 'measured') {
              return [
                nodeLabel,
                netPort,
                `${val(t.min_ms)} / ${val(t.avg_ms)}`,
                `${val(t.median_ms)} / ${val(t.p95_ms)}`,
                `${val(t.max_ms)} / ${val(t.jitter_ms)}`,
                `${val(t.loss_pct, 1)}%（${t.received}/${t.sent}）${t.used_backup ? ' · 备用' : ''}`,
              ];
            }
            if (t.status === 'loss') {
              return [
                nodeLabel,
                netPort,
                null,
                null,
                null,
                `100% 丢包（0/${t.sent}）${t.used_backup ? ' · 备用' : ''}`,
              ];
            }
            return [
              nodeLabel,
              netPort,
              null,
              null,
              null,
              `失败（${redactCellIps(String(t.reason ?? '未知错误'))}）`,
            ];
          }),
        );
      }
    }
  }

  // ## 路由追踪
  if (traceV4.length > 0 || traceV6.length > 0) {
    heading(2, '路由追踪');
    const summaryParts: string[] = [];
    for (const [list, proto] of [
      [traceV4, 'IPv4'],
      [traceV6, 'IPv6'],
    ] as const) {
      if (list.length === 0) continue;
      const reached = list.filter((r) => r.route?.Traced?.reached).length;
      summaryParts.push(
        `共 ${list.length} 个 ${proto} 目标，${reached} 个到达，${list.length - reached} 个未到达`,
      );
    }
    para(
      `从被测机向外发送 ICMP 探测：${summaryParts.join('；')}。RTT 是每个应答地址的最小往返时间；星号表示无应答；连续无应答显示为跳数范围。`,
    );

    const grouped = new Map<
      string,
      Array<{
        headingTitle: string;
        routeObj: AnyRecord;
        isNetflix: boolean;
        cacheHost: string | null;
      }>
    >([
      ['中国境内目标', []],
      ['主要公共服务', []],
      ['主要国际网络运营商', []],
    ]);

    for (const [list, proto] of [
      [traceV4, 'IPv4'],
      [traceV6, 'IPv6'],
    ] as const) {
      for (const r of list) {
        const t = r.target;
        const isNetflix = Boolean(t && typeof t === 'object' && 'Netflix' in t);
        let groupName: string;
        let targetLabel: string;
        let cacheHost: string | null = null;
        if (t && typeof t === 'object' && 'Listed' in t) {
          const listed = t.Listed;
          groupName =
            listed.group === 'China' ? '中国境内目标' : '主要国际网络运营商';
          targetLabel =
            groupName === '中国境内目标'
              ? cnTargetName(listed.name)
              : listed.name;
        } else {
          groupName = '主要公共服务';
          targetLabel =
            typeof t === 'string'
              ? t
              : t?.Netflix?.city
                ? `Netflix · ${t.Netflix.city}`
                : 'Netflix';
          cacheHost = r.host ?? null;
        }
        grouped.get(groupName)!.push({
          headingTitle: `${targetLabel} (${proto})`,
          routeObj: r.route,
          isNetflix,
          cacheHost,
        });
      }
    }

    for (const groupName of [
      '中国境内目标',
      '主要公共服务',
      '主要国际网络运营商',
    ]) {
      const items = grouped.get(groupName) ?? [];
      if (items.length === 0) continue;
      heading(3, groupName);
      for (const item of items) {
        heading(4, item.headingTitle);
        const prefix = item.cacheHost
          ? `命中缓存节点：\`${item.cacheHost}\`。`
          : '';
        const { note, hops } = formatRouteOutcome(item.routeObj, prefix);
        para(note);
        if (hops !== null) {
          table(STANDARD_ROUTE_HEADERS, buildHopRows(hops, item.isNetflix));
        }
      }
    }
  }

  // ## TCP 大包回程路由
  if (tcpV4.length > 0 || tcpV6.length > 0) {
    heading(2, 'TCP 大包回程路由');
    const pktDefault = traceOut?.settings?.large_packets ?? 1024;
    const allTcp = [
      ...tcpV4.map((r) => ({ item: r, proto: 'IPv4' })),
      ...tcpV6.map((r) => ({ item: r, proto: 'IPv6' })),
    ];
    const tcpReached = allTcp.filter(
      ({ item }) => item.tcp?.route?.Traced?.reached,
    ).length;
    para(
      `针对中国境内 ${allTcp.length} 个目标发送 ${pktDefault} 字节 TCP SYN 大包探测，用于对照大小包是否走不同回程路径：${tcpReached} 个到达目标，${allTcp.length - tcpReached} 个未收到目标端口应答（展示已应答的途经路由跳点）。`,
    );
    heading(3, '中国境内目标');
    for (const { item, proto } of allTcp) {
      const rawName = item.target?.Listed?.name ?? '目标';
      const name = cnTargetName(rawName);
      const tcp = item.tcp;
      heading(4, `${name} (${proto} · TCP ${tcp.port})`);
      const prefix = `TCP 端口 ${tcp.port}，${tcp.packet_size} 字节探测包：`;
      const { note, hops } = formatRouteOutcome(tcp.route, prefix);
      para(note);
      if (hops !== null) {
        table(STANDARD_ROUTE_HEADERS, buildHopRows(hops, false));
      }
    }
  }

  // Compute objective omittedSections for the contract gate
  const requiredSections = (
    reviewType === 'dedicated'
      ? STANDARD_DEDICATED_SECTIONS
      : STANDARD_VPS_SECTIONS
  ).filter((secTitle) => {
    if (
      secTitle === 'TCP 大包回程路由' &&
      isBenchVersionBefore(String(report.version ?? ''), '0.1.2')
    ) {
      return false;
    }
    if (
      secTitle === 'TCP 延迟测试' &&
      isBenchVersionBefore(String(report.version ?? ''), '0.1.5')
    ) {
      return false;
    }
    return true;
  });
  const omittedSet = new Set<string>(editorial.omittedSections);
  for (const req of requiredSections) {
    if (!renderedSectionTitles.has(req)) {
      omittedSet.add(req);
    } else {
      omittedSet.delete(req);
    }
  }
  if (reviewType === 'vps') {
    if (!hasVmTelemetry) {
      omittedSet.add('vm-cpu-telemetry');
    } else {
      omittedSet.delete('vm-cpu-telemetry');
    }
  } else if (reviewType === 'dedicated') {
    if (!hasDiskHealth) {
      omittedSet.add('disk-health');
    } else {
      omittedSet.delete('disk-health');
    }
  }
  const omittedSections = Array.from(omittedSet);

  const frontmatter: Record<string, unknown> = {
    kind: 'review',
    format: 'review-markdown',
    benchVersion: report.version,
    reviewType,
    ...(omittedSections.length > 0 ? { omittedSections } : {}),
    draft: editorial.draft,
    permalink,
    title,
    description,
    author: editorial.author,
    publishedAt: editorial.publishedAt,
    ...(editorial.updatedAt ? { updatedAt: editorial.updatedAt } : {}),
    testedAt: editorial.testedAt,
    vendor: editorial.vendor,
    country: editorial.country,
    location: editorial.location,
    geo: editorial.geo,
    categories:
      editorial.categories ??
      (reviewType === 'dedicated' ? ['独立服务器测评'] : ['VPS 测评']),
    tags: editorial.tags,
    affiliate: editorial.affiliate,
    ...(editorial.purchaseUrl ? { purchaseUrl: editorial.purchaseUrl } : {}),
    ...(price ? { price } : {}),
    ...(editorial.coupon ? { coupon: editorial.coupon } : {}),
    ...(editorial.terms ? { terms: editorial.terms } : {}),
    ...(editorial.verdict ? { verdict: editorial.verdict } : {}),
  };

  const mdx = `${serializeFrontmatter(frontmatter)}\n\n${blocks.join('\n\n')}\n`;

  return {
    mdx,
    frontmatter,
    permalink,
    reviewType,
    omittedSections,
    assets,
  };
}
