#!/usr/bin/env python3
"""Hash effective tools without exposing workstation-specific installation paths."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess

def sha(path):
    with Path(path).open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()

lean = Path(subprocess.check_output(['elan', 'which', 'lean'], text=True).strip()).resolve()
root = lean.parent.parent
source = Path.cwd()

def public_path(path):
    value = str(path)
    for private, public in [(str(root), '<LEAN_TOOLCHAIN_ROOT>'),
                            (str(source), '<FROZEN_SOURCE>'),
                            (str(Path.home()), '<USER_HOME>')]:
        value = value.replace(private, public)
    return value

tools = {}
for name in ['lean', 'lake', 'node', 'python3', 'git', 'bash', 'sha256sum', 'elan']:
    invoked = Path(shutil.which(name))
    effective = root / 'bin' / name if name in ['lean', 'lake'] else invoked.resolve()
    tools[name] = {'invoked_path': public_path(invoked), 'effective_resolved_path': public_path(effective),
                   'sha256': sha(effective), 'invoked_binary_sha256': sha(invoked)}
    linked = subprocess.run(['ldd', str(effective)], capture_output=True, text=True)
    dependencies = []
    for line in linked.stdout.splitlines():
        for token in line.split():
            p = Path(token)
            if p.is_absolute() and p.is_file():
                dependencies.append({'path': public_path(p.resolve()), 'sha256': sha(p)})
    tools[name]['dynamic_libraries'] = dependencies
    tools[name]['ldd_exit_status'] = linked.returncode

# Full installed Lean distribution, including helper executables, native libraries,
# sources, compiled standard library and build metadata. No compiler bytes exported.
tree = hashlib.sha256()
files = sorted((p for p in root.rglob('*') if p.is_file()), key=lambda p: p.relative_to(root).as_posix())
for p in files:
    tree.update((sha(p) + '  ' + p.relative_to(root).as_posix() + '\n').encode())

proof_inputs = ['Q16Formal.lean', 'Q16Audit.lean', 'lean-toolchain', 'lakefile.toml',
    'scripts/verify-q16-proof-boundary.py', 'scripts/verify-q16-axioms.py',
    'scripts/q16-formal-bridge.mjs', 'modules/integer-math/index.js',
    'modules/integer-vector/index.js', 'tests/q16-radix.test.js',
    'tests/q16-independent.test.js', 'tests/integer-math.test.js',
    '.github/workflows/q16-formal.yml', '.github/workflows/q16-formal-local.yml',
    'docs/Q16_FORMAL_001.md', 'formal/context/q16-project.json']
for name in proof_inputs:
    expected = subprocess.check_output(['git', 'rev-parse', 'HEAD:' + name], text=True).strip()
    assert subprocess.check_output(['git', 'hash-object', name], text=True).strip() == expected

print(json.dumps({
    'tools': tools,
    'lean_distribution': {'file_count': len(files), 'byte_count': sum(p.stat().st_size for p in files),
        'sorted_sha256_manifest_digest': tree.hexdigest(),
        'algorithm': 'SHA256 of UTF-8 SHA256(file) + two spaces + POSIX relative path + LF, sorted by relative path; regular files including resolved symlinks',
        'origin': 'Preinstalled elan toolchain; publisher signature and independent bootstrap NOT_RUN'},
    'environment_allowlist': {k: public_path(os.environ[k]) if k in os.environ else None for k in [
        'LEAN_TOOLCHAIN', 'ELAN_TOOLCHAIN', 'LEAN_PATH', 'LEAN_SYSROOT', 'NODE_OPTIONS', 'NODE_PATH',
        'LANG', 'LC_ALL', 'PYTHONDONTWRITEBYTECODE']},
    'proof_inputs_sha256': {name: sha(name) for name in proof_inputs},
    'generated_build_metadata_sha256': {name: sha(name) for name in [
        'lake-manifest.json', '.lake/build/ir/Q16Formal.setup.json',
        '.lake/build/lib/lean/Q16Formal.olean', '.lake/build/lib/lean/Q16Formal.trace']},
    'lake_manifest': json.loads(Path('lake-manifest.json').read_text())
}, indent=2))
