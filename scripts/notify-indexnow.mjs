import {
  readFile,
  writeFile,
  mkdir,
  appendFile,
  mkdtemp,
  rm,
} from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  hash,
  validateConfig,
  validateIndex,
  validateState,
  planState,
  assertDeployment,
  submitPending,
} from './indexnow-core.mjs';

const repo = 'Lowendaff/lowendaff.com';
const config = validateConfig(
  JSON.parse(
    await readFile(
      new URL('../src/config/search-engines.json', import.meta.url),
      'utf8',
    ),
  ),
);
const directory = 'test-results/indexnow';
await mkdir(directory, { recursive: true });
const snapshotFile = `${directory}/before.json`;
const stateFile = `${directory}/state.json`;
const summary = async (text) => {
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(process.env.GITHUB_STEP_SUMMARY, text + '\n');
};

async function publicGet(resource, allowMissing = false) {
  const url = new URL(resource, config.site);
  url.searchParams.set('release-check', `${Date.now()}`);
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (allowMissing && response.status === 404) return null;
  if (response.status !== 200)
    throw new Error(`Public release check returned HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > 20 * 1024 * 1024)
    throw new Error('Public release metadata is too large');
  return text;
}

async function api(resource) {
  if (!process.env.GITHUB_TOKEN)
    throw new Error('Missing GitHub Actions token');
  const response = await fetch(
    `https://api.github.com/repos/${repo}/${resource}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(20000),
      redirect: 'error',
    },
  );
  if (!response.ok)
    throw new Error(`GitHub state lookup returned HTTP ${response.status}`);
  return response.json();
}

/** Only restore artifacts produced by the trusted main deployment workflow. */
async function previousState() {
  for (let page = 1; page <= 10; page++) {
    const result = await api(
      `actions/artifacts?name=indexnow-state&per_page=100&page=${page}`,
    );
    for (const artifact of result.artifacts) {
      if (artifact.expired || artifact.size_in_bytes > 20 * 1024 * 1024)
        continue;
      const run = await api(`actions/runs/${artifact.workflow_run.id}`);
      if (
        run.head_repository?.full_name !== repo ||
        run.head_branch !== 'main' ||
        run.path !== '.github/workflows/deploy.yml' ||
        !['workflow_run', 'workflow_dispatch'].includes(run.event)
      )
        continue;
      const response = await fetch(
        `https://api.github.com/repos/${repo}/actions/artifacts/${artifact.id}/zip`,
        {
          headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
          redirect: 'manual',
          signal: AbortSignal.timeout(20000),
        },
      );
      if (response.status !== 302)
        throw new Error('State artifact download redirect missing');
      const location = new URL(response.headers.get('location'));
      if (
        location.protocol !== 'https:' ||
        location.username ||
        location.password ||
        !['.blob.core.windows.net', '.actions.githubusercontent.com'].some(
          (suffix) => location.hostname.endsWith(suffix),
        )
      )
        throw new Error('Unexpected state artifact host');
      // No token is forwarded to the signed artifact URL; never print that URL.
      const download = await fetch(location, {
        redirect: 'error',
        signal: AbortSignal.timeout(20000),
      });
      if (!download.ok) throw new Error('State artifact download failed');
      const bytes = Buffer.from(await download.arrayBuffer());
      if (
        bytes.length > 20 * 1024 * 1024 ||
        artifact.digest !== `sha256:${hash(bytes)}`
      )
        throw new Error('State artifact checksum mismatch');
      const temporary = await mkdtemp(
        path.join(tmpdir(), 'lowendaff-indexnow-'),
      );
      try {
        const file = path.join(temporary, 'state.zip');
        await writeFile(file, bytes);
        const text = execFileSync('unzip', ['-p', file, 'state.json'], {
          encoding: 'utf8',
          maxBuffer: 20 * 1024 * 1024,
        });
        return validateState(JSON.parse(text), config.site);
      } finally {
        await rm(temporary, { recursive: true, force: true });
      }
    }
    if (result.artifacts.length < 100) return null;
  }
  throw new Error(
    'Too many state artifacts; refusing an incomplete state lookup',
  );
}

async function snapshot() {
  const before = JSON.parse(await publicGet('/deployment.json'));
  const text = await publicGet('/search-index.json', true);
  const after = JSON.parse(await publicGet('/deployment.json'));
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw new Error('Deployment changed during snapshot');
  if (text !== null) {
    if (hash(text) !== before.searchIndexSha256)
      throw new Error('Previous search index checksum mismatch');
    validateIndex(JSON.parse(text), config.site);
  }
  await writeFile(
    snapshotFile,
    JSON.stringify(text === null ? null : JSON.parse(text)) + '\n',
  );
  await summary('Captured the previous public search index.');
}

async function notify() {
  if (!config.indexNow.enabled) {
    await summary('IndexNow is disabled in JSON configuration.');
    return;
  }
  const event = JSON.parse(
    await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'),
  );
  const actual = JSON.parse(await publicGet('/deployment.json'));
  let expected;
  if (process.env.GITHUB_EVENT_NAME === 'workflow_run') {
    expected = {
      commit: event.workflow_run.head_sha,
      runId: String(event.workflow_run.id),
      runAttempt: String(event.workflow_run.run_attempt),
    };
  } else if (
    process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' &&
    process.env.GITHUB_REF === 'refs/heads/main'
  ) {
    expected = {
      commit: process.env.GITHUB_SHA,
      runId: actual.runId,
      runAttempt: actual.runAttempt,
    };
  } else
    throw new Error(
      'IndexNow only runs for a trusted production deployment or manual main retry',
    );
  const assertLive = async () =>
    assertDeployment(JSON.parse(await publicGet('/deployment.json')), expected);
  assertDeployment(actual, expected);
  const text = await publicGet('/search-index.json');
  if (hash(text) !== actual.searchIndexSha256)
    throw new Error('Search index does not belong to this release');
  const current = validateIndex(JSON.parse(text), config.site);
  if (!current.indexable) throw new Error('Cannot submit a preview build');
  if (
    (await publicGet(`/${config.indexNow.key}.txt`)).trim() !==
    config.indexNow.key
  )
    throw new Error('Public IndexNow ownership file mismatch');
  await assertLive();
  let previous = await previousState();
  if (!previous) {
    // First adoption or expired artifacts: retain deletion detection against the live pre-deploy snapshot.
    let before = null;
    try {
      before = JSON.parse(await readFile(snapshotFile, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (before) validateIndex(before, config.site);
    previous = { observed: before?.entries ?? {}, pending: {} };
    await summary(
      'No retained notification state: using the pre-deployment snapshot, or submitting current pages on first adoption.',
    );
  }
  const state = planState(previous, current.entries, actual.commit);
  const persist = (value) =>
    writeFile(stateFile, JSON.stringify(value, null, 2) + '\n');
  await persist(state); // Persist the queue before making any submission.
  const count = Object.keys(state.pending).length;
  await submitPending(state, config, { persist, assertLive });
  await summary(
    `IndexNow: ${count} changed/pending URLs submitted; ${Object.keys(state.pending).length} pending. Responses: ${JSON.stringify(state.responses)}. HTTP 202 means key validation is pending; neither 200 nor 202 guarantees indexing.`,
  );
}

try {
  if (process.argv.includes('--snapshot')) await snapshot();
  else await notify();
} catch (error) {
  // Error messages from requests may contain signed URLs; expose only our controlled errors.
  const message =
    error instanceof TypeError
      ? 'Network or response validation failed'
      : error.message;
  await summary(
    `IndexNow did not complete: ${message}. The deployed site is unchanged; retry this notification workflow.`,
  );
  process.exitCode = 1;
}
