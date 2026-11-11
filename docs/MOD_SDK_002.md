# MOD-SDK-002 — ALIEN MATH cardinal circuits and game-authoring adapter

**Status: experimental, opt-in.** Pure authoring/game-state mathematics and an
inert typed data adapter. Not a full game physics engine or untrusted executable
plugin sandbox.

**VANILLAJS Mod SDK — Build games. Extend the engine. Own your creations.**

**This is not a product. This is INDEPENDENCE. 👽**

## What changed

MOD-SDK-001 introduced strict bounded data-only manifests and transactional
local registry activation. MOD-SDK-002 adds:

- `modules/exact-circuit/index.js`: independently implemented cardinal X/Z
  checkpoint compilation, exact BigInt intersection and ordered lap progression.
- `modules/mod-course/index.js`: validates versioned **v1 decreasing−Z**
  ALIEN Course definitions or **v2 directional cardinal** circuits inside the
  existing inert Mod SDK registry.
- [ALIEN Circuit Foundry](../demos/circuit-mod-lab/index.html): offline
  browser authoring, validated JSON, inspected raw Q16.16 gates, a one-sweep
  demonstration and local JSON export.
- [Source example](../examples/mod-sdk-002/cardinal-loop.json), independent
  Python Fraction comparison and adversarial Node tests.

The v1 `modules/exact-course` source, historical Lean/Q16/SPARK proof assets,
browser trust policy, and CPU/GPU rendering contracts are not altered.

## Provenance / intellectual honesty

Behavioral research reference: QSOLKCB/DRONE-RACER,
commit `9fea5ce9bdcd1799e075afcc329972792e15b688`,
`src/circuit.js` Git blob SHA-1
`d50cdf6eecebda4decd51bb239a730bf67a65278`,
from merged DRONE-003/004. The new engine API is **independently implemented**,
not a verbatim donor-file import, and deliberately has no ground solver,
obstacle collision or game-specific body state.

SONIFICATION provides relevant deterministic mapping and source-verification
research, but this PR copies no SONIFICATION DSP, score or scientific material.
QEC-ADA uses MPL-2.0: no Ada decoder or MPL-licensed code is copied into
this Apache-2.0 engine module. Future GF(3), quantum error-correction-inspired
or spectral game mechanics need explicit mathematical interpretation,
licensed provenance and independent tests. **A quantum-inspired game mechanic
is not a quantum physics simulator or evidence of a physical law.**

## Exact circuit grammar

Source record (strict own data fields only):

    {
      "id":"test-circuit","version":2,"laps":2,
      "spawn":["0","8","0"],
      "gates":[
        {"id":"east","x":"10","y":"8","z":"0",
         "width":"20","height":"14","axis":"x","direction":1}
      ],
      "obstacles":[]
    }

A real circuit requires **4–64 gates**, 1–9 laps and 0–96 bounded obstacle
AABBs. Every coordinate is an exact decimal string, parsed with existing
ALIEN-MATH-001 and quantized with explicit `rounding:'exact'`,
`overflow:'reject'` through ALIEN-MATH-002. Coordinates are restricted to
±4096 m, checked signed-int32 Q16.16; the rectangular gate aperture has width
and height 4–60 m, exactly representable half-extents, and bottom >= 0.
Each gate normal is cardinal +X/−X/+Z/−Z, not an arbitrary 3D rotation. The
obstacle array is **validated data only**, with min/max ordering, min Y >= 0
and a six-digit colour. **No collision resolution** is performed here.

`compileCircuitQ16(source)` returns a frozen, authenticated compiled circuit.
`crossCircuitGateQ16(gate,fromRaw,toRaw)` returns an exact BigInt
`{n,d}` rational sweep fraction or null. Both inputs are checked signed-int32
raw Q16.16 triples, **not Float64 positions**. The returned fraction has
`0 < n/d <= 1`; a point starting exactly on the plane cannot claim another
crossing, while an endpoint exactly on the plane is admitted. Side and Y
aperture boundaries are closed.

`newCircuitProgress(compiled)` creates authenticated, immutable progress.
`advanceCircuitQ16(compiled,progress,fromRaw,toRaw,{contact:false})` counts
consecutive checkpoints only when their exact rational sweep fractions
strictly increase. A missed/earlier/coincident checkpoint blocks later
credit. Passing the last checkpoint completes one lap; if more laps remain,
the **same sweep** continues with the previous fraction, so a strictly later
first gate of the next lap can count within that tick. Simultaneous first/last
crossings do not count twice. The final lap is terminal. At most one circuit
plus one further gate is considered during a single straight sweep.

`contact:true` conservatively awards no checkpoints for the entire sweep,
including potentially genuine crossings before impact, because this module
does not know a physics engine's piecewise sliding trajectory. A consumer
must decide contact truth using its **own validated collision solver**. The
progress object is scoped to its original compiled circuit; forged objects
or progress from a different circuit cannot be used as authority.

**Nothing here makes Float64 flight bit-exact across browsers.** A consuming
game must supply and independently test its Float64→Q16 boundary (as
DRONE-RACER does) or use its own already-checked integer positions.

## MOD-SDK-001 typed entry format

The Mod SDK stays generic. An author opts in with an entry like:

    {
      "id":"cardinal-loop","kind":"data",
      "data":{
        "kind":"qsol.vanillajs.course-source.v1",
        "course":{ "id":"...", "version":2, "...":"..." }
      }
    }

The `course` field contains the full strict v1 or v2 source schema, not an
executable plugin. Use `validateCourseMod(manifest)` for pure, complete
domain checks. `registerCourseMod(registry,manifest)` validates **before**
mutating the registry. Generic MOD-SDK-001 dependency versions, activation
order and limits remain authoritative. `activeCompiledCourses(registry)`
compiles the recognized typed entries in the current active snapshot; it
ignores unrelated inert data entries and rejects malformed recognized
course entries. Returned compiled objects are **in-memory only** and cannot
be serialized as trusted runtime capabilities.

This is a reference authoring integration, not an automatic conversion of
DRONE-RACER's complete drone/skin/obstacle physics pack, an editor scene
export format or a trusted JavaScript extension runtime. The Visual Editor's
current project schema remains independent; a future reviewed adapter may
export an actual course selection from it.

## Reproduction and evidence

    node --test tests/mod-sdk-002.test.js
    node --test tests/*.test.js
    node scripts/check.js
    node scripts/build.js
    node scripts/verify-offline.js

The Python stdlib oracle `scripts/mod_sdk_002_oracle.py` uses
`fractions.Fraction` on **1024 cardinal sweep cases** submitted by the
Node regression suite; it has no JavaScript imports. Node tests additionally
cover both normal axes/directions, closed edges, unknown/invalid properties,
missing/duplicate IDs, resource ceilings, ordered multi-gate sweeps, equal
fractions, cross-lap transitions, final-lap terminal behavior, contacts,
domain authentication and MOD-SDK-001 registry integration.

The packaged Chromium research suite must exercise the actual lab, reject
invalid source JSON and verify a 320px viewport. The formal proof archives
remain source-pinned; tests demonstrate **finite conformance**, not universal
ECMAScript source refinement, hardware parity or a new law of physics.

## Research roadmap

- Source-independent GF(3)/qutrit-inspired cellular mechanics could be
  compared with QEC-ADA finite-field fixtures, with licensing boundaries.
- D4 world-layout authoring can be built using VANILLAJS `exact-d4`;
  coordinate transforms must state their axis conventions explicitly.
- Tick-indexed event-to-sonification mapping can use SONIFICATION-inspired
  deterministic contracts while preserving device playback as non-authority.
- GPU/WASM culling and projection can adopt proven parity checks, with
  simulation and checkpoint authority remaining CPU-owned.

Each direction needs a separate owner-reviewed PR and negative controls.
