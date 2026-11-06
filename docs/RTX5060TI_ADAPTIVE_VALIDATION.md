# RTX 5060 Ti — adaptive donor follow-up validation (proposed)

**Status:** owner-only physical measurement workflow, **NOT YET EXECUTED** on this feature head. This file is a test plan and runbook, not GPU evidence. Run only after reviewed code is merged to `main`.

## Frozen provenance (unchanged)

RTX5060TI-001 is an immutable-content archive at
`evidence/RTX5060TI-001/vanillajs-rtx5060ti-42203888152.zip` with SHA-256
`1a45f75dcc6050189591f0de187745325076712ee4e60e9168ef9c6a5d75f1b8`.
It preserves the earlier NVIDIA RTX 5060 Ti test performed on source
`240617e8bc1a935f05eaf75a10531f194f72a173`, compared with baseline
`1f965f4e5b6669de0f954e3a39b11aa679e56720`.

The donor-extraction base is
`93ace342c11e2427ad82920c8965f16e91518fb7`.
The GAMES donor is pinned to `7e0a9019d07b491cffc9b698fa51acdb843c49cc`;
CorpoWars3d to `8e86066686a575402ee2818378f1ec9323fb9ee6`.

**RTX5060TI-001 cannot provide a historical timing for new circle or cuboid
kernels:** those algorithms were not measured in the original run. We preserve
its exact ZIP, validate its SHA-256 and replay the *original* baseline-versus-
candidate protocol after upgrade; separately, we measure fresh serial brute/grid
and forced-fresh/retained native WebGL pairs for the new algorithms. Never
subtract numbers from two different workload definitions to claim speedup.

## Activation — one owner-controlled runner

`.github/workflows/rtx5060ti-adaptive.yml` is a dedicated manual
`workflow_dispatch` workflow. It cannot run on push or pull_request, and
requires all of the following:

- The code has been **reviewed and merged to main**, `github.actor` is
  `EmergentMonk`, and `acknowledge_local_execution` is explicitly true.
- Dedicated self-hosted labels `self-hosted, linux, x64, qsol-rtx5060ti`;
  NVIDIA RTX 5060 Ti; visible X11/Wayland desktop. No headless/Xvfb fallback.
- Git full history, clean exact-source `main`, `nvidia-smi`, local Chrome,
  Node 22+ and preinstalled isolated Playwright (the same offline resolver as
  the original trusted workflow). No `npm install` or automatic downloads.

From **GitHub Actions → RTX 5060 Ti adaptive donor validation → Run workflow**,
choose `main`, acknowledge local execution and set `publish_evidence=true`
if an attachment is wanted for the later preservation PR. Keep the browser
visible and do not interact with it while trials run.

## Gates and measurements

1. Fail closed on checkout/branch/actor mismatch, dirty source, missing
   historical commit, missing GPU prerequisites or incorrect preserved
   RTX5060TI-001 SHA. The standard-library historical verifier and
   `sha256sum -c` both run.
2. Re-run exact donor module tests, the source-contract checker and build.
3. Run the original `scripts/rtx5060ti-trusted.mjs` full-path comparison,
   pinned to historical pre-optimisation commit `1f965f4...`, against the
   **new exact main SHA**. It verifies native RTX WebGL/pixel parity and records
   CPU geometry, static collision, FPS samples, GPU submission counts and
   statistical allocation observations, as before.
4. Record single-process **serial** brute/grid/adaptive CPU query workloads
   including index construction, with exact result parity. No worker threads.
5. Run `scripts/rtx5060ti-adaptive-browser.mjs` in visible native Chromium:
   14/26/58/128 circles, 7 alternating paired trials, two warm-ups, and
   32-frame cuboid scenes comparing forced-fresh buffers to retained static
   buffers. Require native NVIDIA renderer identity, focus/visibility, and
   exact resulting framebuffer hash parity. Timing uses `gl.finish()` and
   includes CPU/GPU-driver/compositor costs; **it is not GPU timer-query data**.
6. Finalise a **new** `EXPERIMENT.json`, `SUMMARY.md` and
   `SHA256SUMS` under
   `~/.local/state/qsol/vanillajs/rtx5060ti/adaptive-actions-RUN-ATTEMPT`
   outside the repository. Only a completed successful run gets these files;
   on any failure no success receipt is published.
7. Upload the new evidence only when `publish_evidence=true` was selected.
   GitHub's short-lived workflow artifact does not replace source-controlled
   preservation; store the **exact downloaded ZIP bytes and its actual SHA-256**
   in a **separate follow-up PR**, with a new numbered hardware receipt and
   source/run IDs. Do not replace RTX5060TI-001.

The normal hosted Flight Lab CI does **not** execute the self-hosted hardware
workflow. It validates all new code and runs the deterministic serial workload,
then syntax-checks the owner-only GPU entrypoint and Python receipt writer.

## Interpretation

The benchmark separates brute/index overhead, CPU and GPU submission costs,
work-count changes and pixel correctness. The 32-item adaptive switch is an
empirical hypothesis imported from donor observations, not a universal speedup.
If the candidate loses or matches the reference, retain that evidence. Do not
label an observed driver-call reduction a proportional FPS improvement.
No new framework, GPU attestation, hidden workers, or benchmark-based release
gate is implied.
