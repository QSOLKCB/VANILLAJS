# Create your first game

Start at the [Creator Hub](../demos/creator-hub/index.html) for a browser-readable walkthrough. This guide and the other Markdown guides are included as text in the offline package. Research evidence, scripts and linked source files still require the source checkout.

## Choose a starting point

| What you want to make | Start here | What you own next |
| --- | --- | --- |
| A small 3D platform or trigger scene | [Visual Editor](../demos/editor/index.html) | Scene and asset project |
| A strategy campaign | [VOIDWARD](../demos/4x-game-lab/voidward/index.html) and [campaign workflow](VOIDWARD_WORKFLOW.md) | Campaign text pack; separate save for progress |
| A drone race | [Circuit builder](../demos/circuit-mod-lab/index.html) | Exact course data; add flight, collision and race rules in game code |
| Retro driving, car combat, football or stunt racing | [Racing Lab](../demos/racing-lab/index.html) | Seven playable demo-owned vehicle recipes, including scenic touring and 3D sprints, plus input-tick JSON receipts |
| Space flight or combat | [Space Lab](../demos/space-lab/index.html) | Docking/broadside/orbit recipe; add economy and missions |
| A 2D game | [2D Foundry](../demos/2d-lab/index.html) | Platform, car, shooter or RTS example |
| Original short music cues | [Soundtrack Lab](../demos/soundtrack-lab/index.html) | WAV, editable recipe and audio2d score |

The editor Play button previews the scene's box physics. It does not compile arbitrary game rules, implement quests, or turn a campaign pack into an editor scene automatically.

## Run the tools

Use the deployed site, or from the source root run:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/demos/creator-hub/index.html`. Native ES modules require HTTP(S). Keep the directory structure intact. Source browsing works locally without internet; the optional service worker is generated only by `node scripts/build.js` into `dist/`.

## Build, test and save in the editor

1. Open **Quick start**. Choose **Playground**, **Jumping course**, or **Trigger trail**, then **Load starter**. This replaces the scene in one undo step; save a project first if you want a separate backup.
2. Use **Add piece** for a Platform, Player, Trigger zone or Decoration. A second enabled player is rejected. The new piece is selected and framed.
3. Move with the coloured gizmo arrows. W/E/R choose Move/Rotate/Scale; F frames the selection. The inspector provides numeric values. World coordinates are metres, +Y up and -Z forward.
4. Read **Scene checks**. Click an issue to select its object. Warnings cover missing player/ground, overlapping spawn, zero speed, unsupported rotated colliders/triggers and other preview limitations. Checks are advisory, not a guarantee that a level is completable.
5. Choose **Try Play**, use WASD and Space, then **Stop** to return to the authored scene. Trigger zones report events; game code must decide whether an event changes score, unlocks a door or wins the level.
6. Choose **Save project**. This downloads the scene and asset library. Use **Open project** in Asset Foundry to restore it. The quick-start progress marks reset when the scene changes so yesterday's test does not describe today's layout.

**Focus basics** hides advanced panels; **Show all tools** restores them. Undo/redo remains available. Browser recovery is optional local storage and can be cleared or refused; downloaded projects are the portable backup.

| File/action | Contains | Restore with |
| --- | --- | --- |
| Save scene | Scene objects/components only | Open scene |
| Save project / Export project | Scene, local asset library and optional graphics setting | Open project |
| Export playable HTML | Preview page referencing local runtime files | Serve beside packaged `modules/` and `demos/` |
| Campaign export | Editable VOIDWARD text/data pack | 4X workshop Import campaign |
| Game save export | Progress in a particular campaign | VOIDWARD save loader |
| Soundtrack recipe | Source selection and musical mapping | Soundtrack Open recipe |

## Package an authored preview

From a source checkout with Node 22 or newer:

```sh
node scripts/export-game.js /path/to/game.vproject.json --out /path/to/new-game-folder
cd /path/to/new-game-folder
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/`. The destination's parent must exist; the destination itself must be new. Invalid/oversized projects are rejected before creation, and existing directories are never overwritten. The tool copies the preview's runtime dependency closure, licences, help text and content-hashed service worker. It excludes tooling, other games and the editable project file. Keep the project separately.

Upload the complete generated folder to a static HTTP(S) host. On HTTPS or localhost, wait for initial service-worker installation and reload before testing offline. Test under the real deployment prefix as well as locally. A local HTTP server works without internet even without a service worker. The exporter packages the current experimental scene player; it is not a standalone single-file game or a general game compiler. Review imported asset rights before sharing. The engine licence does not replace an asset's declaration.

## Make a race course without JSON editing

Open Circuit builder, enter width/depth (40–400 metres), gate opening (4–30 metres), and laps (1–9), then **Replace draft with loop**. The form generates a four-gate cardinal loop at 8 m altitude, with 14 m high openings. **Test first gate sweep** checks a synthetic exact crossing; it does not simulate a drone or demonstrate that your ship fits.

**Download JSON** saves a native Mod SDK course manifest. Expand **Advanced: edit course JSON** to author individual gates and obstacles. Course admission uses exact Q16.16 decimals, X/Z planes and explicit directions. The consuming game supplies body clearance, physics, solid gate frames and lap timing. A VANILLAJS course pack is not a complete DRONE-RACER mod pack; see [Mod SDK course contracts](MOD_SDK_002.md) and the donor's mod guide for its envelope.

## Make a cue and use it in a game

In Soundtrack Lab choose a preset, source, tempo, steps, pitches, waveform and gain. **Generate** previews the notes; **Listen** requires a user gesture. Stop, blur and tab hiding cancel playback. Imports are bounded to 4 KiB; invalid recipes preserve the last accepted cue. Every export compiles the current settings so invalid draft values cannot silently export an older cue.

The source is either an E8 coordinate sequence or a simple three-state cycle. The musical mapping is your artistic choice; it is not an intrinsic frequency of a root or a reproduction of SONIFICATION's ETQ protocol. Cues use 4–16 eighth notes, 60–240 BPM, five integer pitches (30–2000 Hz), and triangle/square/saw waves, within the existing 8-second audio2d budget. Output is 48 kHz mono PCM16 WAV. Live playback uses the browser's audio device and may resample.

Export a recipe to keep editing. Export a score for a game using the existing API:

```js
import {createSound2D} from './modules/audio2d/index.js';
// score is the parsed, local soundtrack.score.json file.
const sound = createSound2D(score);
const wavBytes = sound.wav();
// Play through a user-gesture-gated audio adapter; cancel on pause/focus loss.
```

## Verify before sharing

Test starting, moving, restart, pause/resume and blur. Check an invalid import leaves your accepted project intact. Reimport exported data, and load the exported folder under its actual URL prefix. Test offline after installation. Check a narrow viewport and keyboard navigation; emulation is not physical-device coverage.

For engine changes, run from the source root:

```sh
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
```

The existing packaged Chromium CI covers the editor, soundtrack, course builder and exported preview. Use the repository's external pinned Playwright tooling for local browser checks; no runtime npm installation is needed to play.

## Troubleshooting

| Symptom | What to do |
| --- | --- |
| Blank page on direct file open | Serve the whole directory over HTTP(S) |
| Player falls forever | Put an axis-aligned static platform beneath its spawn; inspect Scene checks |
| Rotated platform has no collision | Use Y rotation 0 or 180 for this preview, or author separate supported colliders |
| Trigger feels like a wall | Disable its Collider to make a walk-through zone |
| Camera component does not change view | It is metadata; the preview uses its fixed camera |
| Assets vanish after reopening | Restore a project, not a scene-only export |
| No audio | Click Listen; check gain, browser mute and output device; try exported WAV |
| Old content appears offline | Let the new worker install and close old tabs before reopening |
| An exported game needs modules | Use the game-folder exporter or keep the HTML beside packaged runtime folders |

Continue with [Build a game](../BUILD_A_GAME.md), [editor contracts](EDITOR_WORKBENCH.md), and [source provenance](CREATOR_DONOR_REVIEW.md).
