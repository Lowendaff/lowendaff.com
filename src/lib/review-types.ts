export const reviewTypes = ['vps', 'dedicated'] as const;
export type ReviewType = (typeof reviewTypes)[number];

export const reviewTypeLabels: Record<ReviewType, string> = {
  vps: 'VPS',
  dedicated: '独立服务器',
};

export function isReviewType(value: string | null): value is ReviewType {
  return value === 'vps' || value === 'dedicated';
}
