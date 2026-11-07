# DEMO//SYNTH — acoustic lattice and spectral-transport addendum

**Status:** research/architecture only; no new DSP, codec, QEC decoder, or GPU implementation.  
**Planning base:** VANILLAJS `90b2fe1f3428710eade90cc328c9e6bf7e18f457`.  
**Source material:** the maintainer's `vanillajs_ideas.md` (27-site / 512-voxel concept, GF(3), Hamming, 2-bit DNA alphabet, MIDI/BBS experiments); QEC's **seven acoustic v177.0–177.5 documents**; QEC's experimental v12.5 non-backtracking spectral work; and PSYCLE-LINUX. The maintainer's original images and SIS2 helix visualization were not supplied; their actual geometry/behaviour must be observed rather than inferred.

This is an **extension** of [DEMO_SYNTH_PLAN.md](DEMO_SYNTH_PLAN.md), not an incompatible replacement of its four-channel MOD/audio clock and 45–90-second first-intro milestones.

## 1. Unifying idea: one deterministic state, multiple honest receivers

A tracker note, symbolic qutrit error, declared MIDI event, or scheduled waveform
excites a *classical 3D information lattice*. Audio and geometry sample the same
authoritatively advanced state. In a distinct, opt-in experimental panel,
Tanner-graph non-backtracking flow can be projected onto the same display to
visualize amplification/localization, **without identifying its spectrum with
physical vibrational modes**.

~~~text
signed tracker/MIDI/QEC event @ integer audio sample index
    |                  |
    |       validated symbolic transport / GF(3) / optional test faults
    |                  |
    +----- versioned, bounded event adapter --------+
                                                     |
            3D classical coupled-oscillator state, event ledger
                  |                    |                 |
            procedural DSP       displacement / RGB     helix / text
            instrument controls  normals / lattice      heatmap / scroller
                  |                    |                 |
               exact PCM         exact scene commands -> WebGL/Canvas
                  +--------------------+
                      source-pinned canonical receipt
~~~

**Phonon-inspired** means classical coupled-oscillator normal modes, not
physical phonons (quantized crystal excitations). A **QEC acoustic channel**
means classical signal encoding/decoding of *synthetic* symbols, not quantum
error correction performed by a speaker or sound wave. The two adapters may
share graph coordinates and visual language but not unearned physical authority.
The 'sound as a fourth dimension' repository is an artistic/research
inspiration, not established experimental evidence that acoustic sound is an
independent spacetime dimension. No special acoustic or medical property of
432 Hz is assumed.

## 2. Two geometries, not two versions of the same mathematical object

### 27-cell ternary lattice: control/event layer

- Shape `3 × 3 × 3 = 27`, with explicit row-major
  `index = x + 3*y + 9*z` and `x,y,z ∈ {0,1,2}`.
- **GF(3) symbolic values** `0,1,2` are exact algebraic labels,
  not real-valued displacement or arbitrary Red/Green/Blue channels.
- Encodes event routing, parity/syndrome state and note-trigger selection.
  The same address can have an *independent* signed displacement/velocity
  when it participates in the classical vibration model.
- If a true **Sierpiński occupancy pattern** is desired, define and test
  the recursive masking/iteration rule; a solid 3×3×3 cube alone is not a
  Sierpiński fractal. Provide an empty/occupied-cell mask independently
  from the GF(3) state.

### 512-cell 8×8×8 cube: audiovisual space

- Shape `8 × 8 × 8 = 512`, with explicit
  `index = x + 8*y + 64*z` and bounded `Uint8` RGB triplets.
- Stores display colour plus independently typed classical displacement,
  velocity, excitation, and optional transient event field. The cube's
  1,536 RGB bytes are **not** the complete project/source identity.
- **Not automatically an E8 lattice**: the eight-dimensional E8 root system
  has 240 roots, not 512 three-dimensional voxel sites. E8/ETQ roots can
  drive an **explicit, versioned, possibly many-to-one projection** onto
  these 512 sites. Record collisions, empty sites, symmetries, and coordinate
  conventions rather than calling a raw voxel cube 'E8'.
- Similarly, a static coloured cube is not an actual Rubik's cube group
  action: only label it a Rubik-style display until rotations/permutations,
  facelet identity and inverse moves are specified and tested.

The owner may later supply the original 27/512 array images and SIS2 helix
demo. Compare those with this schema before treating it as a faithful
reconstruction. Existing SONIFICATION E8/ETQ claims remain source-specific.

## 3. Candidate classical wave engine

Start with a **6-neighbour graph Laplacian** on a finite grid with declared
Dirichlet, Neumann/reflecting or periodic boundaries. Let each node carry
displacement `u_i` and velocity-like state `v_i`. A candidate continuous
reference is:

\[
\ddot{u}_i = c^2\sum_{j\in N(i)}(u_j-u_i)-\gamma\dot{u}_i+s_i(t).
\]

The **discrete** solver must independently define the exact fixed-point scale,
update order, seed-free deterministic coefficients, saturation and stability
condition. An undamped central-difference candidate is

\[
u_{i,n+1}=2u_{i,n}-u_{i,n-1}-\alpha (Lu_n)_i+s_{i,n},
\]

where `L=D-A` is the positive graph Laplacian. For this linear,
undamped scheme, the familiar per-mode necessary stability constraint is
`0 ≤ α λ_max(L) ≤ 4` (the equality boundary and damping require special
care). Prefer a conservative strict inequality and independent
small-grid eigenmode references; never extrapolate it to arbitrary
nonlinear, damped, saturating or changing-topology kernels.

**Real-time efficiency:** never run all 512 coupled sites for every
48,000-Hz audio sample by default. Start with a rational sample/control
schedule (e.g. 1,000 control updates/s, exact 48-sample boundaries at
48 kHz); derive a versioned per-sample modulation rule. `OPT-DSP-001`
explicitly forbids treating an arbitrary block-held final control value as
an exact substitute. Staged state must be checkpointed and replayable
independent of block partition.

A first comparison suite should check: no-event silence, small local
impulse, exact cube symmetry, deterministic mode/peak ordering, boundary
reflection, saturation failure and long-run bounded energy behaviour
under declared coefficients. Do **not** claim exact energy conservation
until a discrete invariant has been derived and verified.

## 4. Three different spectral objects — do not equate them

| Quantity | Operator/data | What it can mean |
| --- | --- | --- |
| Classical lattice mode | Symmetric graph Laplacian `L` | Vibration eigenvector; eigenvalue relates to squared classical mode frequency under declared coupling |
| Tanner NB flow | Non-backtracking directed-edge matrix `B` | Amplification/propagation patterns of non-backtracking walks, not an acoustic oscillation eigenfrequency |
| Decoder behaviour | Actual BP update + independent outcome oracle | Iteration convergence, wrong recovery, or defined frame/word error under its own experimental protocol |

For normalized eigenvector `v`, use an **explicit** inverse
participation ratio

\[
\mathrm{IPR}(v)=
\frac{\sum_i |v_i|^4}{(\sum_i |v_i|^2)^2}.
\]

Higher IPR indicates stronger localization on the declared domain;
compare like with like (nodes vs directed edges) and report zero-vector
handling, normalization and finite precision. Flow alignment measures
cosine similarity between a declared residual field and an NB flow
field, not physical energy conservation.

**Required source audit before importing QEC v12.5 phase plots:**
`src/qec/experiments/spectral_phase_diagram.py` currently sets
`spectral_radius = flow["max_flow"]`. In
`src/qec/analysis/nonbacktracking_flow.py`, `variable_flow` is first
divided by its maximum, after which `max_flow` is computed from that
normalized field; for a nonzero field it is essentially 1.0. This
**is not the modulus of a dominant eigenvalue of `B`** and is unsuitable
as the x-axis of a true spectral-radius phase diagram. Keep the field
named `normalized_max_flow` unless independently recomputed from
the actual eigenvalues or a validated NB spectral-radius estimator.

Similarly, `_run_decoder_trial` in that file tests whether a proposed
correction reproduces the observed **syndrome**. Do not silently call
that fraction a physical/logical FER or interpret it as a universal
BP critical threshold. A valid phase diagram requires independently
declared error distribution, decoder inputs, true-word/logical oracle,
stopping rule, repetitions, confidence intervals and comparison
controls. A plot of normalized flow vs a synthetic syndrome-match
failure rate is still a useful research/visual test, **not** a proven
spectral phase transition.

Suggested deterministic spectral tests:
- Acyclic/tree graph: non-backtracking matrix nilpotent, spectral radius 0.
- Simple cycle: directed NB permutation, radius 1.
- Connected `d`-regular non-backtracking graph: top NB magnitude
  `d-1` under the standard irreducible setting.
- Disjoint components with repeated leading eigenvalue: canonical
  degeneracy/tie handling; no unstable phase/basis choice exposed
  as a byte-exact ABI.
- Explicit Laplacian and NB spectra on small identical topologies,
  which **must not** be interchangeable.

## 5. QEC's acoustic contracts are a stronger donor than visual imitation

Source: `QSOLKCB/QEC@27bbc798c4e38138ca5b0fff70b15c3271a1917d`.
These seven documents are **additive classical research contracts**,
not evidence of physical quantum protection.

| QEC source | Safe DEMO//SYNTH reuse and boundary |
| --- | --- |
| `docs/ACOUSTIC_CHANNEL_CONTRACT.md` (v177.0–1) | Fixed 48-entry `SINE48` PCM16 LUT, integer phase/harmonic profiles, 24/48 kHz known-answer WAVs. Build a **separate educational channel/sonification adapter**; do not silently use it as a full musical synthesizer |
| `docs/ACOUSTIC_NOISE_AND_CANCELLATION.md` (v177.2) | Twelve bounded integer PCM perturbations, explicit seed/LCG, staged original→observed→filtered receipts; subtraction only with separately supplied, authorized reference. Not general speech removal |
| `docs/ACOUSTIC_RECEIVER.md` (v177.2) | Matched-filter/median-period harmonic receiver, residual guard, repetition FEC. Keep raw candidate acceptance distinct from actual correct recovery; no hidden truth access |
| `docs/ACOUSTIC_SYNDROME_BRIDGE.md` (v177.3) | Replay PCM receiver → external measured-reference check → unmodified exact decoder, with raw false-accept and veto records. Never let candidate claims authorize themselves |
| `docs/ACOUSTIC_TRANSPORT_REPLAY.md` (v177.4) | Role-tagged `original, observed, filtered, candidate, rejected, verified` artifacts; exact canonical JSON, 65,536-byte maximum/1,024-byte bounded chunks in its *native transport model*. Do not assume a whole demo fits that test transport |
| `docs/ACOUSTIC_COMPARATIVE_EVIDENCE.md` (v177.5) | Seven comparative methods, 19 named controls per alphabet, explicit privilege/fairness costs and BER/SER/erasures/false accept denominators. Use as an optional **offline educational evidence scene**, not a performance claim for our synth |
| `docs/ACOUSTIC_OFFLINE_LAB.md` (v177.5) | File-only bounded viewer, waveform envelope display, click-to-play Web Audio, structural import vs independently verified receipt. Its browser is a **viewer, not an authority** |

Particularly useful: the normative QEC channel uses **no runtime trigonometry**,
synthesizes sampled qutrit/ququart harmonic phases with an exact
`SINE48` lookup table and signed PCM16, and labels harmonics divisible
by three as *qutrit state-dark*. The resulting tone bank can supply a
striking test/demo **phase and interference soundtrack** without claiming
real qutrit hardware or correcting physical acoustic noise.

QEC receiver trust is deliberately more precise than a single
`corrected=true` field. Maintain seven separate fields in any educational
demo: `ideal_syndrome` (hidden fixture-only),
`measured_syndrome`, `encoded_sound`,
`received_waveform`, `estimated_syndrome`,
`decoder_decision`, and `logical_outcome`.
Optional `reference_noise` is separately supplied, permissioned and
not inferred from hidden clean sound. Importing a 'verified' JSON label
or checksum **is not verification**. The independent source/reference
pins must be held outside the artifact under test.

**Practical architecture:** import *existing independently generated QEC
artifacts* through a bounded adapter into a visual educational mode, and
use the ordinary QSOL tracker signal path for original music. Do not
import the QEC Python decoder, generate physical-QEC claims, or embed
SONIFICATION root PCM in VANILLAJS.

## 6. Repair supplied Hamming/DNA/MIDI prototype before promoting it

The owner-provided Python encoder places bits as
`p1,p2,d1,p3,d2,d3,d4` (most significant to least significant) and
computes `syndrome = (s3 << 2) | (s2 << 1) | s1`. The corresponding
**correct syndrome-to-position** mapping is:

| Syndrome | Erroneous bit |
| --- | --- |
| 1 | `p1` (bit 6) |
| 2 | `p2` (bit 5) |
| 3 | `d1` (bit 4) |
| 4 | `p3` (bit 3) |
| 5 | `d2` (bit 2) |
| 6 | `d3` (bit 1) |
| 7 | `d4` (bit 0) |

The supplied decoder uses the *reverse assignments*. A standard-library
enumeration over all 16 data nibbles × 7 single-bit flips confirms
**112/112 failures** for the supplied decoder. Correct the mapping,
test 16 clean / 112 single-error inputs, and explicitly reject
unsupported lengths, non-binary values and extra/malformed symbols
before allowing replay.

A basic Hamming(7,4) block **corrects one bit but cannot reliably detect
all double errors**. For trustworthy two-bit detection, evaluate an
explicit SECDED extended Hamming(8,4) profile with complete exhaustive
tests. The 2-bit-to-`A/C/G/T` converter is a reversible **symbolic
serialization metaphor**, not biological DNA storage or quantum error
correction. Reject unknown bases (do not default them to `A`), enforce
exact lengths and count, and preserve the exact original data separately.

Replace the provided 32-bit truncated MD5 trailer with:
- canonical payload length/version and declared coding profile;
- full SHA-256 on the **original unencoded bytes**, independently checked
  against an externally retained expected commitment when identity matters;
- explicit FEC-corrected/uncorrectable counters and original/observed/
  recovered byte identities, without conflating error correction with
  authentication or authenticity.

Use an explicit seeded generator for live source creation; never
promote `random.randint`, `np.random` ambient state, wall clocks,
uncontrolled MIDI port ordering or device scheduling into the Strict
sample timeline. Record captured MIDI messages as versioned
**sample-indexed events** before deterministic replay. Interactive
hardware performance remains separately labelled Live.

The supplied `fib_sizes=[3,5,8]` and note-activation pattern can be
preserved as a **creative mapping preset**; it does not mean a 3D voxel
block encodes a Fibonacci identity. All `8×8×8` updates need declared
fill/clamp/overlap rules, checked extents and a stable update order.

## 7. Psycle and BBS/helix — keep optional adapters independent

Psycle donor:
`QSOLKCB/PSYCLE-LINUX@298cc1f7bff119e0107ee3ed93e66caa9d45aa6d`.

Its **machine graph / sampler / plugin and tracker workflow** are useful
UX and modular routing references. The ongoing Linux port records
original-vs-candidate discrepancies and **UNKNOWN** contracts; do
not assume complete PSY song import or timing compatibility. Keep a
pure, fixed set of serializable effect nodes first (instrument→filter→gain→output),
then propose a plugin API only after memory/time budgets, cycle policy,
source identity and sandbox constraints are tested. Do not load arbitrary
native Psycle/VST2 binaries inside a browser project.

A visually authentic first scene could combine:
- a BBS 256-colour cell/dither screen with checked ANSI palette
  conversion and an original CP437-style glyph atlas;
- 2D `3^3` ternary cell symbols rising into the 3D `8^3` cube;
- an authored parametric helical trajectory that carries sound-event
  packets through selected nodes, with sample-exact event timing;
- projected NB flow/localization rendered as alternate **diagnostic**
  shader overlays, not silently treated as physical phonon displacement;
- large procedural 3D text and a four-channel MOD sequence.

The owner's earlier SIS2 helix must be reviewed when actually provided;
until then, this is a **new creative proposal**, not a faithful port.

## 8. Implementation additions and new gates

These are **future PR-sized pieces**, not immediate code additions to
the existing P1 music vertical slice:

1. **P1b — lattice-cue reference:** exact 27-site symbolic GF(3)
   representation, 512-site geometry schema, sample-indexed note
   excitations and a tiny independent 6-neighbour oscillator reference.
2. **P2b — Hamming/receipt adapter:** corrected binary coding oracle,
   optional SECDED, declared symbolic DNA wrapper and external SHA-256
   provenance. Keep actual payload/encoded/recovered bytes separate.
3. **P3b — acoustic channel demo:** read canonical signed PCM16 QEC
   waveform/report files with bounded validation; render
   original/observed/filtered audio separately, candidate raw acceptance,
   independent reference veto and verified-decoder outcome.
4. **P4b — phonon/NB dual visualization:** oscillator field, 27→512
   projection, dither/helix/3D text, independent Laplacian and real
   NB spectral-radius fixtures. Render static 8×8×8 buffers
   through existing VANILLAJS retained geometry/FrameGate.
5. **P5b — OPT/RTX:** fixed-control-rate-vs-per-sample DSP comparison,
   bounded scratch allocation and unchanged output hashes, visual
   command/texture identity, owner-only native RTX actual-frame tests,
   separate PCM/CPU timing. Hardware evidence is a new numbered
   preserved archive, not a modification of RTX001–004.

Tests **must** cover reversed Hamming syndromes, 112 single-bit
corrections, double-error limitations, strict symbolic DNA parsing,
reference-vs-candidate authority separation, immutable original WAVs,
no self-issued-trust upgrades, 27/512 indexes, sparse and invalid
event rejection, control-block partition independence,
symmetric/periodic boundary negative cases, graph spectral known
answers, sample-indexed scene equivalence and no E8/phonon
physical claim leakage.

Keep:
`audio_source → received_waveform → candidate_receiver → independently_gated_result`
as an **evidence pipeline**, and
`tracker_event → lattice_state → audio_control + scene_command`
as a **creative pipeline**. Do not merge the two into a single
`verified_music` flag.

## 9. Decision and scope

The direct next engineering deliverable is still **P1**: original four-channel
audio, sample-exact cues, one playable audio-reactive scene and byte-identical
offline WAV. This addendum makes the first scene's cue interface **lattice-ready**.
The first larger mathematical extension should be the **27-site GF(3) controller
and 512-voxel classical wave scene**; save full acoustic receiver, QEC
comparative analytics, real MOD extensions, and sophisticated Psycle routing
for separately reviewable patches.

No new physical RTX run, QEC decoder change, SONIFICATION root PCM generation,
MPL source transplant, actual quantum device access or commercial demo
content is authorized or implied by this document.
