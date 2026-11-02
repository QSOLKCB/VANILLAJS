# ARCH-OMI-001 — 16-bit words, four faces and XOR

**v0.8.0 research experiment. Credit: Brian Thorne's ARCH OMI.**

Open `demos/omi-lab/index.html` through the same static server as the other labs.
The experiment combines a pinned OMI delta law with a deliberately explicit
VANILLAJS encoding of four nibble-valued tetrahedral vertices. It is registered
under `experiments` in `MODULES.json`, separate from the eleven game modules and
fourteen game recipes. It does not replace navigation, physics or game state.

The v0.9.0 [Brass Engine](BRASS_ENGINE.md) adds a second demonstration of this
same rule: a fictional mechanical instrument with eight staged detents, a
reversible counter and exact partial-position replay. The kernel and source
interpretation below are unchanged.

## Reference boundaries

| Reference | Pinned source | Used here |
| --- | --- | --- |
| OMI core specification, section 6 | [omi-portal at 5d2ebac](https://github.com/bthornemail/omi-portal/blob/5d2ebac312a8d44413af2a67ca9061e66594d9c8/docs/03-network/omi-core-spec.md#6-delta-law-evaluator) | Rotate/XOR delta rule and constant `0x5A3C`; return-after-eight and inversion hypotheses |
| Omicron implementation | [omicron-kernel.js at the same commit](https://github.com/bthornemail/omi-portal/blob/5d2ebac312a8d44413af2a67ca9061e66594d9c8/src/omi/omicron-kernel.js) | Reference for the stated mathematical rule |
| OMINO tetrahedral note | [omi-canon at b63fcf4](https://github.com/bthornemail/omi-canon/blob/b63fcf4286a9630bd9a641625d3103453c9687d5/Untitled.md) | FS/GS/RS/US vertex names, opposite faces and incidence relationships |

The OMINO note discusses **six edge-activation bits**. This experiment instead
assigns **four-bit values to vertices** and derives **six four-bit edge differences**.
That packing, the edge-value interpretation, UI and experiment harness are our
choices. They are not presented as Brian's canonical wire format or as an
implementation of the full OMI protocol. No donor source files, proofs, assets,
runtime libraries or prose passages are imported. The kernel is independently
implemented from the mathematical rules, with attribution retained here and in
`NOTICE`.

## Exact encoding

A word is an integer in `0..65535`. Four nibbles hold sixteen possible values each:
`16⁴ = 65,536`. The atlas places the high byte on the row and the low byte on the
column, producing 256 × 256 pixels. This display is not an RTS grid or a spatial
metric.

| Vertex | Word bits | Face opposite this vertex | Face edge indices |
| --- | --- | --- | --- |
| FS / 0 | 15–12 | GS, RS, US | 3, 4, 5 |
| GS / 1 | 11–8 | FS, RS, US | 1, 2, 5 |
| RS / 2 | 7–4 | FS, GS, US | 0, 2, 4 |
| US / 3 | 3–0 | FS, GS, RS | 0, 1, 3 |

Edge order is FS–GS, FS–RS, FS–US, GS–RS, GS–US, RS–US.
For vertices `a,b`, the derived edge is `a XOR b`. XOR of the three edges around
any triangular face is zero because every endpoint occurs twice.

Example: word `0x1234` gives vertices `[1,2,3,4]`, edge values `[3,2,5,1,6,7]`
and four zero residuals. This identity is also exhaustively checked on every word.

Two different operations act on the packed word:

- **Delta:** `Δ(x) = (rotl16(x,1) XOR rotl16(x,3) XOR rotr16(x,2) XOR 0x5A3C) & 0xFFFF`.
  The constant is fixed for this experiment. Rotation wraps inside the sixteen
  bits. This is a permutation of the entire word space.
- **Mask:** `x XOR mask`, where the mask is another sixteen-bit word. Applying the
  same mask twice restores the input. With mask `0x5A3C`, this is the source's
  central inversion. It is not the delta transform. Arbitrary mask operations
  can jump between delta cycles; orbit periods describe repeated delta only.

## Executed exhaustive result

[`OMI_EVIDENCE.json`](OMI_EVIDENCE.json) records the runtime, source pins, census,
independent oracle comparison and transition-table hash. All 65,536 inputs match
an arithmetic oracle that extracts each input bit using division/modulo and
builds output parity without shifts or bitwise XOR. A separate traversal of that
oracle's transition table enumerates cycles.

| Minimal period | States | Distinct cycles | Example word |
| ---: | ---: | ---: | --- |
| 1 | 8 | 8 | `0x1477` |
| 2 | 56 | 28 | `0x0063` |
| 4 | 4,032 | 1,008 | `0x0005` |
| 8 | 61,440 | 7,680 | `0x1234` |

**Every word returns after eight delta steps. Not every word has minimal period
eight.** The pinned specification's equation `Δ⁸(x)=x` holds over this domain;
its stronger prose interpretation of an exact period of eight for every starting
word is contradicted by 4,096 words. One counterexample is the fixed word
`0x1477`: one delta step already returns it. `0x0005` is the first shorter-period
word in ascending input order, and has period four. No source formula was changed
to force the stronger claim to pass.

Other executed checks:

- 65,536 distinct delta outputs; every input round-trips through packing.
- 65,536 successful double inversions with mask `0x5A3C`.
- 262,144 zero face residuals across all words.
- 4,096 distinct edge patterns, each shared by exactly sixteen words.
- Each of the 24 single-edge/bit fault choices on `0x1234` changes exactly the two
  incident face residuals. A coordinated change to all edges incident to one
  vertex still closes; the test explicitly demonstrates this limitation.

The transition hash is SHA-256 over 131,072 bytes: all 65,536 delta outputs in
ascending input order, encoded as unsigned **little-endian** sixteen-bit values:

`a0bb32b98090680604ff561e02db2d576194b767bd75bef7284a3d3877fa7c1a`

This is an executed finite-domain result, not a proof certificate from a theorem
prover, a randomness test, a cryptographic primitive or a performance benchmark.

## Controls and lifecycle

- **Load word**, bit buttons and atlas selection choose a state and pause.
  Hex input accepts one to four digits with an optional `0x` prefix. Invalid
  edits preserve the current word, counters and running state.
- **Δ step** advances once. **Apply XOR** uses the entered mask. **Common nibble
  XOR F** flips all nibbles; the edge differences remain unchanged.
- Select a face to highlight its edges. **Flip one observed edge bit** alters
  only the displayed FS–GS edge; it does not corrupt the stored word. The fault
  persists across word changes until cleared or reset.
- **Run experiment** advances delta twice per simulation second and enumerates
  256 input states per 120 Hz fixed tick. Construction allocates fixed-size arrays
  synchronously; enumeration is sliced by state count, not milliseconds. Counts
  are explicitly partial until all 65,536 words have been processed.
- Pause, Escape, blur and hidden tabs freeze the census and animation; held
  shortcut repeats cannot change the word. Reset cancels a partial census and
  restores `0x1234`, mask `0x5A3C`, face FS and all counters.
- Focus the atlas: arrows change the selected word by ±1/±256, Space steps delta,
  and X applies the mask. Mouse/touch selection uses a completed click/tap; a drag,
  cancelled gesture or late release after focus loss does not select a word.
- Canvas failure leaves the numerical census, controls and SVG relation diagram
  available with an explicit atlas-unavailable message.

## Experimental API

Import from `experiments/arch-omi/index.js`. This entry is a research surface,
independently versioned by the monorepo commit; it has no DOM, clock, randomness
or module dependencies. Inputs are strict integers; strings, fractions, nonfinite
numbers, sparse arrays and out-of-range values throw. No truncation/coercion is
used at the public boundary.

| Export | Contract |
| --- | --- |
| `OMICRON` | Fixed constant `0x5A3C` |
| `VERTICES`, `EDGES`, `FACES` | Deep-frozen names, endpoint pairs and face edge indices in the order above |
| `packState(values)` | Four ordinary array entries in `0..15` → one word; input is not retained |
| `unpackState(word)` | Fresh array of four high-to-low nibbles |
| `xor16(word, mask)` | Strict sixteen-bit XOR; both arguments required |
| `delta16(word)` | One pinned delta step with the fixed constant |
| `tetrahedron(word)` | Fresh `{vertices, edges, residuals}` arrays |
| `faceResiduals(edges)` | Six observed nibbles → four face residuals; useful for deliberate fault experiments |
| `orbit16(word, maxSteps=8)` | Budget `1..65536`; returns `{status, states, period, next}`. `closed` has the minimal period and excludes the repeated closing word; `budget` has `period:null` and must not be interpreted as a cycle |

The demo owns its incremental `OmiSurvey`, animation, selection, formatting and
fault display. Core game modules cannot import this experiment; the contract
checker continues to allow only core-to-core dependencies for those modules.

## Reproduce and interpret

```sh
node --test tests/omi.test.js tests/omi-lab.test.js
node scripts/verify-omi.js --check
```

The second command recomputes all results and compares every report field except
the runtime version with the committed record. CI saves its actual runtime and
report beside screenshots. Browser scenarios exercise the complete census,
exact word vectors, periods, faults, mask invariance, keyboard/pointer/touch
interaction, pause/focus/reset, graphics failure and narrow layout. Execution
results for the PR commit are recorded in its description after the run.

The six derived nibbles occupy 24 bits if stored directly; they are redundant,
not compression. Applying a common nibble mask leaves all edge differences
unchanged, so an anchor is required to recover absolute vertex values. Closure is
a consistency relation and cannot authenticate data or detect every change.
The most immediate game uses to explore are compact deterministic puzzle states,
reversible switches and visual relation debugging. This PR does not establish
benefits for pathfinding, collision, networking, RNGs or real-time performance.
