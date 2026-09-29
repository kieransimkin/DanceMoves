#!/usr/bin/env python3
"""Validate an EPK effect harness structure, contract, risks and pre-live evidence."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from pathlib import Path


REQUIRED_FILES = [
    "effect-harness.manifest.json",
    "effect-harness.schema.json",
    "effect-harness-results.schema.json",
    "live-lab.html",
    "candidate.html",
    "harness.css",
    "harness-runtime.js",
    "harness-probe.js",
    "harness-bridge.js",
    "effect-under-test-adapter.js",
]
PRELIVE_EVIDENCE = [
    "evidence/qa-results.json",
    "evidence/performance-summary.json",
    "evidence/css-property-audit.json",
    "evidence/epk-prelive-results.json",
    "evidence/screenshots/desktop-1440.png",
    "evidence/screenshots/tablet-900.png",
    "evidence/screenshots/mobile-390.png",
]
GROUPS = {"master", "timing", "effect"}
PARAMETER_TYPES = {"range", "number", "checkbox", "select", "readonly"}
APPLICATIONS = {"css-variable", "adapter", "readonly"}
INPUT_MODES = {"pointer", "touch", "keyboard", "orientation", "scroll", "cue"}
SHA256 = re.compile(r"^[A-Fa-f0-9]{64}$")
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
CSS_VARIABLE = re.compile(r"^--[A-Za-z_][A-Za-z0-9_-]*$")


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest().upper()


def is_number(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(float(value))


class Report:
    def __init__(self, root: Path, mode: str) -> None:
        self.root = root
        self.mode = mode
        self.findings: list[dict[str, object]] = []
        self.property_findings: list[dict[str, object]] = []
        self.variable_consumers: dict[str, list[dict[str, str]]] = {}

    def add(self, status: str, code: str, message: str, path: str | None = None) -> None:
        item: dict[str, object] = {"status": status, "code": code, "message": message}
        if path:
            item["path"] = path
        self.findings.append(item)

    def fail_or_warn(self, code: str, message: str, path: str | None = None) -> None:
        self.add("FAIL" if self.mode == "prelive" else "WARN", code, message, path)

    @property
    def failed(self) -> bool:
        return any(item["status"] == "FAIL" for item in self.findings)

    def result(self) -> dict[str, object]:
        return {
            "schema": "epk-effect-harness-validation/v1",
            "mode": self.mode,
            "root": str(self.root),
            "status": "FAIL" if self.failed else "PASS",
            "findings": self.findings,
            "propertyFindings": self.property_findings,
            "variableConsumers": self.variable_consumers,
        }


def strict_text_files(root: Path, report: Report) -> None:
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in {".html", ".css", ".js", ".mjs", ".cjs", ".json", ".md", ".txt"}:
            continue
        relative = path.relative_to(root).as_posix()
        try:
            text = path.read_text(encoding="utf-8", errors="strict")
        except UnicodeDecodeError as error:
            report.add("FAIL", "UTF8", f"Strict UTF-8 decoding failed: {error}", relative)
            continue
        if "\x00" in text:
            report.add("FAIL", "NULL", "Null character found", relative)
        if "\ufffd" in text:
            report.add("FAIL", "REPLACEMENT", "U+FFFD replacement character found", relative)


def validate_parameters(manifest: dict, report: Report) -> None:
    parameters = manifest.get("parameters")
    if not isinstance(parameters, list):
        report.add("FAIL", "PARAMETERS", "parameters must be an array")
        return
    identifiers: set[str] = set()
    groups: set[str] = set()
    for index, parameter in enumerate(parameters):
        where = f"parameters[{index}]"
        if not isinstance(parameter, dict):
            report.add("FAIL", "PARAMETER", "Parameter must be an object", where)
            continue
        identifier = parameter.get("id")
        if not isinstance(identifier, str) or not re.fullmatch(r"[a-z][a-z0-9-]*", identifier):
            report.add("FAIL", "PARAMETER_ID", "Invalid parameter id", where)
        elif identifier in identifiers:
            report.add("FAIL", "PARAMETER_ID", f"Duplicate parameter id: {identifier}", where)
        else:
            identifiers.add(identifier)
        group = parameter.get("group")
        if group not in GROUPS:
            report.add("FAIL", "PARAMETER_GROUP", f"Invalid parameter group: {group}", where)
        else:
            groups.add(group)
        kind = parameter.get("type")
        if kind not in PARAMETER_TYPES:
            report.add("FAIL", "PARAMETER_TYPE", f"Invalid parameter type: {kind}", where)
        application = parameter.get("apply")
        if application not in APPLICATIONS:
            report.add("FAIL", "PARAMETER_APPLY", f"Invalid application route: {application}", where)
        if application == "css-variable" and not CSS_VARIABLE.fullmatch(str(parameter.get("target", ""))):
            report.add("FAIL", "PARAMETER_TARGET", "CSS-variable target must start with -- and be a valid identifier", where)
        if kind in {"range", "number", "readonly"}:
            default = parameter.get("default")
            if not is_number(default):
                report.add("FAIL", "PARAMETER_DEFAULT", "Numeric parameter default must be finite", where)
                continue
            lower, upper, step = parameter.get("min"), parameter.get("max"), parameter.get("step")
            if kind != "readonly" and (not is_number(lower) or not is_number(upper) or not is_number(step) or step <= 0):
                report.add("FAIL", "PARAMETER_RANGE", "Numeric control requires finite min/max and positive step", where)
            elif is_number(lower) and is_number(upper) and not lower <= default <= upper:
                report.add("FAIL", "PARAMETER_RANGE", "Default is outside min/max", where)
        if kind == "select" and (not isinstance(parameter.get("options"), list) or parameter.get("default") not in parameter.get("options", [])):
            report.add("FAIL", "PARAMETER_OPTIONS", "Select default must appear in options", where)
    missing = GROUPS - groups
    if missing:
        report.add("FAIL", "PARAMETER_GROUP", f"Missing live parameter groups: {', '.join(sorted(missing))}")


def resolve_asset(root: Path, name: str) -> Path:
    path = Path(name)
    return path.resolve() if path.is_absolute() else (root / path).resolve()


def validate_manifest(root: Path, manifest: dict, report: Report) -> None:
    if manifest.get("schemaVersion") != 1:
        report.add("FAIL", "SCHEMA", "schemaVersion must be 1")
    effect = manifest.get("effect")
    if not isinstance(effect, dict):
        report.add("FAIL", "EFFECT", "effect must be an object")
        return
    if not SLUG.fullmatch(str(effect.get("slug", ""))):
        report.add("FAIL", "SLUG", "effect.slug is invalid")
    if not isinstance(effect.get("pageId"), int) or effect.get("pageId", 0) < 1:
        report.add("FAIL", "PAGE_ID", "effect.pageId must be a positive integer")
    if not str(effect.get("rootSelector", "")).strip():
        report.add("FAIL", "ROOT_SELECTOR", "effect.rootSelector is required")
    modes = effect.get("inputModes")
    if not isinstance(modes, list) or not modes or any(mode not in INPUT_MODES for mode in modes) or len(modes) != len(set(modes)):
        report.add("FAIL", "INPUT_MODES", "effect.inputModes must be a unique non-empty allowed list")
        modes = []
    css_assets = effect.get("productionCss") if isinstance(effect.get("productionCss"), list) else []
    js_assets = effect.get("productionJs") if isinstance(effect.get("productionJs"), list) else []
    assets = [*css_assets, *js_assets]
    if not assets:
        report.fail_or_warn("PRODUCTION_ASSETS", "No production CSS or JavaScript is declared")
    hashes = effect.get("productionHashes") if isinstance(effect.get("productionHashes"), dict) else {}
    for asset in assets:
        path = resolve_asset(root, asset)
        if not path.is_file():
            report.fail_or_warn("ASSET_MISSING", f"Production asset is missing: {asset}", asset)
            continue
        expected = hashes.get(asset)
        actual = digest(path)
        if expected == "PENDING" or not isinstance(expected, str):
            report.fail_or_warn("ASSET_HASH", f"Production asset hash is pending: {asset}", asset)
        elif expected.upper() != actual:
            report.add("FAIL", "ASSET_HASH", f"Production asset hash mismatch: expected {expected}, got {actual}", asset)
    release = manifest.get("release") if isinstance(manifest.get("release"), dict) else {}
    bpm = release.get("bpm")
    if bpm is not None and (not is_number(bpm) or not 20 <= bpm <= 400):
        report.add("FAIL", "BPM", "release.bpm must be null or 20..400")
    if report.mode == "prelive":
        if not is_number(bpm) or release.get("bpmSource") != "verified":
            report.add("FAIL", "BPM_EVIDENCE", "Pre-live requires verified canonical BPM evidence")
        if not SHA256.fullmatch(str(release.get("masterSha256", ""))):
            report.add("FAIL", "MASTER_HASH", "Pre-live requires the canonical master SHA-256")
        if not is_number(release.get("masterDurationMilliseconds")) or release.get("masterDurationMilliseconds") <= 0:
            report.add("FAIL", "MASTER_DURATION", "Pre-live requires canonical master duration")
    viewports = manifest.get("preview", {}).get("viewports", []) if isinstance(manifest.get("preview"), dict) else []
    widths = {item.get("width") for item in viewports if isinstance(item, dict)}
    for width in (1440, 900, 390):
        if width not in widths:
            report.add("FAIL", "VIEWPORT", f"Required viewport {width}px is missing")
    cues = manifest.get("cues")
    if not isinstance(cues, list):
        report.add("FAIL", "CUES", "cues must be an array")
    elif "cue" in modes and not cues:
        report.fail_or_warn("CUES", "Cue input is declared but no cues are listed")
    validate_parameters(manifest, report)


def keyframe_ranges(text: str) -> list[tuple[int, int]]:
    ranges: list[tuple[int, int]] = []
    for match in re.finditer(r"@(?:-webkit-)?keyframes\b", text, re.I):
        opening = text.find("{", match.end())
        if opening == -1:
            continue
        depth = 0
        for index in range(opening, len(text)):
            if text[index] == "{":
                depth += 1
            elif text[index] == "}":
                depth -= 1
                if depth == 0:
                    ranges.append((opening, index + 1))
                    break
    return ranges


def compact_source(text: str, index: int, width: int = 240) -> str:
    start = max(0, index - (width // 3))
    end = min(len(text), start + width)
    snippet = re.sub(r"\s+", " ", text[start:end]).strip()
    return ("..." if start else "") + snippet + ("..." if end < len(text) else "")


def scan_css_text(text: str, relative: str, policy: dict, report: Report) -> None:
    fail = {item.lower() for item in policy.get("failContinuous", [])}
    review = {item.lower() for item in policy.get("review", [])}
    ranges = keyframe_ranges(text)
    line_offset = 0
    for line_number, line in enumerate(text.splitlines(), 1):
        lower = line.lower()
        for match in re.finditer(r"(?<![-\w])([a-z-]+)\s*:\s*([^;{}]+)", lower):
            prop, value = match.group(1), match.group(2)
            absolute_offset = line_offset + match.start()
            in_keyframes = any(start <= absolute_offset < end for start, end in ranges)
            trigger = "keyframes" if in_keyframes else "transition" if prop.startswith("transition") else "declaration"
            candidates = {prop} if trigger != "declaration" or prop in review else set()
            if prop.startswith("transition"):
                candidates.update(name for name in fail | review if re.search(rf"(?<![-\w]){re.escape(name)}(?![-\w])", value))
            for name in sorted(candidates & (fail | review)):
                classification = "block" if name in fail and trigger in {"keyframes", "transition"} else "review"
                finding = {"classification": classification, "property": name, "trigger": trigger, "path": relative, "line": line_number, "source": compact_source(text, absolute_offset)}
                report.property_findings.append(finding)
                if classification == "block":
                    if trigger == "keyframes":
                        report.add("FAIL", "CSS_CONTINUOUS_RISK", f"Continuously animated risky property {name} in keyframes", f"{relative}:{line_number}")
                    else:
                        report.fail_or_warn("CSS_TRANSITION_RISK", f"Transition of risky property {name} requires bounded trigger and trace evidence", f"{relative}:{line_number}")
        for consumer in re.finditer(r"([a-z-]+)\s*:[^;{}]*var\((--[A-Za-z0-9_-]+)", line):
            prop, variable = consumer.group(1).lower(), consumer.group(2)
            report.variable_consumers.setdefault(variable, []).append({"property": prop, "path": relative, "line": str(line_number)})
        line_offset += len(line) + 1


def scan_css(path: Path, root: Path, policy: dict, report: Report) -> None:
    relative = path.relative_to(root).as_posix() if path.is_relative_to(root) else str(path)
    scan_css_text(path.read_text(encoding="utf-8"), relative, policy, report)


def scan_javascript_text(text: str, relative: str, policy: dict, report: Report) -> None:
    risky = {item.lower() for item in [*policy.get("failContinuous", []), *policy.get("review", [])]}
    for line_number, line in enumerate(text.splitlines(), 1):
        properties = set(match.group(1).replace("_", "-").lower() for match in re.finditer(r"\.style\.([A-Za-z][A-Za-z0-9_]*)", line))
        properties.update(match.group(1).lower() for match in re.finditer(r"\.style\.setProperty\(\s*[\"']([^\"']+)", line))
        for prop in sorted(properties & risky):
            report.property_findings.append({"classification": "review", "property": prop, "trigger": "javascript-write", "path": relative, "line": line_number, "source": line.strip()})


def scan_javascript(path: Path, root: Path, policy: dict, report: Report) -> None:
    relative = path.relative_to(root).as_posix() if path.is_relative_to(root) else str(path)
    scan_javascript_text(path.read_text(encoding="utf-8"), relative, policy, report)


def validate_harness(root: Path, mode: str, manifest_file: Path | None = None, shared_root: Path | None = None, candidate_file: Path | None = None) -> Report:
    manifest_path = manifest_file or (root / "effect-harness.manifest.json")
    asset_root = manifest_path.parent
    common_root = shared_root or root
    shared_manifest = manifest_file is not None
    report = Report(asset_root, mode)
    if candidate_file is not None and mode != "scaffold":
        report.add("FAIL", "CANDIDATE_OVERRIDE", "A candidate override is allowed only for scaffold/unit checks, never pre-live approval")
        return report
    if not root.is_dir():
        report.add("FAIL", "ROOT", "Harness directory does not exist")
        return report
    for name in REQUIRED_FILES:
        if shared_manifest and name == "effect-harness.manifest.json":
            continue
        if shared_manifest and name == "candidate.html":
            continue
        required_root = asset_root if shared_manifest and name == "effect-under-test-adapter.js" else common_root
        if not (required_root / name).is_file():
            report.add("FAIL", "REQUIRED_FILE", f"Required file missing: {name}", name)
    strict_text_files(common_root, report)
    if asset_root != common_root:
        strict_text_files(asset_root, report)
    if not manifest_path.is_file():
        return report
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        report.add("FAIL", "MANIFEST_JSON", f"Manifest cannot be parsed: {error}")
        return report
    if not isinstance(manifest, dict):
        report.add("FAIL", "MANIFEST", "Manifest root must be an object")
        return report
    validate_manifest(asset_root, manifest, report)

    combined_paths = [common_root / name for name in ["live-lab.html", "harness-runtime.js", "harness-bridge.js"]]
    combined_paths.append(asset_root / "effect-under-test-adapter.js")
    combined = "\n".join(path.read_text(encoding="utf-8") for path in combined_paths if path.is_file())
    if re.search(r"wp-json/wp/v2|admin-ajax\.php|\bmethod\s*:\s*[\"'](?:POST|PUT|PATCH|DELETE)", combined, re.I):
        report.add("FAIL", "MUTATION", "Harness contains a possible WordPress or mutating network path")
    pending = []
    for name in ["candidate.html", "effect-under-test-adapter.js"]:
        path = asset_root / name
        if path.is_file() and "HARNESS-INTEGRATION-PENDING" in path.read_text(encoding="utf-8"):
            pending.append(name)
    if pending:
        report.fail_or_warn("INTEGRATION_PENDING", f"Production integration remains pending: {', '.join(pending)}")

    policy = manifest.get("cssPolicy") if isinstance(manifest.get("cssPolicy"), dict) else {"failContinuous": [], "review": []}
    scanned: set[Path] = set()
    css_assets = manifest.get("effect", {}).get("productionCss", [])
    for path in [resolve_asset(asset_root, item) for item in css_assets]:
        if path.is_file() and path not in scanned:
            scan_css(path, asset_root, policy, report)
            scanned.add(path)
    js_assets = manifest.get("effect", {}).get("productionJs", [])
    for path in [asset_root / "effect-under-test-adapter.js", *[resolve_asset(asset_root, item) for item in js_assets]]:
        if path.is_file():
            scan_javascript(path, asset_root, policy, report)
    candidate_name = str(candidate_file) if candidate_file is not None else manifest.get("effect", {}).get("candidate", "candidate.html")
    candidate = resolve_asset(asset_root, candidate_name)
    if not candidate.is_file():
        report.add("FAIL", "REQUIRED_FILE", f"Required candidate missing: {candidate_name}", str(candidate_name))
    if candidate.is_file():
        candidate_text = candidate.read_text(encoding="utf-8")
        if re.search(r'<meta\s+name=["\']dance-moves-fixture["\']\s+content=["\']unit-only["\']\s*/?>', candidate_text, re.I):
            report.add("FAIL" if mode == "prelive" else "WARN", "UNIT_FIXTURE",
                       "Unit-only input: this is not full-page, browser, playback or physical-device acceptance", str(candidate))
        for index, match in enumerate(re.finditer(r"<style\b[^>]*>(.*?)</style>", candidate_text, re.I | re.S), 1):
            scan_css_text(match.group(1), f"candidate.html#inline-style-{index}", policy, report)
        for index, match in enumerate(re.finditer(r"<script\b(?![^>]*\bsrc\s*=)[^>]*>(.*?)</script>", candidate_text, re.I | re.S), 1):
            scan_javascript_text(match.group(1), f"candidate.html#inline-script-{index}", policy, report)
    harness_css = common_root / "harness.css"
    if harness_css.is_file() and "prefers-reduced-motion" not in harness_css.read_text(encoding="utf-8"):
        report.add("FAIL", "REDUCED_MOTION", "Harness CSS lacks reduced-motion handling", "harness.css")

    if mode == "prelive":
        for name in PRELIVE_EVIDENCE:
            if not (asset_root / name).is_file():
                report.add("FAIL", "EVIDENCE", f"Pre-live evidence missing: {name}", name)
        modes = manifest.get("effect", {}).get("inputModes", [])
        if "orientation" in modes:
            for name in ["evidence/physical/iphone-safari.json", "evidence/physical/android-chrome.json"]:
                if not (asset_root / name).is_file():
                    report.add("FAIL", "PHYSICAL_DEVICE", f"Orientation effect evidence missing: {name}", name)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("harness", type=Path)
    parser.add_argument("--mode", choices=["scaffold", "prelive"], default="scaffold")
    parser.add_argument("--json-out", type=Path)
    parser.add_argument("--manifest-file", type=Path, help="Validate an effect manifest that reuses a shared harness core")
    parser.add_argument("--shared-root", type=Path, help="Shared live-lab/runtime directory used with --manifest-file")
    parser.add_argument("--candidate-file", type=Path, help="Explicit offline unit candidate; scaffold mode only. Does not alter the pre-live manifest.")
    args = parser.parse_args()
    if args.candidate_file and args.mode != "scaffold":
        parser.error("--candidate-file cannot be used in prelive mode")
    report = validate_harness(
        args.harness.resolve(),
        args.mode,
        args.manifest_file.resolve() if args.manifest_file else None,
        args.shared_root.resolve() if args.shared_root else None,
        args.candidate_file.resolve() if args.candidate_file else None,
    )
    result = report.result()
    output = json.dumps(result, indent=2, ensure_ascii=False)
    print(output)
    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(output + "\n", encoding="utf-8")
    return 1 if report.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
