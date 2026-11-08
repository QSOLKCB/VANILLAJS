#!/usr/bin/env python3
"""Verify every manifest member and reject unlisted files, duplicates or symlinks."""
import hashlib
from pathlib import Path

root = Path(__file__).resolve().parent
entries = {}
for line in (root/'SHA256SUMS').read_text().splitlines():
    digest, name = line.split('  ', 1)
    assert len(digest) == 64 and all(c in '0123456789abcdef' for c in digest)
    assert name not in entries and name != 'SHA256SUMS'
    assert not Path(name).is_absolute() and '..' not in Path(name).parts
    entries[name] = digest
files = set()
for p in root.rglob('*'):
    assert not p.is_symlink(), p
    if p.is_file() and p != root/'SHA256SUMS': files.add(p.relative_to(root).as_posix())
assert files == set(entries), (sorted(files-set(entries)), sorted(set(entries)-files))
for name,digest in entries.items():
    assert hashlib.sha256((root/name).read_bytes()).hexdigest() == digest, name
print('PASS SHA256SUMS:',len(entries),'members; no missing, duplicate or unlisted files')
