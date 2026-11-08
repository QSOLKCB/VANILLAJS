#!/usr/bin/env python3
"""Cross-check all positive and corrective execution receipts before publication."""
import hashlib
import json
from pathlib import Path
import subprocess

p=Path('../evidence')
expected=json.loads((p/'corrective/expected-inventory.json').read_text())
for directory in ['corrective/04-target','corrective/08-target-repro']:
    d=p/directory
    receipts=list(d.glob('*.execution.json'))
    assert len(receipts)==11
    for receipt in receipts:
        j=json.loads(receipt.read_text());assert j['exit_status']==0 and j['status']=='PASS',receipt.name
    verify=json.loads((d/'verification.json').read_text())
    assert verify['declarations']==31 and verify['unexpected_declarations']==[]
    assert verify['classification']==dict(specified_theorem=14,generated_auxiliary_lemma=12,definition=5)
    assert verify['axioms']==['Quot.sound','propext'] and verify['dependency_constants']==1706
    assert (d/'q16-axiom-audit.txt').read_bytes()==(p/'q16-axiom-audit.txt').read_bytes()
    tool=json.loads((d/'tool-identity.json').read_text())
    assert tool['lean_distribution']['sorted_sha256_manifest_digest']==expected['lean_distribution_digest']
    assert tool['proof_inputs_sha256']==expected['proof_inputs_sha256']
    print('PASS',directory,': 11 actual zero-exit commands; 31 declarations; 1706 dependencies; exact prior theorem audit; pinned complete Lean distribution')
negative=json.loads((p/'corrective/07-negative-controls/RESULTS.json').read_text())
assert negative['count']==len(negative['controls'])==28
assert all(r['status']=='PASS' and r['actual_exit_status']==1 for r in negative['controls'])
assert len({r['case'] for r in negative['controls']})==28
print('PASS 28 negative controls: every intended rejection recorded with actual nonzero exit')
assert json.loads((p/'corrective/07-negative-controls/negative-controls.txt.execution.json').read_text())['exit_status']==0
print('PASS negative-control harness exit 0')
assert subprocess.run(['git','diff','--exit-code']).returncode==0
assert subprocess.run(['git','diff','--cached','--exit-code']).returncode==0
assert subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()==expected['source_commit']
print('PASS frozen source unchanged after corrective tests')
print('PASS previous numerical evidence retained; its independent execution is not relabelled as a new arithmetic run')
