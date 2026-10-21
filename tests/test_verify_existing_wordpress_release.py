import hashlib
import importlib.util
import json
import shutil
import unittest
import uuid
import zipfile
from contextlib import contextmanager
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "verify_existing_wordpress_release",
    ROOT / "tools" / "verify-existing-wordpress-release.py",
)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


@contextmanager
def project_temp_directory():
    path = ROOT / f".tmp-existing-release-test-{uuid.uuid4().hex}"
    path.mkdir()
    try:
        yield path
    finally:
        shutil.rmtree(path)


class ExistingWordPressReleaseVerification(unittest.TestCase):
    def make_release(self, root: Path) -> tuple[Path, Path]:
        release = root / "release"
        release.mkdir()
        version = "9.8.7"
        zip_name = f"DanceMoves-wordpress-{version}.zip"
        manifest_name = f"DanceMoves-wordpress-{version}-manifest.json"
        sums_name = f"DanceMoves-{version}-SHA256SUMS.txt"
        payload = {
            "kieran-epk-device-orientation/kieran-epk-device-orientation.php": b"<?php\n/* Plugin Name: DanceMoves */\n",
            "kieran-epk-device-orientation/readme.txt": b"=== DanceMoves ===\n",
        }
        with zipfile.ZipFile(release / zip_name, "w") as archive:
            for name, data in payload.items():
                archive.writestr(name, data)
        zip_bytes = (release / zip_name).read_bytes()
        manifest = {
            "schema": "dance-moves-package/v1",
            "plugin_name": "DanceMoves",
            "version": version,
            "wordpress_upgrade_slug": "kieran-epk-device-orientation",
            "zip": zip_name,
            "zip_bytes": len(zip_bytes),
            "zip_sha256": hashlib.sha256(zip_bytes).hexdigest(),
            "entry_count": len(payload),
            "files": [
                {"path": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
                for name, data in payload.items()
            ],
        }
        manifest_bytes = json.dumps(manifest).encode()
        (release / manifest_name).write_bytes(manifest_bytes)
        sums = "\n".join(
            [
                f"{hashlib.sha256(zip_bytes).hexdigest()}  {zip_name}",
                f"{hashlib.sha256(manifest_bytes).hexdigest()}  {manifest_name}",
            ]
        )
        (release / sums_name).write_text(sums + "\n", encoding="utf-8")
        return release, root / "extracted"

    def test_verifies_and_extracts_allowlisted_payload(self):
        with project_temp_directory() as tmp:
            release, extracted = self.make_release(tmp)
            result = MODULE.verify("v9.8.7", release, extracted)
            self.assertEqual(result["files"], 2)
            self.assertTrue((extracted / "kieran-epk-device-orientation/readme.txt").is_file())

    def test_rejects_a_changed_release_zip(self):
        with project_temp_directory() as tmp:
            release, extracted = self.make_release(tmp)
            zip_path = release / "DanceMoves-wordpress-9.8.7.zip"
            zip_path.write_bytes(zip_path.read_bytes() + b"changed")
            with self.assertRaisesRegex(ValueError, "released asset changed"):
                MODULE.verify("v9.8.7", release, extracted)


if __name__ == "__main__":
    unittest.main()
