<p align="center"><img src="assets/vanillajs-hero.svg" width="100%" alt="VANILLAJS — Build games. Extend the engine. Own your creations." /></p>

# VANILLAJS 👽

**Build games. Extend the engine. Own your creations.**

VANILLAJS is a native JavaScript engine workshop: reusable physics and maths,
playable Game Labs, visual tools, data-only mods and education. Start with a
working scene, change one thing, test it, and keep the files you create.

**QSOL-IMC — THIS IS NOT A PRODUCT. THIS IS INDEPENDENCE.**

[Play the published labs](https://qsolkcb.github.io/VANILLAJS/) ·
[Start here](docs/START_HERE.md) · [Creator Hub](demos/creator-hub/index.html) ·
[Interactive Tutorial Lab](demos/tutorial-lab/index.html) ·
[Build with AI](#build-with-an-ai-agent) · [Modules](#modules)

**Merged into main:** [CHIP-AUDIO-001 — SID-style ADSR × Paula mixer](docs/CHIP_AUDIO_API.md) is an opt-in, deterministic four-channel 8-bit PCM stereo synthesizer and [offline listening lab](demos/chip-audio-lab/index.html). No existing sound module or game is modified.

**Merged into main:** [VANILLAJS-25D-001](docs/PROJECTION25D_API.md) provides experimental, opt-in pure projection geometry, an [offline 2.5D demonstration](demos/projection25d-lab/index.html) and a bounded authoring-only OBJ conversion tool. This does not alter existing simulation or HORIZON rendering.

**Merged:** [COCKPIT-001 — Cockpit & Physics Lab](docs/COCKPIT_PHYSICS_001.md) pairs pure camera/sight validation with existing 6DOF flight and four-wheel vehicle physics plus a bounded arcade airframe. [Try the original Spitfire-inspired prop fighter, spacecraft and car demo](demos/cockpit-physics-lab/index.html). No existing physics or game rules are replaced.

**COCKPIT-002 candidate:** [TOO CLOSE FOR GUNS — SWITCHING TO MISSILES!](demos/cockpit-physics-lab/index.html) upgrades the same cockpit with four game-owned, fixed-tick homing missiles, physical lock/cooldown/impact tests, and a preserved F-key gunsight. [Implementation and limits](docs/COCKPIT_PHYSICS_001.md). This is an experimental review branch, not a tagged release.

**Proposed next-engine roadmap:** [OSS-GAME-REUSE-001 — source-pinned eight-collection audit and VANILLAJS milestones](docs/OSS_GAME_REUSE_2026_ROADMAP.md). It prioritises shared visibility/perception, guided combat integration and retained-world LOD, with explicit code-vs-asset licensing gates. No third-party code has been imported.

## Welcome to the foundry

**VANILLAJS = engine, physics, Game Labs, mods, tools and education.**
**Games2 = actual games, independent game directories, content, gameplay and releases.**

A Game Lab is a working example you can play and inspect. A module is a reusable
part: collision answers whether bodies hit; game logic decides what a hit means.
VANILLAJS supplies both reusable parts and examples of composing them.
It is not a universal game compiler, a hosted service or a guarantee that an
experimental API will never change.

- Native ES modules, WebGL, Canvas, SVG and Web Audio.
- No runtime package installation, CDN, accounts or cloud service required.
- Small one-way dependencies; game worlds and interfaces stay with their games.
- Local files, validated imports and explicit numerical boundaries.
- Apache-2.0 code with preserved source attribution and third-party notices.

**Make amazing alien tech and put it under an Apache 2.0 license.**

## Published milestones

**Latest published release: [v2.8.0 — The Game Maker API](https://github.com/QSOLKCB/VANILLAJS/releases/tag/v2.8.0).**
Published 16 November 2026 from `f7cd8d6a61791128b12fd72f8c94b6481889d197`,
after owner review and merge of [PR #103](https://github.com/QSOLKCB/VANILLAJS/pull/103).
Draw with an owned browser API, author sprites and layered tile worlds, test an
original platform game and export its complete offline ZIP. The Game Maker Lab
and public-module Ember Relay example use the same reusable engine contracts.

[v2.7.0 — Scene & Narrative Foundry](https://github.com/QSOLKCB/VANILLAJS/releases/tag/v2.7.0)
introduced hierarchical scene sidecars and inert branching stories.
[v2.6.0 — Game Feel & Sprite Foundry](https://github.com/QSOLKCB/VANILLAJS/releases/tag/v2.6.0)
introduced seeded sprite authoring and reusable FPS weapon presentation.
[v2.5.0 — Creator Gateway](https://github.com/QSOLKCB/VANILLAJS/releases/tag/v2.5.0)
introduced progressive guides, Tutorial Lab and the validated agent catalogue.
[v2.4.0 — Demoscene Foundry](https://github.com/QSOLKCB/VANILLAJS/releases/tag/v2.4.0)
introduced audiovisual composition and **The Machine Remembers**. Publication does
not imply API stability.

The published v2.8.0 baseline has **67 experimental modules, 48 recipes and two
research experiments**. Merged HORIZON-001 adds lit rendering and scenery.
Merged HORIZON-002 adds vehicle dynamics. Merged HORIZON-003 adds
vehicle audio and racing authoring: **71 modules, 51 recipes**,
with research unchanged.
[MODULES.json](MODULES.json) is authoritative. Its `release` and the private
`package.json` version retain historical `1.0.0` metadata, not GitHub release numbers.

**HORIZON Racing Foundry — merged through HORIZON-010, awaiting v2.9.0:** [Race Foundry](demos/horizon-lab/index.html)
combines elevated route editing, vehicle and sound tuning, retained history and
an original scenic race against a physics-driven rival. Drive through ordered
checkpoints, switch cameras and export the complete local race package.
[Vehicle Dynamics](demos/horizon-lab/drive.html) and the
[Scenery Atelier](demos/horizon-lab/scenery.html) remain specialist tools.
Course assist helps you brake into corners. Cars exchange momentum on contact,
bridge rails constrain the wheelside corridor, and recovery returns you to the
last accepted gate. Completed gates clear from view. The two detail profiles
now draw retained roadside posts, reflectors and signs.

[Creator tutorial](docs/HORIZON_RACING.md) · [v2.9.0 release notes and acceptance](docs/HORIZON_2_9_0_DRAFT.md) · [Programme](docs/ENGINE_EXPANSION_001.md).

## Run the labs

For a local checkout, use Python's standard-library HTTP server:

```sh
git clone https://github.com/QSOLKCB/VANILLAJS.git
cd VANILLAJS
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/demos/creator-hub/` in a modern browser.
For the beginner lesson, open `http://127.0.0.1:8000/demos/tutorial-lab/`.
Keep the server running; Ctrl+C stops it. No `npm install` is needed.

- **Play:** choose a Game Lab in the hub or the table below.
- **Create:** load Playground in the Tutorial Lab, edit speed and test.
- **Modify:** open your downloaded project in the Visual Workbench, or use a
  specialist lab's validated data pack controls.

Use HTTP rather than double-clicking HTML: native module imports need an origin
and correct MIME types. Offline caching requires a packaged build served first
on localhost or HTTPS. A fresh browser cannot fetch a site it has never cached.
See [troubleshooting](docs/TROUBLESHOOTING.md).

## Find your next lab

All of these are experimental learning surfaces. Their limits are part of their
contracts, even when the demonstrations are playable.

| Build or investigate | Working entry point | Guide |
| --- | --- | --- |
| Build, race and export a scenic 3D route | [HORIZON Race Foundry](demos/horizon-lab/index.html) | [Author your first race](docs/HORIZON_RACING.md) |
| World-space driving, gearing and suspension | [HORIZON Driving](demos/horizon-lab/drive.html) | [Tune and test a vehicle](docs/HORIZON_DRIVING.md) |
| Lit 3D scenery, roads and vehicle visuals | [Scenery Atelier](demos/horizon-lab/scenery.html) | [Rendering and environment tutorial](docs/HORIZON_LAB.md) |
| Build a complete small 2D game | [Game Maker Lab](demos/game-maker-lab/index.html) | [Create, play and export](docs/GAME_MAKER_LAB.md) |
| First scene, without coding | [Tutorial Lab](demos/tutorial-lab/index.html) | [Quickstart](docs/CREATOR_QUICKSTART.md) |
| Branching stories and dialogue | [Narrative Foundry](demos/narrative-foundry/index.html) | [Author and preview a story](docs/NARRATIVE_FOUNDRY.md) |
| Hierarchies, animation and nested prefabs | [Workbench Scene Composition](demos/editor/index.html) | [Compose a reusable scene](docs/SCENE_COMPOSITION.md) |
| Original pixel art and animation | [Sprite Foundry](demos/sprite-foundry/index.html) | [Generate, edit and export sprites](docs/SPRITE_FOUNDRY.md) |
| FPS weapon feel and aim | [Weapon Feel Lab](demos/weapon-feel-lab/index.html) | [Tune input, ADS and weapon presentation](docs/WEAPON_FEEL.md) |
| 2D movement and arcade combat | [2D Foundry](demos/2d-lab/index.html), [Arcade Combat](demos/arcade-combat-lab/index.html) | [2D foundation](docs/2D_FOUNDATION.md), [Arcade foundation](docs/ARCADE_FOUNDATION_001.md) |
| Blocky FPS | [Block Arena](demos/block-arena-lab/index.html) | [First blocky FPS](docs/BUILD_YOUR_FIRST_BLOCKY_FPS.md) |
| Demoscene and visual FX | [The Machine Remembers](demos/demoscene-lab/index.html) | [First demoscene intro](docs/MAKE_YOUR_FIRST_DEMOSCENE_INTRO.md) |
| Racing and tracks | [Racing / Track Foundry](demos/racing-lab/index.html), [Exact circuits](demos/circuit-mod-lab/index.html) | [Racing Lab](docs/RACING_LAB.md), [Course SDK](docs/MOD_SDK_002.md) |
| 4X campaigns | [VOIDWARD](demos/4x-game-lab/voidward/index.html) | [Creator guide](docs/CREATOR_GUIDE.md) |
| Procedural music | [Soundtrack Lab](demos/soundtrack-lab/index.html) | [Creator guide](docs/CREATOR_GUIDE.md) |
| Scenes, assets and prefabs | [Visual Workbench / Asset Foundry](demos/editor/index.html) | [Workbench contracts](docs/EDITOR_WORKBENCH.md) |
| Flight and space | [Flight Lab](index.html), [Space Lab](demos/space-lab/index.html) | [Build a game recipes](BUILD_A_GAME.md) |
| Grounded FPS and navigation | [FPS Lab](demos/fps-lab/index.html), [RTS Lab](demos/rts-lab/index.html) | [FPS](docs/FPS_LAB.md), [RTS](docs/RTS_LAB.md) |

## Creator tools and Visual Workbench

The [Creator Hub](demos/creator-hub/index.html) connects scenes, campaigns, tracks,
soundtracks and the specialist foundries. Use the tool that owns your format;
a soundtrack recipe, FPS pack and Workbench project are different contracts.

The [Visual Workbench](demos/editor/index.html) includes starter scenes, hierarchy,
transform editing, components, scene checks, undo, local recovery, assets and
prefabs. Its 4X and Visual FX panels support their own authoring workflows.

**Save project** keeps the scene and asset library together. **Open project**
restores them. Download a copy before closing the browser; local recovery is
not a portable backup. The [detailed creator guide](docs/CREATOR_GUIDE.md) explains
the controls and the [Workbench reference](docs/EDITOR_WORKBENCH.md) defines limits.

## Build a game

1. Follow [Start here](docs/START_HERE.md) and the
   [interactive quickstart](docs/CREATOR_QUICKSTART.md).
2. Choose a working lab close to your mechanic. Read its contract before editing.
3. Change data first; validate it and test the visible result.
4. Put your own rules, objectives, menus, art and progression in your game.
5. Pin a reviewed engine commit or release, retain its notices, and test the
   modules you consume before adopting another version.

[How to build a game](docs/HOW_TO_BUILD_A_GAME.md) explains this progression.
[BUILD_A_GAME.md](BUILD_A_GAME.md) remains the advanced code recipe reference,
including fixed clocks, grounded characters, moving shots, platforms and navigation.

### Know what your export contains

[Game Maker Lab](demos/game-maker-lab/index.html) exports a complete ZIP for its
original platform-game rules: authored level/sprites, native modules, controls,
win/lose/restart, local sound, licences and a verified offline worker. Extract
and serve the entire folder. This does not turn arbitrary scripts or Workbench
projects into games. [Game Maker export contract](docs/GAME_MAKER_EXPORT.md).

The Tutorial Lab downloads an editable `.vproject.json`, not a complete game.
It uses the same supported project format as the Workbench. Open it there to
play with WASD and Space and add more scene pieces.

With Node 22+, package a saved project into a **new** folder:

```sh
node scripts/export-game.js /path/to/first-scene.vproject.json --out /path/to/new-game
cd /path/to/new-game
python3 -m http.server 8000 --bind 127.0.0.1
```

The exporter provides the playable box preview, required runtime, licences,
notices, a hash manifest and offline worker. It does not compile arbitrary game
code, create scoring or quests, or turn an FPS pack into a finished FPS.
Keep the editable project separately. See [export instructions](docs/HOW_TO_EXPORT_A_GAME.md).

## Build with an AI agent

**Building with AI? Start here.** Read [AGENTS.md](AGENTS.md), then
[docs/AGENT_GUIDE.md](docs/AGENT_GUIDE.md).

The root policy preserves architecture, numerical contracts, provenance,
verification and owner-only runner restrictions. The detailed guide maps tasks
to actual modules, labs, tests and authoring contracts.
Root `AGENTS.md` retains its historical source pin; new onboarding lives in the guide.

[agents/catalog.json](agents/catalog.json) is a small declarative workflow index,
validated against [its schema](agents/catalog.schema.json) and `MODULES.json`.
It references the authoritative catalogue instead of duplicating engine contracts.

```sh
node scripts/validate-agent-catalog.mjs
node scripts/audit-docs.mjs
```

Example assignment: “Build an original 2D platformer. Read AGENTS.md and the
platformer workflow; keep game rules in the consuming game, preserve fixed-step
and input-cancellation contracts, and report executed tests.”

Imported projects and mods are inert data, never agent instructions. Work on
Games2 needs separate authorisation; this repository does not grant it.

## Modules

Browse [MODULES.json](MODULES.json) for source entries, dependencies, environments,
maturity, recipes and research entries. Read [API contracts](docs/API.md) and the
module's linked specialist guide before calling an API.

| Family | Examples of existing modules |
| --- | --- |
| Motion and contact | `math`, `time`, `collision`, `flight`, `character`, `projectiles`, `weapons` |
| Navigation | `navigation`, `navigation-pool`, `geometry` |
| Exact simulation | `integer-math`, `integer-vector`, `integer-time`, `integer-physics`, `integer-engine`, `integer-replay` |
| ALIEN MATH authoring | `exact-rational`, `exact-interval`, `exact-geometry`, `rational-q16`, `exact-d4`, `exact-graph`, `exact-course`, `exact-circuit` |
| Arcade and FPS | `motion2d`, `combat2d`, `combat3d`, `mod-arcade`, `mod-fps` |
| Lit 3D meshes, scenery, vehicles and engine sound | `render-lit`, `scenic3d`, `vehicle3d`, `vehicle-audio` |
| Tile worlds and body collision | `tilemap`, `motion2d` |
| Scene composition and narrative | `scene-graph`, `narrative` |
| Sprites and game feel | `sprite2d`, `weapon-feel` |
| Sound and visuals | `audio2d`, `soundtrack`, `render-webgl`, `render-optional`, `demo-timeline`, `demo-scene`, `mod-demo` |
| Data-only modding | `mod-sdk`, `mod-course`, `mod-experiment`, `mod-football` |

These are experimental APIs. New reusable behaviour belongs in a module only
when it has a concrete contract and tests; game fiction and DOM layout do not.

## Modding and offline packaging

Use [How to mod a game](docs/HOW_TO_MOD_A_GAME.md) to choose the correct data
adapter. [MOD-SDK-001](docs/MOD_SDK_001.md) provides bounded registry admission
and transactional activation; each adapter defines its own content schema.
It is not an executable plugin system.

Build the entire lab site using standard Node tooling:

```sh
node scripts/build.js
node scripts/verify-offline.js
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Serve the complete `dist/` folder. The generated worker binds the packaged assets
to their hashes. Wait for installation before testing offline reload. Keep all
runtime imports local and preserve LICENSE, NOTICE and asset attribution.

## Architecture and numerical guarantees

Dependencies flow one way as declared in `MODULES.json`. Pure modules have no
DOM, ambient clock or unseeded randomness. Demos own rendering lifecycle, input,
worlds and progression; reusable physics stays independent of a game's fiction.
See [architecture](docs/ARCHITECTURE.md).

### Numerical boundaries matter

- Exact Q16.16 guarantees apply within documented integer domains, rounding and
  overflow checks. They do not make all rendering or Float64 physics exact.
- ALIEN MATH and QFLOAT authoring adapters preserve their specified conversion
  boundaries; they are not replacements for the underlying arithmetic backend.
- Fixed-step simulation and replay require explicit input, seed, ordering and
  version contracts. Do not promise bit-exact results for every browser API.
- Formal claims apply to the stated model and source-conformance boundary.
  Hardware speedups require actual measurements, not mathematical extrapolation.

Read [integer engine](docs/INTEGER_ENGINE.md), [ALIEN MATH](docs/ALIEN_MATH_FINAL.md)
and the [preserved research reference](README_HISTORY.md) for deeper explanations,
source attribution, proof boundaries and evidence links.

## Development and verification

Use Node 22+ for repository tools. No runtime dependency installation is needed.

```sh
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
node scripts/audit-docs.mjs
git diff --check
```

Changed browser surfaces require packaged Chromium interactions and offline
startup checks. With the existing external Playwright tooling configured:

```sh
node scripts/browser-check.js --suites=editor
```

The source-bound browser CI policy remains in force. Unknown changes force real
browser execution; owner-only physical runners must not execute PR code.
[Browser cache operation and activation requirements](docs/BROWSER_CACHE.md).
[Verification history](docs/VERIFICATION.md) and the
[Creator Gateway execution record](docs/CREATOR_GATEWAY_VERIFICATION.md) distinguish
actual execution, historical evidence and unavailable hardware coverage.

## Games2 relationship and roadmap

[ROADMAP.md](ROADMAP.md) records the Creator Gateway planning baseline and future
capability proposals. The Creator Gateway is now published as v2.5.0.
[Games2 integration](docs/GAMES2_INTEGRATION.md)
records every current concept, donor reference and previously proposed candidate.

Games2 games consume a reviewed engine release independently. Reusable systems
may return through a separate provenance, licence, numerical and test review,
an owner-approved PR, and a lab or tutorial. There is no automatic promotion.
The initial review cadence is every three completed games, with early review
permitted for substantial shared systems or fixes.

## Research, provenance and deeper references

The [original README](README_HISTORY.md) and [roadmap archive](ROADMAP_HISTORY.md)
retain their complete audited text, including historical statements that no
longer describe the latest release. They remain at the repository root so their
relative source, document and evidence links keep their original meaning.

Research experiments are distinct from engine modules. Existing proof files,
receipts and numerical evidence have not been rewritten for onboarding.
Consult [LICENSE](LICENSE), [NOTICE](NOTICE), and the
[creator donor review](docs/CREATOR_DONOR_REVIEW.md) before adapting source.
Repository availability alone does not grant permission to copy arbitrary game
assets or third-party source.

## GitHub Pages

The [published site](https://qsolkcb.github.io/VANILLAJS/) serves packaged labs.
For a reproducible personal project, keep a reviewed local engine snapshot and
serve its full exported folder. A live site can change independently of your pin.

## Historical section navigation

Earlier research and feature headings remain reachable below. Follow each link
for the original technical explanation and evidence; historical release claims
inside that archive are not current release announcements.

<a id="next-up-the-demoscene-foundry-"></a>
[Next up: The Demoscene Foundry 👽🎵](README_HISTORY.md#next-up-the-demoscene-foundry-)

<a id="the-fps-foundry--released-in-v230"></a>
[The FPS Foundry — released in v2.3.0](README_HISTORY.md#the-fps-foundry--released-in-v230)

<a id="build-your-advantage"></a>
[Build your advantage](README_HISTORY.md#build-your-advantage)

<a id="make-the-next-arena-yours"></a>
[Make the next arena yours](README_HISTORY.md#make-the-next-arena-yours)

<a id="games-and-worlds"></a>
[Games and worlds](README_HISTORY.md#games-and-worlds)

<a id="mechanics-you-can-take-apart"></a>
[Mechanics you can take apart](README_HISTORY.md#mechanics-you-can-take-apart)

<a id="create-compose-and-investigate"></a>
[Create, compose and investigate](README_HISTORY.md#create-compose-and-investigate)

<a id="a-small-public-fps-integration"></a>
[A small public FPS integration](README_HISTORY.md#a-small-public-fps-integration)

<a id="alien-math-and-research-boundaries"></a>
[ALIEN MATH and research boundaries](README_HISTORY.md#alien-math-and-research-boundaries)

<a id="you-didnt-invent-doom-edition--exact-q1616-and-formal-verification"></a>
[You Didn't Invent Doom Edition — exact Q16.16 and formal verification](README_HISTORY.md#you-didnt-invent-doom-edition--exact-q1616-and-formal-verification)

<a id="q16-formal-001--lean-theorem-and-source-conformance-evidence"></a>
[Q16-FORMAL-001 — Lean theorem and source-conformance evidence](README_HISTORY.md#q16-formal-001--lean-theorem-and-source-conformance-evidence)

<a id="qwen3-vl-2b-textimage-response-isolation"></a>
[Qwen3-VL 2B text/image response isolation](README_HISTORY.md#qwen3-vl-2b-textimage-response-isolation)

<a id="freedm-open-weight-model-comparison--experimental"></a>
[FreeDM open-weight model comparison — experimental](README_HISTORY.md#freedm-open-weight-model-comparison--experimental)

<a id="experimental-freedm--four-terra-deathmatch"></a>
[Experimental FreeDM × Four Terra deathmatch](README_HISTORY.md#experimental-freedm--four-terra-deathmatch)

<a id="2d-foundry--gameplay-movement-sound-and-ternary-memory"></a>
[2D Foundry — gameplay movement, sound and ternary memory](README_HISTORY.md#2d-foundry--gameplay-movement-sound-and-ternary-memory)

<a id="november-donor-upgrade--clock-pacing-lead-solving-and-vault-graphics"></a>
[November donor upgrade — clock pacing, lead solving and vault graphics](README_HISTORY.md#november-donor-upgrade--clock-pacing-lead-solving-and-vault-graphics)

<a id="bloat-ops-nexus-and-uff-experimental-research-kernels"></a>
[BLOAT-OPS, NEXUS and UFF experimental research kernels](README_HISTORY.md#bloat-ops-nexus-and-uff-experimental-research-kernels)

<a id="qwaketf-style-reusable-broadphase-scratch"></a>
[QwakeTF-style reusable broadphase scratch](README_HISTORY.md#qwaketf-style-reusable-broadphase-scratch)

<a id="arcade-inspired-idle-frame-reuse"></a>
[ARCADE-inspired idle frame reuse](README_HISTORY.md#arcade-inspired-idle-frame-reuse)

<a id="experimental-pooled-navigation"></a>
[Experimental pooled navigation](README_HISTORY.md#experimental-pooled-navigation)

<a id="renderer-independent-appearance-composition"></a>
[Renderer-independent appearance composition](README_HISTORY.md#renderer-independent-appearance-composition)

<a id="opt-in-adaptive-query-and-cuboid-streaming-kernels"></a>
[Opt-in adaptive query and cuboid streaming kernels](README_HISTORY.md#opt-in-adaptive-query-and-cuboid-streaming-kernels)

<a id="optional-terrain-and-ballistic-kernels"></a>
[Optional terrain and ballistic kernels](README_HISTORY.md#optional-terrain-and-ballistic-kernels)

<a id="integer-engine--checked-q1616-simulation"></a>
[Integer engine — checked Q16.16 simulation](README_HISTORY.md#integer-engine--checked-q1616-simulation)

<a id="flight-lab"></a>
[Flight Lab](README_HISTORY.md#flight-lab)

<a id="interaction-lab"></a>
[Interaction Lab](README_HISTORY.md#interaction-lab)

<a id="fps-lab"></a>
[FPS Lab](README_HISTORY.md#fps-lab)

<a id="rts-lab"></a>
[RTS Lab](README_HISTORY.md#rts-lab)

<a id="omi-lab--research-experiment"></a>
[OMI Lab — research experiment](README_HISTORY.md#omi-lab--research-experiment)

<a id="the-brass-engine--a-mechanical-omi-demonstration"></a>
[The Brass Engine — a mechanical OMI demonstration](README_HISTORY.md#the-brass-engine--a-mechanical-omi-demonstration)

<a id="the-clockwork-vault--v100-showcase"></a>
[The Clockwork Vault — v1.0.0 showcase](README_HISTORY.md#the-clockwork-vault--v100-showcase)

<a id="explicit-gpu-api-experimental"></a>
[Explicit GPU API (experimental)](README_HISTORY.md#explicit-gpu-api-experimental)

<a id="owner-activated-rtx-5060-ti-full-path-validation"></a>
[Owner-activated RTX 5060 Ti full-path validation](README_HISTORY.md#owner-activated-rtx-5060-ti-full-path-validation)

<a id="optional-cpu--gpu-graphics-and-space-labs"></a>
[Optional CPU / GPU graphics and space labs](README_HISTORY.md#optional-cpu--gpu-graphics-and-space-labs)

<a id="authorship-and-attribution-clarification--comment-001"></a>
[Authorship and attribution clarification — COMMENT-001](README_HISTORY.md#authorship-and-attribution-clarification--comment-001)

<a id="scope-and-licence"></a>
[Scope and licence](README_HISTORY.md#scope-and-licence)
