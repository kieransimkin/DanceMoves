# DanceMoves

DanceMoves is Kieran Simkin's WordPress EPK motion runtime. Version 2.0.0 added page-level BPM, lyric-timing and cue-timing properties; a 16-ticks-per-beat musical clock; cue-driven animation resets; named cue and interval handlers; the existing seven device-orientation adapters; and the release-specific Made from the Clay and the Stars effects adapter. Version 2.1.0 moved the neutral shared EPK control and lyric-disclosure transitions onto page-resolved integer tick durations. Version 2.2.0 added catalogue-wide adoption for release-owned CSS animations, transitions, delays and timing custom properties. Version 2.3.0 confines stylesheet conversion to EPK-owned selectors and the timing variables they reference, so a mixed theme or admin stylesheet cannot transfer ownership to unrelated rules; it also carries the separately staged Clay/Stars runtime and harness refinements already present in the workspace.

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

CSS receives versioned custom properties such as `--dance-moves-16t`. JavaScript uses `DanceMoves.durationMilliseconds(ticks)`. Orientation input keeps only the latest finite, screen-aligned sample and commits it once on the next display frame. Its two-second rolling normalisation and time-based smoothing are functional input processing, not visual effect durations.

The catalogue adopter discovers the rendered EPK root, quantizes release-owned stylesheet, inline, computed and generated pseudo-element timing, registers the full release root for cue resets, and repeats the pass after dynamically inserted motion markup. It preserves the one-millisecond view-timeline sentinel used by November Christmas and the 0.01 ms reduced-motion sentinel. Under `prefers-reduced-motion: reduce`, the owned EPK subtree and its pseudo-elements are clamped to one 0.01 ms iteration.

The adopter changes timing ownership, not the creative design: selectors, keyframes, artwork, inputs and release identity remain page-specific. Pointer, scroll and orientation reactions remain event-driven. Canvas/WebGL effects that compute oscillator phase directly from frame time must use the public `DanceMoves.currentTick({ clock: "audio", audio })` value in their page adapter; CSS scanning cannot safely rewrite shader or drawing code.

An element can delay its CSS animation until a musical boundary:

```html
<div data-dance-moves-start-interval="16">Starts on a beat</div>
<div data-dance-moves-start-interval="64" data-dance-moves-start-clock="audio">Starts on a 4/4 bar of the active song</div>
```

Without `data-dance-moves-start-clock="audio"`, declarative starts use the page clock. For transitions or JavaScript-driven updates, use `DanceMoves.deferStart(element, ticks, { clock: "audio", start, id: "release:entrance" })` or `DanceMoves.scheduleAtInterval(ticks, callback, { id: "release:update" })`. Each returns a cancellation function. Stable IDs are required by the pre-live harness so synchronous page work can be attributed to its owning effect.

## Cue behavior and page API

The runtime fetches the page's cue file, finds every `<audio>` whose duration matches the canonical programme, and follows each active player independently. Seeking re-indexes the cue cursor without replaying skipped cues.

When a cue occurs during playback, DanceMoves resets every currently running DanceMoves-owned CSS/Web Animation to its first frame and immediately continues it. It does not reset WordPress, browser, player-control or third-party animations.

Page adapters can subscribe without executing timing-file text:

```js
const unsubscribe = window.DanceMoves.onCue("CHORUS 1", detail => {
  // Perform a page-specific update.
}, { id: "release:chorus-state" });
```

`"*"` subscribes to all cues. The runtime also dispatches bubbling `dance-moves-cue` and backwards-compatible `kieran-epk-cue` custom events. Local harnesses can route a data-only cue through the same production path with `DanceMoves.fireCue({ name, type, time })`.

EPK code can attach one-shot or repeating handlers to the active master-length song clock:

```js
const removeNext = DanceMoves.onNextInterval(updateOnce, 16, { id: "release:next-beat" });
const removeLoop = DanceMoves.onEveryInterval(updateRepeatedly, 64, { id: "release:bar-loop" });

DanceMoves.onNextBeat(updateOnce);  // 16 ticks
DanceMoves.onEveryBeat(updateRepeatedly);
DanceMoves.onNextBar(updateOnce);   // 64 ticks, assuming 4/4
DanceMoves.onEveryBar(updateRepeatedly);
```

Every registration returns a remover. One-shot handlers remove themselves after firing. Repeating handlers pause with playback and stop at the end of the song or when their remover is called. “Bar” deliberately means four beats; a page using another meter should call the interval functions with its explicit tick count.

Performance diagnostics are disabled unless the boot configuration explicitly contains `diagnostics: true`. A development harness may then attach a bounded receiver with `DanceMoves.setDiagnosticsSink(callback)`. The core does not retain, log or transmit diagnostic records, and ordinary WordPress configuration does not enable the sink. Missing cue or interval IDs are reported as unattributed and block pre-live approval.

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

For every new or materially changed EPK effect, use the reusable live-harness workflow at `../../../../skill-source/epk-effect-test-harness/SKILL.md`. It scaffolds manifest-driven master/timing/effect controls, deterministic input/cue simulation, attributable performance timing, CSS-property/bottleneck audits and pre-live evidence without publishing or writing to WordPress.

In the source repository, run `tools/validate.ps1 -Mode Unit` for the normal read-only validation path. It checks syntax, automated contracts, strict UTF-8 and the Clay content transform without rebuilding migration or package artifacts. Run `tools/validate.ps1 -Mode Package` only when an explicit migration/package rebuild is intended, or `tools/validate.ps1 -Mode All` for both stages. Development tests and tools remain in the repository and are intentionally excluded from the WordPress ZIP.

The validator checks PHP and JavaScript syntax, unit/contract tests, strict UTF-8, the page-252 content transform and plugin identity. Package mode additionally rebuilds migration/package artifacts and verifies the distributable ZIP layout, version and hashes. `tools/test-validator-failure.ps1` proves that a deliberate syntax failure returns non-zero and is attributed to its fixture.

No WordPress upload, timing-media upload, page-meta save or legacy-plugin deactivation should occur until the exact ZIP and migration manifest have action-time approval. Public verification must cover signed-out desktop, tablet and mobile rendering, Unicode, reduced motion, audio/chapter controls, cue resets, named handlers and all original seven orientation adapters.

## Rollback

- Shared-runtime regression: reinstall the preserved 1.2.4 ZIP.
- Page-252-only regression: reactivate `Made from Clay and Stars EPK Effects` 1.0.0; DanceMoves then suppresses its page-252 adapter.
- Metadata problem: restore the Page meta revision or clear the attachment ID. Do not delete shared Media Library files without first auditing references.

## Potential problems

### GitHub form snapshot labels may not be associated HTML labels

- **Symptom:** a visible `Repository name *` field appears in the semantic snapshot, but `getByLabel(...).fill(...)` times out with no matches.
- **Cause:** the snapshot's readable label text is not necessarily exposed through an associated HTML `label` relationship.
- **Corrective action:** address the control by its verified role and accessible name, such as `getByRole("textbox", { name: "Repository name *", exact: true })`; re-snapshot after changing visibility and verify the repository's `Private` badge after creation.
- **Verification:** GitHub created `kieransimkin/DanceMoves`, and the signed-in repository page showed `Private`, the expected description and the pushed commit.
- **Limit:** re-inspect GitHub's current semantic form before reuse because its control names and structure can change.

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

### A saved browser-tab binding can outlive its tab

- **Symptom:** an authenticated read-only audit fails with `Unknown tab` even though the existing in-app browser connection remains healthy.
- **Cause when verified:** the saved tab had been closed or removed after cleanup while its JavaScript binding remained in the persistent browser-control session.
- **Corrective action:** keep the existing browser connection, discard only the stale tab binding, create or obtain one fresh tab from that connection, and navigate it to the exact previously verified URL. Use a new variable name or a `let` binding when the tab reference may need replacement.
- **Verification:** a fresh tab in the existing signed-in browser loaded each private WordPress Motion Capture editor and allowed all seven JSON records to be audited without reauthentication.
- **Limit:** this recovery applies when the connection is healthy and only the tab is stale; it is not a reason to reset a working browser session or switch browsers.

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

### Older Windows PowerShell lacks the modern static SHA-256 helpers

- **Symptom:** a verification command fails because `[Security.Cryptography.SHA256]::HashData` or `[Convert]::ToHexString` does not exist.
- **Cause when verified:** Windows PowerShell is using an older .NET surface without those newer static APIs.
- **Corrective action:** create `[Security.Cryptography.SHA256]::Create()`, call `ComputeHash($bytes)`, convert with `[BitConverter]::ToString(...).Replace('-','')`, and dispose the hash object in `finally`.
- **Verification:** all four public DanceMoves asset hashes matched their local package entries byte-for-byte.
- **Limit:** this is a portable hashing fallback; it does not establish that the fetched URL is the intended release unless the URL, version and expected manifest are also checked.

### Headless browser window sizing can mimic mobile overflow

- **Symptom:** a `--window-size=390,... --screenshot` capture appears clipped or reports a wider-than-requested mobile page even though the responsive CSS is correct.
- **Cause when verified:** the command-line screenshot path retained a browser minimum layout width instead of a true 390-pixel emulated viewport.
- **Corrective action:** use DevTools Protocol `Emulation.setDeviceMetricsOverride`, then record `innerWidth`, document/body scroll widths and the screenshot from that same session.
- **Verification:** signed-out 1440, 900 and 390-pixel captures reported the exact requested inner widths and zero positive horizontal overflow.
- **Limit:** viewport emulation verifies layout geometry, not physical sensor cadence, thermal throttling or real 60/120 Hz device performance.

### Line-based keyframe scanners misclassify minified CSS

- **Symptom:** one minified inline style produces thousands of false continuous-animation failures and very large evidence output after its first `@keyframes` declaration.
- **Cause when verified:** the scanner carried an `in_keyframes` flag for the rest of the physical line, even after the keyframe block's closing brace.
- **Corrective action:** locate each keyframe block with brace-balanced character ranges, classify declarations by absolute character offset, and cap evidence snippets around the matching declaration.
- **Verification:** the Clay/Stars shared harness changed from false failure to `PASS`; the only remaining risky transition is the bounded page-owned `box-shadow` review warning.
- **Limit:** brace balancing is a static CSS check; pre-live traces still decide whether bounded transitions and page-owned effects meet runtime budgets.

### A refreshed live capture can outgrow its version-labelled evidence folder

- **Symptom:** a later verification run overwrites an earlier version's screenshots after the live plugin has changed, and renaming the populated directory can be denied while an artefact is open.
- **Cause when verified:** the capture command reused the earlier output directory; the exact reason for the subsequent Windows directory-move denial was not established.
- **Corrective action:** write a fresh capture to a new directory named for the observed live version, add an explicit superseded marker to the old directory, and keep package/hash receipts as the authoritative historical record.
- **Verification:** `qa/published-2.3.0/viewport-evidence.json` records public 2.3.0 assets at 1440, 900 and 390 pixels; `qa/published-2.2.0/SUPERSEDED.md` blocks accidental reuse of the overwritten files.
- **Limit:** screenshots are point-in-time rendering evidence; they do not replace immutable package manifests or deployment receipts.
