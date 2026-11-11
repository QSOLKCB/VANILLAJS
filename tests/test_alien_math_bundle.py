# SPDX-License-Identifier: Apache-2.0
import hashlib
import gzip
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('bundle', Path(__file__).resolve().parents[1] / 'scripts/alien_math_bundle.py')
bundle = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(bundle)


class CapsuleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temp.name)
        def git(*args):
            return subprocess.check_output(['git', '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', *args], cwd=cls.root, stderr=subprocess.DEVNULL).decode().strip()
        cls.git = staticmethod(git)
        git('init', '-q')
        (cls.root / 'LICENSE').write_text('test-only license fixture\n')
        (cls.root / 'modules/kernel').mkdir(parents=True)
        (cls.root / 'modules/kernel/index.js').write_text('export const n=1;\n')
        git('add', '.'); git('commit', '-qm', 'fixture baseline')
        cls.base = git('rev-parse', 'HEAD')
        (cls.root / Path(bundle.FORMAL).parent).mkdir(parents=True)
        formal = {'baseline': cls.base, 'files': {'modules/kernel/index.js': bundle.sha((cls.root / 'modules/kernel/index.js').read_bytes())}}
        (cls.root / bundle.FORMAL).write_bytes(bundle.canonical(formal))
        git('add', '.'); git('commit', '-qm', 'fixture source')
        cls.revision = git('rev-parse', 'HEAD')
        cls.settings = patch.multiple(bundle, BASE=cls.base, EXTRA=('LICENSE',))
        cls.settings.start()
        cls.payload = bundle.payload_for(cls.root, cls.revision)

    @classmethod
    def tearDownClass(cls):
        cls.settings.stop(); cls.temp.cleanup()

    def setUp(self):
        self.work = tempfile.TemporaryDirectory()
        self.addCleanup(self.work.cleanup)
        self.path = Path(self.work.name) / 'capsule.tar.gz'

    def write(self, payload=None, revision=None):
        bundle.write_archive(self.payload if payload is None else payload, revision or self.revision, self.path)

    def test_identical_inputs_byte_identical_archives(self):
        self.write()
        other = self.path.with_name('second.tar.gz')
        bundle.write_archive(self.payload, self.revision, other)
        self.assertEqual(self.path.read_bytes(), other.read_bytes())
        self.assertEqual(bundle.check(self.path, self.revision), self.payload)

    def test_changed_source_with_rehashed_inventory_cannot_impersonate_git(self):
        changed = dict(self.payload)
        changed['source/modules/kernel/index.js'] = b'export const n=2;\n'
        self.write(changed)
        with self.assertRaisesRegex(ValueError, 'source differs from Git'):
            bundle.check(self.path, self.revision)

    def test_wrong_external_revision_rejected(self):
        self.write()
        with self.assertRaisesRegex(ValueError, 'identity mismatch'):
            bundle.check(self.path, self.base)

    def test_forged_git_object_rejected_despite_rehashed_inventory(self):
        changed = dict(self.payload)
        key = next(p for p in changed if p.startswith('provenance/'))
        changed[key] += b'x'
        self.write(changed)
        with self.assertRaisesRegex(ValueError, 'Git object identity'):
            bundle.check(self.path, self.revision)

    def test_missing_source_and_missing_object_rejected(self):
        for key in ['source/LICENSE', 'provenance/objects/' + self.base]:
            with self.subTest(key=key):
                changed = dict(self.payload); del changed[key]
                self.write(changed)
                with self.assertRaises(ValueError): bundle.check(self.path, self.revision)
                self.path.unlink()

    def test_extra_source_or_evidence_rejected(self):
        for key in ['source/evidence/private.txt', 'evidence/forged.json']:
            with self.subTest(key=key):
                changed = dict(self.payload); changed[key] = b'not in scope'
                self.write(changed)
                with self.assertRaises(ValueError): bundle.check(self.path, self.revision)
                self.path.unlink()

    def malicious_tar(self, entries):
        with tarfile.open(self.path, 'w:gz') as archive:
            for name, kind, raw in entries:
                entry = tarfile.TarInfo(name); entry.type = kind; entry.size = len(raw)
                if kind == tarfile.SYMTYPE: entry.linkname = '/tmp/forged'
                archive.addfile(entry, io.BytesIO(raw))

    def test_unsafe_paths_symlinks_duplicate_members(self):
        cases = [('../escape', tarfile.REGTYPE), ('/absolute', tarfile.REGTYPE),
                 ('source/.git/config', tarfile.REGTYPE), ('source/linked', tarfile.SYMTYPE)]
        for name, kind in cases:
            with self.subTest(name=name):
                self.malicious_tar([(name, kind, b'')])
                with self.assertRaises(ValueError): bundle.check(self.path, self.revision)
        self.malicious_tar([('same', tarfile.REGTYPE, b''), ('same', tarfile.REGTYPE, b'')])
        with self.assertRaisesRegex(ValueError, 'duplicate'): bundle.check(self.path, self.revision)

    def test_corrupted_checksums_rejected(self):
        self.write()
        with tarfile.open(self.path) as archive:
            entries = [(e.name, e.type, archive.extractfile(e).read()) for e in archive]
        entries = [(n, t, b'bad' if n == 'SHA256SUMS' else raw) for n, t, raw in entries]
        self.malicious_tar(entries)
        with self.assertRaisesRegex(ValueError, 'SHA256SUMS'): bundle.check(self.path, self.revision)

    def test_hidden_members_after_tar_end_rejected(self):
        self.write()
        raw = gzip.decompress(self.path.read_bytes())
        self.path.write_bytes(gzip.compress(raw + b'hidden unlisted content'))
        with self.assertRaisesRegex(ValueError, 'hidden members'): bundle.check(self.path, self.revision)

    def test_bounds_reject_before_extraction(self):
        self.write()
        with patch.object(bundle, 'MAX_FILE', 1):
            with self.assertRaisesRegex(ValueError, 'oversized'): bundle.check(self.path, self.revision)
        with patch.object(bundle, 'MAX_MEMBERS', 1):
            with self.assertRaisesRegex(ValueError, 'excess'): bundle.check(self.path, self.revision)

    def test_extract_to_new_directory_supports_original_git_show_offline(self):
        self.write()
        dest = Path(self.work.name) / 'extracted'
        root = bundle.extract(self.path, self.revision, dest)
        self.assertEqual(subprocess.check_output(['git', 'show', self.base + ':modules/kernel/index.js'], cwd=root), b'export const n=1;\n')
        self.assertEqual(subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root).decode().strip(), self.revision)
        with self.assertRaises(FileExistsError): bundle.extract(self.path, self.revision, dest)

    def test_existing_symlink_destination_rejected(self):
        self.write()
        dest = Path(self.work.name) / 'linked'; dest.symlink_to(self.root, target_is_directory=True)
        with self.assertRaises(FileExistsError): bundle.extract(self.path, self.revision, dest)

    def test_uncommitted_work_is_not_a_source(self):
        target = self.root / 'LICENSE'; original = target.read_bytes()
        try:
            target.write_bytes(b'local-only bytes')
            self.assertEqual(bundle.payload_for(self.root, self.revision), self.payload)
        finally: target.write_bytes(original)


if __name__ == '__main__':
    unittest.main()
