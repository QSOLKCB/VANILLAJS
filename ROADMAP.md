# VANILLAJS roadmap

## Published baseline — v2.8.0, The Game Maker API

[v2.8.0](https://github.com/QSOLKCB/VANILLAJS/releases/tag/v2.8.0) was published on
16 November 2026 from `f7cd8d6a61791128b12fd72f8c94b6481889d197`, after
[PR #103](https://github.com/QSOLKCB/VANILLAJS/pull/103) was reviewed and merged.
It adds the owned Game Maker facade, layered tile worlds/body collision and the
complete portable platform-game workflow. This is the reviewed HORIZON baseline.

The published baseline has 67 experimental modules, 48 recipes and two research
experiments; [MODULES.json](MODULES.json) describes the current tree. Publication
does not imply stability. Historical `1.0.0` metadata is unchanged. The preceding
[v2.7.0 Scene & Narrative Foundry](https://github.com/QSOLKCB/VANILLAJS/releases/tag/v2.7.0),
Sprite/Game Feel and Creator Gateway, existing labs/Workbench, maths and offline
contracts remain. Browser reuse retains its [source-bound authority rules](docs/BROWSER_CACHE.md).

## ENGINE-EXPANSION-001 — sequential creator milestones

**Build the engine first.** Implement one milestone, verify its real workflows
and obtain owner review before starting the next. Owner merge and release are
separate decisions; no automatic tagging, publishing or deployment is authorised.
**Games2 remains unmodified during this programme.**

| Release | Milestone | Status and dependency |
| --- | --- | --- |
| v2.6.0 | **SPRITE-FEEL-001 — Game Feel & Sprite Foundry** | Published; owner merged PR #101 and released v2.6.0 |
| v2.7.0 | **SCENE-NARRATIVE-001 — Scene & Narrative Foundry** | Published; owner merged PR #102 and released v2.7.0 |
| v2.8.0 | **GAME-MAKER-001 — Game Maker API** | Published; owner merged PR #103 and released v2.8.0 |
| v2.9.0 | **HORIZON-3D-001 — 3D Racing Foundry** | HORIZON-001 through 010 merged. Physical-GPU comparison, owner play-through and publication pending |

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

### v2.8.0 — Game Maker API (published)

[Milestone contracts, creator workflow and verification](docs/GAME_MAKER_001.md).

The published release adds an owned drawing/input/clock/audio facade, bounded layered
tilemaps and integer whole-body sweeps composed with existing motion laws. Game
Maker Lab teaches actual playable platform rules from an empty map through sprite,
level and interaction authoring to win/lose/restart and a complete offline ZIP.

The public-module Ember Relay example can be copied independently. Native runtime
packaging, source hashes, explicit resource disposal, creator guides and the agent
catalogue define what is reusable versus game-owned. Exports support these original
example rules, not arbitrary scripts or every Workbench project. Existing schemas,
numerical proofs and historical evidence remain.

### v2.9.0 — HORIZON, foundations and final polish

1. **HORIZON-001 (merged PR #105):** optional compatible native rendering/materials, lit geometry,
   procedural scenery, elevated/banked roads, original detailed vehicles, static
   batching and bounded low/high visual profiles. [Contracts and evidence](docs/HORIZON_001.md).
2. **HORIZON-002 (merged PR #107):** world-space SI vehicle dynamics, torque/gears, driven wheels,
   steering/grip/slip, four-wheel contact, suspension, elevation/banking,
   jump/landing and collision recovery with independent numerical reference cases.
   [Driving workflow and contracts](docs/HORIZON_002.md).
3. **HORIZON-003 (merged PR #108):** Track/Vehicle Foundries, data validation and retained history,
   original engine/tyre sound, scenic playable showcase with rival, camera choices,
   checkpoints/finish, full lifecycle, polish and verified offline export.
   [Creator workflow and completion evidence](docs/HORIZON_003.md).
4. **HORIZON-004 (merged PR #110):** curved procedural automotive geometry,
   material/environment polish, safe real reverse driving, camera/HUD improvements
   and matching visual/resource evidence. [Visual and driving polish](docs/HORIZON_004.md).
5. **HORIZON-005 through 008 (merged PRs #112, #113, #114 and #116):**
   bridge rails and recovery, assisted steering, rival contact, completed-gate
   visibility, start-boundary and terrain recovery, and reverse in Vehicle Dynamics.
6. **HORIZON-009 and 010 (merged PRs #117 and #118):** conservative visibility
   culling and retained roadside details. [Visibility](docs/HORIZON_009.md) and
   [graphics budgets and hardware measurement](docs/HORIZON_010.md).

Preserve current arcade handling and `qsol.vanillajs.track.v1`; elevated roads
require a versioned sidecar or separately reviewed migration. Real world-space
steering must not be disguised lane motion. Review screenshots and measured
budgets on identified hardware; GPU images never substitute for numerical tests.
The [v2.9.0 release handoff](docs/HORIZON_2_9_0_DRAFT.md#release-acceptance)
records the exact source, hosted checks and remaining device and driving checks.
The owner tags and publishes the accepted main revision. Publication opens
the implementation gate for [THE MACHINE DREAMS (#104)](https://github.com/QSOLKCB/VANILLAJS/issues/104)
and its [1080p exporter (#106)](https://github.com/QSOLKCB/VANILLAJS/issues/106).

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
| 2: Worlds and vehicles | Terrain, cuboid streaming, road-arcade, exact circuits; merged scenic3d/vehicle3d | Destruction, richer dynamic collisions and later route-authoring extensions beyond the HORIZON candidate |
| 3: Strategy | Navigation/flow fields, demo-owned RTS and VOIDWARD | Formations/unit behaviour, territorial and turn-based simulation |
| 4: Mechs and space | Flight, ballistics, orbital physics, space demonstrations | Mech combat, fleet combat and ship systems |
| 5: Persistent worlds | Existing bounded primitives and game-owned saves | Survival, crafting and world streaming policy |
| Continuing: creation | Soundtrack, demo-scene/timeline, data mods, replay and packaging | Better visual FX, procedural sound, mod workflows and tutorials |

The genre catalogue informs priorities; no row promises a complete new genre
engine. Each proposal needs a bounded contract, consumer, provenance and tests.

## Replay transport after v3.1.0

The conditional network phase builds on the published P6 replay authority. The [Replay Exchange candidate](docs/REPLAY_TRANSPORT_001.md) connects two browsers directly for one bounded transfer and verifies the tape on the receiving engine. Its scope is recorded runs. Live command replication would require its own authority contract.

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
