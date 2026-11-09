import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import stat
import tempfile
import time
import unittest
from unittest.mock import patch
import zipfile

spec = importlib.util.spec_from_file_location('deploy', Path(__file__).parents[2] / 'deploy/deploy.py')
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)


def payload(number=10):
    return {
        'schema': 1, 'repository': 'Lowendaff/lowendaff.com', 'branch': 'main',
        'workflow': '.github/workflows/content-validation.yml', 'commit': 'a' * 40,
        'runId': str(number + 100), 'runNumber': str(number), 'runAttempt': '1',
        'artifactId': '200', 'digest': 'sha256:' + 'b' * 64,
        'archiveUrl': 'https://example.blob.core.windows.net/artifact?sig=example',
        'issuedAt': int(time.time()),
    }


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name) / 'state'
        (self.root / 'releases/bootstrap').mkdir(parents=True)
        (self.root / 'current').symlink_to('releases/bootstrap')

    def fixture(self, data):
        archive = Path(self.temporary.name) / f"{data['runId']}.zip"
        manifest = {k: data[k] for k in (
            'schema', 'repository', 'commit', 'runId', 'runNumber', 'runAttempt')}
        manifest['indexable'] = False
        with zipfile.ZipFile(archive, 'w') as output:
            output.writestr('deployment.json', json.dumps(manifest))
            output.writestr('index.html', '<meta name="robots" content="noindex,nofollow">')
            for name in ('tags/index.html', 'ads/index.html', 'robots.txt', 'rss.xml', '_astro/site.css'):
                output.writestr(name, 'fixture')
        data['digest'] = 'sha256:' + hashlib.sha256(archive.read_bytes()).hexdigest()
        return lambda _, target: shutil.copyfile(archive, target)

    def test_rejects_wrong_source_expired_notification_and_download_host(self):
        for key, value in (
            ('branch', 'feature'), ('repository', 'someone/else'),
            ('workflow', 'unexpected.yml'), ('commit', '../../x'),
            ('issuedAt', 0), ('issuedAt', int(time.time()) + 100),
            ('archiveUrl', 'https://evil.example/file?sig=x'),
            ('archiveUrl', 'http://example.blob.core.windows.net/file?sig=x'),
            ('archiveUrl', 'https://example.blob.core.windows.net.evil.example/file?sig=x'),
            ('archiveUrl', 'https://user@example.blob.core.windows.net/file?sig=x'),
        ):
            with self.subTest(key=key, value=value):
                data = payload()
                data[key] = value
                with self.assertRaises(deploy.DeployError):
                    deploy.validate(data)

    def test_rejects_traversal_symlink_and_duplicate_archive_entries(self):
        for filename, kind in (('../escape', 0), ('/absolute', 0),
                               ('dir/../../escape', 0), ('a\\b', 0),
                               ('.env', 0), ('link', stat.S_IFLNK)):
            with self.subTest(filename=filename):
                archive = Path(self.temporary.name) / 'bad.zip'
                with zipfile.ZipFile(archive, 'w') as output:
                    info = zipfile.ZipInfo(filename)
                    info.external_attr = (kind | 0o777) << 16
                    output.writestr(info, 'target')
                with self.assertRaises(deploy.DeployError):
                    deploy.extract(archive, self.root / 'unpack')
                self.assertFalse((self.root / 'unpack').exists())
        archive = Path(self.temporary.name) / 'duplicates.zip'
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter('ignore')
            with zipfile.ZipFile(archive, 'w') as output:
                output.writestr('same', 'a')
                output.writestr('same', 'b')
        with self.assertRaises(deploy.DeployError):
            deploy.extract(archive, self.root / 'unpack')

    def test_deploy_duplicate_old_run_and_rollback_keep_watermark(self):
        data = payload()
        fetch = self.fixture(data)
        self.assertEqual(deploy.deploy(data, self.root, fetch, lambda _: None), 'deployed')
        active = (self.root / 'current').readlink().as_posix()
        def must_not_fetch(*_):
            self.fail('Duplicate/old runs must not download anything')
        self.assertEqual(deploy.deploy(data, self.root, must_not_fetch), 'ignored')
        self.assertEqual(deploy.deploy(payload(9), self.root, must_not_fetch), 'ignored')
        deploy.rollback('releases/bootstrap', self.root)
        self.assertEqual((self.root / 'current').readlink().as_posix(), 'releases/bootstrap')
        self.assertEqual(deploy.deploy(data, self.root, must_not_fetch), 'ignored')
        deploy.rollback(active, self.root, lambda _: None)
        self.assertEqual((self.root / 'current').readlink().as_posix(), active)

    def test_health_failure_restores_previous_release_and_allows_retry(self):
        data = payload()
        fetch = self.fixture(data)
        def fail(_):
            raise deploy.DeployError('health failed')
        with self.assertRaises(deploy.DeployError):
            deploy.deploy(data, self.root, fetch, fail)
        self.assertEqual((self.root / 'current').readlink().as_posix(), 'releases/bootstrap')
        self.assertFalse((self.root / 'state.json').exists())
        self.assertEqual(deploy.deploy(data, self.root, fetch, lambda _: None), 'deployed')

    def test_manifest_mismatch_never_switches(self):
        data = payload()
        fetch = self.fixture(data)
        data['commit'] = 'c' * 40
        with self.assertRaises(deploy.DeployError):
            deploy.deploy(data, self.root, fetch, lambda _: None)
        self.assertEqual((self.root / 'current').readlink().as_posix(), 'releases/bootstrap')

    def test_checksum_mismatch_is_rejected(self):
        import io
        class Response(io.BytesIO):
            status = 200
        with patch.object(deploy.urllib.request, 'build_opener') as opener:
            opener.return_value.open.return_value = Response(b'tampered')
            with self.assertRaises(deploy.DeployError):
                deploy.download(payload(), self.root / 'download.zip')

    def test_archive_expansion_limit(self):
        data = payload()
        self.fixture(data)
        with patch.object(deploy, 'MAX_EXPANDED', 1):
            with self.assertRaises(deploy.DeployError):
                deploy.extract(Path(self.temporary.name) / '110.zip', self.root / 'unpack')


if __name__ == '__main__':
    unittest.main()
