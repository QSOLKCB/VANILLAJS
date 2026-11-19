# SPDX-License-Identifier: Apache-2.0
"""Admission/audit negative controls; no Lean invocation or proof claim here."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('alien006',ROOT/'scripts/verify_alien_math_006.py')
v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
class BoundaryTests(unittest.TestCase):
    def test_exact_hosted_budget_revision_preserves_frozen_workflow_and_all_gates(self):
        baseline=v.run(['git','show',v.BASE+':'+v.FLIGHT_WORKFLOW])
        current=(ROOT/v.FLIGHT_WORKFLOW).read_bytes()
        self.assertEqual(v.sha(baseline),v.FLIGHT_BASE_SHA256)
        self.assertTrue(v.verify_workflow_budget_revision(baseline,current))
        previous=current.replace(v.FLIGHT_NEW_BUDGET,v.FLIGHT_PREVIOUS_BUDGET,1)
        self.assertEqual(v.sha(previous),v.FLIGHT_PREVIOUS_SHA256)
        preparation=v.FLIGHT_BASELINE_PREPARATION
        node_step=b'      - run: node --test tests/*.test.js\n'
        cases={
            'different budget':current.replace(b'timeout-minutes: 45',b'timeout-minutes: 46',1),
            'old 35-minute budget':current.replace(v.FLIGHT_NEW_BUDGET,v.FLIGHT_PREVIOUS_BUDGET,1),
            'permission':current.replace(b'contents: read',b'contents: write',1),
            'verification bypass':current.replace(b'run: node scripts/check.js',b'run: true',1),
            'action source':current.replace(b'actions/checkout@11d5960a326750d5838078e36cf38b85af677262',b'actions/checkout@main',1),
            'production branch':current.replace(b"github.ref == 'refs/heads/main'",b'true',1),
            'duplicate budget':current+v.FLIGHT_NEW_BUDGET,
            'missing budget':current.replace(v.FLIGHT_NEW_BUDGET,b'',1),
            'missing historical fetch':current.replace(preparation,b'',1),
            'duplicate historical fetch':current+preparation,
            'wrong historical commit':current.replace(v.BASE.encode(),b'0'*40,1),
            'full history fetch':current.replace(b'--depth=1',b'--depth=0',1),
            'missing source admission':current.replace(b'python3 scripts/verify_alien_math_006.py --pins-only',b'true',1),
            'fetch after Node tests':current.replace(preparation,b'',1).replace(node_step,node_step+preparation,1),
            'unreviewed comment':current+b'\n# unreviewed\n',
        }
        for name,mutant in cases.items():
            with self.subTest(mutation=name):
                self.assertNotEqual(mutant,current,'negative control must actually change bytes')
                with self.assertRaises(ValueError):v.verify_workflow_budget_revision(baseline,mutant)
        with self.assertRaisesRegex(ValueError,'frozen workflow witness mismatch'):
            v.verify_workflow_budget_revision(baseline+b'\n',current)
        bad=v.load_manifest();bad['files']['modules/exact-rational/index.js']='0'*64
        with self.assertRaisesRegex(ValueError,'historical baseline drift: modules/exact-rational/index.js'):
            v.verify_baseline(ROOT,bad)
    def test_exact_fetch_restores_admission_without_unshallowing_checkout(self):
        baseline=v.run(['git','show',v.BASE+':'+v.FLIGHT_WORKFLOW])
        current=(ROOT/v.FLIGHT_WORKFLOW).read_bytes()
        self.assertEqual(v.sha(baseline),v.FLIGHT_BASE_SHA256)
        # Two tiny local commits reproduce checkout's depth-one object database.
        # The original workflow bytes retain their real independent source pin;
        # fixture commit IDs are local identities, never production attestations.
        with tempfile.TemporaryDirectory(prefix='alien006-shallow-') as folder:
            origin=Path(folder)/'origin';checkout=Path(folder)/'checkout'
            v.run(['git','-c','init.templateDir=','init','--initial-branch=main',origin])
            workflow=origin/v.FLIGHT_WORKFLOW
            workflow.parent.mkdir(parents=True)
            workflow.write_bytes(baseline)
            def commit(message):
                v.run(['git','add','--',v.FLIGHT_WORKFLOW],cwd=origin)
                v.run(['git','-c','user.name=Admission fixture','-c','user.email=fixture@example.invalid',
                       '-c','commit.gpgsign=false','commit','-m',message],cwd=origin)
                return v.run(['git','rev-parse','HEAD'],cwd=origin).decode().strip()
            historical=commit('Historical workflow fixture')
            self.assertEqual(v.run(['git','rev-parse',historical+':'+v.FLIGHT_WORKFLOW],cwd=origin).decode().strip(),
                             '544edab10a462991540b6192acf21b244e75bd42')
            workflow.write_bytes(current);head=commit('Current approved workflow fixture')
            v.run(['git','clone','--no-hardlinks','--no-tags','--depth=1','--single-branch',
                   '--branch','main',origin.as_uri(),checkout])
            self.assertEqual(v.run(['git','rev-parse','--is-shallow-repository'],cwd=checkout),b'true\n')
            with self.assertRaises(ValueError):
                v.run(['git','cat-file','-e',historical+'^{commit}'],cwd=checkout)
            with self.assertRaises(ValueError):
                v.run(['git','show',historical+':'+v.FLIGHT_WORKFLOW],cwd=checkout)
            wrong=v.run(['git','show',head+':'+v.FLIGHT_WORKFLOW],cwd=checkout)
            with self.assertRaisesRegex(ValueError,'frozen workflow witness mismatch'):
                v.verify_workflow_budget_revision(wrong,current)
            v.run(['git','fetch','--no-tags','--depth=1','origin',historical],cwd=checkout)
            fetched=v.run(['git','show',historical+':'+v.FLIGHT_WORKFLOW],cwd=checkout)
            self.assertEqual(fetched,baseline)
            self.assertEqual(v.sha(fetched),v.FLIGHT_BASE_SHA256)
            self.assertTrue(v.verify_workflow_budget_revision(fetched,current))
            with self.assertRaisesRegex(ValueError,'frozen workflow witness mismatch'):
                v.verify_workflow_budget_revision(fetched.replace(b'contents: read',b'contents: write',1),current)
            self.assertEqual(v.run(['git','rev-parse','HEAD'],cwd=checkout).decode().strip(),head)
            self.assertEqual(v.run(['git','rev-parse','--is-shallow-repository'],cwd=checkout),b'true\n')
            for revision in ['HEAD',historical]:
                self.assertEqual(v.run(['git','rev-list','--count',revision],cwd=checkout),b'1\n')
    def test_source_inventory_and_corruption(self):
        manifest=v.load_manifest();self.assertTrue(v.verify_pins(ROOT,manifest))
        for mutation in ['missing','digest','extra','baseline','axioms','theorems','tool']:
            bad=copy.deepcopy(manifest)
            if mutation=='missing':bad['files'].pop(v.FILES[0])
            elif mutation=='digest':bad['files'][v.FILES[0]]='0'*64
            elif mutation=='extra':bad['files']['unreviewed.js']='0'*64
            elif mutation=='baseline':bad['baseline']='0'*40
            elif mutation=='axioms':bad['allowedAxioms'].append('sorryAx')
            elif mutation=='theorems':bad['theorems']=bad['theorems'][:-1]
            else:bad['leanVersion']='0.0.0'
            with self.subTest(mutation=mutation),self.assertRaises(ValueError):v.verify_pins(ROOT,bad)
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(ValueError):v.verify_pins(Path(folder),manifest)
    def test_axiom_forgery_missing_duplicate_unknown(self):
        lines=[f"'AlienMath006.{name}' does not depend on any axioms" for name in v.THEOREMS];good='\n'.join(lines)
        self.assertEqual(len(v.parse_audit(good)),21)
        for bad in ['\n'.join(lines[:-1]),good+'\n'+lines[0],good.replace('does not depend on any axioms','depends on axioms: [sorryAx]',1),good.replace('does not depend on any axioms','depends on axioms: [alienEscape]',1),good+'\nPASS',good.replace('rational_add_comm','unknown',1)]:
            with self.assertRaises(ValueError):v.parse_audit(bad)
    def test_finite_outcome_requires_exact_bytes_and_count(self):
        raw=b'original\n';expected={'schema':'qsol.alien-math-006.finite.v1','sha256':v.sha(raw),'observations':1}
        v.verify_streams(expected,{'Lean':raw,'JS':raw,'Python':raw})
        for bad in [b'',b'changed\n',raw+raw]:
            with self.assertRaises(ValueError):v.verify_streams(expected,{'JS':bad})
        with self.assertRaises(ValueError):v.verify_streams({**expected,'observations':2},{'JS':raw})
if __name__=='__main__':unittest.main()
