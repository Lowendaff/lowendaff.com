export interface SortablePostFields {
  id?: string;
  pinned?: boolean;
  publishedAt: string;
  updatedAt?: string;
  testedAt?: string;
}

const TIMESTAMP_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([A-Za-z+-][A-Za-z0-9:+-]*)?)?$/;

function resolveTzOffsetMinutes(rawTz: string | undefined): number {
  if (!rawTz) return 8 * 60;
  const upper = rawTz.trim().toUpperCase();
  if (upper === 'CST' || upper === 'UTC+8' || upper === 'GMT+8') return 8 * 60;
  if (upper === 'Z' || upper === 'UTC' || upper === 'GMT') return 0;
  const offsetMatch = upper.match(/^([+-])(\d{2}):?(\d{2})$/);
  if (offsetMatch) {
    const sign = offsetMatch[1] === '-' ? -1 : 1;
    return sign * (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3]));
  }
  return 8 * 60;
}

export function parseReviewTimestampMs(
  testedAt?: string,
  publishedAt?: string,
): number {
  const source = testedAt?.trim() || publishedAt?.trim() || '';
  const match = source.match(TIMESTAMP_RE);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const hour = match[4] !== undefined ? Number(match[4]) : 0;
    const minute = match[5] !== undefined ? Number(match[5]) : 0;
    const second = match[6] !== undefined ? Number(match[6]) : 0;
    const offsetMin = resolveTzOffsetMinutes(match[7]);
    return (
      Date.UTC(year, month, day, hour, minute, second) - offsetMin * 60 * 1000
    );
  }
  if (publishedAt) {
    const fallback = Date.parse(`${publishedAt}T00:00:00+08:00`);
    if (Number.isFinite(fallback)) return fallback;
  }
  return 0;
}

export function comparePostOrder(
  a: SortablePostFields,
  b: SortablePostFields,
  options: { honorPinned?: boolean } = {},
): number {
  const { honorPinned = true } = options;
  if (honorPinned) {
    const pinDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    if (pinDiff !== 0) return pinDiff;
  }
  const pubDiff = b.publishedAt.localeCompare(a.publishedAt);
  if (pubDiff !== 0) return pubDiff;
  const timeDiff =
    parseReviewTimestampMs(b.testedAt, b.publishedAt) -
    parseReviewTimestampMs(a.testedAt, a.publishedAt);
  if (timeDiff !== 0) return timeDiff;
  const updDiff = (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
  if (updDiff !== 0) return updDiff;
  return (a.id ?? '').localeCompare(b.id ?? '');
}
