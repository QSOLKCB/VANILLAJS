# VANILLAJS roadmap

## Published baseline — v2.4.0, The Demoscene Foundry

[v2.4.0](https://github.com/QSOLKCB/VANILLAJS/releases/tag/v2.4.0) was published on
16 November 2026 from `128d7c924513f7d8ac08e2e11cc6832c5b7082fb`.
It includes the Demoscene/Visual FX Foundry alongside the 2D, Arcade Combat,
Block Arena FPS, racing/track, 4X, soundtrack and Visual Workbench facilities.
The audited catalogue has 62 experimental modules, 43 recipes and two research
experiments. Publication does not imply API stability. Historical `1.0.0`
package/catalogue metadata remains unchanged.

## Proposed v2.5.0 — The Creator Gateway

- A concise landing page with preserved research and milestone references.
- Progressive human guides: start, build, modify, export and troubleshoot.
- Preserved agent policy, detailed task guidance and a validated declarative catalogue.
- Interactive Tutorial Lab: edit a supported scene, run real physics, diagnose a
  failure and export an editable project; navigation from the Creator Hub.
- Documentation audits, packaged browser interactions and offline evidence.
- Repair browser receipt reuse while retaining reviewed-main authority and all
  mandatory checks; see [activation requirements](docs/BROWSER_CACHE.md).
- A formal Games2 integration register and separately approved promotion process.

This is the scope of CREATOR-GATEWAY-001, not a release announcement.
Owner review, merge and publication are separate decisions. No physics rewrite,
new rendering backend, metadata migration or Games2 implementation is included.

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

Games2 generally starts one new game per PR, then polishes it in later PRs.
Each game owns a directory, AGENTS.md and ROADMAP.md. Exceptions need an explicit
technical justification. Preserve existing ideas and donor lists. At the reviewed
revision Games2 has no root AGENTS.md or ROADMAP.md; this PR creates neither.

## Later priorities — proposals, not v2.5.0 promises

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

[ROADMAP_HISTORY.md](ROADMAP_HISTORY.md) preserves the complete previous roadmap,
including its original completion states and then-current release wording.
[README_HISTORY.md](README_HISTORY.md) preserves research narrative and links.
[Verification history](docs/VERIFICATION.md) and the
[Creator Gateway record](docs/CREATOR_GATEWAY_VERIFICATION.md) distinguish
historical execution from this change's results. Evidence and proofs stay intact.
