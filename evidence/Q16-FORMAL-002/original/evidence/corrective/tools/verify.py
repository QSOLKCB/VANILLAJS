#!/usr/bin/env python3
"""Fail-closed gate for one reviewed source/toolchain/inventory, not an auto-allowlist."""
import hashlib
import json
from pathlib import Path
import sys

EXPECTED_SHA256 = '9dd94f76d6c7343c162f35d4fe0f5fcd79146bdc740d2cbae333aabd5580984c'

class Rejected(Exception):
    def __init__(self, code, detail):
        self.code = code
        super().__init__(code + ': ' + detail)

def require(condition, code, detail):
    if not condition:
        raise Rejected(code, detail)

def pairs(items):
    result = {}
    for k, v in items:
        require(k not in result, 'MALFORMED_REPORT', 'duplicate JSON key: ' + k)
        result[k] = v
    return result

def parse(raw):
    require(bool(raw.strip()), 'EMPTY_REPORT', 'no report bytes')
    try:
        return json.loads(raw, object_pairs_hook=pairs)
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        raise Rejected('MALFORMED_REPORT', 'invalid or truncated JSON') from e

def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

def baseline(path):
    raw = Path(path).read_bytes()
    require(hashlib.sha256(raw).hexdigest() == EXPECTED_SHA256,
            'BASELINE_IDENTITY_MISMATCH', 'expected inventory changed; independent review required')
    return parse(raw)

def verify_identity(actual, expected):
    require(actual['commit'] == expected['source_commit'], 'SOURCE_COMMIT_MISMATCH', 'frozen commit differs')
    require(actual['tracked_status'] == '', 'DIRTY_WORKTREE', 'tracked source is modified')
    require(actual['source_modules'] == expected['source_modules'], 'UNEXPECTED_SOURCE_MODULE', 'Lean source module set differs')
    require(actual['proof_blob'] == expected['source_proof_blob'] and actual['production_blob'] == expected['source_production_blob'],
            'SOURCE_CONTENT_MISMATCH', 'Git blob differs')
    require(actual['proof_inputs_sha256'] == expected['proof_inputs_sha256'], 'SOURCE_CONTENT_MISMATCH', 'proof-relevant input bytes differ')
    require(actual['toolchain_pin'] == expected['toolchain_pin'] and actual['lean_banner'] == expected['lean_banner'],
            'TOOLCHAIN_MISMATCH', 'configured or effective Lean differs')
    require(actual['lean_binary_sha256'] == expected['lean_binary_sha256'] and actual['lake_binary_sha256'] == expected['lake_binary_sha256'],
            'TOOLCHAIN_MISMATCH', 'effective executable bytes differ')
    require(actual['packages'] == [], 'DEPENDENCY_MISMATCH', 'unexpected Lake package dependency')
    require(all(n == 'lake-manifest.json' or n.startswith('.lake/') for n in actual['untracked']),
            'DIRTY_WORKTREE', 'unexplained untracked file')

def indexed(rows, required, label):
    require(isinstance(rows, list) and bool(rows), 'EMPTY_REPORT', label + ' is empty')
    result = {}
    for row in rows:
        require(isinstance(row, dict) and set(row) == required, 'MALFORMED_REPORT', label + ' fields differ')
        require(isinstance(row['name'], str) and bool(row['name']), 'MALFORMED_REPORT', 'invalid declaration name')
        require(row['name'] not in result, 'DUPLICATE_DECLARATION', row['name'])
        require(isinstance(row['module'], str) and isinstance(row['kind'], str), 'MALFORMED_REPORT', 'invalid kind/origin')
        require(type(row['unsafe']) is bool and type(row['partial']) is bool, 'MALFORMED_REPORT', 'invalid safety fields')
        require(isinstance(row['direct_dependencies'], list) and all(isinstance(n,str) for n in row['direct_dependencies']),
                'MALFORMED_REPORT', 'invalid dependency list')
        result[row['name']] = row
    return result

def verify_report(actual, expected):
    require(isinstance(actual, dict) and set(actual) == {'schema','audited_modules','declarations','dependency_closure'},
            'MALFORMED_REPORT', 'report fields differ')
    require(actual['schema'] == 'qsol.q16.origin-inventory.v2' and actual['audited_modules'] == expected['audited_modules'],
            'MALFORMED_REPORT', 'schema or module coverage differs')
    declared = indexed(actual['declarations'], {'name','module','kind','unsafe','partial','level_parameters','type','type_expr','axioms','direct_dependencies'}, 'origin inventory')
    closure = indexed(actual['dependency_closure'], {'name','module','kind','unsafe','partial','direct_dependencies','opaque_details'}, 'dependency closure')
    allowed = set(expected['allowlist'])
    for row in declared.values():
        require(isinstance(row['axioms'], list) and all(isinstance(a,str) for a in row['axioms']), 'MALFORMED_REPORT', 'invalid axiom list')
        require(len(row['axioms']) == len(set(row['axioms'])), 'MALFORMED_REPORT', 'duplicate axiom')
        require(set(row['axioms']) <= allowed, 'UNAPPROVED_AXIOM', row['name'] + ': ' + repr(row['axioms']))
        require(isinstance(row['type'], str) and bool(row['type']) and isinstance(row['type_expr'], str) and bool(row['type_expr']),
                'MALFORMED_REPORT', 'missing type')
    opaque = {r['name']: r for r in expected['reviewed_opaque_dependencies']}
    for row in closure.values():
        require(not row['unsafe'] and not row['partial'], 'UNSAFE_DEPENDENCY', row['name'])
        if row['kind'] == 'axiom':
            require(row['name'] in allowed, 'UNAPPROVED_AXIOM', row['name'])
        if row['kind'] == 'opaque':
            require(row['name'] in opaque and row == opaque[row['name']], 'UNEXPLAINED_OPAQUE', row['name'])
        require(set(row['direct_dependencies']) <= set(closure), 'INCOMPLETE_CLOSURE', row['name'])
    expected_rows = {r['observed']['name']:r['observed'] for r in expected['declarations']}
    require(set(expected_rows) <= set(declared), 'MISSING_DECLARATION', repr(sorted(set(expected_rows) - set(declared))))
    require(set(declared) <= set(expected_rows), 'UNEXPECTED_DECLARATION', repr(sorted(set(declared) - set(expected_rows))))
    for name, row in declared.items():
        require(row['type_expr'] == expected_rows[name]['type_expr'] and row['level_parameters'] == expected_rows[name]['level_parameters'],
                'TYPE_MISMATCH', name)
        require(row == expected_rows[name], 'DECLARATION_DRIFT', name)
        require(name in closure and row['module'] == closure[name]['module'] and row['kind'] == closure[name]['kind'],
                'INCOMPLETE_CLOSURE', name)
    require(len(closure) == expected['dependency_closure_count'] and
            digest(sorted(closure.values(), key=lambda r:r['name'])) == expected['dependency_closure_sha256'],
            'CLOSURE_DRIFT', 'reachable declaration graph differs')
    return {'status':'PASS', 'declarations':len(declared),
            'classification':{c:sum(r['classification']==c for r in expected['declarations']) for c in ['specified_theorem','generated_auxiliary_lemma','definition']},
            'dependency_constants':len(closure), 'axioms':sorted(set().union(*(set(r['axioms']) for r in declared.values()))),
            'reviewed_opaque_dependencies':sorted(opaque), 'unexpected_declarations':[]}

if __name__ == '__main__':
    try:
        expected = baseline(sys.argv[1])
        if len(sys.argv) == 4:
            verify_identity(parse(Path(sys.argv[3]).read_bytes()), expected)
        result = verify_report(parse(Path(sys.argv[2]).read_bytes()), expected)
        result['scope'] = 'identity-and-origin' if len(sys.argv)==4 else 'report-only (negative-control layer; not full source acceptance)'
        print(json.dumps(result, indent=2))
    except (Rejected, KeyError, TypeError, ValueError) as e:
        print(str(e) if isinstance(e,Rejected) else 'MALFORMED_REPORT: invalid input structure', file=sys.stderr)
        sys.exit(1)
