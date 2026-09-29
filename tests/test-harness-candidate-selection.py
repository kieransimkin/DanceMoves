#!/usr/bin/env python3
"""Regression tests: unit fixture selection must never produce pre-live approval."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "tools" / "validate-effect-harness.py"
spec = importlib.util.spec_from_file_location("harness_validator", SCRIPT)
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)
MARKER = '<meta name="dance-moves-fixture" content="unit-only">'


class SelectionTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        for name in validator.REQUIRED_FILES:
            (self.root / name).write_text("", encoding="utf-8")
        (self.root / "harness.css").write_text("/* prefers-reduced-motion */", encoding="utf-8")
        self.real = self.root / "real-page.html"
        self.real.write_text("<html>real-page-placeholder</html>", encoding="utf-8")
        self.unit = self.root / "unit.html"
        self.unit.write_text(MARKER + "<html>synthetic-unit-placeholder</html>", encoding="utf-8")
        self.manifest = {
            "schemaVersion": 1,
            "effect": {"slug": "test", "pageId": 1, "rootSelector": ".test", "candidate": "real-page.html", "inputModes": ["pointer"]},
            "release": {"bpm": 120},
            "preview": {"viewports": [{"width": width} for width in (1440, 900, 390)]},
            "parameters": [{"id": f"{group}-enabled", "group": group, "type": "checkbox", "apply": "adapter", "default": True} for group in ("master", "timing", "effect")],
            "cues": [], "cssPolicy": {"failContinuous": ["width"], "review": []},
        }
        self.save()

    def save(self):
        (self.root / "effect-harness.manifest.json").write_text(json.dumps(self.manifest), encoding="utf-8")

    def codes(self, report, status=None):
        return {item["code"] for item in report.findings if status is None or item["status"] == status}

    def test_default_candidate_path_is_unchanged(self):
        before = (self.root / "effect-harness.manifest.json").read_bytes()
        report = validator.validate_harness(self.root, "scaffold")
        self.assertFalse(report.failed)
        self.assertNotIn("UNIT_FIXTURE", self.codes(report))
        self.assertEqual(before, (self.root / "effect-harness.manifest.json").read_bytes())

    def test_scaffold_override_reports_unit_only(self):
        report = validator.validate_harness(self.root, "scaffold", candidate_file=self.unit)
        self.assertFalse(report.failed)
        self.assertIn("UNIT_FIXTURE", self.codes(report, "WARN"))

    def test_missing_override_fails(self):
        report = validator.validate_harness(self.root, "scaffold", candidate_file=self.root / "missing.html")
        self.assertTrue(report.failed)
        self.assertIn("REQUIRED_FILE", self.codes(report, "FAIL"))

    def test_prelive_override_is_rejected_by_function(self):
        report = validator.validate_harness(self.root, "prelive", candidate_file=self.unit)
        self.assertIn("CANDIDATE_OVERRIDE", self.codes(report, "FAIL"))

    def test_prelive_override_is_rejected_by_cli(self):
        result = subprocess.run([sys.executable, str(SCRIPT), str(self.root), "--mode", "prelive", "--candidate-file", str(self.unit)], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("cannot be used in prelive mode", result.stderr)

    def test_unit_candidate_cannot_be_smuggled_through_manifest(self):
        self.manifest["effect"]["candidate"] = "unit.html"
        self.save()
        report = validator.validate_harness(self.root, "prelive")
        self.assertIn("UNIT_FIXTURE", self.codes(report, "FAIL"))
        self.assertIn("EVIDENCE", self.codes(report, "FAIL"))

    def test_css_risks_in_overridden_candidate_are_still_checked(self):
        self.unit.write_text(MARKER + '<style>@keyframes bad {from {width:1px;} to {width:10px;}}</style>', encoding="utf-8")
        report = validator.validate_harness(self.root, "scaffold", candidate_file=self.unit)
        self.assertIn("CSS_CONTINUOUS_RISK", self.codes(report, "FAIL"))

    def test_source_hash_failures_remain_failures(self):
        (self.root / "asset.js").write_text("/* actual bytes */", encoding="utf-8")
        self.manifest["effect"].update({"productionJs": ["asset.js"], "productionHashes": {"asset.js": "0" * 64}})
        self.save()
        report = validator.validate_harness(self.root, "scaffold", candidate_file=self.unit)
        self.assertIn("ASSET_HASH", self.codes(report, "FAIL"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
