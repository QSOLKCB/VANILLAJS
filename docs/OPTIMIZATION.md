# OPT adaptation — exact rendering reuse

Source: [QSOLKCB/OPT](https://github.com/QSOLKCB/OPT/tree/7556dd36acd53ed3ed538fd03b1db44e5c1ec869),
commit `7556dd36acd53ed3ed538fd03b1db44e5c1ec869`. This adaptation uses
OPT-INV-001 (invariant-driven reuse) and OPT-INC-001 (complete effective-input
signatures). OPT's Wonderbuild source note credits its historical GPL donor;
this is an original native-JavaScript implementation of the pattern, with no
donor code or dependency imported. OPT's Lean model does not prove this code.

## Problem contract, declared before measurement

| Field | Target contract |
| --- | --- |
| X | Fresh geometry versus two independently reused geometry groups; repeated GPU storage replacement versus retained capacity |
| F | Native ES modules/WebGL 1, bounded current-generation storage, exact geometry and draw output, existing public renderer calls |
| f / direction | Minimize geometry construction, uploads and GPU storage allocations; measure complete CPU preparation cost including signatures and cold construction |
| C | Same Float32 XYZ/RGB values, primitive order and live draw counts; unchanged simulation ticks, collision, puzzles, input, saves and visual detail |
| B | Two warm-up pairs and seven alternating measured pairs per fixed workload; separate native Chromium conformance and timing observations |
| S | Stop after those observations; retain only paths that pass exact parity and reduce deterministic repeated-work counts. Report timing regressions/limits explicitly; no noisy timing threshold in CI |

Classification: categorical local choices; deterministic work counts and noisy
latency; derivative-free observation; moderate evaluation cost; semantic and
resource constraints; sequential execution; exact, with no approximation.

The frozen v1.0.0 geometry function in `scripts/opt-render-reference.js` is the
independent forced-fresh reference. Tests compare every output value and simulate
the renderer's public draw contract through growth, shrink and empty updates.
The workload retains raw paired timings rather than importing OPT's historical
speedup numbers. GPU allocation counts are API calls, not measured driver memory
allocations. Node preparation times are not game frame rates or GPU timings.

## Reuse and invalidation boundaries

The Vault's two slots contain mechanisms and console glyphs. A synchronous call
copies every input used by each builder: positions, sizes, colours, part IDs,
latched words and active-console state. The signature is exact JSON of those
owned finite primitive snapshots with an explicit signed-zero marker, not a
lossy hash or a clock-only key. Non-finite inputs fail before publication. A tick,
camera movement or pending crank phase can differ while those inputs remain
equivalent. Each slot publishes its signature and frozen geometry only after a
successful build. Both slots commit together. A failed build leaves the previous
generation intact. There is no `await`, callback, shared memory, disk cache or
concurrent publisher in this boundary; JavaScript's synchronous execution binds
capture, build and publication to one invocation. These are demo-owned ordinary
model objects, not a general cache for proxies or concurrently mutable sources.

Only the current generation per group is retained. Returned arrays are frozen,
so a consumer cannot corrupt later hits. Restart/mesh recreation explicitly
clears the cache. Restore is covered by the complete captured inputs; A→B→A
rebuilds A after B. Any upload failure prevents the app from recording that group
as uploaded. Context loss stops the app and requires reload, as before.

Each renderer mesh retains GPU storage up to its largest uploaded byte length.
Growth allocates the exact required capacity; equal/smaller updates use
`bufferSubData`, and empty updates set the draw count to zero. Stale tails are
never drawn. `clearMeshes()`/`dispose()` release capacity. There is no global
buffer pool or unbounded historical cache. Uploads still copy caller values into
Float32 data, preserving the existing ownership/conversion semantics.

HUD writes compare the current DOM property before assigning it. This avoids
replacing unchanged text/attributes while allowing external DOM changes to be
corrected on the next update. UI rate, physics rate and camera rendering are
unchanged.

## Evidence and rollback

Local observations on Node v24.22.1, Linux x64, AMD EPYC 9V74 are preserved in
[`OPT_RENDER_LOCAL.json`](OPT_RENDER_LOCAL.json), including all seven samples per
path. Each trial includes 240 frames and its cold session/cache construction.
The renderer-call model includes Float32 conversion and counts submitted values;
it does not allocate real GPU memory.

| Workload | Fresh median ms | Reuse median ms | Uploaded values, fresh → reuse | Storage replacement calls, fresh → reuse |
| --- | ---: | ---: | ---: | ---: |
| Idle chamber | 365.10 | 8.48 | 7,093,440 → 29,556 | 480 → 4 |
| Opening gate then settled | 441.46 | 142.02 | 7,093,440 → 1,200,276 | 480 → 4 |
| Working console | 516.85 | 42.29 | 7,093,440 → 213,972 | 480 → 4 |
| Cycling lift, including landings | 457.94 | 98.89 | 7,093,440 → 803,532 | 480 → 4 |
| Moving lift + rapid XOR until tape cap | 441.22 | 564.07 | 7,093,440 → 4,511,616 | 480 → 4 |

The rapid-change stress case is **27.8% slower in this CPU preparation model**:
snapshot/signature/immutable-output work costs more when reuse opportunities are
scarce. Splitting the geometry also raises upload calls there (480 → 736), while
reducing their total size. This tradeoff is retained explicitly; the optimization
targets repeated static geometry and independent changes, and is not a universal
speedup. All five fixtures retain 118,224 bytes of modelled Float32 GPU capacity
on both paths, excluding driver overhead. The cache additionally retains one
current frozen JavaScript geometry generation per group; JavaScript heap/RSS and
driver memory were not measured. No old generations are retained by the cache.

Exact output hashes and work counts are CI gates for these five enumerated
fixtures. Timings are observations, not statistical performance gates. No
false-positive/negative rates or wider regression-detector claim are made.

Run `node scripts/opt-render-workload.js --check` for paired measurements and
exact output/work-count gates. CI preserves its JSON report with the packaged
Chromium evidence. The PR records the executed environment, observations and
artifact identity after verification. Other browsers, physical GPUs and devices
remain outside that measurement scope.

Any parity failure disables reuse: use the forced-fresh builder until the key or
lifetime rule is repaired. Missing geometry groups, changed colours, changed
words, reset/restore, cleared meshes, partial turns and allocation growth are
explicit regression cases. No physics/collision work, puzzle search, test case
or assertion is skipped to obtain a rendering result.
