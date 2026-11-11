#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Independent Python stdlib Fraction oracle for cardinal Q16 sweep admission.
Reference representation is exact rational; does not execute JavaScript code.
"""
import json
import sys
from fractions import Fraction

def crossing(case):
    gate=case["gate"]
    frm=case["from"]
    to=case["to"]
    axis=0 if gate["axis"]=="x" else 2
    side=2 if axis==0 else 0
    direction=gate["direction"]
    before=direction*(gate["planeRaw"]-frm[axis])
    travel=direction*(to[axis]-frm[axis])
    if before<=0 or travel<before:
        return False
    parameter=Fraction(before,travel)
    lateral=Fraction(frm[side])+parameter*(to[side]-frm[side])
    height=Fraction(frm[1])+parameter*(to[1]-frm[1])
    return (gate["sideRaw"]-gate["halfWidthRaw"]<=lateral<=
            gate["sideRaw"]+gate["halfWidthRaw"] and
            gate["bottomRaw"]<=height<=gate["topRaw"])

def main():
    data=json.load(sys.stdin)
    assert set(data)=={"scenarios"} and len(data["scenarios"])==1024
    out={"kind":"qsol.mod-sdk-002.fraction-oracle.v1",
         "matches":[crossing(x) for x in data["scenarios"]]}
    print(json.dumps(out,sort_keys=True,separators=(",",":")))

if __name__=="__main__":
    main()
