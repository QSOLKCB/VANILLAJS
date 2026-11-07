# FreeDM × Four Terra — genuine four-player Doom deathmatch lab

**Status: implemented as an experimental owner-only workflow; real gameplay has NOT
been executed or independently verified yet.** No API credits, ViZDoom
multiplayer clients or local GPU have been used while authoring this PR.

## Source basis

Freedoom is game content, **not** an executable engine. Its manual identifies
**FreeDM (freedm.wad)** as the PvP-specific, monster-free WAD. The actual
multiplayer engine in this experiment is **ViZDoom**, which provides ZDoom
host/client networking, in-game screenshots and official frag/death counters.

- Manual: https://freedoom.github.io/freedoom-manual-en.pdf
- Game source/asset provenance: https://github.com/freedoom/freedoom
- ViZDoom multiplayer examples: https://github.com/Farama-Foundation/ViZDoom/tree/main/examples/python
- ViZDoom API: https://vizdoom.farama.org/api/python/doom_game/
- Terra model: https://developers.openai.com/api/docs/models/gpt-6.1-terra
- Current API pricing: https://developers.openai.com/api/docs/pricing

The experiment pins **FreeDM v0.13.0** (published 2024-01-29).
Its ZIP has SHA-256
*b420f13508ef745d7b38e83d15e55e0fc0b09d9a503c96741cddd9773d43f7c9*,
also reported in the HaikuPorts packaging recipe. The extracted WAD itself
is rehashed in every receipt; no original Doom/Doom II proprietary WADs
are required, and no Freedoom asset binary is checked into VANILLAJS.

ViZDoom version **1.3.2** is a pin for this specialized experiment only.
The rest of the browser engine remains pure native ES modules, and no
Docker, Kubernetes, Node/npm runtime packages or new cloud infrastructure
are introduced.

## Local preparation — one time

Download *freedm-0.13.0.zip* from the official project release:
https://github.com/freedoom/freedoom/releases/tag/v0.13.0

Save it as $HOME/Downloads/freedm-0.13.0.zip, then from the repository:

~~~sh
python3 experiments/freedm-terra/prepare_wad.py \
  --zip "$HOME/Downloads/freedm-0.13.0.zip" \
  --dest "$HOME/Games/FreeDM/freedm.wad"
~~~

The installer is **offline**; it validates the full original ZIP checksum,
member path/size and IWAD magic, refusing to overwrite an existing destination.
The workflow uses the resulting WAD by default. If located elsewhere, set the
repository **Actions Variable** named **FREEDM_WAD_PATH** to its absolute
filesystem path on the owner runner.

Ensure *uv* is installed. The workflow runs:

~~~sh
uv run --no-project --with 'vizdoom==1.3.2' --python python3 ...
~~~

The first run may fetch this pinned package from the Python index; uv keeps it
isolated and caches it, without creating a repository-managed virtualenv.
The account's GitHub Actions **Secret** named **OPENAI_API_KEY** is needed
only for the paid mode.

## Dispatch and consent

Actions → **FreeDM four-Terra real deathmatch (owner only)** → Run workflow
on reviewed main. This workflow **cannot run on push, PR, merge or forks**.

Choose either:

1. **smoke**: tick acknowledge_local_execution only, leave API spend disabled.
   Starts four real ViZDoom peers, checks distinct player slots and an actual
   game frame for each, applies one neutral action and seals JSON/PNGs.
   **No API calls**.
2. **paid**: tick both acknowledgments, enter **20.00** USD as the fixed
   per-dispatch limit, and optionally enable publication of game evidence.
   The same **zero-cost four-peer smoke** always runs first. Only after that
   succeeds does the workflow start a fresh, real four-player deathmatch.

Runs only for owner GitHub login EmergentMonk, on main, and the self-hosted
Linux runner labelled self-hosted/linux/x64/qsol-rtx5060ti. The four clients
use a local ZDoom host with three connections to **127.0.0.1**. The server
may listen on additional interfaces; use host firewall rules to prevent
external clients. There is no public server and no gameplay networking to
any provider other than outbound model API calls.

## Four genuine AI players

Each participant is a distinct **gpt-6.1-terra** API instance. These are
four sessions of *one* model family, not four different model versions.

- TERRA-ALPHA: aggressive flanking.
- TERRA-BRAVO: survival, pickup opportunities and cover.
- TERRA-CHARLIE: measured aim and ammunition.
- TERRA-DELTA: exploration and unpredictable routes.

All four ViZDoom peers simultaneously inhabit **FreeDM MAP01**.
The game is a real-time **ASYNC_PLAYER** deathmatch. The model sees only
its own **320×240 RGB screenshot**, in-game health/ammunition and public
frag/death/player-count values, plus its own previous action.
Hidden entity coordinates, depth buffer, automap, server oracle,
game console commands and API tools are never exposed.

Each decision produces a strict JSON-schema command with a movement direction
(forward/back/left/right/stop), turning direction, fire/use/sprint flags and a
short non-authoritative tactical annotation. A validated nine-button
vector drives the actual game for a nominal 35 tics, then releases its inputs.
Requests for all four players run concurrently. In **ASYNC_PLAYER** mode the
game advances while Terra is thinking. Latency and networking affect results;
do not confuse the transcript with a deterministic engine replay.

The game server's observed frags, deaths and player numbers—not Terra
self-reports—form the match scoreboard evidence. A completed experiment is
not required to contain any kills; zero-frag sessions remain valid observations.

## Credits and fail-closed limits

**US$5 per player; US$20 for a single authorized workflow dispatch.**

Each agent can submit at most **12** requests; each request reserves
**US$0.40 before transmission** without a refund on failure.
At most US$4.80 per agent (US$19.20 in total) is reserved, including
every unsuccessful request. No automatic API retries, browsing, code
execution, model tools or patches are permitted. The input screenshot uses
image detail low and Responses store=false. Output is bounded by 384
tokens, including any reasoning tokens.

The controller inspects provider-reported tokens, calculates a conservative
long-context Standard tier estimate, and aborts if an individual result
exceeds the reservation. **This is a software authorization guard, not a
provider-enforced account-wide spending cap.** Provider pricing, usage
accounting and billing can differ; multiple separate dispatches can consume
additional credits. Configure your OpenAI account/project limits separately
and reconcile actual cost using the Usage Dashboard.

## Evidence and research interpretation

All files are stored outside the checkout at:

    ~/.local/state/qsol/vanillajs/freedm-terra/run-RUNID-ATTEMPT/

Each real game writes:

- **MATCH.json** — model/version, exact source SHA, FreeDM WAD SHA-256,
  players, game mode, every independent decision, actual button vectors,
  observed gameplay counters, response IDs, API token counts and
  budget reservations, final scoreboard when available and limitations.
- **frames/ROLE/TT.png** — the *game-only* image actually supplied to that
  role, with SHA-256 referenced by the JSON. No desktop screenshot.
- **SHA256SUMS** — independent hashes for every JSON and image byte.
  Files are created exclusively, never overwritten. Partial failed matches
  are explicitly labelled ABORTED, not PASS.

Publication is an **additional opt-in**. Uploaded Actions artifacts expire
after 14 days; to preserve exact bytes permanently, archive the downloaded
artifact in a separate evidence PR (as for RTX001–005 / 2D-FOUNDRY-001).
The original FreeDM WAD is not uploaded to the repository.

This experiment yields **FPS design hypotheses**: perception/aim under
occlusion, input cadence, strafing, spatial navigation, death/respawn
handling, tactics vs. frag rates, and effects of delayed model decisions.
It is **not** proof of general FPS skill, deterministic gameplay,
game-engine performance or GPU acceleration. Apply conclusions to
VANILLAJS only through independent source-pinned benchmarks and gameplay
regressions.

## Offline verification before spending

~~~sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover \
  -s tests -p 'test_freedm_terra.py' -v
~~~

The tests do not import ViZDoom, need an API key, open the network, or start
a client. They verify the strict JSON command vocabulary, per-role budget,
no retry, safe lossless PNG encoder and synthetic API response receipts.
The real four-player smoke is a separate *manual* hardware/runtime gate.
