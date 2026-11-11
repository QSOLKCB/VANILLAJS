# Visual Editor authoring campaign

VANILLAJS Mod SDK — Build games. Extend the engine. Own your creations.

This is not a product. This is INDEPENDENCE. 👽

These are experimental editor improvements, not a stable Mod SDK. The editor
continues to use native modules, the existing strict scene/project formats and
CPU-first optional rendering with explicit GPU/WASM consent. Existing v1 scenes
migrate to v2; asset project import/export and playable exports keep their contracts.

## Working in the editor

- Find hierarchy objects by name, ID or body type. Matching descendants retain
  their ancestors for context. Up/Down and Home/End select and focus visible rows.
- Filter assets by name, kind or ID. A filtered-out choice is cleared so Attach
  cannot silently use an invisible asset. Parent choices omit self/descendants;
  physics bodies remain roots.
- Use Ctrl/Cmd+D to duplicate, Ctrl/Cmd+S to download scene JSON, Ctrl/Cmd+Z to
  undo and Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y to redo. Text fields keep native editing
  shortcuts. Scene undo remains bounded; placement snapshots follow scene history to avoid
  stale attachments when an undone entity ID is reused. Asset definitions remain
  in the library and asset-only edits do not create history entries.
- F or Frame fits the selection and descendants; Shift+F fits the visible scene.
  Camera framing includes imported mesh bounds and portrait aspect ratios.
- W/E/R select transform tools. Snap uses 0.25 m / 15 degrees / 0.1 scale.
  Shift-drag root movement now honors the same snap toggle and metre grid.
  Escape cancels a live drag; focus loss cancels it too. A cancelled drag adds
  no history entry. Outside a drag, Escape clears selection or pauses play.
- Blank, nonfinite and out-of-range numeric inputs show an error and keep the
  authored scene unchanged. Enter in the inspector never reloads the document.
- Invalid scene/project imports leave the current document intact. Async local
  asset imports cannot repopulate a replacement document or enter Play mode.
- A complete project recovery copy is saved in this browser's localStorage after
  400 ms without another edit. Restore draft explicitly replaces the current
  document after confirmation. Storage errors are visible and do not prevent
  editing/export. Recovery is one local slot per origin, shared by editor tabs;
  the last tab to save wins. It is not a replacement for downloaded project files.
- Small screens put the viewport first, with hierarchy and inspector below.

## Numerical boundaries

Open **ALIEN MATH · exact position** for an editable XYZ decimal draft. Read
selection imports the existing floating-point values as decimal text; it cannot
recover decimal precision already lost in a scene file. Preview Q16.16 reports
raw signed integers and exact signed errors under explicitly selected rounding
and overflow policies. Apply decimals and Apply Q16.16 each commit one scene
history entry. D4 transforms only the draft's local XY point about its parent
origin, preserving Z and orientation. Exact interval checks enforce the existing
closed position bounds before committing.

See [exact authoring contracts](EDITOR_ALIEN_AUTHORING.md) for parser limits,
rounding, overflow, snapping and the intentional Number boundary. No exact
3D collision, quaternion, rendering or universal source-refinement claim is made.

## Extension seams and next steps

| Area | Existing boundary to extend | Constraint |
| --- | --- | --- |
| Tools and layout actions | Pure `demos/editor/authoring-math.js` and `workflows.js`; DOM adapters in `app.js` | Validated scene data in, one validated history transaction out; no evaluated strings |
| Inspectors/custom components | `components.js` normalization and `model.js` component transactions | Add a versioned schema/validator and migration/tests before new persisted fields |
| Scene/asset packs and templates | `parseProject`, `serializeProject`, prefab instantiation | Data only, existing size/provenance limits; no remote scripts or automatic downloads |
| Moddable labs | Consume reviewed native modules and strict data packs | A future code-plugin lifecycle requires a separate trust/capability design |
| DRONE-RACER courses | `modules/exact-course` and its exact course compiler | Future adapter must preserve decimal strings, course conventions and explicit Q16 policies; this editor does not export a course format yet |

`workflows.js` helpers expect already validated model/library records. They do not
replace import admission. No untrusted JavaScript mod is executed or described
as sandboxed. No new runtime package dependency or simulation arithmetic was added.

## Verification and reproduction

From repository root:

```sh
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
python3 scripts/alien_math_001_oracle.py --check
python3 scripts/alien_math_002_oracle.py --check
python3 scripts/alien_math_003_oracle.py --check
python3 scripts/alien_math_004_oracle.py --check
node scripts/browser-check.js --suites=editor
```

The last command requires the existing isolated pinned Playwright 1.64.0 tooling
and its Chromium shell, exposed via `NODE_PATH` and `PLAYWRIGHT_BROWSERS_PATH`.
It uses the packaged `dist/` files. No browser installation is part of runtime.
The changed editor/browser closure must execute in hosted CI; the campaign does
not update witness hashes to manufacture eligibility for reuse. The shared
manual full-browser override and fail-closed unknown-source policy stay intact.

New tests cover exact bounds/policies/D4/snapping, camera fit and geometry parity,
hierarchy filtering/parent eligibility, shortcuts/native text undo, cancelled
drags, invalid numeric fields/imports, recovery, migrated projects, exports,
320/390 px layouts and forced CPU fallback. See
[viewport measurements](EDITOR_VIEWPORT_QOL.md) for paired workloads, byte parity,
measured timing regressions and scope limits. Node timings are not browser FPS
or hardware GPU claims; idle rendering was already demand-driven before this PR.

## Executed campaign checks

Local Node v22.18.0: all 620 tests passed; contract checker passed 239 JavaScript
files, 44 module contracts and two research experiments. Packaging and offline
verification passed for 137 files. Independent ALIEN MATH 001–004 oracles passed.

Pinned Playwright 1.64.0 / Chromium 156.0.8078.4 executed all seven packaged suite
groups. The broad run passed render, play, worlds, research and donor; after the
final editor fixes, `--suites=home,editor` passed against the rebuilt package,
including the home harness's final failure paths. No cached browser witness was
used for these local runs. Browser checks use software graphics; physical GPU
performance and other browser/OS coverage are not inferred. Hosted PR CI remains
an independent gate and does not authorize merge or deployment.
