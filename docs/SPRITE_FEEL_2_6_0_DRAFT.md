# v2.6.0 — Game Feel & Sprite Foundry

**Draft release notes for owner review. This release has not been published.**

Create original pixel art and tune responsive first-person weapons using native
browser tools, portable data and small experimental APIs.

## Sprite Foundry

- Seeded original character, enemy, weapon, item, terrain, particle and impact
  generators at 8×8, 16×16, 32×32 and 64×64.
- Editable transparent RGBA palettes, symmetric/asymmetric generation and ordered
  animation frames with explicit durations.
- Zoomed pixel editing, pencil/erase/fill, frame duplication/reordering, animation
  preview, onion skin, undo/redo and validated project roundtrips.
- Current-frame PNG, spritesheet, atlas/mask metadata and portable project exports.
  Explicit opaque PNG export integrates with the existing Asset Foundry.
- New pure `sprite2d` API; exact source pixels are distinguished from
  browser-dependent PNG encoding.

## Weapon Feel Lab

- Three original profiles demonstrate precision, automatic and travelling-bolt
  weapons against moving targets using existing character/combat systems.
- Responsive look accumulation, coordinated ADS/FOV/sensitivity, bounded trigger
  buffering and weapon-switch protection.
- Seeded accuracy and recovery, cosmetic recoil, muzzle/hit/damage feedback,
  reload/change states and real shot/ray/cooldown diagnostics.
- Editable data-only weapon recipes, tutorial and opt-in `weapon-feel` adapter.
  Cosmetic weapon motion stays separate from authoritative combat direction.

## Creator and engineering integration

- Both labs are reachable through the Creator Hub and validated agent catalogue.
- Whole native import graphs use content-derived package identities, with browser
  tests for editing/gameplay, offline load and older-cache/failure recovery.
- Existing engine APIs, Workbench/Mod SDK formats, numerical proofs and historical
  evidence remain intact. No runtime packages, CDNs, accounts or remote models.
- AFTER//ZERO's requested source revision is audited as a behavioural reference;
  the new adapter and demonstrations are independently implemented.
- Scene/Narrative v2.7, Game Maker v2.8 and HORIZON v2.9 remain explicitly proposed
  milestones with separate review gates. Games2 remains unchanged.

## Limits and release gate

All APIs remain experimental. Sprite generation is bounded procedural art, not
AI image generation. Workbench's current texture renderer is opaque: transparent
animation stays in the sidecar. Weapon simulation is same-runtime Float64 with
explicit input/tick boundaries; PNG bytes and GPU pixels are not universal
determinism claims. Hardware/browser coverage is limited to actual recorded tests.

Review [contracts and execution evidence](SPRITE_FEEL_001.md) and both
[sprite](SPRITE_FOUNDRY.md) / [weapon](WEAPON_FEEL.md) tutorials before adoption.
Merge, tag, release and deployment require separate owner approval.

**Build the engine. Prove the physics. Make the tools. Teach the creator.**
