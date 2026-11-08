#!/usr/bin/env python3
"""Validate surviving records. This does not recreate Lean or arithmetic executions."""
import datetime
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
import tarfile

root, acquisition = map(Path, sys.argv[1:])
e = root / 'evidence'
def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):
    return json.loads(p.read_text())
def manifest(p, base):
    seen = set()
    for line in p.read_text().splitlines():
        digest, name = line.split('  ', 1)
        assert name not in seen and not Path(name).is_absolute() and '..' not in Path(name).parts
        seen.add(name)
        assert sha(base / name) == digest, name
    return len(seen)
def module(p, name):
    spec = importlib.util.spec_from_file_location(name, p)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

print('RECOVERY VALIDATION ONLY; original execution timestamps and outcomes retained')
print('PASS acquisition byte identity:', manifest(acquisition, root), 'files')
print('PASS pre-interruption prior-evidence checksums:', manifest(e/'corrective/prior-evidence.sha256', e))
print('PASS pre-interruption audit-tool checksums:', manifest(e/'corrective/tooling.sha256', e))
receipts = sorted(e.rglob('*.execution.json'))
assert len(receipts) == 113
for p in receipts:
    r = read(p)
    assert datetime.datetime.fromisoformat(r['started_utc']) <= datetime.datetime.fromisoformat(r['finished_utc']), p
    assert type(r['exit_status']) is int, p
    for field in ['stdout', 'stderr']:
        assert (p.parent / r[field]).is_file(), (p, field)
    if 'status' in r:
        assert r['status'] == ('PASS' if r['exit_status'] == 0 else 'FAIL'), p
print('PASS 113 completed receipts: timestamps, exit statuses, stdout and stderr present')
for name, log, needle in [
    ('01-sandbox', 'q16-source-bridge.json', 'spawnSync git EPERM'),
    ('02-origin-audit-v1', 'origin-audit.txt', 'theorem set mismatch')]:
    d = e/'attempts'/name
    assert read(d/(log+'.execution.json'))['exit_status'] == 1
    assert needle in (d/log).read_text() + (d/(log+'.stderr')).read_text()
    print('PASS required original failure preserved:', name)

v = module(e/'corrective/tools/verify.py', 'recovered_gate')
baseline = v.baseline(e/'corrective/expected-inventory.json')
for run in ['04-target', '08-target-repro']:
    d = e/'corrective'/run
    report = v.parse((d/'inventory.json').read_bytes())
    v.verify_identity(read(d/'identity.json'), baseline)
    result = v.verify_report(report, baseline)
    recorded = read(d/'verification.json')
    assert recorded.pop('scope') == 'identity-and-origin'
    assert result == recorded
    assert result['declarations'] == 31 and result['dependency_constants'] == 1706
    assert result['classification'] == dict(specified_theorem=14, generated_auxiliary_lemma=12, definition=5)
    assert result['axioms'] == ['Quot.sound', 'propext']
    assert all(r['module'] == 'Q16Formal' for r in report['declarations'])
    assert len(list(d.glob('*.execution.json'))) == 11
    assert all(read(p)['exit_status'] == 0 for p in d.glob('*.execution.json'))
    print('PASS', run, ': exact 31 declarations, types, origins, 1706 dependency closure, axiom allowlist')
assert (e/'corrective/04-target/inventory.json').read_bytes() == (e/'corrective/08-target-repro/inventory.json').read_bytes()
for run, console in [('04-target','corrective-console.txt'), ('08-target-repro','corrective-repro-console.txt')]:
    d = e/'corrective'/run
    order = sorted(d.glob('*.execution.json'), key=lambda p: read(p)['started_utc'])
    combined = b''.join((d/read(p)['stdout']).read_bytes() for p in order)
    assert combined == (root/console).read_bytes(), console
    print('PASS complete independent console copy equals ordered outputs:', console)

neg = e/'corrective/07-negative-controls'
results = read(neg/'RESULTS.json')
assert results['status'] == 'PASS' and results['count'] == len(results['controls']) == 28
assert len({r['case'] for r in results['controls']}) == 28
for control in results['controls']:
    name = control['case']
    typed = name.endswith('-typed-consumer')
    d = neg/(name.removesuffix('-typed-consumer') if typed else name)
    label = 'typed-consumer' if typed else 'verify'
    r = read(d/(label+'.execution.json'))
    assert control['status'] == 'PASS' and control['actual_exit_status'] == r['exit_status'] == 1
    if typed:
        text = (d/(label+'.stdout')).read_text().lower()
        assert control['expected_rejection'] in text
    else:
        assert (d/(label+'.stderr')).read_text().startswith(control['expected_rejection']+':')
    if (d/'Q16Formal.lean').exists():
        assert sha(d/'Q16Formal.lean') == r['input_sha256']['Q16Formal.lean']
        for stage in ['build','inventory']:
            assert read(d/(stage+'.execution.json'))['exit_status'] == 0
    if (d/'mutation.json').exists():
        mutation = read(d/'mutation.json')
        inp = root/'negative-fixtures-07/report-inputs'/(name+'.json')
        assert sha(inp) == mutation['input_sha256']
        exp = root/'negative-fixtures-07/repinned-expected.json' if name == 'repinned-expected-inventory' else e/'corrective/expected-inventory.json'
        assert sha(exp) == mutation['expected_sha256']
        if mutation['identity_sha256']:
            assert sha(inp.with_suffix('.identity.json')) == mutation['identity_sha256']
    print('PASS retained corrective control:', name, '->', control['expected_rejection'])
assert read(neg/'negative-controls.txt.execution.json')['exit_status'] == 0
assert 'PASS all 28 negative controls' in (neg/'negative-controls.txt').read_text()

bridge = read(e/'q16-source-bridge.json')
assert bridge == dict(schema='qsol.q16.formal-bridge.v1', source_blob='d457b0154d9dfc8b50fd593b5e9dff75e1ea66b9', claim='FINITE_CONFORMANCE_ONLY', accepted=220921, rejected=33992, canonical_zeros=1148, root_checks=200009)
assert read(e/'q16-source-bridge.json.execution.json')['exit_status'] == 0
tap = (e/'q16-regressions.txt').read_text()
assert len(re.findall(r'^ok \d+ - ', tap, re.M)) == 17
for key, count in [('tests',17),('pass',17),('fail',0),('cancelled',0),('skipped',0),('todo',0)]:
    assert re.findall(r'^# '+key+r' (\d+)$', tap, re.M) == [str(count)]
assert read(e/'q16-regressions.txt.execution.json')['exit_status'] == 0
print('PASS retained finite conformance: 220921 accepted; 33992 rejected; 1148 canonical zeros; 200009 root brackets; 17/17 regressions')
print('PASS original five controls enabled: frozen verifier calls negative_controls() before its report gate; prior successful receipts and owner comparison retained')
print('PASS recovery record validation complete; no Lean build, numerical rerun, or rewritten original result')
