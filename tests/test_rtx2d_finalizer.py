"""Synthetic no-GPU falsification for the future owner RTX2D receipt."""
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("rtx2d",ROOT/"scripts/finalize-rtx5060ti-2d.py")
v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
SHA="a"*40


def fixture():
    strict={"kind":"qsol.vanillajs.lab2d.evidence.v1",
            "audio":{"chunkIdentical":True},
            "scenes":[{"kind":k} for k in ("rts","shmup","platform","car")]}
    identity=hashlib.sha256(json.dumps(strict,sort_keys=True,separators=(",",":"),
                                     ensure_ascii=True).encode()).hexdigest()
    source={"strict":strict,"strictSHA256":identity,"observations":{}}
    pixel="a"*64
    raw={"ms":1.0,"pixels":pixel}
    samples={"forced":[{**raw,"drawn":240} for _ in range(7)],
             "retained":[{**raw,"drawn":1,
                          "stats":{"drawn":1,"skipped":239}} for _ in range(7)]}
    report={
        "schemaVersion":1,"kind":"qsol.vanillajs.rtx5060ti.2d-foundry.native.v1",
        "status":"PASS","candidateSha":SHA,"sourceStrictSHA256":identity,
        "nativeWebGLIdentity":{"vendor":"NVIDIA Corporation",
            "renderer":"ANGLE (NVIDIA GeForce RTX 5060 Ti)"},
        "canvas2D":{"brightPixels":800,"pixelSHA256":pixel,"rendererMode":"Canvas2D",
                    "sampleCount":95,"frameIntervalsMs":[16.0]*95,
                    "p95FrameIntervalMs":16.0},
        "comparison":{"protocol":{"warmups":2,"pairs":7,"framesPerTrial":240,
            "reuse":"FrameGate identical presentation key","timingGate":False},
            "forced":{"samples":samples["forced"],"medianMs":1.0},
            "retained":{"samples":samples["retained"],"medianMs":1.0}}
    }
    return source,report


class ReportTests(unittest.TestCase):
    def test_synthetic_complete_receipt_is_admitted(self):
        src,report=fixture()
        self.assertEqual(v.verify(src,report,SHA)["pairedTrials"],7)

    def test_renderer_parity_samples_and_source_checks_fail_closed(self):
        for change in (
            lambda s,r:r["nativeWebGLIdentity"].__setitem__("renderer","SwiftShader"),
            lambda s,r:r["comparison"]["retained"]["samples"].pop(),
            lambda s,r:r["comparison"]["retained"]["samples"][0].__setitem__("drawn",240),
            lambda s,r:r["comparison"]["retained"]["samples"][0].__setitem__("pixels","f"*64),
            lambda s,r:r["canvas2D"].__setitem__("sampleCount",94),
            lambda s,r:r["comparison"]["protocol"].__setitem__("warmups",0),
            lambda s,r:s.__setitem__("strictSHA256","f"*64),
            lambda s,r:r.__setitem__("candidateSha","0"*40)
        ):
            src,report=fixture()
            change(src,report)
            with self.subTest(change=str(change)):
                with self.assertRaises(ValueError):
                    v.verify(src,report,SHA)

    def test_zero_delta_is_retained_as_a_real_browser_observation(self):
        # Two rAF callbacks may carry identical timestamps under reduced
        # timer resolution. Never rewrite that measurement into 16.67 ms.
        src, report = fixture()
        report["canvas2D"]["frameIntervalsMs"][0] = 0.0
        self.assertEqual(v.verify(src, report, SHA)["canvasIntervals"], 95)
        self.assertEqual(report["canvas2D"]["frameIntervalsMs"][0], 0.0)

    def test_all_zero_or_malformed_rAF_data_fail_closed_with_specific_reason(self):
        for samples, message in (
            ([0.0] * 95, "no positive elapsed"),
            ([16.0] * 94 + [-1.0], "negative/nonfinite"),
            ([16.0] * 94 + [None], "negative/nonfinite"),
            ([16.0] * 94 + [float("nan")], "negative/nonfinite"),
            ([16.0] * 94, "interval count"),
        ):
            with self.subTest(message=message):
                src, report = fixture()
                report["canvas2D"]["frameIntervalsMs"] = samples
                with self.assertRaisesRegex(ValueError, message):
                    v.verify(src, report, SHA)

    def test_image_and_quantile_evidence_still_fail_closed(self):
        for change, message in (
            (lambda x: x["canvas2D"].__setitem__("brightPixels", 0),
             "image missing or blank"),
            (lambda x: x["canvas2D"].__setitem__("pixelSHA256", "f" * 3),
             "pixel SHA-256"),
            (lambda x: x["canvas2D"].__setitem__("rendererMode", "WebGL"),
             "pixel SHA-256"),
            (lambda x: x["canvas2D"].__setitem__("sampleCount", 94),
             "interval count"),
            (lambda x: x["canvas2D"].__setitem__("p95FrameIntervalMs", 0.0),
             "frame p95"),
        ):
            with self.subTest(message=message):
                src, report = fixture()
                change(report)
                with self.assertRaisesRegex(ValueError, message):
                    v.verify(src, report, SHA)

    def test_nonfinite_samples_are_rejected(self):
        src,report=fixture()
        report["comparison"]["forced"]["samples"][0]["ms"]=float("nan")
        with self.assertRaises(ValueError):
            v.verify(src,report,SHA)


if __name__=="__main__":
    unittest.main()
