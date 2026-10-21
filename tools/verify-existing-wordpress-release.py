#!/usr/bin/env python3
"""Verify an immutable DanceMoves WordPress release before SVN publication."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
import zipfile
from pathlib import Path, PurePosixPath


TAG_RE = re.compile(r"^v(?P<version>[0-9]+\.[0-9]+\.[0-9]+)$")
SHA_RE = re.compile(r"^(?P<sha>[0-9a-f]{64})  (?P<name>[A-Za-z0-9@_.-]+)$")
PLUGIN_ROOT = "kieran-epk-device-orientation"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fail(message: str) -> None:
    raise ValueError(message)


def verify(tag: str, release_dir: Path, extract_dir: Path | None = None) -> dict[str, object]:
    match = TAG_RE.fullmatch(tag)
    if not match:
        fail("tag must be a stable vMAJOR.MINOR.PATCH release")
    version = match.group("version")
    zip_name = f"DanceMoves-wordpress-{version}.zip"
    manifest_name = f"DanceMoves-wordpress-{version}-manifest.json"
    sums_name = f"DanceMoves-{version}-SHA256SUMS.txt"
    required = {zip_name, manifest_name, sums_name}
    present = {item.name for item in release_dir.iterdir() if item.is_file()}
    if present != required:
        fail(f"release directory must contain exactly {sorted(required)}; found {sorted(present)}")

    recorded: dict[str, str] = {}
    for line in (release_dir / sums_name).read_text(encoding="utf-8").splitlines():
        checksum = SHA_RE.fullmatch(line)
        if not checksum:
            fail(f"invalid checksum line: {line!r}")
        recorded[checksum.group("name")] = checksum.group("sha")
    for name in (zip_name, manifest_name):
        expected = recorded.get(name)
        if not expected:
            fail(f"checksum manifest does not record {name}")
        actual = sha256((release_dir / name).read_bytes())
        if actual != expected:
            fail(f"released asset changed: {name}")

    manifest = json.loads((release_dir / manifest_name).read_text(encoding="utf-8"))
    if manifest.get("schema") != "dance-moves-package/v1":
        fail("unsupported WordPress manifest schema")
    if manifest.get("plugin_name") != "DanceMoves" or manifest.get("version") != version:
        fail("manifest identity does not match the approved release")
    if manifest.get("wordpress_upgrade_slug") != PLUGIN_ROOT:
        fail("manifest WordPress upgrade slug changed")
    if manifest.get("zip") != zip_name:
        fail("manifest ZIP name does not match the release")

    archive_bytes = (release_dir / zip_name).read_bytes()
    if manifest.get("zip_bytes") != len(archive_bytes):
        fail("manifest ZIP byte count does not match")
    if str(manifest.get("zip_sha256", "")).lower() != sha256(archive_bytes):
        fail("manifest ZIP hash does not match")

    expected_files = {
        entry["path"]: (entry["bytes"], entry["sha256"].lower())
        for entry in manifest.get("files", [])
    }
    if len(expected_files) != manifest.get("entry_count"):
        fail("manifest entry count is inconsistent")
    with zipfile.ZipFile(release_dir / zip_name) as archive:
        files = [item for item in archive.infolist() if not item.is_dir()]
        actual_paths = {item.filename for item in files}
        if actual_paths != set(expected_files):
            fail("ZIP payload does not match the manifest allowlist")
        for item in files:
            path = PurePosixPath(item.filename)
            if path.is_absolute() or ".." in path.parts or path.parts[0] != PLUGIN_ROOT:
                fail(f"unsafe or unexpected ZIP path: {item.filename}")
            data = archive.read(item)
            expected_bytes, expected_sha = expected_files[item.filename]
            if len(data) != expected_bytes or sha256(data) != expected_sha:
                fail(f"ZIP payload changed: {item.filename}")
        entrypoint = f"{PLUGIN_ROOT}/kieran-epk-device-orientation.php"
        readme = f"{PLUGIN_ROOT}/readme.txt"
        if entrypoint not in actual_paths or readme not in actual_paths:
            fail("required WordPress entrypoint or readme is missing")
        if extract_dir is not None:
            if extract_dir.exists() and any(extract_dir.iterdir()):
                fail("extract directory must be empty")
            extract_dir.mkdir(parents=True, exist_ok=True)
            for item in files:
                destination = extract_dir.joinpath(*PurePosixPath(item.filename).parts)
                destination.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(item) as source, destination.open("wb") as target:
                    shutil.copyfileobj(source, target)

    return {"tag": tag, "version": version, "zip": zip_name, "files": len(expected_files)}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tag", required=True)
    parser.add_argument("--release-dir", required=True, type=Path)
    parser.add_argument("--extract-dir", type=Path)
    args = parser.parse_args()
    try:
        result = verify(args.tag, args.release_dir, args.extract_dir)
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError, zipfile.BadZipFile) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
