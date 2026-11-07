#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Offline extraction of the source-pinned official FreeDM v0.13.0 release.

Download the original ZIP manually from Freedoom GitHub first. This tool never
accesses the network, doesn't require root, and does not overwrite existing WAD.
"""
import argparse
import hashlib
import os
from pathlib import Path
import stat
import zipfile

ORIGINAL_ZIP_SHA256 = (
    "b420f13508ef745d7b38e83d15e55e0fc0b09d9a503c96741cddd9773d43f7c9"
)
MEMBER = "freedm-0.13.0/freedm.wad"


def prepare(archive: Path, dest: Path):
    if not archive.is_file() or archive.is_symlink():
        raise ValueError("expected a regular original Freedoom release ZIP")
    sha = hashlib.sha256()
    with archive.open("rb") as f:
        for part in iter(lambda: f.read(1024 * 1024), b""):
            sha.update(part)
    if sha.hexdigest() != ORIGINAL_ZIP_SHA256:
        raise ValueError("official release ZIP SHA-256 mismatch")
    if dest.name != "freedm.wad" or dest.exists() or dest.is_symlink():
        raise ValueError("destination must be unused and named freedm.wad")
    with zipfile.ZipFile(archive) as z:
        hits = [x for x in z.infolist() if x.filename == MEMBER]
        if len(hits) != 1 or hits[0].is_dir() or \
           stat.S_ISLNK(hits[0].external_attr >> 16) or \
           not 1_000_000 <= hits[0].file_size <= 80_000_000:
            raise ValueError("expected a bounded regular FreeDM IWAD entry")
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            with z.open(hits[0]) as source, dest.open("xb") as output:
                total = 0
                first = source.read(4)
                if first != b"IWAD":
                    raise ValueError("WAD header mismatch")
                output.write(first)
                total += len(first)
                for part in iter(lambda: source.read(1024 * 1024), b""):
                    total += len(part)
                    if total > hits[0].file_size:
                        raise ValueError("WAD exceeds declared size")
                    output.write(part)
            if total != hits[0].file_size:
                raise ValueError("WAD size drift")
        except Exception:
            dest.unlink(missing_ok=True)
            raise
    print(f"FreeDM v0.13.0 ready: {dest} (source ZIP verified, {total} WAD bytes)")
    print("WAD SHA-256:", hashlib.sha256(dest.read_bytes()).hexdigest())


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--zip", type=Path, required=True)
    parser.add_argument("--dest", type=Path, required=True)
    a = parser.parse_args()
    prepare(a.zip, a.dest)
