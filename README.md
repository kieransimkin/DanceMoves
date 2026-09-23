# DanceMoves

Version 2.5.0 gives every explicit WordPress-hosted MP3 download link on an EPK a signed download-only URL. That endpoint returns `Content-Disposition: attachment` while retaining the correct `audio/mpeg` media type. Player and source URLs are not rewritten, so the same MP3 remains seekable and playable in the page. Direct media URLs also remain inline. The content transformation uses WordPress's HTML Tag Processor and changes only same-site upload links whose anchor already has a `download` attribute.

Version 2.4.2 preserves exact cue landings: seeking to within 50 milliseconds of a cue arms that one cue and dispatches it once when playback starts (or immediately when seeking during playback), while ordinary scrubbing still suppresses skipped cues. Version 2.4.1 extended each playback-synchronised lyric event with the immediate next LRC entry and its exact timestamp, allowing release adapters to choreograph a preview against the existing audio clock without reparsing the LRC or creating a second timer. Version 2.4.0 added opt-in lyric pop-ups. DanceMoves parses the selected canonical LRC as inert text, follows the same master-length audio and animation-frame clock as cue timing, clears on blank cues, re-indexes after seeks, hides on pause/end, and exposes `onLyric()` plus a bubbling `dance-moves-lyric` event. The shared component is intentionally visually neutral. Every adopting EPK must add a distinct treatment derived from that song's documented visual language; enabling the checkbox without that release-specific design review is not an approved EPK workflow.

Version 2.3.6 makes automatic performance fallback recoverable. Sampling waits for load plus a five-second settling period, requires sustained poor windows, and continues in the minimal tier. Healthy windows trial one higher tier; failed trials revert with increasing cooldown. Hidden tabs and reduced motion suspend sampling. These are capability checks, so their delays do not alter the musical clock. Current adaptive tiers apply to Clay/Stars; every future adapter must follow the same recovery rule.

Thresholds are relative to the fastest stable frame cadence observed in the session, including 30 Hz displays. The reference can rise but cannot fall during overload. Frame cadence alone cannot prove physical display refresh; diagnostics expose the observation. Kieran confirmed the desktop monitor operates at 30 FPS on 19 September 2026, explaining the former fixed-threshold false positive.

## Potential problems: fallback never recovers

In 2.3.5, a startup downgrade to minimal stopped the sampler permanently while CSS suppressed ambient loops. Version 2.3.6 retains spaced recovery checks, validates each higher tier under load, and backs off after failure. Regression tests cover loading, sustained overload, minimal-to-full recovery, failed trials, visibility, reduced motion and teardown. See MDN requestAnimationFrame and Chrome background-tabs guidance (checked 19 September 2026); background throttling must not count as device incapacity. Physical-device performance remains separate from synthetic contracts.

### Node's test runner cannot spawn isolated workers in a restricted Windows host

- **Symptom:** `node --test "tests/*.test.cjs"` marks every file failed before assertions run and reports `Error: spawn EPERM` from `node:internal/test_runner/runner`.
- **Cause when verified:** Node's test runner uses a separate child process for each test file by default; the managed host denied those child-process spawns. Node's official Test Runner documentation (checked 20 September 2026) confirms process isolation is the default and that isolation can be disabled.
- **Corrective action:** use `node --test --test-isolation=none "tests/*.test.cjs"` when the installed Node version supports it, then run `tools/validate.ps1 -Mode Unit`, whose sequential direct-file execution does not require the test runner to spawn workers.
- **Verification:** single-process execution reached real assertions, and the full unit validator subsequently ran every JavaScript/PHP contract, transform check, UTF-8 check and shared harness to completion.
- **Limit:** single-process test files can share state. The release gate therefore remains the repository's sequential unit validator plus the focused timed-lyric playback test, not the initial `spawn EPERM` result.

DanceMoves is Kieran Simkin's WordPress EPK motion runtime. Version 2.0.0 added page-level BPM, lyric-timing and cue-timing properties; a 16-ticks-per-beat musical clock; cue-driven animation resets; named cue and interval handlers; the existing seven device-orientation adapters; and the release-specific Made from the Clay and the Stars effects adapter. Version 2.1.0 moved the neutral shared EPK control and lyric-disclosure transitions onto page-resolved integer tick durations. Version 2.2.0 added catalogue-wide adoption for release-owned CSS animations, transitions, delays and timing custom properties. Version 2.3.0 confines stylesheet conversion to EPK-owned selectors and the timing variables they reference, so a mixed theme or admin stylesheet cannot transfer ownership to unrelated rules; it also carries the separately staged Clay/Stars runtime and harness refinements already present in the workspace. Version 2.3.1 raises the Clay/Stars bounded motion gain to 2x. Version 2.3.2 routes the shared permission-aware orientation runtime into that Clay/Stars adapter so physical device events actually drive its motion API while reduced motion, geometry and all other EPK systems remain unchanged. Version 2.3.3 adds measured, release-scoped adaptive performance tiers for Clay/Stars: healthy devices retain the full treatment, while only sustained low frame rate stops the expensive ambient loops and, if still necessary, removes their filters. Version 2.3.4 rate-limits orientation target writes to a two-tick cadence and lets compositor-friendly CSS transitions interpolate between them; it also adds a scoped California Screamin' adapter without changing that page's creative design.

Version 2.3.5 reconciles the Clay/Stars fallback clock and local harness with the confirmed canonical 90 BPM that the WordPress page supplies.

The WordPress plugin name is **DanceMoves**. The distributable ZIP deliberately retains the internal `kieran-epk-device-orientation` folder and entrypoint name so WordPress upgrades the installed plugin rather than installing a parallel copy.

## Page properties

Edit Page contains an **EPK Timing** meta box with:

- **BPM**: explicit finite value from 20 to 400. Blank means unknown and the public runtime uses 120 BPM without claiming that 120 is known.
- **Lyric Timing File**: a WordPress Media Library `.lrc` attachment.
- **Cue Timing File**: a WordPress Media Library `.lrc` or `.cue` attachment.
- **Timed lyric pop-ups**: off by default. Enable only when a canonical lyric LRC is selected and the EPK has an approved release-specific lyric treatment.

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

CSS receives versioned custom properties such as `--dance-moves-16t`. JavaScript uses `DanceMoves.durationMilliseconds(ticks)`. Orientation input keeps only the latest finite, screen-aligned sample; the shared scheduler publishes the latest meaningful target at a two-tick cadence and CSS transform transitions interpolate between targets. The first target remains immediate, jitter below the configured delta is suppressed, and teardown cancels any trailing target. Its two-second rolling normalisation is functional input processing, not a visual effect duration.

The catalogue adopter discovers the rendered EPK root, quantizes release-owned stylesheet, inline, computed and generated pseudo-element timing, registers the full release root for cue resets, and repeats the pass after dynamically inserted motion markup. It preserves the one-millisecond view-timeline sentinel used by November Christmas and the 0.01 ms reduced-motion sentinel. Under `prefers-reduced-motion: reduce`, the owned EPK subtree and its pseudo-elements are clamped to one 0.01 ms iteration.

The adopter changes timing ownership, not the creative design: selectors, keyframes, artwork, inputs and release identity remain page-specific. Pointer, scroll and orientation reactions remain event-driven. Canvas/WebGL effects that compute oscillator phase directly from frame time must use the public `DanceMoves.currentTick({ clock: "audio", audio })` value in their page adapter; CSS scanning cannot safely rewrite shader or drawing code.

An element can delay its CSS animation until a musical boundary:

```html
<div data-dance-moves-start-interval="16">Starts on a beat</div>
<div data-dance-moves-start-interval="64" data-dance-moves-start-clock="audio">Starts on a 4/4 bar of the active song</div>
```

Without `data-dance-moves-start-clock="audio"`, declarative starts use the page clock. For transitions or JavaScript-driven updates, use `DanceMoves.deferStart(element, ticks, { clock: "audio", start, id: "release:entrance" })` or `DanceMoves.scheduleAtInterval(ticks, callback, { id: "release:update" })`. Each returns a cancellation function. Stable IDs are required by the pre-live harness so synchronous page work can be attributed to its owning effect.

## Cue behavior and page API

The runtime fetches the page's cue file, finds every `<audio>` whose duration matches the canonical programme, and follows each active player independently. Ordinary seeking re-indexes the cue cursor without replaying skipped cues. An exact cue landing within 50 milliseconds arms only that cue: paused players dispatch it once on the next playback start, while players already running dispatch it as soon as the seek completes.

When a cue occurs during playback, DanceMoves resets every currently running DanceMoves-owned CSS/Web Animation to its first frame and immediately continues it. It does not reset WordPress, browser, player-control or third-party animations.

Page adapters can subscribe without executing timing-file text:

```js
const unsubscribe = window.DanceMoves.onCue("CHORUS 1", detail => {
  // Perform a page-specific update.
}, { id: "release:chorus-state" });
```

`"*"` subscribes to all cues. The runtime also dispatches bubbling `dance-moves-cue` and backwards-compatible `kieran-epk-cue` custom events. Local harnesses can route a data-only cue through the same production path with `DanceMoves.fireCue({ name, type, time })`.

## Timed lyric pop-ups and visual-language workflow

When enabled, DanceMoves creates one non-interactive, `aria-hidden` lyric layer and writes lyric text with `textContent`; timing-file text is never interpreted as markup. The full readable lyric section remains the accessible source, so rapid sung lines are not repeatedly announced by assistive technology. Blank LRC cues clear the layer. Reduced-motion mode keeps the words but removes entrance and exit motion; forced-colours mode supplies a high-contrast fallback.

Page adapters can respond to the same lyric state without running a second parser or clock:

```js
const removeLyrics = DanceMoves.onLyric(detail => {
  document.querySelector('.ks-epk')?.toggleAttribute(
    'data-hook-line',
    detail.normalisedText === 'HAVE SOME TAT'
  );
}, { id: 'release:lyric-treatment' });
```

Each detail also exposes `nextTime`, `nextText`, `nextNormalisedText` and `nextIndex` for the immediate next LRC entry. A blank next entry is deliberately preserved because its timestamp is a real lyric-clear boundary. The final entry reports `nextTime: null`, an empty next text and `nextIndex: -1`. Release adapters may use these fields with `detail.audio.currentTime` for seek-, pause- and playback-rate-safe choreography; they must not fetch or parse the LRC again.

An EPK may override the neutral component through `.dance-moves-lyric-popover` and `.dance-moves-lyric-popover__text`, their public state attributes, and CSS custom properties. Adoption is a design task, not a switch-only task. Before enabling it for any release:

1. read the release's current visual-language record and inspect its artwork, typography, texture, palette, motifs and motion rules;
2. state what is observed, inferred, proposed and adopted;
3. design a unique lyric container, typography, entrance/replacement motion and any restrained cue-specific emphasis that belong to that song rather than copying another EPK;
4. use DanceMoves ticks or `onLyric()` only—never add a second LRC parser, timer or audio clock;
5. preserve real text, the complete readable lyrics, mobile safe areas, player/control clearance, `prefers-reduced-motion`, forced colours and a static fallback; and
6. stage and test ordinary lines, blank clears, repeated hooks, pause, resume, seek, end, narrow screens and long lines before action-time approval.

The release-local visual-language file and EPK change record must name the treatment, explain why it fits the song, record the fallback, and give a measurable acceptance test. If the visual evidence does not support a distinctive treatment yet, leave the checkbox off.

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
- Page 839: California Screamin' orientation adapter

Page 252's visual treatment remains release-specific. DanceMoves reuses its neutral timing and input infrastructure elsewhere but does not transplant its clay, cuneiform, cloud, warm-light or button choreography to other EPKs.

While the old `Made from Clay and Stars EPK Effects` plugin is active, DanceMoves suppresses its page-252 assets and content transform. Deactivating the old plugin makes DanceMoves take over on the next request, preventing a double-loaded effect stack.

## Adaptive Clay/Stars performance

Page 252 starts every ordinary session in the `full` profile. DanceMoves waits for the visible page to settle, measures animation-frame intervals for 1.6 seconds and uses the median interval rather than a user-agent or device-class guess. Background/hidden time and individual gaps above 250 milliseconds are discarded, so tab throttling cannot reduce the effect.

Two consecutive measured windows below 45 FPS change only the release-scoped root to `constrained`. That tier stops the two full-page cloud drifts, the atmosphere particle loop and the ambient gold sparkle loops, while preserving their static appearance, BPM/cue behaviour, phone tilt, warm-light response and controls. After a settle period, two further windows below 50 FPS change to `minimal`, which also removes blur and screen blending from those static ambient planes. A healthy constrained measurement stops the reduction there. Profiles only step downward during one page session, avoiding quality oscillation after the reduction has restored frame rate.

The selected profile is exposed as `data-dance-moves-performance="full|constrained|minimal"` on the Clay/Stars EPK root. `DanceMovesClayStars.snapshot().performance` reports the current profile, reason, measured frame-rate statistics and reduction count without retaining or transmitting samples. `prefers-reduced-motion` remains authoritative and stops the sampler as well as non-essential motion.

## Validation and packaging

The complete test design and publication gates are in `TEST-PLAN.md`.

For every new or materially changed EPK effect, use the reusable live-harness workflow at `../../../../skill-source/epk-effect-test-harness/SKILL.md`. It scaffolds manifest-driven master/timing/effect controls, deterministic input/cue simulation, attributable performance timing, CSS-property/bottleneck audits and pre-live evidence without publishing or writing to WordPress.

In the source repository, run `tools/validate.ps1 -Mode Unit` for the normal read-only validation path. It checks syntax, automated contracts, strict UTF-8 and the Clay content transform without rebuilding migration or package artifacts. Run `tools/validate.ps1 -Mode Package` only when an explicit migration/package rebuild is intended, or `tools/validate.ps1 -Mode All` for both stages. Development tests and tools remain in the repository and are intentionally excluded from the WordPress ZIP.

The validator checks PHP and JavaScript syntax, unit/contract tests, strict UTF-8, the page-252 content transform and plugin identity. Package mode additionally rebuilds migration/package artifacts and verifies the distributable ZIP layout, version and hashes. `tools/test-validator-failure.ps1` proves that a deliberate syntax failure returns non-zero and is attributed to its fixture.

No WordPress upload, timing-media upload, page-meta save or legacy-plugin deactivation should occur until the exact ZIP and migration manifest have action-time approval. Public verification must cover signed-out desktop, tablet and mobile rendering, Unicode, reduced motion, audio/chapter controls, cue resets, named handlers and all original seven orientation adapters.

For the EPK download route, verify one rendered MP3 download anchor from each materially different markup pattern, require a signed DanceMoves URL, and capture its response headers. The download response must be HTTP 200 with `Content-Type: audio/mpeg`, `Content-Disposition: attachment` and the expected byte count. Independently reload at least one on-page player and require its direct media request to remain HTTP 206/200 `audio/mpeg` with no forced-attachment header. A successful WordPress plugin notice does not prove either behaviour.

## Rollback

- Shared-runtime regression: reinstall the preserved 1.2.4 ZIP.
- Page-252-only regression: reactivate `Made from Clay and Stars EPK Effects` 1.0.0; DanceMoves then suppresses its page-252 adapter.
- Metadata problem: restore the Page meta revision or clear the attachment ID. Do not delete shared Media Library files without first auditing references.

## Potential problems

### A global MP3 attachment header breaks on-page playback

- **Symptom:** direct MP3 links download correctly after a server-wide header change, but the same URLs can no longer be relied on by the EPK audio players.
- **Cause verified:** `Content-Disposition: attachment` expresses download behaviour for the HTTP response, whereas `audio/mpeg` is the correct media type used by the player. Applying the attachment disposition to every `.mp3` response conflates the download and playback routes.
- **Corrective action:** version 2.5.0 leaves direct upload URLs unchanged and rewrites only explicit `<a download>` links to a signed WordPress endpoint. That endpoint validates a same-site uploads-relative MP3 path and signature, then sends `Content-Disposition: attachment`; `<audio>` and `<source>` URLs retain the ordinary media response.
- **Verification:** the local contract checks same-origin and traversal rejection, signed URL generation, anchor-only transformation, attachment headers and player-source non-interference. Deployment still requires independent signed-out network checks of both routes.
- **Limit:** links without a `download` attribute are deliberately not changed. Large files are streamed through PHP on the download route, so host timeout and throughput should be checked with a representative full-size MP3 after deployment.

### Seeking exactly to a cue suppresses its entrance effect

- **Symptom:** uninterrupted playback dispatches a cue, but selecting a chapter at that cue timestamp and then pressing Play omits its entrance effect.
- **Cause verified:** the former seek handler moved the cursor to the first cue strictly after the landing time, so an exact landing was neither a forward crossing nor an eligible queued cue.
- **Corrective action:** version 2.4.2 arms a canonical cue within 50 milliseconds of the seek landing, dispatches it once on the next playback start when paused (or immediately when already playing), and leaves ordinary seek suppression unchanged. Release adapters consume the shared cue event rather than parsing timings independently.
- **Verification:** `tests/exact-cue-seek.test.cjs` covers paused landing, play/playing duplicate suppression, mid-section scrubbing and an in-playback landing. The complete Unit validator also verifies all existing cue, lyric, catalogue, harness, orientation and WordPress contracts.
- **Limit:** this repairs shared cue delivery; an older page-specific visual that does not consume `DanceMoves.onCue()` or `dance-moves-cue` still requires a one-time adapter migration.

### A secondary Windows worktree can change unchanged asset bytes

- **Symptom:** the Clay harness reports a production hash mismatch for an untouched asset such as `dance-moves-core.css` immediately after creating an isolated worktree.
- **Cause when verified:** the repository's Windows `core.autocrlf=true` setting converted LF blobs to CRLF in the new checkout, so raw packaged bytes no longer matched the production hashes even though the CSS semantics were unchanged.
- **Corrective action:** add explicit LF attributes for packaged and validated text formats, normalise the candidate's staged source once, hash canonical LF bytes in the cross-platform harness, and verify a known untouched production asset before packaging. Reject unexplained semantic differences rather than accepting a raw line-ending mismatch.
- **Verification:** canonical LF hashing restored `assets/dance-moves-core.css` to SHA-256 `197E0D51F400A3D875ACB6E12238417FAA3D54853708F72EEB792342F533AD8D`, matching the existing Clay harness manifest; the WordPress package manifest independently pins the exact archived bytes.
- **Limit:** this is for byte-stable release staging; it does not justify ignoring real source or line-ending changes in files intentionally edited by the candidate.

### A static adaptive fallback can be misclassified as a keyframe declaration

- **Symptom:** the Clay adapter test reports `P-034 no keyframe animates filter` after adding a legitimate static `filter:none` fallback outside every animation.
- **Cause when verified:** the test sliced everything from the first `@keyframes` token to the first later `@media` token, so ordinary selectors placed after the final keyframe were incorrectly treated as keyframe content.
- **Corrective action:** extract each `@keyframes` block with balanced braces and run the prohibited-property assertions only against those exact blocks.
- **Verification:** the same test accepts the static minimal-tier filter rule while still rejecting prohibited declarations inside any keyframe; all Clay adapter contracts pass.
- **Limit:** this is a structural source check, not rendered proof that a browser applies the intended adaptive selector.

### A multi-file exact-context patch is atomic when one hunk is stale

- **Symptom:** a multi-file patch fails because one expected line differs from the current file, even though its other hunks were valid.
- **Cause when verified:** one versioned README/build-script context line was stale or mistyped; the patch tool requires every hunk in a call to match before writing any of them.
- **Corrective action:** reread the exact target lines, split the change into small related patches and apply only corrected contexts.
- **Verification:** the failed calls left no partial edit; `git diff --check`, exact version searches and the succeeding unit contracts show only the intended 2.3.3 references.
- **Limit:** atomic failure prevents partial writes for that call only; always inspect the resulting diff because later successful calls are independent.

### A clean worktree omits the generated Clay harness candidate

- **Symptom:** `clay-adapter.test.cjs` fails with `ENOENT` for `qa/clay-stars-harness-candidate.html` even though the production source and manifest hashes are valid.
- **Cause when verified:** the candidate is a deterministic local build artifact and is intentionally untracked, so Git does not populate it in a fresh isolated worktree.
- **Corrective action:** run the repository-owned `tools/build-clay-stars-preview.ps1 -Harness` against the canonical signed-out Clay page before Unit validation; keep the generated candidate out of the WordPress package.
- **Verification:** the builder recreated the candidate in the isolated staging worktree and allowed the adapter/harness validation to proceed against the exact current production assets.
- **Limit:** rebuilding the candidate is valid only while its canonical source path and asset substitutions remain current; it does not replace signed-out public verification after deployment.

### A reusable signed-out filename can contain the wrong EPK

- **Symptom:** the generated Clay candidate opens with another release's title and contains no `.ks-clay-stars-v2` root even though the JavaScript-only adapter contracts pass.
- **Cause when verified:** the builder trusted a mutable release-folder filename whose current contents were a Patriotic Revolution EPK rather than the Clay/Stars page; the exact earlier overwrite operation was not established.
- **Corrective action:** store the current signed-out Clay page as a version-labelled QA fixture, pin its SHA-256, assert its title, single root, audio, five chapter controls and signed-out state before substitution, then remove every remote DanceMoves asset before injecting the local candidate once.
- **Verification:** the corrected fixture is 193,347 bytes with SHA-256 `2F3EC40E763E712CCFD5F94C818E0D651F9F98EF8CA925FEB05A9F39D464B038`; the rendered candidate has the correct title, one root, one player, five chapters and one local 2.3.3 core/Clay script each.
- **Limit:** the fixture is point-in-time evidence for pre-live testing; the currently rendered signed-out WordPress page remains canonical and must be refreshed after deployment.

### A local test port can already serve another worktree

- **Symptom:** a cache-busted localhost candidate still returns an old page after the expected file was rebuilt, and stopping the newly launched command does not stop responses on that port.
- **Cause when verified:** port 8765 was already owned by another persistent local server and continued serving its different repository after the new process was stopped.
- **Corrective action:** do not terminate or inspect the unknown server; choose a fresh port, pass the candidate repository with the server's explicit directory option, and verify the response title and byte count from the shell before opening it in the browser.
- **Verification:** port 8917 returned the 192,348-byte Clay/Stars candidate, and the browser loaded all local 2.3.3 assets from that port.
- **Limit:** a successful localhost response verifies the selected test server only; it does not prove public WordPress state.

### Sandboxed ADB can lose the Android profile directory

- **Symptom:** the exact read-only `adb devices -l` command exits with `Cannot mkdir '\\.android': Permission denied` even after `ANDROID_USER_HOME` is set to the existing user Android directory.
- **Cause when verified:** the restricted command environment did not expose the normal Android profile/daemon context, so ADB still resolved its configuration directory at the filesystem root.
- **Corrective action:** rerun only the exact installed `adb.exe devices -l` status check with approved host access and the task-specific `ANDROID_USER_HOME`; do not redefine `HOME`, forward Chrome DevTools or inspect phone tabs.
- **Verification:** the approved host check started the ADB daemon and completed normally; its device list was empty, so no physical 2.3.3 candidate result was claimed.
- **Limit:** this recovery fixes only the local ADB profile error. An empty list means the phone is currently disconnected or unauthorised and leaves physical performance evidence blocked.

### A blanket UTF-8 rewrite can alter intentional BOM bytes

- **Symptom:** a mechanical line-ending pass marks many otherwise untouched JSON, Markdown, JavaScript and test files as modified.
- **Cause when verified:** writing every tracked text file with a no-BOM encoder removed intentional UTF-8 byte-order marks as well as normalising line endings.
- **Corrective action:** stop before packaging, restore the worktree from the separately staged exact candidate, keep explicit LF attributes for future checkouts and limit hashing normalisation to the known cross-platform source-hash comparison. Do not bulk-rewrite historical evidence.
- **Verification:** after restoration, `git status` returned to only the intended 2.3.3 source, test, documentation and QA files; unchanged DanceMoves core hashes again matched the baseline.
- **Limit:** restoring from the index is safe here only because the task used a dedicated clean worktree and every intended edit had already been staged and reviewed.

### A plugin version bump must update the private phone fixture's cache keys

- **Symptom:** `wordpress-upload-contract.test.cjs` reports that a phone-conformance asset is not cache-versioned to the current plugin even though production PHP correctly declares the new version.
- **Cause when verified:** the unlisted physical-device fixture retained `?ver=2.3.0` on its four local scripts after the plugin header and contract moved to 2.3.1.
- **Corrective action:** update every fixture script cache key to the exact plugin version while leaving its capture token, endpoint, schema and behaviour unchanged; rerun the full Unit gate.
- **Verification:** the 2.3.1 fixture references the production orientation core, simulator, capture policy and conformance runner with matching `?ver=2.3.1` keys and the upload contract passes.
- **Limit:** cache-key parity does not prove the fixture is deployed or publicly reachable; the test page remains unlisted, `noindex` and excluded from the WordPress ZIP.

### The viewport runner must await its full asynchronous lifecycle

- **Symptom:** `capture-public-viewports.mjs` exits with code zero after creating an empty evidence directory and a temporary Edge profile, with no screenshots, JSON or console output.
- **Cause when verified:** the module called `main()` without top-level awaiting it, so Node could finish module evaluation while the asynchronous browser lifecycle was still pending. The DevTools WebSocket connection also lacked an explicit deadline.
- **Corrective action:** top-level await the complete `main()` promise; keep explicit 15-second timers active while connecting and while awaiting every DevTools command response, clear each timer on resolution/error, and reject on expiry. Treat a missing `viewport-evidence.json` as failure regardless of process exit code.
- **Verification:** the hardened runner returned a visible non-zero `Timed out waiting for Page.enable` error instead of exiting zero with an empty evidence directory.
- **Limit:** this fixes runner lifecycle and silent connection setup only. Browser launch, target creation, navigation and capture failures retain their own explicit error paths.

### Headless Edge can fail before writing a screenshot when its GPU process is unusable

- **Symptom:** the CLI capture writes no PNG and exits after repeated GPU-process failures ending in `GPU process isn't usable. Goodbye.`
- **Cause when verified:** Edge reported an unusable GPU process in this Windows session; accompanying encryption and profile-cache errors were observed but were not established as the cause.
- **Corrective action:** require the screenshot file to exist before accepting the command; keep the failure explicit, use the functioning in-app rendered candidate for scoped DOM/runtime checks, and retain prior fixed-viewport evidence only when the candidate markup and CSS are byte-identical. Obtain fresh post-deployment screenshots with a healthy renderer.
- **Verification:** the missing PNG caused the fallback command to fail non-zero; no screenshot or viewport pass was claimed. The rendered 1280-pixel candidate separately retained one player, five chapter controls, zero document overflow and no replacement characters.
- **Limit:** prior layout evidence does not become a fresh 2.3.1 capture. A motion or CSS change that can alter layout still requires new 1440/900/390 rendered evidence before publication.

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

### The in-app browser exposes a deliberately small locator surface

- **Symptom:** `waitForSelector`, locator `boundingBox` or locator `hover` reports `is not a function`, and isolated evaluation may not expose browser constructors such as `Event` or `PointerEvent`.
- **Cause when verified:** this browser controller exposes locator `waitFor`, `click`, `press`, text/attribute reads and isolated DOM evaluation, not the complete upstream Playwright API or every main-world constructor.
- **Corrective action:** wait with `tab.playwright.locator(selector).waitFor(...)`; read geometry in DOM evaluation; use a supported visible action such as locator `click` when it matches the test. Use a documented main-world path only when ownership or event-constructor behavior is essential.
- **Verification:** the locator-based wait loaded the exact 2.3.1 Clay candidate, DOM evaluation read its 484.6-pixel cover and runtime state, and a supported click completed without broadening browser access.
- **Limit:** do not synthesize unsupported APIs or interpret an isolated-world omission as a production-page defect.

### A saved browser-tab binding can outlive its tab

- **Symptom:** an authenticated read-only audit fails with `Unknown tab` even though the existing in-app browser connection remains healthy.
- **Cause when verified:** the saved tab had been closed or removed after cleanup while its JavaScript binding remained in the persistent browser-control session.
- **Corrective action:** keep the existing browser connection, discard only the stale tab binding, create or obtain one fresh tab from that connection, and navigate it to the exact previously verified URL. Use a new variable name or a `let` binding when the tab reference may need replacement.
- **Verification:** a fresh tab in the existing signed-in browser loaded each private WordPress Motion Capture editor and allowed all seven JSON records to be audited without reauthentication.
- **Limit:** this recovery applies when the connection is healthy and only the tab is stale; it is not a reason to reset a working browser session or switch browsers.

### The desktop browser controller cannot attach directly to an Android DevTools WebSocket

- **Symptom:** a phone-tab diagnostic through the persistent desktop browser controller fails with `WebSocket is not defined` even after ADB has exposed an exact filtered EPK target.
- **Cause when verified:** the controller's JavaScript runtime does not provide a WebSocket client, while the installed local Node runtime used by the existing CDP tooling does.
- **Corrective action:** after informed approval for Chrome's broader debugging surface, enumerate targets locally without printing unrelated tabs, select the exact EPK URL, and pass only that page's local WebSocket URL to `tools/inspect-phone-epk.mjs`.
- **Verification:** require the diagnostic output URL to equal the selected EPK URL and inspect only that returned page state.
- **Limit:** ADB's `chrome_devtools_remote` endpoint exposes Chrome's tab-debugging surface before filtering. Never enable it without informed approval, and never enumerate, attach to or report unrelated targets.

### Android Chrome background tabs can stall timer-based DevTools diagnostics

- **Symptom:** `Runtime.evaluate` times out after a diagnostic awaits a page timer, even though DevTools connected and `Runtime.enable` succeeded.
- **Cause when verified:** the disposable injected EPK tab stalled and the second same-origin EPK tab was background-throttled. Its timer-based probe did not complete until the exact disposable tab was closed and the original EPK became foreground.
- **Corrective action:** close only the explicitly created disposable test tab, confirm the remaining exact EPK target is visible, and rerun the bounded diagnostic there. Reload the target with cache disabled when a stale asset version is present.
- **Verification:** the foreground EPK returned its full runtime snapshot, current script versions and sensor state without touching another Chrome target.
- **Limit:** never close or navigate a tab that was not created or explicitly placed in scope for the test.

### Synthetic orientation dispatch is not a physical Android sensor proof

- **Symptom:** an event dispatched inside one DevTools evaluation is observed by a temporary listener from that evaluation but not by a production listener created in another execution world; the listener still appears in `DOMDebugger.getEventListeners`.
- **Cause when verified:** Android Chrome kept the DevTools evaluation worlds isolated for this synthetic event path. The result does not show that the production listener is absent or that native sensor delivery is broken.
- **Corrective action:** use the deterministic shared-runtime unit test to prove mapper-to-adapter routing, use the exact phone tab only to confirm the production listener is installed and listening, and reserve a physical-device pass for actual native events plus visible transforms after deployment.
- **Verification:** the 2.3.2 unit fixture delivers bounded orientation samples into the real Clay adapter factory, marks it active, and stops listening under reduced motion; the phone runtime reports one Clay `deviceorientation` listener with `listening: true`.
- **Limit:** do not represent CDP event dispatch, listener invocation or device-orientation overrides as trusted physical sensor evidence.

### A previously emulated Android Chrome target can stop yielding native orientation events

- **Symptom:** the production listener is installed and reports `listening: true`, the document is visible and reduced motion is off, but an Android Chrome target previously used for DevTools orientation emulation yields zero native events after the override is cleared.
- **Cause when known:** the affected target had been used for sensor emulation and remained unsuitable for a clean physical proof. Chrome's internal reason for retaining that state was not established.
- **Corrective action:** close only that exact, explicitly scoped EPK test tab, open the public EPK in a new Chrome tab, activate that exact target and repeat the bounded diagnostic without synthetic dispatch, listener invocation or a CDP orientation override.
- **Verification:** the new DanceMoves 2.3.2 target delivered 88 native events in eight seconds, set the shared runtime and Clay adapter active, committed 21 motion frames and applied non-zero cover tilt and translation.
- **Limit:** a fresh target is evidence for the physical event path only when no emulation or injected event is used in that target. Never close, enumerate or inspect unrelated phone tabs.

### PowerShell loop output must be grouped before piping

- **Symptom:** PowerShell reports `An empty pipe element is not allowed` after a `foreach (...) { ... } | Format-Table` construct.
- **Cause:** the statement-form `foreach` block is not accepted as the pipeline element in that command form.
- **Corrective action:** group the emitted loop results as `$(foreach (...) { ... }) | Format-Table`, or use `ForEach-Object` in the pipeline.
- **Verification:** the grouped command completed and returned the intended DanceMoves file line/byte inventory.
- **Limit:** this fixes command parsing only; it does not validate the inspected files.

### `Invoke-WebRequest` can return binary timing files as a byte array

- **Symptom:** hashing an uploaded `.lrc` response after passing `Invoke-WebRequest.Content` through `UTF8.GetBytes()` produces a much larger byte count and a false SHA-256 mismatch; calling string methods such as `Substring()` on the content can also report that `System.Byte` has no such method.
- **Cause when verified:** WordPress served the timing files as `application/octet-stream`, so Windows PowerShell exposed `Content` as the original `byte[]` rather than as a string. Re-encoding that array changed the data being hashed.
- **Corrective action:** when `Content -is [byte[]]`, hash those bytes directly; only UTF-8 encode the value when it is actually a string.
- **Verification:** the corrected public checks returned 7,037 lyric bytes with SHA-256 `4D0363A692A473AE8207D6711155F545FF6EDB7D92B125A2AA4E186B9F27BE7B` and 823 cue bytes with SHA-256 `C32F1D5AA036DBAD051A6BD08C257BA050D3EC8DEFC250ADC22DE6A3FCD15302`, both matching the canonical files.
- **Limit:** select the decoding path from the response's actual runtime type; do not assume that every `Invoke-WebRequest` response is binary.

### PowerShell text decoding can create a false JavaScript asset hash mismatch

- **Symptom:** a public JavaScript asset fetched through Windows PowerShell appears to be 16,980 bytes and fails its approved SHA-256 check even though the deployed code and version are correct.
- **Cause when verified:** `Invoke-WebRequest.Content` decoded the UTF-8 JavaScript as text and the subsequent conversion back to bytes changed non-ASCII punctuation. The response object no longer represented the immutable response bytes.
- **Corrective action:** download JavaScript assets as raw bytes with `curl.exe --output` (or another byte-preserving client), then hash the downloaded file without text decoding or re-encoding.
- **Verification:** the raw public DanceMoves 2.3.2 orientation asset was 16,974 bytes with SHA-256 `998CB3A77D3E215DCA04C3C6BAAA258B85A581D643ABA7667D4EBF4BAC391C97`, exactly matching the approved package.
- **Limit:** use this procedure for immutable byte verification. A decoded string remains suitable for semantic text inspection only when byte identity is not being claimed.

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

### Version and hash fixtures can fail after an intentional asset change

- **Symptom:** contract tests report an obsolete plugin version or a candidate production-asset hash mismatch immediately after an intentional release edit.
- **Cause when verified:** the source change was correct, but the strict version-labelled fixture or harness manifest still described the prior bytes.
- **Corrective action:** inspect the exact diff first, then update only the maintained fixture version and hashes from the staged production files; never relax or remove the hash assertion.
- **Verification:** the 2.3.4 JavaScript, WordPress, Clay and California contract suites pass with the new source hashes.
- **Limit:** a matching fixture proves internal consistency, not publication or a match to the live WordPress files.

### A full-page California audit can fail on page-owned legacy animation

- **Symptom:** the California Screamin' shared-harness scaffold reports continuously animated `width` or `background-position` even though the new tilt adapter writes only `--cs-x` and `--cs-y`.
- **Cause when verified:** the exact published page payload contains an audio-progress width transition and rain background-position keyframes; a shared legacy Light Will Win rule also transitions background position.
- **Corrective action:** keep the full-page audit as a separate explicit result, verify the 2.3.4 California adapter contract and transform-only consumer path independently, and remediate the page-owned effects in a separately reviewed EPK payload.
- **Verification:** the adapter contract passes, the 1440/900/390 candidates have one release root and no horizontal overflow, and the loaded 2.3.4 tilt rule transitions only `transform`.
- **Limit:** the California page is not pre-live performance-approved until the unrelated page-owned findings are fixed and a physical-device trace passes.

### A later artist-confirmed BPM can supersede older values

- **Symptom:** the live WordPress configuration, plugin fallback and harness manifest disagree about a release BPM.
- **Cause when verified:** Clay/Stars retained the historical moderate-confidence 116-BPM analysis in local fixtures, then used 89 BPM temporarily, before Kieran confirmed 90 BPM as canonical on 19 September 2026. No credible public source for the private release tempo was found.
- **Corrective action:** treat the latest direct confirmation as authoritative, preserve older values as history, update the page property, fallback clock and active harness to 90 BPM, and publish changed production bytes under a new plugin version rather than replacing an existing version in place.
- **Verification:** one beat at 90 BPM is 666.666667 ms, one tick is 41.666667 ms, and the corrected 2.3.5 contract suite must pass before packaging.
- **Limit:** do not retime LRC or CUE files merely because BPM changes; their timestamps are positions in the unchanged master recording.

### A next-lyric preview can drift too slowly across long cue intervals

- **Symptom:** the next lyric is visible for most of the preceding line and crawls from the bottom of the viewport towards centre.
- **Cause when verified:** its travel progress was calculated across the entire interval between consecutive LRC cues rather than a bounded choreography window.
- **Corrective action:** keep the immediate next cue hidden until `nextTime - 32 ticks`, then derive its position solely from the canonical audio clock so it reaches centre at the exact LRC timestamp. Trigger any arrival accent from the lyric event at that timestamp rather than from an independent timer.
- **Verification:** at 148 BPM, 32 ticks equals approximately 0.811 seconds; the next ticket remains hidden before that window, rises during the window, and the one-shot arrival shower is created at the centred ticket when the cue becomes current. Seeking, pausing and playback-rate changes continue to use `audio.currentTime`.
- **Limit:** blank cues remain blank, reduced motion uses a static lower preview and no particle shower, and the page-owned styling must still be tested at its actual mobile and desktop breakpoints.
