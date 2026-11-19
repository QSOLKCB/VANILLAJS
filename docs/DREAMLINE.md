# The Machine Dreams — The Dreamline

**From Worlds to Imagination** is a 90-second Full Demo. One cyan trace wakes a raster machine, outlines a cathedral, joins a physical coastal drive, enters a projected E8 graph and closes on the QSOL-IMC identity. Play, pause, scrub or restart from the home page → The Dreamline. Fullscreen applies to the film. Reduced detail, reduced motion and silent playback are under Creator controls. The operating system's reduced-motion preference sets the initial motion setting.

## Edit and play locally

1. Run `node scripts/build.js` and `node scripts/verify-offline.js`. Serve `dist` on loopback with `python3 -m http.server 8000 --bind 127.0.0.1 --directory dist`. Visit `http://127.0.0.1:8000/demos/dreamline/`. All rendering and score synthesis use local modules. The public build opens with the credited MACHINE DREAMS instrumental. Its local event table synthesizes directly to stereo PCM. The independent engineering fixture remains available to offline tests.
2. Open Dreamline creator from the Visual Workbench. Choose trace and industrial metal colours, detail and camera motion. Save the project. Change the palette, then open the saved file and scrub to the same sample to inspect the original setting. Projects contain bounded data only.
3. To prepare an authorised local arrangement, run `python3 scripts/dreamline/score.py /private/score.musicxml /private/new-arrangement`. Load its `edit.json` under Creator controls. The compiler accepts bounded partwise MusicXML with integer quarter-note tempo, single-voice parts, rests, ties and major/minor chord symbols. It generates a conductor map, full SMF, full and edited sample events, and a hash receipt. Unsupported polyphonic cursor movements and repeats are rejected.
4. Render either event file using `node scripts/dreamline/pcm.mjs /private/new-arrangement/edit.json /private/new-edit.wav`. The same integer stereo synthesizer supplies the browser. AudioContext/device latency and GPU rendering are platform-dependent.

## Timeline and source

The five editorial cuts are at 0, 15, 30, 50 and 70 seconds. They are independent of bar numbers. Score attacks drive intensity, and the stereo scope samples the actual synthesized PCM. Sample 4,320,000 is terminal black/silence. Playback uses the audio context clock or a silent monotonic clock. Rendering accepts absolute integer samples. The 20-second HORIZON take evaluates the existing two-car Cape Aster session at 60 Hz once during setup. The visitor seeks among 601 retained physical poses at 30 Hz. The crane camera is artistic. This playback is a film, not a driving benchmark.

**MACHINE DREAMS** is credited to Trent Slade — QSOL-IMC. Instrumental arrangement and synthesis by QSOL-IMC / VANILLAJS. Sources are the authorised MusicXML and Mureka-assisted reference recording. The newly authored instrumental voices use score melody, harmonies and metre. The performance on the recording remains distinct. The score-derived events, SMF and newly synthesized arrangement are licensed under CC BY 4.0. The original recording, MusicXML, notation, lyrics and certificate are private. Original implementation and the independent line-check fixture use Apache-2.0.

## Reference revisions

| Reference | Revision | Use |
|---|---|---|
| VANILLAJS / HORIZON | c11f42278ac9e1ca03abaad0eeb1a45d3ffc5c53 | Race session, coastal scene, material renderer, articulated cars, text voxels and geometry |
| VIZ | 90a3ab3e72d7f46f3e8e99b1dbd5a68182f4c363 | Finite CRT support-event identity |
| E8 | 292cc9a41dd08bb8bc48b060c9e36157dbe3d1f0 | Order-30 Coxeter projection reference |
| EDGEWALK | b850c1d8650cd7bd1bfcd17640f00e28e0d1226d | Independent adjacency check for a real walk |
| SONIFICATION | 2ca65c6540d7051a77ed571b83f5a9df453094ec | Symbolic receiver design |
| Audio-To-Video | 6cd8839764b4926de4bcc71463014886bcdf1aa2 | Offline encode, decode and publish design |

The E8 receiver uses the repository's 240 roots, joins roots of inner product one and draws an actual connected trail through the 6,720 undirected edges. The small three-ring instrument separately traverses all 303 CRT support pairs. Projection and colour are artistic receivers. Donor code was not copied into these adapters.

THE MACHINE REMEMBERS retains its original 60-second, 50 fps project and score. The Dreamline uses a separate 90-second project profile, programmable palette, source-score importer and a physical HORIZON take. No 4 KiB/64 KiB or cross-GPU identity claim.

The work-specific Mureka Ownership Certificate dated 17 August 2025 identifies Trent Slade and this specific composition. The owner authorised distribution of the original composition and score-derived instrumental material under CC BY 4.0 on 19 November 2026 to the extent of rights held. Use the attribution “MACHINE DREAMS — Trent Slade (QSOL-IMC)”, credit the Mureka-assisted reference recording and identify the VANILLAJS instrumental arrangement. Original private inputs are excluded. The applicable 9 July 2025 Mureka terms distinguish paid/credit and free-tier output in section 3(e). Trent confirmed the paid subscription on 19 November 2026. The public test fixture is independently authored software data.

The film uses the same Canvas receiver in the browser and the offline raster host. The coastal act projects published HORIZON meshes with a bounded depth buffer, the race camera, real wheel transforms, authored materials and visibility tiles. It samples the physical take at 30 Hz; cinematic raster throughput on a software host can be lower than real-time. The existing WebGL racing lab uses its original rendering path.
