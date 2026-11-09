import { createHash } from 'node:crypto';

export const hash = (text) => createHash('sha256').update(text).digest('hex');
const fail = (message) => {
  throw new Error(message);
};
const object = (value) =>
  value && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) =>
  object(value) && Object.keys(value).sort().join() === [...keys].sort().join();

export function validateConfig(value) {
  if (
    !exact(value, ['site', 'indexNow']) ||
    value.site !== 'https://lowendaff.com' ||
    !exact(value.indexNow, ['enabled', 'key', 'endpoint']) ||
    typeof value.indexNow.enabled !== 'boolean' ||
    !/^[a-f0-9]{32}$/.test(value.indexNow.key) ||
    value.indexNow.endpoint !== 'https://api.indexnow.org/indexnow'
  )
    fail('Invalid search-engines.json configuration');
  return value;
}

export function validPage(url, site) {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.origin === site &&
      !parsed.username &&
      !parsed.password &&
      !parsed.search &&
      !parsed.hash &&
      parsed.href === url &&
      // Keep former ASCII article URLs valid for deletion notifications after migration.
      /^\/(?:ads\/|tags\/|map\/|reviews\/[a-z0-9\p{Script=Han}]+(?:-[a-z0-9\p{Script=Han}]+)*\/)?$/u.test(
        decodeURIComponent(parsed.pathname),
      ) &&
      encodeURI(decodeURIComponent(parsed.pathname)) === parsed.pathname
    );
  } catch {
    return false;
  }
}

export function validateEntries(entries, site) {
  if (
    !object(entries) ||
    Object.keys(entries).length > 100000 ||
    Object.entries(entries).some(
      ([url, digest]) =>
        !validPage(url, site) ||
        typeof digest !== 'string' ||
        !/^[a-f0-9]{64}$/.test(digest),
    )
  )
    fail('Invalid search index entries');
  return entries;
}

export function validateIndex(value, site) {
  if (
    !exact(value, ['schema', 'site', 'indexable', 'entries']) ||
    value.schema !== 1 ||
    value.site !== site ||
    typeof value.indexable !== 'boolean'
  )
    fail('Invalid search index manifest');
  validateEntries(value.entries, site);
  if (!value.indexable && Object.keys(value.entries).length)
    fail('Preview contains search entries');
  return value;
}

export function validateState(value, site) {
  if (
    !exact(value, [
      'schema',
      'site',
      'observed',
      'pending',
      'commit',
      'responses',
    ]) ||
    value.schema !== 1 ||
    value.site !== site ||
    !/^[a-f0-9]{40}$/.test(value.commit) ||
    !object(value.pending) ||
    !Array.isArray(value.responses)
  )
    fail('Invalid IndexNow state');
  validateEntries(value.observed, site);
  if (
    Object.entries(value.pending).some(
      ([url, digest]) =>
        !validPage(url, site) ||
        (digest !== null &&
          (typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest))),
    )
  )
    fail('Invalid pending IndexNow URLs');
  return value;
}

/** Pending URLs survive failed requests; a newer version supersedes older content. */
export function planState(previous, current, commit) {
  const observed = previous?.observed ?? {};
  const pending = { ...previous?.pending };
  for (const url of new Set([
    ...Object.keys(observed),
    ...Object.keys(current),
  ])) {
    if (observed[url] !== current[url]) pending[url] = current[url] ?? null;
  }
  for (const url of Object.keys(pending)) pending[url] = current[url] ?? null;
  return {
    schema: 1,
    site: 'https://lowendaff.com',
    observed: current,
    pending,
    commit,
    responses: [],
  };
}

export function assertDeployment(actual, expected) {
  if (
    actual.schema !== 1 ||
    actual.repository !== 'Lowendaff/lowendaff.com' ||
    actual.indexable !== true ||
    !/^[1-9][0-9]*$/.test(String(actual.runId)) ||
    !/^[1-9][0-9]*$/.test(String(actual.runAttempt)) ||
    !/^[a-f0-9]{40}$/.test(actual.commit) ||
    !/^[a-f0-9]{64}$/.test(actual.searchIndexSha256) ||
    ['commit', 'runId', 'runAttempt'].some(
      (key) => String(actual[key]) !== String(expected[key]),
    )
  )
    fail('Public deployment does not match the expected indexable release');
}

/** Only 200/202 acknowledge URLs. 202 still awaits key validation by the engine. */
export async function submitPending(
  state,
  config,
  { fetcher = fetch, persist, assertLive },
) {
  const urls = Object.keys(state.pending).sort();
  for (let offset = 0; offset < urls.length; offset += 10000) {
    const batch = urls.slice(offset, offset + 10000);
    await assertLive();
    const response = await fetcher(config.indexNow.endpoint, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: new URL(config.site).host,
        key: config.indexNow.key,
        keyLocation: `${config.site}/${config.indexNow.key}.txt`,
        urlList: batch,
      }),
    });
    state.responses.push({ status: response.status, count: batch.length });
    if (![200, 202].includes(response.status)) {
      await persist(state);
      fail(`IndexNow returned HTTP ${response.status}; pending URLs retained`);
    }
    for (const url of batch) delete state.pending[url];
    await persist(state);
  }
  return state;
}
