# SPDX-License-Identifier: Apache-2.0
"""Independent finite graph/qualification oracle. Not a JavaScript parser/proof."""
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / 'tests/fixtures/ci-invariant-001-input.json'
OUTPUT = ROOT / 'tests/fixtures/ci-invariant-001-expected.json'

def reproduce():
    raw = INPUT.read_bytes()
    spec = json.loads(raw)
    graph = spec['graph']
    closures = {}
    for group in spec['groups']:
        visited = set()
        pending = [group]
        while pending:
            node = pending.pop()
            if node in visited:
                continue
            visited.add(node)
            pending.extend(graph[node])
        closures[group] = sorted(graph if group in spec['workerConsumers'] else visited)
    affected = {change: [g for g in spec['groups'] if change in closures[g]] for change in spec['changes']}
    result = {
        'schema': 1, 'inputSHA256': hashlib.sha256(raw).hexdigest(),
        'closures': closures, 'affected': affected,
        'qualifies': [len(set(runs)) >= 3 for runs in spec['qualificationCases']]
    }
    return (json.dumps(result, indent=2, sort_keys=True) + '\n').encode()

if __name__ == '__main__':
    if sys.argv[1:] == ['--write']:
        OUTPUT.write_bytes(reproduce())
    elif sys.argv[1:] == ['--check']:
        expected = reproduce()
        if OUTPUT.read_bytes() != expected:
            raise SystemExit('FAIL: independent CI fixture differs; never regenerate during verification')
        print('PASS CI-INVARIANT-001 finite closure oracle ' + hashlib.sha256(expected).hexdigest())
    else:
        raise SystemExit('usage: ci_invariant_oracle.py --check|--write')
