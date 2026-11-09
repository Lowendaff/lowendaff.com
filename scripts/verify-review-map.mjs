import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReviewMap, reviewGeoSchema } from '../src/lib/review-map.ts';
import {
  globePoint,
  unwrapGeographicLine,
  unwrapLandRing,
} from '../src/lib/globe-geometry.ts';

const data = {
  kind: 'review',
  draft: false,
  reviewType: 'vps',
  title: 'Map fixture',
  permalink: '/reviews/map-fixture-20261109/',
  vendor: 'Fixture',
  country: 'US',
  location: 'Los Angeles',
  publishedAt: '2026-11-09',
  testedAt: '2026-11-08 12:00 UTC',
  geo: { city: '洛杉矶', latitude: 34.05, longitude: -118.24 },
};
const post = (fields = {}) => ({ data: { ...data, ...fields } });

test('geo requires a city and both finite numeric coordinates for every article', () => {
  for (const value of [
    undefined,
    null,
    {},
    { city: 'LA' },
    { ...data.geo, latitude: undefined },
    { ...data.geo, longitude: null },
    { ...data.geo, latitude: '34.05' },
    { ...data.geo, longitude: NaN },
    { ...data.geo, latitude: Infinity },
    { ...data.geo, city: ' ' },
    { ...data.geo, latitude: 90.01 },
    { ...data.geo, latitude: -90.01 },
    { ...data.geo, longitude: 180.01 },
    { ...data.geo, longitude: -180.01 },
  ]) {
    assert.equal(
      reviewGeoSchema.safeParse(value).success,
      false,
      JSON.stringify(value),
    );
  }
  for (const [latitude, longitude] of [
    [-90, -180],
    [90, 180],
    [0, 0],
  ]) {
    assert.equal(
      reviewGeoSchema.safeParse({
        city: 'Boundary fixture',
        latitude,
        longitude,
      }).success,
      true,
    );
  }
});
test('the map does not silently place reviews with missing coordinates', () => {
  assert.throws(() => buildReviewMap([post({ geo: undefined })]));
});
test('published reviews aggregate by country and city, excluding drafts and external references', () => {
  const result = buildReviewMap([
    post(),
    post({ draft: true, title: 'Hidden draft' }),
    post({ kind: 'archive-reference', title: 'External reference' }),
    post({
      reviewType: 'dedicated',
      testedAt: '2026-11-09',
      permalink: '/reviews/retest-20261109/',
    }),
    post({
      country: 'JP',
      geo: { city: '东京', latitude: 35.68, longitude: 139.69 },
    }),
  ]);
  assert.equal(result.places.length, 2);
  assert.equal(result.places[0].articles.length, 2);
  assert.equal(result.places[0].articles[0].reviewType, 'dedicated');
  assert.equal(result.places[0].articles[0].date, '2026-11-09');
  assert.equal(result.places[0].articles[1].date, '2026-11-08');
  assert(!JSON.stringify(result).includes('Hidden draft'));
  assert(!JSON.stringify(result).includes('External reference'));
});
test('empty and all-draft collections have no invented markers', () => {
  assert.deepEqual(buildReviewMap([]), { places: [] });
  assert.deepEqual(buildReviewMap([post({ draft: true })]), { places: [] });
});
test('matching city names in different countries remain separate, permalinks stay canonical', () => {
  const { places } = buildReviewMap([
    post({ country: 'US' }),
    post({ country: 'CA', permalink: '/reviews/中文测试-20261109/' }),
  ]);
  assert.equal(places.length, 2);
  assert.equal(new Set(places.map((place) => place.id)).size, 2);
  assert(
    places.some(
      (place) =>
        place.articles[0].href === encodeURI('/reviews/中文测试-20261109/'),
    ),
  );
});
test('geographic coordinates align with equirectangular texture orientation and radius', () => {
  const near = (a, b) =>
    a.forEach((value, index) => assert(Math.abs(value - b[index]) < 1e-10));
  near(globePoint(0, 0), [1, 0, 0]);
  near(globePoint(0, 90), [0, 0, -1]);
  near(globePoint(90, 0), [0, 1, 0]);
  near(globePoint(0, -90), [0, 0, 1]);
  near(globePoint(0, 180), [-1, 0, 0]);
  assert(Math.abs(Math.hypot(...globePoint(34.05, -118.24, 3)) - 3) < 1e-10);
});

test('date-line islands do not draw a line through every longitude', () => {
  const ring = unwrapLandRing([
    [179, -16],
    [-179, -17],
    [-179, -16],
    [179, -16],
  ]);
  assert.deepEqual(ring, [
    [179, -16],
    [181, -17],
    [181, -16],
    [179, -16],
  ]);
});
test('open borders cross the date line without closing into a polygon', () => {
  assert.deepEqual(
    unwrapGeographicLine([
      [179, 50],
      [-179, 51],
      [-178, 52],
    ]),
    [
      [179, 50],
      [181, 51],
      [182, 52],
    ],
  );
});
test('Antarctica closes at the south pole instead of covering other continents', () => {
  const ring = unwrapLandRing([
    [-180, -80],
    [-90, -75],
    [0, -72],
    [90, -76],
    [-180, -80],
  ]);
  assert.deepEqual(ring.slice(-2), [
    [180, -90],
    [-180, -90],
  ]);
});
