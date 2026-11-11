# ALIEN-MATH-005 — Graph traversal and exact spectral laboratory

**Experimental, opt-in authoring mathematics.** Native ECMAScript modules,
BigInt exact integers, the existing ExactRational density, and a Python stdlib
oracle. No runtime NPM dependencies or replacement of the integer simulation.

## Graph contract and admission

`modules/exact-graph/index.js` exports `MAX_VERTICES=16` and
`new ExactGraph(vertexCount, edges)`. Vertices are the integer labels 0..n−1,
0≤n≤16. An edge is an unordered pair of distinct primitive integer Number IDs.
No self loops, duplicate/reversed-duplicate edges, weights, directed edges or
multiple edges. At most n(n−1)/2 edges (120 at the cap). Invalid types throw
TypeError; invalid integer ranges, loops and duplicates throw RangeError. There
is no coercion. Sparse edge/permutation arrays are rejected.

The graph copies, sorts and deeply freezes edge pairs and adjacency rows. Its
read-only getters are `vertexCount`, `edges` and `adjacency`. Private fields,
non-subclassable construction and captured original accessors reject forged
instances and Proxy wrappers at operation boundaries. Input arrays are plain
value data: hostile getter/Proxy side effects, foreign realms and prior tampering
with intrinsics are outside this contract. Caller mutation of ordinary input
arrays cannot change the graph. There is no network, randomness, ambient clock,
DOM, float tolerance or hidden conversion in the core module.

## Deterministic operations

| API | Exact result and convention |
| --- | --- |
| `breadthFirst(g,start)` | Frozen `{order,parent,depth}`; ascending-neighbor BFS, shortest unweighted distances |
| `depthFirst(g,start)` | Same shape; ascending-neighbor recursive preorder, DFS tree depths (not shortest distances) |
| `connectedComponents(g)` | Frozen arrays, each component sorted ascending, components ordered by least vertex |
| `relabelGraph(g,permutation)` | New graph; permutation[old ID]=new ID, must be a complete bijection |
| `graphInvariants(g)` | Frozen `{vertices,edges,degreeSequence,components,triangles,density}`; sorted degrees, BigInt triangles, ExactRational density |
| `characteristicPolynomial(g)` | Frozen BigInt coefficients `[1,c1,…,cn]` of det(λI−A), descending powers |
| `closedWalkCounts(g,steps)` | Frozen BigInt array trace(A^k), k=0..steps, 0≤steps≤16 |

Traversal visits only the start component. Parent of the root is −1; unreachable
vertices have parent and depth −1. Start must be an admitted vertex: traversal
of the empty graph rejects. The empty graph has no components, zero density,
polynomial `[1n]`, and zero closed walks including trace(I₀). Density is
2m/(n(n−1)) for n≥2, zero otherwise. Each undirected triangle is counted once.
Walk counts count based directed walks, not distinct cycles: trace(A²)=2m and
trace(A³)=6×triangles. All returned finite Number counts/labels are exact small
integers; polynomial/walk arithmetic is BigInt.

Relabeling preserves sorted degrees, component count, triangles, density,
characteristic polynomial and closed-walk counts. BFS distances correspond under
the permutation and mapped start. Label-tiebroken traversal order, parents and
DFS depths need **not** map equivariantly. A 3×3 grid test uses the actual
ALIEN-MATH-004 rational point actions to derive all eight D4 permutations,
checks their composition and exact edge automorphisms, and checks invariants of
an asymmetric graph under the same relabelings.

## Exact polynomial algorithm and resource bounds

A is the 0/1 symmetric adjacency matrix with zero diagonal. Production uses the
Faddeev–LeVerrier recurrence: B₀=I; for k=1..n, C=A Bₖ₋₁,
cₖ=−trace(C)/k, Bₖ=C+cₖ I. Every division checks a zero remainder; a violation
throws instead of truncating. Coefficients are exact integers, never rounded
roots or sampled spectra. No eigensolver or eigenvalue approximation is supplied.

Graph/traversal storage is O(n²), bounded by n≤16; recursion depth ≤16.
Characteristic work is O(n⁴), at most 16 bounded matrix multiplications. A
conservative arithmetic bound follows directly from the implementation: if B
entries are bounded by M, products have magnitude ≤16M, trace ≤256M and the
updated entries ≤272M<512M. Starting from 1, after 16 stages magnitudes are
<2^144; a 145-bit bound covers signed magnitudes and intermediate additions.
Walk counts with at most 16 steps are bounded by 16^17=2^68. These are resource
bounds, not constant-time or speedup claims. Rational density uses components
≤240, far below the existing 256-bit cap. There is no general unbounded matrix
or weighted rational eigensolver API.

Exact polynomials are spectral invariants, **not complete isomorphism tests**.
K₁,₄ and C₄ plus an isolated vertex both have λ⁵−4λ³, but differ in degree
sequence and connectedness. The tests and lab explicitly demonstrate this
counterexample. A finite graph's adjacency spectrum is not a measured physical
material spectrum. No physical accuracy, E8 correspondence or source-level
formal refinement is claimed.

## How to use the module

```js
import {ExactGraph, breadthFirst, graphInvariants,
  characteristicPolynomial} from './modules/exact-graph/index.js';
const graph = new ExactGraph(3, [[0,1], [1,2]]);
breadthFirst(graph, 0).order;                 // [0,1,2]
graphInvariants(graph).density.toString();   // '2/3'
characteristicPolynomial(graph);             // [1n,0n,-2n,0n]
```

## Standalone lab

Open `demos/graph-lab/index.html` through an HTTP server (or its built copy in
`dist`). From the repository root:

```sh
node scripts/build.js
uv run --no-project python -m http.server 8080 --directory dist
```

Visit `http://localhost:8080/demos/graph-lab/index.html`. Choose a graph, BFS or
DFS and a start vertex. **Next vertex** reveals one traversal step; **Reset
traversal** clears progress. **Reverse vertex labels** changes the labels and
mapped start while preserving exact invariants. Empty and disconnected graphs
are supported explicitly. Choose the two cospectral presets to compare equal
polynomials with different connectedness.

The D4 selector transforms exact rational drawing coordinates before their
bounded integer values are converted to canvas pixels. It does not relabel graph
IDs or change edges. Pixels are illustrative, not exact geometric measurements.
The core D4-induced graph permutations are separately tested as described above.
Canvas failure leaves the textual calculations and controls operational. Controls
are native keyboard-accessible elements; traversal state has an aria-live status.
The page is responsive to 320px width. There is no animation loop: calculations
and drawing run only on user actions. No approximate spectral values are displayed.

## Independent fixtures and verification

`scripts/alien_math_005_oracle.py` never imports or executes JavaScript. Its
characteristic polynomial is computed by row-by-row Leibniz determinant expansion
using a subset dynamic programme over used columns and explicit polynomial
coefficients, **not** the production trace/division recurrence. Python integer
arithmetic is exact; `fractions.Fraction` independently computes density. Walks
are counted separately per source vertex. Queue/stack traversals independently
check the deterministic traversal contract.

The frozen input contains seven fixed graphs (including empty-edge, path and
complete graphs of sizes 8 and 16, plus the grid), a 32-bit LCG seed and 128
generated graphs up to seven vertices. Both implementations also enumerate every
labelled simple graph on 0..4 vertices (76 cases). Total: **211 graph cases**.
The oracle's subset algorithm uses at most 2^16 subsets, solely in development/CI.
Tests additionally check all 24 permutations of every four-vertex graph (1,536
relabelings), including mapped BFS distances.

Frozen input SHA-256: `1af74b8cf95716d1f8236944265855cc5724d6a6067640bd5d06014a23ea324c`.
Oracle fixture SHA-256: `1f11b52be6fea27a3432719f516dbe219582b9534b59e56d066513725e1558fc`.
Observation-stream SHA-256: `a076b469cad502f85eec86bd96a74cd7b17eab2a177ead10b5e37989315f432b`.

Its ordered canonical JSON-lines digest includes input edges, all polynomial
coefficients, walks 0..8, degrees, components, triangles, density and BFS/DFS
results. Node reconstructs that stream from production APIs and additionally
checks reverse-label invariance for every case. Maximal graph tests independently
evaluate p(A)=0 via dense Horner multiplication (Cayley–Hamilton correspondence).

```sh
node --test tests/exact-graph.test.js
uv run --no-project python scripts/alien_math_005_oracle.py --check
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
```

Use Node 22 (as in hosted CI) and Python 3.10+ for these tools.

`--check` regenerates in memory and rejects any fixture byte mismatch. `--write`
is explicit reviewed fixture regeneration, never a verification fallback. The
workflow always runs the new independent oracle; it is never replaced by a reused
browser PASS. The research suite now includes real packaged Graph Lab checks.
Its closure audit includes the new lab, graph module and newly consumed D4 module;
contract, oracle, tests and domain fixture identities bind applicable witnesses.

## Preservation and unresolved obligations

This is original Apache-2.0 code. Existing ALIEN-MATH-001–004 implementations,
Q16/QFLOAT simulation, replay, Lean/SPARK proofs, historical receipts, release tags
and research archives remain unchanged. Tests establish finite conformance, not
formal ECMAScript refinement. No owner-only GPU or self-hosted workflow is invoked.
Phase 006 formal correspondence and the final research freeze require explicit
owner authorization after this PR is merged; neither is implemented here.
