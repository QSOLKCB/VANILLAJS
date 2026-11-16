# Build a game

Start with one mechanic and a working template. A lab is a reference composition,
not a promise that its rules already match your intended game.

| Your idea | Starting point | Contract |
| --- | --- | --- |
| A first platform scene | [Tutorial](../demos/tutorial-lab/index.html), [Workbench](../demos/editor/index.html) | [Workbench](EDITOR_WORKBENCH.md) |
| Original 2D platformer or arcade game | [2D Lab](../demos/2d-lab/index.html), [Arcade Combat](../demos/arcade-combat-lab/index.html) | [2D foundation](2D_FOUNDATION.md), [arcade](ARCADE_FOUNDATION_001.md) |
| Offline blocky FPS | [Block Arena](../demos/block-arena-lab/index.html) | [First FPS](BUILD_YOUR_FIRST_BLOCKY_FPS.md) |
| Procedural audiovisual demo | [Demoscene](../demos/demoscene-lab/index.html) | [First intro](MAKE_YOUR_FIRST_DEMOSCENE_INTRO.md) |
| Campaign, track or soundtrack | [Creator Hub](../demos/creator-hub/index.html) | [Creator guide](CREATOR_GUIDE.md) |

For scenes, select a starter, add platforms or triggers, edit transforms, then read
Scene checks before Play. Stop to edit and download Save project frequently.
For code, begin with the [existing fixed-loop recipes](../BUILD_A_GAME.md) and
read the selected modules in [MODULES.json](../MODULES.json). Use their declared
imports and contracts instead of inventing APIs.

Your game owns worlds, health rules, objectives, menus, saves and progression.
Keep reusable motion independent of those rules. Test fixed input and seed
sequences, rejected imports, restart, pause and lost focus. Test boundary cases
such as missing ground and blocked spawns as well as successful movement.

Pin a reviewed VANILLAJS release or immutable commit when copying a runtime into
your independently owned game. Record the commit and preserve LICENSE and NOTICE.
Experimental APIs can change; upgrade in a separate reviewed change with your
own game's prescribed tests. Games2 changes require their own PR and authorisation.

[Exporting](HOW_TO_EXPORT_A_GAME.md) packages supported Workbench scenes. A custom
game needs its own entry HTML and local imports, gameplay integration and tests.
Keep dependencies local, avoid CDNs and remote fonts/assets, and verify startup
with the network unavailable after cache installation or from a local server.
