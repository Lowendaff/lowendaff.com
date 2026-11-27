import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildReviewMap,
  filterReviewPlaces,
  reviewGeoSchema,
  reviewPlaceHref,
  reviewPlaceId,
} from '../src/lib/review-map.ts';
import { initReviewMap } from '../src/scripts/review-map.ts';
import {
  decodeGeographicArc,
  globePoint,
  layoutGlobeLabels,
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
      publishedAt: '2026-11-10',
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
  assert.equal(result.places[0].articles[0].date, '2026-11-10');
  assert.equal(result.places[0].articles[1].date, '2026-11-09');
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

test('decodeGeographicArc decodes delta-quantized flat streams and preserves raw pairs', () => {
  const decoded = decodeGeographicArc(
    [-18000, -8000, 9000, 500, 9000, 300],
    100,
  );
  assert.deepEqual(decoded, [
    [-180, -80],
    [-90, -75],
    [0, -72],
  ]);
  assert.deepEqual(
    decodeGeographicArc(
      [
        [114.17, 22.28],
        [106.63, 10.82],
      ],
      undefined,
    ),
    [
      [114.17, 22.28],
      [106.63, 10.82],
    ],
  );
});

function createMapHarness(places, initialUrl = 'https://lowendaff.com/map/') {
  const makeEl = (attrs = {}, dataset = {}, children = {}) => {
    const listeners = new Map();
    const classes = new Set();
    const attributeMap = new Map(Object.entries(attrs));
    return {
      dataset: { ...dataset },
      hidden: Boolean(attrs.hidden),
      disabled: Boolean(attrs.disabled),
      textContent: attrs.textContent ?? '',
      scrollTop: 0,
      classList: {
        toggle(name, force) {
          const next =
            force === undefined ? !classes.has(name) : Boolean(force);
          next ? classes.add(name) : classes.delete(name);
          return next;
        },
        contains: (name) => classes.has(name),
      },
      setAttribute(key, value) {
        attributeMap.set(key, String(value));
      },
      getAttribute(key) {
        return attributeMap.get(key) ?? null;
      },
      addEventListener(type, fn) {
        const list = listeners.get(type) ?? [];
        list.push(fn);
        listeners.set(type, list);
      },
      click() {
        for (const fn of listeners.get('click') ?? []) fn({});
      },
      trigger(type, event = {}) {
        for (const fn of listeners.get(type) ?? []) fn(event);
      },
      scrollIntoView() {},
      querySelector(sel) {
        return children[sel]?.[0] ?? null;
      },
      querySelectorAll(sel) {
        return children[sel] ?? [];
      },
    };
  };

  const totalArticles = places.reduce((sum, p) => sum + p.articles.length, 0);
  const totalCountries = new Set(places.map((p) => p.country).filter(Boolean))
    .size;

  const typeButtons = ['all', 'vps', 'dedicated'].map((value) =>
    makeEl({ 'aria-pressed': String(value === 'all') }, { mapType: value }),
  );

  const regionButtons = places.map((place) => {
    const countEl = makeEl({ textContent: `${place.articles.length} 篇` });
    return makeEl(
      { 'aria-pressed': 'false' },
      {
        mapSelect: place.id,
        cityLabel: place.city,
        countryLabel: place.country === 'HK' ? '中国香港' : '美国',
      },
      { '[data-place-count]': [countEl] },
    );
  });

  const sections = places.map((place) => {
    const articles = place.articles.map((article) =>
      makeEl({}, { reviewType: article.reviewType }),
    );
    return makeEl(
      {},
      {
        mapPlace: place.id,
        cityLabel: place.city,
        countryLabel: place.country === 'HK' ? '中国香港' : '美国',
      },
      { '[data-map-article]': articles },
    );
  });

  const singletons = {
    '[data-map-data]': [makeEl({ textContent: JSON.stringify({ places }) })],
    '[data-map-title]': [makeEl({ textContent: '测评文章列表' })],
    '[data-map-clear]': [makeEl({ hidden: true })],
    '[data-map-result-status]': [
      makeEl({ textContent: `全部地区 · ${totalArticles} 条测评` }),
    ],
    '[data-map-articles-scroll]': [makeEl()],
    '[data-map-articles-panel]': [makeEl()],
    '[data-globe-status]': [makeEl()],
    '[data-globe-status-text]': [makeEl()],
    '[data-globe-retry]': [makeEl({ hidden: true })],
    '[data-globe-controls]': [makeEl({ hidden: true })],
    '[data-globe-scene]': [makeEl()],
    '[data-map-empty]': [makeEl({ hidden: totalArticles > 0 })],
    '[data-map-region-list]': [
      makeEl(
        { hidden: places.length === 0 },
        {},
        { '[data-map-select]': regionButtons },
      ),
    ],
    '[data-map-regions-empty]': [makeEl({ hidden: places.length > 0 })],
    '[data-map-place-count]': [makeEl({ textContent: String(places.length) })],
    '[data-map-country-count]': [
      makeEl({ textContent: String(totalCountries) }),
    ],
    '[data-map-article-count]': [
      makeEl({ textContent: String(totalArticles) }),
    ],
    '[data-map-region-badge]': [makeEl({ textContent: String(places.length) })],
    '[data-map-tags-link]': [makeEl({ href: '/tags/' })],
    '[data-map-type]': typeButtons,
    '[data-map-select]': regionButtons,
    '[data-map-place]': sections,
  };

  const root = makeEl({}, {}, singletons);
  const globeState = {
    places: [],
    selected: '',
    paused: false,
    focused: null,
    homeResets: 0,
  };
  let onGlobeSelect = () => {};
  const fakeGlobe = {
    setPlaces(nextPlaces, nextSelected = '') {
      globeState.places = nextPlaces;
      globeState.selected = nextSelected;
    },
    setPaused(value) {
      globeState.paused = value;
    },
    focus(place) {
      globeState.focused = place;
    },
    resetHome() {
      globeState.homeResets++;
    },
    destroy() {},
  };

  const loc = { href: initialUrl };
  const winListeners = new Map();
  globalThis.location = loc;
  globalThis.window = {
    location: loc,
    innerWidth: 1440,
    addEventListener(type, fn) {
      const list = winListeners.get(type) ?? [];
      list.push(fn);
      winListeners.set(type, list);
    },
    trigger(type, event = {}) {
      for (const fn of winListeners.get(type) ?? []) fn(event);
    },
  };
  globalThis.history = {
    replaceState(_state, _title, nextUrl) {
      loc.href = String(nextUrl);
    },
    pushState(_state, _title, nextUrl) {
      loc.href = String(nextUrl);
    },
  };
  globalThis.document = {
    querySelector(sel) {
      return sel === '[data-review-map]' ? root : null;
    },
  };
  let intersectCb;
  globalThis.IntersectionObserver = class {
    constructor(cb) {
      intersectCb = cb;
    }
    observe() {}
    disconnect() {}
  };

  return {
    root,
    typeButtons,
    regionButtons,
    sections,
    singletons,
    globeState,
    loc,
    selectOnGlobe: (id) => onGlobeSelect(id),
    async mount() {
      initReviewMap(async (_el, initialPlaces, onSelect) => {
        onGlobeSelect = onSelect;
        fakeGlobe.setPlaces(initialPlaces);
        return fakeGlobe;
      });
      intersectCb?.([{ isIntersecting: true }]);
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
    cleanup() {
      delete globalThis.location;
      delete globalThis.window;
      delete globalThis.history;
      delete globalThis.document;
      delete globalThis.IntersectionObserver;
    },
  };
}

test('VPS and dedicated perspectives isolate cities across globe markers, region list, counts, and selection', async () => {
  const { places } = buildReviewMap([
    post({
      reviewType: 'vps',
      title: 'LA VPS',
      permalink: '/reviews/la-vps-20261109/',
      country: 'US',
      location: '美国 · 洛杉矶',
      geo: { city: '洛杉矶', latitude: 34.05, longitude: -118.24 },
    }),
    post({
      reviewType: 'dedicated',
      title: 'HK Dedicated',
      permalink: '/reviews/hk-dedicated-20261109/',
      country: 'HK',
      location: '中国香港 · 香港',
      geo: { city: '香港', latitude: 22.32, longitude: 114.17 },
    }),
  ]);

  const h = createMapHarness(places);
  try {
    await h.mount();
    const laBtn = h.regionButtons.find(
      (b) => b.dataset.mapSelect === 'us-洛杉矶',
    );
    const hkBtn = h.regionButtons.find(
      (b) => b.dataset.mapSelect === 'hk-香港',
    );
    const vpsTab = h.typeButtons.find((b) => b.dataset.mapType === 'vps');
    const dedTab = h.typeButtons.find((b) => b.dataset.mapType === 'dedicated');

    // Switch to VPS perspective: Hong Kong must NOT appear in globe or region list
    vpsTab.click();
    assert.deepEqual(
      h.globeState.places.map((p) => p.id),
      ['us-洛杉矶'],
    );
    assert.equal(laBtn.hidden, false);
    assert.equal(hkBtn.hidden, true);
    assert.equal(h.singletons['[data-map-place-count]'][0].textContent, '1');
    assert.equal(h.singletons['[data-map-country-count]'][0].textContent, '1');
    assert.equal(h.singletons['[data-map-article-count]'][0].textContent, '1');
    assert.equal(h.singletons['[data-map-region-badge]'][0].textContent, '1');

    // Hovering a region button highlights its globe marker without hijacking camera focus
    vpsTab.click();
    h.globeState.focused = null;
    laBtn.trigger('pointerenter');
    assert.equal(h.globeState.selected, 'us-洛杉矶');
    assert.equal(h.globeState.focused, null);
    assert.equal(h.globeState.paused, false);
    laBtn.trigger('pointerleave');
    assert.equal(h.globeState.selected, '');

    // Switch to Dedicated perspective: Los Angeles must NOT appear in globe or region list
    dedTab.click();
    assert.deepEqual(
      h.globeState.places.map((p) => p.id),
      ['hk-香港'],
    );
    assert.equal(laBtn.hidden, true);
    assert.equal(hkBtn.hidden, false);
    assert.equal(h.singletons['[data-map-place-count]'][0].textContent, '1');
    assert.equal(h.singletons['[data-map-country-count]'][0].textContent, '1');
    assert.equal(h.singletons['[data-map-article-count]'][0].textContent, '1');
    assert.equal(h.singletons['[data-map-region-badge]'][0].textContent, '1');

    // Selecting Hong Kong focuses camera without permanently freezing auto-spin, and switching to VPS clears stale HK selection
    hkBtn.click();
    assert.equal(h.globeState.focused?.id, 'hk-香港');
    assert.equal(h.globeState.paused, false);
    assert.equal(
      h.singletons['[data-map-title]'][0].textContent,
      '香港 测评文章',
    );
    assert.equal(
      h.singletons['[data-map-tags-link]'][0].getAttribute('href'),
      '/tags/?type=dedicated&country=HK',
    );
    const resetsBefore = h.globeState.homeResets;
    vpsTab.click();
    assert.equal(h.globeState.paused, false);
    assert.equal(h.globeState.homeResets, resetsBefore + 1);
    assert.equal(
      h.singletons['[data-map-title]'][0].textContent,
      '测评文章列表',
    );
    assert.equal(
      h.singletons['[data-map-tags-link]'][0].getAttribute('href'),
      '/tags/?type=vps',
    );
    assert(!new URL(h.loc.href).searchParams.has('place'));
    assert.equal(
      h.sections.find((s) => s.dataset.mapPlace === 'us-洛杉矶').hidden,
      false,
    );
  } finally {
    h.cleanup();
  }
});

test('conflicting URL query and empty type perspective cleanly reset without leaking mismatched cities', async () => {
  const { places } = buildReviewMap([
    post({
      reviewType: 'vps',
      title: 'LA VPS',
      permalink: '/reviews/la-vps-20261109/',
      country: 'US',
      location: '美国 · 洛杉矶',
      geo: { city: '洛杉矶', latitude: 34.05, longitude: -118.24 },
    }),
    post({
      reviewType: 'dedicated',
      title: 'HK Dedicated',
      permalink: '/reviews/hk-dedicated-20261109/',
      country: 'HK',
      location: '中国香港 · 香港',
      geo: { city: '香港', latitude: 22.32, longitude: 114.17 },
    }),
  ]);

  // Direct entry with conflicting ?type=vps&place=hk-香港 drops the mismatched place
  const conflict = createMapHarness(
    places,
    'https://lowendaff.com/map/?type=vps&place=hk-%E9%A6%99%E6%B8%AF',
  );
  try {
    await conflict.mount();
    assert.deepEqual(
      conflict.globeState.places.map((p) => p.id),
      ['us-洛杉矶'],
    );
    assert.equal(conflict.loc.href, 'https://lowendaff.com/map/?type=vps');
    assert.equal(
      conflict.singletons['[data-map-title]'][0].textContent,
      '测评文章列表',
    );
    assert.equal(
      conflict.sections.find((s) => s.dataset.mapPlace === 'us-洛杉矶').hidden,
      false,
    );
  } finally {
    conflict.cleanup();
  }

  // Only VPS reviews exist, switching to dedicated hides all cities and shows empty states
  const vpsOnly = filterReviewPlaces(places, 'vps');
  const emptyDed = createMapHarness(vpsOnly);
  try {
    await emptyDed.mount();
    emptyDed.typeButtons.find((b) => b.dataset.mapType === 'dedicated').click();
    assert.deepEqual(emptyDed.globeState.places, []);
    assert.equal(emptyDed.singletons['[data-map-region-list]'][0].hidden, true);
    assert.equal(
      emptyDed.singletons['[data-map-regions-empty]'][0].hidden,
      false,
    );
    assert.equal(emptyDed.singletons['[data-map-empty]'][0].hidden, false);
    assert.equal(
      emptyDed.singletons['[data-map-place-count]'][0].textContent,
      '0',
    );
  } finally {
    emptyDed.cleanup();
  }
});

test('filterReviewPlaces recalculates per-city counts and re-sorts mixed cities by active type', () => {
  const { places } = buildReviewMap([
    post({
      reviewType: 'dedicated',
      permalink: '/reviews/hk-ded-1-20261109/',
      country: 'HK',
      geo: { city: '香港', latitude: 22.32, longitude: 114.17 },
    }),
    post({
      reviewType: 'dedicated',
      permalink: '/reviews/hk-ded-2-20261109/',
      country: 'HK',
      geo: { city: '香港', latitude: 22.32, longitude: 114.17 },
    }),
    post({
      reviewType: 'vps',
      permalink: '/reviews/hk-vps-1-20261109/',
      country: 'HK',
      geo: { city: '香港', latitude: 22.32, longitude: 114.17 },
    }),
    post({
      reviewType: 'vps',
      permalink: '/reviews/la-vps-1-20261109/',
      country: 'US',
      geo: { city: '洛杉矶', latitude: 34.05, longitude: -118.24 },
    }),
    post({
      reviewType: 'vps',
      permalink: '/reviews/la-vps-2-20261109/',
      country: 'US',
      geo: { city: '洛杉矶', latitude: 34.05, longitude: -118.24 },
    }),
  ]);
  assert.deepEqual(
    filterReviewPlaces(places, 'all').map((p) => [p.id, p.count]),
    [
      ['hk-香港', 3],
      ['us-洛杉矶', 2],
    ],
  );
  assert.deepEqual(
    filterReviewPlaces(places, 'vps').map((p) => [p.id, p.count]),
    [
      ['us-洛杉矶', 2],
      ['hk-香港', 1],
    ],
  );
  assert.deepEqual(
    filterReviewPlaces(places, 'dedicated').map((p) => [p.id, p.count]),
    [['hk-香港', 2]],
  );
});

test('article recommendation map link shares exact placeId normalization and reviewType with review-map', () => {
  const spacedCityPost = post({
    reviewType: 'dedicated',
    country: 'US',
    geo: { city: 'Los Angeles', latitude: 34.05, longitude: -118.24 },
  });
  const { places } = buildReviewMap([spacedCityPost]);
  const href = reviewPlaceHref('US', 'Los Angeles', 'dedicated');
  const params = new URL(href, 'https://lowendaff.com').searchParams;
  assert.equal(params.get('type'), 'dedicated');
  assert.equal(params.get('place'), places[0].id);
  assert.equal(params.get('place'), reviewPlaceId('US', 'Los Angeles'));
});

test('layoutGlobeLabels fans close neighbors like Grand Rapids and Detroit into non-overlapping anchors', () => {
  // Grand Rapids (west, x=240) and Detroit (east, x=256) 16px apart
  const pair = layoutGlobeLabels(
    [
      {
        id: 'us-大急流城',
        x: 240,
        y: 210,
        labelWidth: 88,
        labelHeight: 28,
        count: 1,
        active: false,
      },
      {
        id: 'us-底特律',
        x: 256,
        y: 214,
        labelWidth: 76,
        labelHeight: 28,
        count: 1,
        active: false,
      },
    ],
    560,
    520,
  );
  assert.equal(pair[0].anchor, 'left');
  assert.equal(pair[0].labelHidden, false);
  assert.equal(pair[1].anchor, 'right');
  assert.equal(pair[1].labelHidden, false);

  // Near the left stage edge where 'left' would clip out of bounds, western city pivots to 'top' or 'bottom' while both stay visible
  const nearLeftEdge = layoutGlobeLabels(
    [
      {
        id: 'us-大急流城',
        x: 60,
        y: 210,
        labelWidth: 88,
        labelHeight: 28,
        count: 1,
        active: false,
      },
      {
        id: 'us-底特律',
        x: 76,
        y: 214,
        labelWidth: 76,
        labelHeight: 28,
        count: 1,
        active: false,
      },
    ],
    560,
    520,
  );
  assert.notEqual(nearLeftEdge[0].anchor, 'left');
  assert.notEqual(nearLeftEdge[0].anchor, 'right');
  assert.equal(nearLeftEdge[0].labelHidden, false);
  assert.equal(nearLeftEdge[1].anchor, 'right');
  assert.equal(nearLeftEdge[1].labelHidden, false);

  // 4-city regional cluster fans into all 4 cardinal anchors with 0 hidden labels
  const quad = layoutGlobeLabels(
    [
      {
        id: 'c-west',
        x: 250,
        y: 250,
        labelWidth: 80,
        labelHeight: 28,
        count: 1,
        active: false,
      },
      {
        id: 'c-east',
        x: 274,
        y: 250,
        labelWidth: 80,
        labelHeight: 28,
        count: 1,
        active: false,
      },
      {
        id: 'c-north',
        x: 262,
        y: 234,
        labelWidth: 80,
        labelHeight: 28,
        count: 1,
        active: false,
      },
      {
        id: 'c-south',
        x: 262,
        y: 266,
        labelWidth: 80,
        labelHeight: 28,
        count: 1,
        active: false,
      },
    ],
    560,
    520,
  );
  assert(quad.every((p) => !p.labelHidden));
  assert.equal(new Set(quad.map((p) => p.anchor)).size, 4);

  // Active city always keeps its label visible even in a 6-city tight stack
  const dense = layoutGlobeLabels(
    Array.from({ length: 6 }, (_, idx) => ({
      id: `city-${idx}`,
      x: 260 + idx * 2,
      y: 260 + idx * 2,
      labelWidth: 90,
      labelHeight: 28,
      count: 1,
      active: idx === 5,
    })),
    560,
    520,
  );
  assert.equal(dense[5].labelHidden, false);
  assert(dense.some((p) => p.labelHidden));
});
