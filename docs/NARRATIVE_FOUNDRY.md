# Narrative Foundry — give a moment a choice

Open the [Narrative Foundry](../demos/narrative-foundry/index.html) through a local
HTTP server. It is an experimental v2.7.0 authoring tool. It runs in the browser
without accounts, remote assets or a service API.

A **node** is one moment of dialogue or story text. A **choice** links that moment
to another node. A **condition** decides whether a choice is available. An
**effect** changes a declared variable or objective, or produces a named event
for a consuming game. These are validated data records; no story text executes.

The original example, **The Last Lantern**, follows a traveler trying to signal
a courier from a coastal tower. Its seven nodes include three distinct endings,
a lens condition, courage and route variables, a named objective and a deliberate
cycle. The preview uses the public narrative module, not a separate simulation.

## Play the example first

1. Choose **Go straight to the lantern**. Fitting the prism is unavailable because
   `hasLens` is false. The disabled choice explains its condition.
2. Choose **Look for something in the workshop**, then **Carry the prism to the
   tower**. Entering the workshop sets `hasLens` and activates the objective.
3. Choose **Fit the prism and light the harbor**. The objective completes and the
   original 3D lantern scene visibly changes through declared events.
4. Restart. Take the high ridge and answer the courier for another ending. Or
   leave a message and turn back to reach the quiet ending.

Restart resets preview progress while preserving your authored story. **Restore
original story** replaces the authored project with the example; Undo can restore
what you had before that accepted edit. Nothing is automatically saved to a cloud
or account. Export work you want to keep before leaving the page.

## Make your own branch

1. In **Add a moment**, enter a unique ID such as `morning`, and a title such as
   “A new morning.” Select **Create node**. New nodes begin as endings.
2. Write its dialogue and select **Apply node**. Keep the ending checkbox selected
   if this closes a branch. An ending cannot have outgoing choices.
3. Select the starting node in **A map of moments**, then **New choice**.
4. Enter a unique choice ID, readable choice text and the new node as its target.
   Start with **Always available** and **No effect**, then **Apply choice**.
5. Play that choice in the preview. Your new dialogue is now part of the running
   story. Graph diagnostics stop marking the node unreachable once it is linked.

The node cards list actual outgoing target IDs. Their vertical order is a reading
order, not a claim that adjacent nodes are linked. Dashed cards are structurally
unreachable from the chosen start. **Make start node** changes the entry point.
Deleting a node with incoming links is rejected until those choices are changed.

Edits apply transactionally: the whole candidate story and its initial state are
validated before replacing the accepted project. A rejected edit or import leaves
the accepted story and current preview intact. Accepted edits restart preview;
Undo/Redo keeps up to twenty accepted project snapshots.

## Add a condition and an effect

Edit your new choice and select **Variable is at least**, variable `courage`, value
`2`. Apply the choice. With the example's initial courage of `1`, it is unavailable.
Under **Change the first page**, change courage's initial value to `2` and apply.
The same choice is now available through the engine's condition evaluation.

Values are typed. Boolean values must be `true` or `false`; integers stay inside
their declared bounds; strings must be one of their declared values. Integer
comparisons are unsuitable for booleans or strings and are rejected.

An effect can set a variable, add a bounded integer, update an objective or emit
a declared scene cue. In this lab, select **Emit a scene cue → harbor-safe** to
make your choice light the original harbor scene. The scene effect is performed
by the application after the module returns accepted events.

The form edits one simple condition and one effect. **Keep existing advanced
condition/effects** preserves imported compound conditions or multiple effects
when changing a choice's label or target. The complete JSON view admits the full
bounded API vocabulary; it does not evaluate JavaScript. Node entry effects can
also be edited as inert JSON through the dedicated validator.

Variables, objectives and event declarations travel with the story. The original
`restore-light` objective represents a small quest using `inactive`, `active`,
`complete` and `failed` states. Objectives do not complete automatically: authored
effects explicitly transition them. For a larger game, declare its own objectives
and organize quest progression through those reviewed effects.

## Preview, validation and cycles

Preview lists the current variables, objectives, choice count and recent cues.
Locked choices remain visible with a condition explanation. The graph checker
reports missing links, unreachable nodes, structurally reachable endings and
cycle groups. Missing links reject an import or edit; unreachable nodes and cycles
are useful diagnostics, not necessarily errors.

Structural reachability ignores conditions. It does not prove that an ending is
playable, nor that every effect can succeed from every reachable state. Test real
paths. An out-of-range arithmetic effect is rejected before committing that choice;
use a condition when an increment may reach its declared maximum.

Cycles require explicit user choices. The example stops after 64 choices; the
module's configured maximum is 1,024. There is no automatic traversal or script
execution. Reaching the budget leaves the state inspectable and offers restart or
restoration of earlier progress. The [API contract](NARRATIVE_API.md) defines all
node, choice, effect, text, condition-depth and byte limits.

## Save the story, or save your place

**Export story** downloads validated `qsol.vanillajs.narrative.v1` JSON containing
nodes, dialogue, conditions, effects, declarations and the traversal budget. Import
it into the lab or a game that implements the same version. The export does not
include an engine, scene renderer, executable script, menu system or complete game.

**Save progress** downloads `qsol.vanillajs.narrative-save.v1` data bound to the exact
canonical story. Restoring replays the bounded choice history and validates it;
changing dialogue, choices, effects or initial values invalidates an older save.
A matching story ID alone is insufficient. Import the exact original story before
restoring its progress.

The narrative module restores state without firing external effects. This lab
reconstructs its miniature scene from the validated history's inert event IDs and
applies the resulting scene once. It does not replay audio, network requests,
rewards or other external actions. A game must define its own save/restore contract
for such effects and other scene state.

## The scene boundary

The [lab-owned scene adapter](../demos/narrative-foundry/scene.js) uses
[`scene-graph`](../modules/scene-graph/index.js) for parent/child transforms and
owned snapshots, and the existing [`render-webgl`](../modules/render-webgl/index.js)
renderer for its original miniature. Four application-owned cue IDs can change it:

| Cue | Demonstrated application effect |
| --- | --- |
| `lantern-lit` | Light-colored lantern geometry and visible beam |
| `harbor-safe` | Lit harbor ending and warm workshop window |
| `courier-left` | Lit tower and a changed courier position |
| `dark-route` | Dark tower and quiet ending |

Other declared events are legal narrative data but have no scene mapping here.
The UI reports them; it never treats their names as module paths, functions or
instructions. Appearance changes use existing colored geometry. This lab does not
claim a new dynamic-lighting or physically based rendering backend.

The scene renderer owns and disposes its meshes/program. Unchanged scene cues do
not rebuild geometry, and the static preview has no continuous animation loop.
Resizing redraws the scene. If WebGL is unavailable or its context is lost, story
editing and preview choices remain usable with a visible graphics fallback.

For general scene authoring, use the [Scene Composition guide](SCENE_COMPOSITION.md)
and the existing Visual Workbench; this narrative lab does not replace that editor.

## Use the module in a game

The public API is independent of rendering, input devices and fiction:

```js
import {validateStory, createState, availableChoices, choose}
  from './modules/narrative/index.js';

const story = validateStory(localStoryData);
let result = createState(story);
// Present result.state and map its inert result.events through your own allowlist.
const choices = availableChoices(story, result.state);
if (choices.length) result = choose(story, result.state, choices[0].id);
```

The caller owns UI and event application. Render dialogue as text, such as with
`textContent`. Never route imported effects to `eval`, arbitrary property access,
HTML injection or dynamically imported modules. The complete example is the
[lab application](../demos/narrative-foundry/app.js).

A consuming game should pin an owner-reviewed immutable release containing these
APIs, retain Apache-2.0/licence and applicable content notices, and run its own
story, gameplay and packaging checks. These v2.7.0 additions require their own
review/release before a Games2 adoption PR. No Games2 files are changed here.

## Local use and checks

Run the repository build, serve the assembled directory through HTTP and open the
lab. `file://` is not a supported native-module/service-worker environment.

```sh
node scripts/build.js
python3 -m http.server 8000 --directory dist
```

Open `http://localhost:8000/demos/narrative-foundry/index.html`. The repository's
packaged browser checks additionally verify the `/VANILLAJS/` project prefix.
The normal offline worker precaches the verified package. Once installed and
activated, a subsequent controlled navigation can run without networking.

Relevant checks, using the already provisioned external browser tooling:

```sh
node --test tests/narrative.test.js tests/scene-graph.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
node scripts/browser-check.js --suites=editor
```

Keyboard users can reach node, choice and preview controls with Tab and activate
them with Enter or Space. Narrow screens use stacked panels. The lab does not
force autoplay audio, retain private story data remotely or require tracking.
Browser touch emulation is distinct from physical-device verification; consult
the milestone execution record for tests actually executed.
