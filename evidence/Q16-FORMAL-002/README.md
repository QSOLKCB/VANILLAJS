**Q16-FORMAL-002 — independent Lean replay, source verification, and power-loss recovery**

The completed executions survived. This package preserves their original bytes and failure records, adds the separately identified `10-recovery-validation` attempt, and completes evidence sealing after the interruption. No original execution is relabelled or silently reconstructed. The original Lean builds and numerical runs did not require re-execution.

| Identity | Exact value |
| --- | --- |
| Frozen verification target and original execution commit | `b99f5a4af17babe1215bc36872a18a4c72714faf` |
| Last commit changing the formalization | `f4a5be4cf6522ff2d11f41fa9dc00b50396f38ed` |
| `Q16Formal.lean` Git blob | `84ea668446d4217b526fd12c64224743efb81954` |
| `Q16Audit.lean` Git blob | `ddabca35acf9d1c7d6fd2a43189efdd70c548bf3` |
| Tested `modules/integer-math/index.js` Git blob | `d457b0154d9dfc8b50fd593b5e9dff75e1ea66b9` |
| Expected inventory SHA-256 | `9dd94f76d6c7343c162f35d4fe0f5fcd79146bdc740d2cbae333aabd5580984c` |
| Publication branch | `evidence/q16-formal-002-independent-replay-20261108` |

The evidence-publication commit is the Git commit first adding this package. Its exact SHA is recorded in the draft PR after the commit is created; embedding that SHA inside the same commit would be circular. It is distinct from the execution commit above. The package is evidence-only. No production implementation, original proof, original audit script, or workflow is changed.

Recovery preflight found the main checkout clean at `afef132d8fd0a9acfc874ed760ea3dc5a175d906`. The existing publication branch was clean at the frozen target. Four detached execution worktrees retained that target with unchanged tracked source and only generated Lake artifacts untracked. The completed evidence was outside Git and had not been committed or pushed. GitHub searches by Q16-FORMAL-002 and by the evidence branch returned no PR; the remote evidence branch was absent. No final Q16-FORMAL-002 manifest existed. The durable state establishes that sealing and publication were unfinished; it does not establish which process, if any, was active at shutdown.

The recovery acquisition retained 602 files: original evidence, owner reference, console captures, mutation inputs, and untracked build artifacts. They are under [original/](original/), with an acquisition manifest created during recovery. The original directory remains untouched on the workstation. A verified preservation archive is retained under [recovery/](recovery/). [preflight.json](recovery/preflight.json) records the recovered worktree state. [frozen-inputs/](frozen-inputs/) contains 16 proof-relevant files copied directly from the frozen Git objects and checked against the original input hashes. These are reference copies, not a new execution checkout.

| Verification boundary | Result and evidence |
| --- | --- |
| Mathematical model verification | PASS. Clean local Lean builds and typed consumers checked all 14 complete propositions and five helper-definition identities. [ExactStatements.lean](original/evidence/ExactStatements.lean), [original result](original/evidence/exact-statements.txt), [second target result](original/evidence/corrective/08-target-repro/exact-statements.txt). |
| Origin/trust audit | PASS. Exactly 31 declarations: 14 specified theorems, 12 generated auxiliary lemmas, five definitions. Exact names, module origins, kinds, universes, pretty types, expression trees, dependencies and axiom records match the pinned expected inventory. [Complete inventory](original/evidence/corrective/INVENTORY.md), [machine baseline](original/evidence/corrective/expected-inventory.json). |
| Dependency closure | PASS. 1,706 reachable constants; only `Quot.sound` and `propext` as transitive axioms. No unexpected declaration, `sorryAx`, unauthorized axiom, unsafe or partial dependency. The sole reviewed opaque dependency is `String.Internal.append`, pinned with its type, value and dependency details. [First target](original/evidence/corrective/04-target/verification.json), [second target](original/evidence/corrective/08-target-repro/verification.json). |
| Finite JavaScript conformance | PASS for the exact source blob above: 220,921 accepted quotient cases; 33,992 expected arithmetic rejections; 1,148 canonical zeros; 200,009 square-root brackets; 17 regression tests, zero failures/cancellations/skips/todos. [Bridge output](original/evidence/q16-source-bridge.json), [full regression log](original/evidence/q16-regressions.txt). |
| Evidence integrity | PASS for retained historical checksums and recovery acquisition. The final package manifest is `SHA256SUMS`; verify it using the commands below. |
| Universal Lean-to-ECMAScript refinement | **OPEN.** Finite BigInt comparison does not prove all ECMAScript executions refine the mathematical model. |
| Historical authorship and copyright | Outside the mathematical proof. This package makes no adjudication. |

Independent execution used fresh detached worktrees on the same workstation and the preinstalled pinned toolchain. The recorded preconditions required the frozen HEAD, clean tracked/untracked state, and no existing `.lake` directory before each fresh target build. The first successful Lean/JavaScript replay ran on 2026-11-08 at approximately 09:10 UTC. The corrective target and second clean target replay completed before recovery, with the latter running from 09:25:44 to 09:25:56 UTC. Every command has its original start/end timestamps, exit status, stdout and stderr. All 113 original execution receipts survived. The two corrective inventories are byte-identical, and both complete console captures equal the ordered per-command stdout files.

Lean was `leanprover/lean4:v4.35.0`, release commit `eb6cafb7290e8bd5f2937522d8d804f58f02bafc`; Lake was `5.0.0-src+eb6cafb`; Node was `v22.18.0`; Python was `3.14.4`; Git was `2.53.0`. The platform was Ubuntu 26.04.1 LTS, x86_64 Linux. No Lake package dependencies were present. [TOOLCHAIN.txt](original/evidence/TOOLCHAIN.txt) and [tool-identity.json](original/evidence/corrective/08-target-repro/tool-identity.json) retain executable, linked-library, input and generated-metadata hashes. The installed Lean distribution comprised 17,938 files, with manifest digest `462a8305814ae8ef9994c4b9a01b543e977b3c6cad65db7b602841fd835f2e22`. Recovery recomputed the complete identity and found it identical.

All **28 corrective controls** have actual rejection exits and the expected diagnostic, verified against their individual receipts and raw output. Six deliberate Lean source mutations built successfully before audit rejection; removal and weakening also failed the exact typed consumers. The remaining cases cover empty/truncated/malformed records, duplicate or missing declarations/dependencies, generated-lemma `sorryAx`, source/toolchain identity mismatches, dirty source, unexpected source modules/packages, and a modified expected inventory. [RESULTS.json](original/evidence/corrective/07-negative-controls/RESULTS.json) lists all 28; [executed harness](original/evidence/corrective/07-negative-controls/negative-controls.executed.py), per-case directories, and [actual retained report inputs](original/negative-fixtures-07/report-inputs/) preserve their construction and execution. Identity/report mutations test the acceptance gate; they do not claim execution of production code under each simulated mismatched environment.

The **five original adversarial controls remain enabled and unchanged**: unauthorized `sorryAx`, missing theorem, duplicate theorem, unexpected theorem and malformed record. Their prior successful execution is retained, and [original-controls.stdout](recovery/10-recovery-validation/original-controls.stdout) records a separate recovery execution of the unchanged function with each rejection observed. Four additional malformed-report checks from the original owner-comparison script also remain preserved and passed recovery validation. These four are separate from the 28 corrective and five original controls.

Earlier failures remain failures, with their bytes unchanged:

- [attempts/01-sandbox](original/evidence/attempts/01-sandbox/) records `spawnSync git EPERM` and exit 1 during the first JavaScript bridge attempt. Its zero-byte bridge output is retained.
- [attempts/02-origin-audit-v1](original/evidence/attempts/02-origin-audit-v1/) records exit 1 when the first declaration-origin audit rejected compiler-generated auxiliary lemmas. The failed audit source and all 31 printed declarations remain present.
- The two owner-comparison failures, first baseline API failure, intermediate baseline reports, and failed/partial negative-control attempts `05` and `06` are also retained. They are not counted as successful complete audits. Corrective attempts `04`, `07`, `08`, and `09` provide the completed target, controls, reproduction and final validation records.

The pre-interruption [prior-evidence.sha256](original/evidence/corrective/prior-evidence.sha256) verifies all 91 earlier evidence files, including the two required failures. [tooling.sha256](original/evidence/corrective/tooling.sha256) verifies all seven pinned audit tools. The untouched owner ZIP matches its retained SHA-256 `e28d6a4af857fccdaa74e35325b74a532570922603d107a5b64b5042e5e0acd4`; all eight payload entries match its original manifest. Owner and independent arithmetic results agree exactly; regression timings differ and have not been normalized.

No complete pre-interruption SHA-256 manifest covering all later corrective logs existed. Their surviving receipts, duplicate console copies, duplicate target inventories, input hashes and fresh acceptance checks support recovery. `original/ACQUISITION.sha256` records bytes observed after recovery began; it is not presented as a historical pre-shutdown seal. The final `SHA256SUMS` seals this new publication package only. Hashes establish byte identity against retained references, not authorship, trusted timestamps or cryptographic signatures.

The new [10-recovery-validation](recovery/10-recovery-validation/) attempt records acquisition checks, the retained-record audit, current tool/source identity, owner comparison, the five original controls, and final source/archive checks. It does not report a new Lean build or new numerical conformance run. The recovery scripts preserve all old files and reject output reuse. Stored absolute paths identify the workstation execution context; use the relative validation commands below to inspect this publication copy.

From this package directory:

```sh
sha256sum -c SHA256SUMS
(cd original && sha256sum -c ACQUISITION.sha256)
(cd original/evidence && sha256sum -c corrective/prior-evidence.sha256)
(cd original/evidence && sha256sum -c corrective/tooling.sha256)
(cd original/owner-reference/extracted && sha256sum -c SHA256SUMS)
PYTHONDONTWRITEBYTECODE=1 python3 recovery/recovery-audit.py original original/ACQUISITION.sha256
```

A fresh proof replay must use a new clean checkout of the frozen target and a new attempt directory. Do not load the preserved build artifacts as evidence of a new build. The original harness expects its recorded source/evidence sibling layout. Do not run its output-writing commands against this sealed package.

Remaining assumptions include the Lean kernel/compiler and standard library, permitted logical axioms, operating system and hardware, Python/JavaScript audit harnesses, and collision resistance of the recorded hashes. The compiler was preinstalled: publisher-signature verification and an independent bootstrap were **NOT_RUN**. This was an independent execution in fresh worktrees, not an independent machine or compiler provenance audit. No universal JavaScript refinement, broader browser coverage, authorship conclusion, release publication or merge is claimed.

QSOL-IMC — Q16-FORMAL-002
