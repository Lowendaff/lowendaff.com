import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeAnalytics } from '../src/scripts/analytics.ts';
import { analyticsSchema, analyticsForPage } from '../src/lib/analytics.ts';

const fixture = () => ({
  enabled: true,
  allowedHosts: ['lowendaff.com'],
  excludePaths: ['/components/'],
  providers: [
    {
      name: 'google',
      type: 'ga4',
      enabled: true,
      measurementId: 'G-TEST12345',
    },
  ],
});

function withBrowser(config, hostname, run) {
  const element = config
    ? { textContent: JSON.stringify(config), dataset: {} }
    : null;
  const scripts = [];
  globalThis.window = {};
  globalThis.location = { hostname };
  globalThis.document = {
    getElementById: () => element,
    createElement: () => ({
      dataset: {},
      attributes: {},
      setAttribute(key, value) {
        this.attributes[key] = value;
      },
    }),
    head: { append: (script) => scripts.push(script) },
  };
  try {
    run(scripts, globalThis.window);
  } finally {
    delete globalThis.window;
    delete globalThis.location;
    delete globalThis.document;
  }
}

test('Browser initialization loads GA and a second provider only once', () => {
  const config = fixture();
  config.providers.push({
    name: 'stats',
    type: 'script',
    enabled: true,
    src: 'https://stats.example.com/script.js',
    attributes: { 'data-website-id': 'site-id' },
  });
  withBrowser(config, 'lowendaff.com', (scripts, browser) => {
    initializeAnalytics();
    initializeAnalytics();
    assert.equal(scripts.length, 2);
    assert.equal(
      scripts[0].src,
      'https://www.googletagmanager.com/gtag/js?id=G-TEST12345',
    );
    assert.equal(scripts[1].attributes['data-website-id'], 'site-id');
    assert(scripts.every((script) => script.async === true));
    assert.deepEqual(
      browser.dataLayer.map((args) => Array.from(args).slice(0, 2))[1],
      ['config', 'G-TEST12345'],
    );
    assert.equal(browser.dataLayer.length, 2);
  });
});

test('Browser hostname gate and missing preview configuration send no requests', () => {
  withBrowser(fixture(), '127.0.0.1', (scripts, browser) => {
    initializeAnalytics();
    assert.equal(scripts.length, 0);
    assert.equal(browser.gtag, undefined);
  });
  withBrowser(null, 'lowendaff.com', (scripts) => {
    initializeAnalytics();
    assert.equal(scripts.length, 0);
  });
});

test('The maintained JSON configuration passes the same schema used in the build', () => {
  analyticsSchema.parse(
    JSON.parse(
      readFileSync(
        new URL('../src/config/analytics.json', import.meta.url),
        'utf8',
      ),
    ),
  );
});

test('Master switch, provider switch, excluded page and preview build suppress tracking', () => {
  const config = analyticsSchema.parse(fixture());
  assert.equal(analyticsForPage(config, true, '/').length, 1);
  assert.equal(analyticsForPage(config, false, '/').length, 0);
  assert.equal(analyticsForPage(config, true, '/components/').length, 0);
  config.enabled = false;
  assert.equal(analyticsForPage(config, true, '/').length, 0);
  config.enabled = true;
  config.providers[0].enabled = false;
  assert.equal(analyticsForPage(config, true, '/').length, 0);
});

test('Bad IDs, unknown options and duplicate destinations fail instead of silently falling back', () => {
  for (const change of [
    (config) => {
      config.providers[0].measurementId = 'UA-123';
    },
    (config) => {
      config.enabled = 'true';
    },
    (config) => {
      config.providers[0].inline = 'alert(1)';
    },
    (config) => {
      config.providers.push({ ...config.providers[0], name: 'duplicate' });
    },
    (config) => {
      config.allowedHosts = ['https://lowendaff.com'];
    },
  ]) {
    const config = fixture();
    change(config);
    assert.equal(analyticsSchema.safeParse(config).success, false);
  }
});

test('External providers accept data attributes, but reject inline handlers and unsafe URLs', () => {
  const provider = {
    name: 'other',
    type: 'script',
    enabled: true,
    src: 'https://stats.example.com/script.js',
    attributes: { 'data-website-id': 'example' },
  };
  const config = fixture();
  config.providers.push(provider);
  assert(analyticsSchema.safeParse(config).success);
  for (const src of [
    'http://stats.example.com/script.js',
    'javascript:alert(1)',
    'https://user:pass@stats.example.com/script.js',
    'https://www.googletagmanager.com/gtag/js?id=G-TEST',
  ]) {
    assert(
      !analyticsSchema.safeParse({
        ...config,
        providers: [{ ...provider, src }],
      }).success,
    );
  }
  assert(
    !analyticsSchema.safeParse({
      ...config,
      providers: [{ ...provider, attributes: { onload: 'alert(1)' } }],
    }).success,
  );
});
