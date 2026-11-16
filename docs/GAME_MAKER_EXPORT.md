# Export a Game Maker game

Open [Game Maker Lab](../demos/game-maker-lab/index.html), finish the required
player/level/exit data and test the game. **Export game ZIP** downloads a complete
native-module package for the Lab's original platform-game rules. **Export
project** keeps editable data only. Keep the project as your authoring copy.

Extract the entire ZIP into a new directory, then serve it locally:

```sh
cd /path/to/extracted-game
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/`. No npm installation is needed. Double-clicking HTML
does not provide the origin/MIME behavior native modules require. The same folder
can be served under a project prefix such as `/my-games/signal-garden/`; keep
relative paths intact.

## What is in the ZIP

- `index.html`, `game-start.js` and the portable player: controls, actual movement,
  collision, interactions, sound, win/lose and restart for the example rules.
- `project.json`: validated editable level/player art. `project-data.js` carries
  the same escaped inert data as a static native-module value; it is generated
  after validation and cannot select code or resources.
- The exact required `api/`, `modules/` and `demos/game-maker-lab/` runtime files.
  Editor tooling, tests and development dependencies are excluded.
- `LICENSE`, `NOTICE`, `ASSET_LICENSES.json`, `ENGINE_SOURCE.json` and `README.txt`:
  licences, declared asset rights, exact trusted runtime identities and instructions.
- `manifest.json`, `service-worker.js` and `offline/register.js`: SHA-256 inventory
  and the existing verified offline worker, scoped to this exported game folder.

The archive is standard uncompressed ZIP, readable by normal system extractors
and Python's standard-library `zipfile`. It needs no unzip package in the game.

The first visit must load every required asset and let the worker install on
HTTPS or loopback. A subsequent visit can use the verified cache with networking
disabled. There is no claim that a fresh browser can retrieve an uncached game
offline. The worker retains the engine's whole-package integrity checks and
separate scope-based cache namespace; one exported game cannot clear another
game's cache. Existing open clients can finish using their old worker version.

This exports **the Lab's fixed original game rules**. It is not an arbitrary
JavaScript compiler, a conversion of Workbench projects or a release approval.
Imported markers and art do not become executable scripts. Validation catches
format/budget problems; authors still play-test reachability, difficulty and
presentation. `OWNER-LOCAL-ONLY` art metadata grants no redistribution right;
retain attribution required by the assets you choose.

## Standard-library command-line packaging

From the engine checkout, Node 22+ can create the same package files directly:

```sh
node scripts/export-game-maker.mjs /path/to/project.json --out /path/to/NEW-game
```

The output directory must not already exist. The command refuses stale portable
runtime data and invalid/incomplete projects before writing a game. It uses the
same package assembly as the browser ZIP. Preserve all exported files/notices.

## Engine contributors: regenerate trusted source data

The browser's offline ZIP exporter uses
[`portable-runtime.js`](../demos/game-maker-lab/portable-runtime.js), a generated
text archive of the actual portable player and static module dependency closure.
This is engine-owned distribution data, not a second implementation. Its exact
bytes are checked against source, including HTML/CSS, licences and worker template.

After changing a source in that closure:

```sh
node scripts/game-maker-runtime.mjs --write
node scripts/game-maker-runtime.mjs
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
```

Review the generated diff with the source changes. Unknown/external/computed
dependencies, symlinks, missing files and oversized closures are rejected. Do
not loosen dependency analysis to make an export work. Generated game files have
their own content hashes; encoded ZIP identity is distinct from gameplay state.

Pin an immutable reviewed release when using this engine in an independent game.
Keep that source revision alongside `ENGINE_SOURCE.json` and test before updating.
[Facade ownership/API](GAME_MAKER_API.md) · [Creator tutorial](GAME_MAKER_LAB.md)
