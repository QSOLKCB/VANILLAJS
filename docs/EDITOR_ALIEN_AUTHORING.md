# Alien Math in the editor

The editor's experimental authoring helpers compose the existing
[exact rational](ALIEN_MATH_001.md), [explicit Q16 conversion](ALIEN_MATH_002.md),
[closed interval / XY geometry](ALIEN_MATH_003.md) and [D4](ALIEN_MATH_004.md)
modules. They are demo code in `demos/editor/authoring-math.js`, with no new
arithmetic backend, runtime package, downloaded asset or executable mod format.

## Decimal positions and bounds

`parseExactPosition([x, y, z])` accepts three decimal **strings**, canonicalizes
them and checks every axis against the exact closed interval `[-1000, 1000]`
metres. The existing grammar permits an optional minus, 1–18 whole digits and
up to 18 fractional digits, with no exponent, leading plus, redundant leading
whole-part zeros or whitespace. Negative zero and trailing fractional zeros
normalize to their mathematical values. Missing axes and non-string values
are errors identifying the relevant axis.

The result is `{decimals, position, fractions}`. `decimals` contains canonical
exact spellings, `fractions` contains reduced rational text, and `position`
contains explicit JavaScript Number conversions for the existing scene model.
Bounds are checked **before** conversion: `1000.000000000000000001` is rejected
even though Number conversion would round it to `1000`.

Applying a position crosses the existing Number boundary. Scene and project
files continue storing numeric transforms; they do not retain arbitrary exact
decimal provenance. For example, authoring `0.100000000000000001` produces
Number `0.1` when applied. Displaying that stored value again cannot recover the
original decimal. The helper does not change scene schemas, components, asset
placements, playable exports, physics or replay.

`formatPositionNumber(value)` expands a stored Number's shortest exponent
spelling for Read selection: `1e-7` becomes `0.0000001`, and `1e-18` becomes
`0.000000000000000001`. Values requiring more than 18 decimal places, including
`1e-19`, fail with an explicit message instead of silently rounding. The user
can then deliberately enter a supported decimal. This formatting describes the
stored Number's shortest decimal spelling, not its full binary rational value.

## Q16.16 preview

`previewQ16Position(strings, {rounding, overflow})` requires both policies.
Rounding is `exact`, `toward-zero`, `floor`, `ceil`, `nearest-even` or
`nearest-away`; overflow is `reject` or explicitly selected `saturate`.
`exact` only permits `reject`. Invalid combinations are rejected, never
silently substituted.

The result is `{raw, decimals, errors}`. `raw` contains checked signed-int32
Q16.16 integers, `decimals` contains their exact decimal values, and `errors`
contains the exact signed rational difference **quantized minus input**.
For example, nearest-even/reject maps `0.1` to raw `6554`, decimal
`0.100006103515625`, with error `1/163840`. Exact/reject rejects `0.1`.

Preview accepts the full bounded decimal grammar, even outside the editor's
position interval, so an overflow can be inspected without applying it.
`40000` fails under reject and becomes raw `2147483647` under explicit
saturation. A failed axis reports its name and reason; preview never mutates
the scene and does not opt the scene into Q16 simulation.

## D4 local XY layout actions

`transformExactPositionXY(strings, operation)` accepts the eight existing D4
names and returns the same shape as `parseExactPosition`. It transforms only
the selected **position point** in local XY, about the parent origin (world
origin for a root); Z is unchanged. Units are metres, +Y is up, and `r` is a
counterclockwise quarter turn in XY when viewed from +Z.

| Action | XY result |
| --- | --- |
| `e` | `(x, y)` |
| `r` | `(-y, x)` |
| `r2` | `(-x, -y)` |
| `r3` | `(y, -x)` |
| `s` | `(x, -y)` |
| `rs` | `(y, x)` |
| `r2s` | `(-x, y)` |
| `r3s` | `(-y, -x)` |

The origin is a valid fixed point. Unknown actions and positions outside the
closed bounds fail. These actions do not rotate or reflect mesh geometry,
change yaw, transform an entire subtree as a rigid layout, or implement general
3D symmetry. Parent rotation/scale still obey the existing approximate scene
transform pipeline. No exact quaternion, collision or rendered-pixel claim is
made.

## Gizmo snapping

`snapEditorDelta(value, step)` supports the established `0.25` metre, `15`
degree and `0.1` scale increments, with finite movement bounded to
`[-10000, 10000]`. It interprets a pointer-derived Number's shortest decimal
spelling using ALIEN-MATH-001, rounds the exact quotient to the nearest grid
multiple, then explicitly converts the exact decimal result to Number.

Halfway ties go toward positive infinity, retaining the prior `Math.round`
policy: `0.15` snaps to `0.2`, and `-0.15` snaps to `-0.1` on the `0.1` grid.
This fixes binary-division boundary errors without an arbitrary epsilon.
Sub-half-step values, including subnormals, unambiguously snap to zero before
parsing; remaining values fit the bounded decimal grammar. Negative zero
normalizes to zero. Disabled snapping still uses the existing free transform.

Snapping happens during authoring, not in the simulation loop. Trigonometric
parent/local-axis conversion and the existing six-place transform rounding
remain approximate. Exact rational snapping is not advertised as a speedup.
The separate gizmo lookup change calculates the scene hierarchy once per
transform instead of twice for a child; any measured performance evidence
belongs to the PR's recorded checks, not an inferred claim here.

## Verification and limits

`tests/editor-authoring-math.test.js` covers malformed/sparse triples, decimal
bounds that floating conversion would hide, all Q16 policies, signed ties,
overflow and explicit saturation, all eight D4 signs, four-turn recovery,
unchanged Z, signed snap sweeps against an independent integer millistep
reference, subnormals and immutable scene transactions. Existing gizmo tests
cover parent transforms and projection/picking. Browser integration checks
must exercise the packaged UI and existing import/export/undo paths.

Relevant independent module references can be reproduced with:

```sh
python3 scripts/alien_math_001_oracle.py --check
python3 scripts/alien_math_002_oracle.py --check
python3 scripts/alien_math_003_oracle.py --check
python3 scripts/alien_math_004_oracle.py --check
node --test tests/editor-authoring-math.test.js tests/editor-gizmos.test.js
```

These finite checks do not establish universal ECMAScript source refinement,
cross-browser rendered equality, exact physical measurement or arbitrary 3D
geometry correctness. Existing authoritative integer math, proofs, archived
research evidence, source-pinned receipts and owner-dispatched runner policies
remain unchanged.
