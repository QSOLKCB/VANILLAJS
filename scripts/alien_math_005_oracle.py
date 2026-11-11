#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Independent determinant-polynomial oracle: subset expansion, no JS/Newton recurrence."""
import argparse
from collections import deque
from fractions import Fraction
import hashlib
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
INPUT=ROOT/'tests/fixtures/alien-math-005-input.json'
OUTPUT=ROOT/'tests/fixtures/alien-math-005-oracle.json'


def determinant_polynomial(n,edges):
    # Row-by-row Leibniz expansion, merging equal used-column subsets.
    # Polynomials are ascending degree. Sign counts earlier chosen columns > j.
    neighbors={tuple(sorted(e)) for e in edges}; states={0:[1]}
    for i in range(n):
        next_states={}
        for mask,poly in states.items():
            for j in range(n):
                if mask>>j&1:continue
                if i!=j and tuple(sorted((i,j))) not in neighbors:continue
                sign=-1 if (mask>>(j+1)).bit_count()%2 else 1
                contribution=([0]+poly) if i==j else [-x for x in poly]
                target=next_states.setdefault(mask|1<<j,[0]*(i+2))
                for k,value in enumerate(contribution):target[k]+=sign*value
        states=next_states
    return list(reversed(states.get((1<<n)-1,[1])))


def observe(n,edges):
    edges=sorted(sorted(e) for e in edges);adj=[[] for _ in range(n)]
    for a,b in edges:adj[a].append(b);adj[b].append(a)
    for row in adj:row.sort()
    def traverse(start,dfs=False):
        order=[];parent=[-1]*n;depth=[-1]*n
        # Stack of (vertex,parent,depth) entries emulates ascending recursive DFS.
        pending=deque([(start,-1,0)])
        while pending:
            v,p,d=pending.pop() if dfs else pending.popleft()
            if depth[v]!=-1:continue
            parent[v]=p;depth[v]=d;order.append(v)
            neighbors=reversed(adj[v]) if dfs else adj[v]
            for w in neighbors:
                if depth[w]==-1:pending.append((w,v,d+1))
        return {'order':order,'parent':parent,'depth':depth}
    components=[];seen=set()
    for v in range(n):
        if v not in seen:
            component=sorted(traverse(v)['order']);components.append(component);seen.update(component)
    # Counts of walks from each starting vertex: independent per-source recurrence.
    walks=[0]*9
    for start in range(n):
        counts=[int(i==start) for i in range(n)];walks[0]+=1
        for k in range(1,9):
            counts=[sum(counts[j] for j in row) for row in adj];walks[k]+=counts[start]
    triangles=sum(1 for i in range(n) for j in range(i+1,n) for k in range(j+1,n) if j in adj[i] and k in adj[i] and k in adj[j])
    return {'n':n,'edges':edges,'polynomial':list(map(str,determinant_polynomial(n,edges))),
            'walks':list(map(str,walks)),'degrees':sorted(map(len,adj)),'components':components,
            'triangles':str(triangles),'density':str(Fraction(2*len(edges),n*(n-1))) if n>1 else '0',
            'bfs':traverse(0) if n else None,'dfs':traverse(0,True) if n else None}


def build():
    raw=INPUT.read_bytes();spec=json.loads(raw);rows=list(spec['fixed'])
    for n in range(5):
        pairs=[(i,j) for i in range(n) for j in range(i+1,n)]
        for mask in range(1<<len(pairs)):rows.append({'n':n,'edges':[e for bit,e in enumerate(pairs) if mask>>bit&1]})
    state=spec['seed']
    def next_u32():
        nonlocal state
        state=(1664525*state+1013904223)&0xffffffff;return state
    for _ in range(spec['generated']):
        n=next_u32()%8;rows.append({'n':n,'edges':[(i,j) for i in range(n) for j in range(i+1,n) if next_u32()%3==0]})
    digest=hashlib.sha256()
    for row in rows:digest.update((json.dumps(observe(row['n'],row['edges']),separators=(',',':'))+'\n').encode('ascii'))
    result={'schema':'qsol.alien-math-005.subset-determinant.v1','inputSHA256':hashlib.sha256(raw).hexdigest(),'cases':len(rows),'sha256':digest.hexdigest()}
    return (json.dumps(result,indent=2,sort_keys=True)+'\n').encode('ascii')


if __name__=='__main__':
    parser=argparse.ArgumentParser();mode=parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--write',action='store_true');mode.add_argument('--check',action='store_true')
    args=parser.parse_args();result=build()
    if args.write:OUTPUT.write_bytes(result)
    elif OUTPUT.read_bytes()!=result:raise SystemExit('FAIL: ALIEN-MATH-005 oracle fixture mismatch')
    print('PASS: ALIEN-MATH-005 independent determinant oracle '+hashlib.sha256(result).hexdigest())
