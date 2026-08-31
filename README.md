# DanceMoves

DanceMoves is Kieran Simkin's WordPress EPK motion runtime. Version 2.0.0 adds page-level BPM, lyric-timing and cue-timing properties; a 16-ticks-per-beat musical clock; cue-driven animation resets; named cue and interval handlers; the existing seven device-orientation adapters; and the release-specific Made from the Clay and the Stars effects adapter.

The WordPress plugin name is **DanceMoves**. The distributable ZIP deliberately retains the internal `kieran-epk-device-orientation` folder and entrypoint name so WordPress upgrades the installed plugin rather than installing a parallel copy.

## Page properties

Edit Page contains an **EPK Timing** meta box with:

- **BPM**: explicit finite value from 20 to 400. Blank means unknown and the public runtime uses 120 BPM without claiming that 120 is known.
- **Lyric Timing File**: a WordPress Media Library `.lrc` attachment.
- **Cue Timing File**: a WordPress Media Library `.lrc` or `.cue` attachment.

The plugin stores attachment IDs and resolves their current WordPress URLs at render time. A hidden, revision-aware master-duration value in milliseconds supports safe matching of public audio that has the same programme length as the canonical master.

Timing files are limited to 1 MiB, must be strict UTF-8, must contain monotonic LRC/CUE timestamps, and cannot contain null or replacement characters. The browser parser treats file contents as data and never executes cue text.

## Musical clock

The implementation follows the agreed numeric rule:

- one timing tick is one sixteenth of a beat: `3.75 / BPM` seconds;
- 16 ticks are one beat and 64 ticks are one 4/4 bar;
- every DanceMoves-owned visual animation, transition, delay and release timeout is declared as an integer tick count;
- durations greater than 16 ticks are rounded to the nearest multiple of 16 ticks;
- exact half-way cases round upward; and
- `prefers-reduced-motion` remains authoritative.

CSS receives versioned custom properties such as `--dance-moves-16t`. JavaScript uses `DanceMoves.durationMilliseconds(ticks)`. Sensor sampling, rolling-window measurement and availability timeouts are functional input-processing intervals, not visual effect durations, and remain time-based.

An element can delay its CSS animation until a musical boundary:

```html
<div data-dance-moves-start-interval="16">Starts on a beat</div>
<div data-dance-moves-start-interval="64" data-dance-moves-start-clock="audio">Starts on a 4/4 bar of the active song</div>
```

Without `data-dance-moves-start-clock="audio"`, declarative starts use the page clock. For transitions or JavaScript-driven updates, use `DanceMoves.deferStart(element, ticks, { clock: "audio", start })` or `DanceMoves.scheduleAtInterval(ticks, callback, options)`. Each returns a cancellation function.

## Cue behavior and page API

The runtime fetches the page's cue file, finds every `<audio>` whose duration matches the canonical programme, and follows each active player independently. Seeking re-indexes the cue cursor without replaying skipped cues.

When a cue occurs during playback, DanceMoves resets every currently running DanceMoves-owned CSS/Web Animation to its first frame and immediately continues it. It does not reset WordPress, browser, player-control or third-party animations.

Page adapters can subscribe without executing timing-file text:

```js
const unsubscribe = window.DanceMoves.onCue("CHORUS 1", detail => {
  // Perform a page-specific update.
});
```

`"*"` subscribes to all cues. The runtime also dispatches bubbling `dance-moves-cue` and backwards-compatible `kieran-epk-cue` custom events.

EPK code can attach one-shot or repeating handlers to the active master-length song clock:

```js
const removeNext = DanceMoves.onNextInterval(updateOnce, 16);
const removeLoop = DanceMoves.onEveryInterval(updateRepeatedly, 64);

DanceMoves.onNextBeat(updateOnce);  // 16 ticks
DanceMoves.onEveryBeat(updateRepeatedly);
DanceMoves.onNextBar(updateOnce);   // 64 ticks, assuming 4/4
DanceMoves.onEveryBar(updateRepeatedly);
```

Every registration returns a remover. One-shot handlers remove themselves after firing. Repeating handlers pause with playback and stop at the end of the song or when their remover is called. “Bar” deliberately means four beats; a page using another meter should call the interval functions with its explicit tick count.

## Release adapters

- Page 130: Dying for a Diagnosis orientation adapter
- Page 140: Light Will Win orientation adapter
- Page 243: Presents & Chocolate orientation adapter
- Page 252: Made from the Clay and the Stars timing and visual-effects adapter
- Page 268: Fully Nocturnal orientation adapter
- Page 270: Amnesty, honestly? orientation adapter
- Page 276: Walk With Me orientation adapter
- Page 298: Dmitri My Talisman orientation adapter

Page 252's visual treatment remains release-specific. DanceMoves reuses its neutral timing and input infrastructure elsewhere but does not transplant its clay, cuneiform, cloud, warm-light or button choreography to other EPKs.

While the old `Made from Clay and Stars EPK Effects` plugin is active, DanceMoves suppresses its page-252 assets and content transform. Deactivating the old plugin makes DanceMoves take over on the next request, preventing a double-loaded effect stack.

## Validation and packaging

The complete test design and publication gates are in `TEST-PLAN.md`.

In the source repository, run `tools/validate.ps1` as the single-command coordinator. It rebuilds the migration manifest, checks syntax, runs all automated tests, validates strict UTF-8 and the Clay content transform, and rebuilds the package. Development tests and tools remain in the repository and are intentionally excluded from the WordPress ZIP.

The validator checks PHP and JavaScript syntax, unit/contract tests, strict UTF-8, forbidden fixed visual-duration declarations, the page-252 content transform, and the distributable ZIP layout/hashes.

No WordPress upload, timing-media upload, page-meta save or legacy-plugin deactivation should occur until the exact ZIP and migration manifest have action-time approval. Public verification must cover signed-out desktop, tablet and mobile rendering, Unicode, reduced motion, audio/chapter controls, cue resets, named handlers and all original seven orientation adapters.

## Rollback

- Shared-runtime regression: reinstall the preserved 1.2.4 ZIP.
- Page-252-only regression: reactivate `Made from Clay and Stars EPK Effects` 1.0.0; DanceMoves then suppresses its page-252 adapter.
- Metadata problem: restore the Page meta revision or clear the attachment ID. Do not delete shared Media Library files without first auditing references.

## Potential problems

### Generated timestamps break deterministic manifests

- **Symptom:** a clean validation run leaves only the migration JSON modified even though its evidence and rows did not change.
- **Cause:** the generator wrote the current wall-clock timestamp into an otherwise deterministic manifest.
- **Corrective action:** store the stable dated-manifest identity (`manifest_date`) instead of the generation instant; retain changing execution times in the external dated report.
- **Verification:** two consecutive manifest builds produce byte-identical JSON and TSV hashes.
- **Limit:** update the manifest date deliberately when creating a genuinely new evidence snapshot; do not reuse the date for changed source evidence.

### PowerShell's environment provider can fail on duplicate case-insensitive keys

- **Symptom:** `Get-ChildItem Env:` throws `An item with the same key has already been added` before a filtered credential-presence check runs.
- **Cause:** the process environment can expose duplicate names that collide under PowerShell's case-insensitive environment provider.
- **Corrective action:** query each exact name with `[Environment]::GetEnvironmentVariable(...)` and report only whether it is present; never print credential values.
- **Verification:** the corrected check safely reported that neither `GH_TOKEN` nor `GITHUB_TOKEN` was present.
- **Limit:** absence of those two variables does not prove that another credential store or signed-in browser session exists.

### Browser tab methods are split between the tab and its Playwright controller

- **Symptom:** browser QA throws `waitForTimeout is not a function`, `evaluate is not a function`, or loads an `Error response` page.
- **Cause:** navigation belongs to the tab wrapper, while DOM evaluation and waits belong to `tab.playwright`; the local server also serves the DanceMoves repository root rather than the wider songs workspace.
- **Corrective action:** use `tab.goto(...)`, then `tab.playwright.waitForTimeout(...)` and `tab.playwright.evaluate(...)`; address repository files from `/tests/...` or `/qa/...` on the local server.
- **Verification:** the corrected integration URL returned `PASS`, BPM 120, a 31.25 ms tick, and a released deferred-start element.
- **Limit:** this applies to the current in-app Browser binding and this repository-root server; re-check the API and server root after recreating either.

### PowerShell loop output must be grouped before piping

- **Symptom:** PowerShell reports `An empty pipe element is not allowed` after a `foreach (...) { ... } | Format-Table` construct.
- **Cause:** the statement-form `foreach` block is not accepted as the pipeline element in that command form.
- **Corrective action:** group the emitted loop results as `$(foreach (...) { ... }) | Format-Table`, or use `ForEach-Object` in the pipeline.
- **Verification:** the grouped command completed and returned the intended DanceMoves file line/byte inventory.
- **Limit:** this fixes command parsing only; it does not validate the inspected files.

### Windows paths should use ripgrep's glob option rather than a literal wildcard argument

- **Symptom:** `rg` reports Windows error 123 when passed a quoted path ending in `tests/*.cjs`.
- **Cause:** the quoted wildcard reaches ripgrep as part of a Windows path rather than being expanded into files.
- **Corrective action:** pass the directory as the search path and use `-g "*.cjs"` for the file filter.
- **Verification:** ripgrep accepted the corrected directory-plus-glob command without the path syntax error.
- **Limit:** a successful search with no matches can still be correct; inspect the searched pattern and file contents before inferring absence.

### The visualization renderer takes a positional destination

- **Symptom:** `render.py` exits with `unrecognized arguments: --output`.
- **Cause:** this renderer accepts the fragment path and optional destination as positional arguments; it has no `--output` option.
- **Corrective action:** run `render.py <fragment> <destination>` and reserve `--title`, `--serve` and `--port` for their documented purposes.
- **Verification:** the corrected command produced the standalone Clay/DanceMoves implementation preview.
- **Limit:** successful wrapping proves fragment assembly, not visual correctness or interaction behaviour in every browser.

### PowerShell wildcard copying can silently copy no plugin files

- **Symptom:** a destination directory is created but contains zero files after `Copy-Item -LiteralPath '<source>\*'`.
- **Cause:** `-LiteralPath` does not expand the `*` wildcard.
- **Corrective action:** use `Copy-Item -Path '<source>\*' -Destination '<destination>' -Recurse -Force`, then count and compare the copied files before editing.
- **Verification:** the DanceMoves seed copy contained all 20 source files before new assets were added.
- **Limit:** use `-LiteralPath` for exact paths; use `-Path` only where wildcard expansion is intentional and the source/destination have already been resolved.

### Complex regular expressions can be corrupted by PowerShell quoting

- **Symptom:** `rg` reports a regex parse error such as `repetition operator missing expression` even though the intended expression is valid.
- **Cause:** nested quotes and optional groups were altered while passing the expression through PowerShell.
- **Corrective action:** split the search into smaller single-quoted patterns and avoid embedding optional quote characters when they are not required.
- **Verification:** the simplified `selected.*bpm|[0-9][0-9][0-9]? BPM` search completed and returned the expected evidence candidates.
- **Limit:** this is a command-transport fix, not proof that every textual BPM mention is authoritative.

### Local PowerShell scripts can be blocked by the machine execution policy

- **Symptom:** invoking a checked-in `.ps1` directly reports that running scripts is disabled.
- **Cause:** the host PowerShell execution policy blocks direct script invocation.
- **Corrective action:** run the repository-owned script in a fresh process with `powershell -NoProfile -ExecutionPolicy Bypass -File <exact-script-path>`; do not change the machine-wide execution policy.
- **Verification:** the migration builder produced the 47-row JSON/TSV manifest and the full validator completed with exit code 0.
- **Limit:** use this only for reviewed scripts in this repository; it is not permission to run downloaded or untrusted scripts.

### Windows `Compress-Archive` can create non-portable WordPress ZIP entries

- **Symptom:** the package contains backslash entry names, so the expected `kieran-epk-device-orientation/kieran-epk-device-orientation.php` entry is absent and the portability check fails.
- **Cause:** Windows `Compress-Archive` preserved `\` separators in ZIP entry names. The first manual `ZipArchive` retry also lacked the `System.IO.Compression` assembly required for `ZipArchiveMode`.
- **Corrective action:** load both `System.IO.Compression` and `System.IO.Compression.FileSystem`, create each entry explicitly with `/` separators, and retain the verified internal upgrade slug.
- **Verification:** require forward-slash entries and the expected root entrypoint, then record the final ZIP SHA-256 outside the package so rebuilding the package cannot make its own embedded hash stale.
- **Limit:** rebuilding the ZIP changes its hash even when source bytes are unchanged; obtain action-time confirmation for the final rebuilt hash.

### Later page CSS can override a plugin timing declaration

- **Symptom:** the merged preview computed the signal animation at the old `14s` even though DanceMoves declared the 112-tick `14.4828s` duration at 116 BPM.
- **Cause:** page-body CSS with equal specificity appeared after the plugin stylesheet and won the cascade.
- **Corrective action:** keep the page-scoped DanceMoves `animation-duration` override marked `!important`; change no other visual property.
- **Verification:** the merged preview computed signal `13.9655s`, particle `4.13793s`, cloud A `51.2069s`, and cloud B `71.3793s`, with zero overflow.
- **Limit:** use importance only for the narrow duration override required to defeat later canonical page CSS; do not broaden it to unrelated styles.

### Cross-realm arrays can fail Node strict deep equality

- **Symptom:** a VM-produced `[0, 1]` array looks identical but `assert.deepStrictEqual` reports that it is not reference-equal.
- **Cause:** the array inherits from the VM realm rather than the test runner realm.
- **Corrective action:** convert VM collections with `Array.from` before strict structural comparison.
- **Verification:** the DanceMoves timing/cue unit test passed with the same expected timestamps.
- **Limit:** this corrects the test boundary only; do not normalize production objects merely to satisfy a cross-realm assertion.

### One patch cannot delete and add the same file simultaneously

- **Symptom:** the safe patcher rejects a patch because multiple operations target the same README path.
- **Cause:** delete and add operations for one path were combined in a single patch.
- **Corrective action:** delete the old file in one patch and add the replacement in a second patch.
- **Verification:** the new DanceMoves README exists, decodes as strict UTF-8, and is included in the validated package.
- **Limit:** prefer an ordinary update patch when practical; use the two-step replacement only for a complete rewrite.

### WordPress formatting can create invisible layout children

- **Symptom:** page-252 chapters wrap or artwork/cosmology grids gain unexpected items after WordPress rendering.
- **Cause:** `wpautop` inserts direct-child `<br>` or empty `<p>` nodes which grid and flex layouts count as children.
- **Corrective action:** keep the proven, page-scoped direct-child selectors in `clay-stars-effects.css`; never suppress all page breaks or empty paragraphs globally.
- **Verification:** require five chapter buttons in one desktop/tablet row, deliberate mobile stacking, one intended artwork row and zero horizontal overflow.
- **Limit:** apply only to the exact empty/direct-child artefacts verified in the rendered page.

### Hosting exhaustion can look like malformed plugin or REST data

- **Symptom:** plugin/media upload fails to write, or a WordPress JSON operation returns an nginx HTML 500 response.
- **Cause when previously verified:** insufficient server disk/temp capacity.
- **Corrective action:** stop after one failed mutation, verify no partial install/save, retain the exact package hash, and block retries until host-level free space/temp-file health is verified.
- **Verification:** perform one small reversible probe after remediation, remove it, then make the approved change once and verify signed out.
- **Limit:** WordPress directory-writable status alone does not prove sufficient disk, quota, inode or temp-mount capacity.
