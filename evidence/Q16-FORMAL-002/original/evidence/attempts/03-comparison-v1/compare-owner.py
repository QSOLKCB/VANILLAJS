#!/usr/bin/env python3
"""Compare newly captured results with an untouched downloaded owner ZIP."""
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import zipfile

evidence = Path(sys.argv[1])
archive = Path(sys.argv[2])
expected_zip = 'e28d6a4af857fccdaa74e35325b74a532570922603d107a5b64b5042e5e0acd4'
observed_zip = hashlib.sha256(archive.read_bytes()).hexdigest()
assert observed_zip == expected_zip
spec = importlib.util.spec_from_file_location('original_axiom_verifier', 'scripts/verify-q16-axioms.py')
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)
verifier.negative_controls()  # unchanged five negative controls

with zipfile.ZipFile(archive) as z:
    names = z.namelist()
    assert len(names) == len(set(names)) == 9
    entries = z.read('SHA256SUMS').decode().splitlines()
    manifest_names = []
    for line in entries:
        digest, name = line.split('  ', 1)
        assert hashlib.sha256(z.read(name)).hexdigest() == digest, name
        manifest_names.append(name)
    assert len(set(manifest_names)) == len(entries) == 8
    assert set(manifest_names) == set(names) - {'SHA256SUMS'}
    print('PASS owner ZIP SHA-256:', observed_zip)
    print('PASS owner manifest: all 8 entries; no missing, duplicate or unlisted payload files')
    for name in ['proof-inventory.txt', 'q16-axiom-audit.txt', 'axiom-verification.txt']:
        assert z.read(name) == (evidence / name).read_bytes(), name
        print('PASS byte-identical owner/new:', name)
    owner_audit = verifier.verify(z.read('q16-axiom-audit.txt').decode())
    new_audit = verifier.verify((evidence / 'q16-axiom-audit.txt').read_text())
    assert owner_audit == new_audit
    assert len(new_audit) == 14
    print('PASS transitive axioms:', ', '.join(sorted(set().union(*new_audit.values()))))
    expected = dict(schema='qsol.q16.formal-bridge.v1',
                    source_blob='d457b0154d9dfc8b50fd593b5e9dff75e1ea66b9',
                    claim='FINITE_CONFORMANCE_ONLY', accepted=220921, rejected=33992,
                    canonical_zeros=1148, root_checks=200009)
    owner_bridge = json.loads(z.read('q16-source-bridge.json'))
    new_bridge = json.loads((evidence / 'q16-source-bridge.json').read_text())
    assert owner_bridge == new_bridge == expected
    print('PASS complete bridge JSON equality:', json.dumps(new_bridge, sort_keys=True))

    def parse_tap(raw):
        tests = re.findall(r'^ok (\d+) - (.+)$', raw, re.M)
        assert [int(n) for n, _ in tests] == list(range(1, 18))
        assert len({name for _, name in tests}) == 17
        assert not re.search(r'^not ok |# (?:SKIP|TODO)', raw, re.M | re.I)
        totals = dict(re.findall(r'^# (tests|suites|pass|fail|cancelled|skipped|todo) (\d+)$', raw, re.M))
        assert totals == dict(tests='17', suites='0', pass='17', fail='0', cancelled='0', skipped='0', todo='0')
        return tests, totals

    owner_tap = z.read('q16-regressions.txt').decode()
    new_tap = (evidence / 'q16-regressions.txt').read_text()
    assert parse_tap(owner_tap) == parse_tap(new_tap)
    print('PASS exact test identity/outcome equality: 17 pass, 0 fail/cancelled/skipped/todo')
    print('Regression raw bytes equal:', owner_tap == new_tap, '(durations are not arithmetic outcomes)')
    print('Owner/new source and toolchain identities:')
    owner_tools = z.read('TOOLCHAIN.txt').decode()
    for identity in ['b99f5a4af17babe1215bc36872a18a4c72714faf',
                     '4.35.0', 'eb6cafb7290e8bd5f2937522d8d804f58f02bafc', 'v22.18.0', 'Python 3.14.4']:
        assert identity in owner_tools
        assert identity in ((evidence / 'TOOLCHAIN.txt').read_text() + (evidence / 'source-before.txt').read_text())
        print('  MATCH', identity)
    print('Owner member SHA-256 identities (reference bytes, not new execution):')
    for name in sorted(names):
        print(hashlib.sha256(z.read(name)).hexdigest(), name)

for name in ['source-before.txt', 'TOOLCHAIN.txt', 'proof-inventory.txt', 'lean-build.txt',
             'effective-lean.txt', 'q16-axiom-audit.txt', 'axiom-verification.txt',
             'q16-source-bridge.json', 'q16-regressions.txt', 'source-after.txt',
             'exact-statements.txt', 'origin-audit.txt']:
    receipt = json.loads((evidence / (name + '.execution.json')).read_text())
    assert receipt['exit_status'] == 0 and receipt['status'] == 'PASS', name
    print('PASS actual command exit=0:', name)

# Additional malicious-report controls use the original verifier without editing it.
good = (evidence / 'q16-axiom-audit.txt').read_text()
bad_reports = {
    'empty report': '',
    'unapproved axiom Classical.choice': good.replace('[propext]', '[Classical.choice]', 1),
    'undeclared project axiom': good.replace('[propext]', '[Injected.undeclared]', 1),
    'partial record': good + "\n'Q16Formal.zero_is_canonical' depends on axioms: [",
}
for name, bad in bad_reports.items():
    try:
        verifier.verify(bad)
    except ValueError:
        print('PASS rejected:', name)
    else:
        raise AssertionError('accepted malformed report: ' + name)
print('PASS unchanged original adversarial controls: 5; supplemental malformed-report controls: 4')
