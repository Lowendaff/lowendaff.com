import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import {
  hash,
  validateConfig,
  validateIndex,
  validateState,
  planState,
  assertDeployment,
  submitPending,
} from './indexnow-core.mjs';
import {
  contentFingerprint,
  buildSearchIndex,
  pageFingerprint,
} from './build-search-index.mjs';

const config = {
  site: 'https://lowendaff.com',
  indexNow: {
    enabled: true,
    key: 'a'.repeat(32),
    endpoint: 'https://api.indexnow.org/indexnow',
  },
};
const home = config.site + '/';
const article = config.site + '/reviews/test-server/';
const commit = 'a'.repeat(40);
const digest = hash('content');
const html = (body) =>
  `<html><head><title>真实测评</title><meta name="description" content="实测数据"></head><body><nav>导航</nav><main>${body}</main></body></html>`;

test('strict configuration and canonical URL boundaries', () => {
  assert.deepEqual(validateConfig(config), config);
  for (const indexNow of [
    { ...config.indexNow, key: 'bad' },
    { ...config.indexNow, endpoint: 'https://evil.example/indexnow' },
    { ...config.indexNow, enabled: 'true' },
  ])
    assert.throws(() => validateConfig({ ...config, indexNow }));
  for (const url of [
    'https://evil.example/',
    `${home}?country=US`,
    `${home}components/`,
    `${home}reviews/../ads/`,
  ])
    assert.throws(() =>
      validateIndex(
        {
          schema: 1,
          site: config.site,
          indexable: true,
          entries: { [url]: digest },
        },
        config.site,
      ),
    );
  assert.throws(() =>
    validateIndex(
      {
        schema: 1,
        site: config.site,
        indexable: false,
        entries: { [home]: digest },
      },
      config.site,
    ),
  );
});

test('CSS, JS, SVG and theme-only changes do not resubmit unchanged content', () => {
  const first = html(
    '<section class="old"><h1>VPS 测评</h1><p>延迟 20ms</p><svg><path d="old"/></svg><script>old()</script></section>',
  );
  const second = html(
    '<section class="new" style="color:red" data-theme="dark"><h1>VPS 测评</h1><p>延迟 20ms</p><svg><path d="new"/></svg><script>new()</script></section>',
  );
  assert.equal(contentFingerprint(first), contentFingerprint(second));
  assert.notEqual(
    contentFingerprint(first),
    contentFingerprint(first.replace('20ms', '25ms')),
  );
});

test('links, metadata, table cells and image descriptions affect fingerprints', () => {
  const first = html(
    '<a href="/reviews/one/">测评</a><img src="/bgp.png" alt="IPv4"><table><tr><td>200</td></tr></table>',
  );
  for (const next of [
    first.replace('/reviews/one/', '/reviews/two/'),
    first.replace('IPv4', 'IPv6'),
    first.replace('200', '300'),
    first.replace('实测数据', '更新实测数据'),
  ])
    assert.notEqual(contentFingerprint(first), contentFingerprint(next));
});

test('replacing local evidence image bytes at the same URL changes the fingerprint', async () => {
  const directory = await mkdtemp(`${tmpdir()}/lowendaff-image-test-`);
  const root = pathToFileURL(directory + '/');
  try {
    const page = html('<img src="/bgp.png" alt="IPv4 BGP">');
    await writeFile(new URL('bgp.png', root), 'first evidence');
    const first = await pageFingerprint(page, root);
    await writeFile(new URL('bgp.png', root), 'updated evidence');
    assert.notEqual(first, await pageFingerprint(page, root));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('new, changed and deleted URLs are queued while unchanged URLs are omitted', () => {
  const previous = {
    observed: { [home]: digest, [article]: digest },
    pending: {},
  };
  const current = { [home]: hash('new'), [config.site + '/ads/']: digest };
  const state = planState(previous, current, commit);
  assert.deepEqual(state.pending, {
    [home]: hash('new'),
    [article]: null,
    [config.site + '/ads/']: digest,
  });
  assert.deepEqual(
    planState({ observed: current, pending: {} }, current, commit).pending,
    {},
  );
  validateState(state, config.site);
});

test('failed pending updates survive the next build even without further content changes', () => {
  const current = { [home]: digest };
  const failed = planState(null, current, commit);
  assert.deepEqual(planState(failed, current, commit).pending, {
    [home]: digest,
  });
  assert.deepEqual(planState(failed, {}, commit).pending, { [home]: null });
});

test('wrong deployment, preview and a different build attempt cannot trigger a submission', () => {
  const actual = {
    schema: 1,
    repository: 'Lowendaff/lowendaff.com',
    commit,
    runId: '1',
    runAttempt: '2',
    indexable: true,
    searchIndexSha256: digest,
  };
  assertDeployment(actual, actual);
  for (const delta of [
    { commit: 'b'.repeat(40) },
    { indexable: false },
    { runId: '2' },
    { runAttempt: '1' },
    { searchIndexSha256: undefined },
  ])
    assert.throws(() => assertDeployment({ ...actual, ...delta }, actual));
});

test('200 and 202 acknowledge exactly the submitted batch', async () => {
  for (const status of [200, 202]) {
    let sent;
    const state = planState(null, { [home]: digest }, commit);
    await submitPending(state, config, {
      persist: async () => {},
      assertLive: async () => {},
      fetcher: async (url, init) => {
        sent = JSON.parse(init.body);
        assert.equal(url, config.indexNow.endpoint);
        return { status };
      },
    });
    assert.equal(sent.host, 'lowendaff.com');
    assert.equal(sent.keyLocation, `${config.site}/${config.indexNow.key}.txt`);
    assert.deepEqual(sent.urlList, [home]);
    assert.deepEqual(state.pending, {});
    assert.deepEqual(state.responses, [{ status, count: 1 }]);
  }
});

test('errors and throttling keep the durable pending queue', async () => {
  for (const status of [403, 422, 429, 500]) {
    const state = planState(null, { [home]: digest }, commit);
    let saved;
    await assert.rejects(
      submitPending(state, config, {
        persist: async (value) => {
          saved = structuredClone(value);
        },
        assertLive: async () => {},
        fetcher: async () => ({ status }),
      }),
    );
    assert.deepEqual(saved.pending, { [home]: digest });
  }
});

test('release changes prevent outbound traffic and network failures preserve pending URLs', async () => {
  const state = planState(null, { [home]: digest }, commit);
  let requests = 0;
  await assert.rejects(
    submitPending(state, config, {
      persist: async () => {},
      assertLive: async () => {
        throw new Error('release changed');
      },
      fetcher: async () => {
        requests++;
      },
    }),
  );
  assert.equal(requests, 0);
  await assert.rejects(
    submitPending(state, config, {
      persist: async () => {},
      assertLive: async () => {},
      fetcher: async () => {
        throw new TypeError('network');
      },
    }),
  );
  assert.deepEqual(state.pending, { [home]: digest });
});

test('batches stay within 10000 URLs and preserve later failures', async () => {
  const entries = Object.fromEntries(
    Array.from({ length: 10001 }, (_, i) => [
      `${config.site}/reviews/test-${i}/`,
      digest,
    ]),
  );
  const state = planState(null, entries, commit);
  const counts = [];
  await assert.rejects(
    submitPending(state, config, {
      persist: async () => {},
      assertLive: async () => {},
      fetcher: async (_, init) => {
        counts.push(JSON.parse(init.body).urlList.length);
        return { status: counts.length === 1 ? 200 : 500 };
      },
    }),
  );
  assert.deepEqual(counts, [10000, 1]);
  assert.equal(Object.keys(state.pending).length, 1);
});

test('production emits only sitemap pages and key; preview removes both submissions and key', async () => {
  const directory = await mkdtemp(`${tmpdir()}/lowendaff-search-test-`);
  const old = process.env.PUBLIC_SITE_INDEXABLE;
  const root = pathToFileURL(directory + '/');
  const actualConfig = JSON.parse(
    await readFile(
      new URL('../src/config/search-engines.json', import.meta.url),
      'utf8',
    ),
  );
  try {
    await mkdir(new URL('components/', root));
    await writeFile(new URL('index.html', root), html('<h1>首页</h1>'));
    await writeFile(
      new URL('components/index.html', root),
      html('<h1>UI kit</h1>'),
    );
    await writeFile(
      new URL('sitemap.xml', root),
      `<urlset><url><loc>${home}</loc></url></urlset>`,
    );
    process.env.PUBLIC_SITE_INDEXABLE = 'true';
    await buildSearchIndex(root);
    const index = JSON.parse(
      await readFile(new URL('search-index.json', root), 'utf8'),
    );
    assert.deepEqual(Object.keys(index.entries), [home]);
    assert.equal(
      (
        await readFile(
          new URL(`${actualConfig.indexNow.key}.txt`, root),
          'utf8',
        )
      ).trim(),
      actualConfig.indexNow.key,
    );
    process.env.PUBLIC_SITE_INDEXABLE = 'false';
    await writeFile(new URL('sitemap.xml', root), '<urlset/>');
    await buildSearchIndex(root);
    assert.deepEqual(
      JSON.parse(await readFile(new URL('search-index.json', root), 'utf8'))
        .entries,
      {},
    );
    await assert.rejects(
      readFile(new URL(`${actualConfig.indexNow.key}.txt`, root)),
      { code: 'ENOENT' },
    );
  } finally {
    if (old === undefined) delete process.env.PUBLIC_SITE_INDEXABLE;
    else process.env.PUBLIC_SITE_INDEXABLE = old;
    await rm(directory, { recursive: true, force: true });
  }
});
