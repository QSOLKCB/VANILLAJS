# HORIZON-004 shader reuse experiment

These are new development observations from Chromium 158.0.8127.18 with ANGLE
SwiftShader and Node v22.18.0. They are source-tree isolation experiments, not
packaged acceptance, physical GPU measurements or a CI reuse receipt. The
untouched comparison is commit `f263d43627970d8c3cfb2d54eed8fdeed2e7c457`.

Both scripts rendered the same Scenery Atelier hero view at a 992×838 CSS
viewport, using its original project, camera and material parameters. Each case
took 22 real-clock draw/readback samples, discarded four warmups and reported the
median and p95 of the remaining 18. The readback synchronizes one native pixel;
the result includes submission and software rendering. Runs were sequential,
with no other agent running Chromium. Timing variation is expected.

## Shader versus geometry isolation

[The first result](initial-isolation.json) compares each shader/geometry pair.
The candidate geometry had already received its second visual/detail pass; its
SHA-256 is recorded in the result. Every case draws the same 25 mesh batches.

| Source pair | High median (ms) | Low median (ms) |
| --- | --- | --- |
| Baseline shader and geometry | 29.6 | 12.5 |
| Candidate shader, baseline geometry | 51.7 | 26.0 |
| Baseline shader, candidate geometry | 34.5 | 17.4 |
| Candidate shader and geometry | 51.1 | 24.1 |

The new shader accounts for much of the observed cost. This result motivated
sharing the four noise corners' repeated lattice-coordinate calculations.

## Exact corner reuse

[The second result](shader-cost-isolation.json) keeps candidate geometry fixed.
`current` is the scalar continuous-noise shader before the optimization. `vector`
computes the same four corner hashes using shared axis coordinates. The two
diagnostic variants deliberately change appearance to locate cost; neither was
adopted. Their results are not acceptance substitutes.

| Shader variant | High median (ms) | Low median (ms) |
| --- | --- | --- |
| Baseline shader | 29.8 | 17.0 |
| Candidate scalar noise | 52.4 | 28.6 |
| Candidate vectorized noise | 52.6 | 20.2 |
| Noise removed, diagnostic only | 31.2 | 13.5 |
| Old lighting, diagnostic only | 37.8 | 24.2 |

Scalar and vector variants produced identical complete native RGBA buffer hashes
at both profiles. The high-profile run did not show a timing improvement; the
low-profile run did. This single observation is not a universal speed claim.
The adopted shader preserves the vector variant's operations, with an explanatory
comment added. No texture, program, uniform, mesh or draw allocation was added.

The persistent check in `scripts/browser-render-lit.js` compiles the actual shader
and a scalar-reference variant, replacing only `softNoise`. It asserts exact
native pixel parity over grass, asphalt and stone, positive/negative/wrapping UVs
and both profiles. Deliberately changing one corner must fail parity. The focused
source-tree run passed, including all existing lighting, retention, admission and
native context-loss checks; see [the execution log](native-renderer.log). Parent
milestone evidence separately records packaged execution.

## Source records

[The first script](initial-isolation.mjs) and
[the second script](shader-cost-isolation.mjs) are the exact disposable scripts
executed. Their absolute local paths record that environment; reproduction on
another machine requires substituting the checkout, installed Playwright and
Chromium paths, then choosing a new output directory. Neither installs tooling
nor modifies repository source. They serve only a loopback HTTP fixture.

Shader and geometry snapshots are stored as `.js.txt` to distinguish reference
data from runtime modules. [SHA-256 inventory](sha256.json) identifies the scripts,
results, snapshots and execution log. Earlier HORIZON evidence is unchanged.
