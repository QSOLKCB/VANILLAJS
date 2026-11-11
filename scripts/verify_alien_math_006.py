#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Source-pinned Lean audit plus finite conformance. Never claims JS refinement."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

ROOT=Path(__file__).resolve().parents[1]
BASE='ce7e38eb3c7412407a3ba2bc472120b589e6eb9e'
FORMAL='formal/alien-math-006/'
MANIFEST=FORMAL+'manifest.json'
LEAN_VERSION='4.35.0'
LEAN_COMMIT='eb6cafb7290e8bd5f2937522d8d804f58f02bafc'
ALLOWED={'propext','Classical.choice','Quot.sound'}
THEOREMS=['rational_add_comm','rational_add_assoc','rational_mul_comm','rational_distributive',
 'normalization_certificate','q16_floor_certificate','q16_exact_magnitude','interval_reflection',
 'd4_left_identity','d4_right_identity','d4_associative','d4_inverse','d4_action_compose','d4_distance','d4_area',
 'relabel_symmetry','relabel_no_loops','relabel_compose','relabel_inverse','graph3_determinant','graph3_spectral_relabel']
BASELINE_FILES=['AGENTS.md','lean-toolchain','lakefile.toml','Q16Formal.lean','Q16Audit.lean','Q16ECMA.lean','Q16ECMAAudit.lean',
 *['modules/'+name+'/index.js' for name in ['exact-rational','rational-q16','exact-interval','exact-geometry','exact-d4','exact-graph','integer-math']],
 *[f'docs/ALIEN_MATH_00{i}.md' for i in range(1,6)],'docs/QFLOAT_001.md',
 *[f'scripts/alien_math_00{i}_oracle.py' for i in range(1,6)],
 *['tests/'+s+'.test.js' for s in ['exact-rational','rational-q16','exact-geometry','exact-d4','exact-graph']],
 '.github/workflows/q16-formal.yml','.github/workflows/flight-lab.yml','scripts/verify-q16-proof-boundary.py','scripts/verify-q16-axioms.py','formal/context/q16-project.json',
 'tests/fixtures/alien-math-001-vectors.json',
 *[f'tests/fixtures/alien-math-00{i}-oracle.json' for i in range(2,6)],
 *[f'tests/fixtures/alien-math-00{i}-input.json' for i in [4,5]],'scripts/install-q16-lean.sh']
NEW_FILES=[FORMAL+n+'.lean' for n in ['AlienMath006','Audit','Bridge']]+[
 'scripts/verify_alien_math_006.py','scripts/pin_alien_math_006.py','scripts/alien_math_006_oracle.py','scripts/alien-math-006-bridge.mjs',
 'tests/test_alien_math_006.py','tests/alien-math-006.test.js',
 'tests/fixtures/alien-math-006-input.json','tests/fixtures/alien-math-006-oracle.json',
 'docs/ALIEN_MATH_006.md','.github/workflows/alien-math-formal.yml','scripts/browser-reuse-policy.json']
FILES=sorted(BASELINE_FILES+NEW_FILES)
def sha(raw):return hashlib.sha256(raw).hexdigest()
def run(args,cwd=ROOT,env=None):
    p=subprocess.run(list(map(str,args)),cwd=cwd,env=env,capture_output=True,timeout=180)
    if p.returncode:raise ValueError('command failed: '+' '.join(map(str,args))+'\n'+p.stdout.decode(errors='replace')+p.stderr.decode(errors='replace'))
    return p.stdout

def load_manifest(root=ROOT):return json.loads((root/MANIFEST).read_bytes())
def verify_pins(root,manifest):
    if set(manifest)!={'schema','baseline','leanVersion','leanCommit','allowedAxioms','theorems','files'}:raise ValueError('manifest schema fields mismatch')
    if manifest['schema']!='qsol.alien-math-006.sources.v1' or manifest['baseline']!=BASE:raise ValueError('manifest identity mismatch')
    if manifest['leanVersion']!=LEAN_VERSION or manifest['leanCommit']!=LEAN_COMMIT:raise ValueError('toolchain identity mismatch')
    if manifest['allowedAxioms']!=sorted(ALLOWED) or manifest['theorems']!=THEOREMS:raise ValueError('proof policy mismatch')
    if sorted(manifest['files'])!=FILES:raise ValueError('source inventory mismatch')
    for path in FILES:
        target=root/path
        if target.is_symlink() or not target.is_file():raise ValueError('missing/nonregular input: '+path)
        if sha(target.read_bytes())!=manifest['files'][path]:raise ValueError('source digest mismatch: '+path)
    proof=(root/(FORMAL+'AlienMath006.lean')).read_text()
    clean=re.sub(r'/\-.*?\-/|--[^\n]*','',proof,flags=re.S)
    if re.search(r'\b(sorry|admit|axiom|unsafe|native_decide|run_elab|initialize)\b|#',clean):raise ValueError('unchecked proof escape')
    if re.findall(r'\btheorem\s+(\w+)',clean)!=THEOREMS:raise ValueError('theorem inventory drift')
    if re.findall(r'^import (.+)$',clean,re.M)!=['Lean','Init.Data.Rat.Lemmas']:raise ValueError('unapproved model import')
    return True

def verify_baseline(root,manifest):
    for path in BASELINE_FILES:
        raw=run(['git','show',BASE+':'+path],cwd=root)
        if sha(raw)!=manifest['files'][path]:raise ValueError('historical baseline drift: '+path)

def parse_audit(text):
    pattern=re.compile(r"^'AlienMath006\.(\w+)' (?:does not depend on any axioms|depends on axioms: \[([^\]]*)\])$")
    seen={}
    for line in text.splitlines():
        if not line.strip():continue
        m=pattern.fullmatch(line)
        if not m:raise ValueError('unexpected Lean audit output: '+line)
        name,raw=m.groups();axioms=set(raw.split(', ')) if raw else set()
        if name not in THEOREMS or name in seen or not axioms<=ALLOWED:raise ValueError('unapproved/duplicate axiom record: '+line)
        seen[name]=sorted(axioms)
    if list(seen)!=THEOREMS:raise ValueError('incomplete theorem audit')
    return seen

def lean_run(lean,model,audit,bridge):
    # A fresh build directory prevents stale local .olean reuse.
    with tempfile.TemporaryDirectory(prefix='alien006-lean-') as raw:
        temp=Path(raw)
        for name,text in [('AlienMath006',model),('Audit',audit),('Bridge',bridge)]:
            (temp/(name+'.lean')).write_text(text)
        env=dict(os.environ,LEAN_PATH=str(temp))
        run([lean,'-o','AlienMath006.olean','AlienMath006.lean'],cwd=temp,env=env)
        report=run([lean,'Audit.lean'],cwd=temp,env=env).decode()
        axioms=parse_audit(report)
        stream=run([lean,'--run','Bridge.lean'],cwd=temp,env=env)
        return axioms,stream

def verify_streams(expected,streams):
    if expected['schema']!='qsol.alien-math-006.finite.v1':raise ValueError('fixture schema mismatch')
    for name,raw in streams.items():
        if sha(raw)!=expected['sha256'] or len(raw.splitlines())!=expected['observations']:raise ValueError(name+' finite bridge mismatch')
    if len(set(streams.values()))!=1:raise ValueError('bridge byte mismatch')

def negative_controls(lean,model,audit,bridge,expected):
    # Bypass the outer hash gate deliberately: exercise the compiler, typed audit
    # and transitive axiom check themselves, not only easy digest rejection.
    mutants={
      'removed theorem':model.replace('theorem d4_left_identity','theorem removed_identity',1),
      'weakened proposition':re.sub(r'theorem d4_left_identity[\s\S]*?(?=\ntheorem d4_right_identity)', 'theorem d4_left_identity : True := by trivial\n',model,count=1),
      'unapproved axiom':model.replace('theorem rational_add_comm','axiom alienEscape : False\n\ntheorem rational_add_comm',1).replace('  intros; grind','  exact False.elim alienEscape',1),
      'opaque proof hole':model.replace('  intros; grind','  sorry',1),
      'wrong graph coefficient':model.replace('-2*bit g.ab*bit g.ac*bit g.bc','-3*bit g.ab*bit g.ac*bit g.bc',1),
    }
    results=[]
    for name,mutant in mutants.items():
        if mutant==model:raise ValueError('mutation did not apply: '+name)
        try:lean_run(lean,mutant,audit,bridge)
        except ValueError:results.append(name)
        else:raise ValueError('negative control escaped: '+name)
    # Valid group representation with reversed r/r3 convention. Theorems survive;
    # finite source correspondence must still refuse it.
    start=model.index('def act ');end=model.index('\ndef determinant',start)
    action=model[start:end].replace('| .r =>','| .tmp =>').replace('| .r3 =>','| .r =>').replace('| .tmp =>','| .r3 =>')
    action=action.replace('| .rs =>','| .tmp =>').replace('| .r3s =>','| .rs =>').replace('| .tmp =>','| .r3s =>')
    _,wrong=lean_run(lean,model[:start]+action+model[end:],audit,bridge)
    try:verify_streams(expected,{'wrong-convention Lean':wrong})
    except ValueError:results.append('valid model, wrong source convention')
    else:raise ValueError('source-convention negative control escaped')
    return results

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--pins-only',action='store_true');parser.add_argument('--lean',default='lean');parser.add_argument('--negative-controls',action='store_true');parser.add_argument('--output');args=parser.parse_args()
    manifest_raw=(ROOT/MANIFEST).read_bytes();manifest=json.loads(manifest_raw)
    verify_pins(ROOT,manifest);verify_baseline(ROOT,manifest)
    if args.pins_only:
        print('SOURCE PINS ONLY verified; Lean proof and conformance NOT RUN');return
    if sys.version_info<(3,10):raise ValueError('Python 3.10+ required')
    node=run(['node','--version']).decode().strip()
    if not node.startswith('v22.'):raise ValueError('Node 22 required')
    launcher=shutil.which(args.lean)
    if not launcher:raise ValueError('pinned Lean unavailable; proof NOT RUN')
    # Resolve elan in the checkout, then use the real compiler in every temporary
    # directory. Otherwise a different default toolchain could be selected there.
    prefix=run([launcher,'--print-prefix']).decode().strip()
    lean=str((Path(prefix)/'bin/lean').resolve())
    version=run([lean,'--version']).decode().strip()
    if 'version '+LEAN_VERSION+',' not in version or LEAN_COMMIT not in version:raise ValueError('pinned Lean identity mismatch')
    texts=[(ROOT/(FORMAL+name+'.lean')).read_text() for name in ['AlienMath006','Audit','Bridge']]
    axioms,lean_stream=lean_run(lean,*texts)
    run([sys.executable,'scripts/alien_math_006_oracle.py','--check'])
    expected=json.loads((ROOT/'tests/fixtures/alien-math-006-oracle.json').read_bytes())
    if expected['inputSHA256']!=sha((ROOT/'tests/fixtures/alien-math-006-input.json').read_bytes()):raise ValueError('fixture domain mismatch')
    streams={'Lean':lean_stream,'JavaScript':run(['node','scripts/alien-math-006-bridge.mjs']),'Python':run([sys.executable,'scripts/alien_math_006_oracle.py','--stream'])}
    verify_streams(expected,streams)
    negatives=negative_controls(lean,*texts,expected) if args.negative_controls else []
    # Detect source changes during the run. This is not protection against a hostile host.
    verify_pins(ROOT,manifest)
    if (ROOT/MANIFEST).read_bytes()!=manifest_raw:raise ValueError('manifest changed during verification')
    report={'schema':'qsol.alien-math-006.observation.v1','claims':['LEAN_MODEL_THEOREMS','FINITE_SOURCE_CONFORMANCE'],'javascriptRefinement':'OPEN',
      'gitCommit':run(['git','rev-parse','HEAD']).decode().strip(),'baseline':BASE,'manifestSHA256':sha(manifest_raw),
      'lean':version,'leanLauncherSHA256':sha(Path(launcher).resolve().read_bytes()),'leanCompilerSHA256':sha(Path(lean).read_bytes()),'node':node,'python':sys.version.split()[0],
      'theorems':axioms,'observations':expected['observations'],'streamSHA256':expected['sha256'],'negativeControls':negatives}
    text=json.dumps(report,indent=2,sort_keys=True)+'\n'
    if args.output:Path(args.output).write_text(text)
    print(text,end='')

if __name__=='__main__':
    try:main()
    except (ValueError,OSError,subprocess.TimeoutExpired) as e:raise SystemExit('FAIL / NOT VERIFIED: '+str(e))
