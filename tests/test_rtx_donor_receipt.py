"""Synthetic fail-closed gates for the future owner-run donor RTX receipt."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "scripts/finalize-rtx5060ti-donor.py"
spec = importlib.util.spec_from_file_location("donor_receipt", p)
v = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)


def fixture():
    def sample(name):
        return {"name": name, "sha256": "a" * 64,
                "samplesMs": [1.0] * 7, "medianMs": 1.0}
    a = sample("frame-pacing")
    a.update(tickCounts=[[hz,7200] for hz in (30,59,60,61,75,120,144)],
             roundedTicks=3600)
    b = sample("moving-target-intercept")
    b.update(solutions=3200, abstentions=800, maxRelativeResidual=1e-10)
    expected={"modules/time/index.js":"b"*64,"modules/lead-solver/index.js":"c"*64}
    return {"schemaVersion":1,"kind":"qsol.vanillajs.donor-upgrade.cpu.v1",
            "baseline":v.BASELINE,"sourceSHA256":expected,
            "protocol":{"execution":"serial single Node process",
                        "warmups":2,"samples":7,"gpu":"not measured",
                        "timingGate":False},
            "workloads":[a,b]},expected


class DonorReceiptTests(unittest.TestCase):
    def test_valid_cpu_record_admitted(self):
        data,expected=fixture()
        self.assertTrue(v.validate_cpu(data,expected))

    def test_scenario_shrinkage_and_forged_source_refused(self):
        for edit in (
            lambda x: x["workloads"][0].__setitem__("roundedTicks",3540),
            lambda x: x["workloads"][0].__setitem__("tickCounts",[]),
            lambda x: x["workloads"][1].__setitem__("solutions",0),
            lambda x: x["workloads"][1].__setitem__("maxRelativeResidual",0.1),
            lambda x: x["workloads"][1]["samplesMs"].pop(),
            lambda x: x["sourceSHA256"].__setitem__("modules/time/index.js","0"*64),
            lambda x: x["protocol"].__setitem__("gpu","RTX"),
        ):
            with self.subTest(edit=str(edit)):
                data,expected=fixture()
                edit(data)
                with self.assertRaises(ValueError):
                    v.validate_cpu(data,expected)

    def test_native_report_source_and_renderer_fail_closed(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)
            report={"schemaVersion":1,
                "kind":"qsol.vanillajs.rtx5060ti.trusted-comparison.v1",
                "baseline":{"sha":v.BASELINE},"candidate":{"sha":"a"*40},
                "environment":{"gpu":{"verifiedModel":"NVIDIA GeForce RTX 5060 Ti"},
                    "nativeWebGL":{"renderer":"ANGLE NVIDIA GeForce RTX 5060 Ti"}},
                "comparison":{"summary":{
                    "baseline":{"geometry":{"count":7}},
                    "candidate":{"geometry":{"count":7}}}}}
            def save():
                (root/"report.json").write_text(json.dumps(report))
                (root/"SUMMARY.md").write_text("synthetic\n")
                (root/"SHA256SUMS").write_text("".join(
                    v.digest((root/name).read_bytes())+"  "+name+"\n"
                    for name in ("report.json","SUMMARY.md")))
            save()
            self.assertEqual(v.verify_trusted(root,"a"*40)["baseline"]["sha"],v.BASELINE)
            report["environment"]["nativeWebGL"]["renderer"]="SwiftShader"
            save()
            with self.assertRaisesRegex(ValueError,"native RTX"):
                v.verify_trusted(root,"a"*40)
            report["environment"]["nativeWebGL"]["renderer"]="ANGLE NVIDIA GeForce RTX 5060 Ti"
            report["candidate"]["sha"]="f"*40
            save()
            with self.assertRaisesRegex(ValueError,"wrong baseline"):
                v.verify_trusted(root,"a"*40)


if __name__=="__main__":
    unittest.main()
