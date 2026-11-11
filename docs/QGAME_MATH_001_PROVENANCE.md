# QGAME-MATH-001 source research

These observations are from GitHub connector reads at the exact revisions below.
No donor build, proof or test was executed in this research task. Referenced
test thresholds are inspected contracts, not new reproduced measurements.
[The source inventory](../research/qgame-math-001/source-inspection.json) lists inspected files and returned Git blob identities.
No donor implementation or data file was copied to VANILLAJS.

## QEC-ADA

Repository: https://github.com/QSOLKCB/QEC-ADA
Commit: `ec166893f0e5d415cf84b3d192754f61a33da874`

- `LICENSE`, `NOTICE`: MPL-2.0. Inspected Ada kernels, proof models and tests
  carry MPL-2.0 SPDX headers. Retaining those notices would be required if
  files were adapted; no such adaptation is proposed.
- `codes/qec_gf3.ads` and `codes/qec_gf3.adb`: exact modular Trit domain 0..2,
  addition, multiplication, additive inverse, vector dot product. The dot
  product requires matching array bounds. `decode/qec_decode.ads` exposes
  a single parity-check row and explicitly disclaims a full quantum decoder.
- `codes/qec_qutrit.{ads,adb}`: a bounded fixed cyclic [[5,1,3]]_3 code,
  represented by two five-trit Pauli label vectors X/Z, not complex amplitudes.
  The syndrome is Hx*z-Hz*x modulo 3. Scalar evaluation is compared with
  immutable precomputed per-site contributions. Coset leaders are selected
  deterministically from identity then increasing support and local label
  order. Residual success is stabilizer membership, not merely zero syndrome.
- `codes/qec_configurable.ads`: at most five sites/four checks, canonical
  zero padding, independent/noncommuting generator and bounded ambiguity
  rejection, and a private prepared model binding caches to the code definition.
- `tests/test_qutrit_native.py`: Python-standard-library mathematical reference
  reconstructs generators independently; contracts cover 81 syndrome labels,
  40 weight-one errors, all 3^10 = 59049 scalar/optimized inputs, malformed
  inputs and repeatability. Tests requiring a compiled Ada binary can skip.
- `spark/README.md`, `spark/qec_field_proofs.{ads,adb}`: standalone bounded
  integer specification for field identities and one-site symplectic arithmetic.
  This is not proof of the decoder, row reduction, cache binding, JavaScript,
  routing, quantum hardware or physical qutrit dynamics. Merely seeing SPARK
  annotations or compiling the sources is not an executed proof receipt.
- The latest `tests/test_phase1i.py` concerns a separate GF(2) CSS Pauli study;
  do not conflate its binary decoder with the native GF(3) kernel.

Independent implementation ideas: textbook modulo-three arithmetic, bounded
vectors/matrices, syndrome Hx, invertible affine maps, exhaustive small-domain
enumeration, detached immutable snapshots and explicit ambiguity/failure paths.
No decoder matrices, Pauli machinery or source code are needed for the game lab.

## SONIFICATION

Repository: https://github.com/QSOLKCB/SONIFICATION
Commit: `2ca65c6540d7051a77ed571b83f5a9df453094ec`

- `LICENSE`, `NOTICE`, `pyproject.toml`: MPL-2.0. The JS ETQ/D4 and material
  files explicitly carry MPL notices. The Python music package is covered by
  the root licence and package metadata even where individual headers are absent.
- `src/etq-model.mjs`: doubled integer E8-root coordinates allow exact norm
  and adjacency decisions; the selected D4/triality structure and ternary MIDI
  layout are explicit constructions. These are not evidence for E8 in nature.
- `src/etq-v3-core.mjs`: a finite exact event protocol with explicit sequence,
  site and fibre identity. Its 303 tensor states are not 303 distinct E8 roots.
  It defines no waveform, hertz, wall time or physical measurement.
- `src/etq-v3-receivers.mjs`: JSON, CSV, graph/atlas and MIDI are separate
  receivers for the same canonical events. MIDI is symbolic and has no
  canonical tempo or hertz; the event sequence is not automatically a graph walk.
- `src/d4-triality-algebra-v2-profile.mjs`: exact rational covariant evaluations
  precede a separately authored within-orbit rank-to-MIDI mapping. Exact
  order-zero invariant receiver controls say nothing about synthesizer output,
  rooms or listeners. D4 here is a Lie/root/triality context and must not be
  confused with the square's eight-element dihedral group in a game API.
- `materials/mat_spec.py`: source-pinned tabulated helium data; decimals remain
  strings/Fractions, missingness is retained, mapping uses declared 400 Hz/meV
  scale and bounded MIDI quantization. Exact representation is not measurement
  certainty. Its outputs are symbolic; no sampled PCM is generated there.
- `sonification/composition.py`, `core/sequencing/events.py`: explicit musical
  patterns produce immutable validated identity-bearing events.
- `sonification/renderer.py`, `core/provenance.py`: separate NumPy Float64 DSP
  with derived per-event seeds, integer frame placement, versioned recipe,
  PCM/WAV digests, runtime identity and acyclic provenance. The scope is same
  version/runtime exact replay, cross-runtime Float64 tolerance; device playback
  is not the canonical PCM stream. This engine is distinct from ETQ symbolic work.
- `tests/test_renderer.py`, `test_audio.py`, `test_provenance.py`: immediate
  exact replay, sample quantization/packing, canonical JSON and tamper checks.
  These inspected tests were not rerun in this task.
- `formal/sonification/CLAIM_BOUNDARIES.md`, `SOURCE_MANIFEST.json`: mathematical
  theorem, implementation refinement, executed finite conformance and byte
  identity are distinct. The frozen production baseline is
  `8c62517138e3b86a4672d8969e190b747f81c398`; open Python refinement obligations
  remain open. Hashes do not prove execution or authenticate experimental facts.

Independent ideas: define a versioned tick/transition event list first; let
pitch, duration, timbre and colour be documented composition choices; preserve
event order and configuration in exports; keep playback downstream; use a
small independent integer PCM fixture if exact PCM is worth promising. Reuse
VANILLAJS audio where suitable. Do not import the NumPy engine or MPL source.

## GALAXY

Repository: https://github.com/QSOLKCB/GALAXY
Commit: `f219bb427b3a9b0c93900169d903f48f410ae67a`

Licensing is mixed, despite the Apache-2.0 root licence. `NOTICE.md` explicitly
retains MPL-2.0 for VORTEX-derived `galaxy-core.js`, `app.js`, `renderer.js`,
`rotation-lab.html`, `style.css` and JS smoke/application tests.
`galaxy-core.js` confirms MPL-2.0 in its header. These are not Apache-only donors.
`barnes-hut.js`, `mutual-gravity.js`, `nbody-clock.js`, `nbody/src/lib.rs`,
`tests/barnes-hut.mjs`, `tests/physics.mjs` and `tests/mutual-gravity-evidence.mjs`
have Apache-2.0 headers. `rust/Cargo.toml` and `cpu-runtime/Cargo.toml` declare
Apache-2.0. `rust/src/physics.rs` is Apache-2.0 with UFF attribution pinned to
`596cd732df61587aa1a9801cad1ec13483b1347f`; copying it would carry those notices.
No GALAXY code or UFF data is needed for the independent game implementation.

- `galaxy-core.js`, `docs/CPU-RUNTIME.md`: sampled stars are prescribed-field
  test particles with authored initial distribution and kinematic projections;
  enormous logical population is not enormous coupled N-body evolution.
- `barnes-hut.js`, `nbody/src/lib.rs`, `nbody/README.md`, `docs/BARNES-HUT.md`:
  separate coupled planar quadtree under three-dimensional Newtonian gravity
  restricted to the plane; positive Plummer softening regularizes encounters.
  Acceleration is G*m*d/(d.d+epsilon^2)^(3/2). Stable order, bounded leaf/depth,
  target-containing-cell exclusion, and kick-drift-kick integration are explicit.
  The independent direct all-pairs force reference must survive optimization.
- Inspected Barnes-Hut tests compare theta=0 to direct summation allowing
  reduction roundoff; selected theta=.5 fixtures require RMS relative force
  error < .03 and worst < .25. These are fixture-specific, not a universal bound.
- `mutual-gravity.js`, `docs/MUTUAL-GRAVITY.md`: separate symmetric cell
  interactions with finite/intermediate range checks and transaction preflight.
  Force balance does not imply energy/angular momentum conservation or exact
  long-term trajectories. The docs retain counterexamples: theta=.5 missed RMS,
  theta=.4 missed worst-point gates in a development sweep. No speed promotion.
- `tests/physics.mjs`: source-bound UFF Python predictions compare JS and Wasm
  circular velocities at 2e-8 relative-scaled tolerance and Float32 orbital
  rates at 2e-6. This is the prescribed-field lane, not a claim of Wasm N-body
  parity, not bit-exact universal Float64 physics.
- `nbody-clock.js`: fixed-rate pacing, capped frame delta/step count, discarded
  overload debt and reset on inactivity; physics dt is never enlarged for render
  catch-up. Pause is an explicit scheduler operation.
- `docs/CPU-RUNTIME.md`: paired alternating measurements, stable chunking and
  exact scalar/worker checksum comparison support only observed host/workloads.

Independent implementation ideas: bound a direct softened Newtonian model to
a few particles, immutable steps, fixed dt and independent Python reference;
declare exactly how ternary state selects masses/parameters, and acknowledge
that changing those parameters invalidates conservation arguments across the
change. Use SI conventions or explicitly state scaled units. No Barnes-Hut,
Wasm, GPU, cosmology or physical quantum claims are required.
