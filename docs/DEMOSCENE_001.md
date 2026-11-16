<!-- SPDX-License-Identifier: Apache-2.0 -->
# The Demoscene Foundry — DEMOSCENE-001

**Experimental implementation for proposed v2.4.0.** The owner published v2.3.0
at `3d5f9f93e124da5598b4181e344471477968e6e1`. This work adds one original
noninteractive production and reusable authoring tools. It does not change Games2.

Open [the player](../demos/demoscene-lab/index.html), or the
[Visual Workbench → Demoscene / Visual FX](../demos/editor/index.html#visual-fx).
The production is **THE MACHINE REMEMBERS / FROM BLOCKS TO WORLDS**.

## Artistic direction

| Samples, inclusive start / exclusive end | Seconds | Movement |
| --- | --- | --- |
| 0–576000 | 0–12 | Cold Boot: original boot text, wire cubes, sparse tones, scanlines and copper bars |
| 576000–1152000 | 12–24 | Block Machine: assembling towers, corridor frames, flythrough and a growing rhythm |
| 1152000–1728000 | 24–36 | Geometry Unleashed: rotating rings, a deep tunnel, wire/solid contrast and a procedural plasma wall |
| 1728000–2304000 | 36–48 | Alien Cathedral: bilateral industrial ribs, monumental columns and an orbiting geometric core |
| 2304000–2880000 | 48–60 | Final Transmission: columns break away, a bounded cloud forms original extruded block lettering, a scroller passes and the production resolves to black |

Mint, violet and ember distinguish structural repetition, depth and musical
accent. The background remains dark to preserve silhouettes. All geometry,
glyph masks, score notes and synthesised sound are original. Artistic lattice
and radial motifs make no quantum, acoustic or physical simulation claim.

## Modules and numerical contract

`demo-timeline` owns the versioned 48 kHz sample profile, frame/sample conversion,
absolute keyframe interpolation and score-event envelopes. `demo-scene` owns
six reusable effects, transform composition, original block glyphs and bounded
XYZ/RGB streams. `mod-demo` composes those modules with the existing Mod SDK and
Soundtrack/audio2d renderer. [MODULES.json](../MODULES.json) records the one-way
dependencies. Production fiction and scene direction remain in the lab.

The canonical interval contains **2,880,000 samples** and **3,000 nominal
50 fps frames**. Frame `f` samples `960*f`, for `0 <= f < 3000`. Sample 2,880,000
is a terminal black state, not frame 3000 and not a wrap back to the introduction.
Every scene, camera, effect, cue and particle position is a direct function of
validated project data and the absolute sample. Seek never integrates earlier
frames. Keyframes use ordered integer sample positions and linear interpolation.
Rotations are radians, X then Y then Z, with right-handed +Y up / −Z forward and
metres. The editor converts its existing degree-based Y rotation at the boundary.

The browser estimates sample position from `AudioContext.currentTime` and the
start offset. Drawing selects the corresponding nominal frame; no rAF elapsed
time drives the world. Pause stops/disconnects the source; seek pauses, replaces
the offset and starts a fresh source if playback was active. Restart stops the
previous source. Pending asynchronous resumes have cancellation generations.
Muting preserves the timeline. Hidden pages pause. Audio requires a user gesture;
unsupported Web Audio reports an error instead of silently claiming playback.

Integer PCM bytes are canonical for this source/profile. Floating trigonometry,
geometry commands and camera calculations are checked exactly within the same
JavaScript runtime. Cross-engine float equality, GPU pixel identity, speaker
output, output latency and device resampling are not claimed.

## Original score and export

Eight different 7.5-second phrases make the whole minute. Each has four independent
lanes and 32 integer-sample cells at 128 BPM: triangle bass, triangle lead, square
arpeggio and indexed noise percussion. Cells begin every 11,250 samples; bounded
integer gates and gains feed existing audio2d. Intro, build, peak and an attenuated
cadential outro are authored separately. The last notes end before the terminal
sample. The profile permits rests and does not loop or truncate a short song.

Visual envelopes inspect the actual note events in the chosen lane. The five act
cuts are fixed at twelve-second boundaries; they do not pretend those cuts are
bar boundaries at 128 BPM. The full WAV is 5,760,044 bytes: 44 header bytes plus
5,760,000 bytes of mono PCM16 little-endian at 48 kHz. Export generates it on
request. It is never precached. Score export includes every event in all phrases.
Receipts hash project, score, PCM and WAV separately with SHA-256. The packaged
browser receipt also identifies its content-hashed module graph; unpackaged
source has no graph digest. A digest is content identity, not a signature.

## Strict portable project

The outer record is `{kind: "qsol.vanillajs.demoscene.v1", manifest}`. The manifest
is a standalone `qsol.vanillajs.mod-pack.v1`, version `1.0.0`, with no requirements.
It has exactly these typed entry families:

| Entry | Data |
| --- | --- |
| `settings` | Title, uint32 seed, exact compatible engine/audio profiles, rate/duration, four RGB colours, original title/subtitle/scroller and provenance |
| `timeline` | Five ordered twelve-second acts, camera position/target/FOV keys and selected score cue lane |
| `phrase-0` through `phrase-7` | Four 32-cell integer-Hz note lanes, gains, gates and oscillator kinds |
| `mesh-*` | Up to 120 triangle vertices per chunk, XYZ only, with source name, author, licence and source SHA-256 |
| `node-*` | Named geometry references or a cube, effect, copies, colour, transform keys and provenance |

Unknown fields/versions, unsafe prototypes, accessors, shared/cyclic graphs,
script fields, nonfinite values, unresolved references and work overflow reject
before activation. Imported text is inert. The existing Mod SDK's 32 KiB,
32-entry, 512-node-per-entry and depth-eight caps remain unchanged. Mesh chunks
retain source attribution; the whole composition has at most 1,536 imported
vertices, 16 nodes, 48 copies per node, eight keys per path and 24,000 replicated
mesh/cube vertices. Titles have additional glyph-work caps. The geometry writer
has 100,000 triangle, 24,000 line and 12,000 point vertex slots. An oversized
existing Asset Foundry scene is rejected, not silently simplified.

`validateDemo` returns a detached immutable accepted project. Its canonical JSON
sorts record keys and retains meaningful array order. `DemoProjectSlot.replace`
validates a complete candidate and fresh registry before swapping. Browser import
also constructs the new world before stopping the old one. Failed imports leave
the accepted project and active audio source intact. Imported licence declarations
are preserved; the tool cannot establish whether an author's declaration is true.

## The Workbench workflow

The panel reuses the existing hierarchy, selection, inspector, materials, OBJ
assets and instantiated prefab hierarchy. Add selected object/prefab captures
visible descendants with world transforms. Move/rotate/scale/recolour with the
existing inspector, then capture another FX key at the chosen sample. Pick rotate,
lattice, radial, tunnel, extrude or dissolve choreography and bounded copy count.
The renderer uses the same effect implementation as the production.

The sidecar has a bounded history using the editor's existing undo/redo operations;
FX Undo and scene Undo are explicitly separate. Existing v1/v2 scene and asset
project formats are unchanged. Export the FX sidecar separately before leaving;
it is not silently included in scene autosave. Reimport in this panel or the lab.
Flat material colour is supported. Textured attachments reject with a visible
instruction to clear the texture; there is no hidden licence loss or discarded
texture dependency. Mesh and material declarations remain attached to their
respective geometry and composition records. Owner-local declarations stay local.

See [Make Your First Demoscene Intro](MAKE_YOUR_FIRST_DEMOSCENE_INTRO.md).

## Generator and size profiles

```sh
node scripts/demoscene-world.mjs --preset machine-remembers --seed 1983 --out ./demo-output
node scripts/demoscene-budget.mjs
```

Serve `demo-output/production/` with any local HTTP server and open `index.html`.
Native modules need HTTP. The output includes native runtime/shader sources,
styles, original embedded project, separate project and full score files,
licences, identity receipt and a byte report. The project file imports directly
into the lab. The seed, score and every emitted source/asset byte bind the receipt.

All files are staged on the same filesystem. An exclusive `mkdir(out)` rejects
even an existing empty output directory. A single rename commits the entire
`production/` tree beneath that reservation; failure cleans only the owned
reservation/staging area. The CLI does not replace existing output.

**Full Demo** is the delivered profile. Byte reporting counts all relevant runtime
JavaScript (including shaders), HTML, CSS, project/score data, licences and receipt.
The diagnostic report itself is outside the runtime inventory. Compression uses a
specified sorted, length-prefixed path/byte container, gzip level 9 and Brotli
quality 11. Container sizes are observations, not executable intro sizes. The
compact-description row explicitly counts inert project JSON only. Neither a
65,536-byte self-contained executable nor a 4,096-byte intro is claimed. A real
64K submission would also need a working delivery/unpacking environment and
rules review; 4K remains future work.

## Reuse, offline and verification

`api/demoscene/index.js` exposes the pure timeline, scene and project facilities,
plus the opt-in audio transport. The lab's `createIntro(canvas, options)` adapter
provides `start`, `skip` and `dispose`; `enabled:false` transfers immediately to
the consuming application's menu. [The original example](../demos/demoscene-lab/intro.html)
does not connect to Games2 or a proprietary title.

One immutable world retains seeded geometry descriptors and glyph destinations.
One bounded writer retains CPU vertex storage and three renderer-owned GPU buffers.
`FrameGate` reuses an unchanged frame only for the same project generation, sample,
quality, actual output dimensions and context epoch. Project replacement and
context restoration invalidate it. `forceFresh` allocates an independent writer;
tests compare every command and every vertex against fresh world reconstruction.
Low detail reduces star points and drawing resolution, preserving commands,
sample time and score bytes. Telemetry reports actual counters, not speedup claims.

The public build includes the lab and its complete content-hashed native-module
closure, extending the cached-startup fix from v2.2.0. Browser regressions retain
a real older worker serving incompatible audio2d bytes while the new graph starts;
they also abort a startup import, exercise the reload button, then play. Existing
package SHA-256 verification, offline precache limits and browser reuse policy
remain in force. Evidence and tooling do not ship in the public package.

Run Node tests, `scripts/check.js`, `scripts/build.js`, `scripts/verify-offline.js`
and the packaged browser suites. The new tests cover the full minute's PCM under
irregular partitions, all frame/act boundaries, seed sensitivity, arbitrary seek,
schema attacks, atomic rejection, asset provenance, FX history, fresh/retained
parity, audio cancellation, CLI reproducibility/no-overwrite and actual browser
downloads. Six visual samples cover opening, blocks, tunnel, cathedral, title
and terminal black. [Execution evidence](../evidence/DEMOSCENE-001/README.md)
distinguishes tested Chromium from unavailable hardware/browser coverage.

## Research and deferred work

[Pinned donor review](DEMOSCENE_DONOR_REVIEW.md) documents design-only inspection.
No donor code, fonts, meshes, samples, tracker binaries or demoscene art were copied.
No MOD export, tracker workstation, AudioWorklet, arbitrary shader/script plugins,
video/FFmpeg export, physical lattice acoustics, QEC computation, multiplayer or
new gameplay systems are included. The lattice/acoustic addendum remains a future
research design. Assembly references inform the historical aesthetic; this is not
a competition-approved submission. The owner decides whether to merge and publish.
