# DanceMoves effect-harness implementation plan

## Outcome

DanceMoves will have one development-only, manifest-driven test harness that runs the real plugin and page-effect assets, allows live tuning of master, timing and effect parameters, and produces attributable performance and CSS-risk evidence. The harness will enforce the plugin gates and generate the evidence needed for each EPK pre-live gate without uploading, saving, activating, deactivating or publishing anything in WordPress.

The first implementation target is Clay/Stars because it exercises the widest surface: shared musical timing, pointer motion, cue handling, animation ownership, WordPress content transformation and page-specific CSS. The same contract will then be applied to the orientation runtime and every release adapter.

## Baseline to preserve

- Repository HEAD at planning time: `2773874`.
- Current staged plugin/package version: `2.1.0`.
- Current ZIP SHA-256: `8412FE69B1E9607E6A7E76CFDF790C99C55D8EDBEE5E2A32A478636BF2EE4550`.
- `tools/validate.ps1` and `tools/package.ps1` now exist. The test-plan statement that the validator is absent is stale and must be corrected as part of phase 0.
- The package script deliberately includes only the PHP entry point, `README.md` and `assets/`. Harnesses, tests, traces and QA evidence must remain outside the public ZIP.
- The current orientation runtime batches sensor data on a 30 ms timer. Its tests assert that legacy behaviour. This must be replaced, not skipped, before the low-latency gate can pass.
- The current production orientation mapper uses a two-second rolling window. P-022 currently says ten seconds. Retain two seconds by default to avoid silently changing the existing feel, then correct the test wording unless a separately reviewed tuning run justifies a different window.
- Clay currently has continuously animated `background-position` keyframes and a permanent `will-change` declaration that includes `filter` and `background-position`. The property audit must report these as blockers until they are redesigned or supported by the narrowly allowed trace evidence for an infrequent bounded effect. The current continuous loop does not qualify for that exception.
- `README.md` already links the reusable `skill-source/epk-effect-test-harness` workflow. Treat that workflow as the design contract, while keeping a versioned harness implementation inside this repository so CI and future maintainers do not depend on an external working path.

## Architecture

### Repository layout

Add the following development-only structure:

```text
tests/
  harness/
    core/
      harness-runtime.js
      harness-probe.js
      harness-bridge.js
      harness.css
      live-lab.html
      candidate.html
    schemas/
      effect-harness.schema.json
      effect-harness-results.schema.json
    adapters/
      dance-moves-core.js
      orientation.js
      clay-stars.js
      <release-slug>.js
    manifests/
      plugin-core.json
      orientation-<release-slug>.json
      clay-stars.json
    fixtures/
      cue-files/
      wordpress-rendered/
      failing/
    e2e/
      performance-budget.e2e.mjs
      css-property-audit.e2e.mjs
      wordpress-render.e2e.mjs
qa/
  harness-results/
    <plugin-version>/
      <effect-id>/
tools/
  new-effect-harness.ps1
  epk-prelive.ps1
  sync-harness-template.ps1
```

The shared harness core should begin as a pinned copy of `skill-source/epk-effect-test-harness/assets/harness-template`. Record the source hash and contract version in a small lock file. `sync-harness-template.ps1` may show and apply an intentional update, but validation must fail on unexplained local drift; it must never silently overwrite an effect adapter or manifest.

### Separation of responsibilities

| Layer | Responsibility | Must not do |
|---|---|---|
| DanceMoves production runtime | Timing, cue dispatch, animation ownership, input normalisation, one-rAF scheduling and neutral lifecycle events | Render the lab, store raw traces, send telemetry or expose tuning UI |
| Diagnostics seam | Emit low-overhead named spans and counters to a supplied sink when diagnostics are explicitly enabled | Log every frame, update the DOM or allocate unbounded records |
| Harness core | Live controls, presets, A/B state, deterministic replay, frame sampling, summaries and export | Reimplement effect behaviour or publish to WordPress |
| Effect adapter | Map manifest parameters/cues to the real production effect and expose stable handler IDs | Contain a visual clone of the effect or bypass production assets |
| Browser runners | Execute deterministic viewports, property audits, fault injection and budget checks | Mark unavailable physical-device evidence as PASS |
| Pre-live runner | Assemble one page's evidence manifest and gate result | Upload, save, activate, deactivate or publish |

### Diagnostics activation

Add one explicit diagnostics entry point to `DanceMoves`, disabled by default. The recommended shape is `DanceMoves.setDiagnosticsSink(sink)` gated by `danceMovesConfig.diagnostics === true`. Only test fixtures and approved staging renders set that flag. Normal public configuration omits it, so production execution adds no marks, arrays, observers or per-frame object creation.

The sink receives small records on one `performance.now()` timeline:

- `orientation-handler`: entry/exit, accepted or rejected, and whether a frame was requested;
- `orientation-raf`: request time, callback entry/exit, commit flag and sample age;
- `cue-detect` and `cue-reindex`;
- `animation-reset`;
- `cue-dispatch-total`;
- `cue-handler`: page, cue name/type, stable handler ID, duration and error state; and
- explicitly registered asynchronous child work created by a cue handler.

Handler attribution must be built into registration rather than inferred from function text. Extend cue registration with an optional metadata object or add a compatible named form, while keeping existing callers working. The Clay wildcard handler should become a named handler such as `clay-stars:cue-state`.

The probe must publish counts, total, mean, p50, p95, p99 and maximum, plus raw bounded samples. It must measure empty-wrapper overhead, report buffer overflow, and prove that enabling instrumentation does not change event, callback or cue counts.

## Implementation phases

### Phase 0 - reconcile the baseline

1. Record the source commit, dirty files, current ZIP inventory/hash and test inventory.
2. Update `TEST-PLAN.md` so it reflects the implemented validator and the actual two-second rolling window.
3. Add a decision record for the rolling-window duration. Default decision: preserve two seconds; a change is a separate effect-tuning change with A/B and physical-device evidence.
4. Split validation into read-only and packaging modes. The default test path must not rebuild migration artifacts or `dist`; packaging remains an explicit release step.
5. Add a deliberate failing fixture and prove the coordinator exits non-zero and names the failed gate.

Exit criteria: the written contract matches the current repository, validation can run without mutating release artifacts, and the baseline can be reproduced from hashes.

### Phase 1 - install the reusable harness core

1. Vendor the pinned harness core, schemas and candidate shell under `tests/harness`.
2. Add schema validation for manifests and result bundles.
3. Add a wrapper that scaffolds a new effect manifest and adapter from the repository copy.
4. Make the live lab load production DanceMoves assets directly from `assets/`.
5. Add a handshake that fails if the adapter, production root, asset version or diagnostics sink is missing.
6. Add live controls for:
   - master intensity and global enable/disable;
   - BPM and tick comparison, with verified production BPM displayed separately from temporary lab overrides;
   - cue position, cue name/type, seek, loop and playback-rate scenarios;
   - orientation sensitivity, dead zone, smoothing/window choice and output bounds;
   - effect-specific values declared by the manifest;
   - reduced-motion, viewport and input-mode simulation; and
   - A/B presets, reset, import and export.
7. Make temporary overrides visibly labelled and impossible to write back to PHP metadata, timing files or WordPress.

Exit criteria: a schema-valid `plugin-core` lab can load the real runtime, change a parameter live, restore the exact baseline and export a reproducible result bundle.

### Phase 2 - add performance attribution to the core

1. Implement the disabled-by-default diagnostics sink.
2. Instrument cue detection, re-indexing, dispatch and owned-animation reset.
3. Instrument each registered named/wildcard cue handler individually and preserve handler isolation/unsubscribe behaviour.
4. Instrument `scheduleAtInterval`, `deferStart`, `onNextInterval` and `onEveryInterval` callbacks where synchronous page work occurs.
5. Add rAF frame sampling with detected refresh interval, FPS, frame-interval percentiles, frames over 1.5x/2x, longest missed-frame sequence and long-task attribution.
6. Bound raw buffers and fail closed on overflow, dropped marks or unattributed handlers.
7. Add overhead and equivalence tests with diagnostics off versus on.

Exit criteria: unit and browser tests show complete attributable measurements, no changed cue/event counts, zero unbounded retention and a quantified instrumentation overhead.

### Phase 3 - replace orientation batching with latest-sample rAF coalescing

1. Keep the sensor handler to finite-value validation, screen alignment, latest-sample storage and at-most-one pending rAF request.
2. Move normalisation and all adapter writes into the rAF callback, unless profiling proves a smaller split is needed.
3. Commit the newest valid sample once per display frame; do not average a burst into a stale batch.
4. Preserve the chosen rolling-window semantics and make smoothing time-based rather than frame-count based.
5. Cancel pending work and restore neutral values on reduced motion, hide/page-hide, orientation change, teardown and adapter removal.
6. Remove `ksOrientationBatch` and all fixed 30 ms contract assertions.
7. Add `sensor-raf-scheduler.test.cjs` for P-020 through P-028, including a 240-event pre-frame burst, layout-read traps, fuzzed inputs, reinitialisation and lifecycle cleanup.
8. Retain the existing mobile capture/conformance tools as calibration fixtures, but route replay through the new scheduler.

Exit criteria: one burst schedules one frame, the final valid sample wins, DOM commits never exceed rAF callbacks, hot paths perform no layout reads, and the 20/60/120/240 Hz synthetic runs pass.

#### Phase 2-3 implementation checkpoint - 2026-08-31

- Phase 2 is implemented in the development source. Diagnostics remain inert unless `diagnostics: true` is present and a sink is attached; the core retains, logs and transmits no records. Cue detection/re-indexing/reset/dispatch, custom events, individual named/wildcard handlers and interval callbacks emit bounded scalar spans with stable IDs.
- The development harness attaches the sink, records named cue/interval buckets, detects dropped samples/marks and unattributed handlers, reports the longest missed-frame sequence, and fails closed through its existing overflow signal. Clay's wildcard handler is named `clay-stars:cue-state`.
- Diagnostics-off versus diagnostics-on callback and event counts are identical in `dance-moves-diagnostics.test.cjs`. Its deterministic span envelope is fixed at five records for the benchmark cue, and repeated 2026-08-31 seal runs measured 2.115-2.885 microseconds additional wrapper time per cue. This is software-test evidence, not physical input-to-photon latency.
- Phase 3 is implemented through `createLatestSampleRafScheduler`. A 240-event pre-frame burst schedules one rAF and commits the final finite sample. The production runtime performs no adapter write in the sensor callback, uses the retained two-second rolling mapper and 32 ms time-based exponential smoothing, and resets pending work on reduced motion, visibility/page hide, orientation change, teardown, reinitialisation and adapter removal.
- `sensor-raf-scheduler.test.cjs` passes P-020 through P-028, including 20/60/120/240 Hz synthetic runs, fuzzed finite/bounded outputs, layout-read traps and listener/control ownership checks. The legacy `ksOrientationBatch` and fixed 30 ms runtime contract are absent.
- The full read-only `tools/validate.ps1 -Mode Unit` gate passes. The local core harness connected, accepted a cue and recorded a 1.00 ms cue p95 with 67 samples, zero long tasks and no buffer overflow indication. Its in-app browser ran near a 30 Hz interval, so the observed 28.69 FPS is an environment observation rather than a 60/120 Hz performance claim.
- The 390 px mobile fixture replayed 60 recorded samples through the real runtime, reached `data-ks-orientation="active"`, and produced a non-neutral transform with no warning/error log. Physical-device input-to-photon and soak runs remain future pre-live evidence.
- One source-less `MutationObserver` type error appeared only in the core-harness browser context. The candidate does not load the orientation runtime and no source URL was supplied, so ownership is unverified; retain it as a browser-controller limitation and block pre-live approval if the same error appears in an independently attributable page run.
- A concurrent workspace update advanced the source plugin header to 2.2.0; the development candidate and calibration cache keys were reconciled to that current source without rebuilding a package. No migration manifest or WordPress state was changed during this checkpoint.

### Phase 4 - make Clay/Stars the pilot effect

1. Create `clay-stars.json` with controls for master intensity, cover tilt/translation bounds, bloom/flare/specular travel, particle-release duration/ticks and cue-state scenarios.
2. Create a thin Clay adapter that uses the real transformed markup, CSS and JavaScript. It must not reproduce the visual logic in harness-only code.
3. Attribute the Clay wildcard cue handler by stable ID and time it separately from core dispatch/reset.
4. Add deterministic pointer, focus, blur, cue, seek, hide/show and reduced-motion paths.
5. Replace continuous `background-position` animation with bounded transform/opacity layers. Remove unjustified permanent `will-change`, especially `filter` and `background-position`.
6. Test particle snapshot/release sampling for rAF leaks, computed-style cost, detached controls and correct cleanup.
7. Add the idempotent WordPress transform fixture and legacy-plugin collision scenarios.
8. Compare baseline and candidate at 1440, 900 and 390 pixels and on 60 Hz/120 Hz reference devices.

Exit criteria: P-030 through P-046 pass for Clay; the live lab can tune it without touching source; there is no continuous layout/paint animation; all Clay cue work is named and within budget.

### Phase 5 - add the CSS/property and bottleneck auditor

1. Parse stylesheet animations/transitions, inline styles, WAAPI keyframes and JavaScript `style`/custom-property writes.
2. Resolve every custom property to every consuming CSS property. A custom-property write is not automatically compositor-safe.
3. Classify layout, paint, expensive-compositing and normally compositor-friendly properties using the table in `TEST-PLAN.md`.
4. Report source file/line, selector/element, property, animation, trigger, duration, iteration count, rendered bounds and viewport coverage.
5. Instrument layout reads and detect read-after-write patterns in sensor, rAF and cue paths.
6. Count listeners, timers, rAFs, observers, effect roots and retained records before/after a five-minute soak.
7. Highlight oversized layers, decoded media, filters/masks/blends, full-page fixed surfaces, particle counts, third-party activity and repeated network/console failures.
8. Treat unknown dynamically constructed properties as `BLOCKED` until traced.

Exit criteria: `css-property-audit.e2e.mjs` produces both JSON and human-readable output, fails known bad fixtures, and reports no unresolved continuous layout/paint path in the candidate.

### Phase 6 - cover every DanceMoves adapter

Apply a separate manifest and real-asset adapter to each supported page. Use this order:

1. Clay/Stars pilot.
2. Dmitri My Talisman, because orientation updates broad root-level variables and a radial-gradient light position.
3. Fully Nocturnal, because large perspective/road layers can become expensive.
4. Light Will Win, because current contracts include paint-risk behaviour.
5. Dying for a Diagnosis.
6. Presents and Chocolate.
7. Walk With Me.
8. Amnesty and any remaining detected adapter.

For each adapter, require page scoping, bounded output fuzzing, lifecycle cleanup, duplicate-init protection, input parity, reduced motion, CSS consumer classification and plugin-off versus plugin-on performance. Each effect gets release-specific controls and presets; shared manifests may reuse only neutral timing/input fields.

Exit criteria: every detected factory has exactly one manifest, one adapter, one property inventory and a passing automated result bundle. Unknown pages activate nothing.

### Phase 7 - connect the harness to validation and pre-live QA

Refactor `tools/validate.ps1` into explicit modes, for example:

- `-Mode Unit`: syntax, UTF-8, schemas, PHP/Node contracts and failing-fixture checks; read-only;
- `-Mode Browser`: live-lab handshake, deterministic paths, accessibility, CSS audit and performance smoke; read-only;
- `-Mode Package`: migration rebuild, package creation, inventory/hash checks; mutating and explicit;
- `-Mode Release`: Unit + Browser + Package, with physical-device evidence manifest required; and
- `-Mode Prelive -PageManifest <path>`: exact EPK candidate checks and evidence assembly; never publishes.

Add these runners already named by `TEST-PLAN.md`:

- `tests/sensor-raf-scheduler.test.cjs`;
- `tests/clay-adapter.test.cjs`;
- `tests/harness/e2e/performance-budget.e2e.mjs`;
- `tests/harness/e2e/css-property-audit.e2e.mjs`;
- `tests/harness/e2e/wordpress-render.e2e.mjs`; and
- shared `tests/harness/core/performance-instrumentation.js` or its equivalent module.

The combined result must include gate ID, status, exact source and ZIP hashes, browser/device, viewport/refresh rate, preset, raw-evidence paths and advisory findings. A required `FAIL`, `BLOCKED`, missing physical run, buffer overflow or unattributed handler makes the coordinator non-zero.

Exit criteria: one command produces a complete plugin-gate decision for an exact package, and one separate command produces a page-specific pre-live decision without any external mutation.

### Phase 8 - stage and release

1. Complete automated plugin gates before creating a release candidate ZIP.
2. Run plugin-off/plugin-on 30-second captures at 20/60/120/240 synthetic events per second.
3. Run nominated physical iPhone Safari and Android Chrome tests, including 60 Hz and 120 Hz evidence where supported.
4. Run the five-minute soak and fault-injection suite.
5. Build the candidate package only after the read-only suites pass; use the resulting exact ZIP hash for staging.
6. Rehearse upgrade and rollback on staging, including the page-252 legacy-plugin collision rule.
7. For each EPK, capture canonical live parity first, test the exact merged WordPress-rendered candidate at 1440/900/390, and assemble E-001 through E-023.
8. Check server capacity before any WordPress write. Obtain narrow action-time approval naming the page, payload hash, plugin ZIP hash, metadata and legacy-plugin state.
9. Save once, then repeat persisted-source, signed-out, physical tilt, accessibility, Unicode and functional-route verification.

Exit criteria: all required P gates pass for the exact ZIP and all required E gates pass for the exact page payload. Publication remains a separate approved action.

## Performance budgets

Use the existing `TEST-PLAN.md` budgets as release blockers:

- orientation handler: p95 at most 0.5 ms and p99 at most 1 ms;
- rAF effect work: p95 at most 4.2 ms at 60 Hz and 2.1 ms at 120 Hz;
- input-to-visual-commit latency: p95 at most two refresh intervals;
- each EPK-specific cue handler: p95 at most 25% of the detected frame interval;
- total synchronous cue work: p95 at most 50% of the detected frame interval;
- effect-attributable tasks of 50 ms or more: zero; and
- additional dropped-frame rate versus the same page with effects disabled: at most one percentage point.

Do not weaken a threshold to make an effect pass. Tune the effect, reduce layer cost or move non-visual work out of the synchronous path. If a browser cannot expose a required metric, the result is `BLOCKED` until equivalent physical-device evidence exists.

## New-effect workflow after the harness is implemented

Every new or materially changed effect follows this sequence:

1. Establish canonical live parity, authoritative assets, master hash/BPM and originality record.
2. Scaffold a manifest and adapter with `tools/new-effect-harness.ps1`.
3. Register all synchronous cue/interval handlers with stable IDs.
4. Declare master, timing and effect parameters with safe ranges and baseline values.
5. Add deterministic input, cue, seek, lifecycle, accessibility and fault paths.
6. Tune live in the lab; export the chosen preset and keep baseline versus candidate evidence.
7. Run unit, scheduler, property/bottleneck and browser performance gates.
8. Run physical-device and soak evidence when the effect uses motion or can materially affect frames.
9. Run the exact WordPress-rendered candidate through the page gate.
10. Build/package only after read-only gates pass; publish only after separate action-time approval.

No new effect is complete merely because it looks correct in the lab. It is complete when its real production implementation, exact page candidate and evidence bundle pass the applicable plugin and EPK gates.

## Work packages and dependencies

| Work package | Depends on | Principal deliverable |
|---|---|---|
| WP-0 Baseline reconciliation | None | Correct contract and non-mutating validator mode |
| WP-1 Harness core | WP-0 | Versioned live lab, schemas and scaffolder |
| WP-2 Diagnostics | WP-1 | Attributable bounded timing stream |
| WP-3 Orientation scheduler | WP-2 | Latest-sample, one-rAF runtime and tests |
| WP-4 Clay pilot | WP-1, WP-2 | Tunable real-effect adapter and passing Clay gates |
| WP-5 Property/bottleneck audit | WP-1 | Static plus runtime classification report |
| WP-6 Adapter rollout | WP-3, WP-4, WP-5 | Coverage for all supported release adapters |
| WP-7 Validation/pre-live integration | WP-2 through WP-6 | Combined plugin and page gate manifests |
| WP-8 Staging/release | WP-7 | Exact-hash evidence, rollback rehearsal and approval-ready candidate |

WP-3, WP-4 and WP-5 can proceed in parallel after the diagnostics contract is stable. Do not start broad adapter migration until the Clay pilot proves that the manifest, adapter and evidence formats are sufficient.

## Definition of done

- Harness and QA files are excluded from the WordPress ZIP and verified absent from its inventory.
- All real effects use production assets, not harness replicas.
- Live controls can change and reset safe parameters without altering WordPress or source files.
- Orientation, rAF, core cue/reset and every EPK-specific cue handler are timed and attributable.
- CSS custom-property consumers and other bottlenecks are classified at all required viewports.
- Legacy 30 ms batching and its tests are gone.
- Continuous paint/layout animation is gone or is an explicit failing blocker.
- Automated, staging and physical-device evidence is linked to exact hashes.
- A failing fixture proves non-zero gate enforcement.
- The exact package passes all P gates, and each page independently passes all applicable E gates before it is made live.

## Potential problems

### The written test plan can lag behind implemented repository state

- **Symptom:** a planning document says the validator is missing or specifies a ten-second mapper while the repository contains `tools/validate.ps1` and production uses two seconds.
- **Cause:** implementation and test-plan edits were made at different times.
- **Corrective action:** phase 0 inventories executable behaviour and updates the written contract before harness implementation; baseline hashes and explicit decision records become required evidence.
- **Verification:** searches, tests and the contract all agree on the validator modes and rolling-window duration.
- **Limit:** agreement does not prove the selected duration feels best; that requires A/B and device testing.

### Running validation can unexpectedly mutate release artifacts

- **Symptom:** a routine test run rewrites migration files or `dist` even when the operator intended a read-only check.
- **Cause:** the current validator always invokes migration building and packaging.
- **Corrective action:** introduce explicit read-only and package/release modes; make mutation opt-in and keep publication outside every test command.
- **Verification:** hash the migration and `dist` trees before and after Unit/Browser modes and require no change.
- **Limit:** Package/Release modes are expected to rebuild their declared artifacts.

### Harness instrumentation can become the performance bottleneck

- **Symptom:** frame/event counts change, buffers overflow, or the instrumented build fails budgets that the uninstrumented build meets.
- **Cause:** per-frame allocation, DOM logging, observers or retained raw records add significant work.
- **Corrective action:** use a bounded in-memory sink, compact records, batch UI refreshes outside the measured path, quantify empty-wrapper overhead and compare diagnostics off/on counts.
- **Verification:** instrumentation equivalence tests pass and overhead is included in the evidence.
- **Limit:** very small spans may approach clock resolution; report uncertainty instead of inventing precision.

### A green CSS scan can miss expensive custom-property consumers

- **Symptom:** JavaScript appears to update only `--x`, but the variable drives a gradient, mask, shadow or layout property and causes recurring paint/layout.
- **Cause:** the scanner classifies writes without resolving CSS consumers and rendered bounds.
- **Corrective action:** trace every custom property to all consumers, combine static findings with runtime style/paint evidence, and block unknown dynamic construction.
- **Verification:** known-bad fixtures fail and the report includes consumer property, selector, source and rendered area.
- **Limit:** browser traces remain necessary for filters, transforms and opacity because nominally compositor-friendly properties can still be expensive on large layers.

### Lab tuning can be mistaken for a production setting

- **Symptom:** a temporary BPM, intensity or timing override is treated as authoritative release metadata.
- **Cause:** the live lab and production provenance are not visually or structurally separated.
- **Corrective action:** label overrides as temporary, display verified production values separately, export presets as evidence only and prohibit write-back from the harness.
- **Verification:** resetting reloads the manifest baseline and repository/WordPress hashes remain unchanged.
- **Limit:** applying an approved preset to production is a separate reviewed code/content change followed by the complete gate sequence.

### An expected native-process failure can terminate its PowerShell contract test too early

- **Symptom:** the deliberate validator-failure test stops at the child Node syntax error instead of checking the expected exit code and attributed filename.
- **Cause:** Windows PowerShell converts redirected native stderr into error records, and the wrapper's `$ErrorActionPreference = 'Stop'` terminates on the first record.
- **Corrective action:** set the wrapper to `Continue` only around the deliberately failing child process, capture merged output and `$LASTEXITCODE`, then restore the prior error preference before assertions.
- **Verification:** `tools/test-validator-failure.ps1` completes with a PASS message only when the child exits non-zero and its output names `validation-deliberate-failure.js`.
- **Limit:** use this only for a test that deliberately expects native-process failure; normal validation retains fail-fast behaviour.

### A reused localhost port can route a harness request to the wrong server

- **Symptom:** the browser reaches `127.0.0.1` but every harness path returns the Python 404 page even when the file exists.
- **Cause when observed:** multiple processes were listening on port 8765, so requests did not reliably reach the newly started DanceMoves server; changing only its working directory did not resolve the collision.
- **Corrective action:** inspect the requested URL directly, choose an unused loopback port, and start Python with an explicit `--directory` pointing at the DanceMoves repository root.
- **Verification:** the exact `live-lab.html` URL returns HTTP 200 before browser navigation, then the lab reaches `Candidate connected`.
- **Limit:** do not terminate unknown listener processes merely to reclaim a preferred port; select a free port unless the process is known to belong to the current run.
