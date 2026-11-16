# Declarative agent navigation

Start with [AGENTS.md](../AGENTS.md) and [the guide](../docs/AGENT_GUIDE.md).
`catalog.json` references the authoritative `MODULES.json`; it does not define APIs.
Validate with `node scripts/validate-agent-catalog.mjs` from the repository root.

`catalog.schema.json` uses JSON Schema 2020-12. The dependency-free local validator
implements exactly its bounded subset: type, const, enum, properties, required,
additionalProperties=false, items, minItems, uniqueItems, minLength and pattern;
$schema/title are annotations. Unknown schema keywords and unknown data fields
are rejected. It additionally checks the exact workflow ID set, module names,
real local files (including symlink containment), lab HTML entries and known
validation commands. It never executes commands or imported project data.

Add a workflow deliberately in both catalogue and schema; add meaningful tests
for any new validation keyword before using it. Keep limitations explicit.
Commands describe verification, not instructions sourced from untrusted content.
Workflow browser commands select the existing suites covering their real labs;
the catalogue-level browser command runs all suites after building `dist/`.
