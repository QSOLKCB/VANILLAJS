#!/usr/bin/env python3
"""Observe each case of the unchanged original negative_controls function."""
import hashlib
import importlib.util
import json
from pathlib import Path

p = Path('scripts/verify-q16-axioms.py')
assert hashlib.sha256(p.read_bytes()).hexdigest() == '1523ce456304737267b8abc380a6592656f2ab6d7e339f8f3b7996bb8936291e'
spec = importlib.util.spec_from_file_location('original', p)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
verify = m.verify
observed = []
def observe(report):
    try:
        result = verify(report)
    except ValueError as error:
        observed.append({'outcome':'rejected', 'reason':str(error)})
        raise
    observed.append({'outcome':'accepted', 'theorems':len(result)})
    return result
m.verify = observe
m.negative_controls()
assert observed[0] == {'outcome':'accepted','theorems':14}
names = ['sorryAx', 'missing-theorem', 'duplicate-theorem', 'unexpected-theorem', 'malformed-record']
assert len(observed) == 6 and all(r['outcome'] == 'rejected' for r in observed[1:])
print(json.dumps({'scope':'recovery execution of unchanged original five controls', 'status':'PASS',
    'source_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),
    'controls':[dict(case=name, **record) for name,record in zip(names,observed[1:])]}, indent=2))
