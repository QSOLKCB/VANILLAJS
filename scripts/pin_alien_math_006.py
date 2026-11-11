#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Explicit source inventory update. Does not run or certify any proof."""
import argparse
import json
from verify_alien_math_006 import ROOT,MANIFEST,BASE,LEAN_VERSION,LEAN_COMMIT,ALLOWED,THEOREMS,FILES,sha,verify_baseline,verify_pins
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--write',action='store_true',required=True);parser.parse_args()
    manifest={'schema':'qsol.alien-math-006.sources.v1','baseline':BASE,'leanVersion':LEAN_VERSION,'leanCommit':LEAN_COMMIT,
      'allowedAxioms':sorted(ALLOWED),'theorems':THEOREMS,'files':{p:sha((ROOT/p).read_bytes()) for p in FILES}}
    verify_baseline(ROOT,manifest);verify_pins(ROOT,manifest)
    (ROOT/MANIFEST).write_text(json.dumps(manifest,indent=2,sort_keys=True)+'\n')
    print('Source inventory written. Proof and conformance NOT RUN; review diff and execute verifier.')
