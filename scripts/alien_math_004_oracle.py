#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Independent D4 integer-matrix / Fraction oracle. Never executes JavaScript."""
import argparse
import hashlib
import json
from fractions import Fraction as F
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / 'tests/fixtures/alien-math-004-input.json'
OUTPUT = ROOT / 'tests/fixtures/alien-math-004-oracle.json'
NAMES = ['e', 'r', 'r2', 'r3', 's', 'rs', 'r2s', 'r3s']
# Explicit orthogonal matrices; composition is matrix multiplication, not the JS group formula.
MATRICES = [(1,0,0,1),(0,-1,1,0),(-1,0,0,-1),(0,1,-1,0),
            (1,0,0,-1),(0,1,1,0),(-1,0,0,1),(0,-1,-1,0)]


def multiply(a, b):
    return tuple(sum(a[2*i+k]*b[2*k+j] for k in range(2)) for i in range(2) for j in range(2))


def transform(m, p):
    return (m[0]*p[0]+m[1]*p[1], m[2]*p[0]+m[3]*p[1])


def orientation(a, b, c):
    t=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    return (t>0)-(t<0)


def on(p, a, b):
    return orientation(a,b,p)==0 and all(min(a[k],b[k])<=p[k]<=max(a[k],b[k]) for k in range(2))


def segment(a,b,c,d):
    # Independent parametric intersection; collinear cases use endpoint membership.
    u=(b[0]-a[0],b[1]-a[1]); v=(d[0]-c[0],d[1]-c[1]); w=(c[0]-a[0],c[1]-a[1])
    cross=lambda x,y:x[0]*y[1]-x[1]*y[0]
    det=cross(u,v)
    if det:
        t=cross(w,v)/det; s=cross(w,u)/det
        if 0<t<1 and 0<s<1:return 'cross'
        return 'touch' if 0<=t<=1 and 0<=s<=1 else 'disjoint'
    shared=set(p for p in (a,b,c,d) if on(p,a,b) and on(p,c,d))
    return 'overlap' if len(shared)>1 else 'touch' if shared else 'disjoint'


def bounds(a,b):
    return (min(a[0],b[0]),max(a[0],b[0]),min(a[1],b[1]),max(a[1],b[1]))


def contains(box,p):
    return box[0]<=p[0]<=box[1] and box[2]<=p[1]<=box[3]


def relation(a,b):
    sizes=[min(a[k+1],b[k+1])-max(a[k],b[k]) for k in (0,2)]
    return 'disjoint' if min(sizes)<0 else 'touch' if min(sizes)==0 else 'overlap'


def build():
    raw=INPUT.read_bytes(); spec=json.loads(raw)
    rows=[[F(v) for v in row] for row in spec['fixed']]
    state=spec['seed']
    def next_u32():
        nonlocal state
        state=(1664525*state+1013904223)&0xffffffff
        return state
    for _ in range(spec['generated']):
        rows.append([F(next_u32()%81-40,next_u32()%13+1) for _ in range(8)])
    digest=hashlib.sha256(); observations=0; maximum=(1<<256)-1
    for i,row in enumerate(rows):
        original=[tuple(row[j:j+2]) for j in range(0,8,2)]
        for name,m in zip(NAMES,MATRICES):
            a,b,c,d=[transform(m,p) for p in original]; box=bounds(a,b); other=bounds(c,d)
            distance=sum((a[k]-b[k])**2 for k in range(2))
            distance_text='overflow' if distance.numerator>maximum or distance.denominator>maximum else str(distance)
            values=[i,name,*(v for p in (a,b,c,d) for v in p),orientation(a,b,c),int(on(c,a,b)),
                    segment(a,b,c,d),relation(box,other),int(contains(box,c)),distance_text,*box]
            digest.update(('|'.join(map(str,values))+'\n').encode('ascii')); observations+=1
    result={'schema':'qsol.alien-math-004.matrix-fraction.v1','inputSHA256':hashlib.sha256(raw).hexdigest(),
            'observations':observations,'sha256':digest.hexdigest(),
            'cayley':[[NAMES[MATRICES.index(multiply(a,b))] for b in MATRICES] for a in MATRICES],
            'inverses':[NAMES[MATRICES.index((m[0],m[2],m[1],m[3]))] for m in MATRICES],
            'determinants':[m[0]*m[3]-m[1]*m[2] for m in MATRICES]}
    return (json.dumps(result,indent=2,sort_keys=True)+'\n').encode('ascii')


if __name__=='__main__':
    parser=argparse.ArgumentParser(); mode=parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--write',action='store_true'); mode.add_argument('--check',action='store_true')
    args=parser.parse_args(); result=build()
    if args.write:OUTPUT.write_bytes(result)
    elif OUTPUT.read_bytes()!=result:raise SystemExit('FAIL: ALIEN-MATH-004 oracle fixture mismatch')
    print('PASS: ALIEN-MATH-004 independent matrix/Fraction oracle '+hashlib.sha256(result).hexdigest())
