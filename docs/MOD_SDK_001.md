# MOD-SDK-001 — bounded data-only extension registry

**Experimental.** This first phase establishes a local registry and versioned
manifest contract. It does **not** implement reusable ALIEN MATH game-authoring
adapters, editor plugin loading or moddable labs. Those belong in **MOD-SDK-002**.

**VANILLAJS Mod SDK — Build games. Extend the engine. Own your creations.**

**This is not a product. This is INDEPENDENCE. 👽**

## Scope and interface

The dependency-free `modules/mod-sdk/index.js` exports
`MOD_PACK_KIND`, `validateModManifest(source)`, and `DataModRegistry`.

The registry supports `register`, `activate`, `deactivate`, `unregister`,
`get`, `list` and `activeEntries`. Activation changes local registry state
only. It does not execute user callbacks, import executable scripts, fetch a
URL, modify a game world or grant browser permissions.

A source manifest is exactly:

    {
      "kind": "qsol.vanillajs.mod-pack.v1",
      "id": "retro-palette",
      "version": "1.0.0",
      "requires": [],
      "entries": [
        {"id":"colours","kind":"data",
         "data":{"accent":"#62ebd1","background":"#091425"}}
      ]
    }

The `requires` array contains records with exactly `id` and `version`.
IDs are canonical lowercase slugs (maximum 48 characters). A version is an
exact three-part numeric version with each component 0–999. No semver range,
automatic update, network resolution or speculative latest version exists.

Only `kind:"data"` entries are supported, and payloads are inert JSON-like
values. The registry does **not** validate whether a payload is a legitimate
course, scene, shader, material, texture, component or gameplay rule.
Consumers must perform their own domain-specific validation.

## Admission and resource limits

The module admits only plain records with exact own data properties.
It rejects extra keys, accessors, symbols, functions, BigInt payload numbers,
NaN/Infinity, sparse arrays, exotic prototypes, cyclic or aliased payload
objects and prototype-mutation keys.

All accepted data is detached from caller-owned objects, recursively frozen,
and bounded: 32 KiB UTF-8 serialized manifest; 32 registered packs;
at most eight dependencies and 32 entries per pack; payload depth eight;
512 visited nodes per entry; 128 object keys; and bounded string lengths.

This is a **plain-data contract, not a sandbox**. Malicious JavaScript already
executing in the same origin, hostile Proxy traps and consumers that
deliberately evaluate data are outside the registry's security guarantees.

## Lifecycle and dependency policy

`register(manifest)` validates and snapshots one pack. Known cycles and
duplicate IDs reject atomically; missing dependencies are allowed to support
offline out-of-order registration.

`activate(id)` verifies the complete exact-version dependency graph before
activating any pack. Missing or mismatched dependencies reject with no partial
activation. The returned activation order is dependency-first.

`deactivate(id)` refuses to deactivate a pack needed by an active dependent.
`unregister(id)` refuses an active pack or one required by any registered pack.
Dependencies remain active after their consumer is deactivated until explicitly
deactivated.

`get` returns a frozen manifest or null. `list` gives deterministic sorted
frozen status snapshots. `activeEntries` returns inert frozen records in
pack-ID order, with each entry scoped by its originating pack ID and version.
No game-loop, storage, clocks, network, GPU or DOM requirements are introduced.

## Example

Source example: [data-pack.json](../examples/mod-sdk-001/data-pack.json).
It is kept in source, not installed into any runtime or external service.

    import {DataModRegistry} from './modules/mod-sdk/index.js';

    const registry = new DataModRegistry();
    registry.register({
      kind:'qsol.vanillajs.mod-pack.v1',
      id:'my-palette', version:'1.0.0', requires:[],
      entries:[{id:'colours',kind:'data',data:{accent:'#44ddaa'}}]
    });
    registry.activate('my-palette');
    const data=registry.activeEntries(); // inert, deeply frozen
    registry.deactivate('my-palette');
    registry.unregister('my-palette');

## Verification

    node --test tests/mod-sdk.test.js
    uv run --no-project python scripts/mod_sdk_001_oracle.py
    node --test tests/*.test.js
    node scripts/check.js
    node scripts/build.js
    node scripts/verify-offline.js

The independent Python standard-library dependency-order oracle uses the
source-owned fixture in `tests/fixtures/mod-sdk-001-graph.json`. New JS tests
cover admission, immutability, duplicate/cyclic dependencies, missing/mismatched
versions, transactional activation, lifecycle, limits and inert payloads.
This is finite testing, **not** source-level formal proof.

## Next separately reviewed PR — MOD-SDK-002

**Reusable ALIEN MATH game-authoring and Mod SDK foundations:** typed exact
course/geometry adapters, engine/editor authoring data contracts, a reference
moddable lab, source-pinned testing against DRONE-RACER v0.2.0, explicit
rounding/overflow and independent validation. The existing VANILLAJS
exact-course and improved Visual Editor are starting points, not code to
reimplement. Trusted executable JavaScript extensions and a general-purpose
game kit remain later milestones. Every PR stops for owner review.
