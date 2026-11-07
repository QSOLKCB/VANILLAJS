# BLOAT-OPS / CorpoWars3d / NEXUS / UFF — opt-in engine extraction

**Status: experimental.** These are independent, optional general-purpose algorithms and evidence contracts. Existing games, authoritative integer physics, collision solvers and WebGL APIs remain unchanged. The physical RTX verification is owner-only and not automatically run on PRs.

## Provenance — source-pinned donors

| Donor | Exact source | What is reused | Source boundary |
| --- | --- | --- | --- |
| BLOAT-OPS | `QSOLKCB/BLOAT-OPS@6f290dc818759ca49bcdec54b31d738b33c7946f`, `src/game/replay.js` and `tests/checkpoint.test.mjs` | complete-input replay/checkpoint admission, never accepting commands remaining after termination | Apache-2.0; no mission code or game assets copied |
| CorpoWars3d v1.2.0 / PR #10 | `QSOLKCB/CorpoWars3d@5701949e4ef7047b715db808b777450c3bf49d53`, `src/simulation.js` | OPT-REDUCE axis early reject before Euclidean distance | Merged release v1.2.0, originally reviewed at `a81b7b03d0c8b730b830f9d92459ef2193793b7f`; no autonomous pursuit or campaign rules copied |
| NEXUS | `QSOLKCB/NEXUS@ac9ef5ac79008b46be3351c57cab946b93dd37e8`, `docs/LATTICE.md`, `src/ve/graph.rs`, `formal/Nexus/Lattice.lean` | coordinate-derived cuboctahedral topology and reversible classical `Z_4` state-transition contract | NEXUS source is MPL-2.0. VANILLAJS's implementation is independently authored from published mathematics, not an unlicensed source transplant; Lean proves its own formal model, not this JavaScript |
| UFF | `QSOLKCB/UFF@596cd732df61587aa1a9801cad1ec13483b1347f`, `uff/constants.py`, `docs/MODELS.md` §3 and `tests/test_models.py` | explicit SI gravitational constant and established Newtonian central-mass formula | Apache-2.0. UFF's empirical extra-field velocity law, MOND sensitivity models, Kerr and LQG diagnostics are **not** assumed to be physically proven force laws |

Reference: Slade, T. (2026), *NEXUS: A Deterministic Centre-Transit Engine and Reversible Cuboctahedral Lattice with Lean-Checked Contracts* (v1.0.0), DOI: https://doi.org/10.5281/zenodo.23511710. The recorded DOI is a user-supplied citation cross-linked to the NEXUS repository; it is not a GPU benchmark source.

## Four new optional modules

### `range2d`: conservative bound rejection

`distanceCheck2D(a,b,range,{inclusive=true})` first checks `abs(dx)>range || abs(dy)>range`. A pair rejected by either bound cannot satisfy `Math.hypot(dx,dy) <= range`, so expensive distances can be skipped without a change to the accepted set. Border cases continue through `Math.hypot`. `withinRange2D` short-circuits a caller's optional expensive predicate. Finite coordinates and a finite nonnegative range are required, and all inputs are validated before the shortcut. This preserves boolean range answers, **not** the number of distance computations or an always-present distance field; early rejects return `distance:null`.

### `integer-replay`: replay admission, not a new simulator

`sealIntegerReplay(initial,frames,{build})` and `verifyIntegerReplay(tape,{expectedBuild,isTerminal})` bind an existing `IntegerEngine` checkpoint to a 40-hex source SHA, a dense bounded one-frame-per-tick command tape, a declared count, an explicit `truncated:false` marker and a diagnostic FNV hash. Validation rejects mismatched source/schema, unknown input fields, incomplete tapes, stale checkpoints or trailing inputs after an application's terminal condition. Replaying the same engine with all commands must reconstruct the final snapshot. The FNV digest is **not** a digital signature, authentic historical timestamp or proof of external provenance.

### `nexus-lattice`: reversible classical graph-state machinery

`new NexusLattice({cells,seed})` derives all twelve vertices, twenty-four edges, eight triangles and four perfect matchings from integer coordinates. Each cell has twelve `Z_4` registers. Controlled local increments and face swaps are inverted in reverse order. Even cell counts 2–256 and rounds 0–1024 are bounded; snapshots are owned and validated on restore. Seed 0 is valid. Tests use independently generated SHA-256 state vectors for multiple seeds and sizes and exhaustive forward/reverse cycles. This is a deterministic classical state machine, not quantum simulation.

### `orbital-physics`: Newtonian gravitational dynamics

`centralAccelerationSI(position,mass,{center,minimumRadius})` evaluates the classical inverse-square acceleration `−GM r / |r|³`. `circularSpeedSI(mass,radius)` implements `sqrt(GM/r)` using UFF's documented `G_SI=6.67430×10^-11 m³ kg^-1 s^-2`. `KeplerOrbit` updates one negligible-mass body in a stationary central potential with the velocity-Verlet kick-drift-kick scheme. Its snapshots and diagnostic specific energy use explicit SI metres, metres/second, seconds and kilograms. It checks finite input, bounds, excluded central radius and rejected-step atomicity. A long step whose straight-line chord intersects the excluded central region also fails closed, even if both endpoints are outside; this is a conservative guard, not continuous trajectory collision. Negative timestep is permitted for numerical reversal tests; exact energy conservation is **not** asserted. Orbital phase error depends on timestep: the verified circular-orbit fixture uses approximately **5-second** steps and a declared phase tolerance, not a claim of exact orbit closure.

This orbit kernel does **not** add relativistic corrections, a rotating primary, tidal forces, multi-body mutual gravity, rigid-body impulses, collision detection, fluid dynamics, atmospheric drag or a high-accuracy ephemeris. It is not a universal game physics replacement. UFF's empirical galaxy model is deliberately excluded pending a separate research/validation proposal.

## Validation and performance interpretation

`node --test tests/range2d.test.js tests/integer-replay.test.js tests/nexus-lattice.test.js tests/orbital-physics.test.js` checks the newly added kernels; the complete repository test suite, source checks and packaged Chromium smoke suite remain required. `node scripts/bloat-nexus-uff-workload.js --check` runs seven serial trials with two warmups and checks: conservative range parity, replay completeness, exact forward-lattice state hashes and inversion, and orbital energy drift. Timing is descriptive, not a CI speed threshold.

The opt-in `.github/workflows/rtx5060ti-numerical.yml` owner-only workflow verifies **all three** frozen archives (including the committed COMMENT-001 screenshot integrity gate) and re-executes the same historical full-path native WebGL workload from RTX001, RTX002 **and RTX003** exact source commits against newly reviewed `main`. It does **not** reuse earlier recorded timings as fresh paired measurements. The new range, integer-replay, NEXUS and UFF orbital workloads run in **one serial Node process** on the workstation, not as GPU compute. Their separate report explicitly says `gpu: not measured`; native WebGL parity proves rendering compatibility, not physical/NEXUS simulation acceleration. No universal FPS or GPU-physics speedup is claimed.

The workflow has only `workflow_dispatch`, is pinned to `main`, requires `github.actor == 'EmergentMonk'`, a dedicated labelled self-hosted runner, exact clean checkout, headed native RTX identity, and explicit `acknowledge_local_execution=true`. `publish_evidence=true` is a separate consent to upload the new 14-day Actions artifact. It requires the original three ZIP digests, three complete native comparisons, seven numerical measurement samples per case, and source SHA-256 checks before producing a **new** immutable-style receipt outside the checkout. Preserve the exact resulting artifact later in a separate reviewed evidence PR. Neither old archive nor the existing games are altered.

Do not merge or issue a release until the exact-head hosted checks and owner review pass. Physical GPU validation is a later, separately authorised workflow and requires a new evidence-preservation PR.
