#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Independent Fraction/matrix/Leibniz finite oracle; no Lean or JS execution."""
import argparse
from fractions import Fraction as F
from itertools import permutations
import hashlib
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
INPUT=ROOT/'tests/fixtures/alien-math-006-input.json'
OUTPUT=ROOT/'tests/fixtures/alien-math-006-oracle.json'
MATRICES=[(1,0,0,1),(0,-1,1,0),(-1,0,0,-1),(0,1,-1,0),(1,0,0,-1),(0,1,1,0),(-1,0,0,1),(0,-1,-1,0)]
EDGES=[(0,1),(0,2),(1,2)]

def matrix_product(a,b):return tuple(sum(a[2*i+k]*b[2*k+j] for k in range(2)) for i in range(2) for j in range(2))
def act(m,p):return (m[0]*p[0]+m[1]*p[1],m[2]*p[0]+m[3]*p[1])
def adjacency(mask,i,j):return int(i!=j and bool(mask&(1<<EDGES.index(tuple(sorted((i,j)))))))
def polynomial(mask):
    result=[0]*4
    for p in permutations(range(3)):
        sign=(-1)**sum(p[i]>p[j] for i in range(3) for j in range(i+1,3));poly=[sign]
        for i,j in enumerate(p):
            if i==j:poly=[0]+poly
            else:poly=[-adjacency(mask,i,j)*v for v in poly]
        for k,v in enumerate(poly):result[k]+=v
    return ','.join(map(str,reversed(result)))
def stream():
    spec=json.loads(INPUT.read_bytes());points=[tuple(map(F,p)) for p in spec['points']];values=[v for p in points for v in p];rows=[]
    def add(*row):rows.append('|'.join(map(str,row)))
    for i,a in enumerate(values):
        for j,b in enumerate(values):add('ARITH',i,j,a+b,a-b,a*b,a/b if b else 'reject-zero')
    for i,m in enumerate(MATRICES):
        for j,n in enumerate(MATRICES):add('D4',i,j,MATRICES.index(matrix_product(m,n)))
        for j,p0 in enumerate(points):
            p=act(m,p0);add('ACTION',i,j,*p)
            for k,q0 in enumerate(points):
                q=act(m,q0);add('DIST',i,j,k,sum((p[t]-q[t])**2 for t in range(2)))
                for l,t0 in enumerate(points):
                    t=act(m,t0);add('AREA',i,j,k,l,(q[0]-p[0])*(t[1]-p[1])-(q[1]-p[1])*(t[0]-p[0]))
    for mask in spec['graphMasks']:
        add('GRAPH3',mask,polynomial(mask))
        for i,p in enumerate(spec['pullbackPermutations']):
            transformed=sum(adjacency(mask,p[a],p[b])<<j for j,(a,b) in enumerate(EDGES))
            add('RELABEL3',mask,i,transformed,polynomial(transformed))
    return ('\n'.join(rows)+'\n').encode('ascii')
def build():
    raw=stream();return (json.dumps({'schema':'qsol.alien-math-006.finite.v1','inputSHA256':hashlib.sha256(INPUT.read_bytes()).hexdigest(),'observations':len(raw.splitlines()),'sha256':hashlib.sha256(raw).hexdigest()},sort_keys=True,indent=2)+'\n').encode('ascii')
if __name__=='__main__':
    parser=argparse.ArgumentParser();mode=parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--write',action='store_true');mode.add_argument('--check',action='store_true');mode.add_argument('--stream',action='store_true');args=parser.parse_args()
    if args.stream:print(stream().decode('ascii'),end='')
    else:
        result=build()
        if args.write:OUTPUT.write_bytes(result)
        elif OUTPUT.read_bytes()!=result:raise SystemExit('FAIL: ALIEN-MATH-006 oracle fixture mismatch')
        print('PASS: ALIEN-MATH-006 independent finite oracle '+hashlib.sha256(result).hexdigest())
