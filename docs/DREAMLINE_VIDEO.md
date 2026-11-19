# Render and verify The Dreamline

The browser and offline film both call `demos/dreamline/film.js` with the same score, PCM, palette, physical take and absolute samples. On a POSIX workstation use Python 3.11+, Node with the optional development-only `@napi-rs/canvas` 0.1.100, FFmpeg with libx264/AAC and FFprobe. The tested raster host uses Skia; it produces full-size frames locally without a display, network service or live playback timer. Point `NODE_PATH` at the directory containing the installed optional canvas module. None of these tools are browser requirements.

```sh
python3 scripts/dreamline/video.py /new/film-package
python3 scripts/dreamline/video.py /new/short-test-package --ci-fixture
python3 -m unittest discover -s scripts/dreamline -p 'test_*.py'
```

Choose new output directories in an existing directory. The default soundtrack is the credited score embedded in the browser. A custom validated 90-second event file is accepted with `--score /local/edit.json`. To generate the reference WAV from the authorised edit, run the score and PCM commands in the [creator guide](DREAMLINE.md), then verify the existing movie independently.

```sh
python3 scripts/dreamline/video.py /new/film-package --verify /private/new-edit.wav
```

Full mode emits 2,700 native 1920×1080 pictures. Frame n samples 1,600n at 48 kHz with PTS n/30 and no start offset. The 90-second endpoint is exclusive; the last frame has PTS 89.966666… seconds. Audio has exactly 4,320,000 intended stereo sample frames. MP4 edit lists remove AAC priming and a decoder may emit fewer than 1,024 trailing padding frames. The compact test encodes twelve successive pictures from each of five acts and the exact five PCM excerpts at 320×180.

The verifier inspects timestamps, decodes all video and both audio channels, compares scene thumbnails on every frame, requires independent seeks at fifteen samples and compares temporal changes to pre-encode reference pictures. A separate test predicts CRT marker positions. Codec tolerances and amplitude checks are inspectable in the verifier. The score, tool versions, timings, source revision and SHA-256 hashes travel in verification.json. Keep the reference sidecars with it. Partial or cancelled encodes have a private temporary directory and cannot replace an existing completed output. Same-build receipts identify one execution. FFmpeg builds and raster hosts can differ.
