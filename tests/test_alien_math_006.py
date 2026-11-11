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
