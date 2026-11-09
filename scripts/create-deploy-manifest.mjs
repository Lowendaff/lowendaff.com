import { readFile, writeFile } from 'node:fs/promises';
import { hash } from './indexnow-core.mjs';

const required = (name, pattern) => {
  const value = process.env[name] || '';
  if (!pattern.test(value)) throw new Error(`Invalid ${name}`);
  return value;
};
const manifest = {
  schema: 1,
  repository: required('GITHUB_REPOSITORY', /^Lowendaff\/lowendaff\.com$/),
  commit: required('GITHUB_SHA', /^[a-f0-9]{40}$/),
  runId: required('GITHUB_RUN_ID', /^\d+$/),
  runNumber: required('GITHUB_RUN_NUMBER', /^\d+$/),
  runAttempt: required('GITHUB_RUN_ATTEMPT', /^\d+$/),
  indexable: process.env.PUBLIC_SITE_INDEXABLE === 'true',
  searchIndexSha256: hash(await readFile('dist/search-index.json')),
};
await writeFile('dist/deployment.json', JSON.stringify(manifest) + '\n');
