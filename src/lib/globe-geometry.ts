/** Three.js SphereGeometry UVs: Greenwich faces +X, east rotates toward -Z. */
export function globePoint(
  latitude: number,
  longitude: number,
  radius = 1,
): [number, number, number] {
  const lat = (latitude * Math.PI) / 180;
  const lng = (longitude * Math.PI) / 180;
  return [
    radius * Math.cos(lat) * Math.cos(lng),
    radius * Math.sin(lat),
    -radius * Math.cos(lat) * Math.sin(lng),
  ];
}

/** Decode delta-encoded integer coordinate streams ([x0, y0, dx1, dy1, ...]) or pass raw pairs through. */
export function decodeGeographicArc(
  arc: number[][] | number[],
  scale?: number,
): number[][] {
  if (!scale || Array.isArray(arc[0])) return arc as number[][];
  const flat = arc as number[];
  const points: number[][] = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i < flat.length; i += 2) {
    x += flat[i];
    y += flat[i + 1];
    points.push([x / scale, y / scale]);
  }
  return points;
}

/** Unwrap open paths without inventing an edge across the date line. */
export function unwrapGeographicLine(line: number[][]): number[][] {
  const result: number[][] = [];
  for (const [longitude, latitude] of line) {
    let unwrapped = longitude;
    const previous = result.at(-1)?.[0] ?? longitude;
    while (unwrapped - previous > 180) unwrapped -= 360;
    while (unwrapped - previous < -180) unwrapped += 360;
    result.push([unwrapped, latitude]);
  }
  return result;
}

/** Keep coastlines continuous across the date line; close polar caps at the pole. */
export function unwrapLandRing(ring: number[][]): number[][] {
  const result = unwrapGeographicLine(ring);
  if (result.length && Math.abs(result.at(-1)![0] - result[0][0]) > 180) {
    const pole = ring.reduce((sum, point) => sum + point[1], 0) < 0 ? -90 : 90;
    result.push([result.at(-1)![0], pole], [result[0][0], pole]);
  }
  return result;
}

export type GlobeLabelAnchor = 'right' | 'left' | 'top' | 'bottom';

export interface GlobeLabelItem {
  id: string;
  x: number;
  y: number;
  labelWidth: number;
  labelHeight: number;
  count: number;
  active: boolean;
  prevAnchor?: GlobeLabelAnchor;
}

export interface GlobeLabelPlacement {
  id: string;
  anchor: GlobeLabelAnchor;
  labelHidden: boolean;
}

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

const ANCHOR_SPECS: readonly {
  anchor: GlobeLabelAnchor;
  dirX: number;
  dirY: number;
  baseCost: number;
}[] = [
  { anchor: 'right', dirX: 1, dirY: 0, baseCost: 0 },
  { anchor: 'left', dirX: -1, dirY: 0, baseCost: 6 },
  { anchor: 'top', dirX: 0, dirY: -1, baseCost: 14 },
  { anchor: 'bottom', dirX: 0, dirY: 1, baseCost: 16 },
];

function candidateLabelRect(
  x: number,
  y: number,
  lw: number,
  lh: number,
  anchor: GlobeLabelAnchor,
): Rect {
  switch (anchor) {
    case 'right':
      return {
        left: x + 16,
        top: y - lh / 2,
        right: x + 16 + lw,
        bottom: y + lh / 2,
      };
    case 'left':
      return {
        left: x - 16 - lw,
        top: y - lh / 2,
        right: x - 16,
        bottom: y + lh / 2,
      };
    case 'top':
      return {
        left: x - lw / 2,
        top: y - 14 - lh,
        right: x + lw / 2,
        bottom: y - 14,
      };
    case 'bottom':
      return {
        left: x - lw / 2,
        top: y + 14,
        right: x + lw / 2,
        bottom: y + 14 + lh,
      };
  }
}

/**
 * Place city pills around projected 3D globe dots using 4 cardinal anchors
 * so neighboring cities (e.g. Grand Rapids & Detroit) fan apart cleanly
 * without overlapping each other's dots or labels.
 */
export function layoutGlobeLabels(
  items: readonly GlobeLabelItem[],
  stageWidth: number,
  stageHeight: number,
): GlobeLabelPlacement[] {
  if (items.length === 0) return [];

  const dotRects: Rect[] = items.map((item) => ({
    left: item.x - 10,
    top: item.y - 10,
    right: item.x + 10,
    bottom: item.y + 10,
  }));

  const order = items
    .map((_, index) => index)
    .sort(
      (i, j) =>
        Number(items[j].active) - Number(items[i].active) ||
        items[j].count - items[i].count ||
        items[i].id.localeCompare(items[j].id),
    );

  const placedLabels: Rect[] = [];
  const results = new Array<GlobeLabelPlacement>(items.length);
  const stageMargin = 8;

  for (const idx of order) {
    const item = items[idx];
    const lw = Math.max(40, item.labelWidth || 84);
    const lh = Math.max(22, item.labelHeight || 28);

    let bestAnchor: GlobeLabelAnchor = 'right';
    let bestRect: Rect = candidateLabelRect(item.x, item.y, lw, lh, 'right');
    let bestLabelOverlap = Infinity;
    let bestOverflow = Infinity;
    let bestScore = Infinity;

    for (const { anchor, dirX, dirY, baseCost } of ANCHOR_SPECS) {
      const rect = candidateLabelRect(item.x, item.y, lw, lh, anchor);
      const overflow =
        Math.max(0, stageMargin - rect.left) +
        Math.max(0, rect.right - (stageWidth - stageMargin)) +
        Math.max(0, stageMargin - rect.top) +
        Math.max(0, rect.bottom - (stageHeight - stageMargin));

      const paddedLabel: Rect = {
        left: rect.left - 6,
        top: rect.top - 4,
        right: rect.right + 6,
        bottom: rect.bottom + 4,
      };
      let labelOverlap = 0;
      for (const placed of placedLabels) {
        labelOverlap += overlapArea(paddedLabel, placed);
      }

      const fullCorridor: Rect = {
        left: Math.min(rect.left, item.x - 4),
        top: Math.min(rect.top, item.y - 4),
        right: Math.max(rect.right, item.x + 4),
        bottom: Math.max(rect.bottom, item.y + 4),
      };
      let dotOverlap = 0;
      let repulsion = 0;
      for (let otherIdx = 0; otherIdx < items.length; otherIdx++) {
        if (otherIdx === idx) continue;
        dotOverlap += overlapArea(fullCorridor, dotRects[otherIdx]);
        const other = items[otherIdx];
        const dx = other.x - item.x;
        const dy = other.y - item.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 160) {
          const ux = dist > 1e-3 ? dx / dist : other.id > item.id ? 1 : -1;
          const uy = dist > 1e-3 ? dy / dist : 0;
          const weight = 1 - dist / 160;
          repulsion += weight * (ux * dirX + uy * dirY) * 45;
        }
      }

      const hysteresis = item.prevAnchor === anchor ? -5 : 0;
      const score =
        baseCost +
        repulsion +
        hysteresis +
        overflow * 200 +
        dotOverlap * 50 +
        labelOverlap * 120;

      if (score < bestScore) {
        bestScore = score;
        bestAnchor = anchor;
        bestRect = rect;
        bestLabelOverlap = labelOverlap;
        bestOverflow = overflow;
      }
    }

    const labelHidden =
      !item.active && (bestLabelOverlap > 0 || bestOverflow > 16);
    if (!labelHidden) {
      placedLabels.push(bestRect);
    }
    results[idx] = {
      id: item.id,
      anchor: bestAnchor,
      labelHidden,
    };
  }

  return results;
}
