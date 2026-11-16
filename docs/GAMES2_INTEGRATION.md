# Games2 ↔ VANILLAJS integration register

## Audited sources and ownership

Games2 main: `0329dd9b5a6ba8912b062696afdff6a3944619ab`, inspected 16 November 2026.
[Its immutable README](https://github.com/QSOLKCB/Games2/blob/0329dd9b5a6ba8912b062696afdff6a3944619ab/README.md)
is the current concept and donor catalogue. The tracked tree has README.md and an Apache-2.0 LICENSE;
no implementation, released game or per-game documentation was found. There are
no root AGENTS.md or ROADMAP.md files. No Games2 files are modified here.
VANILLAJS baseline: `128d7c924513f7d8ac08e2e11cc6832c5b7082fb`, published v2.4.0.

Games2 owns independent games, content, mechanics and releases. VANILLAJS owns
reusable engine systems, maths, physics, tools, labs and education. Games2 policy
is generally one new game per PR, later polish PRs, and one directory with its
own AGENTS.md and ROADMAP.md per game. Exceptions need explicit technical
justification. Existing ideas and donor lists must survive future planning edits.

## Review gates and cadence

The initial configurable threshold is **three completed games** since the last
review. Completion requires an independently runnable game, required documentation,
successful prescribed tests and an owner-approved release or equivalent reviewed
completion milestone. Current audited completed count: **zero**. No upstream
promotion review has been executed by this register. Next milestone: three
qualifying completions, or an explicitly approved earlier shared-system review.
This is roadmap policy, never an automatic CI trigger.

A substantial reusable mechanism or a fix needed by several games may be reviewed
earlier. Record counted game revisions, completion evidence, threshold changes,
owner decision and adoption PRs here when they exist. Do not infer completion
from a name in a README, donor availability or a published engine lab.

The two-way cycle is defined in [the roadmap](../ROADMAP.md#games2--vanillajs-integration-programme).
For each promotion, identify the concrete need, compare existing engine contracts,
pin source revisions, review licences and attribution per file, and independently
adapt or extract only the reusable portion. Record numerical domains, tolerances,
fixed-step/input policy and deterministic reference behaviour. Add tests and a
lab/tutorial. Obtain separate owner approval and open a focused VANILLAJS PR.
Engine publication and later Games2 adoption each require separate reviewed changes.
There is no automatic code promotion, arbitrary game-source copying or coupling.

## Register conventions

Status vocabulary: **proposed**, **in development**, **released**, **unknown**.
All current rows are proposed because only concepts were found, not game code.
Potential targets are suggestions; names ending “proposed” are not implemented APIs.

Every row requires gate **V**: seeded/fixed-input success and rejection tests,
replay where supported, declared numerical bounds, reference comparison for extracted
physics, packaged browser/lifecycle and offline startup checks. Every row requires
review **P**: immutable source revision, per-file licence and provenance, third-party
asset rights, attribution, independent adaptation/extraction decision and owner
approval. Inspiration names are not licences. V/P remain pending for every row.

## Full current Games2 concept catalogue

| Game or concept | Status | Candidate reusable mechanism | Potential module / lab | Verification | Source/licence/provenance | Upstream adoption |
| --- | --- | --- | --- | --- | --- | --- |
| System Shock-inspired FPS | proposed | Interaction, inventory and tactical navigation | interactions / navigation / FPS Lab | V pending | P pending; README concept only | None |
| Narc | proposed | Arcade enemy/weapon patterns | combat2d / Arcade Combat Lab | V pending | P pending; README concept only | None |
| Ninja Warriors | proposed | Arcade enemy/weapon patterns | combat2d / Arcade Combat Lab | V pending | P pending; README concept only | None |
| Shadow Warriors | proposed | Arcade enemy/weapon patterns | combat2d / Arcade Combat Lab | V pending | P pending; README concept only | None |
| The Punisher | proposed | Arcade enemy/weapon patterns | combat2d / Arcade Combat Lab | V pending | P pending; README concept only | None |
| Lethal Enforcers | proposed | Arcade enemy/weapon patterns | combat2d / Arcade Combat Lab | V pending | P pending; README concept only | None |
| Snow Brothers / Bubble Bobble | proposed | Platform capture and projectile interactions | motion2d / 2D Lab | V pending | P pending; README concept only | None |
| Shadow Dancer | proposed | Side-scrolling melee and enemy states | combat2d / Arcade Combat Lab | V pending | P pending; README concept only | None |
| Golden Axe | proposed | Side-scrolling melee and enemy states | combat2d / Arcade Combat Lab | V pending | P pending; README concept only | None |
| Syndicate FPS (2012)-style concept | proposed | Squad tactics and ranged combat | combat3d / navigation / FPS Lab | V pending | P pending; README concept only | None |
| Minecraft-style remake | proposed | Voxel worlds, crafting and streaming | cuboid-stream / terrain; survival lab proposed | V pending | P pending; README concept only | None |
| Survival Game remake | proposed | Voxel worlds, crafting and streaming | cuboid-stream / terrain; survival lab proposed | V pending | P pending; README concept only | None |
| Retro Pinball | proposed | Ball contacts and bounded event scoring | collision; pinball lab proposed | V pending | P pending; README concept only | None |
| Mortal Kombat | proposed | Fighting windows, state transitions and input journals | combat2d / Arcade Combat Lab | V pending | P pending; README concept only | None |
| Street Fighter 2 (README: Steet Fighter 2) | proposed | Fighting windows, state transitions and input journals | combat2d / Arcade Combat Lab | V pending | P pending; README concept only | None |
| Ninja Combat | proposed | Arcade combat and target patterns | combat2d / projectiles | V pending | P pending; README concept only | None |
| Cabal | proposed | Arcade combat and target patterns | combat2d / projectiles | V pending | P pending; README concept only | None |
| Starcraft | proposed | RTS navigation, unit orders and economy boundaries | navigation / RTS Lab | V pending | P pending; README concept only | None |
| Command & Conquer | proposed | RTS navigation, unit orders and economy boundaries | navigation / RTS Lab | V pending | P pending; README concept only | None |
| Starcraft UMS: WW2 mode | proposed | Data-driven scenarios and teams | mod-sdk / RTS Lab | V pending | P pending; README concept only | None |
| Starcraft UMS: paintball mode | proposed | Data-driven scenarios and teams | mod-sdk / RTS Lab | V pending | P pending; README concept only | None |
| Mech RTS + base building | proposed | Unit formations and placement validation | navigation; building adapter proposed | V pending | P pending; README concept only | None |
| Tower Defense Games | proposed | Paths, targeting and waves | navigation / projectiles | V pending | P pending; README concept only | None |
| Futuristic Carmen Sandiego-style investigation | proposed | Clue graphs and state transitions | interactions; investigation lab proposed | V pending | P pending; README concept only | None |
| Subspace: Continuum | proposed | Top-down inertial flight and combat | flight / projectiles | V pending | P pending; README concept only | None |
| Star Wars — The Arcade Game | proposed | Rail-flight targeting | flight / weapons | V pending | P pending; README concept only | None |
| Star Trek — Bridge Commander | proposed | Ship systems and fleet control | flight / orbital-physics; ship systems proposed | V pending | P pending; README concept only | None |
| Wing Commander IV / Prophecy-style simulation, without a 24 fps lock | proposed | Fixed-step flight and independent presentation | time / flight / Space Lab | V pending | P pending; README concept only | None |
| Super Mario 3-style platformer | proposed | Platforming, triggers and level structures | motion2d / 2D Lab | V pending | P pending; README concept only | None |
| Mario Kart-style racer | proposed | Vehicle handling, tracks and race items | road-arcade / Racing Lab | V pending | P pending; README concept only | None |
| Mechwarrior-style game | proposed | Mech movement and combat systems | character / combat3d; mech lab proposed | V pending | P pending; README concept only | None |

## Earlier proposals awaiting catalogue reconciliation

These were supplied as earlier proposals but are absent from the audited Games2
README. Preserve them here; do not silently add them to Games2 or call them implemented.

| Game or concept | Status | Candidate reusable mechanism | Potential module / lab | Verification | Source/licence/provenance | Upstream adoption |
| --- | --- | --- | --- | --- | --- | --- |
| Strike Pixel | proposed — awaiting catalogue reconciliation | 2D movement and combat | motion2d / combat2d | V pending | P pending; proposal only | None |
| Skynet: Future Shock-inspired FPS | proposed — awaiting catalogue reconciliation | FPS environments and weapon variants | character / combat3d | V pending | P pending; proposal only | None |
| Need for Speed II-inspired racer | proposed — awaiting catalogue reconciliation | Vehicle handling and track structure | road-arcade / Racing Lab | V pending | P pending; proposal only | None |
| Risk-inspired strategy | proposed — awaiting catalogue reconciliation | Territory graphs and turn resolution | exact-graph; strategy lab proposed | V pending | P pending; proposal only | None |
| Cannon Fodder-inspired tactical action | proposed — awaiting catalogue reconciliation | Squad orders and projectile contact | navigation / projectiles | V pending | P pending; proposal only | None |
| SWAT 4-inspired tactical FPS | proposed — awaiting catalogue reconciliation | Tactical AI, interactions and weapon policy | navigation / interactions / combat3d | V pending | P pending; proposal only | None |
| Original QwakeTF-derived boomer shooter | proposed — awaiting catalogue reconciliation | Fast movement and reusable broadphase | character / geometry / FPS Lab | V pending | P pending; proposal only | None |

## Preserved donor inventory

These are all references from the audited Games2 README, spanning mathematical,
sound, game, simulation and engine repositories. Listing them is not a licence
review, an implementation claim or approval to copy them. Classify and inspect
actual source/licences at immutable revisions when a candidate is selected.

- [E8](https://github.com/QSOLKCB/E8)
- [SPECTRAL](https://github.com/QSOLKCB/SPECTRAL)
- [SONIFICATION](https://github.com/QSOLKCB/SONIFICATION)
- [PSYCLE-LINUX](https://github.com/QSOLKCB/PSYCLE-LINUX)
- [GnG](https://qsolkcb.github.io/GnG/)
- [landfall-64](https://github.com/QSOLKCB/landfall-64)
- [AFTER-ZERO](https://github.com/QSOLKCB/AFTER-ZERO)
- [GAMES](https://github.com/QSOLKCB/GAMES)
- [CorpoWars](https://github.com/QSOLKCB/CorpoWars)
- [QwakeTF](https://github.com/QSOLKCB/QwakeTF)
- [CorpoWars3d](https://github.com/QSOLKCB/CorpoWars3d)
- [Ski-Shooter](https://github.com/QSOLKCB/Ski-Shooter)
- [QUICKSCOPER](https://github.com/QSOLKCB/QUICKSCOPER)
- [BLOAT-OPS](https://github.com/QSOLKCB/BLOAT-OPS)
- [DAMN](https://github.com/QSOLKCB/DAMN)
- [Bullet-Time](https://github.com/QSOLKCB/Bullet-Time)
- [OPT](https://github.com/QSOLKCB/OPT)
- [ARCADE](https://github.com/QSOLKCB/ARCADE)
- [OFFLINE-GAMES](https://github.com/QSOLKCB/OFFLINE-GAMES)
- [Spooky](https://github.com/QSOLKCB/Spooky)
- [Outruin](https://github.com/QSOLKCB/Outruin)
- [Soccerweb](https://github.com/QSOLKCB/Soccerweb)
- [SubHunt](https://github.com/QSOLKCB/SubHunt)
- [STREET-RACER](https://github.com/QSOLKCB/STREET-RACER)
- [4XGAMES](https://github.com/QSOLKCB/4XGAMES)
- [DRONE-RACER](https://github.com/QSOLKCB/DRONE-RACER)

## Future capability inputs

FPS weapons and tactical AI, procedural/destructible environments, platforming,
racing physics/tracks, RTS formations, territorial strategy, mechs, spaceflight
and fleet/ship systems, survival/crafting/streaming, FX/procedural sound, mods,
replay and packaging are candidate areas. Existing primitives and proposed
extensions are distinguished in [the priority table](../ROADMAP.md#later-priorities--proposals-not-v250-promises).
None is promised as a complete system in v2.5.0.
