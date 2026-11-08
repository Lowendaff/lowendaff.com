import type { CollectionEntry } from 'astro:content';
export type Review = NonNullable<CollectionEntry<'posts'>['data']['review']>;

export interface ReviewBlock {
  type: string;
  line: number;
  id?: string;
  level?: number;
  text?: string;
  html?: string;
  src?: string;
  alt?: string;
  asset?: {
    local: string | null;
    provenance: string;
    width?: number;
    height?: number;
  };
  headings?: string[];
  headers?: string[];
  rows?: string[][];
}
export interface ReviewSection {
  id: string;
  title: string;
  blocks: ReviewBlock[];
}
export interface ReviewPanel {
  id: string;
  label: string;
  sections: ReviewSection[];
  route?: 'return' | 'outbound';
}
export const reviewNavigation = [
  { id: 'purchase', label: '套餐与购买' },
  { id: 'hardware', label: '配置与性能' },
  { id: 'unlock', label: '服务解锁' },
  { id: 'speed', label: '网络检测' },
  { id: 'routing', label: '路由追踪' },
];
export function reviewModel(review: Review) {
  const key = review.id;
  const section = (title: string): ReviewSection => {
    const match = review.sections.find((s) => s.title === title);
    return match ?? { id: `${key}-absent`, title, blocks: [] };
  };
  const hardware: ReviewPanel[] = [
    { id: 'system', label: '系统', sections: [section('系统信息')] },
    { id: 'cpu', label: 'CPU', sections: [section('CPU 性能测试')] },
    { id: 'disk', label: '磁盘', sections: [section('磁盘性能测试')] },
    {
      id: 'network',
      label: '网络与 IP',
      sections: [section('网络信息'), section('BGP 透视')],
    },
  ];
  const unlockSection = section('服务解锁测试');
  const unlock: ReviewPanel[] = [];
  for (const block of unlockSection.blocks) {
    if (block.type !== 'table' && block.type !== 'code') continue;
    const category = block.headings?.at(-1) || '其他';
    const ip = block.headings?.[0] || 'IPv4';
    let panel = unlock.find((p) => p.id === category);
    if (!panel) {
      panel = {
        id: category,
        label:
          (
            {
              AIGC: 'AI 服务',
              Multination: '国际平台',
              'North America': '北美平台',
              SouthEastAsia: '东南亚平台',
            } as Record<string, string>
          )[category] || category,
        sections: [],
      };
      unlock.push(panel);
    }
    panel.sections.push({
      id: `${key}-unlock-${panel.sections.length}-${unlock.indexOf(panel)}`,
      title: `${ip} · ${category}`,
      blocks: [block],
    });
  }
  const speed: ReviewPanel[] = [
    {
      id: 'cloudflare',
      label: 'Cloudflare',
      sections: [section('Cloudflare Speedtest')],
    },
    {
      id: 'apple',
      label: 'Apple CDN',
      sections: [section('Apple CDN Speedtest')],
    },
    { id: 'regional', label: '地区节点', sections: [section('网络带宽测试')] },
  ];
  const routing: ReviewPanel[] = [
    {
      id: 'return',
      label: '回程路由',
      sections: [section('路由追踪')],
      route: 'return',
    },
    {
      id: 'outbound',
      label: '去程路由',
      sections: [section('去程路由追踪')],
      route: 'outbound',
    },
  ];
  const present = (panels: ReviewPanel[]) =>
    panels
      .map((panel) => ({
        ...panel,
        sections: panel.sections.filter((s) =>
          s.blocks.some((b) => b.type !== 'heading'),
        ),
      }))
      .filter((panel) => panel.sections.length > 0);
  const groups = [hardware, unlock, speed, routing].map(present);
  const navigation = reviewNavigation.filter((item, index) => {
    if (index === 0)
      return ['买', '评'].some((title) => section(title).blocks.length > 0);
    if (item.id === 'unlock')
      return section('服务解锁测试').blocks.some((b) => b.type !== 'heading');
    return groups[index - 1].length > 0;
  });
  return {
    review,
    section,
    hardware: groups[0],
    unlock: groups[1],
    speed: groups[2],
    routing: groups[3],
    navigation,
  };
}
