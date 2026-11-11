# Your universe, in plain text

VOIDWARD's entire source is included. Content lives in UTF-8 `.txt` campaign
files; deeper rule changes are ordinary local JavaScript. There is no workshop
account, paid SDK, binary database or runtime build service.

## Start with a working campaign

1. Copy `mods/frontier/` into `mods/my-campaign/`.
2. Change `id`, `version`, `title` and `description` in `campaign.txt`.
3. Edit the text files. Open **Campaign workshop → Import .txt folder** and select
   your copied directory. It validates and starts as a data-only campaign.
4. Alternatively, use **Edit text files** inside the game. **Download this .txt**
   saves an individual edited file. **Validate & start** starts the edited pack;
   **Export campaign pack** then exports the active campaign in a portable JSON
   envelope. For an unlaunched visual-workshop draft, use **Export draft pack**.
   Reopen that envelope with **Edit text files → Open portable pack**.
5. To ship a pack with the game, add its ID, title, description, local directory URL and hooks
   to `mods/registry.js`. Run the offline inventory command below.

All tables use **one record per line**, with `|` between fields. Blank lines and
lines beginning `#` are ignored. The first comment in each file lists its column
order. Do not put `|` inside a name or description. Name files contain one name
per line. Settings use `key = value`. IDs are lowercase letters, digits and
hyphens, beginning with a letter, at most 40 characters. Duplicate IDs are errors.
Use ordinary names from your own fiction, or assets you have permission to share.

## File reference

| File | Meaning |
| --- | --- |
| `campaign.txt` | Pack ID, semantic version, title and description |
| `empire_names.txt` | Full empire names, one per line, in empire-ID order |
| `empires.txt` | `id \| short \| #primary \| #accent \| home-system-id \| ethos` |
| `system_names.txt` | Names of stars, in system-ID order |
| `planet_names.txt` | Names of worlds, in `system × planetsPerSystem + orbit` order |
| `planet_types.txt` | `id \| name \| population-cap \| base-minerals \| palette` |
| `map.txt` | `system-id \| comma-separated-neighbours \| archive-0-or-1` |
| `hulls.txt` | `id \| name \| faction-id-or-* \| slots \| hp \| cost \| work \| research-id \| required-level \| polygon` |
| `components.txt` | `id \| name \| role \| slots \| cost \| hp \| attack \| speed \| research-id \| required-level \| description` |
| `ships.txt` | `empire-id \| class-name \| hull-id \| comma-separated-component-ids` |
| `buildings.txt` | `id \| name \| cost \| work \| minerals \| energy \| science \| production \| defence \| description` |
| `research.txt` | `id \| name \| description` |
| `music.txt` | `MIDI-note-number \| duration-in-seconds` |
| `rules.txt` | Numeric economy, population, construction, diplomacy and victory settings |

Text packs are bounded to 500 KB total, 100 KB per file. Labels are displayed as
text, never interpreted as HTML. Uploaded files cannot execute code or fetch
remote URLs. Missing files, invalid rows, duplicate IDs, invalid geometry,
disconnected maps and illegal starting ships are rejected before activation.

## Empires and worlds

Use 2–6 empires with consecutive IDs starting at zero; **empire 0 is the default
playable empire**. Optional `scenario.txt` defines the playable list and may omit
empire 0. Each empire needs a distinct starting system and at least one ship carrying each
of `survey`, `colony` and `assault` roles (one ship can carry multiple roles).
Starting designs must fit their hull and require only level-I technology.

`columns × rows` determines 4–64 systems. Each system has 1–4 planets. Provide
enough names for all systems and planets. The seeded map jitter and planet types
are generated reproducibly; homeworlds use the first entry in `planet_types.txt`.
Population caps must be 20–1,000. The three built-in procedural planet palettes
are `ocean`, `gas` and `ice`; change `js/render.js` for other texture generators.

Every `map.txt` link must be reciprocal, with no self-links or duplicates, and
the graph must be connected. Example: if system 0 lists 1, system 1 must list 0.
Stars with archive=1 carry a GLUBALL visual marker and a one-time survey reward.
Coordinates are illustrative chart units; starlanes are not physical distances.

## Ship frames and the ship designer

Each empire ships with four original silhouettes: scout, colony ark, frigate and
capital hull. Change any hull's stats, polygon or faction. `*` makes a hull
available to every empire. Hull slot capacity may be 2–40; polygon vertices are
`x,y;x,y;...`, 3–40 points, each coordinate between -60 and 60. The nose is toward
negative Y. These are 2D chart/blueprint silhouettes, not 3D imported meshes.

Example new shared hull:

```text
courier | Frontier Courier | * | 7 | 45 | 55 | 60 | industry | 1 | 0,-48;24,20;12,38;-12,38;-24,20
```

Component roles are `engine`, `weapon`, `shield`, `survey`, `colony`, `assault`.
Each component declares its own size, price, hull contribution, attack and
technology requirement. Hull/attack contributions sum; movement uses the
fastest installed engine. **Every ship needs at least one engine.** Only engines
may supply speed (1–4 lanes per turn). Duplicate components are allowed, so a
player can build multi-weapon or heavily shielded designs within available slots.

```text
plasma | Plasma lance | weapon | 2 | 60 | 0 | 35 | 0 | weapons | 3 | Heavy energy weapon.
```

Add that row and it appears in the in-game designer, locked until Weapons III.
Add a hull and it appears for its faction when unlocked. The game never relies
on a hard-coded list of hull IDs, silhouettes or part prices. It validates capacity,
research, role and faction ownership when registering or building a design.
Queued and built ships keep snapshots; editing another class never refits them.

`ships.txt` defines both the starting ships and each empire's initial design
archive. Class names may contain 1–32 characters. Built-in AI retains its required roles, packs researched components into available
capacity and can select larger researched combat hulls. It updates templates
through legal commands; existing ships still require an explicit yard refit.
For different AI design policies, edit `ai()` in `js/core.js`.

New role semantics, arbitrary 3D meshes, textures and alternate battle engines
require source extensions. The text format does not pretend to import every
asset format or automatically implement a newly invented gameplay rule.

## Economy and technology

All balances, yields, hull points and command outcomes are bounded integers.
Cancellation refunds use VANILLAJS ExactRational multiplication and explicit
floor conversion, following the exact authoring approach of Ternary Reach.

`mine`, `reactor`, `lab`, `yard`, `defence` are required building IDs; add additional
IDs freely. All declared resource and production yields accumulate per facility.
The `yard` ID enables shipbuilding/repair, and `mine` is given to new colonies.
`industry`, `propulsion`, `weapons`, `shields` are required research IDs. You can
rename them and add additional fields for component unlocks. Added fields also
participate in the all-sciences victory condition.

`rules.txt` must contain exactly the keys shown in the supplied example. Main knobs:

| Setting | Effect |
| --- | --- |
| `startMinerals`, `startEnergy` | Same initial stockpiles for all empires |
| `colonizeMinerals`, `colonizeEnergy` | Settlement cost, in addition to consuming the ark |
| `baseProduction`, `industryProduction`, `industryMinerals` | Colony production and industry-level bonuses |
| `baseEnergy`, `baseScience` | Base colony income before population and facility yields |
| `baseDefence`, `shieldDefence` | Base and shield-tech planetary strength |
| `researchBase`, `researchStep` | Next level costs `base + currentLevel² × step` |
| `maxTech` | Common technology ceiling, 2–8 |
| `tradeIncome`, `tradeCost`, `peaceCost` | Treaty yields and immediate prices |
| `warGrace` | Standard AI war grace; relaxed adds 23 turns, veteran (Aggressive in the UI) subtracts 14 (minimum 5); `ai.txt` aggression also adjusts the base |
| `relicScience`, `relicMinerals` | One-time archive salvage |
| `repair` | Hull points repaired per turn at a friendly shipyard outside fleet combat |
| `facilityLimit` | Maximum facilities of each type per colony, 1–10 |
| `fleetLimit` | Maximum ships plus reserved ship orders per empire, 3–60 |
| `colonyTarget`, `turnLimit` | Expansion threshold and final council scoring turn |

Full checked bounds live in `js/content.js`. Colonies have five queue slots and
each empire has 24 registered-class slots. A queue pays its full mineral cost on
admission, advances only its head each turn, and refunds the unfinished fraction
when cancelled. Zero energy halves ship attack; upkeep cannot make energy negative.

## Source mods and custom campaigns

Add a local module to your pack and statically import it in `mods/registry.js`:

```js
import myHooks from './my-campaign/hooks.js';
// Add to campaigns:
{ id: 'my-campaign', title: 'My campaign',
  description: 'Rebuild a lost observatory network.',
  base: new URL('./my-campaign/', import.meta.url), hooks: myHooks }
```

Hooks receive `(state, api)` and run only for the selected registered campaign:

```js
export default {
  onCreate(state, api) {
    api.log(state, 'The observatory is calling.', 'info');
  },
  onTurn(state, api) {
    if (state.turn === 12) {
      const empire = state.empires[state.player];
      empire.minerals = Math.min(999999, empire.minerals + 100);
      api.log(state, 'A supply convoy arrives.', 'build');
    }
  },
  victory(state, api) {
    if (api.colonies(state).length >= 4 && state.empires[state.player].science >= 400)
      return { winner: state.player, text: 'The observatory network is complete.' };
    return null; // Continue checking normal campaign victories.
  }
};
```

`onCreate` runs once for a new campaign, never on save validation. `onTurn` runs
after movement/combat/economy/construction, before normal victory evaluation.
`victory` can supply a bounded winner/text result. The browser applies each order
to a candidate state and validates it before replacing the active campaign, so a
throwing or invalid hook cannot partially commit a turn.

Source hooks are **trusted local JavaScript**, with normal page privileges. They
are not sandboxed. Read source before installing it. Persist custom progress in
`state.modState`: a JSON object bounded to 16 KiB, depth 10, 4,096 nodes, 256
items per array and 2,048 characters per string. Numbers must be safe integers.
The base state schema rejects unknown fields. Imported `.txt` folders and
portable text packs never activate hooks, even if their ID matches a registered
campaign. A registered source-mod save must match that installed campaign's exact
text content. Ship API state as bounded JSON, use the campaign turn, and avoid
ambient randomness/time if deterministic replay matters. Machine Dawn contains a
working turn-8 event. Hook versioning belongs in the campaign version.

## Saves, packaging and testing

Each save key includes the campaign ID, version, complete content SHA-256 and
whether it uses installed source hooks or imported text. Nonzero playable empires
have separate slots; empire 0 uses the base slot naming. VANILLAJS prefixes browser keys with `vanillajs.`; exported save formats remain compatible. Edits create another
slot. Starting a fresh game in an existing slot overwrites that slot after the
new-game dialog; export first to preserve it. Exported saves include the text
pack and state. Invalid imports leave the live campaign untouched. Portable files
use compact JSON, with a 49 MiB UTF-8 envelope limit and a 48 MiB state limit;
older pretty-printed saves within that envelope limit remain supported. Export
checks its output before downloading. Browser storage quotas can be lower: export
a file if autosave reports full storage. See [save limits and measured admission](docs/SAVE_LIMITS.md).

Run from the VANILLAJS repository root after any content or runtime edit:

```sh
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
# Packaged Chromium (external Playwright; obtain desktop handover locally):
node scripts/browser-check.js --suites=worlds,editor
```

Browser QA uses an external Playwright installation; the runtime has no package
dependencies. The stage allowlists the full VANILLAJS runtime, including this demo.
The service worker caches this inventory, including new registered packs. Always
refresh its generated digest when changing files. Validate new and restored
campaigns, starting ships, routes, victory, defeat, malformed pack imports, narrow
screens and offline reload before distribution.

## Source map

| File | Extend here |
| --- | --- |
| `js/content.js` | Text schemas, bounds, pack references and new catalog fields |
| `js/core.js` | Turn order, AI, resource rules, routing, combat, save admission |
| `js/app.js` | Screens, controls, workshop, saves, command dispatch |
| `js/render.js` | Ship/planet artwork, map layers, texture cache |
| `js/audio.js` | Original ambience arrangement and event sounds |
| `mods/registry.js` | Installed packs and trusted source hooks |
| `scripts/build.js` (repository root) | Deployment inventory and scope-isolated offline cache |

Retain original Apache-2.0 and file-level donor licences, plus attribution for
your own contributions. No canonical geometry, physical validity, proof coverage
or cross-runtime audio identity is inherited merely by making a game with these
modules. Create new worlds and share the source.

## Expansion formats (optional, backwards compatible)

The original fourteen files remain required. Optional files below are included
in folder/native-pack exports only when authored. Old packs keep their original
bytes, fingerprints and default rules. Installed packs list their extra file
stems in their registry entry's `files` array; this avoids requesting missing
files from old packs.

| Optional file | Columns or settings |
| --- | --- |
| `scenario.txt` | `playable`, `victory`, `minVictoryTurn`, `defeatAtLimit` |
| `layout.txt` | `id \| x \| y`, chart coordinates within −2000..2000 |
| `dependencies.txt` | `field \| level \| requires \| requiresLevel` |
| `objectives.txt` | `id \| owner \| kind \| target \| amount \| requires \| branch \| title \| description \| victory` |
| `events.txt` | `id \| turn \| requires \| kind \| owner \| target \| value \| repeat` |
| `starts.txt` | `empire \| minerals \| energy \| science \| colonies` |
| `ai.txt` | `reserveMinerals`, `colonyShips`, `militaryLimit`, `aggression` |
| `provenance.txt` | `hull \| source \| sha256 \| license \| operation`, retained by the Workbench bridge |

For example, all three empires can be selected in Grand Frontier:

```text
playable = 0,1,2
victory = objectives
minVictoryTurn = 100
defeatAtLimit = 1
```

`victory = legacy` is the default. Objective mode suppresses automatic colony and
all-sciences wins; military elimination still applies. `defeatAtLimit = 1` makes
missing the deadline a loss for the selected empire. Completed milestones,
selected route, archive recoveries and once-only event receipts persist in saves.
One mutually exclusive story route can be selected per empire per expedition;
all steps with the selected `branch` remain available. Blank branches are shared
stages. Milestones are historical, not continuously maintained requirements.

Objective owners are `player` (the selected human empire), `*` (each empire races
independently) or a numeric empire ID. Prerequisite IDs are comma-separated.
`victory` is 0 or 1. Supported conditions:

| Kind | Target | Progress |
| --- | --- | --- |
| `colonies` | `-` | Current owned worlds |
| `survey` | `*` or system ID | Surveyed count, or 1 for the named system |
| `archives` | `*` or archive system ID | Archives recovered by this empire |
| `research` | Field ID | Current level |
| `trade` | `*` or empire ID | Trade pact count, or 1 for the named partner |
| `control` | System ID | Owned worlds in that system |
| `survive` | `-` | Current turn while the empire remains viable |
| `defeat` | Empire ID | 1 when that empire is defeated |
| `resources` | `minerals`, `energy`, `science` | Current stockpile |

The shipped Grand Frontier table is a working example:

```text
first-chart | * | survey | * | 12 | | | A shared chart | Survey twelve stars to establish the frontier survey service. | 0
settled-reach | * | colonies | - | 6 | first-chart | | Six lights in the dark | Develop six colony worlds before choosing your political future. | 0
concord | * | trade | * | 1 | settled-reach | concord | The concord charter | Choose a diplomatic future and maintain at least one trade pact. | 0
```

An event's `turn` is its earliest turn. It waits for its prerequisite objectives
for its owner. `repeat = 0` means once; a positive value is the minimum interval
between successful executions. Owners are `player` or an empire ID. Effects are
explicit bounded operations; text never becomes an expression or a script.

| Event kind | Target | Value |
| --- | --- | --- |
| `resources` | Resource name | Amount to add, capped by the stockpile limit |
| `spawn` | Owner's starting design index, zero-based | System ID where one ship arrives, respecting the fleet cap |
| `war` | Other empire ID | 0; establishes contact and issues the legal war order |
| `message` | Printable message | 0 |

For example, Outer Rim supplies 160 minerals every fourteen turns:

```text
relief | 14 | | resources | player | minerals | 160 | 14
```

A spawn index refers to the registered design slot initially created by
`ships.txt`. If that template has been updated, the arriving ship uses its current
design. It does not replace or upgrade ships already present.

`starts.txt` overrides a named empire's opening stockpiles and adds colonies by
planet ID, `system × planetsPerSystem + orbit`. Its normal home remains owned.
Overlapping starting ownership is rejected. A dependency row such as
`weapons | 4 | industry | 3` gates Weapons IV on Industry III. Cycles, missing
references, invalid owner dependencies and incompatible branch prerequisites are
rejected with physical file, line and field diagnostics.

AI defaults are reserves 80 minerals, two desired colony ships, a 35-ship military
limit and aggression 50. Supported bounds are 0–10000, 1–6, 3–60 and 0–100.
These are policy targets, not resource cheats. AI issues the same research,
construction, template update, refit, diplomacy and movement commands; its goals
use current sensors and last-seen observations. New policies or actions require
JavaScript changes in `core.js`.

## Visual authoring and Workbench exchange

See [WORKSHOP.md](guide.html) for the complete creator tutorial, including
VANILLAJS Asset Foundry/Component Forge project conversion and Mod SDK limits.
The map editor selects stars and edits coordinates numerically; it also edits
reciprocal lanes and starting positions. The hull editor accepts canvas clicks
or keyboard-entered points. Record forms edit component, faction, ship, research,
objective, event and economic tables. The text editor remains available for all
formats. Validate a detached draft before starting it in a separate save slot.

`scenario.txt`'s `minVictoryTurn` gates objective victories only; last-empire
conquest can win earlier.

## Save migration and source boundaries

State version 2 adds the selected empire, groups, standing orders, refits,
intelligence snapshots and scenario ledgers. The portable save envelope remains
`voidward.save.v1` so existing records can still be discovered. Version-1 state
imports migrate through `engine.migrateState`; unknown or malformed fields are
rejected. Original ships, queues, balances and installed hook state are retained.
Old archive ownership cannot be reconstructed from a claimed boolean; migrated
legacy packs have no new archive objectives. Old surveyed intelligence becomes
an initial snapshot and then follows current sensor rules.

Editing a pack creates a new content identity. The game does not silently apply
changed economic or geometry data to an existing save. Export the old save, keep
its embedded pack, and start a new expedition for the changed pack. Registered
source-hook saves require the exact installed text version. Source hooks remain
trusted local JavaScript with page privileges; imported data never enables them.

Supported limits remain 64 systems, four planets per system, six empires, sixty
ships per empire, five queued orders per world and twenty-four registered designs
per empire. New limits: 64 objectives, 128 events, 128 dependency rows, one story
route per empire, 30 retained turn reports and bounded last-seen system records.
Stockpiles are at most 999999. Monotonic ship/group identifiers may reach one
million without increasing active fleet limits; admission and overflow are tested. A larger nominal turn limit alone does not extend
strategic play; test objective reachability and the AI's actual completion time.

New component roles, production resources, diplomatic actions, objective
predicates, event effects, battle rules or generators require explicit JavaScript
extensions and tests. Renaming a role in a text row cannot invent a new mechanic.
