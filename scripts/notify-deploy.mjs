import { readFile } from 'node:fs/promises';
import { createHmac } from 'node:crypto';

const repo = 'Lowendaff/lowendaff.com';
const endpoint = 'https://lowendaff.com/hooks/deploy-site';
const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
const token = process.env.GITHUB_TOKEN;
const secret = process.env.DEPLOY_WEBHOOK_SECRET;
if (!token || !secret) throw new Error('Missing deployment credentials');

async function api(path, redirect = 'follow') {
  const response = await fetch(`https://api.github.com/repos/${repo}/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    redirect,
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok && response.status !== 302)
    throw new Error(`GitHub API returned ${response.status}`);
  return response;
}

const id = String(event.workflow_run?.id || '');
if (!/^\d+$/.test(id)) throw new Error('Invalid workflow run');
const run = await (await api(`actions/runs/${id}`)).json();
if (
  run.status !== 'completed' ||
  run.conclusion !== 'success' ||
  run.head_branch !== 'main' ||
  run.head_repository?.full_name !== repo ||
  run.path !== '.github/workflows/content-validation.yml' ||
  !['push', 'workflow_dispatch'].includes(run.event)
)
  throw new Error('Run is not eligible for deployment');
const head = await (await api('git/ref/heads/main')).json();
if (head.object.sha !== run.head_sha) {
  console.log('Skipped: main has advanced beyond this build');
  process.exit(0);
}
const artifacts = await (await api(`actions/runs/${id}/artifacts`)).json();
const matches = artifacts.artifacts.filter(
  (artifact) =>
    artifact.name === `site-dist-${run.head_sha}-${run.run_attempt}` &&
    !artifact.expired,
);
if (matches.length !== 1 || !/^sha256:[a-f0-9]{64}$/.test(matches[0].digest))
  throw new Error('Expected exactly one artifact with a SHA-256 digest');
const artifact = matches[0];

// A new signed URL is obtained for each retry; it is never printed or persisted.
for (let attempt = 1; attempt <= 3; attempt++) {
  const download = await api(`actions/artifacts/${artifact.id}/zip`, 'manual');
  if (download.status !== 302) throw new Error('Expected artifact redirect');
  const archiveUrl = download.headers.get('location');
  if (!archiveUrl?.startsWith('https://'))
    throw new Error('Missing HTTPS download URL');
  const payload = JSON.stringify({
    schema: 1,
    repository: repo,
    branch: 'main',
    workflow: '.github/workflows/content-validation.yml',
    commit: run.head_sha,
    runId: String(run.id),
    runNumber: String(run.run_number),
    runAttempt: String(run.run_attempt),
    artifactId: String(artifact.id),
    digest: artifact.digest,
    archiveUrl,
    issuedAt: Math.floor(Date.now() / 1000),
  });
  const signature = createHmac('sha256', secret).update(payload).digest('hex');
  let status = 'network error';
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      redirect: 'error',
      headers: {
        'Content-Type': 'application/json',
        'X-Lowendaff-Event': 'artifact-ready',
        'X-Hub-Signature-256': `sha256=${signature}`,
      },
      body: payload,
      signal: AbortSignal.timeout(90000),
    });
    status = response.status;
    if (response.ok) {
      console.log(
        `Deployment acknowledged for run ${id}, commit ${run.head_sha}`,
      );
      process.exit(0);
    }
    if (response.status < 500) throw new Error('Webhook rejected notification');
  } catch {
    // Do not expose request URLs, payloads or credentials in Actions logs.
  }
  console.log(`Attempt ${attempt}: ${status}`);
  if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 5000));
}
throw new Error('Deployment was not acknowledged');
