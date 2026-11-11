#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Deterministic, scoped research capsule with original Git object witnesses.

Hashes establish integrity and binding to a caller-supplied commit, not review,
proof, or authorship. Only reproduce executes code; check/extract never do.
"""
import argparse
import gzip
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tarfile
import zlib

ROOT = Path(__file__).resolve().parents[1]
BASE = 'ce7e38eb3c7412407a3ba2bc472120b589e6eb9e'
FORMAL = 'formal/alien-math-006/manifest.json'
SCHEMA = 'qsol.alien-math-final.capsule.v1'
PUBLIC = ('modules/', 'demos/', 'api/', 'offline/')
EXTRA = (
    'LICENSE', 'NOTICE', 'AGENTS.md', 'README.md', 'ROADMAP.md', 'MODULES.json',
    'package.json', 'index.html', 'experiments/arch-omi/index.js',
    'experiments/e8-geometry/index.js', 'scripts/build.js',
    'scripts/service-worker.template.js', 'scripts/verify-offline.js',
    'scripts/alien_math_bundle.py', 'tests/test_alien_math_bundle.py',
    'tests/alien-math-final.test.js', 'docs/ALIEN_MATH_FINAL.md',
    'research/alien-math-final/release-notes.draft.md',
    'research/alien-math-final/zenodo.draft.json',
    'research/alien-math-final/audit.json',
    'scripts/browser-suite-cache.mjs', 'scripts/browser-dependencies.mjs',
    'scripts/browser-receipt-authority.mjs', 'tests/browser-suite-cache.test.js',
    'scripts/ci-invariant-workload.mjs', 'scripts/ci_invariant_oracle.py',
    'tests/fixtures/ci-invariant-001-input.json',
    'tests/fixtures/ci-invariant-001-expected.json',
    'tests/fixtures/ci-invariant-001-baseline.mjs',
    'scripts/browser-machine.js', 'scripts/alien-math-browser-regression.mjs',
)
MAX_BYTES = 64 * 1024 * 1024
MAX_FILE = 8 * 1024 * 1024
MAX_MEMBERS = 4096


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def canonical(value):
    return (json.dumps(value, indent=2, sort_keys=True) + '\n').encode()


def need(condition, message):
    if not condition:
        raise ValueError(message)


def safe(path):
    need(isinstance(path, str) and bool(re.fullmatch(r'[a-zA-Z0-9_. /-]+', path)), 'unsafe path')
    parts = PurePosixPath(path).parts
    need(path and not path.startswith('/') and all(p not in ('', '.', '..', '.git') for p in parts)
         and '/'.join(parts) == path and not path.endswith('/'), 'unsafe path: ' + path)
    return path


def command(args, cwd=ROOT):
    return subprocess.run(list(map(str, args)), cwd=cwd, check=True, capture_output=True).stdout


def object_body(raw, oid):
    need(hashlib.sha1(raw).hexdigest() == oid, 'Git object identity mismatch')
    head, body = raw.split(b'\0', 1)
    kind, length = head.split(b' ', 1)
    need(kind in (b'blob', b'tree', b'commit') and length == str(len(body)).encode(), 'invalid Git object header')
    return kind, body


def tree_entries(body):
    result = {}
    while body:
        header, body = body.split(b'\0', 1)
        mode, name = header.split(b' ', 1)
        name = name.decode('utf-8')
        need(name not in result and '/' not in name and name not in ('.', '..', '.git'), 'invalid tree entry')
        need(len(body) >= 20, 'truncated tree')
        result[name] = (mode.decode(), body[:20].hex())
        body = body[20:]
    return result


class Objects:
    def __init__(self, root=None, payload=None):
        self.root, self.payload, self.used = root, payload or {}, set()

    def get(self, oid, kind=None):
        need(bool(re.fullmatch('[0-9a-f]{40}', oid)), 'invalid Git OID')
        path = 'provenance/objects/' + oid
        if path not in self.payload and self.root is not None:
            actual = command(['git', 'cat-file', '-t', oid], self.root).strip()
            body = command(['git', 'cat-file', actual.decode(), oid], self.root)
            self.payload[path] = actual + b' ' + str(len(body)).encode() + b'\0' + body
        need(path in self.payload, 'missing Git witness: ' + oid)
        actual, body = object_body(self.payload[path], oid)
        need(kind is None or actual == kind, 'wrong Git object type')
        self.used.add(path)
        return body

    def tree(self, revision):
        body = self.get(revision, b'commit')
        first = body.split(b'\n', 1)[0]
        need(re.fullmatch(b'tree [0-9a-f]{40}', first) is not None, 'invalid commit tree')
        return first[5:].decode()

    def lookup(self, revision, path):
        oid = self.tree(revision)
        parts = safe(path).split('/')
        for i, part in enumerate(parts):
            entries = tree_entries(self.get(oid, b'tree'))
            if part not in entries:
                return None
            mode, oid = entries[part]
            if i == len(parts) - 1:
                need(mode in ('100644', '100755'), 'nonregular source: ' + path)
                return self.get(oid, b'blob')
            need(mode == '40000', 'non-directory source parent')
        raise ValueError('empty path')

    def public_paths(self, revision):
        result = []
        def walk(oid, prefix):
            for name, (mode, child) in tree_entries(self.get(oid, b'tree')).items():
                path = prefix + name
                if mode == '40000':
                    if any(p.startswith(path + '/') or (path + '/').startswith(p) for p in PUBLIC):
                        walk(child, path + '/')
                elif any(path.startswith(p) for p in PUBLIC):
                    need(mode in ('100644', '100755'), 'nonregular public file')
                    result.append(safe(path))
        walk(self.tree(revision), '')
        return result


def scope(objects, revision):
    formal = objects.lookup(revision, FORMAL)
    need(formal is not None, 'missing formal source manifest')
    manifest = json.loads(formal)
    need(manifest['baseline'] == BASE, 'formal baseline mismatch')
    paths = sorted(set(EXTRA) | set(manifest['files']) | {FORMAL} | set(objects.public_paths(revision)))
    for path in paths:
        safe(path)
    return paths


def payload_for(root, revision):
    objects = Objects(root=root)
    paths = scope(objects, revision)
    for path in paths:
        raw = objects.lookup(revision, path)
        need(raw is not None, 'missing scoped source: ' + path)
        objects.payload['source/' + path] = raw
        # Also retain path/absence proofs against the formal historical baseline.
        objects.lookup(BASE, path)
    return objects.payload


def inventory(payload, revision):
    return {'schema': SCHEMA, 'sourceCommit': revision, 'formalBaseline': BASE,
            'scope': 'research source and public runtime; excludes historical evidence archives',
            'files': {p: {'bytes': len(raw), 'sha256': sha(raw)} for p, raw in sorted(payload.items())}}


def write_archive(payload, revision, target):
    members = dict(payload)
    members['MANIFEST.json'] = canonical(inventory(payload, revision))
    members['SHA256SUMS'] = ''.join(f'{sha(raw)}  {p}\n' for p, raw in sorted(members.items())).encode()
    with open(target, 'xb') as output:
        with gzip.GzipFile(fileobj=output, filename='', mode='wb', mtime=0, compresslevel=9) as zipped:
            with tarfile.open(fileobj=zipped, mode='w', format=tarfile.PAX_FORMAT) as archive:
                for path, raw in sorted(members.items()):
                    info = tarfile.TarInfo(path)
                    info.size, info.mode, info.mtime = len(raw), 0o644, 0
                    archive.addfile(info, io.BytesIO(raw))


def check(archive_path, revision):
    need(bool(re.fullmatch('[0-9a-f]{40}', revision)), 'explicit full source commit required')
    need(Path(archive_path).stat().st_size <= MAX_BYTES, 'oversized archive')
    members, total = {}, 0
    class BoundedStream:
        def __init__(self, stream):
            self.stream, self.total = stream, 0
        def read(self, size):
            raw = self.stream.read(size)
            self.total += len(raw)
            need(self.total <= MAX_BYTES, 'oversized decompressed tar stream')
            return raw
    with gzip.open(archive_path, 'rb') as zipped, tarfile.open(fileobj=BoundedStream(zipped), mode='r|') as archive:
        for entry in archive:
            safe(entry.name)
            need(entry.isfile() and not entry.issparse() and not entry.linkname, 'nonregular archive member')
            need(entry.name not in members and len(members) < MAX_MEMBERS, 'duplicate/excess members')
            need(0 <= entry.size <= MAX_FILE, 'oversized archive member')
            total += entry.size
            need(total <= MAX_BYTES, 'oversized expanded archive')
            members[entry.name] = archive.extractfile(entry).read()
    need('MANIFEST.json' in members and 'SHA256SUMS' in members, 'missing archive inventory')
    sums = members.pop('SHA256SUMS')
    need(sums == ''.join(f'{sha(raw)}  {p}\n' for p, raw in sorted(members.items())).encode(), 'SHA256SUMS mismatch')
    manifest_raw = members.pop('MANIFEST.json')
    need(manifest_raw == canonical(inventory(members, revision)), 'manifest/source identity mismatch')
    objects = Objects(payload=members)
    paths = scope(objects, revision)
    need({p for p in members if p.startswith('source/')} == {'source/' + p for p in paths}, 'source scope mismatch')
    for path in paths:
        need(objects.lookup(revision, path) == members['source/' + path], 'source differs from Git: ' + path)
        objects.lookup(BASE, path)
    need(set(members) == objects.used | {'source/' + p for p in paths}, 'extra/missing Git witness')
    # Verify all Phase006 pins without importing or executing capsule code.
    formal = json.loads(members['source/' + FORMAL])
    for path, digest in formal['files'].items():
        need(sha(members['source/' + path]) == digest, 'formal source pin mismatch: ' + path)
    return members


def extract(archive_path, revision, destination):
    members = check(archive_path, revision)
    destination = Path(destination)
    # No writes to an existing path, symlink or repository; no tar extraction API.
    destination.mkdir(parents=False, exist_ok=False)
    for path, raw in members.items():
        target = destination / path
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('xb') as output:
            output.write(raw)
    (destination / 'MANIFEST.json').write_bytes(canonical(inventory(members, revision)))
    # A deliberately partial object database, not a clone or historical checkout.
    # Original formal verifier can read its BASE:path objects unchanged/offline.
    gitdir = destination / 'source/.git'
    (gitdir / 'objects').mkdir(parents=True)
    (gitdir / 'refs').mkdir()
    (gitdir / 'HEAD').write_text(revision + '\n')
    (gitdir / 'shallow').write_text(revision + '\n' + BASE + '\n')
    (gitdir / 'config').write_text('[core]\n\trepositoryformatversion = 0\n\tbare = false\n')
    for path, raw in members.items():
        if path.startswith('provenance/objects/'):
            oid = path.rsplit('/', 1)[1]
            target = gitdir / 'objects' / oid[:2] / oid[2:]
            target.parent.mkdir(exist_ok=True)
            target.write_bytes(zlib.compress(raw))
    return destination / 'source'


def reproduce(root, lean):
    # No package installers, network calls, caches or claimed receipt reuse.
    commands = [['node', '--test', *['tests/' + name + '.test.js' for name in
                 ('exact-rational', 'rational-q16', 'exact-geometry', 'exact-d4', 'exact-graph', 'alien-math-006', 'browser-suite-cache')]]]
    commands += [[sys.executable, f'scripts/alien_math_00{i}_oracle.py', '--check'] for i in range(1, 7)]
    commands += [[sys.executable, 'scripts/ci_invariant_oracle.py', '--check'],
                 [sys.executable, 'scripts/verify_alien_math_006.py', '--lean', lean, '--negative-controls', '--output', '../formal-result.json'],
                 ['node', 'scripts/build.js'], ['node', 'scripts/verify-offline.js']]
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE='1')
    for cmd in commands:
        print('+ ' + ' '.join(cmd), flush=True)
        subprocess.run(cmd, cwd=root, env=env, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['build', 'check', 'extract', 'reproduce'])
    parser.add_argument('--revision', required=True, help='externally reviewed full source commit; never trust archive metadata alone')
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--destination', type=Path)
    parser.add_argument('--lean', default='lean')
    args = parser.parse_args()
    need(bool(re.fullmatch('[0-9a-f]{40}', args.revision)), 'explicit full source commit required')
    if args.action == 'build':
        write_archive(payload_for(ROOT, args.revision), args.revision, args.archive)
    members = check(args.archive, args.revision)
    print(json.dumps({'status': 'INTEGRITY_AND_SOURCE_BINDING_PASS', 'sourceCommit': args.revision,
                      'sha256': sha(args.archive.read_bytes()), 'members': len(members),
                      'proofsExecuted': False}, sort_keys=True), flush=True)
    if args.action in ('extract', 'reproduce'):
        need(args.destination is not None, '--destination required')
        root = extract(args.archive, args.revision, args.destination)
        if args.action == 'reproduce':
            reproduce(root, args.lean)


if __name__ == '__main__':
    main()
