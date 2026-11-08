#!/usr/bin/env bash
# Invoke from a new, clean detached worktree of the frozen commit.
# Usage: bash /path/to/evidence/replay.sh /new/empty/evidence-directory
set -euo pipefail
replay_tools="$(cd "$(dirname "$0")" && pwd)"
replay_out="$(realpath "$1")"
capture() { python3 "$replay_tools/capture.py" "$replay_out" "$1" "$2"; }

capture source-before.txt 'git rev-parse HEAD
test "$(git rev-parse HEAD)" = b99f5a4af17babe1215bc36872a18a4c72714faf
git rev-parse HEAD:modules/integer-math/index.js
git hash-object modules/integer-math/index.js
test "$(git hash-object modules/integer-math/index.js)" = d457b0154d9dfc8b50fd593b5e9dff75e1ea66b9
git status --porcelain=v1 --untracked-files=all
test -z "$(git status --porcelain=v1 --untracked-files=all)"
test ! -e .lake
test "$(cat lean-toolchain)" = leanprover/lean4:v4.35.0
git ls-files "*.lean"
git ls-files -s'

capture TOOLCHAIN.txt 'cat lean-toolchain
lean --version
lake --version
node --version
python3 --version
git --version
bash --version
uname -smr
cat /etc/os-release
elan toolchain list'

capture proof-inventory.txt 'python3 scripts/verify-q16-proof-boundary.py'
capture lean-build.txt 'lake build Q16Formal'
capture effective-lean.txt 'lake env lean --version'
capture q16-axiom-audit.txt 'lake env lean Q16Audit.lean | tee "$Q16_EVIDENCE/q16-axiom-audit.txt"'
capture axiom-verification.txt 'python3 scripts/verify-q16-axioms.py "$Q16_EVIDENCE/q16-axiom-audit.txt"'
capture q16-source-bridge.json 'node scripts/q16-formal-bridge.mjs | tee "$Q16_EVIDENCE/q16-source-bridge.json"'
capture q16-regressions.txt 'node --test tests/q16-radix.test.js tests/q16-independent.test.js tests/integer-math.test.js | tee "$Q16_EVIDENCE/q16-regressions.txt"'

capture source-after.txt 'git rev-parse HEAD
git hash-object modules/integer-math/index.js
test "$(git hash-object modules/integer-math/index.js)" = d457b0154d9dfc8b50fd593b5e9dff75e1ea66b9
git diff --exit-code
git diff --cached --exit-code
git status --porcelain=v1 --untracked-files=all
cat lake-manifest.json'
