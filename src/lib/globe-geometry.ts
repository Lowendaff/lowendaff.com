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
