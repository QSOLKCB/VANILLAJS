#!/usr/bin/env bash
# Run from a fresh detached target worktree. Evidence output must be empty.
set -euo pipefail
audit_tools="$(cd "$(dirname "$0")" && pwd)"
audit_evidence="$(realpath "$1")"
audit_root="$(cd "$audit_tools/../.." && pwd)"
capture() { python3 "$audit_root/capture.py" "$audit_evidence" "$1" "$2"; }
capture source-before.txt 'git rev-parse HEAD
test "$(git rev-parse HEAD)" = b99f5a4af17babe1215bc36872a18a4c72714faf
git hash-object Q16Formal.lean Q16Audit.lean modules/integer-math/index.js
git status --porcelain=v1 --untracked-files=all
test -z "$(git status --porcelain=v1 --untracked-files=all)"
test ! -e .lake
cat lean-toolchain lakefile.toml
lean --version
lake --version'
capture proof-inventory.txt 'python3 scripts/verify-q16-proof-boundary.py'
capture lean-build.txt 'lake build Q16Formal'
capture q16-axiom-audit.txt 'lake env lean Q16Audit.lean'
capture axiom-verification.txt 'python3 scripts/verify-q16-axioms.py ../evidence/corrective/04-target/q16-axiom-audit.txt'
capture exact-statements.txt 'lake env lean ../evidence/ExactStatements.lean'
capture inventory.json 'lake env lean ../evidence/corrective/tools/Inventory.lean'
capture identity.json 'python3 ../evidence/corrective/tools/collect-identity.py ../evidence/corrective/expected-inventory.json'
capture verification.json 'python3 ../evidence/corrective/tools/verify.py ../evidence/corrective/expected-inventory.json ../evidence/corrective/04-target/inventory.json ../evidence/corrective/04-target/identity.json'
capture tool-identity.json 'python3 ../evidence/tool-identity.py'
capture source-after.txt 'git diff --exit-code
git diff --cached --exit-code
git status --porcelain=v1 --untracked-files=all
git rev-parse HEAD
git hash-object Q16Formal.lean Q16Audit.lean modules/integer-math/index.js
cat lake-manifest.json'
