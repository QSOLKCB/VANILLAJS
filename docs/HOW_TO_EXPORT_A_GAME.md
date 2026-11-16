# Export a game or scene

Choose the output that matches what you authored.

| Output | Includes | Still needed |
| --- | --- | --- |
| Tutorial / Workbench `.vproject.json` | Editable scene and asset library | Workbench to edit; exporter/runtime to play separately |
| Workbench exported HTML | Embedded project and references to runtime | Matching `modules/` and `demos/` alongside it, HTTP server |
| `scripts/export-game.js` output | Playable box preview, local runtime, LICENSE, NOTICE, asset attribution, manifest and offline worker | HTTP(S) hosting, your own finished game rules |
| Specialist pack / composition | That adapter's validated data | Compatible consuming game or lab and its runtime |
| `scripts/build.js` output | Entire allowlisted lab site | Static HTTP(S) server |

From the repository root with Node 22+, package a project into a path that does
not exist yet, inside an existing parent directory:

```sh
node scripts/export-game.js /path/to/first-scene.vproject.json --out /path/to/new-game
cd /path/to/new-game
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/`. The exporter refuses existing output directories.
Keep the source project separately. Review the generated attribution and retain
all notices when distributing the entire folder. Add rights information for your
own assets. The tutorial's empty library adds no third-party art.

A scene export does not implement objectives, scores, quests, arbitrary scripts,
a new collision model or arbitrary FPS gameplay. It packages the existing box
preview. Specialist FPS and demoscene packs must use their own runtime contracts.

Native ES modules need HTTP origins and JavaScript MIME types; `file://` is not
supported. Offline worker installation requires localhost or HTTPS. Visit online
(or through the local server), allow installation to finish, reload under worker
control, then test offline. A local HTTP server can serve local files without an
internet connection. Never depend on a CDN, account or cloud asset for offline play.

To package all labs instead:

```sh
node scripts/build.js
node scripts/verify-offline.js
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Record the reviewed engine revision alongside a distributed game. Pinning gives
you a known API and numerical contract; test upgrades before replacing it.

## Export a scenic race

[HORIZON Race Foundry](HORIZON_RACING.md) exports a complete original single-route
race after strict project validation: both vehicles, route, renderer, procedural
sound, local native modules, notices and an integrity-checked offline worker.
Its JSON download is the editable recipe; its ZIP is the runnable game. Extract
the complete ZIP, run a local HTTP server and test the route before sharing.
This does not turn arbitrary Workbench scenes or scripts into racing games.
