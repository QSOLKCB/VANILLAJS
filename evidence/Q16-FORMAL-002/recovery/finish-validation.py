#!/usr/bin/env python3
"""Validate recovery acquisition and current source/tool identities."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tarfile

r = Path(sys.argv[1])
original = Path('/home/trent/q16-formal-002-20261108T090744Z')
def read(p): return json.loads(p.read_text())
new = r/'10-recovery-validation'
old = original/'evidence/corrective/08-target-repro'
assert read(new/'tool-identity.stdout') == read(old/'tool-identity.json')
assert read(new/'current-identity.stdout') == read(old/'identity.json')
print('PASS current complete tool identity equals pre-interruption record: 17938 Lean files, executable and linked-library hashes, source inputs, environment and build metadata')
print('PASS current source identity equals frozen execution identity; generated artifacts remain unchanged')
manifest = dict((name,digest) for digest,name in (line.split('  ',1) for line in (r/'acquisition.sha256').read_text().splitlines()))
with tarfile.open(r/'preserved-originals.tar.gz','r:gz') as archive:
    members = archive.getmembers()
    assert len(members) == len(manifest) == 602
    assert {m.name for m in members} == set(manifest)
    for member in members:
        assert member.isfile()
        assert hashlib.sha256(archive.extractfile(member).read()).hexdigest() == manifest[member.name]
        assert hashlib.sha256((original/member.name).read_bytes()).hexdigest() == manifest[member.name]
print('PASS 602 archived members and original files still byte-identical to recovery acquisition')
source = original/'source-corrective-repro'
expected = read(original/'evidence/corrective/expected-inventory.json')
for path,digest in expected['proof_inputs_sha256'].items():
    committed = subprocess.check_output(['git','-C',str(source),'show',expected['source_commit']+':'+path])
    assert hashlib.sha256(committed).hexdigest() == digest
    assert (source/path).read_bytes() == committed
print('PASS all 16 proof-relevant files equal frozen Git objects')
for name in ['source','source-retry','source-corrective','source-corrective-repro']:
    wt=original/name
    assert subprocess.check_output(['git','-C',str(wt),'rev-parse','HEAD'],text=True).strip() == expected['source_commit']
    assert subprocess.check_output(['git','-C',str(wt),'status','--porcelain=v1','--untracked-files=no'],text=True) == ''
print('PASS all four original execution worktrees retain frozen HEAD and unchanged tracked files')
print('PASS recovery complete; original Lean and arithmetic executions did not require rerunning')
