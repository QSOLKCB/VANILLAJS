# v2.7.0 — Scene & Narrative Foundry

**Draft release notes for owner review. This release has not been published.**

Compose reusable scenes and author branching stories with native browser tools,
inspectable experimental APIs and portable data.

## Scene Composition

- New pure `scene-graph` module for hierarchical transforms, local/world
  conversions, camera/light/appearance descriptors and bounded traversal.
- Caller-time transform tracks and bounded nested prefabs, with validation
  before replacement and explicit renderer resource ownership/disposal.
- Workbench authoring and preview through a separate versioned scene sidecar.
  Existing v1/v2 scenes/projects and physics restrictions remain intact.

## Narrative Foundry

- New pure `narrative` module: nodes/dialogue, linked choices, typed variables,
  constrained conditions/effects, objectives/events and graph diagnostics.
- Deterministic choice traversal and exact-story-bound, replay-validated saves.
- Practical authoring and preview with an original branching story, distinct
  endings and an application-owned scene-event mapping.
- Reusable story/progress exports; imported stories remain inert data.

## Creator integration and boundaries

- Human tutorials, public-module examples and validated agent workflows.
- Creator Hub navigation, content-derived offline packaging and browser checks
  for authoring, rollback, scene effects, exports, narrow layouts and recovery.
- Existing game labs, Sprite/Weapon Feel, Demoscene, engine contracts, licensing,
  numerical proofs and historical evidence remain supported.
- No runtime npm packages, third-party engine, cloud service or remote assets.
- Games2 remains unchanged; future adoption requires its own reviewed release pin.

Both APIs are experimental. Narrative determinism is separate from Float64 scene
transforms and GPU output. Scene metadata is not a complete lighting/physics engine;
exports are reusable data, not arbitrary complete games. Device/browser coverage
is limited to recorded execution.

[Milestone contracts and verification](SCENE_NARRATIVE_001.md).
Game Maker v2.8 and the three-part HORIZON v2.9 remain proposed future work.
Merge, tag, release and deployment require separate owner approval.

**Build the engine. Prove the physics. Make the tools. Teach the creator.**
