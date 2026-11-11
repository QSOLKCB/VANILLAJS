# ALIEN-MATH-004 — Exact D4 symmetry

**Experimental, opt-in authoring mathematics.** Newly authored Apache-2.0 code,
using native ECMAScript modules and BigInt. No external runtime dependency. This
phase builds on ALIEN-MATH-001/003 without changing their semantics or the explicit
ALIEN-MATH-002 Q16 boundary. The authoritative integer simulation remains unchanged.

## Representation and group contract

`modules/exact-d4/index.js` exports the frozen `D4_ELEMENTS` array in this order:
`e, r, r2, r3, s, rs, r2s, r3s`. Elements are exactly these primitive strings;
unknown names, boxed strings, numbers and coercible objects throw TypeError.

- `r(x,y)=(-y,x)`: a quarter-turn counterclockwise in XY, viewed from +Z.
- `s(x,y)=(x,-y)`: reflection across the X axis.
- `r^k s^f`: reflection first if f=1, then k quarter-turns; all actions fix the origin.
- `composeD4(a,b)` applies **b first, then a**, returning a canonical element.
  For a=(k,f), b=(l,h), the result is ((k+(-1)^f l) mod 4, f XOR h).
- `inverseD4(g)` returns the two-sided inverse; every reflection is self-inverse.
- `determinantD4(g)` is +1 for rotations, -1 for reflections.

The identities are r^4=e, s^2=e, srs=r^-1. This is D4 of order eight, not the
alternative notation where D4 means a four-element group. No general symbolic
algebra, arbitrary-angle rotation, affine translation or 3D symmetry is exposed.
The small group indices use exact bounded integer Number operations (0–7);
coordinate arithmetic uses BigInt, with no approximate trigonometry or epsilon.

## Geometry API

| Function | Contract |
| --- | --- |
| `transformPoint2(g,p)` | New frozen ALIEN-MATH-003 ExactPoint2, by coordinate permutation/sign change |
| `transformBox2(g,box)` | New normalized closed ExactBox2; transforms opposite corners and reorders bounds |
| `squaredDistance2(a,b)` | ExactRational for (ax-bx)^2+(ay-by)^2 when the reduced result fits the existing cap; otherwise RangeError |

Points and boxes must be genuine instances from the existing modules. Captured
original private-field accessors authenticate them; forged prototypes, shadow
getters and Proxy wrappers are rejected. Inputs remain immutable. Hostile Proxy
side effects, cross-realm acceptance and prototype tampering before module import
are outside the plain-value domain, as in the existing authoring contracts.

Actions are total for admitted points/boxes: sign changes and permutations cannot
increase a rational component's magnitude. D4 maps AABBs exactly to AABBs; this
opposite-corner construction is **not** a general rotated bounding-box algorithm.
Degenerate point/line boxes and zero-length segments remain valid.

For every admitted common action g:

- orientation(g a,g b,g c) = determinant(g) × orientation(a,b,c), with collinear 0
  returned as canonical zero, not a new directed orientation.
- Closed point-on-segment membership and all segmentRelation classes are preserved.
- Closed box containment and boxRelation classes (disjoint/touch/positive-area
  overlap) are preserved, including the existing zero-area touch convention.
- Squared distance is invariant; both transformed and original calls have the
  same reduced value or both reject for exceeding the output bound.

These are mathematical contracts supported by finite executed tests and the
independent oracle below, not a claim of formal ECMAScript refinement.

## Resource and numerical bounds

Each coordinate is an ALIEN-MATH-001 canonical rational with numerator magnitude
and positive denominator at most 2^256-1. Distance is computed with bounded wide
intermediates **before** reduction/admission, avoiding premature overflow from a
representable final result. Each coordinate difference has at most a 513-bit
numerator and 512-bit denominator. The final unreduced nonnegative numerator is
at most 2051 bits and denominator at most 2048 bits. Euclidean gcd reduces that
pair; the resulting ExactRational constructor enforces the original 256-bit cap.
Zero reduces to 0/1. No saturation, wrapping or rounding occurs.

D4 operations have constant element/coordinate counts; gcd is finite on these
bounded integers. This is a resource bound, not a constant-time or performance
claim. Square roots and irrational distances are not supplied. Exactness applies
to represented inputs, not physical accuracy or GPU-rendered coordinates.

## How to use

From the repository root, save this as an ES module or run with Node's module mode:

```js
import {ExactRational as R} from './modules/exact-rational/index.js';
import {point2, boxFromCorners} from './modules/exact-geometry/index.js';
import {composeD4, inverseD4, transformPoint2, transformBox2,
  squaredDistance2} from './modules/exact-d4/index.js';

const p = point2(new R(2), new R(3));
const g = composeD4('r', 's'); // 'rs': reflect, then rotate
const moved = transformPoint2(g, p); // (3,2)
transformPoint2(inverseD4(g), moved).toString(); // '(2,3)'
squaredDistance2(p, moved).toString(); // '2'
const box = boxFromCorners(point2(new R(0), new R(0)), p);
transformBox2('r', box); // x in [-3,0], y in [0,2]
```

Use this for authoring checks or offline transformations. There is no implicit
conversion or per-frame integration. Explicit Q16 conversion remains the separate
`rational-q16` adapter with its existing rounding/overflow policies.

## Independent evidence and reproduction

`tests/exact-d4.test.js` executes all 64 products, 512 associativity triples,
identity/inverse/determinant laws, noncommutativity, named coordinate actions,
composition/action agreement, hostile input rejection and 256-bit extremes.

`scripts/alien_math_004_oracle.py` uses explicit 2×2 integer matrices, matrix
multiplication/transposition and CPython `fractions.Fraction`; it never imports
or executes JavaScript. Its parametric segment-intersection calculation differs
from the production orientation-based classifier. The frozen input file specifies
16 fixed cases (including degenerate/contact/overflow cases), a seed and 1,024
LCG-generated rational quadruples. Every case receives all eight actions: **8,320
observations**. Node independently generates these inputs and uses production
functions to match the frozen Cayley table, inverse/determinant arrays and digest.

Frozen input SHA-256: `338db435363f81b7cdf7d6b20c98dc8df008729f8f71b6d719a7f1a89a5418d1`.
Oracle fixture file SHA-256: `2ff7b7c00270d309b4b9a62d6d50ee03cddf73989f9b38e4d71b792c58121f4d`.
Observation-stream SHA-256: `0fefc30ea6252a6e3c516877eae8783248cf183fa853aa4da1f4c654f7ab38c2`.

Each canonical ASCII observation is `|`-separated and LF-terminated: case index,
element, eight transformed coordinate strings, orientation, on-segment 0/1,
segment relation, box relation, containment 0/1, distance or `overflow`, followed
by the first transformed box's x-low/x-high/y-low/y-high. Rational strings are
reduced, with denominator 1 omitted. Fixture metadata binds the exact input bytes.

```sh
node --test tests/exact-d4.test.js
uv run --no-project python scripts/alien_math_004_oracle.py --check
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
```

`--check` regenerates in memory and rejects a byte mismatch; `--write` is explicit
fixture regeneration only, never a fallback during tests. Hosted CI runs the new
oracle on every applicable run, independently of browser witness reuse. The
browser closure policy binds this module's contract, tests, oracle and fixture
identity where its bytes affect a suite, including full-package worker consumers.
The module has no current browser executable consumer; no audit hash is added to
pretend otherwise. A future consuming import requires a reviewed closure update.

## Nonclaims and preservation

No ALIEN-MATH-001–003 implementation, QFLOAT/Q16 arithmetic, replay, existing
Lean/SPARK proof, archived hardware/proof receipt or immutable release is changed.
No physical GPU test or owner-only workflow is required or dispatched. Source
refinement, general graph spectra, E8 correspondence and phase-006 formal proofs
remain OPEN. Graph/spectral phase 005 requires explicit owner authorization after
this PR merges. No external licensed source was copied into this implementation.
