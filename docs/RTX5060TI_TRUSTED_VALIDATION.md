# RTX 5060 Ti trusted validation — local, opt-in, exact-source comparison

**Status:** proposed instrumentation; NOT executed on the owner's physical GPU by this PR. No benchmark or GPU-pass claim follows from adding this workflow.

This is a repeatable, **headed native-GPU** comparison between:

- **Frozen pre-optimization control:** `QSOLKCB/VANILLAJS@1f965f4e5b6669de0f954e3a39b11aa679e56720` (pre-PR #13/#14/#15).
- **Reviewed candidate:** the exact clean local `main` HEAD at execution (recorded SHA and tree hash).

Do not relabel earlier SwiftShader Chromium results as RTX measurements. This workflow refuses to proceed unless **both** `nvidia-smi` and the WebGL `WEBGL_debug_renderer_info` extension identify an NVIDIA RTX 5060 Ti. Software renderers (SwiftShader, llvmpipe, lavapipe) fail closed. This is evidence of the observed driver path, **not TPM-backed hardware attestation**.

## Activation 1: local desktop (recommended; no GitHub runner)

Required, preinstalled locally: Ubuntu graphics login with `DISPLAY` or `WAYLAND_DISPLAY`; working NVIDIA driver and `nvidia-smi`; native headed Google Chrome or Chromium; Node.js v22+; Git **full history**; locally available `playwright` Node module used **only** as test tooling. This does not add a runtime or packaging dependency. There is no automatic installation or network lookup.

From a **clean reviewed `main` checkout** of `QSOLKCB/VANILLAJS` after this PR is merged:

```sh
git switch main
git status --short
git log -1 --format='%H %s'
nvidia-smi
export NODE_PATH="$HOME/.local/share/qsol/browser-tools/node_modules"  # only if Playwright lives there
node scripts/rtx5060ti-trusted.mjs
```

The optional `NODE_PATH` line is an example, not a required exact path. If you already have Playwright installed in an accessible tooling directory, point to that; otherwise obtain/review the pinned Playwright 1.64.0 tool separately **before activation**, under an isolated tooling prefix outside the repo. There is no `npm install` in the validation workflow. The program accepts `--chrome /absolute/path/to/chrome` and `--out /absolute/path/outside/repo` when necessary; `--expected-head <exact40hex>` provides an extra SHA pin.

Evidence is saved by default under `$XDG_STATE_HOME/qsol/vanillajs/rtx5060ti/<UTC timestamp>` or `~/.local/state/qsol/vanillajs/rtx5060ti/<UTC timestamp>`. A successful run creates private `report.json`, `SUMMARY.md`, and `SHA256SUMS`. A failed/incomplete GPU or parity run instead creates an explicit `FAILURE.json` plus `SHA256SUMS`, never a success-shaped report. Raw successful samples include machine/driver observations and statistical allocations. No evidence is uploaded automatically. Temporary detached worktrees are removed after completion. Failure exits nonzero.

## Activation 2: explicit GitHub Actions dispatch (optional)

`.github/workflows/rtx5060ti-trusted.yml` is registered for **workflow_dispatch only**. It has no push, schedule, or PR trigger. It is gated on `main`, the `EmergentMonk` actor, and an explicitly checked authorization input.

To use it, *you* must register a dedicated **self-hosted** Linux x64 GitHub runner on your owned RTX 5060 Ti machine with custom label `qsol-rtx5060ti`, and launch that runner **within the visible desktop login session** so Chrome can use the actual NVIDIA WebGL driver. Background system services without a display are not supported. Never expose that runner to untrusted PR workflows; restrict it to this repository and reviewed branches, and consider a dedicated unprivileged desktop account. A self-hosted runner is **not offline**, because GitHub can deliver runner jobs. Use Activation 1 for the stronger offline-first boundary.

After this PR lands on `main`, navigate to **Actions → RTX 5060 Ti trusted local validation → Run workflow**, choose `main`, tick `acknowledge_local_execution`, and leave `publish_evidence` **unchecked** unless you expressly choose to upload machine-specific receipts to GitHub. By default only a summary enters the Actions job log; full evidence remains in `~/.local/state/qsol/vanillajs/rtx5060ti/actions-<run>-<attempt>/` on the desktop. A runner lacking the exact label will queue rather than silently use a hosted software GPU.

The runner requires the same preinstalled Chrome, Node, Git, Playwright and NVIDIA tools. The workflow pins the existing approved checkout/upload actions; the checkout does not retain credentials and fetches full Git history. Nothing automatically installs packages or drivers.

## Measurement protocol

Both versions build their **own pinned source** with their own `scripts/build.js`; the comparison serves only the allowlisted `dist` output over `127.0.0.1`. Browser requests outside that local origin are aborted. A visible, headed browser and the same version, display, GPU and OS session are used for both.

| Measurement | Identical stimulus | What is reported |
| --- | --- | --- |
| CPU static geometry | 480 fixed boxes × 20 builds/trial | Native browser V8 elapsed ms; frozen `boxVertices` + flatten vs current packed box builder |
| Static collision | 128 finite rays × 480 colliders/trial | Native browser V8 elapsed ms; direct `castSegment` vs opt-in BVH **including index construction** |
| GPU visual correctness | Three fixed ticks and camera/scene poses | SHA-256 of native WebGL `readPixels` RGBA; exact matching required |
| GPU uploads and draws | Running FPS Lab **tracking** recipe, no player input | Observed WebGL `bufferData`/`bufferSubData` calls and submitted bytes, draw calls and vertex counts |
| Actual frame timing | Same FPS Lab recipe, graphics resolution, screen and 240-frame sample | rAF frame interval p95 and JS frame callback median; raw samples retained |
| JS memory allocation | Separate 180-frame native FPS Lab pass | CDP statistical allocation sampling (32 KiB interval) and GC-adjusted JS heap; not exact allocation or RSS |

Two warm-up pairs precede **seven alternating baseline/candidate pairs** for the CPU tests and application frame tests. The 240-frame sample gate closes synchronously inside the 240th completed callback, so WebGL submission counts cannot include later frames. Any blur, hidden-document, lost focus or `PAUSED` state during a measured or warm-up sample invalidates the trial. Timing results are descriptive observations, not noisy CI thresholds. CPU geometry bytes, complete canonical collision receipt hashes, and native pixel hashes must match exactly; any mismatch aborts before emitting a successful receipt.

**Scope limits:**

- The BVH remains an **opt-in API**; these collision savings are not presented as an FPS-game collision speedup unless the game starts using the index in a separately reviewed change.
- The actual FPS Lab has fixed simulation steps but advances according to browser wall-clock frames; the no-input scene recipe and settings match, not necessarily the same number of simulation ticks at each sampled present. The deterministic CPU and GPU parity lanes use exactly the same data/tick sequence.
- Submitted GPU upload bytes count API submissions, not actual PCIe bus traffic, physical VRAM allocations or guaranteed transfer completion.
- The rAF callback duration is CPU JavaScript execution; frame interval includes compositor/vsync and does not isolate GPU draw execution. No claim of hardware GPU milliseconds is made without timer-query evidence.
- Sampling changes memory behavior and therefore runs separately from timing. CDP allocation sampling explicitly retains samples for objects collected by major and minor GC; surviving-objects-only sampling would be misleading. A single statistical profile is still not an exact per-frame or whole-process memory allocation count.
- Browser, OS compositor, power state, thermal/frequency variation and background work affect measurements. Repeat on the same machine after ensuring similar conditions. No remote sensor or cloud access is required to run the CLI.

## Verification and promotion gates

```sh
node --check scripts/rtx5060ti-browser.mjs
node --check scripts/rtx5060ti-trusted.mjs
node scripts/rtx5060ti-trusted.mjs --help
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
```

The ordinary hosted CI performs **syntax/help preflight** and deterministic fake-rAF/WebGL sample-boundary tests, not the physical NVIDIA GPU run. Physical results must be reported separately with their exact source SHA, driver, browser, profiles, raw medians, hardware gate status and `SHA256SUMS`. Keep any incomplete/failed attempts explicitly failed; no simulated or substituted RTX numbers are permitted.
