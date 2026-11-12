# Portable save size and admission

Portable saves use compact JSON with a **49 MiB UTF-8 envelope limit** and a
**48 MiB UTF-8 state limit**. One MiB is 1,048,576 bytes. The remaining envelope
budget accommodates the validated text pack (at most 500,000 UTF-8 bytes) and
metadata. The format remains `voidward.save.v1`; older pretty-printed envelopes
under the envelope limit still load. Original state versions are migrated after
size, envelope and pack checks.

`js/save-codec.js` supplies the limits and encoding/decoding used by file uploads,
manual exports, autosaves and engine state decoding. Export checks the resulting
text before creating a download. Import checks its encoded byte size before
JSON parsing, then validates the complete pack and state before activation.
Imported JSON does not select executable hooks unless its installed campaign
identity and complete text hash match the registered source campaign.

The previous 2,000,000-character envelope and 1,500,000-character state ceilings
were smaller than structurally valid long-campaign saves. Pretty indentation
could also push an otherwise loadable compact save over the envelope ceiling.
The regression fixture exports 2,429,209 bytes through the actual compact codec
and restores every state field. The separately authorized 12 November browser
verification also passed file upload, actual UI export, switching to a different
campaign and reimport, comparing every state field and pack file after each step.

## Schema budget

The ceiling follows the existing bounded schema; it does not increase map,
fleet, queue or history capacities. To budget arbitrary admitted strings,
allow six JSON bytes per UTF-16 code unit (for example U+0001 becomes `\u0001`).
The rounded allowances below include punctuation, field names and bounded
numbers. They deliberately add maxima that ordinary play may never reach
together.

| State section | Existing maximum | Conservative compact JSON allowance |
| --- | --- | ---: |
| Completion history | 30 reports × (256 worlds + 360 ships), 200-character labels | 24 MB |
| Worlds and construction | 256 worlds × 128 facility counts and five queued design snapshots, 40 components per design | 7 MB |
| Active ships and refits | 360 ships, each with an existing and refit design snapshot | 3 MB |
| Empire designs and technology | Six empires × 24 designs and 128 research fields | 1 MB |
| Intelligence, maps, logs, battles, survey history and scenario state | Their separately validated record/string limits | 3 MB |
| **Rounded combined allowance** | **Existing schema only** | **38 MB** |

The 48 MiB state ceiling leaves margin above that conservative 38 MB allowance.
Recalculate this budget when changing record counts, identifier lengths, history
retention or string bounds. Do not silently raise the file limit without a
structural budget, rejection tests and a new resource measurement.

## Reproduce admission and roundtrip checks

From the VANILLAJS repository root:

```sh
node tests/voidward-save-codec.test.js
```

`tests/voidward-save-fixtures.js` builds both the bounded maximal synthetic
fixture and the roughly 2.43 MB browser fixture. These are admission tests,
not naturally played campaigns. `scripts/browser-voidward.js` exercises actual
UI import, export and reimport after switching to another campaign. It compares
every authoritative state field and every pack file.

The original measurements remain in the pinned
[4XGAMES save-limit report](https://github.com/QSOLKCB/4XGAMES/blob/030859385ac8929e066702ef8af0518663480653/docs/SAVE_LIMITS.md).
New port results are documented in VANILLAJS `docs/VOIDWARD_VALIDATION.md`.
Browser storage quotas can be lower than file admission limits; export a file
when autosave reports full storage.
