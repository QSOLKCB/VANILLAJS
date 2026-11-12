# VOIDWARD campaign mode and Visual Editor workflow

[Open VOIDWARD](../demos/4x-game-lab/voidward/index.html) or the
[Visual Editor](../demos/editor/index.html). Both run from local ES modules and
the packaged offline site. VOIDWARD is a separate, experimental campaign demo
adapted from [4XGAMES PR #2](https://github.com/QSOLKCB/4XGAMES/pull/2), pinned to
`030859385ac8929e066702ef8af0518663480653`. The original
[Ternary Reach](4X_GAME_LAB.md) remains available with its existing rules and
`qsol.4x-replay.v1` format.

Three additional campaign packs come from `4XGAMES@382f458998cf3c28e82047f64709722761559034`: Helix Accord (24 stars), Emberwake Exodus (32 stars), and Glass Meridian (48 stars). Each adds three playable cultures and two objective branches. The existing core remains at its original pin; [creator provenance](CREATOR_DONOR_REVIEW.md) records this data-only update.

## Play a campaign

Choose a campaign, one of its permitted empires, difficulty and seed in New
Campaign. Survey stars, settle with colony ships, develop colony production,
research component unlocks and save ship designs before building them. Group
ships for shared routes; a design's component and hull requirements also govern
refitting. Read Objectives for progression and branch choices, Diplomacy for
relations, and the turn summary and combat reports after ending a turn.
Nothing advances on a wall clock.

| Campaign | Stars | Strategic character |
| --- | ---: | --- |
| The Open Frontier | 30 | Original exploration and colony race |
| Machine Dawn | 16 | Original machine civilisation and installed source event |
| Grand Frontier: The Long Concord | 64 | Three playable empires, sustained economy and alternative diplomatic or military progression |
| Fallen Gates: The Quiet Meridian | 36 | Three playable empires, archive discoveries and restoration or independent-route branches |
| Siege of the Outer Rim | 40 | One playable defender, escalating incursions, endurance or reconquest |
| Helix Accord | 24 | Trading charter or industrial federation |
| Emberwake Exodus | 32 | Permanent havens or a mobile convoy |
| Glass Meridian | 48 | Preserve the archive lattice or chart an independent sky |

The three longer campaigns define their stages, events, starting resources and
AI parameters in text. Their minimum victory turns are deliberate: reaching an
early economic target does not complete the whole campaign. Objectives display
their prerequisites and excluded branches. See the pinned
[campaign guide](https://github.com/QSOLKCB/4XGAMES/blob/030859385ac8929e066702ef8af0518663480653/docs/CAMPAIGNS.md)
for the full scenario fiction, pacing and completion routes.

Use game save export for campaign progress and native pack export for authored
content. Saves, packs, editor scenes and Ternary Reach replays are different
formats. VOIDWARD v1 states migrate through the game's validated loader; v2
preserves selected empire, objectives, events, discoveries, fleet groups and
last-seen intelligence. Export saves before replacing a campaign. Browser
storage is local and can be cleared or refused; downloaded files remain the
portable backup.

## Create a universe in the Visual Editor

1. Expand **4X campaign workshop** below Asset Foundry. The local frontier
   template loads without replacing the scene. Use **Import campaign** for an
   exported native pack or supported Mod SDK exchange.
2. Give the draft its own ID, title and version, then **Apply campaign identity**.
   Campaign undo/redo and recovery are independent of scene undo/redo.
3. Under **Galaxy in the 3D viewport**, choose **Map draft → viewport**. Each
   `star-N` object represents system ID `N`; home systems use their empire color.
   Move objects with the existing gizmos, Shift-drag or position inspector. Then
   **Apply viewport positions**. One Workbench X/Z unit becomes two chart X/Y
   units. Keep every star's name and include each ID exactly once.
4. Select a star and a starlane target to **Connect lane** or **Remove lane**.
   Both directions change together and disconnected maps are rejected. Choose
   an empire and **Set home at selected star** to update its starting position.
5. Use **Campaign text files** for names, empire families, starting ships,
   components, research, economy, AI, objectives and events. **Validate & apply
   text** commits a valid file. Diagnostics name the physical file, line and
   field. Changing file selection retains unapplied text during this panel
   session; export and recovery include only applied, validated content.
6. **Export campaign** downloads a native text pack. Reimport it to verify the
   editable artifact. **Play 4X draft** opens the advanced game with the validated
   draft ready to launch. The game workshop can also send a pack back to the
   Visual Editor. If local storage or the new window is unavailable, export and
   import the file instead.

The local handoff targets are `demos/4x-game-lab/voidward/index.html?draft=editor`
and `demos/editor/index.html?draft=voidward`; both stay under the deployed site
prefix. The receiving tool validates the stored pack before consuming it.

Map replacement is one scene undo step. Applying viewport positions changes
the campaign draft; it does not replace the game's active campaign. The scene's
existing **Play** still starts its physics preview, and its **Export project**
still exports the native scene and asset library. Stop that preview to resume
campaign editing. Save scene assets separately if you want to retain the 3D
authoring project.

**Restore campaign draft** explicitly recovers the last accepted local campaign;
opening the editor alone does not overwrite it. Campaign history retains at
most 16 past/future snapshots combined and 4 MiB including the current draft.
Older undo entries are evicted to stay within that budget. Recovery stores the
current accepted pack, not its undo history or unapplied text.

## Create ship families from geometry

Use the existing editor primitives or import a permitted OBJ mesh through
Asset Foundry. Select the desired entity or parent hierarchy. Under **Selected
geometry → ship hull**, choose a campaign hull and **Preview selected geometry**.
Review the silhouette and source declarations, then **Apply projected hull**.
The engine uses the hull's existing slots, cost, hit points and technology
requirements; the projected mesh changes its shape only. Edit those game fields
in `hulls.txt`, and assign the hull's `faction` to an empire ID or `*` for shared
availability. `ships.txt` sets starting designs and components.

Projection uses world-space X/Z, centers and scales the convex outline, and
maps -Z forward to negative chart Y. It discards height, concavity, materials,
textures, colliders, controllers and triggers. The preview explicitly reports
these losses. At most 40 polygon points are accepted; simplify geometry whose
convex outline exceeds that bound. A scene change invalidates its old preview,
so preview again before applying.

**Export hull + provenance** downloads `voidward.workbench-hull.v1`, a bounded
envelope containing a native project and all source declarations. Import it
through VOIDWARD's Workbench hull importer to retain multiple source licences,
digests and operation history. It is not a native editor project: the scene's
normal project importer continues to accept its own v1/v2 contract. The lower
level native hull export supports geometry and one representable attribution;
it rejects combinations requiring the full bundle instead of silently losing
attribution. Owner-local geometry remains marked `OWNER-LOCAL-ONLY` until its
sharing rights have been declared. Retain source licence obligations when
sharing packs; an import does not transfer ownership.

## Editable data and source extensions

The native pack is JSON wrapping named UTF-8 `.txt` files; the files remain
directly editable. Required files are the original fourteen tables/settings:

```text
campaign.txt  rules.txt         empire_names.txt  empires.txt
system_names.txt planet_names.txt planet_types.txt hulls.txt
components.txt ships.txt buildings.txt research.txt map.txt music.txt
```

Optional files are `scenario.txt`, `layout.txt`, `dependencies.txt`,
`objectives.txt`, `events.txt`, `ai.txt`, `starts.txt` and `provenance.txt`.
Settings use `key = value`; table headers document pipe-separated columns.
Comment and blank lines count toward physical diagnostics but are not records.

For example, Fallen Gates ships this research dependency and opening objective:

```text
# dependencies.txt: field | level | requires | requiresLevel
propulsion | 6 | industry | 4

# objectives.txt: id | owner | kind | target | amount | requires | branch | title | description | victory
first-signal | * | survey | * | 8 |  |  | Read the silence | Survey eight stars to locate the broken transit paths. | 0
```

Use the shipped files as complete templates, rather than replacing whole tables
with these two example rows. `*` objective ownership applies independently to
each empire; `player` applies to the chosen player. Prerequisites reference
objective IDs. A branch choice excludes alternative branch labels while keeping
all stages of the chosen branch. Supported objective kinds are colonies, survey,
archives, research, trade, control, survive, defeat and resources. Supported
events grant resources, spawn an existing design, declare war or display a
message, with explicit turns, prerequisites and optional repeat intervals.

The engine validates references, reachable structural bounds and cycles; it
does not prove balance or that every authored military position is winnable.
The pinned [mod guide](https://github.com/QSOLKCB/4XGAMES/blob/030859385ac8929e066702ef8af0518663480653/MOD_GUIDE.md)
documents each table and mechanic. New objective predicates, combat mechanics
or event actions require reviewed JavaScript source changes. Machine Dawn's
installed local `hooks.js` is explicitly registered as trusted repository code.
Imported packs never load JavaScript, HTML, expressions, remote URLs or scripts.
Exporting that campaign as data cannot export its installed source extension.

## Bounds and interchange

| Boundary | Supported limit |
| --- | --- |
| Galaxy | 4..64 stars; 1..4 planets per star; 2..10 columns and 2..8 rows |
| Campaign | 20..500 turns; technology levels up to 8 |
| Text content | 100,000 UTF-8 bytes per file; 500,000 bytes for serialized combined files |
| Portable pack input | 1,000,000 UTF-8 bytes for the JSON envelope |
| Objectives / events | 64 / 128 records |
| Hull shape | 3..40 points; coordinates within ±60 |
| Chart coordinates | ±2,000, mapped to native Workbench ±1,000 at 2:1 |
| Native Workbench project | Existing 256 KiB, 128-object and 32-asset limits |
| Hull bundle | 512 KiB including a separately validated native project |
| Mod SDK exchange | Existing 32 KiB manifest and 8,192-character string limits |
| Native save | 48 MiB state; 49 MiB enclosing save, both measured in UTF-8 |

The SDK exchange contains exactly one self-contained campaign data entry,
without dependencies; its ID and version must match the inner campaign. Large
packs should use **Export campaign**. These are admission ceilings, not latency
or memory guarantees. A 64-star campaign uses the game's own bounded sorted BFS;
the native exact-graph module keeps its existing sixteen-vertex limit.

## Source and package boundary

`demos/4x-game-lab/voidward/` owns the game, fiction, campaigns and adapters.
`demos/editor/4x-workflow.js` owns the campaign sidecar transactions and
`4x-panel.js` connects them to the editor. MODULES.json registers demo recipes;
no generic engine module or dependency direction is added. Native math, audio,
Mod SDK, Workbench, Component Forge and Asset Foundry modules are reused directly
instead of copying a second VANILLAJS tree into the demo.

The [demo provenance manifest](../demos/4x-game-lab/voidward/vendor/PROVENANCE.json)
records exact source commits and SHA-256 hashes. Original
[VOIDWARD notice](../demos/4x-game-lab/voidward/NOTICE) and donor licences remain
beside the source. Apache-2.0 game code, MIT input patterns and MPL-2.0 visual/
sound files keep their own licences. No commercial game's fiction or assets are
included. Mathematical module reuse does not establish formal correctness of
game rules or browser presentation.

The existing builder includes the demo through its public `demos/` allowlist,
then generates the full offline SHA-256 inventory under the unchanged 16 MiB
precache budget. One VANILLAJS service worker serves both modes and the editor;
the donor's standalone deployment worker is not copied. Tooling, evidence and
tests remain outside the public package.

## Reproduce validation

```sh
node --test tests/*.test.js
node scripts/check.js
node scripts/verify-voidward.js
node scripts/build.js
node scripts/verify-offline.js
# Existing external Playwright tooling; launches a real browser:
node scripts/browser-check.js --suites=worlds,editor
```

The source verifier checks the pinned 4XGAMES revision, every copied donor file,
and the nine native dependency digests. `check.js` runs it automatically.
`browser-4x.js` retains the original mode's checks; `browser-voidward.js` covers
the advanced game and `browser-editor-4x.js` covers the editor bridge beside the
original editor suite. Worlds and editor include each other's
runtime roots in the browser policy. Newly edited source is not promoted to a
reviewed cache witness: unaudited runtime/harness changes require execution.
Updating the policy's phase-006 inventory digest does not run or certify Lean
proofs and does not change historical proof archives.

The unchanged baseline at `5a91cd4cc7251c485eaf2fc80d5227a20571fd8c` passed 671
Node tests in 5.28 seconds on Linux x64 / Node 22. Source checks covered 257
JavaScript files, 50 module contracts and two research experiments in 3.77
seconds. Its 154-file package totals 1,013,132 bytes and passed all offline
hashes. Build and offline validation took 0.114 and 0.064 seconds respectively.
The initial sandbox run could not spawn required Node/Python subprocesses;
the recorded passing rerun used the unchanged snapshot outside that restriction.
These are baseline observations, not performance claims for the expanded mode.
The expanded implementation passed 743 Node tests and its unattended packaged
browser rerun: existing Ternary Reach/editor suites, all 15 advanced-game checks
and all ten editor-bridge checks. All nine campaign/empire choices launched;
actual native/SDK exports, attributed hulls and both handoff directions passed.
The [editor-created campaign](evidence/voidward/editor-created-campaign.json)
and [hull bundle](evidence/voidward/editor-hull-bundle.json) are working examples
produced by that run. See [the validation record](VOIDWARD_VALIDATION.md) for
receipts, screenshots, measured observations and limits, including scripted
play, emulated touch and no human audio listening assessment.
