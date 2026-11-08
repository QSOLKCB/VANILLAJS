#!/usr/bin/env python3
"""Execute real Lean mutations and adversarial report/identity rejection tests."""
import copy
import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

source, evidence, work = [Path(p).resolve() for p in sys.argv[1:]]
tools = Path(__file__).resolve().parent
expected = tools.parent / 'expected-inventory.json'
target = tools.parent / '04-target'
base = json.loads((target / 'inventory.json').read_text())
identity = json.loads((target / 'identity.json').read_text())
records = []

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def rel(path, cwd):
    return os.path.relpath(path, cwd)

def run(label, argv, cwd, out):
    out.mkdir(parents=True, exist_ok=True)
    start = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with (out / (label + '.stdout')).open('xb') as stdout, (out / (label + '.stderr')).open('xb') as stderr:
        r = subprocess.run(argv, cwd=cwd, stdout=stdout, stderr=stderr,
                           env=dict(os.environ, PYTHONDONTWRITEBYTECODE='1'))
    receipt = {'command_argv':argv, 'exit_status':r.returncode,
        'started_utc':start, 'finished_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'cwd':('frozen-source-root' if cwd==source else 'isolated-mutation/' + cwd.name),
        'frozen_base_commit':identity['commit'],
        'environment_reference':'corrective/04-target/identity.json',
        'worktree_state':('unchanged-frozen-source' if cwd==source else 'deliberately mutated standalone fixture; not a production checkout'),
        'input_sha256':{p:sha(cwd/p) for p in ['Q16Formal.lean','lean-toolchain','lakefile.toml']},
        'stdout':label+'.stdout', 'stderr':label+'.stderr'}
    if (cwd/'lake-manifest.json').exists():
        receipt['lake_manifest']=json.loads((cwd/'lake-manifest.json').read_text())
    (out/(label+'.execution.json')).write_text(json.dumps(receipt,indent=2)+'\n')
    return r.returncode,(out/(label+'.stdout')).read_text(),(out/(label+'.stderr')).read_text()

def rejected(name, observed, expected_code):
    code, stdout, stderr = observed
    assert code == 1 and stderr.startswith(expected_code + ':'), (name,code,stderr)
    records.append({'case':name, 'expected_rejection':expected_code, 'actual_exit_status':code, 'status':'PASS'})
    print('PASS',name,'->',expected_code,flush=True)

original = (source/'Q16Formal.lean').read_text()
start = original.index('theorem zero_is_canonical')
end = original.index('/-- Signed int32 admits',start)
fixtures = {
    'removed-theorem':(original[:start]+original[end:], 'MISSING_DECLARATION'),
    'weakened-proposition':(original[:start]+'theorem zero_is_canonical (negative : Bool) : True := True.intro\n\n'+original[end:], 'TYPE_MISMATCH'),
    'unexpected-other-namespace':(original+'\nnamespace UnrelatedNamespace\ndef injectedData : Nat := 17\nend UnrelatedNamespace\n','UNEXPECTED_DECLARATION'),
    'opaque-unapproved-axiom':(original+'\naxiom Foreign.unapproved : Nat\nopaque Foreign.hidden : Nat := Foreign.unapproved\n','UNAPPROVED_AXIOM'),
    'opaque-sorry':(original+'\nopaque Foreign.hidden : Nat := by sorry\n','UNAPPROVED_AXIOM'),
    'unexplained-opaque':(original+'\nopaque Foreign.hidden : Nat := 0\n','UNEXPLAINED_OPAQUE')}

for name,(mutated,reason) in fixtures.items():
    cwd=work/name;cwd.mkdir(parents=True)
    out=evidence/name;out.mkdir(parents=True)
    (cwd/'Q16Formal.lean').write_text(mutated)
    (out/'Q16Formal.lean').write_text(mutated)
    for f in ['lean-toolchain','lakefile.toml']:
        shutil.copyfile(source/f,cwd/f)
    build=run('build',['lake','build','Q16Formal'],cwd,out)
    assert build[0]==0,(name,'fixture did not build',build)
    inventory=run('inventory',['lake','env','lean',rel(tools/'Inventory.lean',cwd)],cwd,out)
    assert inventory[0]==0,(name,'inventory did not execute',inventory)
    report=out/'inventory.stdout'
    rejected(name,run('verify',['python3',rel(tools/'verify.py',cwd),rel(expected,cwd),rel(report,cwd)],cwd,out),reason)
    if name in ['removed-theorem','weakened-proposition']:
        typed=run('typed-consumer',['lake','env','lean',rel(tools.parent.parent/'ExactStatements.lean',cwd)],cwd,out)
        assert typed[0]==1 and ('Unknown identifier' in typed[1] if name=='removed-theorem' else 'Type mismatch' in typed[1]),typed
        records.append({'case':name+'-typed-consumer','expected_rejection':'unknown identifier' if name=='removed-theorem' else 'type mismatch',
                        'actual_exit_status':typed[0],'status':'PASS'})
        print('PASS',name,'exact typed consumer rejected',flush=True)

def report_case(name, value, reason, raw=False, expected_path=expected, identity_value=None):
    cwd=work/'report-inputs';cwd.mkdir(exist_ok=True)
    inp=cwd/(name+'.json')
    inp.write_text(value if raw else json.dumps(value))
    argv=['python3',rel(tools/'verify.py',source),rel(expected_path,source),rel(inp,source)]
    if identity_value is not None:
        ip=cwd/(name+'.identity.json');ip.write_text(json.dumps(identity_value));argv.append(rel(ip,source))
    out=evidence/name
    rejected(name,run('verify',argv,source,out),reason)
    (out/'mutation.json').write_text(json.dumps({'case':name,'input_sha256':sha(inp),
        'recipe':'negative-controls.py report_case construction; canonical input is corrective/04-target/inventory.json',
        'expected_sha256':sha(expected_path),
        'identity_sha256':sha(ip) if identity_value is not None else None},indent=2)+'\n')

report_case('empty-report','', 'EMPTY_REPORT',raw=True)
report_case('truncated-report',json.dumps(base)[:-31], 'MALFORMED_REPORT',raw=True)
report_case('duplicate-json-key','{"schema":1,"schema":2}', 'MALFORMED_REPORT',raw=True)
v=copy.deepcopy(base);v['declarations'].append(v['declarations'][0]);report_case('duplicate-declaration',v,'DUPLICATE_DECLARATION')
v=copy.deepcopy(base);v['declarations'].pop();report_case('omitted-declaration',v,'MISSING_DECLARATION')
v=copy.deepcopy(base);del v['declarations'][0]['type_expr'];report_case('missing-type',v,'MALFORMED_REPORT')
v=copy.deepcopy(base);v['declarations'][0]['axioms']='propext';report_case('malformed-axioms',v,'MALFORMED_REPORT')
v=copy.deepcopy(base);v['declarations'][0]['axioms']=['propext','propext'];report_case('duplicate-axiom',v,'MALFORMED_REPORT')
v=copy.deepcopy(base);v['dependency_closure'].pop();report_case('omitted-dependency',v,'INCOMPLETE_CLOSURE')
v=copy.deepcopy(base);v['dependency_closure'].append(v['dependency_closure'][0]);report_case('duplicate-dependency',v,'DUPLICATE_DECLARATION')
v=copy.deepcopy(base)
next(r for r in v['declarations'] if r['name'].endswith('trial_product_lt_2pow47._proof_1_1'))['axioms'].append('sorryAx')
report_case('generated-lemma-sorryAx-report',v,'UNAPPROVED_AXIOM')

# Record an actually available alternate Lean banner; no fake version output.
version=run('alternate-version',['elan','run','leanprover/lean4:v4.33.1','lean','--version'],source,evidence/'alternate-toolchain')
assert version[0]==0 and '4.33.1' in version[1],version
v=copy.deepcopy(identity);v['lean_banner']=version[1].strip();report_case('effective-toolchain-mismatch',base,'TOOLCHAIN_MISMATCH',identity_value=v)
v=copy.deepcopy(identity);v['toolchain_pin']='leanprover/lean4:v4.33.1';report_case('configured-toolchain-mismatch',base,'TOOLCHAIN_MISMATCH',identity_value=v)
v=copy.deepcopy(identity);v['lean_binary_sha256']='0'*64;report_case('tool-binary-mismatch',base,'TOOLCHAIN_MISMATCH',identity_value=v)
parent=run('parent-commit',['git','rev-parse','HEAD^'],source,evidence/'alternate-commit')
assert parent[0]==0
v=copy.deepcopy(identity);v['commit']=parent[1].strip();report_case('frozen-commit-mismatch',base,'SOURCE_COMMIT_MISMATCH',identity_value=v)
v=copy.deepcopy(identity);v['production_blob']='0'*40;report_case('production-blob-mismatch',base,'SOURCE_CONTENT_MISMATCH',identity_value=v)
v=copy.deepcopy(identity);v['tracked_status']=' M Q16Formal.lean';report_case('dirty-source',base,'DIRTY_WORKTREE',identity_value=v)
v=copy.deepcopy(identity);v['source_modules'].append('nested/Unrelated.lean');report_case('unimported-nested-module',base,'UNEXPECTED_SOURCE_MODULE',identity_value=v)
v=copy.deepcopy(identity);v['packages']=[{'name':'unexpected'}];report_case('unexpected-dependency-package',base,'DEPENDENCY_MISMATCH',identity_value=v)
changed=work/'repinned-expected.json';changed.write_bytes(expected.read_bytes()+b'\n')
report_case('repinned-expected-inventory',base,'BASELINE_IDENTITY_MISMATCH',expected_path=changed)

(evidence/'RESULTS.json').write_text(json.dumps({'status':'PASS','controls':records,'count':len(records)},indent=2)+'\n')
print('PASS all',len(records),'negative controls; expected failures are preserved as nonzero command exits')
