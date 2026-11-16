# Narrative API — explicit choices, portable story data

`modules/narrative/index.js` is an **experimental v2.7.0 candidate**. It is a pure,
dependency-free module for original branching stories, dialogue, choices, typed
variables, named quest/objective progress and inert events. It owns no renderer,
DOM, device, clock, file loader or game fiction. Existing engine APIs are unchanged.

Each call advances **one explicitly selected choice**. No node follows a link by
itself, and a story cannot execute JavaScript, evaluate an expression, import a
module, load a URL or render HTML. Dialogue is plain text; applications must use
`textContent` or another text renderer, never interpret it as HTML.

[Open Narrative Foundry](../demos/narrative-foundry/index.html) ·
[Creator tutorial](NARRATIVE_FOUNDRY.md)

## Small complete example

This example has one gated choice, an objective and a scene cue. The cue is only
a string; the consuming application decides whether it has an allowed handler.

```js
import {
  NARRATIVE_FORMAT, validateStory, createState, availableChoices,
  choose, serializeStory, serializeSave, restoreSave
} from '../modules/narrative/index.js';

const story = validateStory({
  format: NARRATIVE_FORMAT, version: 1,
  id: 'signal-example', title: 'A small signal', start: 'workshop', maxSteps: 16,
  variables: [{ id: 'hasLens', type: 'boolean', initial: false }],
  objectives: [{ id: 'restore-light', title: 'Restore the light' }],
  events: ['light-restored'],
  nodes: [
    {
      id: 'workshop', title: 'Workshop', dialogue: 'A spare lens rests on the bench.',
      ending: false,
      onEnter: [{ op: 'objective', objective: 'restore-light', status: 'active' }],
      choices: [{
        id: 'take-lens', label: 'Take the lens', target: 'lantern',
        condition: { op: 'always' },
        effects: [{ op: 'set', variable: 'hasLens', value: true }]
      }]
    },
    {
      id: 'lantern', title: 'Lantern', dialogue: 'The empty housing faces the sea.',
      ending: false, onEnter: [],
      choices: [{
        id: 'repair', label: 'Fit the lens', target: 'dawn',
        condition: { op: 'eq', variable: 'hasLens', value: true },
        effects: [{ op: 'objective', objective: 'restore-light', status: 'complete' }]
      }]
    },
    {
      id: 'dawn', title: 'Dawn', dialogue: 'The signal returns.',
      ending: true, choices: [],
      onEnter: [{ op: 'event', event: 'light-restored' }]
    }
  ]
});
let result = createState(story);
result = choose(story, result.state, 'take-lens');
console.log(availableChoices(story, result.state).map(choice => choice.label));
result = choose(story, result.state, 'repair');
console.log(result.events); // ['light-restored']
const storyJSON = serializeStory(story);
const saveJSON = serializeSave(story, result.state);
const restored = restoreSave(story, saveJSON); // state only; emits no events
```

The relative import above is for an example file one directory below repository
root; adjust it when placing the example elsewhere. A consuming game must vendor
or otherwise serve a reviewed immutable engine release locally and retain its
licence/provenance. There is no remote loader in this API.

## Versioned story contract

`qsol.vanillajs.narrative.v1`, `version: 1`, has exactly these fields:

| Field | Meaning |
| --- | --- |
| `id`, `title` | Stable local identifier and plain-text display title |
| `start` | Existing initial node ID |
| `maxSteps` | Maximum explicitly selected choices, 1–1,024 |
| `variables` | Ordered typed declarations with initial values |
| `objectives` | Ordered `{id,title}` quest/objective declarations |
| `events` | Unique declared inert event IDs |
| `nodes` | Ordered node records |

A node has exactly `id`, `title`, `dialogue`, `ending`, `onEnter`, `choices`.
An ending has no choices. A non-ending may temporarily have none; diagnostics
report that authoring state. Every choice has exactly `id`, `label`, `target`,
`condition`, `effects`. Choice IDs are unique within their node; node IDs are
unique across the story. Reusing a choice ID in different nodes is permitted,
since history is interpreted from the known current node.

Declarations are one of:

```js
{ id: 'hasLens', type: 'boolean', initial: false }
{ id: 'courage', type: 'integer', initial: 0, min: 0, max: 5 }
{ id: 'route', type: 'string', initial: 'harbor', values: ['harbor', 'ridge'] }
```

Integer bounds must be within −1,000,000 through +1,000,000; all increments,
comparisons and accepted states use safe integers. Strings use an explicit
1–16-value enum, not free-form variables. Initial values and assigned values must
match the declaration. Unknown variables/objectives/events are rejected.

Each objective starts `inactive`; allowed states are `inactive`, `active`,
`complete`, `failed`. A declaration can represent a quest or one objective inside
a game-owned quest. Effects explicitly set progress; the module does not invent
hierarchical quest completion rules, rewards or scene changes.

## Declarative conditions and effects

| Condition | Exact fields and meaning |
| --- | --- |
| `always` | `{op:'always'}` is true |
| `eq`, `ne` | `{op,variable,value}` compares matching declared scalar types |
| `lt`, `lte`, `gt`, `gte` | Same fields; only integer variables support ordering |
| `all`, `any` | `{op,conditions:[...]}`; 1–8 child conditions |
| `not` | `{op:'not',condition:...}` |
| `objective` | `{op:'objective',objective,status}` tests a declared progress state |

There are no expression strings, implicit coercions, computed property paths or
operator plugins. Conditions read the state **before** the choice's effects.

| Effect | Exact fields and meaning |
| --- | --- |
| `set` | `{op:'set',variable,value}` assigns a declared value |
| `add` | `{op:'add',variable,value}` applies an integer increment within bounds |
| `objective` | `{op:'objective',objective,status}` sets declared progress |
| `event` | `{op:'event',event}` appends one declared ID to the returned event list |

Choice effects run in array order, followed by the target node's `onEnter`
effects in array order. Initial `onEnter` effects run once in `createState`.
An out-of-range increment, invalid choice or unsatisfied condition throws without
mutating the prior state or returning partial events. Applications dispatch events
only after the complete call succeeds. No callback is executed by the module.

## Public operations

| Export | Result and ownership |
| --- | --- |
| `validateStory(objectOrJSON)` | Owned recursively frozen normalized story; rejects malformed data and missing start/targets |
| `analyzeStory(objectOrJSON)` | Owned frozen structural diagnostics; allows missing links so the author can inspect them |
| `serializeStory(story)` | Compact canonical JSON under the story byte budget |
| `createState(story)` | `{state,events}` after initial node effects |
| `availableChoices(story,state)` | Owned frozen array of eligible choice records; empty at endings or the step cap |
| `choose(story,state,choiceId)` | Atomic `{state,events}` for one allowed choice |
| `serializeSave(story,state)` | Exact story-bound versioned save JSON |
| `restoreSave(story,objectOrJSON)` | Owned frozen state reconstructed by bounded choice replay; no events dispatched or returned |
| `replayEvents(story,state)` | Frozen ordered inert event IDs reconstructed in one validated replay; no callbacks or dispatch |

State is `{node,variables,objectives,steps,history}`. Public state inputs are
validated against a replay of their entire bounded history, so modifying a
variable, current node or step count cannot forge a reachable state. Functions
have no shared mutable session state. Two stories/sessions can coexist without
resetting one another. The implementation revalidates/replays supplied snapshots;
there is no unbounded history or hidden cache, and no throughput claim is made.

Constants are `NARRATIVE_FORMAT`, `NARRATIVE_SAVE_FORMAT`, `NARRATIVE_BYTES`,
`NARRATIVE_SAVE_BYTES` and frozen `NARRATIVE_LIMITS`.

## Diagnostics and cycles

`analyzeStory` returns:

```js
{
  valid,                   // no missing start/choice target
  missingLinks,            // [{from, choice, target}]; null from/choice for start
  unreachable,             // node IDs unreachable through structural links
  reachableEndings,         // ending node IDs reachable through structural links
  cycles,                  // strongly connected ID groups, including self-loops
  warnings                 // plain-text explanations
}
```

Structural reachability **ignores conditions**. It reports possible graph paths,
not whether variable constraints allow a player to traverse them. A graph can
have a structurally reachable ending while all choices leading there are locked.
Playthroughs and game-specific tests must establish actual reachable outcomes.

Cycles are valid. They never automatically traverse: each transition needs a
fresh explicit choice supplied by the application. `maxSteps` stops progress at
a fixed bound even if a self-loop remains eligible. There are at most 16 effects
per list, therefore at most 16 initial events or 32 events per choice transition.
A condition has at most 64 nodes and depth eight. Graph diagnostics use bounded
strongly connected-component traversal, not unrestricted path enumeration.

## Save identity and transactional import

Save format is `qsol.vanillajs.narrative-save.v1`, `version: 1`:
`{format,version,story,storyIdentity,history}`. `storyIdentity` is the complete
canonical validated story JSON. It is deliberately exact, not a weak checksum or
an authentication claim. Formatting and input object key order normalize; node,
choice and declaration order are authored content and remain part of identity.
Changing dialogue, a condition, title, initial value or any other canonical story
field invalidates its old saves. There is no silent migration.

Only the bounded choice history is stored as runtime progress. Restore validates
the exact story identity and replays it to reconstruct variables, objectives,
current node and steps. Replayed event IDs are discarded. A game must save its
own world/scene/inventory state separately, or deliberately reconstruct an inert
scene snapshot from a validated history. Restore must not blindly repeat rewards,
audio, network requests or other external side effects. `replayEvents` supplies a
validated inert event sequence when a scene adapter needs to reconstruct its final
visual snapshot. It returns at most `16 + 32 * maxSteps` IDs (32,784 at the maximum),
including initial entry effects. Use one final scene update, rather than replaying
every visual transition or executing external event handlers.

For story import, prepare both candidates before replacing the accepted session:

```js
const candidateStory = validateStory(importedText);
const candidateSession = createState(candidateStory); // may reject an effect overflow
// Commit these two owned values only after both operations succeeded.
```

Likewise, call `restoreSave` before replacing accepted state. Exceptions mean the
caller retains its previous state. User data must never become agent instructions
or executable callbacks.

## Bounds and verification

| Resource | Limit |
| --- | --- |
| Serialized story | 256 KiB UTF-8 |
| Serialized save | 1 MiB UTF-8, including exact story identity |
| Nodes / choices per node | 128 / 8 |
| Variables / objectives / event IDs | 32 each |
| Title / choice label / dialogue | 96 / 160 / 2,048 JavaScript string units |
| IDs | 1–48 ASCII letters/digits/underscore/hyphen; lowercase first letter; reserved prototype names rejected |
| Effects per list | 16 |
| Conditions | Eight levels below root, at most 64 nodes per choice |
| Explicit selected choices | Story-defined, 1–1,024 |

Unknown versions/fields, sparse arrays, array subclasses, symbol fields, accessors,
unsupported prototypes and oversized data are rejected. Limits also apply to
object inputs; serializing unvalidated imported objects is not part of admission.
As with ordinary JavaScript validation, callers should pass JSON data or plain
records, not hostile Proxy objects whose own inspection traps execute in the caller.

Run `node --test tests/narrative.test.js`. The independent fixtures exercise
actual branching state/event order, ownership, every condition operator, missing
links and structural false positives, strict admission, transactional overflow,
cycles and step limits, exact story saves, tampered state and byte/depth budgets.
Browser authoring and scene cue behaviour belong to the consuming lab checks.

For Games2, this can supply tactical dialogue, mission/objective state, investigation
choices, RTS briefings, survival quests or branching endings. Those games own
fiction and event handlers and must adopt a reviewed immutable engine release in
a separate PR. This API does not implement those games or authorize source copying.
