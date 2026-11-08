#!/usr/bin/env python3
"""One-time reviewed baseline derivation, never called by the acceptance gate."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

source, report_path, tools_path, output = map(Path, sys.argv[1:])
commit = subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip()
assert commit == 'b99f5a4af17babe1215bc36872a18a4c72714faf'
assert subprocess.check_output(['git', '-C', str(source), 'hash-object', 'Q16Formal.lean'], text=True).strip() == '84ea668446d4217b526fd12c64224743efb81954'
text = (source / 'Q16Formal.lean').read_text()
authored = {'Q16Formal.' + name: (kind, n) for n, line in enumerate(text.splitlines(), 1)
            if (m := re.match(r'^(theorem|def) ([A-Za-z_][A-Za-z0-9_]*)', line))
            for kind, name in [m.groups()]}
# Explicitly reviewed relationships: only these exact generated declarations qualify.
parents = {
    'checked_magnitude_within_int32': ['_proof_1_3', '_proof_1_4'],
    'exact_safe_product_path': ['_proof_1_1'],
    'expanded_remainder_lt_2pow47': ['_proof_1_1'],
    'magnitudeLimit': ['eq_1'],
    'quotient_certificate_sound': ['_proof_1_1', '_proof_1_2'],
    'radix_digit_lt': ['_proof_1_1'],
    'scaled_radicand_lt_2pow47': ['_proof_1_1'],
    'signedMagnitude': ['eq_1'],
    'trial_product_lt_2pow47': ['_proof_1_1', '_proof_1_2']}
generated = {'Q16Formal.' + p + '.' + suffix: 'Q16Formal.' + p for p, suffixes in parents.items() for suffix in suffixes}
j = json.loads(report_path.read_text())
rows = []
for row in j['declarations']:
    name = row['name']
    if name in authored:
        kind, line = authored[name]
        classification = 'specified_theorem' if kind == 'theorem' else 'definition'
        parent = name
        relationship = 'Explicit frozen source declaration; full type checked by ExactStatements.lean.'
    else:
        assert name in generated, 'Unexplained declaration: ' + name
        parent = generated[name]
        line = authored[parent][1]
        classification = 'generated_auxiliary_lemma'
        relationship = ('Definitional equation lemma for the parent definition.' if name.endswith('.eq_1') else
                        'Omega-generated contradiction lemma supporting the parent proof; not a separate user-authored claim.')
    rows.append({'observed': row, 'classification': classification, 'parent': parent,
                 'source': 'Q16Formal.lean', 'source_line': line, 'relationship': relationship})
assert set(authored) | set(generated) == {r['observed']['name'] for r in rows}
tool = json.loads(tools_path.read_text())
opaque = [r for r in j['dependency_closure'] if r['kind'] == 'opaque']
assert [r['name'] for r in opaque] == ['String.Internal.append']
assert opaque[0]['opaque_details']['axioms'] == []
baseline = {
    'schema': 'qsol.q16.expected-origin-inventory.v2',
    'source_commit': commit, 'source_proof_blob': '84ea668446d4217b526fd12c64224743efb81954',
    'source_production_blob': 'd457b0154d9dfc8b50fd593b5e9dff75e1ea66b9',
    'audited_modules': ['Q16Formal'], 'source_modules': ['Q16Audit.lean', 'Q16Formal.lean'],
    'allowlist': ['Quot.sound', 'propext'],
    'toolchain_pin': 'leanprover/lean4:v4.35.0',
    'lean_banner': 'Lean (version 4.35.0, x86_64-unknown-linux-gnu, commit eb6cafb7290e8bd5f2937522d8d804f58f02bafc, Release)',
    'lean_binary_sha256': tool['tools']['lean']['sha256'],
    'lake_binary_sha256': tool['tools']['lake']['sha256'],
    'proof_inputs_sha256': tool['proof_inputs_sha256'],
    'lean_distribution_digest': tool['lean_distribution']['sorted_sha256_manifest_digest'],
    'declarations': rows,
    'dependency_closure_count': len(j['dependency_closure']),
    'dependency_closure_sha256': digest(sorted(j['dependency_closure'], key=lambda r:r['name'])),
    'reviewed_opaque_dependencies': opaque,
    'opaque_justification': 'String.Internal.append is a safe standard-library opaque data function, String -> String -> String, with no transitive axioms and a kernel default-value body. Reachable through Omega -> IntList/List.get! -> panic-message construction, not an admitted proposition. Its exact type, value, module and dependencies are pinned here; any other opaque dependency is rejected. Runtime extern implementation is not a mathematical axiom and is not claimed formally verified.',
    'baseline_derivation': 'Actual environment/module enumeration plus explicit frozen-source declaration scan and reviewed auxiliary-parent mapping. Acceptance does not run this derivation or accept changes to this file.'}
with output.open('x') as f:
    json.dump(baseline, f, indent=2);f.write('\n')
print('Pinned expected inventory:',len(rows),'declarations; closure:',len(j['dependency_closure']))
print('Expected inventory SHA-256:',hashlib.sha256(output.read_bytes()).hexdigest())
