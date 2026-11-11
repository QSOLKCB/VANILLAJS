# ALIEN-MATH-003 — Exact closed intervals and XY geometry predicates

**Status:** Experimental, opt-in, authoring-time mathematics. The phase builds on ALIEN-MATH-001's bounded BigInt rationals and does not alter ALIEN-MATH-002's explicit rational-to-Q16.16 conversion boundary. No simulation, renderer, replay, proofs, release tags, or RTX receipts are modified.

## Public API

| Module / API | Contract |
| --- | --- |
| **modules/exact-interval/index.js** — ExactInterval(lower, upper) | Immutable **closed** interval with genuine rational endpoints and lower ≤ upper; rejects reversed bounds and missing/forged rationals |
| **ExactInterval.contains(value)** | Inclusive exact endpoint membership |
| **ExactInterval.relate(other)** | Exactly a_below_b, b_below_a, or overlap; **touching is overlap** |
| **ExactInterval.intersect(other)** | New closed interval, singleton on touching, or null when disjoint |
| **modules/exact-geometry/index.js** — ExactPoint2(x,y), point2(x,y) | Immutable XY point holding genuine exact rational coordinates |
| **orientation2(a,b,c)** | Directed sign of (b-a) × (c-a) in the XY plane; +1 counterclockwise (+Z), 0 collinear, -1 clockwise |
| **pointOnSegment(p,a,b)** | Inclusive membership on a closed segment; zero-length segments are points |
| **segmentRelation(a,b,c,d)** | disjoint, touch (one shared point), cross (proper interior crossing), overlap (positive-length collinear intersection) |
| **ExactBox2(xInterval,yInterval)** | Immutable closed axis-aligned XY box, with inclusive contains(point) |
| **boxFromCorners(a,b)** | Normalizes unordered corners into exact closed intervals |
| **boxRelation(a,b)** | disjoint, touch (zero-area intersection), overlap (positive-area intersection) |

The interval module imports **only exact-rational**; the geometry module imports **only exact-rational and exact-interval**. Neither has third-party dependencies, a clock, a random source, browser globals, a float tolerance, a WebGL adapter, or an implicit Q16 conversion.

Example (ES module):

    import {ExactRational as R} from './modules/exact-rational/index.js';
    import {ExactInterval} from './modules/exact-interval/index.js';
    import {point2, orientation2, segmentRelation, boxFromCorners,
      boxRelation} from './modules/exact-geometry/index.js';

    const x = n => new R(BigInt(n));
    const a = new ExactInterval(x(1), x(2));
    const b = new ExactInterval(x(2), x(4));
    a.relate(b);                 // 'overlap'
    a.intersect(b).toString();  // '[2,2]'

    const p = (xv,yv) => point2(x(xv), x(yv));
    orientation2(p(0,0), p(2,0), p(0,2));           // +1
    segmentRelation(p(0,0),p(2,2),p(0,2),p(2,0));  // 'cross'
    boxRelation(boxFromCorners(p(0,0),p(2,2)),
      boxFromCorners(p(2,1),p(3,3)));              // 'touch'

## Numerical and trust boundaries

Coordinates and interval endpoints must be genuine ALIEN-MATH-001 ExactRational instances, which already have a 256-bit component cap. Constructors and predicate boundaries authenticate objects through the **original private-field-backed accessors**, not merely their prototype or untrusted public properties. Forged objects, Proxy wrappers, malicious shadow getters, missing inputs and inverted intervals are rejected. Interval/point/box wrappers have private fields, are frozen, and reject subclass construction.

The orientation predicate evaluates BigInt numerator/denominator cross-products directly, without prematurely constructing an intermediate 256-bit rational. Intermediate determinant widths remain bounded by the finite coordinate input domain (up to a few thousand bits); no floating rounding or saturation is applied. Only the final sign or classification is an ordinary small integer/string.

Degenerate segments and zero-area boxes are valid mathematical objects. A contained point/line box gives **touch** because intersection area is zero, even when there is no ordinary boundary-only contact. Closed interval endpoint contact yields **overlap** and a singleton intersection. The apparent naming difference is deliberate: interval overlap refers to *any* nonempty intersection; box overlap specifically requires *positive area*.

Mathematical exactness concerns the **represented rational inputs**, not physical measurement accuracy, source data, model calibration, or GPU-rendered pixels. This phase does **not** implement arbitrary polygon clipping, 3D collision, 2D intersection coordinates, E8/D4 transforms, spectral algorithms, or per-frame gameplay integration.

## Independent evidence and commands

The Node suite at **tests/exact-geometry.test.js** checks malformed/forged instances, 256-bit determinant extremes, inclusive interval and segment boundaries, positive-area rectangle semantics, 4,000 seeded metamorphic orientation/segment checks, and runtime import isolation.

The separate Python standard-library oracle at **scripts/alien_math_003_oracle.py** uses CPython fractions.Fraction to calculate 18 fixed and 2,048 deterministic seeded examples — **2,066 independent cases**. The frozen **tests/fixtures/alien-math-003-oracle.json** contains the SHA-256 of a canonical ASCII stream of ordered inputs and independent interval/segment/box outcomes, plus category counts. Node reproduces that stream from production modules and compares digest and counts. Python does not import or execute any JavaScript.

Oracle digest:

    76958814ad6be0ccee62cdf5eed21ad55ceb2a853114a66f7463fd81ee038982

From repository root:

    node --test tests/exact-geometry.test.js
    uv run --no-project python scripts/alien_math_003_oracle.py --check
    node --test tests/*.test.js
    node scripts/check.js
    node scripts/build.js

The Python **--check** command regenerates expected data in memory and refuses a byte mismatch. **--write** is explicit fixture regeneration, never a test fallback. The executed finite tests are not a proof of universal ECMAScript source refinement. Hosted PR CI is a separate verification gate. The owner-only personal RTX runner must not execute unmerged code.

## Attribution and immutability

Original Apache-2.0 JavaScript, **not** a copy or port of SONIFICATION MPL-2.0 source. Research context and methods:

1. Slade, T. (2026). *SONIFICATION-SPECTRA-001: Traversal Modes, Graph Spectra and D4 Covariant Preservation.* https://doi.org/10.5281/zenodo.24060930
2. Slade, T. (2026). *MAT-SPEC-010: Final Evidence Freeze and Reproducible Archive of the MAT-SPEC-001–010 Materials Sonification Research Programme.* https://doi.org/10.5281/zenodo.24062652
3. Slade, T. (2026). *SONIFICATION-FORMAL-001: Source-Pinned Formal Verification and Independent Audit Evidence — Research Milestone 1.* https://doi.org/10.5281/zenodo.24097287

Existing contracts remain in **docs/ALIEN_MATH_001.md**, **docs/ALIEN_MATH_002.md**, **docs/QFLOAT_001.md**, and **modules/integer-math/index.js**. No existing arithmetic, proof, evidence, workflow, tag or release files are changed.
