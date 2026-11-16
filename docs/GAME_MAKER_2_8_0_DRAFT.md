# v2.8.0 — The Game Maker API

**Draft release notes for owner review. This release has not been published.**

Build a first original 2D game with native JavaScript, portable data and an
explicitly owned engine API.

- **Game Maker API:** rectangles, circles, lines, text, sprites and tile layers;
  camera transforms; bounded seeded particles; supplied input and fixed clocks;
  existing local sound synthesis/playback; pause, reset and disposal.
- **Tilemap worlds:** validated sprite atlases, visual layers/parallax, collision
  grids, spawn/trigger markers and camera follow. Integer body sweeps compose
  existing motion laws without changing their defaults.
- **Game Maker Lab:** original sprite/tileset authoring, an empty template and
  playable starter, level editing, real collision/interactions, sound, win/lose,
  restart and project roundtrip.
- **Portable game ZIP:** actual native runtime, authored data, original example
  rules, licences/notices, SHA-256 manifest and verified scoped offline worker.
- **Creator and agent onboarding:** practical guides, public API examples,
  validated workflow catalogue, browser evidence and Games2 integration boundaries.

These are experimental APIs. Tile collision is bounded and axis-aligned; canvas
pixels are not a numerical proof. Export packages the example's declared rules,
not arbitrary imported scripts or Workbench projects. Device/browser coverage
is limited to the recorded execution.

Existing labs, Workbench formats, scene/narrative systems, Mod SDK, maths/proofs,
offline integrity and source-bound browser CI remain intact. No runtime npm
dependencies, remote assets, accounts or cloud services are added. Games2 is
unchanged; future adoption requires a separate reviewed immutable release pin.

[Milestone contracts and verification](GAME_MAKER_001.md).
HORIZON v2.9 remains proposed as three separately reviewed implementation PRs.
Merge, tag, release and deployment require separate owner approval.

**Build the engine. Prove the physics. Make the tools. Teach the creator.**
