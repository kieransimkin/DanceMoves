# DanceMoves — optional StemLab variable-tempo beat-map consumer

Reviewed against `kieransimkin/DanceMoves` **main** commit
`3feb6ea8fce6aedd2910ed09bf4d1fdf92106950` (DanceMoves 3.3.0).
This is a source patch, **not** a published npm/WordPress release. It preserves
`stemlab.beat-alignment.v1` and fixed-BPM pages unchanged by default.

## Install (Windows PowerShell)

Extract the archive **into the DanceMoves repository root** (not a separate
subfolder). It contains an inspectable `new/` payload and a preflighted source
installer. Use a clean branch based on the reviewed main commit.

```powershell
python .\apply-dancemoves-tempo-map.py --check
python .\apply-dancemoves-tempo-map.py
npm ci
npm test
npm run build
php .\tests\shared\beat-alignment.php
php .\tests\shared\beat-timeline.php
node --test .\tests\shared\variable-tempo.test.mjs
node --test .\tests\shared\beat-timeline.test.mjs
git diff --check
git status --short
```

**Before staging**: delete the *installer distribution*, not the installed real
files, so duplicate tests and docs do not get committed. E.g.:

```powershell
Remove-Item -Recurse -Force .\new
Remove-Item .\apply-dancemoves-tempo-map.py, .\README_APPLY.md
# Also delete the downloaded ZIP from the repository root, if extracted there.
```

Review the diff and commit **only** the actual changed files under `assets/`,
`src/`, `types/`, `tests/`, `docs/`, the new root
`dance-moves-beat-timeline.php`, `kieran-epk-device-orientation.php`,
`tools/build-shared.mjs`, `README.md`, and `AGENTS.md`. Do not stage the
`new/` directory or installer. Keep release version/tags unchanged until the
project's normal release workflow validates and publishes the update.

## What changes

- EPK Timing adds a separate **StemLab full beat timeline JSON** editor and a
  **Use corrected variable-tempo beat map** opt-in checkbox. The previously
  selected **Analysed Master Audio** attachment binds both old and new clocks.
- The new `stemlab.beat-timeline.v1` importer verifies full input, validates
  frame monotonicity, derived BPM/phase consistency and source master SHA-256,
  stores only authoritative compact anchors and rejects invalid REST/admin input.
- Shared runtime `sourceTick`, `currentTick({clock:'audio'})`, beat/bar callbacks,
  sprite cycles, playback pulses, rudiment controllers and tempo-based CSS
  duration variables use the integrated per-interval phase/BPM for that master.
- Registered clips use their mapped master time before applying the correction.
  The original audio, cue, lyric and captured recording source clocks are never
  modified. Page-only effects and pages without opt-in retain nominal BPM.
- NPM/React clients can pass `beatTimeline` with a verified `source_url` to
  `createDanceMoves`; `beatTimelineState`, `tempoAt`,
  `durationMillisecondsAt` and imported validators are exposed.

See the detailed `docs/variable-tempo.md` after installation.

## Validation already performed

- New pure JavaScript timing/validation tests: **5 passed**.
- Isolated core-clock assertions (signed phase, variable BPM, source mismatch,
  old fixed clock): **17 passed**.
- WordPress PHP importer/REST parser tests: **15 passed**; PHP syntax passed.
- Installer dry-run and apply on reconstructed original source contexts with
  both LF and CRLF files: **passed**.

**Not performed in this environment:** a full checkout build, all existing npm
and WordPress tests, actual audio/browser playback, CI or a public WordPress
deployment. GitHub repository contents have not been changed; apply/commit this
patch locally, then inspect the corresponding GitHub Actions checks.

Notes: the older EPK `beat-alignment.v1` field remains separate and is not
implicitly converted into a variable map. CSS period variables track local BPM;
frame-accurate phase-critical consumers must read `sourceTick()` or use
DanceMoves' shared pulse/sprite/rudiment controllers, not autonomous CSS timers.
