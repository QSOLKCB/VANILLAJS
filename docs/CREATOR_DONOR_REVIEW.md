# Creator toolkit: donor sources and boundaries

Reviewed 2026-11-12 against VANILLAJS base `b12f24f` (the reviewed VOIDWARD integration). Source revisions are recorded below; they are not moving runtime dependencies. VANILLAJS core remains native JavaScript with no new runtime packages, CDNs or downloaded assets.

| Repository | Inspected commit | Relevant inspected material | Result in this upgrade |
| --- | --- | --- | --- |
| [4XGAMES](https://github.com/QSOLKCB/4XGAMES) | `382f458998cf3c28e82047f64709722761559034` | `mods/registry.js`, `mods/helix-accord/`, `mods/emberwake/`, `mods/glass-meridian/`, `README.md` | Three unchanged Apache-2.0 campaign data packs bring the existing VOIDWARD integration to eight campaigns; 63 file hashes are recorded in `demos/4x-game-lab/voidward/mods/HORIZONS_PROVENANCE.json` |
| [OFFLINE-GAMES](https://github.com/QSOLKCB/OFFLINE-GAMES) | `2ccc87108316327ff19b622d62952114d555aee7` | `README.md`, `HOW_TO_MAKE_OFFLINE_GAMES.md` | Independently authored complete game-folder exporter and offline creator help, preserving separate editable projects and gameplay output |
| [GAMES](https://github.com/QSOLKCB/GAMES) | `7e0a9019d07b491cffc9b698fa51acdb843c49cc` | `README.md`, game catalogue and local distribution instructions | Genre-oriented Creator Hub and small working starter recipes; no Three.js renderer or complete games copied |
| [E8_MUSIC](https://github.com/QSOLKCB/E8_MUSIC) | `d8e5983d84af03f03a969abe3356dcf80c0e0e97` | `README.md`, `js/e8-core.js` | Independently authored soundtrack mapping over VANILLAJS's existing 240-root generator; editable pitches and WAV/recipe/score export |
| [SONIFICATION](https://github.com/QSOLKCB/SONIFICATION) | `2ca65c6540d7051a77ed571b83f5a9df453094ec` | `README.md`, `APP/js/composition.js`, `APP/js/synthesis.js` | Explicit source/mapping/audio separation and a simple three-state creative source; this lab does not implement the ETQ-101/303 event protocol |
| [DRONE-RACER](https://github.com/QSOLKCB/DRONE-RACER) | `9fea5ce9bdcd1799e075afcc329972792e15b688` | `README.md`, `src/circuit.js`, `src/track.js`, `docs/HOW_TO_MAKE_A_DRONE_GAME.md` | Form-based loop authoring over VANILLAJS's already integrated exact-circuit contract; first-gate crossing follows the actual selected gate |

The existing VOIDWARD engine adaptation remains pinned to 4XGAMES
`030859385ac8929e066702ef8af0518663480653`. Its original five campaign simulation
receipts remain unchanged. New packs have source-identity, every-faction,
seed-zero, difficulty, turn, save-roundtrip and invalid-order/load tests. The
newer donor command deck and engine optimizations are not part of this import.

New editor work adds three undoable starters, configured gameplay pieces,
advisory checks that select the affected object, a basic view and current-scene
Play/save progress. These are original code over the existing schema and
preview; they do not replace the component/asset/campaign editors.

## Licences

4XGAMES, OFFLINE-GAMES and DRONE-RACER declare Apache-2.0; GAMES declares MIT;
E8_MUSIC and SONIFICATION declare MPL-2.0. The newly copied files are only the
three 4X campaign packs, kept under their existing Apache-2.0 attribution in
NOTICE. The new soundtrack, course UI, exporter and editor helpers are original
Apache-2.0 code. No new MPL source or music samples are copied. Existing
VOIDWARD vendored sources and their individual notices remain intact; this
upgrade does not relicense them.

## What the checks establish

Node tests cover bounded recipes, exact crossings, strict imports, ownership,
repeatable scores/PCM, packaging closure and no-overwrite failures. Packaged
Chromium checks cover real authoring controls, audio lifecycle, downloads,
responsive layout and offline reconstruction. Simulation tests do not establish
physical controller coverage, cross-browser float bit identity, device audio
identity, game balance or hardware performance. No hardware-runner workflow is
dispatched as part of this PR. The DEMO//SYNTH tracker proposal remains a future
project; this release adds short cues, not its full tracker or MOD exporter.

Registering the new browser coverage changes only the browser-policy digest in
the phase-006 source inventory. Mathematical sources, proof receipts and
archived evidence are unchanged; this inventory update is not a new Lean proof.
