#!/usr/bin/python3
"""Artifact installation helper. HTTP and HMAC verification belong to adnanh/webhook."""

import fcntl
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request
import uuid
import zipfile
import xml.etree.ElementTree as ET

ROOT = Path('/opt/1panel/www/sites/lowendaff.com/.deploy')
REPOSITORY = 'Lowendaff/lowendaff.com'
MAX_ARCHIVE = 100 * 1024 * 1024
MAX_EXPANDED = 500 * 1024 * 1024


class DeployError(Exception):
    pass


def validate(payload, now=None):
    now = int(time.time()) if now is None else now
    if (payload.get('schema') != 1 or payload.get('repository') != REPOSITORY
            or payload.get('branch') != 'main'
            or payload.get('workflow') != '.github/workflows/content-validation.yml'):
        raise DeployError('unexpected source')
    for key in ('runId', 'runNumber', 'runAttempt', 'artifactId'):
        if not re.fullmatch(r'[1-9][0-9]{0,19}', str(payload.get(key, ''))):
            raise DeployError('invalid identifier')
    if not re.fullmatch(r'[a-f0-9]{40}', payload.get('commit', '')):
        raise DeployError('invalid commit')
    if not re.fullmatch(r'sha256:[a-f0-9]{64}', payload.get('digest', '')):
        raise DeployError('invalid digest')
    issued = payload.get('issuedAt')
    if type(issued) is not int or not -30 <= now - issued <= 300:
        raise DeployError('expired notification')
    url = urllib.parse.urlsplit(payload.get('archiveUrl', ''))
    host = url.hostname or ''
    if (url.scheme != 'https' or url.username or url.password or url.port
            or url.fragment or not url.query
            or not (host.endswith('.blob.core.windows.net')
                    or host.endswith('.actions.githubusercontent.com'))):
        raise DeployError('unexpected artifact host')
    return payload


def order(manifest):
    return int(manifest['runNumber']), int(manifest['runAttempt'])


def atomic_json(path, data):
    temporary = path.with_name(f'.{path.name}-{uuid.uuid4().hex}')
    try:
        temporary.write_text(json.dumps(data) + '\n')
        temporary.chmod(0o600)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def switch(root, target):
    temporary = root / f'.current-{uuid.uuid4().hex}'
    try:
        temporary.symlink_to(target)
        os.replace(temporary, root / 'current')
    finally:
        temporary.unlink(missing_ok=True)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def download(payload, destination):
    # Never forward an authorization token or follow arbitrary redirects.
    opener = urllib.request.build_opener(NoRedirect)
    digest = hashlib.sha256()
    total = 0
    with opener.open(payload['archiveUrl'], timeout=20) as response:
        if response.status != 200:
            raise DeployError('artifact download failed')
        with destination.open('xb') as output:
            while chunk := response.read(1024 * 1024):
                total += len(chunk)
                if total > MAX_ARCHIVE:
                    raise DeployError('artifact is too large')
                digest.update(chunk)
                output.write(chunk)
    if f'sha256:{digest.hexdigest()}' != payload['digest']:
        raise DeployError('artifact checksum mismatch')


def extract(archive, destination):
    with zipfile.ZipFile(archive) as package:
        entries = package.infolist()
        if len(entries) > 10000 or sum(i.file_size for i in entries) > MAX_EXPANDED:
            raise DeployError('expanded artifact is too large')
        seen = set()
        for entry in entries:
            name = entry.filename.rstrip('/')
            parts = name.split('/')
            kind = stat.S_IFMT(entry.external_attr >> 16)
            if (not name or name in seen or '\\' in name
                    or PurePosixPath(name).is_absolute()
                    or any(part in ('', '.', '..') or part.startswith('.') for part in parts)
                    or kind not in (0, stat.S_IFREG, stat.S_IFDIR)):
                raise DeployError('unsafe archive entry')
            seen.add(name)
        # Validate every name and file type before writing anything.
        for entry in entries:
            target = destination / entry.filename
            if entry.is_dir():
                target.mkdir(parents=True, exist_ok=True, mode=0o755)
            else:
                target.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
                with package.open(entry) as source, target.open('xb') as output:
                    shutil.copyfileobj(source, output)
                target.chmod(0o644)
        for directory, _, _ in os.walk(destination):
            Path(directory).chmod(0o755)


class PagePolicy(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.robots = []
        self.redirect = False
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'meta':
            if attrs.get('name', '').lower() == 'robots':
                self.robots.append(attrs.get('content', ''))
            if attrs.get('http-equiv', '').lower() == 'refresh':
                self.redirect = True


def verify_site(directory, payload):
    manifest = json.loads((directory / 'deployment.json').read_text())
    for key in ('schema', 'repository', 'commit', 'runId', 'runNumber', 'runAttempt'):
        if manifest.get(key) != payload[key]:
            raise DeployError('manifest does not match notification')
    # Fail closed unless CI and the server explicitly agree on publication policy.
    configured = os.environ.get('LOWENDAFF_SITE_INDEXABLE', 'false')
    if configured not in ('true', 'false'):
        raise DeployError('invalid server indexing policy')
    indexable = configured == 'true'
    if type(manifest.get('indexable')) is not bool or manifest['indexable'] != indexable:
        raise DeployError('indexing policy does not match server configuration')
    for name in ('index.html', 'tags/index.html', 'ads/index.html', 'robots.txt', 'rss.xml', 'sitemap.xml', 'llms.txt'):
        if not (directory / name).is_file():
            raise DeployError('incomplete static site')
    expected_urls = set()
    for page in directory.rglob('*.html'):
        relative = page.relative_to(directory).as_posix()
        policy = PagePolicy(page.read_text())
        if policy.redirect:
            continue
        expected = 'index,follow' if indexable else 'noindex,nofollow'
        if relative == 'components/index.html':
            expected = 'noindex,nofollow'
        if relative == 'tags/index.html' and policy.robots == ['noindex,nofollow']:
            expected = 'noindex,nofollow'  # Empty collections are not search landing pages.
        if policy.robots != [expected]:
            raise DeployError('page indexing policy mismatch')
        if expected == 'index,follow':
            path = '/' + relative.removesuffix('index.html')
            expected_urls.add('https://lowendaff.com' + path)
    sitemap = ET.fromstring((directory / 'sitemap.xml').read_text())
    namespace = '{http://www.sitemaps.org/schemas/sitemap/0.9}'
    if sitemap.tag != namespace + 'urlset':
        raise DeployError('invalid sitemap root')
    urls = [node.text for node in sitemap.findall(f'{namespace}url/{namespace}loc')]
    if len(urls) != len(set(urls)) or set(urls) != expected_urls:
        raise DeployError('sitemap does not match indexable pages')
    robots = (directory / 'robots.txt').read_text().splitlines()
    expected_robots = ['User-agent: *', 'Allow: /', 'Sitemap: https://lowendaff.com/sitemap.xml'] if indexable else ['User-agent: *', 'Disallow: /']
    if [line.strip() for line in robots if line.strip()] != expected_robots:
        raise DeployError('robots policy mismatch')
    if not (directory / '_astro').is_dir():
        raise DeployError('missing static assets')
    return manifest


def health(manifest):
    def get(path):
        result = subprocess.run([
            '/usr/bin/curl', '--fail', '--silent', '--show-error',
            '--max-time', '10', '--resolve', 'lowendaff.com:443:127.0.0.1',
            f'https://lowendaff.com{path}',
        ], capture_output=True, check=True, timeout=12)
        return result.stdout
    actual = json.loads(get('/deployment.json'))
    if actual != manifest:
        raise DeployError('served manifest mismatch')
    expected = 'index,follow' if manifest['indexable'] else 'noindex,nofollow'
    if PagePolicy(get('/').decode()).robots != [expected]:
        raise DeployError('served page mismatch')


def deploy(payload, root=ROOT, fetch=download, check=health):
    validate(payload)
    root.mkdir(parents=True, exist_ok=True)
    with (root / 'deploy.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        state_file = root / 'state.json'
        state = json.loads(state_file.read_text()) if state_file.exists() else {}
        watermark = tuple(state.get('watermark', (0, 0)))
        current = root / 'current'
        current_manifest = current / 'deployment.json'
        if current_manifest.exists():
            watermark = max(watermark, order(json.loads(current_manifest.read_text())))
        if order(payload) <= watermark:
            print('ignored_duplicate_or_old_run', payload['runId'], flush=True)
            return 'ignored'
        releases = root / 'releases'
        releases.mkdir(exist_ok=True)
        release = f"{payload['runId']}-{payload['runAttempt']}-{payload['commit'][:12]}"
        final = releases / release
        previous = os.readlink(current) if current.is_symlink() else None
        with tempfile.TemporaryDirectory(prefix='.incoming-', dir=root) as temporary:
            temporary = Path(temporary)
            archive = temporary / 'artifact.zip'
            site = temporary / 'site'
            site.mkdir()
            fetch(payload, archive)
            extract(archive, site)
            manifest = verify_site(site, payload)
            if final.exists():
                raise DeployError('release directory already exists')
            site.rename(final)
        target = f'releases/{release}'
        try:
            switch(root, target)
            check(manifest)
            atomic_json(state_file, {
                'watermark': list(order(payload)), 'current': target,
                'previous': previous, 'commit': payload['commit'],
                'runId': payload['runId'], 'artifactId': payload['artifactId'],
                'digest': payload['digest'],
            })
        except BaseException:
            if previous is not None:
                switch(root, previous)
            else:
                current.unlink(missing_ok=True)
            shutil.rmtree(final)
            raise
        print('deployed', payload['runId'], payload['commit'], flush=True)
        return 'deployed'


def rollback(target, root=ROOT, check=health):
    if not re.fullmatch(r'releases/[a-zA-Z0-9-]+', target):
        raise DeployError('invalid rollback target')
    with (root / 'deploy.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        directory = root / target
        if not directory.is_dir():
            raise DeployError('rollback release missing')
        previous = os.readlink(root / 'current')
        manifest = directory / 'deployment.json'
        try:
            switch(root, target)
            if manifest.exists():
                check(json.loads(manifest.read_text()))
        except BaseException:
            switch(root, previous)
            raise
        # Keep the successful-build watermark: delayed webhooks cannot undo a rollback.
        state_file = root / 'state.json'
        state = json.loads(state_file.read_text()) if state_file.exists() else {}
        state.update(current=target, previous=previous)
        atomic_json(state_file, state)
        print('rolled_back', target, flush=True)


if __name__ == '__main__':
    try:
        if len(sys.argv) == 3 and sys.argv[1] == '--rollback':
            rollback(sys.argv[2])
        else:
            path = Path(os.environ['DEPLOY_PAYLOAD'])
            if path.stat().st_size > 32768:
                raise DeployError('payload is too large')
            deploy(json.loads(path.read_text()))
    except Exception as error:
        # Request bodies contain expiring credentials; never log their contents or URLs.
        print(f'deployment_failed: {type(error).__name__}', file=sys.stderr)
        sys.exit(1)
