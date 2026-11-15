# Touchline: the football management SDK

**Play:** [Touchline Football Manager](../demos/football-manager/index.html).

**Start modding:** [complete editable starter bundle](../demos/football-manager/starter.json).

**Schema:** [JSON Schema 2020-12](../modules/mod-football/schema.json).

Touchline integrates the real SOCCERWEB v3.1.1 football engine into VANILLAJS.
Choose Solar Athletic, Neon Rovers, Tidal United, Moss City, Violet Comets,
Ember FC, Polar Wanderers or Cobalt Stars. Their original names, regions,
styles, strengths and kit colors are retained. The named 18-player squads
and management game are new demo content.

The football SDK is **experimental**, with explicit v1 content, save and replay
formats. It is an implemented football extension to the existing data-only mod
SDK; it does not change the maturity of VANILLAJS's other APIs or promise a
stable general-purpose game SDK. No runtime package installation, external
engine, iframe, asset CDN or network match service is involved.

## Play a season

1. Choose a club and career seed. Club selection creates a new local career;
   export your existing career first if you want to keep both.
2. In **Squad**, select your eleven or ask the assistant to pick a fit XI.
   Slot one is the goalkeeper. Selecting an existing starter swaps two slots.
   The formation's position requirements make familiarity visible.
3. In **Training & tactics**, choose a formation, mentality, pressing, tempo,
   width, training focus/load and team talk. Plans save when changed.
4. Use **Scouting** to sign free agents or sell reserves. Keep 16–22 players
   and at least two goalkeepers. Recruiting reduces cohesion and increases wages.
5. Press **Play · Watch your team**. All 22 players are AI controlled. Watch
   animated passes, tackles, keeper saves, frame hits and goals from SOCCERWEB.
   Pause, choose 1×/2×/4×/8× speed, change camera, issue instructions or make
   up to three substitutions. Half time pauses for a team review. Resume to play on.
6. At full time, the other three fixtures run through the same engine. When
   “Round complete” appears, the table, finances and career are saved together.
   Return to the clubhouse for the next week.

The default eight-club league has 14 matchweeks and 56 home/away fixtures.
The board expects a top-half finish and a nonnegative balance. There is no
forced sacking: confidence records how the board feels while you continue
managing. Completing the season opens a new one with the same squad, a new
free-agent shortlist and 50,000 credits of sponsorship.

The default match is 60 seconds of **active** simulated football, plus stoppages.
The broadcast clock maps that active time to 90 football minutes. Speed controls
advance more fixed steps; they never change the result calculation. Match scores
come exclusively from ball/goal physics, including posts and crossbars.

### Decisions and tradeoffs

| Variable | What changes |
| --- | --- |
| Pace | Maximum running speed |
| Passing | AI decision tier and time between decisions |
| Finishing | Shot aiming error and ball speed |
| Defending | Frequency of tackle opportunities |
| Keeping | Keeper reaction interval |
| Stamina | Condition lost during active match time |
| Condition, morale, sharpness, cohesion | Readiness, which contributes to all six effective attributes |
| Position familiarity | Correct role: 100%; other outfield role: 86%; keeper mismatch: 55% in the calculation (the lineup UI prevents keeper/outfield swaps) |
| Mentality | Formation depth, attacking support and shooting range |
| Pressing | Movement speed and tackle frequency, with extra fatigue |
| Tempo | Decision delay and passing preference, with extra fatigue |
| Width | Formation's horizontal spacing |
| Home advantage | Bounded boost to the home side's effective attributes |
| Training focus/load | Attribute gains, sharpness, condition and spending |
| Team talk | Encouragement raises morale; demanding raises sharpness but can hurt low morale |
| Facilities | Weekly recovery and home gate receipts |

Readiness is `(4 × condition + 2 × morale + 2 × sharpness + 2 × cohesion) / 10`.
Effective attributes are rounded from `(.6 × attribute + .4 × readiness) ×
familiarity / 100 + homeAdvantage`, clamped to 1–100. The exported
`playerPerformance` function returns the exact integer movement/AI parameters.
During matches, abilities refresh each simulated active second. Fatigue grows
with active playing time, pressing and tempo, and decreases with stamina.

Normal training costs one `trainingCost`, adds one to each focused attribute,
adds one sharpness net, and restores 11 condition before facility bonuses.
Intense training costs twice that, adds two attributes and five sharpness net,
and restores four condition before facilities. It also gives reserves a seeded
6% injury chance. Recovery costs nothing, restores 18 condition, and loses three
sharpness. Injured players cannot start or come on. Exhausted participants below
55 condition have a seeded 18% chance of a two-week knock after the match.

These are deliberately compact demo rules, not a real-world scouting or
sports-science model. There are no licensed real clubs or footballers.

## Build a data mod

Open **Mod workshop**, edit the JSON, then **Validate pack**. Download the edited
bundle to keep it, or **Use for a new career** and choose a club. Current careers
retain their own complete content snapshot; importing a pack does not rewrite
an ongoing season. Bad imports leave current progress intact. Text is rendered
as text, never as HTML.

The bundle contains small individual packs, each using the existing
`qsol.vanillajs.mod-pack.v1` envelope. The starter uses eight club packs and one
rules/formations pack. This respects the underlying registry's per-pack budget.

```json
{
  "kind": "qsol.football-content.v1",
  "packs": [
    {
      "kind": "qsol.vanillajs.mod-pack.v1",
      "id": "my-football-rules",
      "version": "1.0.0",
      "requires": [],
      "entries": [
        {
          "id": "short-matches",
          "kind": "data",
          "data": {
            "kind": "qsol.football-rules.v1",
            "value": {
              "seconds": 40, "fatigue": 20, "homeAdvantage": 3,
              "startingBudget": 650000, "gate": 48000, "prize": 18000,
              "wage": 25, "trainingCost": 2500, "transferCost": 60000
            }
          }
        }
      ]
    }
  ]
}
```

This is an **envelope example**, not a complete playable league: copy the starter
and replace its rules entry with yours. A playable bundle must resolve 2–16
clubs (an even number), 1–8 formations and exactly one rules entry. Clubs are
ordered by the registry's canonical pack/entry ordering, not the pasted JSON
array order. The default formation is `four-four-two` when available, otherwise
the first resolved formation. Do not add a second rules entry as an “override”:
replace the existing entry. Duplicate identities are errors, not last-write wins.

### Content contracts

All fields listed below are required; unknown fields are rejected.

- **Club:** `id`, `name`, `short`, `region`, `style`, `color`, `dark`, `accent`,
  `attack`, `press`, `pass`, `players`. IDs use lowercase letters, digits and
  hyphens, start with a letter and have at most 48 characters. Names/regions/styles
  have at most 80 characters, short names at most four. Colors are `#RRGGBB`.
  Club attack/press/pass values are integers 1–100. Squads have 16–22 players,
  including at least two goalkeepers. Player IDs are unique across the league.
- **Player:** `id`, `name`, `role`, `pace`, `passing`, `finishing`, `defending`,
  `keeping`, `stamina`, `condition`, `morale`, `sharpness`. Names have at most
  40 characters. Role is `GK`, `DF`, `MF` or `FW`; every numeric field is an
  integer 1–100. Attributes are fictional ratings, not physical units.
- **Formation:** `id`, `name`, `slots`. Exactly 11 slots; each is
  `[horizontalPercent, depthPercent, role]`. X is 10–90; depth from the own end
  is 2–48. Slot zero is the only goalkeeper. Formations mirror automatically
  with team attack direction and at half time. Example keeper slot: `[50,5,"GK"]`.
- **Rules:** fields shown above. `seconds`: 20–180; `fatigue`: 0–30;
  `homeAdvantage`: 0–10. Economic fields are integers 0–10,000,000 credits.
  `wage` multiplies each player's rounded six-skill average; `gate` pays the
  home club; `prize` pays for a win, or one third for a draw. `transferCost`
  scales a recruit's average skill; sale proceeds are 65% of that price.

Entry kinds are `qsol.football-club.v1`, `qsol.football-formation.v1` and
`qsol.football-rules.v1`, each with exactly `{kind, value}` under `entry.data`.
Use the schema for editor assistance; runtime validation also checks identity
uniqueness, goalkeeper constraints, dependency closure and composition budgets.

### Limits and dependencies

- Decoded bundle budget: 256 KiB compact UTF-8 JSON, 30,000 copied nodes, depth 16, up to 24 packs. The file picker allows up to 1 MiB to accommodate pretty-printed JSON; the decoded content still must fit its own budget.
- Existing registry limits remain: 32 KiB per pack, 32 entries, eight exact-version
  dependencies, 512 nodes per entry and depth eight. Use one club per pack.
- `requires` contains `{id, version}` records with exact versions, never ranges
  or URLs. Missing versions and cycles fail activation.
- No scripts, executable hooks, dynamic URLs, HTML, accessors, functions,
  prototype keys or exotic objects. Import validation copies input data.
- Composition is transactional: `loadFootballBundle` constructs a temporary
  registry and returns only after every pack and the complete content validate.

## Use the SDK in your own game

Serve native modules over HTTP(S). Node examples require Node 22+. DOM layout,
career economy, training and season progression belong to the consuming game;
the pure module owns football matches. The demo's `career.js` is a runnable
example of this separation, not an engine-level career API.

From the repository root, run this with `node --input-type=module` (or save it as
a `.mjs` file in that root):

```js
import {readFile} from 'node:fs/promises';
import {loadFootballBundle} from './modules/mod-football/index.js';
import {
  createFootballMatch, stepFootball, commandFootball,
  exportFootballReplay, verifyFootballReplay
} from './modules/football/index.js';

const {content} = loadFootballBundle(JSON.parse(await readFile(
  'demos/football-manager/starter.json', 'utf8'
)));
const [home, away] = content.clubs;
const tactics = {
  formation: 'four-four-two', mentality: 50,
  press: 50, tempo: 50, width: 50
};
const match = createFootballMatch({
  seed: 1988, weather: 'clear', rules: content.rules,
  formations: content.formations,
  teams: [home, away].map(club => ({
    club, players: club.players.slice(0, 11), tactics, cohesion: 70
  }))
});
// Run exactly one 1/60-second authoritative tick per call.
while (match.phase !== 'fulltime') stepFootball(match);
console.log(match.score, match.stats);
const replay = exportFootballReplay(match);
console.log(verifyFootballReplay(replay).status); // PASS
```

In a browser, load the JSON with same-origin `fetch` and call `stepFootball`
from a bounded fixed-step animation host, as the demo does; do not run the
headless `while` loop on every render frame.

For a new roster, explicitly choose a goalkeeper followed by ten outfield players;
`slice(0,11)` above relies on the starter's ordering. Starting records must match
the corresponding full squad records. Inputs are copied at match creation; the
returned state is caller-owned and mutable. Use commands for recorded changes,
not direct state mutations, if you need replay verification.

### Public API

| Entry | Exports and behavior |
| --- | --- |
| `modules/mod-football/index.js` | `validateFootballMod(input)` returns a validated owned pack; `registerFootballMod(registry,input)` registers it; `activeFootballContent(registry)` composes active football entries; `loadFootballBundle(input)` returns `{bundle,content}`; validators `validatePlayer`, `validateTactics`, `validateMatchSetup`; bounded `copyFootballData`; `FOOTBALL_BUNDLE`, `PLAYER_FIELDS` |
| `modules/football/index.js` | `createFootballMatch(setup)`, `stepFootball(state)`, `commandFootball(state,command)`, `playerPerformance(validatedPlayer,validatedTactics,cohesion,role,fatigue=0,home=0)`, `footballHash(state)`, `exportFootballReplay(state)`, `verifyFootballReplay(input)`, `FOOTBALL_REPLAY`, `MAX_MATCH_TICKS` |
| `api/football/index.js` | `new Renderer(canvas)`, `.draw(state,previous=state,alpha=1,demo=false,dt=1/60)`, `.reset()`; properties `.zoom` (`follow`, `wide`, `close`), `.effects` (`minimal`, `balanced`), `.retro`, `.palette`, `.pixelated` |

Math and donor mechanics helpers exported alongside the football facade are
experimental implementation utilities, not an additional stable game API.
`Renderer` also exports its constituent camera, player and stadium draw helpers.
Rendering reads state without determining any match outcome. For interpolation,
`previous` needs `players` and `ball`; reset the renderer when switching matches.

A native mod author can also write trusted JavaScript against these APIs, build
custom UI, consume match events or implement different progression. Such code is
part of your application and has its browser permissions. It is **not** executed
by the data-pack importer or isolated by a script sandbox.

### Match commands, events and replays

Issue a command **between** fixed steps. Commands record the current tick and
preserve their submission order. There are at most 64 commands and three
substitutions per team per match.

```js
commandFootball(match, {
  type: 'tactics', team: 0,
  tactics: {...match.management.teams[0].tactics, press: 85, tempo: 75}
});
commandFootball(match, {
  type: 'substitute', team: 0, slot: 1, playerId: home.players[12].id
});
```

A substitute must be an unused member of the original squad. Keeper/outfield
slots remain compatible. Invalid commands throw before changing state. The
stable simulation player ID and position remain; the roster identity and
performance change. `state.events` describes the latest step (goal, kick, save,
post, whistle, tackle, receive, intercept and others); copy events if retaining
a feed. `state.stats` exposes shots, saves, passes, completed passes, tackles and
possession ticks, each indexed `[home,away]`.

The replay format is `qsol.football-replay.v1` with `setup`, `commands`, `ticks`
and `finalHash`. Verification reconstructs the match and all commands. It returns
`{status:'PASS', complete, state}`. A partial export is valid with `complete:false`;
the viewer says the recording ended, not that the team failed. Full replays
require `phase === 'fulltime'`. Tick budget: 120,000, including stoppages.
The checksum detects accidental corruption; it is not a cryptographic signature
or proof that someone did not edit and re-sign their local data.

This management replay is **not compatible with standalone SOCCERWEB v5 replay
files**: roster ratings and management commands change simulation semantics.
There is no silent v5 converter or shared save key. A future breaking gameplay
change must introduce a new format or an explicit tested migration. Seeded
repeatability is tested in Node and packaged Chromium; cross-engine bitwise
identity is not promised.

### Hosting, pause and cancellation

The demo's requestAnimationFrame host accumulates 60 Hz ticks, clamps wall-time
catch-up to 100 ms, caps work at 48 ticks/frame and scales only tick throughput.
It pauses on blur/hidden tabs and requires explicit resume. Escape toggles pause;
normal Tab/Enter/Space behavior remains available to the DOM controls.

Headless fixtures yield every 600 ticks and check a run identifier. Leaving while
they settle discards the result and never writes into a new career. Training
and round changes operate on a pending copy until all fixture results complete.
A save therefore always describes a settled round, not a half-committed table.
`EXPORT REPLAY` preserves an in-progress match separately if desired.

Career storage is `vanillajs.touchline.v1`. Save files use
`qsol.touchline-save.v1` wrapping a `qsol.touchline-career.v1` state, checksum,
content snapshot and most recent replay. Career imports have a separate 1 MiB /
100,000-node budget because they include both source content and mutable squads.
Imports validate rosters, fixtures,
lineup, economy, injuries and any embedded replay. Failed imports preserve the
current career. If local storage is unavailable or full, the UI asks you to
export a file. Offline reload works after the packaged service worker finishes
its first installation on HTTPS or localhost; no private donor worker is used.

## Provenance, units and scope

Source: [SOCCERWEB v3.1.1](https://github.com/QSOLKCB/Soccerweb/releases/tag/v3.1.1),
commit `e2b67c01b0edf7afa3577c60458e5366eea69bde`, Apache-2.0.
See [PROVENANCE.json](../demos/football-manager/PROVENANCE.json), the retained
[license](../demos/football-manager/SOCCERWEB-LICENSE.txt) and root NOTICE.
`scripts/verify-football.js` checks the pin and adapted file hashes in normal CI.

The core combines attributed sections of donor math, state, team AI, ball
physics and match logic. The browser adapter combines camera, stadium, player
animation and Canvas2D rendering. The management demo integrates standard
outdoor eleven-a-side football. It does not reproduce the donor's arcade menus,
GOALPOSTS campaign, human-control bindings, indoor mode UI or standalone saves.

**Coordinate exception:** donor authoritative coordinates are Q8 canvas pixels
(`Q=256`), +X right, +Y down, with Z representing ball height. Velocities are Q8
pixels per fixed tick. This is a named compatibility boundary, not VANILLAJS's
usual SI/+Y-up world. Do not pass these values directly into SI modules. Integer
quantization and donor goal geometry are preserved; match presentation uses
floating-point Canvas transforms without feeding them back into physics.

## Verification

```sh
node --test tests/football.test.js
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
```

Packaged Chromium CI runs `scripts/browser-football.js` through the donor suite:
club selection, training, recruitment, live match pause and commands, substitution,
partial replay, abandoned-match isolation, full round, local save reload, invalid
mods, mobile width and offline navigation. Screenshots are workflow artifacts.
The dispatcher and dependency policy require fresh browser evidence for this
integration; unrelated prior receipts cannot certify it. No owner GPU runner
or local Playwright installation is required by these changes.
