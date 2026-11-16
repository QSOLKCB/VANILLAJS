# VANILLAJS roadmap

## Published baseline — v2.7.0, Scene & Narrative Foundry

[v2.7.0](https://github.com/QSOLKCB/VANILLAJS/releases/tag/v2.7.0) was published on
16 November 2026 from `70e63b902834ae31b994ea40ae584bd93892e6bf`, after
[PR #102](https://github.com/QSOLKCB/VANILLAJS/pull/102) was reviewed and merged.
It adds pure scene composition and narrative APIs, Workbench sidecar authoring
and Narrative Foundry. This is the reviewed base for v2.8.0.

The published baseline has 66 experimental modules, 47 recipes and two research
experiments; [MODULES.json](MODULES.json) describes the current tree. Publication
does not imply stability. Historical `1.0.0` metadata is unchanged. The preceding
[v2.6.0 Sprite/Game Feel](https://github.com/QSOLKCB/VANILLAJS/releases/tag/v2.6.0)
and [v2.5.0 Creator Gateway](https://github.com/QSOLKCB/VANILLAJS/releases/tag/v2.5.0),
existing engine/labs, Workbench/Asset Foundry, maths and offline contracts remain.
Browser reuse retains its [source-bound authority rules](docs/BROWSER_CACHE.md).

## ENGINE-EXPANSION-001 — sequential creator milestones

**Build the engine first.** Implement one milestone, verify its real workflows
and obtain owner review before starting the next. Owner merge and release are
separate decisions; no automatic tagging, publishing or deployment is authorised.
**Games2 remains unmodified during this programme.**

| Release | Milestone | Status and dependency |
| --- | --- | --- |
| v2.6.0 | **SPRITE-FEEL-001 — Game Feel & Sprite Foundry** | Published; owner merged PR #101 and released v2.6.0 |
| v2.7.0 | **SCENE-NARRATIVE-001 — Scene & Narrative Foundry** | Published; owner merged PR #102 and released v2.7.0 |
| v2.8.0 | **GAME-MAKER-001 — Game Maker API** | Current implementation candidate; v2.7.0 gate satisfied; owner review/release pending |
| v2.9.0 | **HORIZON-3D-001 — 3D Racing Foundry** | Proposed; three separately reviewed implementation PRs after preceding milestones |

[Detailed contracts, dependencies and acceptance gates](docs/ENGINE_EXPANSION_001.md)
distinguish existing primitives from future APIs. Every milestone needs a
reusable API, working lab, creator workflow, versioned data, tutorial, agent
integration, verification evidence and a future Games2 consumer seam.

### v2.6.0 — Game Feel & Sprite Foundry (published)

- Seeded original sprites, editable RGBA palettes, transparent pixels, animation
  frames, sheets/atlases, masks and bounded versioned import/export.
- Sprite Foundry: generate, paint/erase/fill, duplicate and edit frames, preview,
  undo/redo and export real reusable source data and PNGs.
- FPS weapon feel composed with existing input, character, weapons and combat:
  responsive look, ADS/FOV/sensitivity, explicit spread/recovery, trigger buffer,
  switch protection and cosmetic recoil separated from canonical shot direction.
- Weapon Feel Lab: three original profiles, moving hittable targets, actual
  tuning controls, ray/impact/cooldown diagnostics and inert recipe export.
- Exact source-pixel fixtures, strict rejection/rollback, cadence/ray/weapon
  tests, actual packaged browser editing/gameplay and offline/stale-worker checks.

The [AFTER//ZERO audit](docs/AFTER_ZERO_GAME_FEEL_AUDIT.md) records the reviewed
source pin, behavioural observations and licence boundaries. No donor campaign
or complete engine is copied. Sprite alpha/animation integration must preserve
the current Asset Foundry project schema; source RGBA equality does not imply
browser-encoded PNG byte equality.

### v2.7.0 — Scene & Narrative Foundry (published)

[Milestone contracts, creator workflows and evidence](docs/SCENE_NARRATIVE_001.md).

The published scene-graph API adds local/world affine transforms, camera/light
metadata, tracks and nested prefabs. Workbench authoring uses a separate validated
sidecar and explicitly owned preview; existing scene/project formats remain.

The published narrative API and lab provide original dialogue/choices, typed
conditions/effects, objectives/events, structural reachability/ending checks, bounded
cycles and replay-validated progress. Stories cannot execute code or HTML.

### v2.8.0 — Game Maker API (current candidate)

[Milestone contracts, creator workflow and verification](docs/GAME_MAKER_001.md).

The candidate adds an owned drawing/input/clock/audio facade, bounded layered
tilemaps and integer whole-body sweeps composed with existing motion laws. Game
Maker Lab teaches actual playable platform rules from an empty map through sprite,
level and interaction authoring to win/lose/restart and a complete offline ZIP.

The public-module Ember Relay example can be copied independently. Native runtime
packaging, source hashes, explicit resource disposal, creator guides and the agent
catalogue define what is reusable versus game-owned. Exports support these original
example rules, not arbitrary scripts or every Workbench project. Publication awaits
owner review; existing schemas, numerical proofs and historical evidence remain.

### v2.9.0 — HORIZON, three PRs

1. **HORIZON-001:** optional compatible native rendering/materials, lit geometry,
   procedural scenery, elevated/banked roads, original detailed vehicles, static
   batching and bounded low/high visual profiles.
2. **HORIZON-002:** world-space SI vehicle dynamics, torque/gears, driven wheels,
   steering/grip/slip, four-wheel contact, suspension, elevation/banking,
   jump/landing and collision recovery with independent numerical reference cases.
3. **HORIZON-003:** Track/Vehicle Foundries, data validation and retained history,
   original engine/tyre sound, scenic playable showcase with rival, camera choices,
   checkpoints/finish, full lifecycle, polish and verified offline export.

Preserve current arcade handling and `qsol.vanillajs.track.v1`; elevated roads
require a versioned sidecar or separately reviewed migration. Real world-space
steering must not be disguised lane motion. Review screenshots and measured
budgets on identified hardware; GPU images never substitute for numerical tests.
Publish v2.9.0 only after all three PRs and the complete milestone pass review.

## Games2 → VANILLAJS Integration Programme

1. Build a Games2 game using a reviewed VANILLAJS release.
2. Keep the game independently owned inside its own monorepo directory.
3. Develop and test its specific mechanics and content there.
4. Identify and document reusable innovations.
5. Review immutable revisions, provenance/licences, tests and numerical behaviour.
6. Independently adapt or extract suitable mechanisms into VANILLAJS.
7. Demonstrate them in a new Game Lab or creator tutorial.
8. Release the validated engine improvement with separate owner approval.
9. Let Games2 games adopt it through separate reviewed changes.

There is no automatic source promotion or direct repository coupling.
[The full integration register](docs/GAMES2_INTEGRATION.md) retains every current
Games2 idea, donor reference and distinguishable earlier proposal.

### Review milestone and completion criteria

Initial configurable policy: review after **three completed Games2 games** since
the previous integration review. This is a roadmap milestone, not a CI trigger.
Earlier review is permitted for a substantial reusable system or a fix needed
by multiple games. Record the counted games, source revisions, decisions and
next threshold in the integration register when a review actually occurs.

Completed means independently runnable, required documentation present,
prescribed tests successful, and an owner-approved release or equivalent
reviewed completion milestone. A README idea is not a completed game.
Promotion always needs separate owner approval and its own VANILLAJS PR.

Games2's own current policy governs game implementation and polish PRs.
Preserve its independent directories, ideas and donor lists. The linked
integration register records its historical source snapshot; its observation
that root instructions/roadmap were absent applies to that revision only.
This engine programme neither changes Games2 nor decides when its next game starts.

<a id="later-priorities--proposals-not-v250-promises"></a>

## Longer-term inputs — proposals beyond the scoped milestones

| Priority | Existing foundation | Candidate extension requiring review |
| --- | --- | --- |
| 1: FPS and arcade | Character/collision, combat2d/3d, mod adapters, navigation | Tactical AI, weapon/physics variants, platforming and side-scrolling systems |
| 2: Worlds and vehicles | Terrain, cuboid streaming, road-arcade, exact circuits | Destruction, procedural environments, racing handling and richer track authoring |
| 3: Strategy | Navigation/flow fields, demo-owned RTS and VOIDWARD | Formations/unit behaviour, territorial and turn-based simulation |
| 4: Mechs and space | Flight, ballistics, orbital physics, space demonstrations | Mech combat, fleet combat and ship systems |
| 5: Persistent worlds | Existing bounded primitives and game-owned saves | Survival, crafting and world streaming policy |
| Continuing: creation | Soundtrack, demo-scene/timeline, data mods, replay and packaging | Better visual FX, procedural sound, mod workflows and tutorials |

The genre catalogue informs priorities; no row promises a complete new genre
engine. Each proposal needs a bounded contract, consumer, provenance and tests.

## Historical milestones and evidence

The preceding [v2.4.0 Demoscene Foundry](https://github.com/QSOLKCB/VANILLAJS/releases/tag/v2.4.0)
was published from `128d7c924513f7d8ac08e2e11cc6832c5b7082fb` on
16 November 2026. It joined the 2D, Arcade Combat, Block Arena FPS, racing/track,
4X, soundtrack and Visual Workbench facilities; those capabilities are preserved.

[ROADMAP_HISTORY.md](ROADMAP_HISTORY.md) preserves the complete previous roadmap,
including its original completion states and then-current release wording.
[README_HISTORY.md](README_HISTORY.md) preserves research narrative and links.
[Verification history](docs/VERIFICATION.md) and the
[Creator Gateway record](docs/CREATOR_GATEWAY_VERIFICATION.md) distinguish
historical execution from this change's results. Evidence and proofs stay intact.
