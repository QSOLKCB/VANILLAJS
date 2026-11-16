# Modify a game with data

A mod pack describes allowed content. It is inert JSON, not JavaScript or agent
instructions. The receiving adapter decides which fields, sizes, versions and
numeric ranges are valid. A valid pack for one adapter is not valid for every game.

| Content | Tool | Contract |
| --- | --- | --- |
| Cardinal courses | [Circuit Foundry](../demos/circuit-mod-lab/index.html) | [MOD-SDK-002](MOD_SDK_002.md) |
| Arcade combat | [Arcade Combat](../demos/arcade-combat-lab/index.html) | [Arcade foundation](ARCADE_FOUNDATION_001.md) |
| FPS arena and weapons | [Block Arena](../demos/block-arena-lab/index.html) | [FPS foundation](FPS_FOUNDATION_001.md) |
| Audiovisual composition | [Demoscene](../demos/demoscene-lab/index.html) | [Demoscene contract](DEMOSCENE_001.md) |

Export a built-in pack first, keep an untouched copy, and change one supported
field. Validate in that same tool before activation. Test the changed behaviour,
export accepted data and reimport it. Invalid data must leave the accepted world
intact; read the diagnostic instead of deleting validation checks.

## Try one weapon change

In [Block Arena](../demos/block-arena-lab/index.html), wait for loading to finish
and scroll to **Your block. Your rules.**

1. Select **Export active pack** to keep the original accepted arena.
2. In **Weapon Foundry**, select **Needle / precision**, set **Damage** to **80**,
   and select **Update weapon draft**. This changes the draft, not the active match.
3. Select **Validate & test**, then **Enter the arena**. Use WASD to move, arrows
   or the mouse to aim, and F to fire. Escape pauses. Test the changed weapon.
4. Select **Export active pack** again, keep this new file separately, then use
   **Import pack** to reload it and check the changed Damage value.

The accepted pack contains arena, weapon and match data. It needs the matching
runtime to play; it is not a Workbench project. Continue with the
[first blocky FPS guide](BUILD_YOUR_FIRST_BLOCKY_FPS.md) for cover, spawns,
replay and a public-module integration example.

[MOD-SDK-001](MOD_SDK_001.md) defines registry admission and transactional
activation. Adapters add game-specific validation. No pack may execute scripts,
fetch remote dependencies or change agent policy. Retain source/licence information
for content and never assume an inspiration title grants copying rights.

Mod JSON alone contains neither a renderer nor a complete game. The consuming
game supplies runtime, input, physics integration and packaging. See
[export boundaries](HOW_TO_EXPORT_A_GAME.md) before sharing.
