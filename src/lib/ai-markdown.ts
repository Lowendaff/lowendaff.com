import type { CollectionEntry } from 'astro:content';
import { postPath } from './posts';
import { reviewTypeLabels } from './review-types';
import type { ReviewSection } from './review-model';

const ROUTE_SECTIONS = new Set([
  '路由追踪',
  'TCP 大包回程路由',
  '去程路由追踪',
]);

function stripHtmlTags(html: string): string {
  return html
    .replace(/<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<\/?(?:strong|b)>/gi, '**')
    .replace(/<\/?(?:code)>/gi, '`')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function escapeCell(cell: string): string {
  return cell.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

function renderMarkdownTable(headers: string[], rows: string[][]): string {
  const head = `| ${headers.map(escapeCell).join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.map(escapeCell).join(' | ')} |`);
  return [head, sep, ...body].join('\n');
}

function summarizeVmTelemetry(rawJson: string): string {
  try {
    const parsed = JSON.parse(rawJson) as {
      interval_seconds?: number;
      sample_count?: number;
      st_pct?: {
        avg?: number;
        p95?: number;
        max?: number;
        peak_title?: string;
      };
      si_pct?: {
        avg?: number;
        p95?: number;
        max?: number;
        peak_title?: string;
      };
    };
    const st = parsed.st_pct;
    const si = parsed.si_pct;
    return [
      `> 虚拟化 CPU 遥测摘要（每 ${parsed.interval_seconds ?? 5}s 采样，共 ${parsed.sample_count ?? 0} 个样本）：`,
      `> - 宿主机抢占（%st）：均值 ${Number(st?.avg ?? 0).toFixed(2)}% / P95 ${Number(st?.p95 ?? 0).toFixed(2)}% / 峰值 ${Number(st?.max ?? 0).toFixed(2)}%（${st?.peak_title ?? 'N/A'}）`,
      `> - 软中断开销（%si）：均值 ${Number(si?.avg ?? 0).toFixed(2)}% / P95 ${Number(si?.p95 ?? 0).toFixed(2)}% / 峰值 ${Number(si?.max ?? 0).toFixed(2)}%（${si?.peak_title ?? 'N/A'}）`,
    ].join('\n');
  } catch {
    return '> 虚拟化 CPU 遥测曲线见规范 HTML 页面。';
  }
}

function summarizeRouteSection(
  section: ReviewSection,
  canonicalUrl: string,
): string {
  const tables = section.blocks.filter((b) => b.type === 'table');
  if (!tables.length) return '';

  const summaryRows: string[][] = [];
  for (const tbl of tables) {
    const target = tbl.headings?.join(' / ') || '未命名目标';
    const rows = tbl.rows ?? [];
    const hopCount = rows.length;
    const asns: string[] = [];
    for (const row of rows) {
      const asn = (row[2] ?? '').trim();
      if (
        asn &&
        asn !== '*' &&
        asn !== '—' &&
        asn !== '-' &&
        asns.at(-1) !== asn
      ) {
        asns.push(asn);
      }
    }
    const answered = [...rows]
      .reverse()
      .find((r) => r[5] && !['*', '—', '-', ''].includes(r[5].trim()));
    const finalRtt = answered?.[5]?.trim() || '—';
    const asnPath = asns.length ? asns.join(' → ') : '—';
    summaryRows.push([target, String(hopCount), asnPath, finalRtt]);
  }

  return [
    `共 ${tables.length} 条实测路由（以下为各目标自治域路径与末跳延迟速览，逐跳脱敏路由表见 [规范 HTML 页面](${canonicalUrl}#routing)）：`,
    '',
    renderMarkdownTable(
      ['目标节点', '总跳数', '途经 ASN 序列', '末跳最小 RTT（ms）'],
      summaryRows,
    ),
  ].join('\n');
}

function renderSectionMarkdown(
  section: ReviewSection,
  canonicalUrl: string,
  siteOrigin: string,
): string {
  if (section.title === 'Bench Report' || section.title === 'IPv4 质量分析') {
    return '';
  }
  if (ROUTE_SECTIONS.has(section.title)) {
    const summary = summarizeRouteSection(section, canonicalUrl);
    return summary ? `## ${section.title}\n\n${summary}` : '';
  }

  const parts: string[] = [`## ${section.title}`];
  let lastSub = '';
  let lastSub4 = '';

  for (const b of section.blocks) {
    if (b.type === 'heading') {
      const prefix = '#'.repeat(Math.min(6, Math.max(3, b.level ?? 3)));
      parts.push(`${prefix} ${b.text ?? ''}`);
      if (b.level === 3) {
        lastSub = b.text ?? '';
        lastSub4 = '';
      } else if (b.level === 4) {
        lastSub4 = b.text ?? '';
      }
      continue;
    }

    if ((b.type === 'table' || b.type === 'code') && b.headings?.length) {
      const [h3, h4] = b.headings;
      if (h3 && h3 !== lastSub) {
        parts.push(`### ${h3}`);
        lastSub = h3;
        lastSub4 = '';
      }
      if (h4 && h4 !== lastSub4) {
        parts.push(`#### ${h4}`);
        lastSub4 = h4;
      }
    }

    if (b.type === 'paragraph' && b.html) {
      parts.push(stripHtmlTags(b.html));
    } else if (b.type === 'quote' && b.html) {
      parts.push(`> ${stripHtmlTags(b.html)}`);
    } else if (b.type === 'table' && b.headers && b.rows) {
      parts.push(renderMarkdownTable(b.headers, b.rows));
    } else if (b.type === 'code') {
      if (b.language === 'vm-cpu-telemetry') {
        parts.push(summarizeVmTelemetry(b.text ?? '{}'));
      } else {
        parts.push(`\`\`\`${b.language || 'text'}\n${b.text ?? ''}\n\`\`\``);
      }
    } else if (b.type === 'image' && b.src) {
      const imgUrl = b.src.startsWith('/')
        ? new URL(b.src, siteOrigin).href
        : b.src;
      parts.push(`![${b.alt || section.title}](${imgUrl})`);
    } else if (b.type === 'bilibili' && b.src) {
      parts.push(`关联视频：[${b.text || '哔哩哔哩视频'}](${b.src})`);
    }
  }

  return parts.length > 1 ? parts.join('\n\n') : '';
}

export function renderPostAiMarkdown(
  post: CollectionEntry<'posts'>,
  site: URL,
): string {
  const p = post.data;
  const siteOrigin = new URL('/', site).href;
  const canonicalUrl = new URL(postPath(post), site).href;
  const cleanTitle = p.title.replace(/^(?:\p{Regional_Indicator}{2}\s*)+/u, '');
  const typeLabel = reviewTypeLabels[p.reviewType];

  const metaLines = [
    `# ${cleanTitle}`,
    '',
    `- **规范链接**：${canonicalUrl}`,
    `- **测评类型**：${typeLabel}`,
    `- **服务商**：${p.vendor}`,
    `- **机房地区**：${p.location}${p.country ? `（${p.country}）` : ''}`,
    ...(p.price ? [`- **参考起步价**：${p.price}`] : []),
    ...(p.testedAt ? [`- **实测采样时间**：${p.testedAt}`] : []),
    `- **发布日期**：${p.publishedAt}${p.updatedAt && p.updatedAt !== p.publishedAt ? `（更新于 ${p.updatedAt}）` : ''}`,
    `- **作者与许可**：${p.author}（LowEndAFF），知识共享署名 CC BY 4.0（https://creativecommons.org/licenses/by/4.0/）`,
    ...(p.terms ? [`- **服务条款要点**：${p.terms}`] : []),
    '',
    `> **摘要**：${p.description}`,
    ...(p.verdict ? ['', `> **核心实测结论**：${p.verdict}`] : []),
  ];

  const bodyParts: string[] = [];
  if (p.review) {
    for (const section of p.review.sections) {
      const rendered = renderSectionMarkdown(section, canonicalUrl, siteOrigin);
      if (rendered) bodyParts.push(rendered);
    }
  } else if (post.body) {
    bodyParts.push(
      post.body
        .replace(/^import\s+[^\n]+\n+/gm, '')
        .replace(/<[A-Z][A-Za-z0-9]*[^>]*\/>/g, '')
        .trim(),
    );
  }

  return [...metaLines, '', bodyParts.join('\n\n'), ''].join('\n');
}
