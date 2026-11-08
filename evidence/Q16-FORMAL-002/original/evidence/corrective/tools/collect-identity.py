#!/usr/bin/env python3
import hashlib
import json
from pathlib import Path
import subprocess
import sys

def run(*args):
    return subprocess.check_output(args, text=True).strip()
def sha(path):
    with Path(path).open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()

expected=json.loads(Path(sys.argv[1]).read_text())
lean=Path(run('elan','which','lean')).resolve()
status=run('git','status','--porcelain=v1','--untracked-files=all')
print(json.dumps({
    'commit':run('git','rev-parse','HEAD'),
    'tracked_status':run('git','status','--porcelain=v1','--untracked-files=no'),
    'untracked':[line[3:] for line in status.splitlines() if line.startswith('?? ')],
    'source_modules':sorted(p.as_posix() for p in Path('.').rglob('*.lean') if '.lake' not in p.parts),
    'proof_blob':run('git','hash-object','Q16Formal.lean'),
    'production_blob':run('git','hash-object','modules/integer-math/index.js'),
    'proof_inputs_sha256':{p:sha(p) for p in expected['proof_inputs_sha256']},
    'toolchain_pin':Path('lean-toolchain').read_text().strip(),
    'lean_banner':run('lake','env','lean','--version'),
    'lean_binary_sha256':sha(lean), 'lake_binary_sha256':sha(lean.parent/'lake'),
    'packages':json.loads(Path('lake-manifest.json').read_text())['packages']
},indent=2))
